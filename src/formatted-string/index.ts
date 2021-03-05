import parse from '../parser';
import { ParserOptions } from '../parser/types';
import { Emoji, Token, TokenFormat, TokenFormatUpdate, TokenLink, TokenType } from './types';

export { Token, TokenFormat, TokenFormatUpdate };

export interface CutText {
    /** Вырезанный фрагмент текста */
    cut: Token[];

    /** Модифицированная строка без вырезанного текста */
    tokens: Token[];
}

interface TokenForPos {
    /** Индекс найденного токена (будет -1, если такой токен не найден) и  */
    index: number;

    /** Текстовое смещение позиции относительно начала токена */
    offset: number;
}

/**
 * Фабрика объекта-токена
 */
export function createToken(text: string, format: TokenFormat = 0, sticky = false, emoji?: Emoji[]): Token {
    return { type: TokenType.Text, format, value: text, emoji, sticky };
}

/**
 * Вставляет указанный текст `text` в текстовую позицию `pos` списка токенов
 * @return Обновлённый список токенов
 */
export function insertText(tokens: Token[], pos: number, text: string, options: ParserOptions): Token[] {
    return updateTokens(tokens, text, pos, pos, options);
}

/**
 * Заменяет текст указанной длины в текстовой позиции `pos` на новый `text`
 * @return Обновлённый список токенов
 */
export function replaceText(tokens: Token[], pos: number, len: number, text: string, options: ParserOptions): Token[] {
    return updateTokens(tokens, text, pos, pos + len, options);
}

/**
 * Удаляет текст указанной длины из списка токенов в указанной позиции
 */
export function removeText(tokens: Token[], pos: number, len: number, options: ParserOptions): Token[] {
    return updateTokens(tokens, '', pos, pos + len, options);
}

/**
 * Вырезает текст из диапазона `from:to` и возвращает его и изменённую строку
 */
export function cutText(tokens: Token[], from: number, to: number, options: ParserOptions): CutText {
    return {
        cut: normalize(slice(tokens, from, to)),
        tokens: removeText(tokens, from, to - from, options)
    };
}

/**
 * Универсальный метод для обновления списка токенов: добавление, удаление и замена
 * текста в списке указанных токенов
 */
function updateTokens(tokens: Token[], value: string, from: number, to: number, options: ParserOptions): Token[] {
    if (!tokens.length) {
        return parse(value, options);
    }

    const start = tokenForPos(tokens, from);
    const end = tokenForPos(tokens, to);

    if (start.index === -1 || end.index === -1) {
        // Такого не должно быть
        console.warn('Invalid location:', { from, to, start, end });
        return tokens;
    }

    const startToken = tokens[start.index];
    const endToken = tokens[end.index];
    const nextValue = startToken.value.slice(0, start.offset)
        + value + endToken.value.slice(end.offset);
    let nextTokens = parse(nextValue, options);

    if (nextTokens.length) {
        // Вставляем/заменяем фрагмент
        // Проверяем пограничные случаи:
        // — начало изменяемого диапазона находится в пользовательской ссылке:
        //   сохраним ссылку
        // — меняем упоминание. Если результат не начинается с упоминания, то считаем,
        //   что пользователь меняет подпись упоминания
        const next = nextTokens[0];
        if (isCustomLink(startToken) || (startToken.type === TokenType.Mention && next.type !== TokenType.Mention)) {
            nextTokens[0] = {
                ...startToken,
                emoji: next.emoji,
                value: next.value,
            };
        }

        nextTokens.forEach(t => t.format = startToken.format);

        // Применяем форматирование из концевых токенов, но только если можем
        // сделать это безопасно: применяем только для текста
        if (startToken.format !== endToken.format) {
            const pos = start.offset + value.length;
            const splitPoint = tokenForPos(nextTokens, pos);
            if (splitPoint.index !== -1 && pos !== nextValue.length && nextTokens.slice(splitPoint.index).every(t => t.type === TokenType.Text)) {
                nextTokens = setFormat(nextTokens, { set: endToken.format }, pos, nextValue.length - pos);
            }
        }
    }

    return normalize([
        ...tokens.slice(0, start.index),
        ...nextTokens,
        ...tokens.slice(end.index + 1)
    ]);
}

/**
 * Возвращает формат для указанной позиции в строке
 */
export function getFormat(tokens: Token[], pos: number): TokenFormat {
    const { index } = tokenForPos(tokens, pos);
    return index !== -1 ? tokens[index].format : 0;
}

/**
 * Выставляет текстовый формат `format` для всех токенов из диапазона `pos, pos + len`.
 * Если `len` не указано, вставляет sticky-метку в указанную позицию `pos`
 */
export function setFormat(tokens: Token[], format: TokenFormatUpdate, pos: number, len = 0): Token[] {
    const start = tokenForPos(tokens, pos);
    if (start.index !== -1) {
        const startToken = tokens[start.index];

        if (!len) {
            // Вставляем sticky-формат в указанную точку
            tokens = applyFormatAt(tokens, start.index, format, start.offset, len);
        } else {
            const end = tokenForPos(tokens, pos + len);
            if (end.index === start.index) {
                // Изменения в пределах одного токена, разделим его
                tokens = applyFormatAt(tokens, start.index, format, start.offset, len);
            } else {
                // Затронули несколько токенов
                tokens = tokens.slice();

                // Обновляем промежуточные токены, пока индексы точные
                for (let i = start.index + 1, nextFormat: TokenFormat; i < end.index; i++) {
                    nextFormat = applyFormat(tokens[i].format, format);
                    if (tokens[i].format !== nextFormat) {
                        tokens[i] = {
                            ...tokens[i],
                            format: nextFormat
                        };
                    }
                }

                tokens = applyFormatAt(tokens, end.index, format, 0, end.offset);
                tokens = applyFormatAt(tokens, start.index, format, start.offset, startToken.value.length - start.offset);
            }
        }

        tokens = normalize(tokens);
    }

    return tokens;
}

/**
 * Возвращает строковое содержимое указанных токенов
 */
export function getText(tokens: Token[]): string {
    return tokens.map(token => token.value).join('');
}

/**
 * Возвращает длину форматированного текста
 */
export function getLength(tokens: Token[]): number {
    return tokens.reduce((acc, token) => acc + token.value.length, 0);
}

/**
 * Возвращает фрагмент строки форматирования
 */
export function slice(tokens: Token[], from: number, to?: number): Token[] {
    if (!tokens.length) {
        return [];
    }

    const fullLen = getLength(tokens);

    if (to == null) {
        to = fullLen;
    } else if (to < 0) {
        to += fullLen;
    }

    if (from < 0) {
        from += fullLen;
    }

    if (from < 0 || from > fullLen || to < 0 || to > fullLen || to < from) {
        throw new Error(`Invalid range: ${from}:${to}`);
    }

    if (from === to) {
        return [];
    }

    const start = tokenForPos(tokens, from);
    const end = tokenForPos(tokens, to);

    if (start.index === end.index) {
        // Получаем фрагмент в пределах одного токена: всегда делаем его текстом
        const t = tokens[start.index];
        return [
            createToken(t.value.slice(start.offset, end.offset), t.format, false, sliceEmoji(t.emoji, start.offset, end.offset))
        ];
    }

    const fromToken = tokens[start.index];
    const toToken = tokens[end.index];

    return normalize([
        createToken(fromToken.value.slice(start.offset), fromToken.format, false, sliceEmoji(fromToken.emoji, start.offset, fromToken.value.length)),
        ...tokens.slice(start.index + 1, end.index),
        createToken(toToken.value.slice(0, end.offset), toToken.format, false, sliceEmoji(toToken.emoji, 0, end.offset))
    ]);
}

/**
 * Применяет изменения формата `update` для токена `tokens[tokenIndex]`,
 * если это необходимо
 */
function applyFormatAt(tokens: Token[], tokenIndex: number, update: TokenFormatUpdate, pos: number, len: number): Token[] {
    const token = tokens[tokenIndex];
    const format = applyFormat(token.format, update);
    if (token.format !== format) {
        // Делим токен на две части. Если это специальный токен типа хэштэга
        // или команды, превратим его в обычный текст
        let nextTokens: Token[];
        const leftEmoji = sliceEmoji(token.emoji, 0, pos);
        const midEmoji = sliceEmoji(token.emoji, pos, pos + len);
        const rightEmoji = sliceEmoji(token.emoji, pos + len, token.value.length);
        const leftText = token.value.slice(0, pos);
        const midText = token.value.slice(pos, pos + len);
        const rightText = token.value.slice(pos + len);
        const sticky = len === 0;

        if (token.type === TokenType.Text || isCustomLink(token)) {
            nextTokens = [
                { ...token, format: token.format, value: leftText, emoji: leftEmoji },
                { ...token, format, value: midText, emoji: midEmoji, sticky },
                { ...token, format: token.format, value: rightText, emoji: rightEmoji },
            ];
        } else {
            nextTokens = [
                createToken(leftText, token.format, false, leftEmoji),
                createToken(midText, format, sticky, midEmoji),
                createToken(rightText, token.format, false, rightEmoji),
            ];
        }

        return normalize([
            ...tokens.slice(0, tokenIndex),
            ...nextTokens,
            ...tokens.slice(tokenIndex + 1),
        ]);
    }

    return tokens;
}

/**
 * Возвращает индекс токена из списка `tokens`, который соответствует указанной
 * позиции текста
 */
export function tokenForPos(tokens: Token[], offset: number): TokenForPos {
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

    return {
        offset: index !== -1 ? adjustOffset(tokens[index], offset) : offset,
        index
    };
}

/**
 * Обновляет обновляет позицию `offset` внутри токена `token` таким образом,
 * чтобы она не попадала на вложенный элемент, например, эмоджи
 */
function adjustOffset(token: Token, offset: number): number {
    if (token.emoji) {
        const { emoji } = token;
        for (let i = 0; i < emoji.length && emoji[i].from < offset; i++) {
            if (emoji[i].to > offset) {
                return emoji[i].to;
            }
        }
    }

    return offset;
}

/**
 * Применяет данные из `update` формату `format`: добавляет и/или удаляет указанные
 * типы форматирования.
 */
function applyFormat(format: TokenFormat, update: TokenFormatUpdate): TokenFormat {
    if (update.set) {
        return update.set;
    }

    if (update.add) {
        format |= update.add;
    }

    if (update.remove) {
        format &= ~update.remove;
    }

    return format;
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
 * Удаляет пустые токены из указанного списка
 */
function filterEmpty(tokens: Token[]): Token[] {
    return tokens.filter(token => token.value || (token.type === TokenType.Text && token.sticky));
}

function normalize(tokens: Token[]): Token[] {
    return joinSimilar(filterEmpty(tokens));
}

/**
 * Проверяет, можно ли объединить два указанных токена в один
 */
function allowJoin(token1: Token, token2: Token): boolean {
    if (token1.type === token2.type && token1.format === token2.format) {
        return (token1.type === TokenType.Link && token1.link === (token2 as TokenLink).link)
            || token1.type === TokenType.Text
    }
}

/**
 * Проверяет, что указанный токен является пользовательской ссылкой, то есть
 * ссылка отличается от содержимого токена
 */
function isCustomLink(token: Token): token is TokenLink {
    return token.type === TokenType.Link && token.link !== token.value;
}

function shiftEmoji(emoji: Emoji[], offset: number): Emoji[] {
    return emoji.map(e => ({
        ...e,
        from: e.from + offset,
        to: e.to + offset
    }));
}

/**
 * Возвращает список эмоджи, который соответствует указанному диапазону.
 * Если список пустой, то вернёт `undefined` для поддержки контракта с токенами
 */
function sliceEmoji(emoji: Emoji[] | undefined, from: number, to: number): Emoji[] | undefined {
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
