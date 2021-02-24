/**
 * @description Поглощает URL или E-mail из текстового потока.
 * Особенностью этого консьюмера является то, что при попытке найти URL
 * мы можем поглощать текст, *похожий* на URL, но в итоге им не являющийся.
 * В этом случае консьюмер запишет поглощённую часть в качестве текстового фрагмента,
 * чтобы не повторять лукапы.
 * Для парсинга кое-где используем именования и ограничения из RFC 1738:
 * https://tools.ietf.org/html/rfc1738
 */

import ParserState from './state';
import { consumeTree, createTree } from './tree';
import { ParserOptions } from './types';
import { Codes, consumeArray, isAlpha, isNumber, isWhitespace, isUnicodeAlpha, toCode } from './utils';
import { keycap } from './emoji';
import tld from '../data/tld';
import { TokenType } from '../formatted-string/types';

const enum FragmentMatch {
    /** Фрагмент не найден */
    No = 0,

    /** Результат содержит ASCII-последовательность */
    ASCII = 1 << 0,

    /** Результат содержит точки */
    Dot = 1 << 1,

    /** Результат содержит печатные спецсимволы */
    Printable = 1 << 2,

    /** Результат содержит Unicode-символы */
    Unicode = 1 << 3,

    /** Переполнение размера октета (более 63 символов) */
    OctetOverflow = 1 << 4,

    /** Результат заканчивается на валидный TLD */
    ValidTLD = 1 << 5,
}

const enum ConsumeResult {
    No = 0,
    Yes = 1,
    Skip = 2
}

type Bracket = 'curly' | 'square' | 'round';

const maxLabelSize = 63;
/** Маска для парсинга доменного имени */
const domainMask = FragmentMatch.ASCII | FragmentMatch.Dot | FragmentMatch.Unicode | FragmentMatch.ValidTLD;
const safe = new Set(toCode('$-_.+'));
const extra = new Set(toCode('!*\'()[],'));
const search = new Set(toCode(';:@&='));
const punct = new Set(toCode('!,.;?'));
const mailto = toCode('mailto:');

/**
 * Спецсимволы, допустимые в локальной части email. По спеке там допустимы
 * произвольные значения в кавычках (например, "john doe"@gmail.com), но мы пока
 * такое нее будем обрабатывать
 */
const printable = new Set(toCode('!#$%&*+-/=?^_`{|}~'));

const supportedProtocols = createTree([
    'magnet:',
    'skype://',
    'http://',
    'https://',
    'tamtam://',
    'tt://',
    'tg://',
    'ftp://',
    '//'
]);

/*
 * Счётчик скобок. В данном случае поступаем немного некрасиво: используем
 * один объект на весь парсер, а не выделяем его контекстно. Но таким образом мы
 * сможем немного сэкономить на выделении памяти, так как парсер будет вызываться
 * довольно часто
 */
const brackets: Record<Bracket, number> = {
    round: 0,
    square: 0,
    curly: 0,
};

/**
 * Парсинг ссылок с текущей позиции парсера
 */
export default function parseLink(state: ParserState, options: ParserOptions): boolean {
    if (options.link && state.atWordBound()) {
        const { pos } = state;
        const handled = strictEmail(state) || strictAddress(state) || emailOrAddress(state);

        if (handled === ConsumeResult.No) {
            // Не смогли ничего внятного поглотить, сбросим позицию
            state.pos = pos;
            return false;
        }

        if (handled === ConsumeResult.Skip) {
            // Мы не смогли найти ссылку, но поглотили часть текста, похожего
            // на ссылку. Чтобы заново не парсить этот фрагмент, запишем его как
            // текст
            if (!state.hasPendingText()) {
                state.textStart = pos;
            }
            state.textEnd = state.pos;
        }

        return true;
    }

    return false;
}

/**
 * Поглощает явно указанный email с протоколом `mailto:`
 */
function strictEmail(state: ParserState): ConsumeResult {
    const { pos } = state;
    if (consumeArray(state, mailto)) {
        // Если поглотили протокол, то независимо от работы `email()`
        // вернём `true`, тем самым сохраним `mailto:` в качестве обычного текста,
        // если за ним не следует нормальный e-mail.
        return email(state, fragment(state), pos)
            ? ConsumeResult.Yes
            : ConsumeResult.Skip;
    }

    return ConsumeResult.No;
}

function strictAddress(state: ParserState): ConsumeResult {
    let { pos } = state;
    const start = pos;

    if (consumeTree(state, supportedProtocols)) {
        // Пробуем поглотить доменную часть
        // Так как протокол явно указывает на адрес, доменная часть может быть менее
        // строгой по сравнению с тем, что мы достаём из текста
        pos = state.pos;
        while (fragment(state)) {
            if (!state.consume(isDomainPrefix)) {
                break;
            }
        }

        if (pos !== state.pos) {
            // Как минимум один фрагмент должны поглотить.
            // Если нет — не сбрасываем позицию парсера, сохраним поглощённое как текст
            consumePath(state);
            consumeQueryString(state);
            consumeHash(state);

            const value = state.substring(start);
            state.push({
                type: TokenType.Link,
                format: state.format,
                link: /^\/\//.test(value) ? `http:${value}` : value,
                value
            });
            return ConsumeResult.Yes;
        }

        return ConsumeResult.Skip;
    }

    return ConsumeResult.No;
}

/**
 * Угадывает email или интернет-адрес из текущей позиции потока.
 * @returns `true` если удалось поглотить валидный токен. Если валидного токена
 * нет, _позиция парсера не возвращается_, чтобы сохранить поглощённый фрагмент
 * как обычный текст
 */
function emailOrAddress(state: ParserState): ConsumeResult {
    const { pos } = state;
    const prefix = fragment(state);
    if (email(state, prefix, pos) || address(state, prefix, pos)) {
        return ConsumeResult.Yes;
    }

    return prefix ? ConsumeResult.Skip : ConsumeResult.No;
}

/**
 * Для полученного фрагмент пытается поглотить email. Вернёт `true`, если это
 * удалось сделать
 */
function email(state: ParserState, prefix: FragmentMatch, start: number): boolean {
    if (isEmailLocalPart(prefix) && state.consume(Codes.At)) {
        const domain = fragment(state, domainMask);
        if (isDomain(domain)) {
            consumeQueryString(state);
            const value = state.substring(start);
            state.push({
                type: TokenType.Link,
                format: state.format,
                link: /^mailto:/i.test(value) ? value : `mailto:${value}`,
                value
            });
            return true;
        }

        // Сдвигаемся назад, чтобы вернуть символ @ в поток
        state.pos--;
    }

    return false;
}

/**
 * Для полученного фрагмент пытается поглотить интернет-адрес. Вернёт `true`, если это
 * удалось сделать
 */
function address(state: ParserState, prefix: FragmentMatch, start: number): boolean {
    if (isDomain(prefix)) {
        consumePort(state);
        consumePath(state);
        consumeQueryString(state);
        consumeHash(state);

        const value = state.substring(start);
        let link = value;
        if (!/^[a-z0-9+-.]+:/i.test(link)) {
            link = `http://${link}`;
        }

        state.push({
            type: TokenType.Link,
            format: state.format,
            link,
            value
        });
        return true;
    }

    return false;
}

/**
 * Поглощает фрагмент интернет-адреса и возвращает статистику о нём
 * @param mask Маска, с помощью которой задавать типы, которые можно парсить
 */
function fragment(state: ParserState, mask = 0xffffffff): FragmentMatch {
    const start = state.pos;
    let result: FragmentMatch = 0;
    let labelStart = start;
    let pos: number;

    const _dot = mask & FragmentMatch.Dot;
    const _ascii = mask & FragmentMatch.ASCII;
    const _printable = mask & FragmentMatch.Printable;
    const _unicode = mask & FragmentMatch.Unicode;
    const _tld = mask & FragmentMatch.ValidTLD;

    while (state.hasNext()) {
        pos = state.pos;

        if (keycap(state)) {
            // Нарвались на keycap-эмоджи, прекращаем парсинг
            state.pos = pos;
            break;
        }

        if (_dot && state.consume(Codes.Dot)) {
            if (pos === labelStart) {
                // Лэйбл не может начинаться с точки
                break;
            }
            labelStart = state.pos;
            result |= FragmentMatch.Dot;
        } else {
            if (_ascii && state.consume(isASCII)) {
                result |= FragmentMatch.ASCII;
            } else if (_printable && state.consume(isPrintable)) {
                result |= FragmentMatch.Printable;
            } else if (_unicode && state.consume(isUnicodeAlpha)) {
                result |= FragmentMatch.Unicode;
            } else {
                break;
            }

            if (state.pos - labelStart > maxLabelSize) {
                result |= FragmentMatch.OctetOverflow;
            }
        }
    }

    if (_tld && labelStart !== start && tld.has(state.substring(labelStart).toLowerCase())) {
        result |= FragmentMatch.ValidTLD;
    }

    // Если что-то успешно поглотили, убедимся, что домен заканчивается на известный TLD
    return result;
}

/**
 * Поглощает порт с текущей позиции
 */
function consumePort(state: ParserState): boolean {
    const { pos } = state;
    if (state.consume(Codes.Colon) && state.consumeWhile(isNumber)) {
        return true;
    }

    state.pos = pos;
    return false;
}

/**
 * Поглощает путь в URL: `/path/to/image.png`
 */
function consumePath(state: ParserState): boolean {
    const { pos } = state;

    resetBrackets();
    while (state.consume(Codes.Slash) && segment(state)) {
        // empty
    }

    return state.pos !== pos;
}

/**
 * Поглощает query string с текущей позиции: `?foo=bar&a=b`
 */
function consumeQueryString(state: ParserState): boolean {
    // Разбираем пограничный случай: символ ? может означать
    // как разделитель строки запроса, так и знак вопроса типа
    // `ты заходил на сайт https://tt.me?`
    // Если знак вопроса находится в конце потока или после него есть пробел,
    // то принимаем его как знак вопроса, а не разделитель
    const { pos } = state;
    if (state.consume(Codes.Question) && !atWordEdge(state)) {
        resetBrackets();
        segment(state);
        return true;
    }

    state.pos = pos;
    return false;
}

/**
 * Поглощает хэш из текущей позиции
 */
function consumeHash(state: ParserState): boolean {
    if (state.consume(Codes.Hash)) {
        resetBrackets();
        segment(state);
        return true;
    }

    return false;
}

function segment(state: ParserState): boolean {
    let { pos } = state;
    const start = pos;
    let bracketMatch: ConsumeResult;

    while (state.hasNext()) {
        pos = state.pos;

        if (keycap(state)) {
            // Нарвались на keycap-эмоджи, прекращаем парсинг
            state.pos = pos;
            break;
        }

        if (state.consume(isPunct)) {
            // Определим пограничное состояние: знак препинания в конце URL
            // Это может быть как часть query string, так и терминатор слова:
            // `заходи на ok.ru/?send=1, там много интересного`
            if (atWordEdge(state)) {
                state.pos = pos;
                break;
            }
        } else if (bracketMatch = handleBracket(state)) {
            if (bracketMatch === ConsumeResult.Skip) {
                break;
            }
        } else if (!(uchar(state) || state.consume(isSearch))) {
            break;
        }
    }

    return start !== state.pos;
}

/**
 * https://tools.ietf.org/html/rfc1738
 */
function uchar(state: ParserState): boolean {
    return unreserved(state) || hex(state);
}

/**
 * https://tools.ietf.org/html/rfc1738
 */
function unreserved(state: ParserState): boolean {
    return state.consume(isUnreserved);
}

/**
 * HEX-последовательность в запросе
 * https://tools.ietf.org/html/rfc1738
 */
function hex(state: ParserState): boolean {
    const { pos } = state;
    if (state.consume(Codes.Percent) && state.consume(isHex) && state.consume(isHex)) {
        return true;
    }

    state.pos = pos;
    return false;

}

/**
 * Проверяет, содержи ли `result` биты из `test`
 */
function includes(result: FragmentMatch, test: FragmentMatch): boolean {
    return (result & test) === test;
}

/**
 * Проверяет, что результат `result` не содержит биты из `test`
 */
function excludes(result: FragmentMatch, test: FragmentMatch): boolean {
    return (result & test) === 0;
}

function atWordEdge(state: ParserState): boolean {
    return !state.hasNext() || isWhitespace(state.peek());
}

function isEmailLocalPart(result: FragmentMatch): boolean {
    return excludes(result, FragmentMatch.Unicode | FragmentMatch.OctetOverflow)
        && (includes(result, FragmentMatch.ASCII) || includes(result, FragmentMatch.Printable));
}

function isDomain(result: FragmentMatch): boolean {
    return excludes(result, FragmentMatch.Printable | FragmentMatch.OctetOverflow)
        && includes(result, FragmentMatch.Dot | FragmentMatch.ValidTLD)
        && (includes(result, FragmentMatch.ASCII) || includes(result, FragmentMatch.Unicode));
}

/**
 * Проверяет, что указанный символ является _допустимым_ ASCII-символом для домена
 */
function isASCII(ch: number): boolean {
    return ch === Codes.Hyphen || isAlpha(ch) || isNumber(ch);
}

function isPrintable(ch: number): boolean {
    return printable.has(ch);
}

/**
 * https://tools.ietf.org/html/rfc1738
 */
function isUnreserved(ch: number): boolean {
    // Расхождение с RFC: разрешаем юникодные символы в URL для красоты
    return isUnicodeAlpha(ch) || isNumber(ch) || safe.has(ch) || extra.has(ch);
}

function isHex(ch: number): boolean {
    if (isNumber(ch)) {
        return true;
    }

    ch &= ~32; // quick hack to convert any char code to uppercase char code
    return ch >= 65 && ch <= 70;
}

function isPunct(ch: number): boolean {
    return punct.has(ch);
}

function isSearch(ch: number): boolean {
    return search.has(ch);
}

function isDomainPrefix(ch: number): boolean {
    return ch === Codes.At || ch === Codes.Colon;
}

function resetBrackets() {
    brackets.curly = brackets.round = brackets.square = 0;
}

function handleBracket(state: ParserState): ConsumeResult {
    const ch = state.peek();
    const bracketType = getBracket(ch);
    if (bracketType) {
        const { pos } = state;
        state.pos++;
        if (isOpenBracket(ch)) {
            brackets[bracketType]++;
            return ConsumeResult.Yes;
        } else if (brackets[bracketType] > 0) {
            brackets[bracketType]--;
            return ConsumeResult.Yes;
        } else if (!atWordEdge(state)) {
            // Попали на незакрытую скобку, смотрим, что делать: если она на
            // границе слов, то выносим её за пределы фрагмента
            return ConsumeResult.Yes;
        } else {
            state.pos = pos;
            return ConsumeResult.Skip;
        }
    }

    return ConsumeResult.No;
}

function getBracket(ch: number): Bracket | undefined {
    switch (ch) {
        case Codes.CurlyBracketOpen:
        case Codes.CurlyBracketClose:
            return 'curly';

        case Codes.RoundBracketOpen:
        case Codes.RoundBracketClose:
            return 'round';

        case Codes.SquareBracketOpen:
        case Codes.SquareBracketClose:
            return 'square';
    }
}

function isOpenBracket(ch: number): boolean {
    return ch === Codes.CurlyBracketOpen
        || ch === Codes.RoundBracketOpen
        || ch === Codes.SquareBracketOpen;
}
