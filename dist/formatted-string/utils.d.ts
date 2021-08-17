import { Token, Emoji, TokenLink, TokenText, TokenFormat } from '../parser';
export interface TokenForPos {
    /** Индекс найденного токена (будет -1, если такой токен не найден) и  */
    index: number;
    /** Текстовое смещение позиции относительно начала токена */
    offset: number;
}
export declare const enum LocationType {
    Start = "start",
    End = "end"
}
/**
 * Возвращает индекс токена из списка `tokens`, который соответствует указанной
 * позиции текста
 * @param solid Если указан, индекс позиции токена будет обновлён таким образом,
 * чтобы учитывать «сплошные» (неразрывные) токены, то есть токены, которые нельзя
 * разрывать в середине. В основном это используется для форматирования, чтобы
 * не делить токен и не заниматься репарсингом. Значение может быть `false` (начало)
 * или `true` (конец)
 */
export declare function tokenForPos(tokens: Token[], offset: number, locType?: LocationType, solid?: boolean): TokenForPos;
/**
 * Возвращает позиции в токенах для указанного диапазона
 */
export declare function tokenRange(tokens: Token[], from: number, to: number, solid?: boolean): [TokenForPos, TokenForPos];
/**
 * Делит токен на две части в указанной позиции
 */
export declare function splitToken(token: Token, pos: number): [Token, Token];
/**
 * Возвращает фрагмент указанного токена
 */
export declare function sliceToken(token: Token, start: number, end?: number): Token;
/**
 * Возвращает список эмоджи, который соответствует указанному диапазону.
 * Если список пустой, то вернёт `undefined` для поддержки контракта с токенами
 */
export declare function sliceEmoji(emoji: Emoji[] | undefined, from: number, to: number): Emoji[] | undefined;
/**
 * Проверяет, является ли указанный токен сплошным, то есть его разделение на части
 * для форматирования является не желательным
 */
export declare function isSolidToken(token: Token): boolean;
/**
 * Проверяет, что указанный токен является пользовательской ссылкой, то есть
 * ссылка отличается от содержимого токена
 */
export declare function isCustomLink(token: Token): token is TokenLink;
/**
 * Проверяет, что указанный токен — это автоссылка, то есть автоматически
 * распарсилась из текста
 */
export declare function isAutoLink(token: Token): token is TokenLink;
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Конвертирует указанный токен в текст
 */
export declare function toText(token: Token, sticky?: boolean): TokenText;
/**
 * Конвертирует указанный токен в ссылку
 */
export declare function toLink(token: Token, link: string, sticky?: boolean): TokenLink;
/**
 * Фабрика объекта-токена
 */
export declare function createToken(text: string, format?: TokenFormat, sticky?: boolean, emoji?: Emoji[]): Token;
export declare function isSticky(token: Token): boolean;
