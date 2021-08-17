import { Emoji, Token, TokenFormat, TokenMarkdown, ParserOptions } from './types';
declare type MatchFn = (ch: number) => boolean;
export declare type Bracket = 'curly' | 'square' | 'round';
export declare const enum Quote {
    None = 0,
    Single = 1,
    Double = 2
}
export default class ParserState {
    /** Опции, с которыми парсим текст */
    options: ParserOptions;
    /** Текущая позиция парсера */
    pos: number;
    /** Текстовая строка, которую нужно парсить */
    string: string;
    /** Текущий аккумулированный MD-формат  */
    format: TokenFormat;
    /** Список распаршенных токенов */
    tokens: Token[];
    /** Стэк открытых токенов форматирования */
    formatStack: TokenMarkdown[];
    /** Позиция начала накапливаемого текстового фрагмента */
    textStart: number;
    /** Позиция конца накапливаемого текстового фрагмента */
    textEnd: number;
    /** Список эмоджи для текущего текстового токена */
    emoji: Emoji[];
    /** Счётчик скобок */
    brackets: Record<Bracket, number>;
    quote: Quote;
    /**
     * @param text Строка, которую нужно распарсить
     * @param pos Позиция, с которой нужно начинать парсинг
     */
    constructor(str: string, options: ParserOptions, pos?: number);
    /**
     * Возвращает *code point* текущего символа парсера без смещения указателя
     */
    peek(): number;
    /**
     * Возвращает *code point* текущего символа парсера и смещает указатель
     */
    next(): number;
    /**
     * Возвращает код предыдущего символа без смещения указателя
     */
    peekPrev(): number;
    /**
     * Вернёт `true` если позиция парсера не находится в конце потока и можно ещё
     * с него считывать данные
     */
    hasNext(): boolean;
    /**
     * Проверяет, есть ли аккумулированный текст в состоянии
     */
    hasPendingText(): boolean;
    /**
     * Поглощает символ в текущей позиции парсера, если он соответствует `match`.
     * `match` может быть как кодом символа, так и функцией, которая принимает текущий
     * символ и должна вернуть `true` или `false`
     * Вернёт `true` если символ был поглощён
     */
    consume(match: number | MatchFn): boolean;
    /**
     * Вызывает функцию `consume` до тех пор, пока текущий символ соответствует
     * условию `match`.
     * Вернёт `true` если было поглощение
     */
    consumeWhile(match: number | MatchFn): boolean;
    /**
     * Возвращает подстроку по указанным индексам
     */
    substring(from: number, to?: number): string;
    /**
     * Добавляет указанный токен в вывод
     */
    push(token: Token): void;
    /**
     * Добавляет эмоджи для текущего накапливаемого текста
     * @param from Начала эмоджи _относительно всего потока_
     * @param to Конец эмоджи _относительно всего потока_
     * @param emoji Фактический эмоджи
     */
    pushEmoji(from: number, to: number, emoji?: string): void;
    /**
     * Проверяет, есть ли указанный формат в текущем состоянии
     */
    hasFormat(format: TokenFormat): boolean;
    /**
     * Добавляет указанный тип форматирования в состояние
     */
    addFormat(format: TokenFormat): void;
    /**
     * Добавляет указанный тип форматирования из состояния
     */
    removeFormat(format: TokenFormat): void;
    /**
     * Поглощает текущий символ как накапливаемый текст
     */
    consumeText(): void;
    /**
     * Записывает накопленный текстовый токен в вывод
     */
    flushText(): void;
    hasQuote(quote: Quote): boolean;
    /**
     * Проверяет, находимся ли мы сейчас на границе слов
     */
    atWordBound(): boolean;
    /**
     * Вернёт `true`, если в данный момент находимся сразу после эмоджи
     */
    isAfterEmoji(): boolean;
    markPending(textStart: number): void;
    /**
     * Сброс счётчика скобок
     */
    resetBrackets(): void;
    /**
     * Смещает указатель на размер указанного кода символ вправо.
     */
    private inc;
}
export {};
