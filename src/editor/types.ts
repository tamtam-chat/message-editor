import { ParserOptions } from '../parser';
import type { EmojiRender } from '../render';

export type TextRange = [from: number, to: number];

export interface BaseEditorOptions {
    /** Параметры для парсера текста */
    parse?: Partial<ParserOptions>;

    /** Сбрасывать форматирование при вставке новой строки */
    resetFormatOnNewline?: boolean;

    /** Заменять все пробельные символы на неразрывные пробелы */
    nowrap?: boolean;

    /** Функция для отрисовки эмоджи */
    emoji?: EmojiRender;
}
