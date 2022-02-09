import { TokenFormat, TokenType } from './types';
import type { Token, TokenText, TokenNewline } from './types';
import { defaultOptions, last, normalize, getLength, isWhitespace } from './utils';
import ParserState from './state';
import emoji from './emoji';
import textEmoji from './text-emoji';
import userSticker from './user-sticker';
import mention from './mention';
import command from './command';
import hashtag from './hashtag';
import link from './link';
import { consumeNewline } from './newline';
import { setLink } from '../formatted-string';
import { trim } from '../formatted-string/split';

interface HTMLParserOptions {
    /** Разрешать парсить ссылки */
    links: boolean;
}

const blockTags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'section', 'br', 'hr']);
const skipTags = new Set(['base', 'head', 'link', 'meta', 'style', 'script', 'title', 'area', 'audio', 'map', 'track', 'video', 'embed', 'iframe', 'object', 'param', 'picture', 'portal', 'source', 'svg', 'math', 'noscript', 'datalist', 'select', 'template']);
const cssReset = new Set(['normal', 'unset', 'initial', 'revert', 'none']);
const monospaceFonts = ['jetbrains mono', 'fira code', 'pt mono', 'menlo', 'courier', 'monospace'];

const tagToFormat: Record<string, TokenFormat> = {
    b: TokenFormat.Bold,
    strong: TokenFormat.Bold,
    i: TokenFormat.Italic,
    em: TokenFormat.Italic,
    code: TokenFormat.Monospace,
    pre: TokenFormat.Monospace,
    var: TokenFormat.Monospace,
    s: TokenFormat.Strike,
    u: TokenFormat.Underline,
};

export default function parseHTML(html: string, options?: Partial<HTMLParserOptions>): Token[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const state = new HTMLParseState(options);
    walkDOM(doc.body || doc.documentElement, state);
    const tokens = normalize(state.tokens);
    return trim(tokens).tokens;
}

function walkDOM(node: Node, state: HTMLParseState) {
    node = node.firstChild;
    while (node) {
        if (isTextNode(node)) {
            state.pushText(node.nodeValue);
        } else if (isElementNode(node)) {
            const tagName = getTagName(node);

            if (!skipTags.has(tagName)) {
                const { format: prevFormat, link: prevLink } = state;
                state.format = formatFromTag(node, state.format);

                if (tagName === 'tr') {
                    state.pushNewline(1);
                } else if (tagName === 'td') {
                    state.pushText(' ');
                } else if (blockTags.has(tagName) || (node.previousSibling && blockTags.has(getTagName(node.previousSibling)))) {
                    state.pushNewline();
                }

                if (tagName === 'input') {
                    // Пограничный случай: если есть <input>, то надо достать из него
                    // значение, но только если это не контрол типа чекбокса
                    const inputValue = node.getAttribute('value')
                    const inputType = (node.getAttribute('type') || '').toLowerCase();
                    if (inputValue && inputType !== 'radio' && inputType !== 'checkbox') {
                        state.tokens.push(textToken(inputValue, state.format));
                    }
                } else if (tagName === 'img') {
                    const alt = node.getAttribute('alt');
                    if (alt) {
                        state.tokens.push(textToken(alt, state.format));
                    }
                } else {
                    if (tagName === 'a' && state.options.links) {
                        const href = node.getAttribute('href');
                        if (isValidHref(href)) {
                            state.link = href;
                        }
                    }

                    walkDOM(node, state);
                }

                state.format = prevFormat;
                state.link = prevLink;
            }
        }
        node = node.nextSibling;
    }
}

function isElementNode(node: Node): node is Element {
    return node.nodeType === 1;
}

function isTextNode(node: Node): node is Text {
    return node.nodeType === 3;
}

class HTMLParseState {
    format = TokenFormat.None;
    tokens: Token[] = [];
    link: string | null = null;
    options: HTMLParserOptions;

    constructor(opt?: Partial<HTMLParserOptions>) {
        this.options = {
            links: false,
            ...opt
        };
    }

    pushText(text: string) {
        let tokens = isSpaceOnlyText(text)
            ? this.handleWhitespace(text)
            : this.handleText(text);

        if (tokens) {
            if (this.link) {
                tokens = setLink(normalize(tokens), this.link, 0, getLength(tokens));
            }

            this.tokens = this.tokens.concat(tokens);
        }
    }

    pushNewline(limit?: number) {
        if (allowNewline(this.tokens, limit)) {
            this.tokens.push(nlToken());
        }
    }

    private handleWhitespace(text: string): Token[] | undefined {
        let value = '';
        if (this.format & TokenFormat.Monospace) {
            // Добавляем пробелы для моноширинного текста
            if (last(this.tokens)?.type === TokenType.Newline) {
                value = text;
            } else if (allowSpace(this.tokens)) {
                value = ' ';
            }
        } else if (allowSpace(this.tokens) && allowNewline(this.tokens, 1)) {
            value = ' ';
        }

        return value ? [textToken(value, this.format)] : undefined;
    }

    private handleText(text: string): Token[] {
        const state = new ParserState(text, {
            ...defaultOptions,
            useFormat: true
        });
        state.format = this.format;

        if (this.link) {
            // если находимся внутри ссылки, то ограничиваем, что можем парсить
            while (state.hasNext()) {
                newline(state)
                    || emoji(state) || textEmoji(state)
                    || state.consumeText();
            }
        } else {
            while (state.hasNext()) {
                newline(state)
                    || emoji(state) || textEmoji(state) || userSticker(state)
                    || mention(state) || command(state) || hashtag(state)
                    || link(state)
                    || state.consumeText();
            }
        }

        state.flushText();
        return state.tokens;
    }
}

/**
 * Вернёт `true` если можно добавлять перевод строки в указанную позицию
 */
function allowNewline(tokens: Token[], limit = 2): boolean {
    // Для красоты не будем давать добавлять более двух переводов строк подряд,
    // у нас же не блог-платформа, а написание текста
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        if (token.type === TokenType.Newline) {
            limit--;
            if (limit <= 0) {
                return false;
            }
        } else if (!isSpaceOnlyText(token.value)) {
            return true;
        }
    }

    return true;
}

function allowSpace(tokens: Token[]): boolean {
    const token = last(tokens);
    if (token) {
        const { value } = token;
        return !isWhitespace(value.charCodeAt(value.length - 1));
    }

    return true;
}

function formatFromTag(tag: Element, base: TokenFormat = TokenFormat.None): TokenFormat {
    const tagName = tag.nodeName.toLowerCase();
    const style = tag.getAttribute('style');
    let format = base;

    if (tagName in tagToFormat) {
        format |= tagToFormat[tagName];
    }

    if (style) {
        const css = parseStyle(style);
        // Стили могут как добавлять, так и удалять форматирование
        const fontStyle = css['font-style'];
        const fontWeight = css['font-weight'];
        const fontFamily = (css['font-family'] || '').toLowerCase();
        const textDecoration = css['text-decoration-line'] || css['text-decoration'] || '';

        if (fontStyle === 'italic') {
            format |= TokenFormat.Italic;
        } else if (cssReset.has(fontStyle)) {
            format &= ~TokenFormat.Italic;
        }

        if (fontWeight === 'bold' || fontWeight === 'bolder') {
            format |= TokenFormat.Bold;
        } else if (cssReset.has(fontWeight)) {
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

        if (cssReset.has(textDecoration)) {
            format &= ~(TokenFormat.Underline | TokenFormat.Strike);
        }

        if (fontFamily) {
            if (monospaceFonts.some(font => fontFamily.includes(font))) {
                format |= TokenFormat.Monospace;
            } else if (tagToFormat[tagName] !== TokenFormat.Monospace) {
                // В случае, если у нас явно тэгом не задано моноширинное оформление,
                // отменяем его для неизвестных шрифтов
                format &= ~TokenFormat.Monospace;
            }
        }
    }

    return format;
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

function isValidHref(url: string | undefined): boolean {
    if (url) {
        return /^mailto:/i.test(url) || /^https?:/i.test(url);
    }

    return false;
}

function newline(state: ParserState): boolean {
    if (consumeNewline(state)) {
        // Внутри HTML перевод строки по умолчанию означает пробел.
        // Кроме случаев, если у элемента указано `white-space: nowrap | pre`.
        // Так как мы анализируем только разметку, сохранять переводы строк
        // будем внутри monospace-текста
        if (state.format & TokenFormat.Monospace) {
            state.push(nlToken(state.format));
        } else if (allowSpace(state.tokens)) {
            state.push(textToken(' ', state.format));
        }

        return true;
    }

    return false;
}

function textToken(value: string, format: TokenFormat): TokenText {
    return {
        type: TokenType.Text,
        value,
        format,
        sticky: false
    }
}

function nlToken(format = TokenFormat.None): TokenNewline {
    return {
        type: TokenType.Newline,
        format,
        value: '\n',
    };
}

function isSpaceOnlyText(text: string): boolean {
    return /^[\s\r\n]+$/.test(text);
}

function getTagName(node: Node): string {
    return node.nodeName.toLowerCase();
}
