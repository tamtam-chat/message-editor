import parse, { getText, getLength, normalize, TokenType } from '../parser';
import type { ParserOptions, Emoji, Token, TokenFormat, TokenLink, TokenText } from '../parser';
import { mdToText, textToMd } from './markdown';
import type { TokenFormatUpdate, TextRange, CutText } from './types';
import {
    tokenForPos, isSolidToken, isCustomLink, isAutoLink, splitToken,
    LocationType, sliceToken, toLink, toText
} from './utils';

export { mdToText, textToMd, tokenForPos, CutText, TokenFormatUpdate, TextRange }

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
export function insertText(tokens: Token[], pos: number, text: string, options: Partial<ParserOptions>): Token[] {
    return updateTokens(tokens, text, pos, pos, options);
}

/**
 * Заменяет текст указанной длины в текстовой позиции `pos` на новый `text`
 * @return Обновлённый список токенов
 */
export function replaceText(tokens: Token[], pos: number, len: number, text: string, options: Partial<ParserOptions>): Token[] {
    return updateTokens(tokens, text, pos, pos + len, options);
}

/**
 * Удаляет текст указанной длины из списка токенов в указанной позиции
 */
export function removeText(tokens: Token[], pos: number, len: number, options: Partial<ParserOptions>): Token[] {
    return updateTokens(tokens, '', pos, pos + len, options);
}

/**
 * Вырезает текст из диапазона `from:to` и возвращает его и изменённую строку
 */
export function cutText(tokens: Token[], from: number, to: number, options: Partial<ParserOptions>): CutText {
    return {
        cut: normalize(slice(tokens, from, to)),
        tokens: removeText(tokens, from, to - from, options)
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
 * @param breakSolid Применять форматирование внутри «сплошных» токенов, то есть
 * можно один сплошной токен разделить на несколько и указать им разное форматирование
 */
export function setFormat(tokens: Token[], format: TokenFormatUpdate | TokenFormat, pos: number, len = 0, breakSolid?: boolean): Token[] {
    const start = tokenForPos(tokens, pos, LocationType.Start, !breakSolid);
    const end = tokenForPos(tokens, pos + len, LocationType.End, !breakSolid);

    if (start.index === -1 || end.index === -1) {
        // Невалидные данные, ничего не делаем
        return tokens;
    }

    const startToken = tokens[start.index];

    if (end.index === start.index) {
        if (end.offset === start.offset) {
            // Вставляем sticky-формат в указанную точку
            tokens = applyFormatAt(tokens, start.index, format, start.offset, 0);
        } else {
            // Изменения в пределах одного токена, разделим его
            tokens = applyFormatAt(tokens, start.index, format, start.offset, end.offset - start.offset);
        }
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

        // Убедимся, что границы позиций не находились на границах токенов,
        // иначе поставим sticky-форматирование
        if (end.offset !== 0) {
            tokens = applyFormatAt(tokens, end.index, format, 0, end.offset);
        }

        if (start.offset < startToken.value.length) {
            tokens = applyFormatAt(tokens, start.index, format, start.offset, startToken.value.length - start.offset);
        }
    }

    return normalize(tokens);
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
        console.warn(`Invalid range: ${from}:${to}. Max length: ${fullLen}`);
        return [];
    }

    if (from === to) {
        return [];
    }

    const start = tokenForPos(tokens, from, LocationType.Start);
    const end = tokenForPos(tokens, to, LocationType.End);

    if (start.index === end.index) {
        // Получаем фрагмент в пределах одного токена
        return [
            expandToken(sliceToken(tokens[start.index], start.offset, end.offset))
        ];
    }

    const [, left] = splitToken(tokens[start.index], start.offset);
    const [right, ] = splitToken(tokens[end.index], end.offset);

    return normalize([
        expandToken(left),
        ...tokens.slice(start.index + 1, end.index),
        expandToken(right)
    ]);
}

/**
 * Делает указанный диапазон ссылкой на `link`.
 */
export function setLink(tokens: Token[], link: string | null, pos: number, len = 0): Token[] {
    const start = tokenForPos(tokens, pos, LocationType.Start);
    const end = tokenForPos(tokens, pos + len, LocationType.End);

    if (start.index === -1 || end.index === -1) {
        console.warn('Invalid range:', { pos, len });
        return tokens;
    }

    let token: Token;
    const nextTokens = tokens.slice();

    // Меняем промежуточные токены на ссылки
    for (let i = start.index + 1; i < end.index; i++) {
        nextTokens[i] = toLinkOrText(nextTokens[i], link);
    }

    // Обновляем концевые токены
    if (start.index === end.index) {
        // Попали в один токен
        token = nextTokens[start.index];
        const [left, _mid] = splitToken(token, start.offset);
        const [mid, right] = splitToken(_mid, end.offset - start.offset);
        const next = toLinkOrText(mid, link);
        next.sticky = len === 0;
        nextTokens.splice(start.index, 1, left, next, right);
    } else {
        let left: Token;
        let right: Token;

        token = nextTokens[end.index];
        [left, right] = splitToken(token, end.offset);
        nextTokens.splice(end.index, 1, toLinkOrText(left, link), right);

        token = nextTokens[start.index];
        [left, right] = splitToken(token, start.offset);
        nextTokens.splice(start.index, 1, left, toLinkOrText(right, link));
    }

    return normalize(nextTokens);
}

/**
 * Вставляет указанный текст `text` в текстовую позицию `pos` списка токенов
 * @return Обновлённый список токенов
 */
export function mdInsertText(tokens: Token[], pos: number, text: string, options: Partial<ParserOptions>): Token[] {
    return mdUpdateTokens(tokens, text, pos, pos, options);
}

/**
 * Заменяет текст указанной длины в текстовой позиции `pos` на новый `text`
 * @return Обновлённый список токенов
 */
export function mdReplaceText(tokens: Token[], pos: number, len: number, text: string, options: Partial<ParserOptions>): Token[] {
    return mdUpdateTokens(tokens, text, pos, pos + len, options);
}

/**
 * Удаляет текст указанной длины из списка токенов в указанной позиции
 */
export function mdRemoveText(tokens: Token[], pos: number, len: number, options: Partial<ParserOptions>): Token[] {
    return mdUpdateTokens(tokens, '', pos, pos + len, options);
}

/**
 * Вырезает текст из диапазона `from:to` и возвращает его и изменённую строку
 */
export function mdCutText(tokens: Token[], from: number, to: number, options: Partial<ParserOptions>): CutText {
    return {
        cut: parse(getText(tokens).slice(from, to), options),
        tokens: mdRemoveText(tokens, from, to - from, options)
    };
}

/**
 * Выставляет текстовый формат `format` для всех токенов из диапазона `pos, pos + len`.
 * Если `len` не указано, вставляет sticky-метку в указанную позицию `pos`
 * @param breakSolid Применять форматирование внутри «сплошных» токенов, то есть
 * можно один сплошной токен разделить на несколько и указать им разное форматирование
 */
export function mdSetFormat(tokens: Token[], format: TokenFormatUpdate | TokenFormat, pos: number, len = 0, options: Partial<ParserOptions>): Token[] {
    // С изменением MD-форматирования немного схитрим: оставим «чистый» набор
    // токенов, без MD-символов, и поменяем ему формат через стандартный `setFormat`.
    // Полученный результат обрамим MD-символами для получения нужного результата
    // и заново распарсим
    const range: TextRange = [pos, len];
    const text = mdToText(tokens, range);
    const updated = setFormat(text, format, range[0], range[1]);
    return parse(textToMd(updated, range), options);
}

/**
 * Универсальный метод для обновления списка токенов: добавление, удаление и замена
 * текста в списке указанных токенов
 */
function updateTokens(tokens: Token[], value: string, from: number, to: number, options: Partial<ParserOptions>): Token[] {
    if (!tokens.length) {
        return parse(value, options);
    }

    const end = tokenForPos(tokens, to, LocationType.End);
    const start = from === to ? end : tokenForPos(tokens, from, LocationType.Start);

    if (start.index === -1 || end.index === -1) {
        // Такого не должно быть
        console.warn('Invalid location:', { from, to, start, end });
        return tokens;
    }

    const prefix = tokens.slice(0, start.index);
    const suffix = tokens.slice(end.index + 1);
    const endToken = tokens[end.index];
    let startToken = tokens[start.index];
    let textBound = start.offset + value.length;
    let nextValue = startToken.value.slice(0, start.offset)
        + value + endToken.value.slice(end.offset);

    // Разбираем пограничный случай: есть автоссылка `mail.ru`, мы дописали в конец
    // `?` – вопрос останется текстом, так как это знак препинания в конце предложения.
    // Но если продолжим писать текст, например, `foo`, то `mail.ru?foo` должен
    // стать ссылкой. Поэтому если текущий токен у нас текст и ему предшествует
    // автоссылка, нужно заново распарсить весь фрагмент со ссылкой
    if (startToken.type === TokenType.Text && start.index > 0 && isAutoLink(tokens[start.index - 1])) {
        startToken = prefix.pop() as TokenLink;
        nextValue = startToken.value + nextValue;
        textBound += startToken.value.length;
        start.index--;
        start.offset = 0;
    }

    let nextTokens = parse(nextValue, options);

    if (nextTokens.length) {
        // Вставляем/заменяем фрагмент
        // Проверяем пограничные случаи:
        // — начало изменяемого диапазона находится в пользовательской ссылке:
        //   сохраним ссылку
        if (isCustomLink(startToken)) {
            const { link } = startToken;
            nextTokens = nextTokens.map(t => toLink(t, link));
        }

        nextTokens.forEach(t => t.format = startToken.format);

        // Применяем форматирование из концевых токенов, но только если можем
        // сделать это безопасно: применяем только для текста
        if (startToken.format !== endToken.format) {
            const splitPoint = tokenForPos(nextTokens, textBound);
            if (splitPoint.index !== -1 && textBound !== nextValue.length && nextTokens.slice(splitPoint.index).every(t => t.type === TokenType.Text)) {
                nextTokens = setFormat(nextTokens, endToken.format, textBound, nextValue.length - textBound);
            }
        }

        if (isCustomLink(endToken) && value) {
            nextTokens = setLink(nextTokens, endToken.link, start.offset, textBound - start.offset);
        }
    }

    return normalize([...prefix, ...nextTokens, ...suffix]);
}

/**
 * Универсальный метод для обновления списка токенов для markdown-синтаксиса.
 * Из-за некоторых сложностей с инкрементальным обновлением токенов, мы будем
 * просто модифицировать строку и заново её парсить: производительность парсера
 * должно хватить, чтобы делать это на каждое изменение.
 */
function mdUpdateTokens(tokens: Token[], value: string, from: number, to: number, options: Partial<ParserOptions>): Token[] {
    const prevText = getText(tokens);
    const nextText = prevText.slice(0, from) + value + prevText.slice(to);
    return parse(nextText, options);
}

/**
 * Применяет изменения формата `update` для токена `tokens[tokenIndex]`,
 * если это необходимо
 */
function applyFormatAt(tokens: Token[], tokenIndex: number, update: TokenFormatUpdate | TokenFormat, pos: number, len: number): Token[] {
    const token = tokens[tokenIndex];
    const format = applyFormat(token.format, update);

    if (token.format === format) {
        // У токена уже есть нужный формат
        return tokens;
    }

    let nextTokens: Token[];

    if (pos === 0 && len === token.value.length) {
        // Частный случай: меняем формат у всего токена
        nextTokens = [{ ...token, format }];
    } else {
        // Делим токен на части. Если это специальный токен типа хэштэга
        // или команды, превратим его в обычный текст
        const [left, _mid] = splitToken(token, pos);
        const [mid, right] = splitToken(_mid, len);
        mid.format = format;

        nextTokens = [left, mid, right];
        if (isSolidToken(token)) {
            nextTokens = nextTokens.map(toText);
        }
        (nextTokens[1] as TokenText).sticky = len === 0;
    }

    return normalize([
        ...tokens.slice(0, tokenIndex),
        ...nextTokens,
        ...tokens.slice(tokenIndex + 1),
    ]);
}



/**
 * Применяет данные из `update` формату `format`: добавляет и/или удаляет указанные
 * типы форматирования.
 * Если в качестве `update` передали сам формат, то он и вернётся
 */
export function applyFormat(format: TokenFormat, update: TokenFormatUpdate | TokenFormat): TokenFormat {
    if (typeof update === 'number') {
        return update;
    }

    if (update.add) {
        format |= update.add;
    }

    if (update.remove) {
        format &= ~update.remove;
    }

    return format;
}

function toLinkOrText(token: Token, link: string | null): TokenLink | TokenText {
    return link ? toLink(token, link) : toText(token);
}

function expandToken(token: Token): TokenText | TokenLink {
    if (token.type === TokenType.Link && !token.auto) {
        return token;
    }

    return toText(token);
}

function getLink(left: Token, right: Token): string | undefined {
    if (isCustomLink(left)) {
        return left.link;
    }

    if (isCustomLink(right)) {
        return right.link;
    }
}
