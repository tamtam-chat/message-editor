import { sliceToken, splitToken, tokenRange, toText } from "../formatted-string/utils";
import parseMD from "../md-parser";
import { getLength, normalize, ParserOptions, Token, TokenFormat, TokenLink, TokenText, TokenType } from "../parser";
import { mdToText, textToMd } from '../md-formatted-string/markdown';
import { getText } from "../editor/update";
import { CutText, setFormat, TextRange, TokenFormatUpdate } from "../formatted-string";
export { mdToText, textToMd }

function expandTokenMD(token: Token): TokenText | TokenLink {
    if (token.type === TokenType.Link) {
        if (!token.auto) {
            return token;
        }

        // Авто-ссылка: проверим её содержимое: если текст соответствует ссылке,
        // то оставим её, иначе превратим в текст
        return parseMD(token.value, { link: true })[0] as TokenText | TokenLink;
    }

    return toText(token);
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

    const [start, end] = tokenRange(tokens, from, to);

    if (start.index === end.index) {
        // Получаем фрагмент в пределах одного токена
        const t = tokens[start.index]
        if (start.offset === 0 && end.offset === t.value.length) {
            // Токен целиком
            return [t];
        }

        return [
            expandTokenMD(sliceToken(tokens[start.index], start.offset, end.offset))
        ];
    }

    const [, left] = splitToken(tokens[start.index], start.offset);
    const [right, ] = splitToken(tokens[end.index], end.offset);

    return normalize([
        expandTokenMD(left),
        ...tokens.slice(start.index + 1, end.index),
        expandTokenMD(right)
    ]);
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
        cut: parseMD(getText(tokens).slice(from, to), options),
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
    return parseMD(textToMd(updated, range), options);
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
    return parseMD(nextText, options);
}
