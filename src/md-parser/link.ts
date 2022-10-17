import { keycap } from "../parser/emoji";
import { address, consumeHash, consumePath, consumePort, consumeQueryString, ConsumeResult, domainMask, excludes, FragmentMatch, includes, isASCII, isDomain, isEmailLocalPart, isPrintable, linkToken, login, magnet, mailtoChars, maxLabelSize, supportedProtocols } from "../parser/link";
import type ParserState from "../parser/state";
import { Codes, consumeArray, isDelimiter, isUnicodeAlpha } from "../parser/utils";
import { peekClosingMarkdown } from "./markdown";
import tld from '../data/tld';
import { consumeTree } from "../parser/tree";

/**
 * Парсинг ссылок с текущей позиции парсера
 */
 export default function parseLink(state: ParserState): boolean {
    if (state.options.link && state.atWordBound()) {
        const { pos } = state;
        const handled = magnet(state) || strictEmailMD(state) || strictAddressMD(state) || emailOrAddressMD(state);

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
 * Поглощает фрагмент интернет-адреса и возвращает статистику о нём
 * @param mask Маска, с помощью которой задавать типы, которые можно парсить
 */
function fragmentMD(state: ParserState, mask = 0xffffffff): FragmentMatch {
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
 * Поглощает явно указанный email с протоколом `mailto:`
 */
function strictEmailMD(state: ParserState): ConsumeResult {
    const { pos } = state;
    if (consumeArray(state, mailtoChars, true)) {
        // Если поглотили протокол, то независимо от работы `email()`
        // вернём `true`, тем самым сохраним `mailto:` в качестве обычного текста,
        // если за ним не следует нормальный e-mail.
        return emailMD(state, fragmentMD(state), pos)
            ? ConsumeResult.Yes
            : ConsumeResult.Skip;
    }

    return ConsumeResult.No;
}

/**
 * Для полученного фрагмент пытается поглотить email. Вернёт `true`, если это
 * удалось сделать
 */
 function emailMD(state: ParserState, prefix: FragmentMatch, start: number): boolean {
    if (isEmailLocalPart(prefix) && state.consume(Codes.At)) {
        const domain = fragmentMD(state, domainMask);
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

function strictAddressMD(state: ParserState): ConsumeResult {
    let { pos } = state;
    const start = pos;

    if (consumeTree(state, supportedProtocols, true)) {
        // Нашли протокол, далее поглощаем доменную часть.
        // При наличии протокола правила для доменной части будут упрощённые:
        // нам не нужно валидировать результат через `isDomain()`, достаточно
        // получить результат по маске
        const hasLogin = login(state);
        if (fragmentMD(state, domainMask)) {
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
function emailOrAddressMD(state: ParserState): ConsumeResult {
    const { pos } = state;

    // Угадывание ссылки или email хитрое: локальная часть email может конфликтовать
    // с доменом в конце предложения. Например, `ты заходил на ok.ru?`
    // и `ты писал на ok.ru?test@mail.ru`: `ok.ru?` является допустимой локальной
    // частью email, но в первом случае у нас домен, поэтому нужно поглотить только
    // `ok.ru`. С другой стороны, если мы поглотим `ok.ru` для второго примера,
    // мы не увидим оставшуюся часть, которая указывает на email.

    let prefix = fragmentMD(state);
    if (emailMD(state, prefix, pos)) {
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
