/**
 * @description Поглощает URL или E-mail из текстового потока.
 * Особенностью этого консьюмера является то, что при попытке найти URL
 * мы можем поглощать текст, *похожий* на URL, но в итоге им не являющийся.
 * В этом случае консьюмер запишет поглощённую часть в качестве текстового фрагмента,
 * чтобы не повторять лукапы.
 * Для парсинга кое-где используем именования и ограничения из RFC 1738:
 * https://tools.ietf.org/html/rfc1738
 */

import ParserState, { Bracket } from './state';
import { consumeTree, createTree } from './tree';
import { Codes, consumeArray, isAlpha, isNumber, isWhitespace, isUnicodeAlpha, isDelimiter, toCode } from './utils';
import { keycap } from './emoji';
import { TokenFormat, TokenLink, TokenType } from './types';
import { peekClosingMarkdown } from './markdown';
import tld from '../data/tld';

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

    /** Печатные спецсимволы находятся в конце */
    TrailingPrintable = 1 << 6,

    /** Печатные спецсимволы находятся в середине */
    MiddlePrintable = 1 << 7,
}

const enum ConsumeResult {
    No = 0,
    Yes = 1,
    Skip = 2
}

const maxLabelSize = 63;
/** Маска для парсинга доменного имени */
const domainMask = FragmentMatch.ASCII | FragmentMatch.Dot | FragmentMatch.Unicode | FragmentMatch.ValidTLD;
const safeChars = new Set(toCode('$-_.+'));
const extraChars = new Set(toCode('!*\'()[],'));
const searchChars = new Set(toCode(';:@&='));
const punctChars = new Set(toCode('!,.;?'));
const mailtoChars = toCode('mailto:', true);
const magnetChars = toCode('magnet:', true);

/**
 * Символы, допустимые в логине. Тут расходимся с RFC: разрешаем `:` для менее строгой
 * валидации
 */
const loginChars = new Set(toCode(';?&=:'));

/**
 * Спецсимволы, допустимые в локальной части email. По спеке там допустимы
 * произвольные значения в кавычках (например, "john doe"@gmail.com), но мы пока
 * такое нее будем обрабатывать.
 * Отличие от RFC:
 * – символы `-` и `_` относим к ASCII, а не printable
 * – исключаем `?`, '#' и `/` из набора, так как неправильно захватятся ссылки
 */
const printableChars = new Set(toCode('!$%&*+=^`{|}~'));

const supportedProtocols = createTree([
    'skype://',
    'http://',
    'https://',
    'tamtam://',
    'tt://',
    'tg://',
    'ftp://',
    '//'
], true);

/**
 * Парсинг ссылок с текущей позиции парсера
 */
export default function parseLink(state: ParserState): boolean {
    if (state.options.link && state.atWordBound()) {
        const { pos } = state;
        const handled = magnet(state) || strictEmail(state) || strictAddress(state) || emailOrAddress(state);

        if (handled === ConsumeResult.No) {
            // Не смогли ничего внятного поглотить, сбросим позицию
            state.pos = pos;
            return false;
        }

        if (handled === ConsumeResult.Skip) {
            // Мы не смогли найти ссылку, но поглотили часть текста, похожего
            // на ссылку. Чтобы заново не парсить этот фрагмент, запишем его как
            // текст
            state.markPending(pos);
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
    if (consumeArray(state, mailtoChars, true)) {
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

    if (consumeTree(state, supportedProtocols, true)) {
        // Нашли протокол, далее поглощаем доменную часть.
        // При наличии протокола правила для доменной части будут упрощённые:
        // нам не нужно валидировать результат через `isDomain()`, достаточно
        // получить результат по маске
        const hasLogin = login(state);
        if (fragment(state, domainMask)) {
            // Если нет — не сбрасываем позицию парсера, сохраним поглощённое как текст
            consumePort(state);
            consumePath(state);
            consumeQueryString(state);
            consumeHash(state);

            const value = state.substring(start);
            state.push(linkToken(value, /^\/\//.test(value) ? `http:${value}` : value));
            return ConsumeResult.Yes;
        } else if (!hasLogin) {
            return ConsumeResult.Skip;
        }

        pos = state.pos;
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

    // Угадывание ссылки или email хитрое: локальная часть email может конфликтовать
    // с доменом в конце предложения. Например, `ты заходил на ok.ru?`
    // и `ты писал на ok.ru?test@mail.ru`: `ok.ru?` является допустимой локальной
    // частью email, но в первом случае у нас домен, поэтому нужно поглотить только
    // `ok.ru`. С другой стороны, если мы поглотим `ok.ru` для второго примера,
    // мы не увидим оставшуюся часть, которая указывает на email.

    let prefix = fragment(state);
    if (email(state, prefix, pos)) {
        return ConsumeResult.Yes;
    }

    // Разберём пограничный случай: если в префиксе содержатся printable-символы
    // только в конце, то откатимся на них назад: есть шанс, что мы поглотили
    // доменное имя со знаками препинания в конце
    if (includes(prefix, FragmentMatch.TrailingPrintable) && excludes(prefix, FragmentMatch.MiddlePrintable)) {
        while (isPrintable(state.peekPrev())) {
            state.pos--;
        }
        prefix &= ~(FragmentMatch.TrailingPrintable | FragmentMatch.Printable);
    }

    if (address(state, prefix, pos)) {
        return ConsumeResult.Yes;
    }

    return prefix ? ConsumeResult.Skip : ConsumeResult.No;
}

function magnet(state: ParserState): ConsumeResult {
    const { pos } = state;
    if (consumeArray(state, magnetChars, true)) {
        consumeQueryString(state);
        const value = state.substring(pos);
        state.push(linkToken(value, value));
        return ConsumeResult.Yes;
    }

    return ConsumeResult.No;
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
            state.push(linkToken(value, /^mailto:/i.test(value) ? value : `mailto:${value}`));
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
        state.push(linkToken(value, !/^[a-z0-9+-.]+:/i.test(value) ? `http://${value}` : value));
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
    let labelEnd = start;
    let pos: number;
    let trailingPrintable = false;

    const _dot = mask & FragmentMatch.Dot;
    const _ascii = mask & FragmentMatch.ASCII;
    const _printable = mask & FragmentMatch.Printable;
    const _unicode = mask & FragmentMatch.Unicode;
    const _tld = mask & FragmentMatch.ValidTLD;

    while (state.hasNext()) {
        pos = state.pos;

        if (keycap(state) || peekClosingMarkdown(state)) {
            // Нарвались на keycap-эмоджи или на закрывающий MD-синтаксис,
            // прекращаем парсинг
            state.pos = pos;
            break;
        }

        if (_printable && state.consume(isPrintable)) {
            result |= FragmentMatch.Printable;
            trailingPrintable = true;
        } else {
            if (_dot && state.consume(Codes.Dot)) {
                if (isDelimiter(state.peek())) {
                    state.pos--;
                    break;
                }
                if (pos === labelStart) {
                    // Лэйбл не может начинаться с точки
                    state.pos = pos;
                    break;
                }
                labelStart = state.pos;
                result |= FragmentMatch.Dot;
            } else if (_ascii && state.consume(isASCII)) {
                result |= FragmentMatch.ASCII;
            } else if (_unicode && state.consume(isUnicodeAlpha)) {
                result |= FragmentMatch.Unicode;
            } else {
                break;
            }

            // Если не сработал `break` внутри текущего блока, значит, мы поглотили
            // допустимый, не-printable символ
            labelEnd = state.pos;
            if (trailingPrintable === true) {
                trailingPrintable = false;
                result |= FragmentMatch.MiddlePrintable;
            }

            if (state.pos - labelStart > maxLabelSize) {
                result |= FragmentMatch.OctetOverflow;
            }
        }
    }

    if (_tld && labelStart !== start && tld.has(state.substring(labelStart, labelEnd).toLowerCase())) {
        result |= FragmentMatch.ValidTLD;
    }

    if (trailingPrintable) {
        result |= FragmentMatch.TrailingPrintable;
    }

    // Если что-то успешно поглотили, убедимся, что домен заканчивается на известный TLD
    return result;
}

/**
 * Поглощает порт с текущей позиции
 */
function consumePort(state: ParserState): boolean {
    const { pos } = state;
    if (state.consume(Codes.Colon)) {
        let start = 0;
        while (state.hasNext()) {
            start = state.pos;
            if (keycap(state)) {
                state.pos = start;
                break;
            }

            if (!state.consume(isNumber)) {
                break;
            }
        }
    }

    if (state.pos - pos > 1) {
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

    state.resetBrackets();
    if (state.consume(Codes.Slash)) {
        segment(state);
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
        state.resetBrackets();
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
        state.resetBrackets();
        segment(state);
        return true;
    }

    return false;
}

/**
 * Поглощает login-часть URL. Из-за того, что login может быть похож на домен,
 * при этом содержать «проблемные» символы, из-за которых результат может быть
 * двойственным, мы либо поглотим login-часть целиком, либо откатимся назад
 */
function login(state: ParserState): boolean {
    // Пример проблемной ситуации:
    // – ты заходил на http://foo?
    // – ты заходил на http://foo?bar@domain.com
    // В первом случае `foo` — это домен, а `?` — это вопросительный знак в предложении,
    // поэтому его нужно проигнорировать и не добавлять в домен.
    // Во втором случае `foo?bar` — это `username`, и `?` является допустимым
    // значением, а не знаком препинания в предложении.
    // `login` мы будем поглощать до тех пор, пока не встретим символ `@`.
    // Если его не встретим, то откатываемся назад
    const { pos } = state;
    while (uchar(state) || state.consumeWhile(isLogin)) {
        // pass
    }

    if (pos !== state.pos && state.consume(Codes.At)) {
        return true;
    }

    state.pos = pos;
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
        } else if (!(uchar(state) || state.consume(isSearch) || state.consume(Codes.Percent) || state.consume(Codes.Slash))) {
            break;
        }
    }

    return start !== state.pos;
}

/**
 * https://tools.ietf.org/html/rfc1738
 */
function uchar(state: ParserState): boolean {
    return hex(state) || state.consume(isUnreserved);
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
 * Проверяет, содержи ли `result` все биты из `test`
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
        && ((result & (FragmentMatch.ASCII | FragmentMatch.Unicode)) !== 0);
}

/**
 * Проверяет, что указанный символ является _допустимым_ ASCII-символом для домена
 */
function isASCII(ch: number): boolean {
    return ch === Codes.Hyphen
        // Согласно RFC подчёркивание не является допустимым ASCII, но по факту
        // этот символ может использоваться в доменах третьего уровня
        || ch === Codes.Underscore
        || isAlpha(ch)
        || isNumber(ch);
}

function isPrintable(ch: number): boolean {
    return printableChars.has(ch);
}

/**
 * https://tools.ietf.org/html/rfc1738
 */
function isUnreserved(ch: number): boolean {
    // Расхождение с RFC: разрешаем юникодные символы в URL для красоты
    return isUnicodeAlpha(ch) || isNumber(ch) || safeChars.has(ch) || extraChars.has(ch);
}

function isHex(ch: number): boolean {
    if (isNumber(ch)) {
        return true;
    }

    ch &= ~32; // quick hack to convert any char code to uppercase char code
    return ch >= 65 && ch <= 70;
}

function isPunct(ch: number): boolean {
    return punctChars.has(ch);
}

function isSearch(ch: number): boolean {
    return searchChars.has(ch);
}

function handleBracket(state: ParserState): ConsumeResult {
    const ch = state.peek();
    const bracketType = getBracket(ch);
    if (bracketType) {
        const { pos } = state;
        state.pos++;
        if (isOpenBracket(ch)) {
            state.brackets[bracketType]++;
            return ConsumeResult.Yes;
        } else if (state.brackets[bracketType] > 0) {
            state.brackets[bracketType]--;
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

function isLogin(ch: number) {
    return loginChars.has(ch);
}

function linkToken(value: string, link: string): TokenLink {
    return {
        type: TokenType.Link,
        format: TokenFormat.None,
        value,
        link,
        auto: true,
        sticky: false
    };
}
