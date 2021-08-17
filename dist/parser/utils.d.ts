import { Token } from './types';
import ParserState from './state';
export declare const enum Codes {
    /** * */
    Asterisk = 42,
    /** _ */
    Underscore = 95,
    /** ` */
    BackTick = 96,
    /** ~ */
    Tilde = 126,
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
    EnDash = 8211,
    /** &mdash; */
    EmDash = 8212,
    Tab = 9,
    Space = 32,
    NBSP = 160,
    /** `\n` */
    NewLine = 10,
    /** `\r` */
    Return = 13,
    /** `\f` */
    LineFeed = 12,
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
    Hash = 35
}
export declare function isPunctuation(ch: number): boolean;
export declare function isBoundPunctuation(ch: number): boolean;
export declare function isDelimiterPunct(ch: number): boolean;
export declare function isWhitespace(ch: number): boolean;
export declare function isNewLine(ch: number): boolean;
export declare function isMarkdown(ch: number): boolean;
export declare function isBound(ch?: number): boolean;
export declare function isDelimiter(ch?: number): boolean;
/**
 * Проверяет, является ли указанный символ стандартным идентификатором: латинские
 * символы, цифры подчёркивание и дефис
 */
export declare function isIdentifier(ch: number): boolean;
/**
 * Вернёт `true` если из текущей позиции удалось поглотить правильный идентификатор
 */
export declare function consumeIdentifier(state: ParserState): boolean;
/**
 * Вернёт `true`, если все коды из `arr` были поглощены из текущей позиции потока
 */
export declare function consumeArray(state: ParserState, arr: number[], ignoreCase?: boolean): boolean;
export declare function last<T>(arr: T[]): T | undefined;
/**
 * Конвертация указанной стоки в список кодов символов
 */
export declare function toCode(str: string, ignoreCase?: boolean): number[];
/**
 * Проверяет, находимся ли мы сейчас в контексте блока кода: для некоторых случаев
 * это влияет на возможность парсинга
 */
export declare function isCodeBlock(state: ParserState): boolean;
/**
 * Вернёт `true` если указанный код соответствует числу
 */
export declare function isNumber(code: number): boolean;
/**
 * Вернёт `true` если указанный код соответствует латинским символам от A до Z
 */
export declare function isAlpha(code: number): boolean;
/**
 * Вернёт `true` если указанный код соответствует числу или символам A-Z
 */
export declare function isAlphaNumeric(code: number): boolean;
/**
 * Check if given character code is simple letter of supported alphabets
 */
export declare function isMultiAlpha(code: number): boolean;
/**
 * All unicode character set alpha like
 */
export declare function isUnicodeAlpha(code: number): boolean;
export declare function isCommandName(ch: number): boolean;
/**
 * Если указанный код является символом a-z, конвертирует его в верхний регистр
 */
export declare function asciiToUpper(ch: number): number;
/**
 * Нормализация списка токенов: объединяет несколько смежных токенов в один, если
 * это возможно
 */
export declare function normalize(tokens: Token[]): Token[];
/**
 * Возвращает строковое содержимое указанных токенов
 */
export declare function getText(tokens: Token[]): string;
/**
 * Возвращает длину форматированного текста
 */
export declare function getLength(tokens: Token[]): number;
export declare const codePointAt: typeof nativeCodePointAt;
/**
 * Нативная реализация `String#codePointAt`
 */
declare function nativeCodePointAt(str: string, pos: number): number;
export {};
