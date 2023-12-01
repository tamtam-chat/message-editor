import type { Token, TokenFormat } from '../parser';
import type { EmojiData } from '../parser/types';

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

export interface EmojiUpdatePayload {
	/** Позиция эмоджи относительно всей строки */
	pos: number;
	/** Данные, которые нужно добавить. Если `null` — удалить данные */
	data: EmojiData | null;
	/**
	 * Эмоджи-подсказка. Если указано, то сначала проверим, что эмоджи в модели
	 * совпадает с переданным. Если не совпадает — ничего не меняем
	 */
	hint?: string;
}
