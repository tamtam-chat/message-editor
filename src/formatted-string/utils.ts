import { Token } from '../parser';
import { Emoji, TokenLink, TokenType } from './types';

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
            const nextToken = tokens[i + 1]!;
            if (tokens.length - 1 === i || nextToken.type !== TokenType.Text || !nextToken.sticky) {
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
 * Нормализация списка токенов: объединяет несколько смежных токенов в один, если
 * это возможно
 */
export function normalize(tokens: Token[]): Token[] {
    return joinSimilar(filterEmpty(tokens));
}

/**
 * Делит токен на две части в указанной позиции
 */
export function splitToken<T extends Token>(token: T, pos: number): [T, T] {
    const { value, emoji } = token;
    pos = clamp(pos, 0, value.length);

    const left: T = {
        ...token,
        value: value.slice(0, pos),
        emoji: sliceEmoji(emoji, 0, pos)
    };
    const right: T = {
        ...token,
        value: value.slice(pos),
        emoji: sliceEmoji(emoji, pos, token.value.length)
    };

    return [left, right];
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

/**
 * Удаляет пустые токены из указанного списка
 */
function filterEmpty(tokens: Token[]): Token[] {
    return tokens.filter(token => token.value || (token.type === TokenType.Text && token.sticky));
}

/**
 * Объединяет соседние токены, если это можно сделать безопасно
 */
function joinSimilar(tokens: Token[]): Token[] {
    return tokens.reduce((out, token) => {
        let prev = out[out.length - 1];
        if (prev && allowJoin(prev, token)) {
            prev = { ...prev };

            if (token.emoji) {
                const nextEmoji = shiftEmoji(token.emoji, prev.value.length);
                prev.emoji = prev.emoji ? prev.emoji.concat(nextEmoji) : nextEmoji;
            }

            prev.value += token.value;
            out[out.length - 1] = prev;
        } else {
            out.push(token);
        }

        return out;
    }, [] as Token[]);
}

/**
 * Проверяет, можно ли объединить два указанных токена в один
 */
function allowJoin(token1: Token, token2: Token): boolean {
    if (token1.type === token2.type && token1.format === token2.format) {
        return (token1.type === TokenType.Link && token1.link === (token2 as TokenLink).link && isCustomLink(token1) && isCustomLink(token2))
            || token1.type === TokenType.Text;
    }
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
