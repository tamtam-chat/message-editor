import { Token } from '../parser';
declare global {
    interface Element {
        $$emoji?: boolean;
    }
}
export declare type EmojiRender = (emoji: string | null, elem?: Element) => Element | void;
export interface RenderOptions {
    /**
     * Функция для отрисовки эмоджи
     * @param emoji Эмоджи, который нужно нарисовать. Если указано `null`, значит,
     * элемент с эмоджи сейчас удаляется и нужно подчистить ресурсы для него
     * @param elem Существующий элемент, в котором нужно обновить эмоджи. Если не
     * указан, его нужно создать
     */
    emoji?: EmojiRender;
    /**
     * Обработчик ссылок: принимает токен ссылки и должен вернуть значение для
     * атрибута `href`. На вход может быть несколько типов токенов: Link, Hashtag
     */
    link: (token: Token) => string;
    /**
     * Нужно ли исправлять завершающий перевод строки.
     * Используется для режима редактирования, когда для отображения
     * последнего перевода строки нужно добавить ещё один
     */
    fixTrailingLine: boolean;
    /** Заменять текстовые смайлы на эмоджи */
    replaceTextEmoji: boolean;
    /** Заменяем все пробелы и переводы строк на неразрывный пробел */
    nowrap?: boolean;
}
export default function render(elem: HTMLElement, tokens: Token[], opt?: Partial<RenderOptions>): void;
export declare function isEmoji(elem: Node): elem is Element;
export declare function dispatch<T = unknown>(elem: Element, eventName: string, detail?: T): void;
