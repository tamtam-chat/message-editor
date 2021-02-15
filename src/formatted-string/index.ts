import { Token, TokenFormat, TokenFormatUpdate, TokenType } from './types';

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

type AnyText = string | Token[];

/**
 * Фабрика объекта-токена
 */
export function createToken(text: string, format: TokenFormat = 0, sticky = false): Token {
    return { type: TokenType.Text, value: text, format, sticky };
}

/**
 * Вставляет указанный текст `text` в текстовую позицию `pos` списка токенов
 * @return Обновлённый список токенов
 */
export function insertText(tokens: Token[], pos: number, text: AnyText): Token[] {
    const { offset, index } = tokenForPos(tokens, pos);

    if (index !== -1) {
        if (Array.isArray(text)) {
            // Вставляем отформатированную строку (токены)
            // Делим найденный токен на две части, между ними будем вставлять текст
            const token = tokens[index];
            const left = { ...token, text: token.value.slice(0, offset), sticky: false };
            const right = { ...token, text: token.value.slice(offset), sticky: false };

            // Добавляем всем вставляемым токенам тот же формат, что и в найденном
            text = text.map(t => ({
                ...t, format: t.format | token.format
            }));

            // Объединяем токены вместе и нормализуем
            tokens = tokens.slice(0, index)
                .concat(left, text, right, tokens.slice(index + 1));
            tokens = normalize(tokens);
        } else {
            // Вставляем обычный текст
            const prevText = tokens[index].value;
            tokens = tokens.slice();

            // TODO учесть другие типы токенов и sticky-форматирование

            tokens.splice(index, 1, {
                ...tokens[index],
                value: prevText.slice(0, offset) + text + prevText.slice(offset),
                // sticky: false
            });
        }
    } else {
        tokens = tokens.concat(Array.isArray(text) ? text : createToken(text));
    }

    return tokens;
}

/**
 * Заменяет текст указанной длины в текстовой позиции `pos` на новый `text`
 */
export function replaceText(tokens: Token[], pos: number, len: number, text: AnyText): Token[] {
    return insertText(removeText(tokens, pos, len), pos, text);
}

/**
 * Удаляет текст указанной длины из списка токенов в указанной позиции
 */
export function removeText(tokens: Token[], pos: number, len: number): Token[] {
    const start = tokenForPos(tokens, pos);
    const end = tokenForPos(tokens, pos + len);

    if (start.index !== -1) {
        const startToken = tokens[start.index];
        tokens = tokens.slice();

        if (start.index === end.index) {
            // Удаляем текст внутри одного токена
            tokens.splice(start.index, 1, {
                ...startToken,
                value: startToken.value.slice(0, start.offset) + startToken.value.slice(start.offset + len)
            });
        } else if (end.index !== -1) {
            // Удаление приходится на диапазон токенов
            const endToken = tokens[end.index];
            tokens.splice(start.index, end.index - start.index + 1, {
                ...startToken,
                value: startToken.value.slice(0, start.offset)
            }, {
                ...endToken,
                value: endToken.value.slice(end.offset)
            });
        } else {
            // Не нашли конец: удаляем всё от `start` и до конца
            tokens.splice(start.index, tokens.length - start.index, {
                ...startToken,
                value: startToken.value.slice(0, start.offset)
            });
        }

        tokens = normalize(tokens);
    }

    return tokens;
}

/**
 * Объединяет две форматированный строки в одну
 */
export function joinText(left: AnyText, right: AnyText): Token[] {
    if (typeof left === 'string') {
        left = [createToken(left)];
    }

    if (typeof right === 'string') {
        right = [createToken(right)];
    }

    return normalize(left.concat(right));
}

/**
 * Вырезает текст из диапазона `from:to` и возвращает его и изменённую строку
 */
export function cutText(tokens: Token[], from: number, to: number): CutText {
    return {
        cut: normalize(slice(tokens, from, to)),
        tokens: removeText(tokens, from, to - from)
    };
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
                    if (!equalFormat(tokens[i].format, nextFormat)) {
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

    let fromIx = -1, toIx = -1;

    for (let i = 0, len: number; i < tokens.length; i++) {
        len = tokens[i].value.length;

        if (fromIx === -1) {
            if (from <= len) {
                fromIx = i;
            } else {
                from -= len;
            }
        }

        if (toIx === -1) {
            if (to <= len) {
                toIx = i;
                break;
            } else {
                to -= len;
            }
        }
    }

    if (fromIx === toIx) {
        return normalize([{
            ...tokens[fromIx],
            value: tokens[fromIx].value.slice(from, to)
        }]);
    }

    const fromToken: Token = {
        ...tokens[fromIx],
        value: tokens[fromIx].value.slice(from)
    };

    const toToken: Token = {
        ...tokens[toIx],
        value: tokens[toIx].value.slice(0, to)
    };

    return normalize([
        fromToken,
        ...tokens.slice(fromIx + 1, toIx),
        toToken
    ]);
}

/**
 * Применяет изменения формата `update` для токена `tokens[tokenIndex]`,
 * если это необходимо
 */
function applyFormatAt(tokens: Token[], tokenIndex: number, update: TokenFormatUpdate, pos: number, len: number): Token[] {
    const token = tokens[tokenIndex];
    const format = applyFormat(token.format, update);
    if (!equalFormat(token.format, format)) {
        tokens = tokens.slice();
        tokens.splice(tokenIndex, 1,
            { ...token, value: token.value.slice(0, pos) },
            createToken(token.value.substr(pos, len), format, !len),
            { ...token, value: token.value.slice(pos + len) }
        );

        tokens = normalize(tokens);
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
            // TODO проверить с другими типами токенов
            const nextToken = tokens[i + 1]!;
            if (tokens.length - 1 === i || nextToken.type !== TokenType.Text || !nextToken.sticky) {
                return true;
            }
        }

        offset -= len;
    });

    return { offset, index };
}

/**
 * Применяет данные из `update` формату `format`: добавляет и/или удаляет указанные
 * типы форматирования.
 */
function applyFormat(format: TokenFormat, update: TokenFormatUpdate): TokenFormat {
    if (update.add) {
        format |= update.add;
    }

    if (update.remove) {
        format ^= format & update.remove;
    }

    return format;
}

/**
 * Объединяет соседние токены, если у них одинаковый формат
 */
function joinSimilar(tokens: Token[]): Token[] {
    return tokens.reduce((out, token) => {
        const prev = out[out.length - 1];
        if (prev && equalFormat(prev.format, token.format)) {
            out[out.length - 1] = {
                ...prev,
                text: prev.text + token.value
            };
        } else {
            out.push(token);
        }

        return out;
    }, []);
}

/**
 * Удаляет пустые токены из указанного списка
 */
function filterEmpty(tokens: Token[]): Token[] {
    return tokens.filter(token => token.value || token.type !== TokenType.Text || token.sticky);
}

function normalize(tokens: Token[]): Token[] {
    return joinSimilar(filterEmpty(tokens));
}

/**
 * Проверяет, являются ли два указанных формата одинаковыми
 */
function equalFormat(fmt1: TokenFormat, fmt2: TokenFormat): boolean {
    return fmt1 === fmt2
}
