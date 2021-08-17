import type { ParserOptions, Token, TokenFormat } from '../parser';
import { mdToText, textToMd } from './markdown';
import type { TokenFormatUpdate, TextRange, CutText } from './types';
import { tokenForPos } from './utils';
export { mdToText, textToMd, tokenForPos, CutText, TokenFormatUpdate, TextRange };
/**
 * Вставляет указанный текст `text` в текстовую позицию `pos` списка токенов
 * @return Обновлённый список токенов
 */
export declare function insertText(tokens: Token[], pos: number, text: string, options: Partial<ParserOptions>): Token[];
/**
 * Заменяет текст указанной длины в текстовой позиции `pos` на новый `text`
 * @return Обновлённый список токенов
 */
export declare function replaceText(tokens: Token[], pos: number, len: number, text: string, options: Partial<ParserOptions>): Token[];
/**
 * Удаляет текст указанной длины из списка токенов в указанной позиции
 */
export declare function removeText(tokens: Token[], pos: number, len: number, options: Partial<ParserOptions>): Token[];
/**
 * Вырезает текст из диапазона `from:to` и возвращает его и изменённую строку
 */
export declare function cutText(tokens: Token[], from: number, to: number, options: Partial<ParserOptions>): CutText;
/**
 * Возвращает формат для указанной позиции в строке
 */
export declare function getFormat(tokens: Token[], pos: number): TokenFormat;
/**
 * Выставляет текстовый формат `format` для всех токенов из диапазона `pos, pos + len`.
 * Если `len` не указано, вставляет sticky-метку в указанную позицию `pos`
 * @param breakSolid Применять форматирование внутри «сплошных» токенов, то есть
 * можно один сплошной токен разделить на несколько и указать им разное форматирование
 */
export declare function setFormat(tokens: Token[], format: TokenFormatUpdate | TokenFormat, pos: number, len?: number, breakSolid?: boolean): Token[];
/**
 * Возвращает фрагмент строки форматирования
 */
export declare function slice(tokens: Token[], from: number, to?: number): Token[];
/**
 * Делает указанный диапазон ссылкой на `link`.
 */
export declare function setLink(tokens: Token[], link: string | null, pos: number, len?: number, sticky?: boolean): Token[];
/**
 * Вставляет указанный текст `text` в текстовую позицию `pos` списка токенов
 * @return Обновлённый список токенов
 */
export declare function mdInsertText(tokens: Token[], pos: number, text: string, options: Partial<ParserOptions>): Token[];
/**
 * Заменяет текст указанной длины в текстовой позиции `pos` на новый `text`
 * @return Обновлённый список токенов
 */
export declare function mdReplaceText(tokens: Token[], pos: number, len: number, text: string, options: Partial<ParserOptions>): Token[];
/**
 * Удаляет текст указанной длины из списка токенов в указанной позиции
 */
export declare function mdRemoveText(tokens: Token[], pos: number, len: number, options: Partial<ParserOptions>): Token[];
/**
 * Вырезает текст из диапазона `from:to` и возвращает его и изменённую строку
 */
export declare function mdCutText(tokens: Token[], from: number, to: number, options: Partial<ParserOptions>): CutText;
/**
 * Выставляет текстовый формат `format` для всех токенов из диапазона `pos, pos + len`.
 * Если `len` не указано, вставляет sticky-метку в указанную позицию `pos`
 * @param breakSolid Применять форматирование внутри «сплошных» токенов, то есть
 * можно один сплошной токен разделить на несколько и указать им разное форматирование
 */
export declare function mdSetFormat(tokens: Token[], format: TokenFormatUpdate | TokenFormat, pos: number, len: number, options: Partial<ParserOptions>): Token[];
/**
 * Применяет данные из `update` формату `format`: добавляет и/или удаляет указанные
 * типы форматирования.
 * Если в качестве `update` передали сам формат, то он и вернётся
 */
export declare function applyFormat(format: TokenFormat, update: TokenFormatUpdate | TokenFormat): TokenFormat;
