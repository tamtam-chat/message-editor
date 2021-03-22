import { Token, TokenFormat } from '../parser';

/**
 * Объект для обновления формата формата
 */
export interface TokenFormatUpdate {
    /** Типы форматирования, которые надо добавить */
    add?: TokenFormat;
    /** Типы форматирования, которые надо удалить */
    remove?: TokenFormat;
}

export type TextRange = [pos: number, len: number];

export interface CutText {
    /** Вырезанный фрагмент текста */
    cut: Token[];

    /** Модифицированная строка без вырезанного текста */
    tokens: Token[];
}
