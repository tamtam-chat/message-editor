var TokenFormat;
(function (TokenFormat) {
    TokenFormat[TokenFormat["None"] = 0] = "None";
    /** Жирный текст */
    TokenFormat[TokenFormat["Bold"] = 1] = "Bold";
    /** Курсивный текст */
    TokenFormat[TokenFormat["Italic"] = 2] = "Italic";
    /** Подчёркнутый текст */
    TokenFormat[TokenFormat["Underline"] = 4] = "Underline";
    /** Перечёркнутый текст */
    TokenFormat[TokenFormat["Strike"] = 8] = "Strike";
    /** Моноширинный текст */
    TokenFormat[TokenFormat["Monospace"] = 16] = "Monospace";
    /** Важный текст/заголовок */
    TokenFormat[TokenFormat["Heading"] = 32] = "Heading";
    /** Красный текст */
    TokenFormat[TokenFormat["Marked"] = 64] = "Marked";
    /** Подсвеченный фрагмент текста */
    TokenFormat[TokenFormat["Highlight"] = 128] = "Highlight";
    /** Текст ссылки в Markdown: `[label]` */
    TokenFormat[TokenFormat["LinkLabel"] = 256] = "LinkLabel";
    /** Ссылка в Markdown: `(example.com)` */
    TokenFormat[TokenFormat["Link"] = 512] = "Link";
})(TokenFormat || (TokenFormat = {}));

const boundPunctuation = new Set([
    34 /* DoubleQuote */, 39 /* SingleQuote */, 59 /* SemiColon */,
    40 /* RoundBracketOpen */, 41 /* RoundBracketClose */,
    91 /* SquareBracketOpen */, 93 /* SquareBracketClose */,
    123 /* CurlyBracketOpen */, 125 /* CurlyBracketClose */,
]);
const punctuation = new Set([
    33 /* Exclamation */, 44 /* Comma */, 46 /* Dot */, 58 /* Colon */, 63 /* Question */,
    45 /* Hyphen */, 8211 /* EnDash */, 8212 /* EmDash */
]);
function isPunctuation(ch) {
    return boundPunctuation.has(ch) || punctuation.has(ch);
}
function isBoundPunctuation(ch) {
    return boundPunctuation.has(ch);
}
function isWhitespace(ch) {
    return ch === 32 /* Space */
        || ch === 160 /* NBSP */
        || ch === 9 /* Tab */;
}
function isNewLine(ch) {
    return ch === 10 /* NewLine */
        || ch === 13 /* Return */
        || ch === 12 /* LineFeed */;
}
function isBound(ch) {
    return ch === undefined
        || ch !== ch /* NaN */
        || isNewLine(ch)
        || isWhitespace(ch);
}
function isDelimiter(ch) {
    return isBound(ch)
        || isBoundPunctuation(ch);
    // || isMarkdown(ch);
}
/**
 * Проверяет, является ли указанный символ стандартным идентификатором: латинские
 * символы, цифры подчёркивание и дефис
 */
function isIdentifier(ch) {
    return ch === 95 /* Underscore */
        || ch === 45 /* Hyphen */
        || isAlphaNumeric(ch);
}
/**
 * Вернёт `true` если из текущей позиции удалось поглотить правильный идентификатор
 */
function consumeIdentifier(state) {
    // Идентификатор обязательно должен начинаться с латинского символа
    if (state.consume(isAlpha)) {
        state.consumeWhile(isIdentifier);
        return true;
    }
    return false;
}
/**
 * Вернёт `true`, если все коды из `arr` были поглощены из текущей позиции потока
 */
function consumeArray(state, arr, ignoreCase) {
    const { pos } = state;
    let ch;
    for (let i = 0; i < arr.length; i++) {
        ch = ignoreCase ? asciiToUpper(state.next()) : state.next();
        if (arr[i] !== ch) {
            state.pos = pos;
            return false;
        }
    }
    return true;
}
function last(arr) {
    if (arr.length > 0) {
        return arr[arr.length - 1];
    }
}
/**
 * Конвертация указанной стоки в список кодов символов
 */
function toCode(str, ignoreCase) {
    const result = [];
    for (let i = 0; i < str.length; i++) {
        result.push(ignoreCase ? asciiToUpper(str.charCodeAt(i)) : str.charCodeAt(i));
    }
    return result;
}
/**
 * Вернёт `true` если указанный код соответствует числу
 */
function isNumber(code) {
    return code > 47 && code < 58;
}
/**
 * Вернёт `true` если указанный код соответствует латинским символам от A до Z
 */
function isAlpha(code) {
    code &= ~32; // quick hack to convert any char code to uppercase char code
    return code >= 65 && code <= 90;
}
/**
 * Вернёт `true` если указанный код соответствует числу или символам A-Z
 */
function isAlphaNumeric(code) {
    return isNumber(code) || isAlpha(code);
}
/**
 * Check if given character code is simple letter of supported alphabets
 */
function isMultiAlpha(code) {
    return isAlpha(code) || // a-zA-Z
        code === 1105 || code === 1025 || // Ёё
        code >= 1040 && code <= 1103 || // Аа-Яя
        code >= 1568 && code <= 1599 || // Arabic and Farsi letters
        code >= 1601 && code <= 1610 || // Arabic letters
        code === 1662 || code === 1670 || code === 1688 || code === 1703 || code === 1705 || code === 1711 || // arabic letters
        code >= 1729 && code <= 1731 || // Arabic letters
        code === 1740 || // Arabic letters
        code >= 1641 && code <= 1776; // Arabic and Persian numbers
}
/**
 * All unicode character set alpha like
 */
function isUnicodeAlpha(code) {
    return isAlpha(code)
        || code >= 880 && code <= 1023 // Greek and Coptic
        || code >= 1024 && code <= 1279 // Cyrillic
        || code >= 1280 && code <= 1327 // Cyrillic Supplementary
        || code >= 1328 && code <= 1423 // Armenian
        || code >= 1424 && code <= 1535 // Hebrew
        || code >= 1536 && code <= 1791 // Arabic
        || code >= 19968 && code <= 40959 // Chinese
        || code >= 1792 && code <= 1871 // Syriac
        || code >= 1920 && code <= 1983 // Thaana
        || code >= 2304 && code <= 2431 // Devanagari
        || code >= 2432 && code <= 2559 // Bengali
        || code >= 2560 && code <= 2687 // Gurmukhi
        || code >= 2688 && code <= 2815 // Gujarati
        || code >= 2816 && code <= 2943 // Oriya
        || code >= 2944 && code <= 3071 // Tamil
        || code >= 3072 && code <= 3199 // Telugu
        || code >= 3200 && code <= 3327 // Kannada
        || code >= 3328 && code <= 3455 // Malayalam
        || code >= 3456 && code <= 3583 // Sinhala
        || code >= 3584 && code <= 3711 // Thai
        || code >= 3712 && code <= 3839 // Lao
        || code >= 3840 && code <= 4095 // Tibetan
        || code >= 4096 && code <= 4255 // Myanmar
        || code >= 4256 && code <= 4351 // Georgian
        || code >= 4352 && code <= 4607 // Hangul Jamo
        || code >= 4608 && code <= 4991 // Ethiopic
        || code >= 5024 && code <= 5119 // Cherokee
        || code >= 5120 && code <= 5759 // Unified
        || code >= 5760 && code <= 5791 // Ogham
        || code >= 5792 && code <= 5887 // Runic
        || code >= 5888 && code <= 5919 // Tagalog
        || code >= 5920 && code <= 5951 // Hanunoo
        || code >= 5952 && code <= 5983 // Buhid
        || code >= 5984 && code <= 6015 // Tagbanwa
        || code >= 6016 && code <= 6143 // Khmer
        || code >= 6144 && code <= 6319 // Mongolian
        || code >= 6400 && code <= 6479 // Limbu
        || code >= 6480 && code <= 6527; // Tai Le
}
function isCommandName(ch) {
    return ch === 95 /* Underscore */ || isNumber(ch) || isMultiAlpha(ch);
}
/**
 * Если указанный код является символом a-z, конвертирует его в верхний регистр
 */
function asciiToUpper(ch) {
    return ch >= 97 && ch <= 122 ? ch & ~32 : ch;
}
/**
 * Нормализация списка токенов: объединяет несколько смежных токенов в один, если
 * это возможно
 */
function normalize(tokens) {
    return joinSimilar(filterEmpty(tokens));
}
/**
 * Возвращает строковое содержимое указанных токенов
 */
function getText(tokens) {
    return tokens.map(token => token.value).join('');
}
/**
 * Возвращает длину форматированного текста
 */
function getLength(tokens) {
    return tokens.reduce((acc, token) => acc + token.value.length, 0);
}
const codePointAt = String.prototype.codePointAt
    ? nativeCodePointAt
    : polyfillCodePointAt;
/**
 * Нативная реализация `String#codePointAt`
 */
function nativeCodePointAt(str, pos) {
    return str.codePointAt(pos);
}
function polyfillCodePointAt(str, pos) {
    const size = str.length;
    if (pos < 0 || pos >= size) {
        return undefined;
    }
    const first = str.charCodeAt(pos);
    if (first >= 0xD800 && first <= 0xDBFF && size > pos + 1) {
        const second = str.charCodeAt(pos + 1);
        if (second >= 0xDC00 && second <= 0xDFFF) {
            return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
        }
    }
    return first;
}
/**
 * Удаляет пустые токены из указанного списка
 */
function filterEmpty(tokens) {
    return tokens.filter(token => token.value || (token.type === "text" /* Text */ && token.sticky));
}
/**
 * Объединяет соседние токены, если это можно сделать безопасно
 */
function joinSimilar(tokens) {
    return tokens.reduce((out, token) => {
        let prev = out[out.length - 1];
        if (prev && allowJoin(prev, token)) {
            prev = Object.assign({}, prev);
            if (token.emoji) {
                const nextEmoji = shiftEmoji(token.emoji, prev.value.length);
                prev.emoji = prev.emoji ? prev.emoji.concat(nextEmoji) : nextEmoji;
            }
            prev.value += token.value;
            out[out.length - 1] = prev;
        }
        else {
            out.push(token);
        }
        return out;
    }, []);
}
/**
 * Проверяет, можно ли объединить два указанных токена в один
 */
function allowJoin(token1, token2) {
    if (token1.type === token2.type && token1.format === token2.format) {
        return (token1.type === "link" /* Link */ && token1.link === token2.link && isCustomLink(token1) && isCustomLink(token2))
            || token1.type === "text" /* Text */;
    }
}
function shiftEmoji(emoji, offset) {
    return emoji.map(e => (Object.assign(Object.assign({}, e), { from: e.from + offset, to: e.to + offset })));
}
/**
 * Проверяет, что указанный токен является пользовательской ссылкой, то есть
 * ссылка отличается от содержимого токена
 */
function isCustomLink(token) {
    return token.type === "link" /* Link */ && !token.auto;
}

class ParserState {
    /**
     * @param text Строка, которую нужно распарсить
     * @param pos Позиция, с которой нужно начинать парсинг
     */
    constructor(str, options, pos = 0) {
        /** Текущий аккумулированный MD-формат  */
        this.format = 0;
        /** Список распаршенных токенов */
        this.tokens = [];
        /** Стэк открытых токенов форматирования */
        this.formatStack = [];
        /** Позиция начала накапливаемого текстового фрагмента */
        this.textStart = -1;
        /** Позиция конца накапливаемого текстового фрагмента */
        this.textEnd = -1;
        /** Список эмоджи для текущего текстового токена */
        this.emoji = [];
        /** Счётчик скобок */
        this.brackets = {
            round: 0,
            square: 0,
            curly: 0,
        };
        this.quote = 0;
        this.string = str;
        this.options = options;
        this.pos = pos;
    }
    /**
     * Возвращает *code point* текущего символа парсера без смещения указателя
     */
    peek() {
        return codePointAt(this.string, this.pos);
    }
    /**
     * Возвращает *code point* текущего символа парсера и смещает указатель
     */
    next() {
        return this.hasNext() ? this.inc(this.peek()) : NaN;
    }
    /**
     * Возвращает код предыдущего символа без смещения указателя
     */
    peekPrev() {
        // XXX в идеале надо учитывать code points, но пока для текущих требований
        // парсера это не надо
        return this.string.charCodeAt(this.pos - 1);
    }
    /**
     * Вернёт `true` если позиция парсера не находится в конце потока и можно ещё
     * с него считывать данные
     */
    hasNext() {
        return this.pos < this.string.length;
    }
    /**
     * Проверяет, есть ли аккумулированный текст в состоянии
     */
    hasPendingText() {
        return this.textStart !== this.textEnd;
    }
    /**
     * Поглощает символ в текущей позиции парсера, если он соответствует `match`.
     * `match` может быть как кодом символа, так и функцией, которая принимает текущий
     * символ и должна вернуть `true` или `false`
     * Вернёт `true` если символ был поглощён
     */
    consume(match) {
        const ch = this.peek();
        const ok = typeof match === 'function' ? match(ch) : ch === match;
        if (ok) {
            this.inc(ch);
        }
        return ok;
    }
    /**
     * Вызывает функцию `consume` до тех пор, пока текущий символ соответствует
     * условию `match`.
     * Вернёт `true` если было поглощение
     */
    consumeWhile(match) {
        const start = this.pos;
        while (this.hasNext() && this.consume(match)) { /* */ }
        return this.pos !== start;
    }
    /**
     * Возвращает подстроку по указанным индексам
     */
    substring(from, to = this.pos) {
        return this.string.substring(from, to);
    }
    /**
     * Добавляет указанный токен в вывод
     */
    push(token) {
        this.flushText();
        this.tokens.push(token);
    }
    /**
     * Добавляет эмоджи для текущего накапливаемого текста
     * @param from Начала эмоджи _относительно всего потока_
     * @param to Конец эмоджи _относительно всего потока_
     * @param emoji Фактический эмоджи
     */
    pushEmoji(from, to, emoji) {
        if (this.textStart === -1) {
            this.textStart = from;
        }
        // Эмоджи добавляем с абсолютной адресацией, но храним с относительной,
        // чтобы можно было доставать из самого токена
        const token = {
            from: from - this.textStart,
            to: to - this.textStart,
        };
        if (emoji != null) {
            token.emoji = emoji;
        }
        this.emoji.push(token);
        this.textEnd = to;
    }
    /**
     * Проверяет, есть ли указанный формат в текущем состоянии
     */
    hasFormat(format) {
        return (this.format & format) === format;
    }
    /**
     * Добавляет указанный тип форматирования в состояние
     */
    addFormat(format) {
        this.format |= format;
    }
    /**
     * Добавляет указанный тип форматирования из состояния
     */
    removeFormat(format) {
        this.format ^= this.format & format;
    }
    /**
     * Поглощает текущий символ как накапливаемый текст
     */
    consumeText() {
        if (this.textStart === -1) {
            this.textStart = this.textEnd = this.pos;
        }
        const ch = this.next();
        if (ch === 39 /* SingleQuote */) {
            this.quote ^= 1 /* Single */;
        }
        else if (ch === 34 /* DoubleQuote */) {
            this.quote ^= 2 /* Double */;
        }
        this.textEnd = this.pos;
    }
    /**
     * Записывает накопленный текстовый токен в вывод
     */
    flushText() {
        if (this.hasPendingText()) {
            // TODO использовать функцию-фабрику для сохранения шэйпа
            const token = {
                type: "text" /* Text */,
                format: TokenFormat.None,
                value: this.substring(this.textStart, this.textEnd),
                sticky: false,
            };
            if (this.emoji.length) {
                token.emoji = this.emoji;
                this.emoji = [];
            }
            this.tokens.push(token);
            this.textStart = this.textEnd = -1;
        }
    }
    hasQuote(quote) {
        return (this.quote & quote) === quote;
    }
    /**
     * Проверяет, находимся ли мы сейчас на границе слов
     */
    atWordBound() {
        // Для указанной позиции нам нужно проверить, что предыдущий символ или токен
        // является границей слов
        const { pos } = this;
        if (pos === 0 || this.isAfterEmoji()) {
            return true;
        }
        if (this.hasPendingText()) {
            return isDelimiter(this.peekPrev());
        }
        const lastToken = last(this.tokens);
        if (lastToken) {
            return lastToken.type === "markdown" /* Markdown */ || lastToken.type === "newline" /* Newline */;
        }
        return false;
    }
    /**
     * Вернёт `true`, если в данный момент находимся сразу после эмоджи
     */
    isAfterEmoji() {
        var _a;
        if (this.hasPendingText()) {
            if (this.emoji.length && last(this.emoji).to === (this.textEnd - this.textStart)) {
                return true;
            }
        }
        else {
            const lastToken = last(this.tokens);
            if (lastToken) {
                if (lastToken.type === "text" /* Text */ && ((_a = lastToken.emoji) === null || _a === void 0 ? void 0 : _a.length)) {
                    // Если в конце текстовый токен, проверим, чтобы он закачивался
                    // на эмоджи
                    const lastEmoji = last(lastToken.emoji);
                    return lastEmoji.to === lastToken.value.length;
                }
            }
        }
        return false;
    }
    markPending(textStart) {
        if (!this.hasPendingText()) {
            this.textStart = textStart;
        }
        this.textEnd = this.pos;
    }
    /**
     * Сброс счётчика скобок
     */
    resetBrackets() {
        this.brackets.curly = this.brackets.round = this.brackets.square = 0;
    }
    /**
     * Смещает указатель на размер указанного кода символ вправо.
     */
    inc(code) {
        this.pos += code > 0xFFFF ? 2 : 1;
        return code;
    }
}

/**
 * Набор одиночных эмоджи в диапазоне от 0x2000 до 0x3300.
 * Генерируется из тест-задачи Generate Low Emoji в test/emoji.js
 */
const emojiLow = new Set([0x203c, 0x2049, 0x2122, 0x2139, 0x2328, 0x23cf, 0x24c2, 0x25b6, 0x25c0, 0x260e, 0x2611, 0x2618, 0x261d, 0x2620, 0x2626, 0x262a, 0x2640, 0x2642, 0x2663, 0x2668, 0x267b, 0x2699, 0x26a7, 0x26c8, 0x26d1, 0x26fd, 0x2702, 0x2705, 0x270f, 0x2712, 0x2714, 0x2716, 0x271d, 0x2721, 0x2728, 0x2744, 0x2747, 0x274c, 0x274e, 0x2757, 0x27a1, 0x27b0, 0x27bf, 0x2b50, 0x2b55, 0x3030, 0x303d, 0x3297, 0x3299]);
/**
 * Вернёт `true`, если удалось прочитать эмоджи из текущей позиции потока
 */
function parseEmoji(state) {
    const { pos } = state;
    if (consumeEmoji(state)) {
        state.pushEmoji(pos, state.pos);
        return true;
    }
    return false;
}
/**
 * Вспомогательный консьюмер для всех эмоджи
 * @param state
 */
function consumeEmoji(state) {
    return keycap(state) || flag(state) || emoji(state) || forcedEmoji(state);
}
/**
 * Поглощает keycap-последовательность.
 * Особенностью keycap-последовательности является то, что она может начинаться
 * с базовых символов, например, цифр, которые после себя содержат специальные
 * коды, указывающие, что символ нужно показать как эмоджи
 */
function keycap(state) {
    const { pos } = state;
    if (state.consume(isKeycapStart)) {
        // Этого символа может не быть
        state.consume(65039 /* Presentation */);
        if (state.consume(0x20e3)) {
            return true;
        }
    }
    state.pos = pos;
    return false;
}
/**
 * поглощает последовательность для флагов
 */
function flag(state) {
    const { pos } = state;
    if (state.consume(isRegionalIndicator) && state.consume(isRegionalIndicator)) {
        return true;
    }
    if (state.consume(0x1f3f4) && state.consume(isTagSequence)) {
        // Частный случай: флаги Англии, Шотландии и Уэльса
        while (state.hasNext()) {
            if (state.consume(917631 /* TagSeqTerm */)) {
                return true;
            }
            if (!state.consume(isTagSequence)) {
                break;
            }
        }
    }
    state.pos = pos;
    return false;
}
/**
 * Поглощает последовательность, которая может быть отображена как эмоджи
 */
function emoji(state) {
    const { pos } = state;
    // Одно изображение эмоджи может быть представлено как несколько самостоятельных
    // эмоджи, соединённых zero-width joiner (ZWJ)
    while (consumeEmojiItem(state)) {
        if (!state.consume(8205 /* ZWJ */)) {
            break;
        }
    }
    if (pos !== state.pos) {
        return true;
    }
    state.pos = pos;
    return false;
}
/**
 * Форсировванный эмоджи: ASCII-символ + указание на представление в виде эмоджи
 */
function forcedEmoji(state) {
    const start = state.pos;
    if (state.next() && state.consume(65039 /* Presentation */)) {
        return true;
    }
    state.pos = start;
    return false;
}
/**
 * Поглощает самостоятельный символ эмоджи в потоке
 */
function consumeEmojiItem(state) {
    const pos = state.pos;
    if (state.consume(isEmoji)) {
        // Полноценный эмоджи: может быть либо самостоятельным, либо
        // с модификатором типа кожи. Также в конце может быть презентационный
        // атрибут
        state.consume(isSkinModifier);
        // NB от Android-клиента может приходить невалидный эмоджи, например:
        // [0x1f3c4, 0x2640, 0xfe0f]
        // Невалидность в данном случае в том, что по спеке перед 0x2640
        // должен быть ZWJ. Попробуем исправить это, поглотив следующий гендерный
        // модификатор
        state.consume(isGenderFlag);
        state.consume(65039 /* Presentation */);
        return true;
    }
    state.pos = pos;
    return false;
}
function isKeycapStart(cp) {
    return cp === 35 /* Hash */
        || cp === 42 /* Asterisk */
        || isNumber(cp);
}
function isRegionalIndicator(cp) {
    return cp >= 0x1f1e6 && cp <= 0x1f1ff;
}
function isSkinModifier(cp) {
    return cp >= 127995 /* SkinModifierFrom */ && cp <= 127999 /* SkinModifierTo */;
}
function isTagSequence(cp) {
    return cp >= 917536 /* TagSeqStart */ && cp <= 917630 /* TagSeqEnd */;
}
function isGenderFlag(cp) {
    return cp === 0x2640 || cp === 0x2642;
}
function isEmoji(cp) {
    return cp === 0x00a9
        || cp === 0x00ae
        // || (cp >= 0x2000 && cp <= 0x3300)
        // Набор одиночных эмоджи в диапазоне от 0x2000 до 0x3300.
        // Генерируется из тест - задачи Generate Low Emoji в test/emoji.js
        || emojiLow.has(cp)
        || (cp >= 0x2194 && cp <= 0x2199)
        || (cp >= 0x21a9 && cp <= 0x21aa)
        || (cp >= 0x231a && cp <= 0x231b)
        || (cp >= 0x23e9 && cp <= 0x23f3)
        || (cp >= 0x23f8 && cp <= 0x23fa)
        || (cp >= 0x25aa && cp <= 0x25ab)
        || (cp >= 0x25fb && cp <= 0x25fe)
        || (cp >= 0x2600 && cp <= 0x2604)
        || (cp >= 0x2614 && cp <= 0x2615)
        || (cp >= 0x2622 && cp <= 0x2623)
        || (cp >= 0x262e && cp <= 0x262f)
        || (cp >= 0x2638 && cp <= 0x263a)
        || (cp >= 0x2648 && cp <= 0x2653)
        || (cp >= 0x265f && cp <= 0x2660)
        || (cp >= 0x2665 && cp <= 0x2666)
        || (cp >= 0x267e && cp <= 0x267f)
        || (cp >= 0x2692 && cp <= 0x2697)
        || (cp >= 0x269b && cp <= 0x269c)
        || (cp >= 0x26a0 && cp <= 0x26a1)
        || (cp >= 0x26aa && cp <= 0x26ab)
        || (cp >= 0x26b0 && cp <= 0x26b1)
        || (cp >= 0x26bd && cp <= 0x26be)
        || (cp >= 0x26c4 && cp <= 0x26c5)
        || (cp >= 0x26ce && cp <= 0x26cf)
        || (cp >= 0x26d3 && cp <= 0x26d4)
        || (cp >= 0x26e9 && cp <= 0x26ea)
        || (cp >= 0x26f0 && cp <= 0x26f5)
        || (cp >= 0x26f7 && cp <= 0x26fa)
        || (cp >= 0x2708 && cp <= 0x270d)
        || (cp >= 0x2733 && cp <= 0x2734)
        || (cp >= 0x2753 && cp <= 0x2755)
        || (cp >= 0x2763 && cp <= 0x2764)
        || (cp >= 0x2795 && cp <= 0x2797)
        || (cp >= 0x2934 && cp <= 0x2935)
        || (cp >= 0x2b05 && cp <= 0x2b07)
        || (cp >= 0x2b1b && cp <= 0x2b1c)
        || (cp >= 0x1e400 && cp <= 0x1f3f)
        || (cp >= 0x1e800 && cp <= 0x1f7ff)
        || (cp >= 0x1ec00 && cp <= 0x1fbff);
}

/**
 * @description Методы для работы с древовидной структурой: из указанного массива
 * строк делаем дерево, для более быстрого лукапа, а также предоставляем функцию
 * для поглощения элемента дерева
 */
/**
 * Создаёт дерево из указанного списка строк
 */
function createTree(items, ignoreCase = false) {
    const root = new Map();
    items.forEach(key => collectTree(root, key, ignoreCase));
    return root;
}
/**
 * Пытается поглотить узел указанного дерева. Вернёт `true`, если удалось поглотить
 * узел: в `state.pos` будет записан конец узла
 */
function consumeTree(state, tree, ignoreCase = false) {
    const { pos } = state;
    let node = tree;
    let ch;
    let entry;
    while (state.hasNext()) {
        ch = state.next();
        if (ignoreCase) {
            ch = asciiToUpper(ch);
        }
        entry = node.get(ch);
        if (entry === true) {
            return true;
        }
        if (entry === undefined) {
            break;
        }
        node = entry;
    }
    state.pos = pos;
    return false;
}
function collectTree(tree, text, ignoreCase, i = 0) {
    let ch = text.charCodeAt(i++);
    if (ignoreCase) {
        ch = asciiToUpper(ch);
    }
    if (i === text.length) {
        tree.set(ch, true);
    }
    else {
        if (!tree.has(ch)) {
            tree.set(ch, new Map());
        }
        collectTree(tree.get(ch), text, ignoreCase, i);
    }
}

var aliases = {
    ':C': '☹️',
    ':c': '☹️',
    ':)': '🙂',
    ':-)': '🙂',
    '<3': '❤️',
    ':(|)': '🐵',
    ':(:)': '🐷',
    '(]:{': '👳',
    '</3': '💔',
    '~@~': '💩',
    ':D': '😀',
    ':-D': '😀',
    '^_^': '😁',
    '=D': '😄',
    ':-@': '😣',
    ':-S': '😖',
    'O:)': '😇',
    'O=)': '😇',
    'O:-)': '😇',
    '}:)': '😈',
    '}=)': '😈',
    '}:-)': '😈',
    ';)': '😉',
    ';-)': '😉',
    '=)': '🙂',
    '^^': '😊',
    'B-)': '😎',
    ':,': '😏',
    ':-,': '😏',
    ':|': '😐',
    '=|': '😐',
    ':-|': '😐',
    '-_-': '😑',
    'u_u': '😔',
    // ':/': '😕',
    '=/': '😕',
    ':-/': '😕',
    ':-\\': '😕',
    ':s': '😖',
    ':-s': '😖',
    ':*': '😗',
    ':-*': '😗',
    ';*': '😘',
    ';-*': '😘',
    '=*': '😚',
    ':p': '😛',
    ':P': '😛',
    ':-p': '😛',
    ':-P': '😛',
    '=p': '😛',
    '=P': '😛',
    ';p': '😜',
    ';P': '😜',
    ';-p': '😜',
    ';-P': '😜',
    ':(': '🙁',
    ':-(': '🙁',
    '=(': '🙁',
    '>:(': '😡',
    ':\'(': '😢',
    '=\'(': '😢',
    'T_T': '😭',
    ';_;': '😭',
    '>.<': '😣',
    '>_<': '😣',
    'D:': '😦',
    ':o': '😮',
    ':O': '😮',
    '=o': '😮',
    '=O': '😮',
    ':-O': '😮',
    ':-o': '😮',
    'o.o': '😮',
    'O.O': '😲',
    'x_x': '😵',
    'X(': '😵',
    'X-(': '😵',
    'X-o': '😵',
    'X-O': '😵',
    ':3': '😸',
    'o/': '🙋',
    '\\o': '🙋',
    '\\m/': '🤘',
    ':-$': '🤐',
    ':$': '🤐',
    '*-)': '😐',
    ':-I': '😠',
    ':I': '😠',
    '8oI': '😡',
    '8o|': '😡',
    '|-)': '😪',
    '(ch)': '😏',
    '(lo)': '😍',
    '(sr)': '😔',
    '|-(': '😴',
    '(y)': '👍',
    '(Y)': '👍',
    '(n)': '👎',
    '(N)': '👎',
    '(H)': '😎',
    '(hu)': '😬',
    '(tr)': '😒',
    '(md)': '😵',
    '(fr)': '😄',
    '(dt)': '😟',
    '(sc)': '😕',
    '(v)': '✌️',
    '(L)': '❤️',
    '(U)': '💔',
    '(K)': '💋',
    '(F)': '🌼',
    '(*)': '⭐',
    '(^)': '🎂',
    '(G)': '🎁',
    '(B)': '🍺',
    '(D)': '🍸',
    '(CC)': '🎂',
    '(pi)': '🍕',
    '(pl)': '🍴',
    '(ic)': '🍦',
    '($)': '💰',
    '(co)': '💻',
    '(so)': '⚽',
    '(te)': '🎾',
    '(nt)': '🎵',
    '(I)': '💡',
    '(E)': '✉️',
    '(Z)': '👦',
    '(X)': '👧',
    '(S)': '🌙',
    '(facepalm)': '🤦‍'
};

const lookup = createTree(Object.keys(aliases));
function parseTextEmoji(state) {
    if (state.options.textEmoji && state.atWordBound()) {
        const { pos } = state;
        // Если нашли совпадение, то убедимся, что оно на границе слов
        if (consumeTree(state, lookup) && isDelimiter(state.peek())) {
            const value = state.substring(pos);
            state.pushEmoji(pos, state.pos, aliases[value] || value);
            return true;
        }
        state.pos = pos;
    }
    return false;
}

const begin = [35, 117]; // #u
const end = [115, 35]; // s#
function parseUserSticker(state) {
    if (state.options.userSticker) {
        const { pos } = state;
        if (consumeArray(state, begin)) {
            while (state.hasNext()) {
                if (consumeArray(state, end)) {
                    const value = state.substring(pos);
                    state.push({
                        type: "user_sticker" /* UserSticker */,
                        format: TokenFormat.None,
                        value,
                        stickerId: value.slice(begin.length, -end.length)
                    });
                    return true;
                }
                else if (!state.consume(isAlphaNumeric)) {
                    break;
                }
            }
        }
        state.pos = pos;
    }
    return false;
}

function parseMention(state) {
    if (state.options.mention && state.atWordBound()) {
        const { pos } = state;
        const consumer = state.options.mention === 'strict'
            ? consumeIdentifier
            : consumeMentionName;
        if (state.consume(64 /* At */)) {
            // Разрешаем поглотить самостоятельный символ `@`, чтобы показывать
            // автокомплит в редакторе
            if (consumer(state) || isDelimiter(state.peek())) {
                const value = state.substring(pos);
                state.push({
                    type: "mention" /* Mention */,
                    format: TokenFormat.None,
                    value,
                    mention: value.slice(1)
                });
                return true;
            }
        }
        state.pos = pos;
    }
    return false;
}
function consumeMentionName(state) {
    // Упоминание является промежуточным токеном, который используется для того,
    // чтобы сгенерировать ссылку (type=Link). Поэтому разрешаем обычный алфавит,
    // чтобы работал поиск по пользователям на UI
    return state.consumeWhile(isMentionName);
}
/**
 * Упоминание является промежуточным
 */
function isMentionName(ch) {
    return isNumber(ch) || isUnicodeAlpha(ch) || ch === 95 /* Underscore */ || ch === 45 /* Hyphen */;
}

function parseCommand(state) {
    if (state.options.command && atWordBound(state.peekPrev())) {
        const { pos } = state;
        if (state.consume(47 /* Slash */)) {
            // Разрешаем поглотить самостоятельный символ `/`, чтобы показывать
            // автокомплит в редакторе
            if (state.consumeWhile(isCommandName) || isDelimiter(state.peek())) {
                const value = state.substring(pos);
                state.push({
                    type: "command" /* Command */,
                    format: TokenFormat.None,
                    value,
                    command: value.slice(1)
                });
                return true;
            }
        }
        state.pos = pos;
    }
    return false;
}
function atWordBound(ch) {
    return ch !== ch || isWhitespace(ch);
}

function parseHashtag(state) {
    if (state.options.hashtag && atHashtagBound(state)) {
        const { pos } = state;
        if (state.consume(35 /* Hash */)) {
            if (state.consumeWhile(isCommandName) || isBound(state.peek())) {
                const value = state.substring(pos);
                state.push({
                    type: "hashtag" /* HashTag */,
                    format: TokenFormat.None,
                    value,
                    hashtag: value.slice(1)
                });
                return true;
            }
        }
        state.pos = pos;
    }
    return false;
}
/**
 * Проверяет, находимся ли мы на границе для хэштегов. В отличие от других токенов,
 * хэштэги можно сцеплять вместе
 */
function atHashtagBound(state) {
    if (state.atWordBound()) {
        return true;
    }
    if (!state.hasPendingText()) {
        const lastToken = last(state.tokens);
        if (lastToken) {
            return lastToken.type === "hashtag" /* HashTag */;
        }
    }
    return false;
}

const charToFormat = new Map([
    [42 /* Asterisk */, TokenFormat.Bold],
    [95 /* Underscore */, TokenFormat.Italic],
    [126 /* Tilde */, TokenFormat.Strike],
    [96 /* BackTick */, TokenFormat.Monospace],
]);
function parseMarkdown(state) {
    if (state.options.markdown) {
        const { pos } = state;
        if (!customLink(state)) {
            if (isStartBound(state)) {
                consumeOpen(state);
            }
            else {
                consumeClose(state);
            }
        }
        return state.pos !== pos;
    }
    return false;
}
/**
 * Возвращает MS-формат для указанного кода
 */
function formatForChar(ch) {
    return charToFormat.get(ch) || TokenFormat.None;
}
function isStartBoundChar(ch) {
    return isBound(ch)
        || ch === 40 /* RoundBracketOpen */
        || ch === 91 /* SquareBracketOpen */
        || ch === 123 /* CurlyBracketOpen */;
}
function isEndBoundChar(ch) {
    return isDelimiter(ch) || isPunctuation(ch);
}
function peekClosingMarkdown(state) {
    if (!state.options.markdown) {
        return false;
    }
    const { pos } = state;
    let format;
    while ((format = formatForChar(state.peek())) && state.hasFormat(format)) {
        state.pos++;
    }
    const result = pos !== state.pos && isEndBound(state);
    state.pos = pos;
    return result;
}
/**
 * Проверяем, находимся ли в позиции, где можем начать MD-форматирование
 */
function isStartBound(state) {
    if (state.pos === 0) {
        // Находимся в самом начале
        return true;
    }
    if (state.hasPendingText()) {
        return isStartBoundChar(state.peekPrev());
    }
    const token = last(state.tokens);
    if ((token === null || token === void 0 ? void 0 : token.type) === "markdown" /* Markdown */ && (token.format & TokenFormat.LinkLabel)) {
        return true;
    }
    return false;
}
function isEndBound(state) {
    return isEndBoundChar(state.peek());
}
/**
 * Пытаемся поглотить начало форматирования
 */
function consumeOpen(state) {
    let nextFormat;
    while (state.hasNext()) {
        nextFormat = formatForChar(state.peek());
        if (nextFormat !== TokenFormat.None && !state.hasFormat(nextFormat)) {
            state.pos++;
            pushOpen(state, mdToken(state, nextFormat));
        }
        else {
            break;
        }
    }
}
/**
 * Пытаемся поглотить конец форматирования
 */
function consumeClose(state) {
    // Поглощение закрывающих токенов чуть сложнее: токен считается закрывающим,
    // если за ним следует граница слова. Поэтому мы сначала накопим потенциальные
    // закрывающие токены, а потом проверим, можем ли их закрыть
    const pending = [];
    const { pos } = state;
    let { format } = state;
    let nextFormat;
    while (state.hasNext()) {
        nextFormat = formatForChar(state.peek());
        if (nextFormat !== TokenFormat.None && (format & nextFormat)) {
            state.pos++;
            format &= ~nextFormat;
            pending.push(mdToken(state, nextFormat));
        }
        else {
            break;
        }
    }
    if (pending.length && isEndBound(state)) {
        for (let i = 0; i < pending.length; i++) {
            pushClose(state, pending[i]);
        }
    }
    else if (pos !== state.pos) {
        state.markPending(pos);
    }
}
function mdToken(state, format) {
    return {
        type: "markdown" /* Markdown */,
        format,
        value: state.substring(state.pos - 1)
    };
}
/**
 * Добавляем в стэк открывающий MD-токен
 */
function pushOpen(state, token) {
    state.push(token);
    state.format |= token.format;
    state.formatStack.push(token);
}
/**
 * Добавляем в стэк закрывающий MD-токен
 */
function pushClose(state, token) {
    state.push(token);
    state.format &= ~token.format;
    // Находим все промежуточные токены до открывающего и добавляем им указанный формат
    const openToken = popOpenToken(state, token);
    if (openToken) {
        // NB: минус 2, потому что добавили закрывающий токен.
        // Закрывающий токен добавляем для того, чтобы скинуть накопленный текст
        let i = state.tokens.length - 2;
        let prevToken;
        while (i >= 0) {
            prevToken = state.tokens[i--];
            prevToken.format |= token.format;
            if (prevToken === openToken) {
                break;
            }
        }
    }
}
/**
 * Возвращает соответствующий открывающий md-токен для указанного закрывающего
 * md-токена
 */
function popOpenToken(state, token) {
    const stack = state.formatStack;
    let i = stack.length - 1;
    while (i >= 0) {
        if (stack[i].format & token.format) {
            return stack.splice(i, 1)[0];
        }
        i--;
    }
}
/**
 * Парсинг кастомной ссылки: `[some label](mail.ru)`
 */
function customLink(state) {
    const { pos } = state;
    if (state.consume(91 /* SquareBracketOpen */)) {
        pushOpen(state, mdToken(state, TokenFormat.LinkLabel));
        return true;
    }
    if (state.consume(93 /* SquareBracketClose */) && (state.format & TokenFormat.LinkLabel)) {
        // Нашли закрывающий токен ссылки: он имеет смысл только в том случае,
        // если за ним сразу следует ссылка в виде `(mail.ru)`
        const closeLabel = mdToken(state, TokenFormat.LinkLabel);
        if (state.consume(40 /* RoundBracketOpen */)) {
            const openLink = mdToken(state, TokenFormat.Link);
            const start = state.pos;
            if (consumeCustomLinkClose(state)) {
                const linkValue = state.substring(start);
                pushClose(state, closeLabel);
                pushOpen(state, openLink);
                state.push({
                    type: "link" /* Link */,
                    format: state.format,
                    value: linkValue,
                    link: linkValue,
                    auto: false,
                    sticky: false,
                });
                state.pos++;
                pushClose(state, mdToken(state, TokenFormat.Link));
                return true;
            }
        }
    }
    state.pos = pos;
    return false;
}
function consumeCustomLinkClose(state) {
    // Cчётчик на случай всякой фигни, чтобы далеко не парсить
    let guard = 2000;
    let ch;
    const { pos } = state;
    while (state.hasNext() && --guard) {
        ch = state.peek();
        if (ch === 41 /* RoundBracketClose */) {
            return true;
        }
        if (isBound(ch)) {
            break;
        }
        state.next();
    }
    state.pos = pos;
    return false;
}

const tld = new Set([
    'abbott',
    'abogado',
    'ac',
    'academy',
    'accountant',
    'accountants',
    'active',
    'actor',
    'ad',
    'ads',
    'adult',
    'ae',
    'aero',
    'af',
    'afl',
    'ag',
    'agency',
    'ai',
    'airforce',
    'al',
    'allfinanz',
    'alsace',
    'am',
    'amsterdam',
    'an',
    'android',
    'ao',
    'apartments',
    'aq',
    'aquarelle',
    'ar',
    'archi',
    'army',
    'arpa',
    'as',
    'asia',
    'associates',
    'at',
    'attorney',
    'au',
    'auction',
    'audio',
    'autos',
    'aw',
    'ax',
    'axa',
    'az',
    'ba',
    'band',
    'bank',
    'bar',
    'barclaycard',
    'barclays',
    'bargains',
    'bauhaus',
    'bayern',
    'bb',
    'bbc',
    'bd',
    'be',
    'beer',
    'berlin',
    'best',
    'bf',
    'bg',
    'bh',
    'bi',
    'bid',
    'bike',
    'bingo',
    'bio',
    'biz',
    'bj',
    'bl',
    'black',
    'blackfriday',
    'bloomberg',
    'blue',
    'bm',
    'bmw',
    'bn',
    'bnpparibas',
    'bo',
    'boats',
    'bond',
    'boo',
    'boutique',
    'bq',
    'br',
    'brussels',
    'bs',
    'bt',
    'budapest',
    'build',
    'builders',
    'business',
    'buzz',
    'bv',
    'bw',
    'by',
    'bz',
    'bzh',
    'ca',
    'cab',
    'cafe',
    'cal',
    'camera',
    'camp',
    'cancerresearch',
    'canon',
    'capetown',
    'capital',
    'caravan',
    'cards',
    'care',
    'career',
    'careers',
    'cartier',
    'casa',
    'cash',
    'casino',
    'cat',
    'catering',
    'cbn',
    'cc',
    'cd',
    'center',
    'ceo',
    'cern',
    'cf',
    'cfd',
    'cg',
    'ch',
    'channel',
    'chat',
    'cheap',
    'chloe',
    'christmas',
    'chrome',
    'church',
    'ci',
    'citic',
    'city',
    'ck',
    'cl',
    'claims',
    'cleaning',
    'click',
    'clinic',
    'clothing',
    'club',
    'cm',
    'cn',
    'co',
    'coach',
    'codes',
    'coffee',
    'college',
    'cologne',
    'com',
    'community',
    'company',
    'computer',
    'condos',
    'construction',
    'consulting',
    'contractors',
    'cooking',
    'cool',
    'coop',
    'country',
    'courses',
    'cr',
    'credit',
    'creditcard',
    'cricket',
    'crs',
    'cruises',
    'cu',
    'cuisinella',
    'cv',
    'cw',
    'cx',
    'cy',
    'cymru',
    'cyou',
    'cz',
    'dabur',
    'dad',
    'dance',
    'date',
    'dating',
    'datsun',
    'day',
    'dclk',
    'de',
    'deals',
    'degree',
    'delivery',
    'democrat',
    'dental',
    'dentist',
    'desi',
    'design',
    'dev',
    'diamonds',
    'diet',
    'digital',
    'direct',
    'directory',
    'discount',
    'dj',
    'dk',
    'dm',
    'dnp',
    'do',
    'docs',
    'doha',
    'domains',
    'doosan',
    'download',
    'durban',
    'dvag',
    'dz',
    'eat',
    'ec',
    'edu',
    'education',
    'ee',
    'eg',
    'eh',
    'email',
    'emerck',
    'energy',
    'engineer',
    'engineering',
    'enterprises',
    'epson',
    'equipment',
    'er',
    'erni',
    'es',
    'esq',
    'estate',
    'et',
    'eu',
    'eurovision',
    'eus',
    'events',
    'everbank',
    'exchange',
    'expert',
    'exposed',
    'express',
    'fail',
    'faith',
    'fan',
    'fans',
    'farm',
    'fashion',
    'feedback',
    'fi',
    'film',
    'finance',
    'financial',
    'firmdale',
    'fish',
    'fishing',
    'fit',
    'fitness',
    'fj',
    'fk',
    'flights',
    'florist',
    'flowers',
    'flsmidth',
    'fly',
    'fm',
    'fo',
    'foo',
    'football',
    'forex',
    'forsale',
    'foundation',
    'fr',
    'frl',
    'frogans',
    'fund',
    'furniture',
    'futbol',
    'ga',
    'gal',
    'gallery',
    'garden',
    'gb',
    'gbiz',
    'gd',
    'gdn',
    'ge',
    'gent',
    'gf',
    'gg',
    'ggee',
    'gh',
    'gi',
    'gift',
    'gifts',
    'gives',
    'gl',
    'glass',
    'gle',
    'global',
    'globo',
    'gm',
    'gmail',
    'gmo',
    'gmx',
    'gn',
    'gold',
    'goldpoint',
    'golf',
    'goo',
    'goog',
    'google',
    'gop',
    'gov',
    'gp',
    'gq',
    'gr',
    'graphics',
    'gratis',
    'green',
    'gripe',
    'gs',
    'gt',
    'gu',
    'guge',
    'guide',
    'guitars',
    'guru',
    'gw',
    'gy',
    'hamburg',
    'hangout',
    'haus',
    'healthcare',
    'help',
    'here',
    'hermes',
    'hiphop',
    'hiv',
    'hk',
    'hm',
    'hn',
    'holdings',
    'holiday',
    'homes',
    'horse',
    'host',
    'hosting',
    'house',
    'how',
    'hr',
    'ht',
    'hu',
    'ibm',
    'id',
    'ie',
    'ifm',
    'il',
    'im',
    'immo',
    'immobilien',
    'in',
    'industries',
    'infiniti',
    'info',
    'ing',
    'ink',
    'institute',
    'insure',
    'int',
    'international',
    'investments',
    'io',
    'iq',
    'ir',
    'irish',
    'is',
    'it',
    'iwc',
    'java',
    'jcb',
    'je',
    'jetzt',
    'jm',
    'jo',
    'jobs',
    'joburg',
    'jp',
    'juegos',
    'kaufen',
    'kddi',
    'ke',
    'kg',
    'kh',
    'ki',
    'kim',
    'kitchen',
    'kiwi',
    'km',
    'kn',
    'koeln',
    'komatsu',
    'kp',
    'kr',
    'krd',
    'kred',
    'kw',
    'ky',
    'kyoto',
    'kz',
    'la',
    'lacaixa',
    'land',
    'lat',
    'latrobe',
    'lawyer',
    'lb',
    'lc',
    'lds',
    'lease',
    'leclerc',
    'legal',
    'lgbt',
    'li',
    'lidl',
    'life',
    'lighting',
    'limited',
    'limo',
    'link',
    'lk',
    'loan',
    'loans',
    'london',
    'lotte',
    'lotto',
    'love',
    'lr',
    'ls',
    'lt',
    'ltda',
    'lu',
    'luxe',
    'luxury',
    'lv',
    'ly',
    'ma',
    'madrid',
    'maif',
    'maison',
    'management',
    'mango',
    'market',
    'marketing',
    'markets',
    'marriott',
    'mc',
    'md',
    'me',
    'media',
    'meet',
    'melbourne',
    'meme',
    'memorial',
    'menu',
    'mf',
    'mg',
    'mh',
    'miami',
    'mil',
    'mini',
    'mk',
    'ml',
    'mm',
    'mma',
    'mn',
    'mo',
    'mobi',
    'moda',
    'moe',
    'monash',
    'money',
    'mormon',
    'mortgage',
    'moscow',
    'motorcycles',
    'mov',
    'movie',
    'mp',
    'mq',
    'mr',
    'ms',
    'msk',
    'mt',
    'mtn',
    'mtpc',
    'mu',
    'museum',
    'mv',
    'mw',
    'mx',
    'my',
    'mz',
    'na',
    'nagoya',
    'name',
    'navy',
    'nc',
    'ne',
    'net',
    'network',
    'neustar',
    'new',
    'news',
    'nexus',
    'nf',
    'ng',
    'ngo',
    'nhk',
    'ni',
    'nico',
    'ninja',
    'nissan',
    'nl',
    'no',
    'np',
    'nr',
    'nra',
    'nrw',
    'ntt',
    'nu',
    'nyc',
    'nz',
    'okinawa',
    'om',
    'one',
    'ong',
    'onl',
    'online',
    'ooo',
    'org',
    'organic',
    'osaka',
    'otsuka',
    'ovh',
    'pa',
    'page',
    'panerai',
    'paris',
    'partners',
    'parts',
    'party',
    'pe',
    'pf',
    'pg',
    'ph',
    'pharmacy',
    'photo',
    'photography',
    'photos',
    'physio',
    'piaget',
    'pics',
    'pictet',
    'pictures',
    'pink',
    'pizza',
    'pk',
    'pl',
    'place',
    'plumbing',
    'plus',
    'pm',
    'pn',
    'pohl',
    'poker',
    'porn',
    'post',
    'pr',
    'praxi',
    'press',
    'pro',
    'prod',
    'productions',
    'prof',
    'properties',
    'property',
    'ps',
    'pt',
    'pub',
    'pw',
    'py',
    'qa',
    'qpon',
    'quebec',
    'racing',
    're',
    'realtor',
    'recipes',
    'red',
    'redstone',
    'rehab',
    'reise',
    'reisen',
    'reit',
    'ren',
    'rentals',
    'repair',
    'report',
    'republican',
    'rest',
    'restaurant',
    'review',
    'reviews',
    'rich',
    'rio',
    'rip',
    'ro',
    'rocks',
    'rodeo',
    'rs',
    'rsvp',
    'ru',
    'ruhr',
    'rw',
    'ryukyu',
    'sa',
    'saarland',
    'sale',
    'samsung',
    'sap',
    'sarl',
    'saxo',
    'sb',
    'sc',
    'sca',
    'scb',
    'schmidt',
    'scholarships',
    'school',
    'schule',
    'schwarz',
    'science',
    'scot',
    'sd',
    'se',
    'services',
    'sew',
    'sexy',
    'sg',
    'sh',
    'shiksha',
    'shoes',
    'shriram',
    'si',
    'singles',
    'site',
    'sj',
    'sk',
    'sky',
    'sl',
    'sm',
    'sn',
    'so',
    'social',
    'software',
    'sohu',
    'solar',
    'solutions',
    'soy',
    'space',
    'spiegel',
    'spreadbetting',
    'sr',
    'ss',
    'st',
    'study',
    'style',
    'su',
    'sucks',
    'supplies',
    'supply',
    'support',
    'surf',
    'surgery',
    'suzuki',
    'sv',
    'sx',
    'sy',
    'sydney',
    'systems',
    'sz',
    'taipei',
    'tatar',
    'tattoo',
    'tax',
    'tc',
    'td',
    'tech',
    'technology',
    'tel',
    'temasek',
    'tennis',
    'tf',
    'tg',
    'th',
    'tickets',
    'tienda',
    'tips',
    'tires',
    'tirol',
    'tj',
    'tk',
    'tl',
    'tm',
    'tn',
    'to',
    'today',
    'tokyo',
    'tools',
    'top',
    'toshiba',
    'tours',
    'town',
    'toys',
    'tp',
    'tr',
    'trade',
    'trading',
    'training',
    'travel',
    'trust',
    'tt',
    'tui',
    'tv',
    'tw',
    'tz',
    'ua',
    'ug',
    'uk',
    'um',
    'university',
    'uno',
    'uol',
    'us',
    'uy',
    'uz',
    'va',
    'vacations',
    'vc',
    've',
    'vegas',
    'ventures',
    'versicherung',
    'vet',
    'vg',
    'vi',
    'viajes',
    'video',
    'villas',
    'vision',
    'vlaanderen',
    'vn',
    'vodka',
    'vote',
    'voting',
    'voto',
    'voyage',
    'vu',
    'wales',
    'wang',
    'watch',
    'webcam',
    'website',
    'wed',
    'wedding',
    'wf',
    'whoswho',
    'wien',
    'wiki',
    'williamhill',
    'win',
    'wme',
    'work',
    'works',
    'world',
    'ws',
    'wtc',
    'wtf',
    'xin',
    '测试',
    'परीक्षा',
    '佛山',
    '慈善',
    '集团',
    '在线',
    '한국',
    'ভারত',
    '八卦',
    'موقع',
    'বাংলা',
    '公益',
    '公司',
    '移动',
    '我爱你',
    'москва',
    'испытание',
    'қаз',
    'онлайн',
    'сайт',
    'срб',
    'бел',
    '时尚',
    '테스트',
    '淡马锡',
    'орг',
    '삼성',
    'சிங்கப்பூர்',
    '商标',
    '商店',
    '商城',
    'дети',
    'мкд',
    'טעסט',
    '中文网',
    '中信',
    '中国',
    '中國',
    '谷歌',
    'భారత్',
    'ලංකා',
    '測試',
    'ભારત',
    'भारत',
    'آزمایشی',
    'பரிட்சை',
    '网店',
    'संगठन',
    '网络',
    'укр',
    '香港',
    'δοκιμή',
    '飞利浦',
    'إختبار',
    '台湾',
    '台灣',
    '手机',
    'мон',
    'الجزائر',
    'عمان',
    'ایران',
    'امارات',
    'بازار',
    'پاکستان',
    'الاردن',
    'بھارت',
    'المغرب',
    'السعودية',
    'سودان',
    'عراق',
    'مليسيا',
    '政府',
    'شبكة',
    'გე',
    '机构',
    '组织机构',
    '健康',
    'ไทย',
    'سورية',
    'рус',
    'рф',
    'تونس',
    'みんな',
    'グーグル',
    '世界',
    'ਭਾਰਤ',
    '网址',
    '游戏',
    'vermögensberater',
    'vermögensberatung',
    '企业',
    '信息',
    'مصر',
    'قطر',
    '广东',
    'இலங்கை',
    'இந்தியா',
    'հայ',
    '新加坡',
    'فلسطين',
    'テスト',
    '政务',
    'xxx',
    'xyz',
    'yachts',
    'yandex',
    'ye',
    'yodobashi',
    'yoga',
    'yokohama',
    'youtube',
    'yt',
    'za',
    'zip',
    'zm',
    'zone',
    'zuerich',
    'zw',
    'xn--p1ai'
]);

/**
 * @description Поглощает URL или E-mail из текстового потока.
 * Особенностью этого консьюмера является то, что при попытке найти URL
 * мы можем поглощать текст, *похожий* на URL, но в итоге им не являющийся.
 * В этом случае консьюмер запишет поглощённую часть в качестве текстового фрагмента,
 * чтобы не повторять лукапы.
 * Для парсинга кое-где используем именования и ограничения из RFC 1738:
 * https://tools.ietf.org/html/rfc1738
 */
const maxLabelSize = 63;
/** Маска для парсинга доменного имени */
const domainMask = 1 /* ASCII */ | 2 /* Dot */ | 8 /* Unicode */ | 32 /* ValidTLD */;
const safeChars = new Set(toCode('$-_.+'));
const extraChars = new Set(toCode('!*"\'()[],|'));
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
function parseLink(state) {
    if (state.options.link && state.atWordBound()) {
        const { pos } = state;
        const handled = magnet(state) || strictEmail(state) || strictAddress(state) || emailOrAddress(state);
        if (handled === 0 /* No */) {
            // Не смогли ничего внятного поглотить, сбросим позицию
            state.pos = pos;
            return false;
        }
        if (handled === 2 /* Skip */) {
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
function strictEmail(state) {
    const { pos } = state;
    if (consumeArray(state, mailtoChars, true)) {
        // Если поглотили протокол, то независимо от работы `email()`
        // вернём `true`, тем самым сохраним `mailto:` в качестве обычного текста,
        // если за ним не следует нормальный e-mail.
        return email(state, fragment(state), pos)
            ? 1 /* Yes */
            : 2 /* Skip */;
    }
    return 0 /* No */;
}
function strictAddress(state) {
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
            return 1 /* Yes */;
        }
        else if (!hasLogin) {
            return 2 /* Skip */;
        }
        pos = state.pos;
    }
    return 0 /* No */;
}
/**
 * Угадывает email или интернет-адрес из текущей позиции потока.
 * @returns `true` если удалось поглотить валидный токен. Если валидного токена
 * нет, _позиция парсера не возвращается_, чтобы сохранить поглощённый фрагмент
 * как обычный текст
 */
function emailOrAddress(state) {
    const { pos } = state;
    // Угадывание ссылки или email хитрое: локальная часть email может конфликтовать
    // с доменом в конце предложения. Например, `ты заходил на ok.ru?`
    // и `ты писал на ok.ru?test@mail.ru`: `ok.ru?` является допустимой локальной
    // частью email, но в первом случае у нас домен, поэтому нужно поглотить только
    // `ok.ru`. С другой стороны, если мы поглотим `ok.ru` для второго примера,
    // мы не увидим оставшуюся часть, которая указывает на email.
    let prefix = fragment(state);
    if (email(state, prefix, pos)) {
        return 1 /* Yes */;
    }
    // Разберём пограничный случай: если в префиксе содержатся printable-символы
    // только в конце, то откатимся на них назад: есть шанс, что мы поглотили
    // доменное имя со знаками препинания в конце
    if (includes(prefix, 64 /* TrailingPrintable */) && excludes(prefix, 128 /* MiddlePrintable */)) {
        while (isPrintable(state.peekPrev())) {
            state.pos--;
        }
        prefix &= ~(64 /* TrailingPrintable */ | 4 /* Printable */);
    }
    if (address(state, prefix, pos)) {
        return 1 /* Yes */;
    }
    return prefix ? 2 /* Skip */ : 0 /* No */;
}
function magnet(state) {
    const { pos } = state;
    if (consumeArray(state, magnetChars, true)) {
        consumeQueryString(state);
        const value = state.substring(pos);
        state.push(linkToken(value, value));
        return 1 /* Yes */;
    }
    return 0 /* No */;
}
/**
 * Для полученного фрагмент пытается поглотить email. Вернёт `true`, если это
 * удалось сделать
 */
function email(state, prefix, start) {
    if (isEmailLocalPart(prefix) && state.consume(64 /* At */)) {
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
function address(state, prefix, start) {
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
function fragment(state, mask = 0xffffffff) {
    const start = state.pos;
    let result = 0;
    let labelStart = start;
    let labelEnd = start;
    let pos;
    let trailingPrintable = false;
    const _dot = mask & 2 /* Dot */;
    const _ascii = mask & 1 /* ASCII */;
    const _printable = mask & 4 /* Printable */;
    const _unicode = mask & 8 /* Unicode */;
    const _tld = mask & 32 /* ValidTLD */;
    while (state.hasNext()) {
        pos = state.pos;
        if (keycap(state) || peekClosingMarkdown(state)) {
            // Нарвались на keycap-эмоджи или на закрывающий MD-синтаксис,
            // прекращаем парсинг
            state.pos = pos;
            break;
        }
        if (_printable && state.consume(isPrintable)) {
            result |= 4 /* Printable */;
            trailingPrintable = true;
        }
        else {
            if (_dot && state.consume(46 /* Dot */)) {
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
                result |= 2 /* Dot */;
            }
            else if (_ascii && state.consume(isASCII)) {
                result |= 1 /* ASCII */;
            }
            else if (_unicode && state.consume(isUnicodeAlpha)) {
                result |= 8 /* Unicode */;
            }
            else {
                break;
            }
            // Если не сработал `break` внутри текущего блока, значит, мы поглотили
            // допустимый, не-printable символ
            labelEnd = state.pos;
            if (trailingPrintable === true) {
                trailingPrintable = false;
                result |= 128 /* MiddlePrintable */;
            }
            if (state.pos - labelStart > maxLabelSize) {
                result |= 16 /* OctetOverflow */;
            }
        }
    }
    if (_tld && labelStart !== start && tld.has(state.substring(labelStart, labelEnd).toLowerCase())) {
        result |= 32 /* ValidTLD */;
    }
    if (trailingPrintable) {
        result |= 64 /* TrailingPrintable */;
    }
    // Если что-то успешно поглотили, убедимся, что домен заканчивается на известный TLD
    return result;
}
/**
 * Поглощает порт с текущей позиции
 */
function consumePort(state) {
    const { pos } = state;
    if (state.consume(58 /* Colon */)) {
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
function consumePath(state) {
    const { pos } = state;
    state.resetBrackets();
    if (state.consume(47 /* Slash */)) {
        segment(state);
    }
    return state.pos !== pos;
}
/**
 * Поглощает query string с текущей позиции: `?foo=bar&a=b`
 */
function consumeQueryString(state) {
    // Разбираем пограничный случай: символ ? может означать
    // как разделитель строки запроса, так и знак вопроса типа
    // `ты заходил на сайт https://tt.me?`
    // Если знак вопроса находится в конце потока или после него есть пробел,
    // то принимаем его как знак вопроса, а не разделитель
    const { pos } = state;
    if (state.consume(63 /* Question */) && !atWordEdge(state)) {
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
function consumeHash(state) {
    if (state.consume(35 /* Hash */)) {
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
function login(state) {
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
    if (pos !== state.pos && state.consume(64 /* At */)) {
        return true;
    }
    state.pos = pos;
    return false;
}
function segment(state) {
    let { pos } = state;
    const start = pos;
    let bracketMatch;
    let ch;
    while (state.hasNext()) {
        pos = state.pos;
        ch = state.peek();
        // Отдельно обрабатываем кавычки: если они есть в предыдущем тексте,
        // то, не делаем их частью ссылки
        if (isQuote(ch)) {
            if (shouldSkipQuote(state, ch)) {
                break;
            }
            state.next();
        }
        else if (state.consume(isPunct)) {
            // Определим пограничное состояние: знак препинания в конце URL
            // Это может быть как часть query string, так и терминатор слова:
            // `заходи на ok.ru/?send=1, там много интересного`
            if (isBound(state.peek())) {
                state.pos = pos;
                break;
            }
        }
        else if (bracketMatch = handleBracket(state)) {
            if (bracketMatch === 2 /* Skip */) {
                break;
            }
        }
        else if (!state.consume(isSegmentChar)) {
            break;
        }
    }
    return start !== state.pos;
}
function isSegmentChar(ch) {
    // По спеке в сегментах может быть ограниченный набор символов, но по факту
    // там может быть что угодно, включая эмоджи, русские символы и т.д.
    return ch > 0 && ch === ch
        && ch !== 63 /* Question */
        && ch !== 35 /* Hash */
        && ch !== 39 /* SingleQuote */
        && ch !== 34 /* DoubleQuote */
        && !isWhitespace(ch)
        && !isNewLine(ch);
}
/**
 * https://tools.ietf.org/html/rfc1738
 */
function uchar(state) {
    return hex(state) || unreserved(state);
}
/**
 * HEX-последовательность в запросе
 * https://tools.ietf.org/html/rfc1738
 */
function hex(state) {
    const { pos } = state;
    if (state.consume(37 /* Percent */) && state.consume(isHex) && state.consume(isHex)) {
        return true;
    }
    state.pos = pos;
    return false;
}
function unreserved(state) {
    // Отдельно обрабатываем кавычки: если они есть в предыдущем тексте,
    // то, не делаем их частью ссылки
    if (shouldSkipQuote(state, state.peek())) {
        return false;
    }
    return state.consume(isUnreserved);
}
function shouldSkipQuote(state, ch) {
    return isQuote(ch) ? state.hasQuote(getQuoteType(ch)) : false;
    // if (isQuote(ch)) {
    //     return state.hasQuote((getQuoteType(ch))) || isSegmentBound(state.peek());
    // }
    // return false;
}
function isQuote(ch) {
    return ch === 39 /* SingleQuote */ || ch === 34 /* DoubleQuote */;
}
function getQuoteType(ch) {
    return ch === 39 /* SingleQuote */ ? 1 /* Single */ : 2 /* Double */;
}
/**
 * Проверяет, содержи ли `result` все биты из `test`
 */
function includes(result, test) {
    return (result & test) === test;
}
/**
 * Проверяет, что результат `result` не содержит биты из `test`
 */
function excludes(result, test) {
    return (result & test) === 0;
}
function atWordEdge(state) {
    const ch = state.peek();
    return isBound(ch) || isPunct(ch);
}
function isEmailLocalPart(result) {
    return excludes(result, 8 /* Unicode */ | 16 /* OctetOverflow */)
        && (includes(result, 1 /* ASCII */) || includes(result, 4 /* Printable */));
}
function isDomain(result) {
    return excludes(result, 4 /* Printable */ | 16 /* OctetOverflow */)
        && includes(result, 2 /* Dot */ | 32 /* ValidTLD */)
        && ((result & (1 /* ASCII */ | 8 /* Unicode */)) !== 0);
}
/**
 * Проверяет, что указанный символ является _допустимым_ ASCII-символом для домена
 */
function isASCII(ch) {
    return ch === 45 /* Hyphen */
        // Согласно RFC подчёркивание не является допустимым ASCII, но по факту
        // этот символ может использоваться в доменах третьего уровня
        || ch === 95 /* Underscore */
        || isAlpha(ch)
        || isNumber(ch);
}
function isPrintable(ch) {
    return printableChars.has(ch);
}
/**
 * https://tools.ietf.org/html/rfc1738
 */
function isUnreserved(ch) {
    // Расхождение с RFC: разрешаем юникодные символы в URL для красоты
    return isUnicodeAlpha(ch) || isNumber(ch) || safeChars.has(ch) || extraChars.has(ch);
}
function isHex(ch) {
    if (isNumber(ch)) {
        return true;
    }
    ch &= ~32; // quick hack to convert any char code to uppercase char code
    return ch >= 65 && ch <= 70;
}
function isPunct(ch) {
    return punctChars.has(ch);
}
function handleBracket(state) {
    const ch = state.peek();
    const bracketType = getBracket(ch);
    if (bracketType) {
        const { pos } = state;
        state.pos++;
        if (isOpenBracket(ch)) {
            state.brackets[bracketType]++;
            return 1 /* Yes */;
        }
        else if (state.brackets[bracketType] > 0) {
            state.brackets[bracketType]--;
            return 1 /* Yes */;
        }
        else if (!atWordEdge(state)) {
            // Попали на незакрытую скобку, смотрим, что делать: если она на
            // границе слов, то выносим её за пределы фрагмента
            return 1 /* Yes */;
        }
        state.pos = pos;
        return 2 /* Skip */;
    }
    return 0 /* No */;
}
function getBracket(ch) {
    switch (ch) {
        case 123 /* CurlyBracketOpen */:
        case 125 /* CurlyBracketClose */:
            return 'curly';
        case 40 /* RoundBracketOpen */:
        case 41 /* RoundBracketClose */:
            return 'round';
        case 91 /* SquareBracketOpen */:
        case 93 /* SquareBracketClose */:
            return 'square';
    }
}
function isOpenBracket(ch) {
    return ch === 123 /* CurlyBracketOpen */
        || ch === 40 /* RoundBracketOpen */
        || ch === 91 /* SquareBracketOpen */;
}
function isLogin(ch) {
    return loginChars.has(ch);
}
function linkToken(value, link) {
    return {
        type: "link" /* Link */,
        format: TokenFormat.None,
        value,
        link,
        auto: true,
        sticky: false
    };
}

function parseNewline(state) {
    const { pos } = state;
    if (consumeNewline(state)) {
        const value = state.substring(pos);
        state.push({
            type: "newline" /* Newline */,
            format: TokenFormat.None,
            value,
        });
        return true;
    }
}
function consumeNewline(state) {
    if (state.consume(13 /* Return */)) {
        state.consume(10 /* NewLine */);
        return true;
    }
    return state.consume(10 /* NewLine */) || state.consume(12 /* LineFeed */);
}

const defaultOptions = {
    markdown: false,
    textEmoji: false,
    hashtag: false,
    mention: false,
    command: false,
    userSticker: false,
    link: false,
    stickyLink: false
};
function parse(text, opt) {
    const options = Object.assign(Object.assign({}, defaultOptions), opt);
    const state = new ParserState(text, options);
    while (state.hasNext()) {
        parseMarkdown(state) || parseNewline(state)
            || parseEmoji(state) || parseTextEmoji(state) || parseUserSticker(state)
            || parseMention(state) || parseCommand(state) || parseHashtag(state)
            || parseLink(state)
            || state.consumeText();
    }
    state.flushText();
    let { tokens } = state;
    if (options.markdown && state.formatStack.length) {
        // Если есть незакрытые токены форматирования, сбрасываем их формат,
        // так как они не валидны
        for (let i = 0, token; i < state.formatStack.length; i++) {
            token = state.formatStack[i];
            token.format = TokenFormat.None;
            token.type = "text" /* Text */;
        }
        tokens = normalize(tokens);
    }
    return tokens;
}

export { TokenFormat, codePointAt, parse as default, getLength, getText, normalize };
