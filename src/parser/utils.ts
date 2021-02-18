import { TokenFormat } from '../formatted-string';
import ParserState from './state';

export const enum Codes {
    // Formatting
    /** * */
    Asterisk = 42,
    /** _ */
    Underscore = 95,
    /** ` */
    BackTick = 96,
    /** ~ */
    Tilde = 126,

    // Punctuation
    /** ! */
    Exclamation = 33,
    /** "" */
    DoubleQuote = 34,
    /** ' */
    SingleQuote = 39,
    /** , */
    Comma = 44,
    /** . */
    Period = 46,
    /** : */
    Colon = 58,
    /** : */
    SemiColon = 59,
    /** ? */
    Question = 63,
    /** ( */
    RoundBracketOpen = 40,
    /** ) */
    RoundBracketClose = 41,
    /** [ */
    SquareBracketOpen = 91,
    /** ] */
    SquareBracketClose = 93,
    /** { */
    CurlyBracketOpen = 123,
    /** } */
    CurlyBracketClose = 125,
    /** - */
    Hyphen = 45,
    /** &ndash; */
    EnDash = 0x02013,
    /** &mdash; */
    EmDash = 0x02014,

    // Whitespace
    Tab = 9, // \t
    Space = 32, //
    NBSP = 160, // &nbsp;

    // New line
    /** `\n` */
    NewLine = 10, // \n
    /** `\r` */
    Return = 13,
    /** `\f` */
    LineFeed = 12,

    // Special
    /** = */
    Equal = 61,
    /** \ */
    BackSlash = 92,
    /** | */
    Pipe = 124,
    /** ^ */
    Caret = 94,
    /** % */
    Percent = 37,
    /** & */
    Ampersand = 38,
    /** + */
    Plus = 43,
    /** @ */
    At = 64,
}

const punctuation = new Set<number>([
    Codes.Exclamation, Codes.DoubleQuote, Codes.SingleQuote, Codes.RoundBracketOpen,
    Codes.RoundBracketClose, Codes.Comma, Codes.Period, Codes.Colon, Codes.SemiColon,
    Codes.Question, Codes.SquareBracketOpen, Codes.SquareBracketClose, Codes.CurlyBracketOpen, Codes.CurlyBracketClose,
    Codes.Hyphen, Codes.EnDash, Codes.EmDash
]);

const delimiterPunctuation = new Set<number>([
    Codes.Exclamation, Codes.Comma, Codes.Period, Codes.SemiColon, Codes.Question
]);

export function isPunctuation(ch: number): boolean {
    return punctuation.has(ch);
}

export function isDelimiterPunct(ch: number): boolean {
    return delimiterPunctuation.has(ch);
}

export function isWhitespace(ch: number): boolean {
    return ch === Codes.Space
        || ch === Codes.NBSP
        || ch === Codes.Tab;
}

export function isNewLine(ch: number): boolean {
    return ch === Codes.NewLine
        || ch === Codes.Return
        || ch === Codes.LineFeed;
}

export function isSimpleFormatting(ch: number): boolean {
    return ch === Codes.Asterisk
        || ch === Codes.Underscore
        || ch === Codes.Tilde;
}

export function isDelimiter(ch?: number): boolean {
    return ch === undefined
        || ch !== ch /* NaN */
        || isNewLine(ch)
        || isWhitespace(ch)
        || isPunctuation(ch)
        || isSimpleFormatting(ch);
}

/**
 * Проверяет, является ли указанный символ стандартным идентификатором: латинские
 * символы, цифры подчёркивание и дефис
 */
export function isIdentifier(ch: number): boolean {
    return ch === Codes.Underscore
        || ch === Codes.Hyphen
        || isAlphaNumeric(ch);
}

/**
 * Вернёт `true` если из текущей позиции удалось поглотить правильный идентификатор
 */
export function consumeIdentifier(state: ParserState): boolean {
    // Идентификатор обязательно должен начинаться с латинского символа
    if (state.consume(isAlpha)) {
        state.consumeWhile(isIdentifier);
        return true;
    }

    return false;
}

/**
 * Вернёт `true`, если все коды из `arr` были поглощены из текущей позиции потока
 */
export function consumeArray(state: ParserState, arr: number[]): boolean {
    const { pos } = state;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] !== state.next()) {
            state.pos = pos;
            return false;
        }
    }

    return true;
}

/**
 * Проверяет, находимся ли мы сейчас в контексте блока кода: для некоторых случаев
 * это влияет на возможность парсинга
 */
export function isCodeBlock(state: ParserState): boolean {
    return state.hasFormat(TokenFormat.MONOSPACE);
}

/**
 * Вернёт `true` если указанный код соответствует числу
 */
export function isNumber(code: number): boolean {
    return code > 47 && code < 58;
}

/**
 * Вернёт `true` если указанный код соответствует латинским символам от A до Z
 */
export function isAlpha(code: number): boolean {
    code &= ~32; // quick hack to convert any char code to uppercase char code
    return code >= 65 && code <= 90;
}

/**
 * Вернёт `true` если указанный код соответствует числу или символам A-Z
 */
export function isAlphaNumeric(code: number): boolean {
    return isNumber(code) || isAlpha(code);
}
