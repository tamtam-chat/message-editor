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
    Dot = 46,
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
    /** / */
    Slash = 47,
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
    /** # */
    Hash = 35,
}

const punctuation = new Set<number>([
    Codes.Exclamation, Codes.DoubleQuote, Codes.SingleQuote, Codes.RoundBracketOpen,
    Codes.RoundBracketClose, Codes.Comma, Codes.Dot, Codes.Colon, Codes.SemiColon,
    Codes.Question, Codes.SquareBracketOpen, Codes.SquareBracketClose, Codes.CurlyBracketOpen, Codes.CurlyBracketClose,
    Codes.Hyphen, Codes.EnDash, Codes.EmDash
]);

const delimiterPunctuation = new Set<number>([
    Codes.Exclamation, Codes.Comma, Codes.Dot, Codes.SemiColon, Codes.Question
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

export function isBound(ch?: number): boolean {
    return ch === undefined
        || ch !== ch /* NaN */
        || isNewLine(ch)
        || isWhitespace(ch)
}

export function isDelimiter(ch?: number): boolean {
    return isBound(ch)
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

export function last<T>(arr: T[]): T | undefined {
    if (arr.length > 0) {
        return arr[arr.length - 1];
    }
}

/**
 * Конвертация указанной стоки в список кодов символов
 */
export function toCode(str: string): number[] {
    const result: number[] = [];
    for (let i = 0; i < str.length; i++) {
        result.push(str.charCodeAt(i));
    }

    return result;
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

/**
 * Check if given character code is simple letter of supported alphabets
 */
export function isMultiAlpha(code: number): boolean {
    return isAlpha(code) || // a-zA-Z
        code === 1105 || code === 1025 || // Ёё
        code >= 1040 && code <= 1103 || // Аа-Яя
        code >= 1568 && code <= 1599 || // Arabic and Farsi letters
        code >= 1601 && code <= 1610 || // Arabic letters
        code === 1662 || code === 1670 || code === 1688 || code === 1703 || code === 1705 || code === 1711 || // arabic letters
        code >= 1729 && code <= 1731 || // Arabic letters
        code === 1740 || // Arabic letters
        code >= 1641 && code <= 1776; // Arabic and Persian numbers
}

/**
 * All unicode character set alpha like
 */
export function isUnicodeAlpha(code: number): boolean {
    return isAlpha(code)
        || code >= 880 && code <= 1023   // Greek and Coptic
        || code >= 1024 && code <= 1279  // Cyrillic
        || code >= 1280 && code <= 1327  // Cyrillic Supplementary
        || code >= 1328 && code <= 1423  // Armenian
        || code >= 1424 && code <= 1535  // Hebrew
        || code >= 1536 && code <= 1791  // Arabic
        || code >= 19968 && code <= 40959 // Chinese
        || code >= 1792 && code <= 1871  // Syriac
        || code >= 1920 && code <= 1983  // Thaana
        || code >= 2304 && code <= 2431  // Devanagari
        || code >= 2432 && code <= 2559  // Bengali
        || code >= 2560 && code <= 2687  // Gurmukhi
        || code >= 2688 && code <= 2815  // Gujarati
        || code >= 2816 && code <= 2943  // Oriya
        || code >= 2944 && code <= 3071  // Tamil
        || code >= 3072 && code <= 3199  // Telugu
        || code >= 3200 && code <= 3327  // Kannada
        || code >= 3328 && code <= 3455  // Malayalam
        || code >= 3456 && code <= 3583  // Sinhala
        || code >= 3584 && code <= 3711  // Thai
        || code >= 3712 && code <= 3839  // Lao
        || code >= 3840 && code <= 4095  // Tibetan
        || code >= 4096 && code <= 4255  // Myanmar
        || code >= 4256 && code <= 4351  // Georgian
        || code >= 4352 && code <= 4607  // Hangul Jamo
        || code >= 4608 && code <= 4991  // Ethiopic
        || code >= 5024 && code <= 5119  // Cherokee
        || code >= 5120 && code <= 5759  // Unified
        || code >= 5760 && code <= 5791  // Ogham
        || code >= 5792 && code <= 5887  // Runic
        || code >= 5888 && code <= 5919  // Tagalog
        || code >= 5920 && code <= 5951  // Hanunoo
        || code >= 5952 && code <= 5983  // Buhid
        || code >= 5984 && code <= 6015  // Tagbanwa
        || code >= 6016 && code <= 6143  // Khmer
        || code >= 6144 && code <= 6319  // Mongolian
        || code >= 6400 && code <= 6479  // Limbu
        || code >= 6480 && code <= 6527; // Tai Le
}

export function isCommandName(ch: number): boolean {
    return ch === Codes.Underscore || isNumber(ch) || isMultiAlpha(ch);
}
