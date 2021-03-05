import { Token, TokenFormat } from '../formatted-string';
import { Emoji, TokenMarkdown, TokenText, TokenType } from '../formatted-string/types';
import { ParserOptions } from './types';
import { isDelimiter, last } from './utils';

type MatchFn = (ch: number) => boolean;
export type Bracket = 'curly' | 'square' | 'round';

export default class ParserState {
    /** Опции, с которыми парсим текст */
    public options: ParserOptions;

    /** Текущая позиция парсера */
    public pos: number;

    /** Текстовая строка, которую нужно парсить */
    public string: string;

    /** Текущий аккумулированный MD-формат  */
    public format: TokenFormat = 0;

    /** Список распаршенных токенов */
    public tokens: Token[] = [];

    /** Стэк открытых токенов форматирования */
    public formatStack: TokenMarkdown[] = [];

    /** Позиция начала накапливаемого текстового фрагмента */
    public textStart = -1;

    /** Позиция конца накапливаемого текстового фрагмента */
    public textEnd = -1;

    /** Список эмоджи для текущего текстового токена */
    public emoji: Emoji[] = [];

    /** Счётчик скобок */
    public brackets: Record<Bracket, number> = {
        round: 0,
        square: 0,
        curly: 0,
    }

    /**
     * Возвращает *code point* текущего символа парсера без смещения указателя
     */
    public peek: () => number;

    /**
     * @param text Строка, которую нужно распарсить
     * @param pos Позиция, с которой нужно начинать парсинг
     */
    constructor(str: string, options: ParserOptions, pos = 0) {
        this.string = str;
        this.options = options;
        this.pos = pos;
        this.peek = String.prototype.codePointAt
            ? () => nativeCodePointAt(this.string, this.pos)
            : () => polyfillCodePointAt(this.string, this.pos);
    }

    /**
     * Возвращает *code point* текущего символа парсера и смещает указатель
     */
    next(): number {
        return this.hasNext() ? this.inc(this.peek()) : NaN;
    }

    /**
     * Возвращает код предыдущего символа без смещения указателя
     */
    peekPrev(): number {
        // XXX в идеале надо учитывать code points, но пока для текущих требований
        // парсера это не надо
        return this.string.charCodeAt(this.pos - 1);
    }

    /**
     * Вернёт `true` если позиция парсера не находится в конце потока и можно ещё
     * с него считывать данные
     */
    hasNext(): boolean {
        return this.pos < this.string.length;
    }

    /**
     * Проверяет, есть ли аккумулированный текст в состоянии
     */
    hasPendingText(): boolean {
        return this.textStart !== this.textEnd;
    }

    /**
     * Поглощает символ в текущей позиции парсера, если он соответствует `match`.
     * `match` может быть как кодом символа, так и функцией, которая принимает текущий
     * символ и должна вернуть `true` или `false`
     * Вернёт `true` если символ был поглощён
     */
    consume(match: number | MatchFn): boolean {
        const ch = this.peek();
        const ok = typeof match === 'function' ? match(ch) : ch === match;

        if (ok) {
            this.inc(ch);
        }

        return ok;
    }

    /**
     * Вызывает функцию `consume` до тех пор, пока текущий символ соответствует
     * условию `match`.
     * Вернёт `true` если было поглощение
     */
    consumeWhile(match: number | MatchFn): boolean {
        const start = this.pos;
        while (this.hasNext() && this.consume(match)) { /* */ }
        return this.pos !== start;
    }

    /**
     * Возвращает подстроку по указанным индексам
     */
    substring(from: number, to = this.pos): string {
        return this.string.substring(from, to);
    }

    /**
     * Добавляет указанный токен в вывод
     */
    push(token: Token): void {
        this.flushText();
        this.tokens.push(token);
    }

    /**
     * Добавляет эмоджи для текущего накапливаемого текста
     * @param from Начала эмоджи _относительно всего потока_
     * @param to Конец эмоджи _относительно всего потока_
     * @param emoji Фактический эмоджи
     */
    pushEmoji(from: number, to: number, emoji?: string): void {
        if (this.textStart === -1) {
            this.textStart = from;
        }

        // Эмоджи добавляем с абсолютной адресацией, но храним с относительной,
        // чтобы можно было доставать из самого токена
        const token: Emoji = {
            from: from - this.textStart,
            to: to - this.textStart,
        };
        if (emoji != null) {
            token.emoji = emoji;
        }
        this.emoji.push(token);
        this.textEnd = to;
    }

    /**
     * Проверяет, есть ли указанный формат в текущем состоянии
     */
    hasFormat(format: TokenFormat): boolean {
        return (this.format & format) === format;
    }

    /**
     * Добавляет указанный тип форматирования в состояние
     */
    addFormat(format: TokenFormat): void {
        this.format |= format;
    }

    /**
     * Добавляет указанный тип форматирования из состояния
     */
    removeFormat(format: TokenFormat): void {
        this.format ^= this.format & format;
    }

    /**
     * Поглощает текущий символ как накапливаемый текст
     */
    consumeText(): void {
        if (this.textStart === -1) {
            this.textStart = this.textEnd = this.pos;
        }

        this.next();
        this.textEnd = this.pos;
    }

    /**
     * Записывает накопленный текстовый токен в вывод
     */
    flushText(): void {
        if (this.hasPendingText()) {
            // TODO использовать функцию-фабрику для сохранения шэйпа
            const token: TokenText = {
                type: TokenType.Text,
                format: TokenFormat.None,
                value: this.substring(this.textStart, this.textEnd),
                sticky: false,
            };

            if (this.emoji.length) {
                token.emoji = this.emoji;
                this.emoji = [];
            }
            this.tokens.push(token);
            this.textStart = this.textEnd = -1;
        }
    }

    /**
     * Проверяет, находимся ли мы сейчас на границе слов
     */
    atWordBound(): boolean {
        // Для указанной позиции нам нужно проверить, что предыдущий символ или токен
        // является границей слов
        const { pos } = this;
        if (pos === 0) {
            // Находимся в самом начале
            return true;
        }

        if (this.hasPendingText()) {
            if (this.emoji.length && last(this.emoji).to === (this.textEnd - this.textStart)) {
                return true;
            }

            return isDelimiter(this.peekPrev());
        }

        const lastToken = last(this.tokens);
        if (lastToken) {
            if (lastToken.type === TokenType.Text && lastToken.emoji?.length) {
                // Если в конце текстовый токен, проверим, чтобы он закачивался
                // на эмоджи
                const lastEmoji = last(lastToken.emoji);
                return lastEmoji.to === lastToken.value.length;
            }

            return lastToken.type === TokenType.Markdown;
        }

        return false;
    }

    markPending(textStart: number): void {
        if (!this.hasPendingText()) {
            this.textStart = textStart;
        }
        this.textEnd = this.pos;
    }

    /**
     * Сброс счётчика скобок
     */
    resetBrackets(): void {
        this.brackets.curly = this.brackets.round = this.brackets.square = 0;
    }

    /**
     * Смещает указатель на размер указанного кода символ вправо.
     */
    private inc(code: number): number {
        this.pos += code > 0xFFFF ? 2 : 1;
        return code;
    }
}

/**
 * Нативная реализация `String#codePointAt`
 */
function nativeCodePointAt(str: string, pos: number): number {
    return str.codePointAt(pos);
}

function polyfillCodePointAt(str: string, pos: number): number {
    const size = str.length;

    if (pos < 0 || pos >= size) {
        return undefined;
    }

    const first = str.charCodeAt(pos);

    if (first >= 0xD800 && first <= 0xDBFF && size > pos + 1) {
        const second = str.charCodeAt(pos + 1);
        if (second >= 0xDC00 && second <= 0xDFFF) {
            return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
        }
    }
    return first;
}
