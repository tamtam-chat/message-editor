import { TokenType, TokenFormat } from '../parser/types';
import type { Token, TokenMarkdown } from '../parser/types';
import type ParserState from '../parser/state';
import { Codes, isDelimiter, isBound, last, isPunctuation } from '../parser/utils';

export const charToFormat = new Map<number, TokenFormat>([
    [Codes.Asterisk, TokenFormat.Bold],
    [Codes.Underscore, TokenFormat.Italic],
    [Codes.Tilde, TokenFormat.Strike],
    [Codes.BackTick, TokenFormat.Monospace],
]);

export default function parseMarkdown(state: ParserState): boolean {
    const { pos } = state;
    if (!customLink(state)) {
        if (isStartBound(state)) {
            consumeOpen(state);
        } else {
            consumeClose(state);
        }
    }

    return state.pos !== pos;
}

/**
 * Возвращает MS-формат для указанного кода
 */
export function formatForChar(ch: number): TokenFormat {
    return charToFormat.get(ch) || TokenFormat.None;
}

export function isStartBoundChar(ch: number): boolean {
    return isBound(ch)
        || ch === Codes.RoundBracketOpen
        || ch === Codes.SquareBracketOpen
        || ch === Codes.CurlyBracketOpen;
}

export function isEndBoundChar(ch: number): boolean {
    return isDelimiter(ch) || isPunctuation(ch);
}

export function peekClosingMarkdown(state: ParserState): boolean {
    const { pos } = state;
    let format: TokenFormat;
    while ((format = formatForChar(state.peek())) && state.hasFormat(format)) {
        state.pos++;
    }

    const result = pos !== state.pos && isEndBound(state);
    state.pos = pos;
    return result;
}

/**
 * Проверяем, находимся ли в позиции, где можем начать MD-форматирование
 */
function isStartBound(state: ParserState): boolean {
    if (state.pos === 0) {
        // Находимся в самом начале
        return true;
    }

    if (state.hasPendingText()) {
        return isStartBoundChar(state.peekPrev());
    }

    const token = last(state.tokens);
    if (token?.type === TokenType.Markdown && (token.format & TokenFormat.LinkLabel)) {
        return true;
    }

    return false;
}

function isEndBound(state: ParserState): boolean {
    return isEndBoundChar(state.peek());
}

/**
 * Пытаемся поглотить начало форматирования
 */
function consumeOpen(state: ParserState): void {
    let nextFormat: TokenFormat;

    while (state.hasNext()) {
        nextFormat = formatForChar(state.peek());
        if (nextFormat !== TokenFormat.None && !state.hasFormat(nextFormat)) {
            state.pos++;
            pushOpen(state, mdToken(state, nextFormat));
        } else {
            break;
        }
    }
}

/**
 * Пытаемся поглотить конец форматирования
 */
function consumeClose(state: ParserState): void {
    // Поглощение закрывающих токенов чуть сложнее: токен считается закрывающим,
    // если за ним следует граница слова. Поэтому мы сначала накопим потенциальные
    // закрывающие токены, а потом проверим, можем ли их закрыть
    const pending: TokenMarkdown[] = [];
    const { pos } = state;
    let { format } = state;
    let nextFormat: TokenFormat;

    while (state.hasNext()) {
        nextFormat = formatForChar(state.peek());
        if (nextFormat !== TokenFormat.None && (format & nextFormat)) {
            state.pos++;
            format &= ~nextFormat;
            pending.push(mdToken(state, nextFormat));
        } else {
            break;
        }
    }

    if (pending.length && isEndBound(state)) {
        for (let i = 0; i < pending.length; i++) {
            pushClose(state, pending[i]);
        }
    } else if (pos !== state.pos) {
        state.markPending(pos);
    }
}

function mdToken(state: ParserState, format: TokenFormat): TokenMarkdown {
    return {
        type: TokenType.Markdown,
        format,
        value: state.substring(state.pos - 1)
    };
}

/**
 * Добавляем в стэк открывающий MD-токен
 */
function pushOpen(state: ParserState, token: TokenMarkdown): void {
    state.push(token);
    state.format |= token.format;
    state.formatStack.push(token);
}

/**
 * Добавляем в стэк закрывающий MD-токен
 */
function pushClose(state: ParserState, token: TokenMarkdown): void {
    state.push(token);
    state.format &= ~token.format;

    // Находим все промежуточные токены до открывающего и добавляем им указанный формат
    const openToken = popOpenToken(state, token);
    if (openToken) {
        // NB: минус 2, потому что добавили закрывающий токен.
        // Закрывающий токен добавляем для того, чтобы скинуть накопленный текст
        let i = state.tokens.length - 2;
        let prevToken: Token;
        while (i >= 0) {
            prevToken = state.tokens[i--];
            prevToken.format |= token.format;
            if (prevToken === openToken) {
                break;
            }
        }
    }
}

/**
 * Возвращает соответствующий открывающий md-токен для указанного закрывающего
 * md-токена
 */
function popOpenToken(state: ParserState, token: TokenMarkdown): TokenMarkdown | undefined {
    const stack = state.formatStack;
    let i = stack.length - 1;
    while (i >= 0) {
        if (stack[i].format & token.format) {
            return stack.splice(i, 1)[0];
        }
        i--;
    }
}

/**
 * Парсинг кастомной ссылки: `[some label](mail.ru)`
 */
function customLink(state: ParserState): boolean {
    const { pos } = state;

    if (state.consume(Codes.SquareBracketOpen)) {
        pushOpen(state, mdToken(state, TokenFormat.LinkLabel));
        return true;
    }

    if (state.consume(Codes.SquareBracketClose) && (state.format & TokenFormat.LinkLabel)) {
        // Нашли закрывающий токен ссылки: он имеет смысл только в том случае,
        // если за ним сразу следует ссылка в виде `(mail.ru)`
        const closeLabel = mdToken(state, TokenFormat.LinkLabel);
        if (state.consume(Codes.RoundBracketOpen)) {
            const openLink = mdToken(state, TokenFormat.Link);
            const start = state.pos;

            if (consumeCustomLinkClose(state)) {
                const linkValue = state.substring(start);
                pushClose(state, closeLabel);
                pushOpen(state, openLink);
                state.push({
                    type: TokenType.Link,
                    format: state.format,
                    value: linkValue,
                    link: linkValue,
                    auto: false,
                    sticky: false,
                });
                state.pos++;
                pushClose(state, mdToken(state, TokenFormat.Link));

                return true;
            }
        }

    }

    state.pos = pos;
    return false;
}

function consumeCustomLinkClose(state: ParserState): boolean {
    // Cчётчик на случай всякой фигни, чтобы далеко не парсить
    let guard = 2000;
    let ch: number;
    const { pos } = state;

    while (state.hasNext() && --guard) {
        ch = state.peek();
        if (ch === Codes.RoundBracketClose) {
            return true;
        }

        if (isBound(ch)) {
            break;
        }

        state.next();
    }

    state.pos = pos;
    return false;
}
