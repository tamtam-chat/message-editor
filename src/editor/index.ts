import parse, { getLength, TokenFormat, TokenType } from '../parser';
import type { Token } from '../parser';
import render, { dispatch, isEmoji } from '../render';
import type { BaseEditorOptions, TextRange, Model } from './types';
import History, { HistoryEntry } from './history';
import { getTextRange, rangeToLocation, setDOMRange, setRange } from './range';
import {
    applyAnimojiParams,
    cutText,
    getText,
    insertText,
    removeText,
    replaceText,
    setFormat,
    toggleFormat,
    updateFromInputEvent,
    updateFromInputEventFallback,
    updateFromOldEvent
} from './update';
import { setLink, slice, mdToText, textToMd, getFormat } from '../formatted-string';
import type { TokenFormatUpdate, TextRange as Rng } from '../formatted-string';
import Shortcuts from './shortcuts';
import type { ShortcutHandler } from './shortcuts';
import { getInputText, isCollapsed, isElement, startsWith } from './utils';
import parseHTML from '../parser/html2';
import toHTML from '../render/html';
import { last } from '../parser/utils';
import { objectMerge } from '../utils/objectMerge';
import type { EmojiParams } from '../parser/types';

const enum DiffActionType {
    Insert = 'insert',
    Remove = 'remove',
    Replace = 'replace',
    Compose = 'compose'
}

const enum DirtyState {
    None, Dirty, DirtyRetainNewline
}

export interface EditorOptions extends BaseEditorOptions {
    /** Значение по умолчанию для редактора */
    value?: string;
    shortcuts?: Record<string, ShortcutHandler<Editor>>;

    /** Парсить HTML при вставке */
    html?: boolean;

    /** Размечать ссылки при вставке HTML */
    htmlLinks?: boolean;

    scroller?: HTMLElement;
}

type EventName = 'editor-selectionchange' | 'editor-formatchange' | 'editor-update';

interface EditorEventDetails {
    editor: Editor;
}

export interface EditorEvent<T = EditorEventDetails> extends CustomEvent<T> {}

interface PickLinkOptions {
    /**
     * Функция, которая на вход принимает текущую ссылку, если она есть, и должна
     * вернуть новую ссылку или Promise, который вернёт ссылку
     */
    url: (currentUrl: string) => string | Promise<string>,

    /**
     * Диапазон, для которого нужно выставить ссылку. Если не указан,
     * берётся текущий диапазон
     */
    range?: TextRange;
}

/** MIME-тип для хранения отформатированной строки в буффере */
const fragmentMIME = 'tamtam/fragment';

const defaultPickLinkOptions: PickLinkOptions = {
    url: cur => prompt('Введите ссылку', cur)
};

export default class Editor {
    public shortcuts: Shortcuts<Editor>;
    public history: History<Model>;

    private _model: Model;
    /** Диапазон, который был на начало композиции */
    private compositionStartRange: TextRange | null = null;

    /** Диапазон, который был на начало композиции */
    private compositionRange: TextRange | null = null;

    private pendingModel: Model | null = null;
    private _inited = false;

    /** Редактор в «грязном» состоянии: требуется синхронизация модели и UI (> 0) */
    private dirty: DirtyState = DirtyState.None;

    /**
     * Текущая позиция каретки/выделения в редакторе. Должна быть источником
     * правды при работе с выделением
     */
    private caret: TextRange = [0, 0];
    private focused = false;
    private rafId = 0;

    /**
     * @param element Контейнер, в котором будет происходить редактирование
     */
    constructor(public element: HTMLElement, public options: EditorOptions = {}) {
        const value = options.value || '';
        this.model = parse(this.sanitizeText(value), options.parse);
        this.history = new History({
            compactActions: [DiffActionType.Insert, DiffActionType.Remove]
        });
        this.shortcuts = new Shortcuts(this);
        this.setup();
        // this.setSelection(value.length);
        this.history.push(this.model, 'init', this.caret);
        this._inited = true;
    }

    private onKeyDown = (evt: KeyboardEvent) => {
        if (!evt.defaultPrevented) {
            this.shortcuts.handle(evt);
        }

        this.handleEnter(evt);
    }

    private onCompositionStart = () => {
        this.compositionStartRange = getTextRange(this.element);
        this.compositionRange = null;
    }

    private onCompositionUpdate = () => {
        this.compositionRange = this.getCompositionRange();
    }

    private onCompositionEnd = () => {
        this.compositionStartRange = null;
    }

    private onBeforeInput = (evt: InputEvent) => {
        if (evt.inputType === 'historyUndo') {
            this.undo();
            evt.preventDefault();
            return;
        }

        if (evt.inputType === 'historyRedo') {
            this.redo();
            evt.preventDefault();
            return;
        }

        let range: TextRange;
        if (evt.getTargetRanges) {
            const ranges = evt.getTargetRanges();
            if (ranges.length) {
                range = rangeToLocation(this.element, ranges[0] as Range);
            }
        }

        if (!range) {
            range = getTextRange(this.element);
        }
        this.pendingModel = updateFromInputEvent(evt, this.model, range, this.options);
    }

    private onInput = (evt: InputEvent) => {
        let nextModel: Model;
        const range = getTextRange(this.element);

        if (this.pendingModel) {
            nextModel = this.pendingModel;
            // В мобильном Хроме, если находимся в режиме композиции, Enter два раза
            // вызовет событие `input`, причём, второе будет без `beforeinput`.
            // Поэтому не удаляем модель находясь в режиме композиции, пусть это
            // сделает обработчик `compositionend`
            if (!this.compositionStartRange) {
                this.pendingModel = null;
            }
        } else {
            const prevRange = this.compositionRange || this.caret;
            nextModel = evt.inputType
                ? updateFromInputEventFallback(evt, this.model, range, prevRange, this.options)
                : updateFromOldEvent(this.getInputText(), this.model, range, prevRange, this.options);
            this.compositionRange = null;
        }

        // Обычное изменение, сразу применяем результат к UI
        if (nextModel) {
            this.updateModel(nextModel, getDiffTypeFromEvent(evt), range);
        }
    }

    private onSelectionChange = () => {
        if (this.dirty !== DirtyState.None) {
            return;
        }

        const range = getTextRange(this.element);
        if (range) {
            this.saveSelection(range);
        }
    }

    /**
     * Обработка события копирования текста
     */
    private onCopy = (evt: ClipboardEvent) => {
        if (this.copyFragment(evt.clipboardData)) {
            evt.preventDefault();
        }
    }

    /**
     * Обработка события вырезания текста
     */
    private onCut = (evt: ClipboardEvent) => {
        if (this.copyFragment(evt.clipboardData, true)) {
            evt.preventDefault();
        }
    }

    /**
     * Обработка события вставки текста
     */
    private onPaste = (evt: ClipboardEvent) => {
        evt.preventDefault();

        if (isFilePaste(evt.clipboardData)) {
            return;
        }

        const range = getTextRange(this.element);
        const parsed = getFormattedString(evt.clipboardData, this.options);
        const fragment: string | Token[] = parsed
            || sanitize(evt.clipboardData.getData('text/plain') || '');

        if (fragment && range) {
            let len = 0;
            if (typeof fragment === 'string') {
                len = fragment.length
            } else {
                len = getLength(fragment);
                if (last(fragment)?.format) {
                    // У последнего токена есть форматирование: добавим sticky-токен,
                    // чтобы пользователь продолжал писать в том же формате, что и был
                    fragment.push({
                        type: TokenType.Text,
                        value: '',
                        format: getFormat(this.model, range[0]),
                        sticky: true
                    });
                }
            }

            this.paste(fragment, range[0], range[1]);
            this.setSelection(range[0] + len);

            requestAnimationFrame(() => retainNewlineInViewport(this.getScroller()));
        }
    }

    private onClick = (evt: MouseEvent) => {
        if (isEmoji(evt.target as Node)) {
            // Кликнули на эмоджи, будем позиционировать каретку относительно
            // него
            const elem = evt.target as HTMLElement;
            const rect = elem.getBoundingClientRect();
            const center = rect.left + rect.width * 0.6;
            const range = document.createRange();
            if (evt.clientX < center) {
                range.setStartBefore(elem);
                range.setEndBefore(elem);
            } else {
                range.setStartAfter(elem);
                range.setEndAfter(elem);
            }

            setDOMRange(range);
        }
    }

    private onFocus = () => {
        this.focused = true;
        document.addEventListener('selectionchange', this.onSelectionChange);
    }

    private onBlur = () => {
        this.focused = false;
        document.removeEventListener('selectionchange', this.onSelectionChange);
    }

    get model(): Model {
        return this._model;
    }

    set model(value: Model) {
        if (this._model !== value) {
            this._model = value;
            if (this.dirty === DirtyState.None) {
                this.dirty = DirtyState.Dirty;
            }
            // Изменения применяем не сразу, а на конец таска, так как
            // в некоторых случаях (нативная панель эмоджи в Windows) в одном
            // таске может быть несколько input-событий, которые зависят от текущего
            // (промежуточного) состояния поля ввода
            this.scheduleSyncUI();
        }
    }

    /**
     * Вернёт `true` если редактор работает в режиме Markdown
     */
    get isMarkdown(): boolean {
        return !!(this.options.parse?.markdown);
    }

    /**
     * Настраивает редактор для работы. Вынесено в отдельный метод для удобного
     * переопределения
     */
    setup(): void {
        const { element } = this;

        element.contentEditable = 'true';
        element.translate = false;

        // Чек-лист для проверки ввода
        // * Пишем текст в позицию
        // * Выделяем текст и начинаем писать новый
        // * Удаление в пустой строке (Backspace)
        // * Долго зажимаем зажимаем клавишу (е → ё)
        // * Автозамена при написании текста (Safari)
        // * Пишем текст в китайской раскладке
        // * Автоподстановка слов (iOS, Android)
        // * Punto Switcher
        // * Изменение форматирования из тачбара на Маке
        // * Замена правописания
        // * Вставка преревода строки: Enter/Shift-Enter/Alt-Enter
        // * Баг в Хроме: ставим курсор в конец строки, Cmd+← переходим в начало,
        //   пишем букву, стираем следующую по Fn+Backspace. Хром посылает команду
        //   insertText: null, а не beforeinput: deleteContentForward
        // * В Windows при использорвании нативной панели с эмоджи, само эмоджи
        //   вставляется через два события input: insertCompositionText и insertText
        element.addEventListener('keydown', this.onKeyDown);
        element.addEventListener('compositionstart', this.onCompositionStart);
        element.addEventListener('compositionupdate', this.onCompositionUpdate);
        element.addEventListener('compositionend', this.onCompositionEnd);
        element.addEventListener('beforeinput', this.onBeforeInput);
        element.addEventListener('input', this.onInput);
        element.addEventListener('cut', this.onCut);
        element.addEventListener('copy', this.onCopy);
        element.addEventListener('paste', this.onPaste);
        element.addEventListener('click', this.onClick);
        element.addEventListener('focus', this.onFocus);
        element.addEventListener('blur', this.onBlur);

        const { shortcuts } = this.options;

        if (shortcuts) {
            this.shortcuts.registerAll(shortcuts);
        }
    }

    /**
     * Вызывается для того, чтобы удалить все связи редактора с DOM.
     */
    dispose(): void {
        const { element } = this;

        element.removeEventListener('keydown', this.onKeyDown);
        element.removeEventListener('compositionstart', this.onCompositionStart);
        element.removeEventListener('compositionupdate', this.onCompositionUpdate);
        element.removeEventListener('compositionend', this.onCompositionEnd);
        element.removeEventListener('beforeinput', this.onBeforeInput);
        element.removeEventListener('input', this.onInput);
        element.removeEventListener('cut', this.onCut);
        element.removeEventListener('copy', this.onCopy);
        element.removeEventListener('paste', this.onPaste);
        element.removeEventListener('click', this.onClick);
        element.removeEventListener('focus', this.onFocus);
        element.removeEventListener('blur', this.onBlur);
        document.removeEventListener('selectionchange', this.onSelectionChange);
    }

    /////////// Публичные методы для работы с текстом ///////////

    /**
     * Вставляет текст в указанную позицию
     */
    insertText(pos: number, text: string): Model {
        text = this.sanitizeText(text);
        const result = this.updateModel(
            insertText(this.model, pos, text, this.options),
            DiffActionType.Insert,
            [pos, pos + text.length]
        );
        return result;
    }

    /**
     * Удаляет указанный диапазон текста
     */
    removeText(from: number, to: number): Model {
        const result = this.updateModel(
            removeText(this.model, from, to, this.options),
            DiffActionType.Remove,
            [from, to]);

        return result;
    }

    /**
     * Заменяет текст в указанном диапазоне `from:to` на новый
     */
    replaceText(from: number, to: number, text: string): Model {
        const result = this.paste(text, from, to);
        return result;
    }

    /**
     * Заменяет текст в указанном диапазоне `from:to` на один эмоджи, и записывает ему указанные параметры
     * Если передать более одного эмоджи, указанные параметры будут записаны всем переданным эмоджи
     */
    replaceOnEmoji(from: number, to: number, emoji: string, params?: EmojiParams): Model {
        emoji = this.sanitizeText(emoji);
        let nextModel = replaceText(this.model, emoji, from, to, this.options);

        // устанавливаем параметры анимоджи в диапазоне куда мы добавили эмоджи
        nextModel = applyAnimojiParams(nextModel, from, from + emoji.length, params);

        const pos = from + emoji.length;
        return this.updateModel(nextModel, DiffActionType.Insert, [pos, pos]);
    }

    /**
     * Вырезает фрагмент по указанному диапазону из модели и возвращает его
     * @returns Вырезанный фрагмент модели
     */
    cut(from: number, to: number): Model {
        const result = cutText(this.model, from, to, this.options);
        this.updateModel(result.tokens, 'cut', [from, to]);
        return result.cut;
    }

    /**
     * Вставка текста в указанную позицию
     */
    paste(text: string | Model, from: number, to: number): Model {
        text = this.sanitizeText(text);
        const nextModel = replaceText(this.model, text, from, to, this.options);
        const len = typeof text === 'string' ? text.length : getLength(text);
        const pos = from + len;
        return this.updateModel(nextModel, 'paste', [pos, pos]);
    }

    /**
     * Ставит фокус в редактор
     */
    focus(): void {
        const [from, to] = this.caret;
        this.element.focus();
        setRange(this.element, from, to);
    }

    /**
     * Обновляет форматирование у указанного диапазона
     */
    updateFormat(format: TokenFormat | TokenFormatUpdate, from: number, to = from): Model {
        const result = this.updateModel(
            setFormat(this.model, format, from, to, this.options),
            'format',
            [from, to]
        );
        setRange(this.element, from, to);
        this.emit('editor-formatchange');
        return result;
    }

    /**
     * Переключает указанный формат у заданного диапазона текста
     */
    toggleFormat(format: TokenFormat, from?: number, to?: number): Model {
        if (from == null) {
            const range = this.getSelection();
            from = range[0];
            to = range[1];
        } else if (to == null) {
            to = from;
        }

        const model = toggleFormat(this.model, format, from, to, this.options);
        const result = this.updateModel(
            model,
            'format',
            [from, to]
        );

        setRange(this.element, from, to);
        this.emit('editor-formatchange');
        return result;
    }

    /**
     * Выбрать ссылку для указанного диапазона
     * @param callback Функция, которая на вход примет текущую ссылку в указанном
     * диапазоне (если она есть), и должна вернуть новую ссылку. Если надо убрать
     * ссылку, функция должна вернуть пустую строку
     */
    pickLink(options: PickLinkOptions = defaultPickLinkOptions): void {
        const [from, to] = options.range || this.getSelection();
        let token = this.tokenForPos(from);
        let currentUrl = '';

        if (token) {
            if (token.format & TokenFormat.LinkLabel) {
                // Это подпись к ссылке в MD-формате. Найдём саму ссылку
                let ix = this.model.indexOf(token) + 1;
                while (ix < this.model.length) {
                    token = this.model[ix++];
                    if (token.type === TokenType.Link) {
                        break;
                    }
                }
            }

            if (token.type === TokenType.Link) {
                currentUrl = token.link;
            }
        }

        const result = options.url(currentUrl);
        if (result && typeof result === 'object' && result.then) {
            result.then(nextUrl => {
                if (nextUrl !== currentUrl) {
                    this.setLink(nextUrl, from, to);
                }
            });
        } else if (result !== currentUrl) {
            this.setLink(result as string, from, to);
        }
    }

    /**
     * Ставит ссылку на `url` на указанный диапазон.
     * @param url Ссылка. Если `url` пустой или равен `null`, удаляет ссылку с указанного диапазона.
     * @param from Начало диапазона.
     * @param to Конец диапазона.
     */
    setLink(url: string | null, from: number, to = from): Model {
        if (url) {
            url = url.trim();
        }

        let updated: Model;
        const range: Rng = [from, to - from];
        if (this.isMarkdown) {
            const text = mdToText(this.model, range);
            const next = setLink(text, url, range[0], range[1]);
            updated = parse(textToMd(next, range), this.options.parse);
        } else {
            updated = setLink(this.model, url, range[0], range[1]);
        }

        return this.updateModel(updated, 'link');
    }

    /**
     * Отменить последнее действие
     */
    undo(): HistoryEntry<Model> | undefined {
        if (this.history.canUndo) {
            const entry = this.history.undo();
            this.updateModel(entry.state, false);
            const { current } = this.history;
            if (current) {
                const range = current.caret || current.range;
                if (range) {
                    this.setSelection(range[0], range[1]);
                }
            }
            return entry;
        }
    }

    /**
     * Повторить последнее отменённое действие
     */
    redo(): HistoryEntry<Model> | undefined {
        if (this.history.canRedo) {
            const entry = this.history.redo();
            this.updateModel(entry.state, false);
            const range = entry.caret || entry.range;
            if (range) {
                this.setSelection(range[0], range[1]);
            }
            return entry;
        }
    }

    /**
     * Возвращает фрагмент модели для указанного диапазона
     */
    slice(from: number, to?: number): Token[] {
        return slice(this.model, from, to);
    }

    /**
     * Возвращает токен для указанной позиции
     * @param tail В случае, если позиция `pos` указывает на границу токенов,
     * при `tail: true` вернётся токен слева от границы, иначе справа
     */
    tokenForPos(pos: number, tail?: boolean): Token | undefined {
        let offset = 0;
        let len = 0;
        const { model } = this;
        for (let i = 0, token: Token; i < model.length; i++) {
            token = model[i];
            len = offset + token.value.length;
            if (pos >= offset && (tail ? pos <= len : pos < len)) {
                return token;
            }
            offset += token.value.length;
        }

        if (offset === pos) {
            // Указали самый конец строки — вернём последний токен
            return model[model.length - 1];
        }
    }

    /**
     * Возвращает текущее выделение в виде текстового диапазона
     */
    getSelection(): TextRange {
        return this.caret;
    }

    /**
     * Указывает текущее выделение текста или позицию каретки
     * @param noFocus Не ставить фокус в поле ввода (полезно для мобилок)
     */
    setSelection(from: number, to = from): void {
        [from, to] = this.normalizeRange([from, to]);
        this.saveSelection([from, to]);
        if (!this.dirty) {
            setRange(this.element, from, to);
        }
    }

    /**
     * Заменяет текущее значение редактора на указанное. При этом полностью
     * очищается история изменений редактора
     */
    setValue(value: string | Model, selection?: TextRange): void {
        if (typeof value === 'string') {
            value = parse(this.sanitizeText(value), this.options.parse);
        }

        if (!selection) {
            const len = getText(value).length;
            selection = [len, len];
        }

        this.saveSelection(selection);
        this.model = value;

        this.history.clear();
        this.history.push(this.model, 'init', this.caret);
    }

    /**
     * То же самое, что `setValue`, но без отправки событий об изменении контента
     */
    replaceValue(value: string | Model, selection?: TextRange): void {
        this._inited = false;
        this.setValue(value, selection);
        this._inited = true;
    }

    /**
     * Возвращает текущее текстовое значение модели редактора
     */
    getText(tokens = this.model): string {
        return getText(tokens);
    }

    /**
     * Обновляет опции редактора
     */
    setOptions(options: Partial<EditorOptions>): void {
        let markdownUpdated = false;
        if (options.shortcuts) {
            this.shortcuts.unregisterAll();
            this.shortcuts.registerAll(options.shortcuts);
        }

        if (options.parse) {
            const markdown = !!this.options.parse?.markdown;
            markdownUpdated = options.parse.markdown !== markdown;
        }

        this.options = objectMerge(this.options, options);

        if (markdownUpdated) {
            const sel = this.getSelection();
            const range: Rng = [sel[0], sel[1] - sel[0]];
            const tokens = this.options.parse?.markdown
                ? textToMd(this.model, range)
                : mdToText(this.model, range);

            this.setValue(tokens, [range[0], range[0] + range[1]]);
        } else {
            this.render();
        }
    }

    /**
     * Возвращает строковое содержимое поля ввода
     */
    getInputText(): string {
        return getInputText(this.element);
    }

    /**
     * Подписываемся на указанное событие
     */
    on(eventType: EventName, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): this {
        this.element.addEventListener(eventType, listener, options);
        return this;
    }

    /**
     * Отписываемся от указанного события
     */
    off(eventType: EventName, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): this {
        this.element.removeEventListener(eventType, listener, options);
        return this;
    }

    /**
     * Сохраняет указанный диапазон в текущей записи истории в качестве последнего
     * известного выделения
     */
    private saveSelection(range: TextRange): void {
        const { caret } = this;
        this.caret = range;
        this.history.saveCaret(range);
        if (caret[0] !== range[0] || caret[1] !== range[1]) {
            this.emit('editor-selectionchange');
        }
    }

    /**
     * Обновляет значение модели редактора с добавлением записи в историю изменений
     * @param value Новое значение модели
     * @param action Название действия, которое привело к изменению истории, или
     * `false`, если не надо добавлять действие в историю
     * @param range Диапазон выделения, который нужно сохранить в качестве текущего
     * в записи в истории
     */
    private updateModel(value: Model, action?: string | false, range?: TextRange): Model {
        if (value !== this.model) {
            if (typeof action === 'string') {
                this.history.push(value, action, range);
            }
            this.model = value;
        }

        if (range) {
            this.saveSelection(range);
        }

        return this.model;
    }

    /**
     * Правильно помещает фрагмент текста в буффер. Вместе с обычным текстом
     * туда помещается сериализованный фрагмент модели, чтобы сохранить форматирование
     */
    private copyFragment(clipboard: DataTransfer, cut?: boolean): boolean {
        const range = getTextRange(this.element);

        if (range && !isCollapsed(range)) {
            const fragment = cut
                ? this.cut(range[0], range[1])
                : this.slice(range[0], range[1]);

            clipboard.setData('text/plain', getText(fragment));
            clipboard.setData('text/html', toHTML(fragment));

            if (!this.isMarkdown) {
                clipboard.setData(fragmentMIME, JSON.stringify(fragment));
            }

            if (cut) {
                this.setSelection(range[0]);
            }

            return true;
        }

        return false;
    }

    /**
     * Синхронизация модели данных редактора с UI.
     * Метод нужно вызывать только в том случае, если есть какие-то изменения
     */
    private syncUI() {
        this.render();
        if (this.focused) {
            const [from, to] = this.caret;
            setRange(this.element, from, to);
        }

        if (this.dirty === DirtyState.DirtyRetainNewline) {
            retainNewlineInViewport(this.getScroller());
        }

        this.dirty = DirtyState.None;
        this.emit('editor-update');
    }

    private scheduleSyncUI() {
        if (!this.rafId) {
            this.rafId = requestAnimationFrame(() => {
                this.rafId = 0;
                if (this.dirty !== DirtyState.None) {
                    this.syncUI();
                }
            });
        }
    }

    private render(): void {
        render(this.element, this.model, {
            fixTrailingLine: true,
            replaceTextEmoji: !!this.options.parse?.textEmoji,
            emoji: this.options.emoji,
            nowrap: this.options.nowrap
        });
    }

    private emit(eventName: EventName): void {
        if (this._inited) {
            dispatch<EditorEventDetails>(this.element, eventName, { editor: this });
        }
    }

    private normalizeRange([from, to]: TextRange): TextRange {
        const maxIx = getLength(this.model);
        return [clamp(from, 0, maxIx), clamp(to, 0, maxIx)];
    }

    private handleEnter(evt: KeyboardEvent): void {
        if (!evt.defaultPrevented && evt.key === 'Enter' && hasModifier(evt)) {
            evt.preventDefault();
            const range = getTextRange(this.element);
            const text = '\n';
            if (isCollapsed(range)) {
                this.insertText(range[0], text);
            } else {
                this.replaceText(range[0], range[1], text);
            }

            this.setSelection(range[0]+ text.length);
            this.dirty = DirtyState.DirtyRetainNewline;
        }
    }

    /**
     * При необходимости удаляет из текста ненужные данные, исходя из текущих настроек
     */
    private sanitizeText<T extends string | Model>(text: T): T {
        const { nowrap } = this.options;

        return typeof text === 'string'
            ? sanitize(text, nowrap) as T
            : text.map(t => objectMerge(t, { value: sanitize(t.value, nowrap) })) as T;
    }

    private getCompositionRange(): TextRange {
        const range = getTextRange(this.element);
        if (this.compositionStartRange) {
            range[0] = Math.min(this.compositionStartRange[0], range[0]);
        }

        return range;
    }

    private getScroller(): HTMLElement {
        return this.options.scroller || this.element;
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Вспомогательная функция, которая при необходимости подкручивает вьюпорт
 * к текущему переводу строки
 */
function retainNewlineInViewport(element: Element): void {
    const sel = window.getSelection();
    const r = sel.getRangeAt(0);

    if (!r?.collapsed) {
        return;
    }

    let rect = r.getClientRects().item(0);
    if ((!rect || !rect.height) && isElement(r.startContainer)) {
        const target = getScrollTarget(r);
        if (target) {
            rect = target.getBoundingClientRect();
        }
    }

    if (rect && rect.height > 0) {
        // Есть прямоугольник, к которому можем прицепиться: проверим, что он видим
        // внутри элемента и если нет, подскроллимся к нему
        const parentRect = element.getBoundingClientRect();
        if (rect.top < parentRect.top || rect.bottom > parentRect.bottom) {
            // Курсор за пределами вьюпорта
            element.scrollTop += rect.top - (parentRect.top + parentRect.height / 2);
        }
    }
}

/**
 * Вернёт элемент, к которому нужно подскроллится.
 */
function getScrollTarget(r: Range): Element | undefined {
    const target = r.startContainer.childNodes[r.startOffset];
    return target && isElement(target) ? target : r.startContainer as Element;
}

function getFormattedString(data: DataTransfer, options: EditorOptions): Token[] | undefined {
    const internalData = data.getData(fragmentMIME);

    if (internalData) {
        return typeof internalData === 'string'
            ? JSON.parse(internalData) as Token[]
            : internalData
    }

    if (options.html) {
        // Обработка пограничного случая: MS Edge при копировании из адресной строки
        // добавляет ещё и HTML. В итоге просто так вставить ссылку не получится.
        // Поэтому мы сначала проверим plain text: если это ссылка, то оставим её
        // как есть, без парсинга HTML.
        const plain = parse(sanitize(data.getData('text/plain') || ''), options.parse);
        if (plain.length === 1 && plain[0].type === TokenType.Link) {
            return plain;
        }

        const html = data.getData('text/html');
        if (html) {
            return parseHTML(sanitize(html), { links: options.htmlLinks });
        }
    }
}

function getDiffTypeFromEvent(evt: InputEvent): DiffActionType | string {
    const { inputType } = evt;
    if (inputType) {
        if (startsWith(inputType, 'insert')) {
            return DiffActionType.Insert;
        }

        if (startsWith(inputType, 'delete')) {
            return DiffActionType.Remove;
        }

        if (startsWith(inputType, 'format')) {
            return 'format';
        }
    }

    return 'update';
}

function sanitize(text: string, nowrap?: boolean): string {
    // eslint-disable-next-line no-control-regex
    text = text.replace(/\x00/g, ' ');
    return nowrap
        ? text.replace(/(\r\n?|\n)/g, ' ')
        : text.replace(/\r\n?/g, '\n');
}

function isFilePaste(data: DataTransfer) {
    if (data.types.includes('Files')) {
        // Есть файл в клипборде: это может быть как непосредственно файл,
        // так и скриншот текста из ворда, например. При этом, даже если это
        // именно файл, рядом может лежать текст, в котором может быть написано
        // имя файла или путь к нему. То есть мы не можем однозначно ответить,
        // вставляется файл или текст.
        // Поэтому сделаем небольшой трюк: посчитаем количество текстовых и файловых
        // элементов в буффере, если больше текстовых, значит, хотим вставить текст
        let files = 0;
        let texts = 0;
        for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            if (item.kind === 'string') {
                texts++;
            } else if (item.kind === 'file') {
                files++;
            }
        }

        return files >= texts;
    }

    return false;
}

function hasModifier(evt: KeyboardEvent) {
    return evt.altKey || evt.ctrlKey || evt.shiftKey || evt.metaKey;
}
