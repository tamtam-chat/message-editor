import { Token, TokenFormat } from '../formatted-string';
import { TokenType } from '../formatted-string/types';

type MatchFn = (ch: number) => boolean;

export default class ParserState {
    /** Текущая позиция парсера */
    public pos: number;

    /** Текстовая строка, которую нужно парсить */
    public string: string;

    /** Текущий аккумулированный MD-формат  */
    public format: TokenFormat = 0;

    /** Список распаршенных токенов */
    public tokens: Token[] = [];

    /** Позиция начала накапливаемого текстового фрагмента */
    private textStart = -1;

    /** Позиция конца накапливаемого текстового фрагмента */
    private textEnd = -1;

    /**
     * Возвращает *code point* текущего символа парсера без смещения указателя
     */
    public peek: () => number;

    /**
     * @param text Строка, которую нужно распарсить
     * @param pos Позиция, с которой нужно начинать парсинг
     */
    constructor(str: string, pos = 0) {
        this.string = str;
        this.pos = pos;
        this.peek = String.prototype.codePointAt
            ? () => nativeCodePointAt(this.string, this.pos)
            : () => polyfillCodePointAt(this.string, this.pos);
    }

    /**
     * Возвращает *code point* текущего символа парсера и смещает указатель
     */
    next(): number | undefined {
        if (this.hasNext()) {
            return this.inc(this.peek());
        }
    }

    /**
     * Вернёт `true` если позиция парсера не находится в конце потока и можно ещё
     * с него считывать данные
     */
    hasNext(): boolean {
        return this.pos < this.string.length;
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
        if (token.type === TokenType.Markdown) {
            if (token.start) {
                this.addFormat(token.mdType);
            } else {
                this.removeFormat(token.mdType);
            }
        }
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
        if (this.textStart !== this.textEnd) {
            // TODO использовать функцию-фабрику для сохранения шэйпа
            this.tokens.push({
                type: TokenType.Text,
                format: this.format,
                sticky: false,
                value: this.substring(this.textStart, this.textEnd)
            });
            this.textStart = this.textEnd = -1;
        }
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
