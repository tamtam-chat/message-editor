import parse, { getLength, ParserOptions, Token, TokenFormat, TokenType } from '../parser';
import render, { dispatch, isEmoji, EmojiRender } from '../render';
import { TextRange } from './types';
import History, { HistoryEntry } from './history';
import { getTextRange, rangeToLocation, setDOMRange, setRange } from './range';
import { DiffActionType } from './diff';
import {
    insertText, removeText, replaceText, cutText, setFormat, setLink, slice,
    mdInsertText, mdRemoveText, mdReplaceText, mdCutText, mdToText, textToMd,
    TokenFormatUpdate, TextRange as Rng } from '../formatted-string';
import { isCustomLink, tokenForPos, LocationType } from '../formatted-string/utils';
import Shortcuts, { ShortcutHandler } from './shortcuts';
import { createWalker, getRawValue, isElement, isText } from './utils';

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

type Model = Token[];
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

interface InputState {
    /**
     * Флаг, указывающий, что сейчас работает композиция.
     * NB свойство evt.isComposing не поддерживается в Safari
     */
    composing: boolean;
    range: TextRange;
    text: string;
}

/** MIME-тип для хранения отформатированной строки в буффере */
const fragmentMIME = 'tamtam/fragment';

const defaultPickLinkOptions: PickLinkOptions = {
    url: cur => prompt('Введите ссылку', cur)
};

const skipInputTypes = new Set<string>([
    'insertOrderedList',
    'insertUnorderedList',
    'deleteOrderedList',
    'deleteUnorderedList'
]);

export default class Editor {
    public shortcuts: Shortcuts<Editor>;
    public history: History<Model>;

    private _model: Model;
    private _inited = false;
    private caret: TextRange = [0, 0];
    private focused = false;
    private expectEnter = false;
    private inputState: InputState | null = null;
    private pendingRenderId: number;

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
        this.waitExpectedEnter(evt);
    }

    private onCompositionStart = () => {
        this.expectEnter = false;
        this.handleBeforeInput(true);
    }

    private onCompositionEnd = (evt: CompositionEvent) => {
        this.handleInput(evt.data);
    }

    private onBeforeInput = (evt: InputEvent) => {
        if (!this.inputState?.composing && !this.handleInputFromEvent(evt)) {
            this.handleBeforeInput();
        }
    }

    private onInput = (evt: InputEvent) => {
        this.expectEnter = false;

        if (!this.inputState?.composing) {
            this.handleInput(getInputEventText(evt));
        }
    }

    private onSelectionChange = () => {
        if (!this.pendingRenderId) {
            const range = getTextRange(this.element);
            if (range) {
                this.saveSelection(range);
            }
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
        const range = getTextRange(this.element);
        let fragment: string | Token[] = evt.clipboardData.getData(fragmentMIME);

        if (fragment) {
            fragment = JSON.parse(fragment) as Token[];
        } else if (evt.clipboardData.types.includes('Files')) {
            // TODO обработать вставку файлов
        } else {
            fragment = evt.clipboardData.getData('text/plain');

            if (!fragment) {
                const html = evt.clipboardData.getData('text/html');
                if (html) {
                    fragment = htmlToText(html);
                }
            }
        }

        if (fragment && range) {
            evt.stopPropagation();
            evt.preventDefault();

            const len = typeof fragment === 'string'
                ? fragment.length : getLength(fragment);
            this.paste(fragment, range[0], range[1]);
            this.setSelection(range[0] + len);

            requestAnimationFrame(() => retainNewlineInViewport(this.element));
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
            this.render();
            this.emit('editor-update');
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

        element.addEventListener('keydown', this.onKeyDown);
        element.addEventListener('compositionstart', this.onCompositionStart);
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
        this.element.removeEventListener('keydown', this.onKeyDown);
        this.element.removeEventListener('compositionstart', this.onCompositionStart);
        this.element.removeEventListener('compositionend', this.onCompositionEnd);
        this.element.removeEventListener('beforeinput', this.onBeforeInput);
        this.element.removeEventListener('input', this.onInput);
        this.element.removeEventListener('cut', this.onCut);
        this.element.removeEventListener('copy', this.onCopy);
        this.element.removeEventListener('paste', this.onPaste);
        this.element.removeEventListener('click', this.onClick);
        this.element.removeEventListener('focus', this.onFocus);
        this.element.removeEventListener('blur', this.onBlur);
        document.removeEventListener('selectionchange', this.onSelectionChange);
    }

    /////////// Публичные методы для работы с текстом ///////////

    /**
     * Вставляет текст в указанную позицию
     */
    insertText(pos: number, text: string): Model {
        text = this.sanitizeText(text);
        let updated = this.isMarkdown
            ? mdInsertText(this.model, pos, text, this.options.parse)
            : insertText(this.model, pos, text, this.options.parse);

        if (this.options.resetFormatOnNewline && !this.isMarkdown && /^[\n\r]+$/.test(text)) {
            updated = setFormat(updated, TokenFormat.None, pos, text.length);
        }

        const result = this.updateModel(
            updated,
            DiffActionType.Insert,
            [pos, pos + text.length]
        );
        this.setSelection(pos + text.length);
        return result;
    }

    /**
     * Удаляет указанный диапазон текста
     */
    removeText(from: number, to: number): Model {
        const updated = this.isMarkdown
            ? mdRemoveText(this.model, from, to - from, this.options.parse)
            : removeText(this.model, from, to - from, this.options.parse);
        const result = this.updateModel(
            updated,
            DiffActionType.Remove,
            [from, to]);

        this.setSelection(from);
        return result;
    }

    /**
     * Заменяет текст в указанном диапазоне `from:to` на новый
     */
    replaceText(from: number, to: number, text: string): Model {
        const result = this.paste(text, from, to);
        this.setSelection(from + text.length);
        return result;
    }

    /**
     * Вырезает фрагмент по указанному диапазону из модели и возвращает его
     * @returns Вырезанный фрагмент модели
     */
    cut(from: number, to: number): Model {
        const result = this.isMarkdown
            ? mdCutText(this.model, from, to, this.options.parse)
            : cutText(this.model, from, to, this.options.parse);
        this.updateModel(result.tokens, 'cut', [from, to]);
        return result.cut;
    }

    /**
     * Вставка текста в указанную позицию
     */
    paste(text: string | Model, from: number, to: number): Model {
        const value = this.sanitizeText(typeof text === 'string' ? text : getText(text));
        let next = this.isMarkdown
            ? mdReplaceText(this.model, from, to - from, value, this.options.parse)
            : replaceText(this.model, from, to - from, value, this.options.parse);

        // Применяем форматирование из фрагмента
        if (Array.isArray(text)) {
            let offset = from;
            text.forEach(token => {
                const len = token.value.length;
                if (token.format) {
                    next = this.setFormat(next, { add: token.format }, [offset, len]);
                }

                if (isCustomLink(token)) {
                    next = setLink(next, token.link, offset, len)
                }

                offset += len;
            });
        }

        return this.updateModel(next, 'paste', [from, to]);
    }

    /**
     * Ставит фокус в редактор
     */
    focus(): void {
        this.element.focus();
        this.setSelection(this.caret[0], this.caret[1]);
    }

    /**
     * Обновляет форматирование у указанного диапазона
     */
    updateFormat(format: TokenFormat | TokenFormatUpdate, from: number, to = from): Model {
        const range: Rng = [from, to - from];
        const result = this.updateModel(
            this.setFormat(this.model, format, range),
            'format',
            [from, to]
        );
        setRange(this.element, range[0], range[0] + range[1]);
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

        let source: Token | undefined;
        if (from !== to) {
            const fragment = slice(this.model, from, to);
            source = fragment[0];
        } else {
            const pos = tokenForPos(this.model, from, LocationType.Start);
            if (pos.index !== -1) {
                source = this.model[pos.index];
            }
        }

        if (source) {
            const update: TokenFormatUpdate = source.format & format
                ? { remove: format } : { add: format };
            return this.updateFormat(update, from, to);
        } else if (!this.model.length && format) {
            return this.updateFormat({ add: format }, 0, 0);
        }

        return this.model;
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
     * Ставит ссылку на `url` на указанный диапазон. Если `url` пустой или равен
     * `null`, удаляет ссылку с указанного диапазона
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

        const result = this.updateModel(updated, 'link', [from, to]);
        setRange(this.element, range[0], range[0] + range[1]);
        return result;
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
     */
    setSelection(from: number, to = from): void {
        [from, to] = this.normalizeRange([from, to]);
        this.saveSelection([from, to]);
        setRange(this.element, from, to);
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

        this.model = value;

        if (this.focused) {
            this.setSelection(selection[0], selection[1]);
        } else {
            this.saveSelection(this.normalizeRange(selection));
        }

        this.history.clear();
        this.history.push(this.model, 'init', this.caret);
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

        this.options = {
            ...this.options,
            ...options
        };

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
        let result = '';
        let node: Node;
        let raw: string | undefined;

        for (let i = 0; i < this.element.childNodes.length; i++) {
            const line = this.element.childNodes[i] as HTMLElement;
            raw = getRawValue(line);
            if (raw) {
                result += raw;
            } else if (i > 0) {
                result += '\n';
            }

            const walker = createWalker(line);
            while (node = walker.nextNode()) {
                result += getRawValue(node);
            }
        }

        return result;
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
        const prev = this.model;
        if (value !== prev) {
            if (typeof action === 'string') {
                this.history.push(value, action, range);
            }
            this.model = value;
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
     * Применяет новый формат к указанному диапазону и возвращает новый набор токенов
     */
    private setFormat(tokens: Model, format: TokenFormat | TokenFormatUpdate, range: Rng): Model {
        if (this.isMarkdown) {
            // С изменением MD-форматирования немного схитрим: оставим «чистый» набор
            // токенов, без MD-символов, и поменяем ему формат через стандартный `setFormat`.
            // Полученный результат обрамим MD-символами для получения нужного результата
            // и заново распарсим
            const text = mdToText(tokens, range);
            const updated = setFormat(text, format, range[0], range[1]);
            return parse(textToMd(updated, range), this.options.parse);
        }

        return setFormat(tokens, format, range[0], range[1]);
    }

    private render(): void {
        render(this.element, this.model, {
            fixTrailingLine: true,
            replaceTextEmoji: this.options.parse?.textEmoji,
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

    private waitExpectedEnter(evt: KeyboardEvent): void {
        if (!this.expectEnter && !evt.defaultPrevented && evt.key === 'Enter') {
            this.expectEnter = true;
            requestAnimationFrame(() => {
                if (this.expectEnter) {
                    this.expectEnter = false;
                    this.insertOrReplaceText(getTextRange(this.element), '\n');
                    retainNewlineInViewport(this.element);
                }
            });
        }
    }

    private insertOrReplaceText(range: TextRange, text: string): Model {
        return isCollapsed(range)
            ? this.insertText(range[0], text)
            : this.replaceText(range[0], range[1], text);
    }

    private handleBeforeInput(composing = false) {
        const range = getTextRange(this.element);
        if (range) {
            this.inputState = {
                range,
                text: this.getInputText(),
                composing
            };
        }
    }

    private handleInput(insert?: string) {
        const { inputState } = this;
        if (!inputState) {
            return;
        }

        const range = getTextRange(this.element);
        const insertFrom = Math.min(inputState.range[0], range[0]);
        const removeFrom = insertFrom;
        let insertTo = range[1];
        let removeTo = inputState.range[1];

        if (!insert) {
            const text = this.getInputText();
            if (isCollapsed(range) && insertFrom === removeFrom && insertTo === removeTo) {
                const delta = inputState.text.length - text.length;
                if (delta > 0) {
                    // Удалили текст
                    removeTo += delta;
                } else if (delta < 0) {
                    // Добавили текст, но почему-то не отследили (перевод строки?)
                    insertTo -= delta;
                }
            }

            insert = text.slice(insertFrom, insertTo);
        }

        if (insert) {
            // Вставка текста
            if (removeFrom !== removeTo) {
                this.replaceText(removeFrom, removeTo, insert);
            } else {
                this.insertText(insertFrom, insert);
            }
        } else if (removeFrom !== removeTo) {
            // Удаление текста
            this.removeText(removeFrom, removeTo);
        }
        this.inputState = null;
    }

    /**
     * Обработка ввода из указанного события. Вернёт `true` если событие удалось обработать
     */
    private handleInputFromEvent(evt: InputEvent): boolean {
        if (skipInputTypes.has(evt.inputType)) {
            evt.preventDefault();
            return true;
        }

        if (evt.inputType.startsWith('format')) {
            // Применяем форматирование: скорее всего это Safari с тачбаром
            const [from, to] = getTextRange(this.element);
            switch (evt.inputType) {
                case 'formatBold':
                    this.toggleFormat(TokenFormat.Bold, from, to);
                    break;
                case 'formatItalic':
                    this.toggleFormat(TokenFormat.Italic, from, to);
                    break;
                case 'formatUnderline':
                    this.toggleFormat(TokenFormat.Underline, from, to);
                    break;
                case 'formatStrikeThrough':
                    this.toggleFormat(TokenFormat.Strike, from, to);
                    break;
                case 'formatFontColor':
                    const update: TokenFormatUpdate = /^rgb\(0,\s*0,\s*0\)/.test(evt.data) || evt.data === 'transparent'
                        ? { remove: TokenFormat.Marked}
                        : { add: TokenFormat.Marked }

                    this.updateFormat(update, from, to);
                    break;
            }

            evt.preventDefault();
            return true;
        }

        if (!evt.getTargetRanges) {
            return false;
        }

        const range = rangeToLocation(this.element, evt.getTargetRanges()[0] as Range);
        const text = getInputEventText(evt);
        const tokens = this.model;
        // console.log('apply update', {
        //     origin: getText(tokens),
        //     tokens,
        //     data: text,
        //     targetRange: range,
        //     currentRange: getTextRange(this.element),
        //     action: evt.inputType
        // });

        if (evt.inputType.startsWith('insert')) {
            this._model = replaceText(tokens, range[0], range[1] - range[0], text, this.options.parse);
        } else if (evt.inputType.startsWith('delete')) {
            this._model = removeText(tokens, range[0], range[1] - range[0], this.options.parse);
        } else {
            console.warn('unknown action type', evt.inputType);
            return false;
        }

        this.scheduleRender();
        return true;
    }

    private scheduleRender() {
        if (!this.pendingRenderId) {
            this.pendingRenderId = requestAnimationFrame(() => {
                this.pendingRenderId = 0;
                const range = getTextRange(this.element);
                this.render();
                this.setSelection(range[0], range[1]);
            });
        }
    }

    /**
     * При необходимости удаляет из текста ненужные данные, исходя из текущих настроек
     */
    private sanitizeText(text: string): string {
        if (this.options.nowrap) {
            text = text.replace(/[\r\n]/g, ' ');
        }

        return text;
    }
}

/**
 * Возвращает текстовое содержимое указанных токенов
 */
function getText(tokens: Token[]): string {
    return tokens.map(t => t.value).join('');
}

function isCollapsed(range: TextRange): boolean {
    return range[0] === range[1];
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
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
export function htmlToText(html: string): string {
    const elem = document.createElement('template');
    elem.innerHTML = html;

    const walker = document.createTreeWalker(elem.content || elem, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.currentNode;
    let result = '';

    while (node) {
        if (node.nodeName === 'INPUT') {
            result += (node as HTMLInputElement).value;
        } else if (isText(node)) {
            result += node.nodeValue;
        }
        node = walker.nextNode();
    }

    return result;
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
    let target = r.startContainer.childNodes[r.startOffset];
    if (target?.nodeName === 'BR') {
        return target as Element;
    }

    target = r.startContainer.childNodes[r.startOffset - 1];
    if (target?.nodeName === 'BR') {
        return target as Element;
    }
}

function getInputEventText(evt: InputEvent): string {
    if (evt.inputType === 'insertParagraph' || evt.inputType === 'insertLineBreak') {
        return '\n';
    }

    if (evt.data != null) {
        return evt.data;
    }

    // Расширение для Safari, используется. например, для подстановки
    // нового значения на длинное нажатие клавиши (е → ё)
    if (evt.dataTransfer) {
        return evt.dataTransfer.getData('text/plain');
    }

    return '';
}
