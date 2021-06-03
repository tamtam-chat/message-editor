import parse, { getLength, ParserOptions, Token, TokenFormat, TokenType } from '../parser';
import render, { dispatch, isEmoji, EmojiRender } from '../render';
import { TextRange } from './types';
import History, { HistoryEntry } from './history';
import { getTextRange, setDOMRange, setRange } from './range';
import diffAction, { DiffAction, DiffActionType } from './diff';
import {
    insertText, removeText, replaceText, cutText, setFormat, setLink, slice,
    mdInsertText, mdRemoveText, mdReplaceText, mdCutText, mdToText, textToMd,
    TokenFormatUpdate, TextRange as Rng } from '../formatted-string';
import { isCustomLink, tokenForPos, LocationType } from '../formatted-string/utils';
import Shortcuts, { ShortcutHandler } from './shortcuts';

export interface EditorOptions {
    /** Значение по умолчанию для редактора */
    value?: string;
    /** Параметры для парсера текста */
    parse?: Partial<ParserOptions>;
    shortcuts?: Record<string, ShortcutHandler<Editor>>;

    /** Функция для отрисовки эмоджи */
    emoji?: EmojiRender;
}

interface PendingUpdate {
    text: string;
    range: TextRange;
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

/** MIME-тип для хранения отформатированной строки в буффере */
const fragmentMIME = 'tamtam/fragment';

const defaultPickLinkOptions: PickLinkOptions = {
    url: cur => prompt('Введите ссылку', cur)
};

export default class Editor {
    public shortcuts: Shortcuts<Editor>;
    public history: History<Model>;

    private _model: Model;
    private _inited = false;
    private inputHandled = false;
    private pendingSelChange = false;
    private pendingUpdate: PendingUpdate | null = null;
    private pendingDelete: TextRange | null = null;
    private caret: TextRange = [0, 0];
    private focused = false;

    /**
     * @param element Контейнер, в котором будет происходить редактирование
     */
    constructor(public element: HTMLElement, public options: EditorOptions = {}) {
        const value = options.value || '';
        this.model = parse(value, options.parse);
        this.history = new History({
            compactActions: [DiffActionType.Insert, DiffActionType.Remove]
        });
        this.shortcuts = new Shortcuts(this);
        this.setup();
        // this.setSelection(value.length);
        this.history.push(this.model, 'init', this.caret);
        this._inited = true;
    }

    private onKeyPress = (evt: KeyboardEvent) => {
        if (!evt.defaultPrevented && isInputEvent(evt)) {
            const range = getTextRange(this.element);

            if (range) {
                // Перехватываем обработку `input`, что бы потом красиво и плавно всё вставить
                this.inputHandled = true;
                const text = getTextFromKeyboardEvent(evt);

                if (this.pendingUpdate) {
                    this.pendingUpdate.text += text;
                } else {
                    this.pendingUpdate = { range, text };
                }
            }
        }
    }

    private onInput = () => {
        // Обрабатываем перехваченный ввод — превентим, если был перехват
        if (this.inputHandled) {
            this.inputHandled = false;
            this.scheduleUpdate();
            return;
        }

        // Если сработало событие input, значит, мы не смогли самостоятельно
        // обработать ввод. Попробуем его вычислить
        const range = getTextRange(this.element);
        if (range && isCollapsed(range)) {
            let payload: DiffAction;
            const value = this.getText();
            const inputValue = this.getInputText();

            if (this.pendingDelete) {
                const from = Math.min(range[0], this.pendingDelete[0]);
                payload = {
                    action: DiffActionType.Remove,
                    pos: from,
                    text: value.slice(from, from + (value.length - inputValue.length))
                }
                this.pendingDelete = null;
            } else {
                payload = diffAction(value, inputValue);
            }

            if (!payload) {
                return;
            }

            const from = payload.pos;
            const to = payload.pos + ('oldText' in payload ? payload.oldText : payload.text).length;

            switch (payload.action) {
                case 'insert':
                    this.insertText(from, payload.text);
                    break;
                case 'remove':
                    this.removeText(from, to);

                    // При удалении текста почему-то не срабатывает событие для `onSelectionChange`,
                    // поэтому дёрнем его вручную
                    this.onSelectionChange();
                    break;
                case 'replace':
                    this.replaceText(from, to, payload.text);
                    break;
            }
        } else if (range) {
            console.warn('Unsupported input', range);
        }
    }

    private onSelectionChange = () => {
        if (!this.pendingSelChange) {
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

    private onHandleShortcut = (evt: KeyboardEvent) => {
        if (evt.defaultPrevented) {
            return;
        }

        if (evt.key === 'Backspace' || evt.key === 'Delete') {
            this.pendingDelete = this.getSelection();
        } else {
            this.shortcuts.handle(evt);
        }
    };

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

    private onFocus = () => this.focused = true;
    private onBlur = () => this.focused = false;

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
        this.element.contentEditable = 'true';
        this.element.addEventListener('keypress', this.onKeyPress);
        this.element.addEventListener('keydown', this.onHandleShortcut);
        this.element.addEventListener('input', this.onInput);
        this.element.addEventListener('cut', this.onCut);
        this.element.addEventListener('copy', this.onCopy);
        this.element.addEventListener('paste', this.onPaste);
        this.element.addEventListener('click', this.onClick);
        this.element.addEventListener('focus', this.onFocus);
        this.element.addEventListener('blur', this.onBlur);
        document.addEventListener('selectionchange', this.onSelectionChange);

        const { shortcuts } = this.options;

        if (shortcuts) {
            this.shortcuts.registerAll(shortcuts);
        }
    }

    /**
     * Вызывается для того, чтобы удалить все связи редактора с DOM.
     */
    dispose(): void {
        this.element.removeEventListener('keypress', this.onKeyPress);
        this.element.removeEventListener('keydown', this.onHandleShortcut);
        this.element.removeEventListener('input', this.onInput);
        this.element.removeEventListener('cut', this.onCut);
        this.element.removeEventListener('copy', this.onCopy);
        this.element.removeEventListener('paste', this.onPaste);
        this.element.removeEventListener('click', this.onClick);
        this.element.removeEventListener('focus', this.onFocus);
        this.element.removeEventListener('blur', this.onBlur);
        document.removeEventListener('selectionchange', this.onSelectionChange);
        this.inputHandled = false;
        this.pendingUpdate = null;
    }

    /////////// Публичные методы для работы с текстом ///////////

    /**
     * Вставляет текст в указанную позицию
     */
    insertText(pos: number, text: string): Model {
        const updated = this.isMarkdown
            ? mdInsertText(this.model, pos, text, this.options.parse)
            : insertText(this.model, pos, text, this.options.parse);
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
        const value = typeof text === 'string' ? text : getText(text);
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
        const maxIx = getLength(this.model);
        [from ,to] = this.normalizeRange([from, to]);
        this.saveSelection([from, to]);

        if (from === maxIx && to === maxIx) {
            // Ставим позицию в самый конец поля ввода.
            // Если в тексте есть несколько строк, браузеры будут немного тупить:
            // 1. Если `\n` есть в конце ввода, браузеры его не отобразят, поэтому
            //    внутри функции `render()` мы принудительно добавляем `<br>`
            //    в конце (см. fixNewLine)
            // 2. В случае с Firefox не получится правильно спозиционировать каретку,
            //    ему зачем-то нужна позиция перед `\n`, что не соответствует
            //    поведению других браузеров
            // Поэтому для многострочного ввода, если в конце есть перевод строки,
            // мы будем выставлять диапазон перед фиктивным `<br>`
            const { lastChild } = this.element;
            if (lastChild && lastChild.nodeName === 'BR') {
                const offset = this.element.childNodes.length - 1;
                const range = document.createRange();
                range.setStart(this.element, offset);
                range.setEnd(this.element, offset);
                setDOMRange(range);
                return;
            }
        }

        setRange(this.element, from, to);
    }

    /**
     * Заменяет текущее значение редактора на указанное. При этом полностью
     * очищается история изменений редактора
     */
    setValue(value: string | Model, selection?: TextRange): void {
        if (typeof value === 'string') {
            value = parse(value, this.options.parse);
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
    getText(): string {
        return getText(this.model);
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
        const walker = this.element.ownerDocument.createTreeWalker(this.element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        let result = '';
        let node: Node;
        let raw: string | undefined;

        while (node = walker.nextNode()) {
            if (node.nodeType === Node.TEXT_NODE) {
                result += node.nodeValue;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                raw = (node as Element).getAttribute('data-raw');
                if (raw) {
                    result += raw;
                } else if (node.nodeName === 'BR') {
                    result += '\n';
                }
            }
        }

        if (result.slice(-1) === '\n') {
            // С учётом костыля рендеринга переводов строк в конце:
            // в методе `render()` добавляется ещё один для правильной отрисовки.
            // Мы его тут удалим
            result = result.slice(0, -1);
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

    private scheduleUpdate() {
        // Откладываем изменение модели, даём браузеру применить UI-изменения,
        // а модель поменяем в качестве уведомления. Это сделает UX приятнее
        // и нативнее, в частности, не будет сильно моргать браузерная
        // проверка правописания
        requestAnimationFrame(() => this.flushPendingUpdate());
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
            this.notifySelChange();
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
        });
    }

    private emit(eventName: EventName): void {
        if (this._inited) {
            dispatch<EditorEventDetails>(this.element, eventName, { editor: this });
        }
    }

    /**
     * Отложенная нотификация об изменении позиции курсора.
     * Учитывает особенности особенности обработки ввода в редакторе:
     * чтобы лишний раз не моргать спеллчекером, обновление модели откладывается
     * на момент отрисовки, поэтому если посылать уведомление сразу, выделение
     * может указывать на позицию, которой нет в модели
     */
    private notifySelChange(): void {
        if (!this.pendingSelChange) {
            this.pendingSelChange = true;
            requestAnimationFrame(() => {
                this.pendingSelChange = false;
                this.emit('editor-selectionchange');
            });
        }
    }

    private flushPendingUpdate() {
        if (this.pendingUpdate) {
            const { range, text } = this.pendingUpdate;

            if (isCollapsed(range)) {
                this.insertText(range[0], text);
            } else if (!text) {
                this.removeText(range[0], range[1]);
            } else {
                this.replaceText(range[0], range[1], text);
            }

            this.pendingUpdate = null;
        }
    }

    private normalizeRange([from, to]: TextRange): TextRange {
        const maxIx = getLength(this.model);
        return [clamp(from, 0, maxIx), clamp(to, 0, maxIx)];
    }
}

/**
 * Возвращает текстовое содержимое указанных токенов
 */
function getText(tokens: Token[]): string {
    return tokens.map(t => t.value).join('');
}

/**
 * Проверяет, является ли указанное событие с клавиатуры вводом символа
 */
function isInputEvent(evt: KeyboardEvent): boolean {
    if (evt.key === 'Enter') {
        return true;
    }

    // NB Firefox также добавляет `.key` на системные клавиши, типа `ArrowDown`,
    // поэтому фильтруем событие по `.charCode`
    return evt.key && evt.charCode && !evt.metaKey && !evt.ctrlKey;
}

function isCollapsed(range: TextRange): boolean {
    return range[0] === range[1];
}

function getTextFromKeyboardEvent(evt: KeyboardEvent): string {
    return evt.key === 'Enter' ? '\n' : evt.key;
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
        } else if (node.nodeType === node.TEXT_NODE) {
            result += node.nodeValue;
        }
        node = walker.nextNode();
    }

    return result;
}
