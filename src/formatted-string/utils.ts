import { Token, Emoji, TokenLink, TokenType, TokenText, TokenFormat } from '../parser';

export interface TokenForPos {
    /** Индекс найденного токена (будет -1, если такой токен не найден) и  */
    index: number;

    /** Текстовое смещение позиции относительно начала токена */
    offset: number;
}

export const enum LocationType {
    Start = 'start',
    End = 'end'
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
export function tokenForPos(tokens: Token[], offset: number, locType: LocationType = LocationType.End, solid?: boolean): TokenForPos {
    if (offset < 0) {
        return { index: -1, offset: -1 };
    }

    const index = tokens.findIndex((token, i) => {
        const len = token.value.length;

        if (offset < len) {
            return true;
        }

        if (len === offset) {
            // Попали точно на границу токенов. Проверим, если следующий является
            // sticky-токеном, то работать нужно будет с ним, иначе с текущим

            if (tokens.length - 1 === i) {
                // Это последний токен
                return true;
            }

            const nextToken = tokens[i + 1]!;
            if (!isSticky(nextToken) && locType === LocationType.End) {
                return true;
            }
        }

        offset -= len;
    });

    const pos: TokenForPos = { offset, index };

    if (index !== -1) {
        const token = tokens[index];
        if (solid && isSolidToken(token)) {
            pos.offset = locType === LocationType.End ? token.value.length : 0;
        } else if (token.emoji) {
            // Обновляем позицию `offset` внутри токена таким образом,
            // чтобы она не попадала на вложенный эмоджи
            const { emoji } = token;
            for (let i = 0; i < emoji.length && emoji[i].from < pos.offset; i++) {
                if (emoji[i].to > pos.offset) {
                    pos.offset = locType === LocationType.Start ? emoji[i].from : emoji[i].to;
                    break;
                }
            }
        }
    }

    return pos;
}

/**
 * Возвращает позиции в токенах для указанного диапазона
 */
export function tokenRange(tokens: Token[], from: number, to: number, solid = false): [TokenForPos, TokenForPos] {
    const start = tokenForPos(tokens, from, LocationType.Start, solid);
    const end = tokenForPos(tokens, to, LocationType.End, solid);
    // Из-за особенностей определения позиций может случиться, что концевой токен
    // будет левее начального. В этом случае отдаём предпочтение концевому
    if (end.index < start.index && from === to) {
        return [end, end];
    }

    return end.index < start.index && from === to
        ? [end, end]
        : [start, end]
}

/**
 * Делит токен на две части в указанной позиции
 */
export function splitToken(token: Token, pos: number): [Token, Token] {
    pos = clamp(pos, 0, token.value.length);

    // Разбор пограничных случаев: позиция попадает на начало или конец токена
    if (pos === 0) {
        return [createToken('') , token];
    }

    if (pos === token.value.length) {
        return [token, createToken('')];
    }

    let right = sliceToken(token, pos);

    // Так как у нас фактически все токены зависят от префикса, деление
    // токена всегда должно превратить правую часть в обычный текст, только если
    // это не произвольная ссылка
    if (!isCustomLink(right) && pos > 0) {
        right = toText(right);
    }

    return [
        sliceToken(token, 0, pos),
        right
    ];
}

/**
 * Возвращает фрагмент указанного токена
 */
export function sliceToken(token: Token, start: number, end = token.value.length): Token {
    const { value, emoji } = token;
    const result = {
        ...token,
        value: value.slice(start, end),
        emoji: sliceEmoji(emoji, start, end)
    };

    if (result.type === TokenType.Link) {
        // Если достаём фрагмент автоссылки, то убираем это признак
        result.auto = false;
    }

    return result;
}

/**
 * Возвращает список эмоджи, который соответствует указанному диапазону.
 * Если список пустой, то вернёт `undefined` для поддержки контракта с токенами
 */
export function sliceEmoji(emoji: Emoji[] | undefined, from: number, to: number): Emoji[] | undefined {
    if (!emoji) {
        return undefined;
    }

    const result: Emoji[] = [];
    for (let i = 0; i < emoji.length; i++) {
        const e = emoji[i];
        if (e.from >= to) {
            break;
        }

        if (e.from >= from && e.to <= to) {
            result.push(e);
        }
    }

    return result.length ? shiftEmoji(result, -from) : undefined;
}

/**
 * Проверяет, является ли указанный токен сплошным, то есть его разделение на части
 * для форматирования является не желательным
 */
export function isSolidToken(token: Token): boolean {
    return token.type === TokenType.Command
        || token.type === TokenType.HashTag
        || token.type === TokenType.UserSticker
        || token.type === TokenType.Mention
        || (token.type === TokenType.Link && !isCustomLink(token))
}

/**
 * Проверяет, что указанный токен является пользовательской ссылкой, то есть
 * ссылка отличается от содержимого токена
 */
export function isCustomLink(token: Token): token is TokenLink {
    return token.type === TokenType.Link && !token.auto;
}

/**
 * Проверяет, что указанный токен — это автоссылка, то есть автоматически
 * распарсилась из текста
 */
export function isAutoLink(token: Token): token is TokenLink {
    return token.type === TokenType.Link && token.auto;
}

function shiftEmoji(emoji: Emoji[], offset: number): Emoji[] {
    return emoji.map(e => ({
        ...e,
        from: e.from + offset,
        to: e.to + offset
    }));
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Конвертирует указанный токен в текст
 */
export function toText(token: Token, sticky?: boolean): TokenText {
    if (sticky === undefined) {
        sticky = 'sticky' in token ? token.sticky : false;
    }
    return {
        type: TokenType.Text,
        format: token.format,
        value: token.value,
        emoji: token.emoji,
        sticky
    };
}

/**
 * Конвертирует указанный токен в ссылку
 */
export function toLink(token: Token, link: string, sticky?: boolean): TokenLink {
    if (sticky === undefined) {
        sticky = 'sticky' in token ? token.sticky : false;
    }

    return {
        type: TokenType.Link,
        format: token.format,
        value: token.value,
        emoji: token.emoji,
        link,
        auto: false,
        sticky,
    };
}

/**
 * Фабрика объекта-токена
 */
export function createToken(text: string, format: TokenFormat = 0, sticky = false, emoji?: Emoji[]): Token {
    return { type: TokenType.Text, format, value: text, emoji, sticky };
}

export function isSticky(token: Token): boolean {
    return 'sticky' in token && token.sticky;
}
