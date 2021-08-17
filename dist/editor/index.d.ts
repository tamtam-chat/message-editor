import { ParserOptions, Token, TokenFormat } from '../parser';
import { EmojiRender } from '../render';
import { TextRange } from './types';
import History, { HistoryEntry } from './history';
import { TokenFormatUpdate } from '../formatted-string';
import Shortcuts, { ShortcutHandler } from './shortcuts';
export interface EditorOptions {
    /** Значение по умолчанию для редактора */
    value?: string;
    /** Параметры для парсера текста */
    parse?: Partial<ParserOptions>;
    shortcuts?: Record<string, ShortcutHandler<Editor>>;
    /** Сбрасывать форматирование при вставке новой строки */
    resetFormatOnNewline?: boolean;
    /** Заменять все пробельные символы на неразрывные пробелы */
    nowrap?: boolean;
    /** Функция для отрисовки эмоджи */
    emoji?: EmojiRender;
}
declare type Model = Token[];
declare type EventName = 'editor-selectionchange' | 'editor-formatchange' | 'editor-update';
interface EditorEventDetails {
    editor: Editor;
}
export interface EditorEvent<T = EditorEventDetails> extends CustomEvent<T> {
}
interface PickLinkOptions {
    /**
     * Функция, которая на вход принимает текущую ссылку, если она есть, и должна
     * вернуть новую ссылку или Promise, который вернёт ссылку
     */
    url: (currentUrl: string) => string | Promise<string>;
    /**
     * Диапазон, для которого нужно выставить ссылку. Если не указан,
     * берётся текущий диапазон
     */
    range?: TextRange;
}
export default class Editor {
    element: HTMLElement;
    options: EditorOptions;
    shortcuts: Shortcuts<Editor>;
    history: History<Model>;
    private _model;
    private _inited;
    private caret;
    private focused;
    private expectEnter;
    private inputState;
    /**
     * @param element Контейнер, в котором будет происходить редактирование
     */
    constructor(element: HTMLElement, options?: EditorOptions);
    private onKeyDown;
    private onCompositionStart;
    private onCompositionEnd;
    private onBeforeInput;
    private onInput;
    private onSelectionChange;
    /**
     * Обработка события копирования текста
     */
    private onCopy;
    /**
     * Обработка события вырезания текста
     */
    private onCut;
    /**
     * Обработка события вставки текста
     */
    private onPaste;
    private onClick;
    private onFocus;
    private onBlur;
    get model(): Model;
    set model(value: Model);
    /**
     * Вернёт `true` если редактор работает в режиме Markdown
     */
    get isMarkdown(): boolean;
    /**
     * Настраивает редактор для работы. Вынесено в отдельный метод для удобного
     * переопределения
     */
    setup(): void;
    /**
     * Вызывается для того, чтобы удалить все связи редактора с DOM.
     */
    dispose(): void;
    /**
     * Вставляет текст в указанную позицию
     */
    insertText(pos: number, text: string): Model;
    /**
     * Удаляет указанный диапазон текста
     */
    removeText(from: number, to: number): Model;
    /**
     * Заменяет текст в указанном диапазоне `from:to` на новый
     */
    replaceText(from: number, to: number, text: string): Model;
    /**
     * Вырезает фрагмент по указанному диапазону из модели и возвращает его
     * @returns Вырезанный фрагмент модели
     */
    cut(from: number, to: number): Model;
    /**
     * Вставка текста в указанную позицию
     */
    paste(text: string | Model, from: number, to: number): Model;
    /**
     * Ставит фокус в редактор
     */
    focus(): void;
    /**
     * Обновляет форматирование у указанного диапазона
     */
    updateFormat(format: TokenFormat | TokenFormatUpdate, from: number, to?: number): Model;
    /**
     * Переключает указанный формат у заданного диапазона текста
     */
    toggleFormat(format: TokenFormat, from?: number, to?: number): Model;
    /**
     * Выбрать ссылку для указанного диапазона
     * @param callback Функция, которая на вход примет текущую ссылку в указанном
     * диапазоне (если она есть), и должна вернуть новую ссылку. Если надо убрать
     * ссылку, функция должна вернуть пустую строку
     */
    pickLink(options?: PickLinkOptions): void;
    /**
     * Ставит ссылку на `url` на указанный диапазон. Если `url` пустой или равен
     * `null`, удаляет ссылку с указанного диапазона
     */
    setLink(url: string | null, from: number, to?: number): Model;
    /**
     * Отменить последнее действие
     */
    undo(): HistoryEntry<Model> | undefined;
    /**
     * Повторить последнее отменённое действие
     */
    redo(): HistoryEntry<Model> | undefined;
    /**
     * Возвращает фрагмент модели для указанного диапазона
     */
    slice(from: number, to?: number): Token[];
    /**
     * Возвращает токен для указанной позиции
     * @param tail В случае, если позиция `pos` указывает на границу токенов,
     * при `tail: true` вернётся токен слева от границы, иначе справа
     */
    tokenForPos(pos: number, tail?: boolean): Token | undefined;
    /**
     * Возвращает текущее выделение в виде текстового диапазона
     */
    getSelection(): TextRange;
    /**
     * Указывает текущее выделение текста или позицию каретки
     */
    setSelection(from: number, to?: number): void;
    /**
     * Заменяет текущее значение редактора на указанное. При этом полностью
     * очищается история изменений редактора
     */
    setValue(value: string | Model, selection?: TextRange): void;
    /**
     * Возвращает текущее текстовое значение модели редактора
     */
    getText(tokens?: Model): string;
    /**
     * Обновляет опции редактора
     */
    setOptions(options: Partial<EditorOptions>): void;
    /**
     * Возвращает строковое содержимое поля ввода
     */
    getInputText(): string;
    /**
     * Подписываемся на указанное событие
     */
    on(eventType: EventName, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): this;
    /**
     * Отписываемся от указанного события
     */
    off(eventType: EventName, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): this;
    /**
     * Сохраняет указанный диапазон в текущей записи истории в качестве последнего
     * известного выделения
     */
    private saveSelection;
    /**
     * Обновляет значение модели редактора с добавлением записи в историю изменений
     * @param value Новое значение модели
     * @param action Название действия, которое привело к изменению истории, или
     * `false`, если не надо добавлять действие в историю
     * @param range Диапазон выделения, который нужно сохранить в качестве текущего
     * в записи в истории
     */
    private updateModel;
    /**
     * Правильно помещает фрагмент текста в буффер. Вместе с обычным текстом
     * туда помещается сериализованный фрагмент модели, чтобы сохранить форматирование
     */
    private copyFragment;
    /**
     * Применяет новый формат к указанному диапазону и возвращает новый набор токенов
     */
    private setFormat;
    private render;
    private emit;
    private normalizeRange;
    private waitExpectedEnter;
    private insertOrReplaceText;
    private handleBeforeInput;
    private handleInput;
}
/**
 * Парсинг HTML-содержимого буффера обмена в обычный текст.
 * Используется для некоторых редких кейсов в Safari.
 * Например, есть сайт https://emojifinder.com, в котором результаты поиска
 * по эмоджи выводится как набор `<input>` элементов.
 * Если копировать такой результат, то Chrome правильно сделает plain-text представление
 * результата, а Safari — нет. В итоге в Safari мы получим пустой текст, а вставленный
 * HTML неправильно обработается и уронит вкладку. В этом методе мы попробуем
 * достать текст из такого HTML-представления
 */
export declare function htmlToText(html: string): string;
export {};
