/**
 * @description
 * Минималистичный парсер HTML, который выдаёт результат в виде форматированной строки
 */
import { TokenFormat, TokenType } from './types';
import type { Token } from './types';
import ParserState from './state';
import emoji from './emoji';
import textEmoji from './text-emoji';
import userSticker from './user-sticker';
import mention from './mention';
import command from './command';
import hashtag from './hashtag';
import link from './link';
import newline from './newline';
import { defaultOptions, isWhitespace, Codes, normalize, last, getLength, isNumber, isAlpha, isNewLine, isQuote, isAlphaNumeric } from './utils';
import { insertText, setLink } from '../formatted-string';
import { trim } from '../formatted-string/split';

export type HTMLElementType = 'open' | 'close' | 'void';
type StackItem = [tag: HTMLTag, format: TokenFormat];
type PendingLink = [url: string, start: number];
type PendingText = [text: string, pos: number];

interface HTMLTag {
    type: HTMLElementType;
    name: string;
    attributes?: Record<string, string>;
}

const cdataOpen = toCharCodes('<![CDATA[');
const cdataClose = toCharCodes(']]>');
const commentOpen = toCharCodes('<!--');
const commentClose = toCharCodes('-->');
const piStart = toCharCodes('<?');
const piEnd = toCharCodes('?>');
const voidTerminator = toCharCodes('/>');
let entityConverter: HTMLElement | null | undefined;

const specialTags = ['script', 'style'];
const voidTags = ['img', 'meta', 'link', 'br', 'base', 'hr', 'area', 'wbr', 'col', 'embed', 'input', 'param', 'source', 'track'];
const blockTags = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'section'];

const tagToFormat: Record<string, TokenFormat> = {
    b: TokenFormat.Bold,
    strong: TokenFormat.Bold,
    i: TokenFormat.Italic,
    em: TokenFormat.Italic,
    code: TokenFormat.Monospace,
    s: TokenFormat.Strike,
    u: TokenFormat.Underline,
};

interface HTMLParserOptions {
    /** Разрешать парсить ссылки */
    links: boolean;
}

const cssReset = ['normal', 'unset', 'initial', 'revert', 'none'];
const monospaceFonts = ['jetbrains mono', 'fira code', 'pt mono', 'menlo', 'courier', 'monospace'];

export default function htmlToString(html: string, options?: Partial<HTMLParserOptions>): Token[] {
    const state = new ParserState(html, {
        ...defaultOptions,
        useFormat: true
    });

    const opt: HTMLParserOptions = {
        links: false,
        ...options
    };

    const stack: StackItem[] = [];
    const pendingText: PendingText[] = [];
    let pendingLink: PendingLink | null = null;
    let tag: HTMLTag;
    let entity: string | undefined;

    const closeLink = (pos: number = getLength(state.tokens)) => {
        if (pendingLink && pendingLink[1] !== pos) {
            state.tokens = setLink(state.tokens, pendingLink[0], pendingLink[1], pos - pendingLink[1]);
        }
        pendingLink = null;
    }

    while (state.hasNext()) {
        if ((entity = consumeEntity(state))) {
            state.flushText();
            state.tokens.push({
                type: TokenType.Text,
                format: state.format,
                value: convertEntity(entity),
                sticky: false,
            });
        } else if ((tag = htmlTag(state))) {
            state.flushText();

            if (tag.name === 'input' && tag.attributes.value) {
                // Пограничный случай: если есть <input>, то надо достать из него
                // значение, но только если это не контрол типа чекбокса
                const inputType = (tag.attributes.type || '').toLowerCase();
                if (inputType !== 'radio' && inputType !== 'checkbox') {
                    pendingText.push([tag.attributes.value, getLength(state.tokens)]);
                }
            }

            if (tag.type === 'open') {
                if (specialTags.includes(tag.name)) {
                    // Это специальный тэг: нужно пропустить всё, что находится внутри
                    skipToTag(state, tag.name);
                } else {
                    state.format = formatFromTag(tag, state.format);
                    stack.push([tag, state.format]);

                    if (blockTags.includes(tag.name)) {
                        pushNewline(pendingText, getLength(state.tokens));
                    }

                    // Ссылка: убедимся, что там написано то, что мы понимаем
                    if (tag.name === 'a' && opt.links && isValidHref(tag.attributes!.href)) {
                        const textLen = getLength(state.tokens);
                        closeLink(textLen);
                        pendingLink = [tag.attributes!.href, textLen];
                    }
                }
            } else if (tag.type === 'close') {
                const stackIx = stack.findIndex(item => item[0].name === tag.name);
                if (stackIx !== -1) {
                    stack.splice(stackIx, stack.length - stackIx);
                    const entry = last(stack);
                    state.format = entry ? entry[1] : TokenFormat.None;
                }
                if (tag.name === 'a' && opt.links) {
                    closeLink();
                }
            } else if (tag.name === 'br') {
                pushNewline(pendingText, getLength(state.tokens));
            }
        } else if (htmlInternal(state)) {
            state.flushText();
        } else {
            newline(state)
                || emoji(state) || textEmoji(state) || userSticker(state)
                || mention(state) || command(state) || hashtag(state)
                || link(state)
                || state.consumeText();
        }
    }

    state.flushText();
    let tokens = normalize(state.tokens);

    while (pendingText.length) {
        const [text, pos] = pendingText.pop();
        tokens = insertText(tokens, pos, text, state.options);
    }

    return trim(tokens).tokens;
}

function skipToTag(state: ParserState, tagName: string) {
    let tag: HTMLTag;
    while (state.hasNext()) {
        if ((tag = htmlTag(state))) {
            if (tag.name === tagName && tag.type === 'close') {
                break;
            }
        } else {
            state.pos++;
        }
    }
}

function consumeEntity(state: ParserState): string | undefined {
    const start = state.pos;
    if (state.consume(Codes.Ampersand)) {
        state.consume(Codes.Hash)
        if (state.consumeWhile(isAlphaNumeric) && state.consume(Codes.SemiColon)) {
            return state.substring(start);
        }
    }

    state.pos = start;
}

function htmlTag(state: ParserState): HTMLTag | undefined {
    const start = state.pos;
    if (state.consume(Codes.LeftAngle)) {
        const isClose = state.consume(Codes.Slash);
        const nameStart = state.pos;
        if (ident(state)) {
            const name = state.substring(nameStart).toLowerCase();
            if (isClose) {
                if (state.consume(Codes.RightAngle)) {
                    // Полностью поглотили закрывающий тэг
                    return { type: 'close', name };
                }
            } else {
                // Похоже на открывающий тэг, поищем атрибуты
                const attributes: Record<string, string> = {};
                while (state.hasNext()) {
                    state.consumeWhile(isSpace);
                    if (consumeArray(state, voidTerminator)) {
                        return { type: 'void', name, attributes };
                    }

                    if (state.consume(Codes.RightAngle)) {
                        return {
                            type: voidTags.includes(name) ? 'void' : 'open',
                            name,
                            attributes
                        };
                    }

                    const attrNameStart = state.pos;
                    if (ident(state)) {
                        if (state.consume(Codes.Equal)) {
                            const attrName = state.substring(attrNameStart, state.pos - 1);
                            const attrValueStart = state.pos;
                            if (quoted(state)) {
                                attributes[attrName] = state.substring(attrValueStart + 1, state.pos - 1);
                            } else if (unquoted(state)) {
                                attributes[attrName] = state.substring(attrValueStart);
                            }
                        }
                    } else {
                        break;
                    }
                }
            }
        }
    }

    state.pos = start;
}

/**
 * Вернёт `true` если сканнер проглотил внутренние HTML-данные, такие как комментарии
 * или CDATA
 */
function htmlInternal(state: ParserState): boolean {
    return cdata(state) || comment(state) || processingInstruction(state);
}

/**
 * Converts given string into array of character codes
 */
function toCharCodes(str: string): number[] {
    return str.split('').map(ch => ch.charCodeAt(0));
}

/**
 * Consumes section from given string which starts with `open` character codes
 * and ends with `close` character codes
 * @return Returns `true` if section was consumed
 */
function consumeSection(state: ParserState, open: number[], close: number[], allowUnclosed?: boolean): boolean {
    const start = state.pos;
    if (consumeArray(state, open)) {
        // consumed `<!--`, read next until we find ending part or reach the end of input
        while (state.hasNext()) {
            if (consumeArray(state, close)) {
                return true;
            }

            state.pos++;
        }

        // unclosed section is allowed
        if (allowUnclosed) {
            return true;
        }

        state.pos = start;
        return false;
    }

    // unable to find section, revert to initial position
    state.pos = start;
    return false;
}

/**
 * Consumes array of character codes from given scanner
 */
export function consumeArray(state: ParserState, codes: number[]): boolean {
    const start = state.pos;

    for (let i = 0; i < codes.length; i++) {
        if (!state.consume(codes[i])) {
            state.pos = start;
            return false;
        }
    }

    return true;
}

/**
 * Consumes CDATA from given scanner
 */
function cdata(state: ParserState): boolean {
    return consumeSection(state, cdataOpen, cdataClose, true);
}

/**
 * Consumes comments from given scanner
 */
function comment(state: ParserState): boolean {
    return consumeSection(state, commentOpen, commentClose, true);
}

/**
 * Consumes processing instruction from given scanner. If consumed, returns
 * processing instruction name
 */
function processingInstruction(state: ParserState): boolean {
    const start = state.pos;
    if (consumeArray(state, piStart) && ident(state)) {
        while (state.hasNext()) {
            if (consumeArray(state, piEnd)) {
                break;
            }

            quoted(state) || state.pos++;
        }

        return true;
    }

    state.pos = start;
    return false;
}

/**
 * Consumes identifier from given scanner
 */
function ident(state: ParserState): boolean {
    const start = state.pos;
    if (state.consume(nameStartChar)) {
        state.consumeWhile(nameChar);
        return true;
    }

    state.pos = start;
    return false;
}

/**
 * Check if given character can be used as a start of tag name or attribute
 */
function nameStartChar(ch: number): boolean {
    // Limited XML spec: https://www.w3.org/TR/xml/#NT-NameStartChar
    return isAlpha(ch) || ch === Codes.Colon || ch === Codes.Underscore
        || (ch >= 0xC0 && ch <= 0xD6)
        || (ch >= 0xD8 && ch <= 0xF6)
        || (ch >= 0xF8 && ch <= 0x2FF)
        || (ch >= 0x370 && ch <= 0x37D)
        || (ch >= 0x37F && ch <= 0x1FFF);
}

/**
 * Check if given character can be used in a tag or attribute name
 */
function nameChar(ch: number) {
    // Limited XML spec: https://www.w3.org/TR/xml/#NT-NameChar
    return nameStartChar(ch) || ch === Codes.Hyphen || ch === Codes.Dot || isNumber(ch)
        || ch === 0xB7
        || (ch >= 0x0300 && ch <= 0x036F);
}

/**
 * Check if given character code is a space character
 */
function isSpace(code: number): boolean {
    return isWhitespace(code) || isNewLine(code);
}

/**
 * Check if given character code is valid unquoted value
 */
export function isUnquoted(code: number): boolean {
    return !isNaN(code) && !isQuote(code) && !isSpace(code)
        && code !== Codes.RightAngle
        && code !== Codes.Slash;
}

/**
 * Consumes 'single' or "double"-quoted string from given string, if possible
 */
function quoted(state: ParserState): boolean {
    const start = state.pos;
    const quote = state.peek();

    if (state.consume(isQuote)) {
        while (state.hasNext()) {
            if (state.next() === quote) {
                return true;
            }
        }
    }

    state.pos = start;
    return false;
}

/**
 * Consumes unquoted value
 */
function unquoted(state: ParserState): boolean {
    return state.consumeWhile(isUnquoted);
}

/**
 * Простой парсинг атрибута style
 */
function parseStyle(value: string): Record<string, string> {
    const result: Record<string, string> = {};
    value
        .replace(/\/\*.?\*\//g, '')
        .split(';')
        .forEach(prop => {
            const [name, value] = prop.split(':', 2);
            if (value) {
                result[name.trim().toLowerCase()] = value.trim().toLowerCase();
            }
        });

    return result;
}

function formatFromTag(tag: HTMLTag, base: TokenFormat = TokenFormat.None): TokenFormat {
    let format = base;
    if (tag.name in tagToFormat) {
        format |= tagToFormat[tag.name];
    }

    if (tag.attributes?.style) {
        const css = parseStyle(tag.attributes.style);
        // Стили могут как добавлять, так и удалять форматирование
        const fontStyle = css['font-style'];
        const fontWeight = css['font-weight'];
        const fontFamily = (css['font-family'] || '').toLowerCase();
        const textDecoration = css['text-decoration-line'] || css['text-decoration'] || '';

        if (fontStyle === 'italic') {
            format |= TokenFormat.Italic;
        } else if (cssReset.includes(fontStyle)) {
            format &= ~TokenFormat.Italic;
        }

        if (fontWeight === 'bold' || fontWeight === 'bolder') {
            format |= TokenFormat.Bold;
        } else if (cssReset.includes(fontWeight)) {
            format &= ~TokenFormat.Bold;
        } else if (/^\d+$/.test(fontWeight)) {
            if (parseInt(fontWeight, 10) > 400) {
                format |= TokenFormat.Bold;
            } else {
                format &= ~TokenFormat.Bold;
            }
        }

        if (textDecoration.includes('underline')) {
            format |= TokenFormat.Underline;
        }

        if (textDecoration.includes('line-through')) {
            format |= TokenFormat.Strike;
        }

        if (cssReset.includes(textDecoration)) {
            format &= ~(TokenFormat.Underline | TokenFormat.Strike);
        }

        if (fontFamily) {
            if (monospaceFonts.some(font => fontFamily.includes(font))) {
                format |= TokenFormat.Monospace;
            } else {
                format &= ~TokenFormat.Monospace;
            }
        }
    }

    return format;
}

function isValidHref(url: string | undefined): boolean {
    if (url) {
        return /^mailto:/i.test(url) || /^https?:/i.test(url);
    }

    return false;
}

function pushNewline(chunks: PendingText[], pos: number) {
    const tail = last(chunks);
    if (tail && tail[0] === '\n' && tail[1] === pos) {
        // Уже есть перевод строки в этом месте, ничего не добавляем
        return;
    }

    chunks.push(['\n', pos]);
}

function convertEntity(entity: string): string {
    if (entityConverter === undefined) {
        entityConverter = typeof document !== 'undefined'
            ? document.createElement('div')
            : null;
    }

    if (entityConverter) {
        entityConverter.innerHTML = entity;
        return entityConverter.innerText;
    }

    return entity;
}
