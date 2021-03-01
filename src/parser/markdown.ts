import { TokenFormat } from '../formatted-string';
import { Token, TokenMarkdown, TokenType } from '../formatted-string/types';
import ParserState from './state';
import { Codes, isDelimiter, isBound } from './utils';

export default function parseMarkdown(state: ParserState): boolean {
    if (state.options.markdown) {
        const { pos } = state;
        // FIXME неправильное определение для случая с `_italic😀)_,` позиция 10
        if (isStartBound(state)) {
            consumeOpen(state);
        } else {
            consumeClose(state);
        }

        return state.pos !== pos;
    }

    return false;
}

/**
 * Возвращает MS-формат для указанного кода
 */
export function formatForChar(ch: number): TokenFormat {
    switch (ch) {
        case Codes.Asterisk:
            return TokenFormat.Bold;
        case Codes.Underscore:
            return TokenFormat.Italic;
        case Codes.Tilde:
            return TokenFormat.Strike;
        case Codes.BackTick:
            return TokenFormat.Monospace;
        default:
            return TokenFormat.None;
    }
}

export function peekClosingMarkdown(state: ParserState): boolean {
    if (!state.options.markdown) {
        return false;
    }

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
        const ch = state.peekPrev()
        return isBound(ch)
            || ch === Codes.RoundBracketOpen
            || ch === Codes.SquareBracketOpen
            || ch === Codes.CurlyBracketOpen;
    }

    return false;
}

function isEndBound(state: ParserState): boolean {
    return isDelimiter(state.peek());
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
    let nextFormat: TokenFormat;

    while (state.hasNext()) {
        nextFormat = formatForChar(state.peek());
        if (nextFormat !== TokenFormat.None && state.hasFormat(nextFormat)) {
            state.pos++;
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
    const openToken = state.formatStack.pop()!;
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
