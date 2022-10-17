import { Token, TokenFormat, TokenType } from "../parser";
import { allowNewline, allowSpace, blockTags, formatFromTag, getTagName, HTMLParserOptions, isElementNode, isSpaceOnlyText, isTextNode, isValidHref, newline, nlToken, skipTags, textToken } from "../parser/html2";
import { defaultOptions, last } from "../parser/utils";
import emoji from '../parser/emoji';
import textEmoji from '../parser/text-emoji';
import userSticker from '../parser/user-sticker';
import mention from '../parser/mention';
import command from '../parser/command';
import hashtag from '../parser/hashtag';
import link from './link';
import ParserState from "../parser/state";
import { normalize, getLength } from "../parser/utils";
import { setLink } from "../formatted-string";
import { trim } from "../formatted-string/split";

export default function parseHTMLMD(html: string, options?: Partial<HTMLParserOptions>): Token[] {
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
        if (!(this.format & TokenFormat.Monospace)) {
            // Избавляемся от лишних пробелов и переводов строк, так как в HTML
            // они приравниваются к одному пробелу
            text = text.replace(/[\s\r\n]+/g, ' ');
        }

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
