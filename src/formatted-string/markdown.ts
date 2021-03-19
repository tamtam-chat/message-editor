import { getText, setFormat, CutText, TokenFormatUpdate, } from '.';
import parse, { ParserOptions, Token, TokenFormat } from '../parser';
import { TokenType } from './types';
import { charToFormat, isStartBoundChar, isEndBoundChar } from '../parser/markdown';
import { isCustomLink } from './utils';

export type TextRange = [pos: number, len: number];

interface TextConvertState {
    format: TokenFormat;
    stack: TokenFormat[];
    range?: TextRange;
    link: string;
    output: string;
}

interface MDConverterState {
    offset: number;
    range?: TextRange;
}

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
export function mdCutText(tokens: Token[], from: number, to: number, options: ParserOptions): CutText {
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
    // и заново распарсим
    const range: TextRange = [pos, len];
    const text = mdToText(tokens, range);
    const updated = setFormat(text, format, range[0], range[1]);
    return parse(textToMd(updated, range), options);
}

/**
 * Конвертация MD-токенов в список обычных текстовых токенов
 * @param range Диапазон внутри MD-строки. Если указан, значения параметра будут
 * изменены таким образом, чтобы указывать на ту же самую позицию внутри
 * внутри нового списка токенов
 */
export function mdToText(tokens: Token[], range?: TextRange): Token[] {
    const state: MDConverterState = { offset: 0, range };
    const result: Token[] = [];

    for (let i = 0, token: Token, len: number; i < tokens.length; i++) {
        token = tokens[i];
        len = token.value.length;

        if (token.type === TokenType.Markdown) {
            if (token.format & TokenFormat.LinkLabel) {
                // Начало кастомной ссылки. В этом месте мы знаем, что за токеном
                // следует текст ссылки и сама ссылка, поэтому пройдёмся по токенам
                // вперёд и найдём границу всей ссылки
                const linkBound = findCustomLinkBound(tokens, i);
                convertCustomLink(tokens.slice(i, linkBound), result, state);
                i = linkBound - 1;
            } else {
                adjustTextRange(state, token);
            }
        } else {
            state.offset += len;
            result.push(token);
        }
    }

    return result;
}

/**
 * Конвертация обычных текстовых токенов в MD-строку
 * @param range Диапазон внутри текстовой строки. Если указан, значения параметра будут
 * изменены таким образом, чтобы указывать на ту же самую позицию внутри
 * внутри нового списка токенов
 */
export function textToMd(tokens: Token[], range?: TextRange): string {
    const state: TextConvertState = {
        format: 0,
        stack: [],
        range,
        link: '',
        output: ''
    };
    tokens.forEach(token => textToMdToken(token, state));

    if (state.format) {
        pushSymbols(state, getFormatSymbols(state.format, state, true))
    }

    return state.output;
}

function textToMdToken(token: Token, state: TextConvertState): void {
    let link = '';
    let { format } = token;
    let linkChange = TokenFormat.None;
    let hasLink = 0;
    let bound = 0;
    let hasBound = false;
    let suffix: string;

    if (isCustomLink(token)) {
        format |= TokenFormat.Link;
        link = token.link;
        if (state.link && token.link !== state.link) {
            // Пограничный случай: рядом идут две разные ссылки.
            // Добавим явный признак смены ссылки, чтобы по механике ссылка закрылась
            // и снова открылась
            linkChange = TokenFormat.Link;
        }
    }

    const diff = state.format ^ format;
    const removed = (state.format & diff) | linkChange;
    const added = (format & diff) | linkChange;

    if (removed) {
        // Есть форматы, которые надо удалить
        // В случае, если у нас нет ссылки, нужно найти позицию в тексте, где можем
        // безопасно завершить форматирование
        hasLink = removed & TokenFormat.Link;

        bound = hasLink ? state.output.length : findEndBound(state.output);
        hasBound = bound !== state.output.length;
        suffix = state.output.slice(bound);
        state.output = state.output.slice(0, bound);
        pushSymbols(state, getFormatSymbols(removed, state, true));
        state.output += suffix;

        if (!added && !hasLink && !hasBound && !isEndBoundChar(token.value.charCodeAt(0))) {
            pushSymbols(state, ' ');
        }
    }

    if (added) {
        // Есть форматы, которые надо добавить
        hasLink = added & TokenFormat.Link;

        if (hasLink) {
            bound = 0;
            state.link = link;
        } else {
            bound = findStartBound(token.value);
        }

        if (bound === 0 && !hasLink && !isStartBoundChar(state.output.charCodeAt(state.output.length - 1))) {
            // Нет чёткой границы для разделения
            pushSymbols(state, ' ');
        }

        state.output += token.value.slice(0, bound);
        pushSymbols(state, getFormatSymbols(added, state, false));
        state.output += token.value.slice(bound);
    } else {
        state.output += token.value;
    }

    state.format = format;
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

/**
 * Возвращает набор открывающих или закрывающих MD-символов для указанного формата
 */
function getFormatSymbols(format: TokenFormat, state: TextConvertState, close: boolean) {
    let result = '';
    const { stack } = state;

    if (close) {
        for (let i = stack.length - 1; i >= 0; i--) {
            if (format & stack[i]) {
                result += formatToChar.get(stack[i]);
                stack.splice(i, 1);
            }
        }

        if ((format & TokenFormat.Link) && state.link) {
            result += `](${state.link})`;
            state.link = '';
        }
    } else {
        if (format & TokenFormat.Link) {
            result += '[';
        }

        for (let i = 0; i < formats.length; i++) {
            if (format & formats[i]) {
                stack.push(formats[i]);
                result += formatToChar.get(formats[i]);
            }
        }
    }

    return result;
}

/**
 * Вспомогательная функция, которая конвертирует кастомную MD-ссылку в обычную
 */
function convertCustomLink(customLink: Token[], output: Token[], state: MDConverterState): void {
    // Структура кастомной ссылки:
    // '[', ...label, ']', '(', link, ')'
    if (customLink.length) {
        const linkToken = customLink[customLink.length - 2];
        const link = linkToken.value;

        customLink.slice(0, -4).forEach(token => {
            if (token.type === TokenType.Markdown) {
                adjustTextRange(state, token);
            } else {
                output.push({
                    type: TokenType.Link,
                    format: token.format & (~TokenFormat.LinkLabel),
                    value: token.value,
                    auto: false,
                    emoji: token.emoji,
                    link,
                    sticky: false
                });
                state.offset += token.value.length;
            }
        });

        if (state.range) {
            customLink.slice(-4).forEach(token => adjustTextRange(state, token));
        }
    }
}

/**
 * Находит конец кастомной ссылки в списке токенов, начиная с позиции `start`
 */
function findCustomLinkBound(tokens: Token[], start: number): number {
    let linkFound = false;
    let token: Token;

    while (start < tokens.length) {
        token = tokens[start++];
        if (token.type === TokenType.Markdown && (token.format & TokenFormat.Link)) {
            if (linkFound) {
                return start;
            }
            linkFound = true;
        }
    }
}

function adjustTextRange(state: MDConverterState, token: Token): void {
    const { range, offset } = state;
    if (range) {
        if (offset < range[0]) {
            range[0] -= token.value.length;
        } else if (offset < range[0] + range[1]) {
            // state.range[1] -= token.value.length;
            // Может быть такое, что диапазон находится внутри удаляемых токенов.
            // Как минимум нам надо сохранить фиксированную часть
            const fixed = offset - range[0];
            state.range[1] = fixed + Math.max(0, range[1] - fixed - token.value.length);
        }
    }
}

function pushSymbols(state: TextConvertState, value: string): void {
    const { range } = state;
    if (range) {
        const len = state.output.length;
        if (len <= range[0]) {
            range[0] += value.length;
        } else if (len < range[0] + range[1]) {
            range[1] += value.length;
        }
    }

    state.output += value;
}
