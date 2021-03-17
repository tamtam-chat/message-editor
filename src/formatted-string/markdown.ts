import { getText, setFormat, CutText, TokenFormatUpdate, } from '.';
import parse, { ParserOptions, Token, TokenFormat } from '../parser';
import { TokenType } from './types';
import { charToFormat, isStartBoundChar, isEndBoundChar } from '../parser/markdown';

const formats = Array.from(charToFormat.values());
const formatToChar = new Map<TokenFormat, string>();
charToFormat.forEach((v, k) => formatToChar.set(v, String.fromCharCode(k)));

/**
 * Вставляет указанный текст `text` в текстовую позицию `pos` списка токенов
 * @return Обновлённый список токенов
 */
export function mdInsertText(tokens: Token[], pos: number, text: string, options: ParserOptions): Token[] {
    return updateTokens(tokens, text, pos, pos, options);
}

/**
 * Заменяет текст указанной длины в текстовой позиции `pos` на новый `text`
 * @return Обновлённый список токенов
 */
export function mdReplaceText(tokens: Token[], pos: number, len: number, text: string, options: ParserOptions): Token[] {
    return updateTokens(tokens, text, pos, pos + len, options);
}

/**
 * Удаляет текст указанной длины из списка токенов в указанной позиции
 */
export function mdRemoveText(tokens: Token[], pos: number, len: number, options: ParserOptions): Token[] {
    return updateTokens(tokens, '', pos, pos + len, options);
}

/**
 * Вырезает текст из диапазона `from:to` и возвращает его и изменённую строку
 */
export function cutText(tokens: Token[], from: number, to: number, options: ParserOptions): CutText {
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
export function mdSetFormat(tokens: Token[], format: TokenFormatUpdate | TokenFormat, pos: number, len = 0, options: ParserOptions): Token[] {
    // С изменением MD-форматирования немного схитрим: оставим «чистый» набор
    // токенов, без MD-символов, и поменяем ему формат через стандартный `setFormat`.
    // Полученный результат обрамим MD-символами для получения нужного результата
    let offset = 0;
    const filtered = tokens.filter(t => {
        const l = t.value.length;
        if (t.type === TokenType.Markdown) {
            if (offset < pos) {
                pos -= l;
            } else if (offset < pos + len) {
                len -= l;
            }

            return false;
        }

        offset += l;
        return true;
    });

    const updated = setFormat(filtered, format, pos, len);
    let result = ''
    let curFormat = 0;

    /**
     * Стэк символов форматирования. Используется для того, чтобы выводить
     * закрывающие символы форматирования в правильном порядке
     */
    const formatStack: TokenFormat[] = [];

    updated.forEach(t => {
        const diff = curFormat ^ t.format;
        const removed = curFormat & diff;
        const added = t.format & diff;

        if (removed) {
            // Есть форматы, которые надо удалить
            const bound = findEndBound(result);
            const hasBound = bound !== result.length;
            result = result.slice(0, bound)
                + getFormatSymbols(removed, formatStack, true)
                + result.slice(bound);

            if (!added && !hasBound && !isEndBoundChar(t.value.charCodeAt(0))) {
                result += ' ';
            }
        }

        if (added) {
            // Есть форматы, которые надо добавить
            const bound = findStartBound(t.value);
            if (bound === 0 && !isStartBoundChar(result.charCodeAt(result.length - 1))) {
                // Нет чёткой границы для разделения
                result += ' ';
            }

            result += t.value.slice(0, bound)
                + getFormatSymbols(added, formatStack, false)
                + t.value.slice(bound);
        } else {
            result += t.value;
        }

        curFormat = t.format;
    });

    if (curFormat) {
        result += getFormatSymbols(curFormat, formatStack, true);
    }

    return parse(result, options);
}

/**
 * Универсальный метод для обновления списка токенов для markdown-синтаксиса.
 * Из-за некоторых сложностей с инкрементальным обновлением токенов, мы будем
 * просто модифицировать строку и заново её парсить: производительность парсера
 * должно хватить, чтобы делать это на каждое изменение.
 */
function updateTokens(tokens: Token[], value: string, from: number, to: number, options: ParserOptions): Token[] {
    const prevText = getText(tokens);
    const nextText = prevText.slice(0, from) + value + prevText.slice(to);
    return parse(nextText, options);
}

/**
 * Находит границу для завершающего MD-символа для указанного текстового фрагмента
 */
function findEndBound(text: string): number {
    let i = text.length;
    while (i > 0 && isEndBoundChar(text.charCodeAt(i - 1))) {
        i--;
    }

    return i;
}

function findStartBound(text: string): number {
    let i = 0;
    while (i < text.length && isStartBoundChar(text.charCodeAt(i))) {
        i++;
    }

    return i;
}

function getFormatSymbols(format: TokenFormat, stack: TokenFormat[], close: boolean) {
    let result = '';
    if (close) {
        for (let i = stack.length - 1; i >= 0; i--) {
            if (format & stack[i]) {
                result += formatToChar.get(stack[i]);
                stack.splice(i, 1);
            }
        }
    } else {
        for (let i = 0; i < formats.length; i++) {
            if (format & formats[i]) {
                stack.push(formats[i]);
                result += formatToChar.get(formats[i]);
            }
        }
    }

    return result;
}
