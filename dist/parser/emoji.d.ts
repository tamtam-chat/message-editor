import ParserState from './state';
/**
 * Вернёт `true`, если удалось прочитать эмоджи из текущей позиции потока
 */
export default function parseEmoji(state: ParserState): boolean;
/**
 * Вспомогательный консьюмер для всех эмоджи
 * @param state
 */
export declare function consumeEmoji(state: ParserState): boolean;
/**
 * Поглощает keycap-последовательность.
 * Особенностью keycap-последовательности является то, что она может начинаться
 * с базовых символов, например, цифр, которые после себя содержат специальные
 * коды, указывающие, что символ нужно показать как эмоджи
 */
export declare function keycap(state: ParserState): boolean;
