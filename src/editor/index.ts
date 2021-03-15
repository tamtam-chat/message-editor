import parse, { ParserOptions, Token, TokenFormat } from '../parser';
import render from '../render';
import { TextRange } from '../types';
import History, { HistoryEntry } from './history';
import { getTextRange, setRange } from './range';
import diffAction, { DiffAction, DiffActionType } from './diff';
import {
    cutText, getLength, insertText, removeText, replaceText, setFormat, setLink,
    slice, clamp, TokenFormatUpdate
} from '../formatted-string';
import Shortcuts, { ShortcutHandler } from './shortcuts';
import { TokenType } from '../formatted-string/types';

export interface EditorOptions {
    /** Значение по умолчанию для редактора */
    value?: string;
    /** Параметры для парсера текста */
    parse?: ParserOptions;
    shortcuts?: Record<string, ShortcutHandler<Editor> | null>;
}

interface PendingUpdate {
    text: string;
    range: TextRange;
}

type Model = Token[];

/** MIME-тип для хранения отформатированной строки в буффере */
const fragmentMIME = 'tamtam/fragment';

const defaultShortcuts: Record<string, ShortcutHandler<Editor>> = {
    'Cmd+Z': editor => editor.undo(),
    'Cmd+Y': editor => editor.redo(),
    'Cmd+Shift+Z': editor => editor.redo(),
    'Cmd+B': editor => editor.toggleFormat(TokenFormat.Bold),
    'Cmd+I': editor => editor.toggleFormat(TokenFormat.Italic),
    'Cmd+U': editor => editor.toggleFormat(TokenFormat.Strike),
    'Cmd+K': editor => editor.toggleFormat(TokenFormat.Monospace),
    'Ctrl+L': editor => {
        const [from, to] = editor.getSelection();
        const token = editor.tokenForPos(from);
        const url = prompt('Введите ссылку', token?.type === TokenType.Link ? token.link : undefined);
        editor.setLink(url, from, to);
    },
};

export default class Editor {
    public shortcuts: Shortcuts<Editor>;

    private _model: Model;
    private inputHandled = false;
    private pendingUpdate: PendingUpdate | null = null;
    private pendingDelete: TextRange | null = null;
    private history: History<Model>;
    private caret: TextRange = [0, 0];

    private onKeyPress = (evt: KeyboardEvent) => {
        if (!evt.defaultPrevented && isInputEvent(evt)) {
            const range = getTextRange(this.elem);

            if (range) {
                // Перехватываем keypress, что бы потом красиво и плавно всё вставить
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
        const range = getTextRange(this.elem);
        if (range && isCollapsed(range)) {
            let payload: DiffAction;
            const value = this.getValue();
            const inputValue = this.getInputText();

            if (this.pendingDelete) {
                const from = Math.min(range[0], this.pendingDelete[0]);
                payload = {
                    action: DiffActionType.Remove,
                    pos: from,
                    text: value.slice(from, from + (value.length - inputValue.length))
                }
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
        const range = getTextRange(this.elem);

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
    private onPaste(evt: ClipboardEvent) {
        const range = getTextRange(this.elem);
        let fragment: string | Token[] = evt.clipboardData.getData(fragmentMIME);

        if (fragment) {
            fragment = JSON.parse(fragment) as Token[];
        } else if (evt.clipboardData.types.includes('Files')) {
            // TODO обработать вставку файлов
        } else {
            fragment = evt.clipboardData.getData('text/plain');
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

    /**
     * @param elem Контейнер, в котором будет происходить редактирование
     */
    constructor(public elem: HTMLElement, public options: EditorOptions = {}) {
        this.model = parse(options.value || '', options.parse);
        this.history = new History({
            compactActions: [DiffActionType.Insert, DiffActionType.Remove]
        });
        this.shortcuts = new Shortcuts(this);
        this.setup();
        this.history.push(this.model, 'init', this.caret);
    }

    get model(): Model {
        return this._model;
    }

    set model(value: Model) {
        if (this._model !== value) {
            this._model = value;
            // При рендеринге может слететь позиция курсора, поэтому после рендеринга
            // проверим: если она поменялась, то восстановим
            render(this.elem, value);
        }
    }

    /**
     * Настраивает редактор для работы. Вынесено в отдельный метод для удобного
     * переопределения
     */
    setup(): void {
        this.elem.contentEditable = 'true';
        this.elem.addEventListener('keypress', this.onKeyPress);
        this.elem.addEventListener('keydown', this.onHandleShortcut);
        this.elem.addEventListener('input', this.onInput);
        this.elem.addEventListener('cut', this.onCut);
        this.elem.addEventListener('copy', this.onCopy);
        this.elem.addEventListener('paste', this.onPaste);
        document.addEventListener('selectionchange', this.onSelectionChange);

        const shortcuts = {
            ...defaultShortcuts,
            ...this.options.shortcuts
        };

        Object.keys(shortcuts).forEach(sh => {
            const handler = shortcuts[sh];
            if (handler) {
                this.shortcuts.register(sh, handler);
            }
        });
    }

    /**
     * Вызывается для того, чтобы удалить все связи редактора с DOM.
     */
    dispose(): void {
        this.elem.removeEventListener('keypress', this.onKeyPress);
        this.elem.removeEventListener('keydown', this.onHandleShortcut);
        this.elem.removeEventListener('input', this.onInput);
        this.elem.removeEventListener('cut', this.onCut);
        this.elem.removeEventListener('copy', this.onCopy);
        this.elem.removeEventListener('paste', this.onPaste);
        document.removeEventListener('selectionchange', this.onSelectionChange);
        this.inputHandled = false;
        this.pendingUpdate = null;
        this.shortcuts.unregisterAll();
    }

    /////////// Публичные методы для работы с текстом ///////////

    /**
     * Вставляет текст в указанную позицию
     */
    insertText(pos: number, text: string): Model {
        const result = this.updateModel(
            insertText(this.model, pos, text, this.options.parse),
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
        const result = this.updateModel(
            removeText(this.model, from, to - from, this.options.parse),
            DiffActionType.Remove,
            [from, to]);

        this.setSelection(from);
        return result;
    }

    /**
     * Заменяет текст в указанном диапазоне `from:to` на новый
     */
    replaceText(from: number, to: number, text: string): Model {
        return this.paste(text, from, to);
    }

    /**
     * Вырезает фрагмент по указанному диапазону из модели и возвращает его
     * @returns Вырезанный фрагмент модели
     */
    cut(from: number, to: number): Model {
        const result = cutText(this.model, from, to, this.options.parse);
        this.updateModel(result.tokens, 'cut', [from, to]);
        return result.cut;
    }

    /**
     * Вставка текста в указанную позицию
     */
    paste(text: string | Model, from: number, to: number): Model {
        const value = typeof text === 'string' ? text : getText(text);
        const next = replaceText(this.model, from, to - from, value, this.options.parse);

        // TODO применить форматирование и типы из вставляемых токенов
        return this.updateModel(next, 'paste', [from, to]);
    }

    /**
     * Ставит фокус в редактор
     */
    focus(): void {
        this.elem.focus();
        this.setSelection(getLength(this.model));
    }

    /**
     * Обновляет форматирование у указанного диапазона
     */
    updateFormat(format: TokenFormatUpdate, from: number, to = from): Model {
        const result = this.updateModel(
            setFormat(this.model, format, from, to - from),
            'format',
            [from, to]
        );
        setRange(this.elem, from, to);
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

        const fragment = this.slice(from, to);
        const source = fragment.length ? fragment[0] : this.tokenForPos(from);

        if (source) {
            const update: TokenFormatUpdate = source.format & format
                ? { remove: format } : { add: format };
            return this.updateFormat(update, from, to);
        }

        return this.model;
    }

    /**
     * Ставит ссылку на `url` на указанный диапазон. Если `url` пустой или равен
     * `null`, удаляет ссылку с указанного диапазона
     */
    setLink(url: string | null, from: number, to = from): Model {
        if (url) {
            url = url.trim();
        }
        const result = this.updateModel(
            setLink(this.model, url, from, to - from), 'link', [from, to]);
        setRange(this.elem, from, to);
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
     */
    tokenForPos(pos: number): Token | undefined {
        let offset = 0;
        const { model } = this;
        for (let i = 0, token: Token; i < model.length; i++) {
            token = model[i];
            if (pos >= offset && pos < offset + token.value.length) {
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
        from = clamp(from, 0, maxIx);
        to = clamp(to, 0, maxIx);
        setRange(this.elem, from, to);
        this.saveSelection(getTextRange(this.elem));
    }

    /**
     * Возвращает текущее значение модели редактора
     */
    getValue(): string {
        return getText(this.model);
    }

    /**
     * Возвращает строковое содержимое поля ввода
     */
    getInputText(): string {
        const walker = this.elem.ownerDocument.createTreeWalker(this.elem, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
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

    private scheduleUpdate() {
        const update = () => {
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
        };

        // Откладываем изменение модели, даём браузеру применить UI-изменения,
        // а модель поменяем в качестве уведомления. Это сделает UX приятнее
        // и нативнее, в частности, не будет сильно моргать браузерная
        // проверка правописания
        requestAnimationFrame(() => update());

        return true;
    }

    /**
     * Сохраняет указанный диапазон в текущей записи истории в качестве последнего
     * известного выделения
     */
    private saveSelection(range: TextRange): void {
        this.caret = range;
        this.history.saveCaret(range);
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
        const range = getTextRange(this.elem);

        if (range && !isCollapsed(range)) {
            const fragment = cut
                ? this.cut(range[0], range[1])
                : this.slice(range[0], range[1]);

            clipboard.setData('text/plain', getText(fragment));
            clipboard.setData(fragmentMIME, JSON.stringify(fragment));

            if (cut) {
                this.setSelection(range[0]);
            }

            return true;
        }

        return false;
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
