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
function getText$1(tokens) {
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
                const nextEmoji = shiftEmoji$1(token.emoji, prev.value.length);
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
        return (token1.type === "link" /* Link */ && token1.link === token2.link && isCustomLink$1(token1) && isCustomLink$1(token2))
            || token1.type === "text" /* Text */;
    }
}
function shiftEmoji$1(emoji, offset) {
    return emoji.map(e => (Object.assign(Object.assign({}, e), { from: e.from + offset, to: e.to + offset })));
}
/**
 * Проверяет, что указанный токен является пользовательской ссылкой, то есть
 * ссылка отличается от содержимого токена
 */
function isCustomLink$1(token) {
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
    if (state.consume(isEmoji$1)) {
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
function isEmoji$1(cp) {
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

const defaultOptions$2 = {
    markdown: false,
    textEmoji: false,
    hashtag: false,
    mention: false,
    command: false,
    userSticker: false,
    link: false,
    stickyLink: false
};
function parse$1(text, opt) {
    const options = Object.assign(Object.assign({}, defaultOptions$2), opt);
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

/**
 * Возвращает индекс токена из списка `tokens`, который соответствует указанной
 * позиции текста
 * @param solid Если указан, индекс позиции токена будет обновлён таким образом,
 * чтобы учитывать «сплошные» (неразрывные) токены, то есть токены, которые нельзя
 * разрывать в середине. В основном это используется для форматирования, чтобы
 * не делить токен и не заниматься репарсингом. Значение может быть `false` (начало)
 * или `true` (конец)
 */
function tokenForPos(tokens, offset, locType = "end" /* End */, solid) {
    if (offset < 0) {
        return { index: -1, offset: -1 };
    }
    const index = tokens.findIndex((token, i) => {
        const len = token.value.length;
        if (offset < len) {
            return true;
        }
        if (len === offset) {
            // Попали точно на границу токенов. Проверим, если следующий является
            // sticky-токеном, то работать нужно будет с ним, иначе с текущим
            if (tokens.length - 1 === i) {
                // Это последний токен
                return true;
            }
            const nextToken = tokens[i + 1];
            if (!isSticky(nextToken) && locType === "end" /* End */) {
                return true;
            }
        }
        offset -= len;
    });
    const pos = { offset, index };
    if (index !== -1) {
        const token = tokens[index];
        if (solid && isSolidToken(token)) {
            pos.offset = locType === "end" /* End */ ? token.value.length : 0;
        }
        else if (token.emoji) {
            // Обновляем позицию `offset` внутри токена таким образом,
            // чтобы она не попадала на вложенный эмоджи
            const { emoji } = token;
            for (let i = 0; i < emoji.length && emoji[i].from < pos.offset; i++) {
                if (emoji[i].to > pos.offset) {
                    pos.offset = locType === "start" /* Start */ ? emoji[i].from : emoji[i].to;
                    break;
                }
            }
        }
    }
    return pos;
}
/**
 * Возвращает позиции в токенах для указанного диапазона
 */
function tokenRange(tokens, from, to, solid = false) {
    const start = tokenForPos(tokens, from, "start" /* Start */, solid);
    const end = tokenForPos(tokens, to, "end" /* End */, solid);
    // Из-за особенностей определения позиций может случиться, что концевой токен
    // будет левее начального. В этом случае отдаём предпочтение концевому
    if (end.index < start.index && from === to) {
        return [end, end];
    }
    return end.index < start.index && from === to
        ? [end, end]
        : [start, end];
}
/**
 * Делит токен на две части в указанной позиции
 */
function splitToken(token, pos) {
    pos = clamp$1(pos, 0, token.value.length);
    // Разбор пограничных случаев: позиция попадает на начало или конец токена
    if (pos === 0) {
        return [createToken(''), token];
    }
    if (pos === token.value.length) {
        return [token, createToken('')];
    }
    let right = sliceToken(token, pos);
    // Так как у нас фактически все токены зависят от префикса, деление
    // токена всегда должно превратить правую часть в обычный текст, только если
    // это не произвольная ссылка
    if (!isCustomLink(right) && pos > 0) {
        right = toText(right);
    }
    return [
        sliceToken(token, 0, pos),
        right
    ];
}
/**
 * Возвращает фрагмент указанного токена
 */
function sliceToken(token, start, end = token.value.length) {
    const { value, emoji } = token;
    const result = Object.assign(Object.assign({}, token), { value: value.slice(start, end), emoji: sliceEmoji(emoji, start, end) });
    if (result.type === "link" /* Link */) {
        // Если достаём фрагмент автоссылки, то убираем это признак
        result.auto = false;
    }
    return result;
}
/**
 * Возвращает список эмоджи, который соответствует указанному диапазону.
 * Если список пустой, то вернёт `undefined` для поддержки контракта с токенами
 */
function sliceEmoji(emoji, from, to) {
    if (!emoji) {
        return undefined;
    }
    const result = [];
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
/**
 * Проверяет, является ли указанный токен сплошным, то есть его разделение на части
 * для форматирования является не желательным
 */
function isSolidToken(token) {
    return token.type === "command" /* Command */
        || token.type === "hashtag" /* HashTag */
        || token.type === "user_sticker" /* UserSticker */
        || token.type === "mention" /* Mention */
        || (token.type === "link" /* Link */ && !isCustomLink(token));
}
/**
 * Проверяет, что указанный токен является пользовательской ссылкой, то есть
 * ссылка отличается от содержимого токена
 */
function isCustomLink(token) {
    return token.type === "link" /* Link */ && !token.auto;
}
/**
 * Проверяет, что указанный токен — это автоссылка, то есть автоматически
 * распарсилась из текста
 */
function isAutoLink(token) {
    return token.type === "link" /* Link */ && token.auto;
}
function shiftEmoji(emoji, offset) {
    return emoji.map(e => (Object.assign(Object.assign({}, e), { from: e.from + offset, to: e.to + offset })));
}
function clamp$1(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
/**
 * Конвертирует указанный токен в текст
 */
function toText(token, sticky) {
    if (sticky === undefined) {
        sticky = 'sticky' in token ? token.sticky : false;
    }
    return {
        type: "text" /* Text */,
        format: token.format,
        value: token.value,
        emoji: token.emoji,
        sticky
    };
}
/**
 * Конвертирует указанный токен в ссылку
 */
function toLink(token, link, sticky) {
    if (sticky === undefined) {
        sticky = 'sticky' in token ? token.sticky : false;
    }
    return {
        type: "link" /* Link */,
        format: token.format,
        value: token.value,
        emoji: token.emoji,
        link,
        auto: false,
        sticky,
    };
}
/**
 * Фабрика объекта-токена
 */
function createToken(text, format = 0, sticky = false, emoji) {
    return { type: "text" /* Text */, format, value: text, emoji, sticky };
}
function isSticky(token) {
    return 'sticky' in token && token.sticky;
}

const formats$1 = [
    [TokenFormat.Bold, 'bold'],
    [TokenFormat.Italic, 'italic'],
    [TokenFormat.Monospace, 'monospace'],
    [TokenFormat.Strike, 'strike'],
    [TokenFormat.Underline, 'underline'],
    [TokenFormat.Heading, 'heading'],
    [TokenFormat.Marked, 'marked'],
    [TokenFormat.Highlight, 'highlight'],
    [TokenFormat.Link, 'md-link'],
    [TokenFormat.LinkLabel, 'md-link-label'],
];
const tokenTypeClass = {
    ["command" /* Command */]: 'command',
    ["hashtag" /* HashTag */]: 'hashtag',
    ["link" /* Link */]: 'link',
    ["markdown" /* Markdown */]: 'md',
    ["mention" /* Mention */]: 'mention',
    ["text" /* Text */]: '',
    ["user_sticker" /* UserSticker */]: 'user-sticker',
    ["newline" /* Newline */]: 'newline',
};
const defaultOptions$1 = {
    fixTrailingLine: false,
    replaceTextEmoji: false,
    link: getLink
};
function render(elem, tokens, opt) {
    const options = opt ? Object.assign(Object.assign({}, defaultOptions$1), opt) : defaultOptions$1;
    const state = new ReconcileState(elem, options);
    // let prevToken: Token | undefined;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (!token.value) {
            continue;
        }
        const elem = renderTokenContainer(token, state);
        const groupEnd = nextInGroup(tokens, i);
        if (groupEnd !== i) {
            // Можем схлопнуть несколько токенов в один
            elem.className = getTokenTypeClass(token);
            const innerState = new ReconcileState(elem, options);
            while (i <= groupEnd) {
                const innerElem = innerState.elem('span');
                innerElem.className = formatClassNames(tokens[i].format);
                renderText(tokens[i], innerElem, options);
                i++;
            }
            i = groupEnd;
            innerState.trim();
        }
        else {
            elem.className = joinClassNames([
                getTokenTypeClass(token),
                formatClassNames(token.format)
            ]);
            if (token.type !== "user_sticker" /* UserSticker */ && (token.type !== "newline" /* Newline */ || options.nowrap)) {
                renderText(token, elem, options);
            }
        }
        // prevToken = token;
    }
    // NB: Проверяем именно `prevToken`, который мы обработали.
    // Если брать последний, это может быть sticky-токен, который надо пропустить
    // if (options.fixTrailingLine && prevToken && prevToken.value.slice(-1) === '\n') {
    //     state.elem('br');
    // }
    if (options.fixTrailingLine && tokens.length) {
        state.elem('br');
    }
    state.trim();
}
/**
 * Отрисовка текстового содержимого в указанном контейнере с учётом наличия эмоджи
 * внутри токена
 */
function renderText(token, elem, options) {
    let { emoji, value } = token;
    if (options.nowrap) {
        value = value
            .replace(/\r\n/g, '\n')
            .replace(/[\s\n]/g, '\u00a0');
    }
    if (emoji && options.emoji) {
        let offset = 0;
        const state = new ReconcileState(elem, options);
        if (!options.replaceTextEmoji || (token.format & TokenFormat.Monospace)) {
            // Для monospace не заменяем текстовые эмоджи, также не заменяем их,
            // если отключена опция
            emoji = emoji.filter(isEmojiSymbol);
        }
        emoji.forEach(emojiToken => {
            const text = value.slice(offset, emojiToken.from);
            const rawEmoji = value.slice(emojiToken.from, emojiToken.to);
            const emoji = emojiToken.emoji || rawEmoji;
            if (text) {
                state.text(text);
            }
            state.emoji(emoji, rawEmoji);
            offset = emojiToken.to;
        });
        const tail = value.slice(offset);
        if (tail) {
            state.text(tail);
        }
        state.trim();
    }
    else {
        setTextValue(elem, value);
    }
}
/**
 * Возвращает список классов форматирования для указанного формата токена
 */
function formatClassNames(format) {
    let result = '';
    let glue = '';
    // Укажем классы с форматированием
    formats$1.forEach(([f, value]) => {
        if (format & f) {
            result += glue + value;
            glue = ' ';
        }
    });
    return result;
}
function joinClassNames(classNames) {
    let result = '';
    let glue = '';
    classNames.forEach(cl => {
        if (cl) {
            result += glue + cl;
            glue = ' ';
        }
    });
    return result;
}
function setTextValue(node, text) {
    if (isElement$1(node)) {
        // В элементе могут быть в том числе картинки с эмоджи, которые не отобразятся
        // в node.textContent. Поэтому сделаем проверку: если есть потомок и
        // он только один, то меняем `textContent`, иначе очищаем узел
        let ptr = node.firstChild;
        let next;
        let updated = false;
        // Чтобы меньше моргала подсветка спеллчекера, попробуем
        // найти ближайший текстовый узел и обновить его, попутно удаляя все
        // промежуточные узлы
        while (ptr) {
            if (ptr.nodeType === Node.TEXT_NODE) {
                setTextValue(ptr, text);
                updated = true;
                // Удаляем оставшиеся узлы
                while (ptr.nextSibling) {
                    ptr.nextSibling.remove();
                }
                break;
            }
            else {
                next = ptr.nextSibling;
                ptr.remove();
                ptr = next;
            }
        }
        if (!updated) {
            node.textContent = text;
        }
    }
    else if (node.textContent !== text) {
        node.textContent = text;
    }
}
/**
 * Добавляет указанный узел `node` в позицию `pos` потомков `elem`
 */
function insertAt(elem, child, pos) {
    const curChild = elem.childNodes[pos];
    if (curChild) {
        elem.insertBefore(child, curChild);
    }
    else {
        elem.appendChild(child);
    }
    return child;
}
/**
 * Удаляет указанный DOM-узел
 */
function remove(node, emoji) {
    if (emoji && isElement$1(node)) {
        cleanUpEmoji(node, emoji);
    }
    node.remove();
}
class ReconcileState {
    constructor(container, options) {
        this.container = container;
        this.options = options;
        /** Указатель на текущую позицию потомка внутри `container` */
        this.pos = 0;
    }
    /**
     * Ожидает текстовый узел в позиции `pos`. Если его нет, то автоматически создаст
     * со значением `value`, а если есть, то обновит значение на `value`
     */
    text(value) {
        let node = this.container.childNodes[this.pos];
        if ((node === null || node === void 0 ? void 0 : node.nodeType) === 3) {
            if (node.nodeValue !== value) {
                node.nodeValue = value;
            }
        }
        else {
            node = document.createTextNode(value);
            insertAt(this.container, node, this.pos);
        }
        this.pos++;
        return node;
    }
    /**
     * Ожидает элемент с именем `name` в текущей позиции. Если его нет, то создаст
     * такой
     */
    elem(name) {
        let node = this.container.childNodes[this.pos];
        if (!isElement$1(node) || node.localName !== name) {
            node = document.createElement(name);
            insertAt(this.container, node, this.pos);
        }
        this.pos++;
        return node;
    }
    /**
     * Ожидает элемент с указанным эмоджи, при необходимости создаёт или обновляет его
     */
    emoji(actualEmoji, rawEmoji) {
        const { emoji } = this.options;
        const node = this.container.childNodes[this.pos];
        const isCurEmoji = node ? isEmoji(node) : false;
        const next = emoji(actualEmoji, isCurEmoji ? node : null);
        if (next) {
            if (node !== next) {
                insertAt(this.container, next, this.pos);
                if (isCurEmoji) {
                    remove(node, emoji);
                }
            }
            next.$$emoji = true;
            next.setAttribute('data-raw', rawEmoji);
            this.pos++;
            return next;
        }
        else if (isCurEmoji) {
            remove(node, emoji);
        }
    }
    /**
     * Удаляет все дочерние элементы контейнера, которые находятся правее точки `pos`
     */
    trim() {
        const { emoji } = this.options;
        while (this.pos < this.container.childNodes.length) {
            remove(this.container.childNodes[this.pos], emoji);
        }
    }
}
function isElement$1(node) {
    return (node === null || node === void 0 ? void 0 : node.nodeType) === 1;
}
/**
 * Возвращает позицию элемента, до которого можно сделать единую с элементом
 * в позиции `pos` группу. Используется, например, для того, чтобы сгруппировать
 * в единый `<a>`-элемент ссылку с внутренним форматированием
 */
function nextInGroup(tokens, pos) {
    const cur = tokens[pos];
    let nextPos = pos;
    while (nextPos < tokens.length - 1) {
        if (!canGroup(cur, tokens[nextPos + 1])) {
            break;
        }
        nextPos++;
    }
    return nextPos;
}
/**
 * Вернёт `true`, если два токена можно сгруппировать в один
 */
function canGroup(t1, t2) {
    if (t1 === t2) {
        return true;
    }
    if (t1.type === t2.type) {
        return (t1.type === "link" /* Link */ && t1.link === t2.link)
            || (t1.type === "mention" /* Mention */ && t1.mention === t2.mention)
            || (t1.type === "hashtag" /* HashTag */ && t1.hashtag === t2.hashtag);
    }
    return false;
}
/**
 * Отрисовывает контейнер для указанного токена
 */
function renderTokenContainer(token, state) {
    let elem;
    // Ссылки рисуем только если нет моноширинного текста
    if (isRenderLink(token)) {
        elem = state.elem('a');
        elem.setAttribute('href', state.options.link(token));
        elem.setAttribute('target', '_blank');
        elem.addEventListener('mouseenter', onLinkEnter);
        elem.addEventListener('mouseleave', onLinkLeave);
    }
    else if (token.type === "user_sticker" /* UserSticker */ && state.options.emoji) {
        elem = state.emoji(token.value, token.value);
    }
    else if (token.type === "newline" /* Newline */) {
        elem = state.elem(state.options.nowrap ? 'span' : 'br');
        elem.setAttribute('data-raw', token.value);
    }
    else {
        elem = state.elem('span');
    }
    return elem;
}
function isEmojiSymbol(emoji) {
    return emoji.emoji === undefined;
}
function isEmoji(elem) {
    return elem.nodeType === 1 ? elem.$$emoji : false;
}
/**
 * Очищает ресурсы эмоджи внутри указанном элементе
 */
function cleanUpEmoji(elem, emoji) {
    const walker = document.createTreeWalker(elem, NodeFilter.SHOW_ELEMENT);
    let node;
    while (node = walker.nextNode()) {
        if (isEmoji(node)) {
            emoji(null, node);
        }
    }
    if (isEmoji(elem)) {
        emoji(null, elem);
    }
}
function getLink(token) {
    if (token.type === "hashtag" /* HashTag */) {
        return token.value;
    }
    if (token.type === "link" /* Link */) {
        return token.link;
    }
    return '';
}
/**
 * Возвращает класс для указанного токена
 */
function getTokenTypeClass(token) {
    if (isAutoLink(token) && (token.format & TokenFormat.Monospace)) {
        return '';
    }
    if (isPrefixedToken(token) && token.value.length === 1) {
        return '';
    }
    if (isRenderLink(token)) {
        let { type } = token;
        if (isCustomLink(token) && token.link[0] === '@') {
            type = "mention" /* Mention */;
        }
        return type !== "link" /* Link */ ? `${tokenTypeClass.link} ${tokenTypeClass[type]}` : tokenTypeClass[type];
    }
    return tokenTypeClass[token.type];
}
/**
 * Если указанный токен является ссылкой, вернёт `true`, если его можно нарисовать
 * как ссылку
 */
function isRenderLink(token) {
    if ((token.format & TokenFormat.Monospace)) {
        // Внутри моноширинного текста разрешаем только «ручные» ссылки либо
        // полные автоссылки (начинаются с протокола)
        return token.type === "link" /* Link */ && (!token.auto || /^[a-z+]+:\/\//i.test(token.value));
    }
    if (isPrefixedToken(token)) {
        return token.value.length > 1;
    }
    return token.type === "link" /* Link */;
}
function isPrefixedToken(token) {
    return token.type === "mention" /* Mention */
        || token.type === "command" /* Command */
        || token.type === "hashtag" /* HashTag */;
}
function onLinkEnter(evt) {
    dispatch(evt.target, 'linkenter');
}
function onLinkLeave(evt) {
    dispatch(evt.target, 'linkleave');
}
function dispatch(elem, eventName, detail) {
    elem.dispatchEvent(new CustomEvent(eventName, {
        bubbles: true,
        cancelable: true,
        detail
    }));
}

const defaultOptions = {
    compactActions: [],
    compactTimeout: 600,
    maxEntries: 100
};
class History {
    constructor(options) {
        this._stack = [];
        this._ptr = -1;
        this.options = Object.assign(Object.assign({}, defaultOptions), options);
    }
    /**
     * Добавляет запись в стэк истории
     */
    push(state, action, range, time = Date.now()) {
        const { canRedo } = this;
        if (this._stack.length > this._ptr + 1) {
            // Удаляем записи из стэка, которые находятся за пределами указателя
            this._stack = this._stack.slice(0, this._ptr + 1);
        }
        const prevEntry = this._stack[this._ptr];
        const nextEntry = { state, time, action, range };
        if (prevEntry && action && !canRedo && prevEntry.action === action
            && this.options.compactActions.includes(action)
            && time - prevEntry.time < this.options.compactTimeout) {
            // Можно объединить два действия в одно
            combineEntries(prevEntry, nextEntry);
        }
        else {
            this._stack.push(nextEntry);
            this._ptr++;
            while (this._stack.length > this.options.maxEntries) {
                this._stack.shift();
                this._ptr--;
            }
        }
    }
    /**
     * Можно ли отменить последнее действие
     */
    get canUndo() {
        return this._ptr > 0;
    }
    /**
     * Можно ли повторить ранее отменённое действие
     */
    get canRedo() {
        return this._ptr < this._stack.length - 1;
    }
    /**
     * Текущая запись в истории
     */
    get current() {
        return this._stack[this._ptr];
    }
    /**
     * Откатывается к предыдущему состоянию, если это возможно, и возвращает его
     * значение
     */
    undo() {
        if (this.canUndo) {
            return this._stack[--this._ptr];
        }
    }
    /**
     * Откатывается к следующему состоянию, ели это возможно, и возвращает его
     * значение
     */
    redo() {
        if (this.canRedo) {
            return this._stack[++this._ptr];
        }
    }
    /**
     * Возвращает список всех значений в истории
     */
    entries() {
        return this._stack.map(entry => entry.state);
    }
    /**
     * Сохраняет указанный диапазон в текущей записи истории в качестве последнего
     * известного выделения
     */
    saveCaret(range) {
        const { current } = this;
        if (current) {
            current.caret = range;
        }
    }
    /**
     * Очищает всю историю
     */
    clear() {
        this._stack = [];
        this._ptr = -1;
    }
}
function combineEntries(prev, next) {
    prev.time = next.time;
    prev.state = next.state;
    if (prev.range && next.range) {
        prev.range = [
            Math.min(prev.range[0], next.range[0]),
            Math.max(prev.range[1], next.range[1]),
        ];
    }
    return prev;
}

/**
 * Возвращает текущий допустимый диапазон, который находится в указанном
 * контейнере
 */
function getRange(root) {
    const sel = window.getSelection();
    const range = sel.rangeCount && sel.getRangeAt(0);
    if (range && isValidRange(range, root)) {
        return range;
    }
}
/**
 * Создаёт выделенный диапазон по указанным координатам
 */
function setRange(root, from, to) {
    const range = locationToRange(root, from, to);
    if (range) {
        return setDOMRange(range);
    }
}
/**
 * Обновляет DOM-диапазон, если он отличается от текущего
 */
function setDOMRange(range) {
    const sel = window.getSelection();
    // Если уже есть выделение, сравним указанный диапазон с текущим:
    // если они равны, то ничего не делаем, чтобы лишний раз не напрягать
    // браузер и не портить UX
    try {
        if (sel.rangeCount) {
            const curRange = sel.getRangeAt(0);
            const startBound = curRange.compareBoundaryPoints(Range.START_TO_START, range);
            const endBound = curRange.compareBoundaryPoints(Range.END_TO_END, range);
            if (startBound === 0 && endBound === 0) {
                return;
            }
        }
    }
    catch (_a) {
        // Может быть ошибка, если элемент ещё не в DOM-дереве: игнорируем её
    }
    sel.empty();
    sel.addRange(range);
    return range;
}
/**
 * Возвращает текстовый диапазон для указанного контейнера
 */
function getTextRange(root) {
    const range = getRange(root);
    if (range) {
        return rangeToLocation(root, range);
    }
}
/**
 * Сериализация указанного DOM-диапазона в координаты для модели редактора:
 * для начала и конца диапазона находит узел в модели, которому он соответствует,
 * и высчитывает смещение в символах внутри найденного узла.
 * Координаты модели высчитываются относительно элемента `container`
 */
function rangeToLocation(root, range) {
    const { collapsed } = range;
    const from = rangeBoundToLocation(root, range.startContainer, range.startOffset);
    const to = collapsed ? from : rangeBoundToLocation(root, range.endContainer, range.endOffset);
    return [from, to];
}
/**
 * Десериализация диапазона из координат модели в DOM
 */
function locationToRange(ctx, from, to) {
    const start = locationToRangeBound(ctx, from);
    const end = to == null || to === from ? start : locationToRangeBound(ctx, to);
    if (start && end) {
        const range = document.createRange();
        range.setStart(start.container, start.offset);
        range.setEnd(end.container, end.offset);
        return range;
    }
}
/**
 * Возвращает позицию символа в тексте `ctx`, на который указывает граница
 * диапазона (DOM Range), определяемая параметрами `container` и `offset`
 */
function rangeBoundToLocation(root, node, offset) {
    let result = 0;
    if (isText(node)) {
        result = offset;
    }
    else {
        const nodeLen = getNodeLength(node, false);
        if (nodeLen) {
            // Сам узел является представлением какого-то токена.
            // Если смещение больше 0, значит диапазон выставили внутри токена
            // и его надо поглотить
            if (offset > 0) {
                result += nodeLen;
            }
        }
        else {
            let i = 0;
            while (i < offset) {
                result += getNodeLength(node.childNodes[i++], true);
            }
            result += getNodeLength(node, false);
        }
    }
    if (root !== node) {
        // Tree walker идёт по узлам в их порядке следования в DOM. Соответственно,
        // как только мы дойдём до указанного контейнера, мы посчитаем весь предыдущий
        // контент
        const walker = createWalker(root);
        let n;
        while ((n = walker.nextNode()) && n !== node) {
            result += getNodeLength(n);
        }
    }
    return result;
}
/**
 * Выполняет операцию, обратную `rangeBoundToPos`: конвертирует числовую позицию
 * в границу для `Range`
 * @param root Контекстный элемент, внутри которого нужно искать контейнер
 * для узла модели
 */
function locationToRangeBound(root, pos) {
    const walker = createWalker(root);
    let len;
    let container;
    while (container = walker.nextNode()) {
        len = getNodeLength(container, false);
        if (len === 0) {
            continue;
        }
        if (pos <= len) {
            if (isText(container)) {
                return { container, offset: pos };
            }
            // Если попали в элемент (например, эмоджи), делаем адресацию относительно
            // его родителя.
            // Учитываем захват элемента в зависимости того, попадает ли позиция
            // внутрь токена (pos > 0) или нет
            let offset = pos === 0 ? 0 : 1;
            let node = container;
            while (node = node.previousSibling) {
                offset++;
            }
            return { container: container.parentNode, offset };
        }
        pos -= len;
    }
    return {
        container: root,
        offset: 0
    };
}
/**
 * Проверяет, является ли указанный диапазон допустимым, с которым можно работать
 */
function isValidRange(range, container) {
    return container.contains(range.commonAncestorContainer);
}
/**
 * Возвращает текстовую длину указанного узла
 */
function getNodeLength(node, deep = false) {
    if (isText(node)) {
        return node.nodeValue.length;
    }
    if (isElement(node) && node.hasAttribute('data-raw')) {
        return (node.getAttribute('data-raw') || '').length;
    }
    let result = 0;
    if (deep) {
        for (let i = 0; i < node.childNodes.length; i++) {
            result += getNodeLength(node.childNodes[i], true);
        }
    }
    return result;
}
function isText(node) {
    return node.nodeType === Node.TEXT_NODE;
}
function isElement(node) {
    return node.nodeType === Node.ELEMENT_NODE;
}
function createWalker(elem) {
    return elem.ownerDocument.createTreeWalker(elem, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
}

const formats = Array.from(charToFormat.values());
const formatToChar = new Map();
charToFormat.forEach((v, k) => formatToChar.set(v, String.fromCharCode(k)));
/**
 * Конвертация MD-токенов в список обычных текстовых токенов
 * @param range Диапазон внутри MD-строки. Если указан, значения параметра будут
 * изменены таким образом, чтобы указывать на ту же самую позицию внутри
 * внутри нового списка токенов
 */
function mdToText(tokens, range) {
    const state = { offset: 0, range };
    const result = [];
    let format = TokenFormat.None;
    for (let i = 0, token, len; i < tokens.length; i++) {
        token = tokens[i];
        len = token.value.length;
        if (token.type === "markdown" /* Markdown */) {
            if (token.format & TokenFormat.LinkLabel) {
                // Начало кастомной ссылки. В этом месте мы знаем, что за токеном
                // следует текст ссылки и сама ссылка, поэтому пройдёмся по токенам
                // вперёд и найдём границу всей ссылки
                const linkBound = findCustomLinkBound(tokens, i);
                convertCustomLink(tokens.slice(i, linkBound), result, state);
                i = linkBound - 1;
            }
            else {
                // NB достаём формат по символу токена, так как сам токен может
                // содержать накопленный формат внешних токенов.
                // Например, в `*_aa_*` у токена `_` будет формат Bold | Italic
                if (format & charToFormat.get(token.value.charCodeAt(0))) {
                    // Завершается форматирование. Если у последнего токена
                    // нет текущего формата, значит, нужно сделать sticky-форматирование
                    const prev = result[result.length - 1];
                    if (!prev || !(prev.format & token.format)) {
                        if ((prev.type === "text" /* Text */ || prev.type === "link" /* Link */) && prev.sticky) {
                            prev.format |= token.format;
                        }
                        else {
                            result.push({
                                type: "text" /* Text */,
                                format,
                                value: '',
                                sticky: true
                            });
                        }
                    }
                    format &= ~token.format;
                }
                else {
                    // Открывается форматирование
                    format |= token.format;
                }
                adjustTextRange(state, token);
            }
        }
        else {
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
function textToMd(tokens, range) {
    const state = {
        format: 0,
        stack: [],
        range,
        link: '',
        output: ''
    };
    tokens.forEach(token => textToMdToken(token, state));
    if (state.format) {
        pushSymbols(state, getFormatSymbols(state.format, state, true), false);
    }
    return state.output;
}
function textToMdToken(token, state) {
    let link = '';
    let { format } = token;
    let linkChange = TokenFormat.None;
    let hasLink = 0;
    let bound = 0;
    let hasBound = false;
    let suffix;
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
        pushSymbols(state, getFormatSymbols(removed, state, true), false);
        state.output += suffix;
        if (!added && !hasLink && !hasBound && !isEndBoundChar(token.value.charCodeAt(0))) {
            pushSymbols(state, ' ', false);
        }
    }
    if (added) {
        // Есть форматы, которые надо добавить
        hasLink = added & TokenFormat.Link;
        if (hasLink) {
            bound = 0;
            state.link = link;
        }
        else {
            bound = findStartBound(token.value);
        }
        if (bound === 0 && token.value && !hasLink && !isStartBoundChar(state.output.charCodeAt(state.output.length - 1))) {
            // Нет чёткой границы для разделения
            pushSymbols(state, ' ', true);
        }
        state.output += token.value.slice(0, bound);
        pushSymbols(state, getFormatSymbols(added, state, false), true);
        state.output += token.value.slice(bound);
    }
    else {
        state.output += token.value;
    }
    state.format = format;
}
/**
 * Находит границу для завершающего MD-символа для указанного текстового фрагмента
 */
function findEndBound(text) {
    let i = text.length;
    let ch;
    while (i > 0) {
        ch = text.charCodeAt(i - 1);
        if (!isEndBoundChar(ch) || charToFormat.has(ch)) {
            break;
        }
        i--;
    }
    return i;
}
function findStartBound(text) {
    let i = 0;
    while (i < text.length && isStartBoundChar(text.charCodeAt(i))) {
        i++;
    }
    return i;
}
/**
 * Возвращает набор открывающих или закрывающих MD-символов для указанного формата
 */
function getFormatSymbols(format, state, close) {
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
    }
    else {
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
function convertCustomLink(customLink, output, state) {
    // Структура кастомной ссылки:
    // '[', ...label, ']', '(', link, ')'
    if (customLink.length) {
        const linkToken = customLink[customLink.length - 2];
        const link = linkToken.value;
        customLink.slice(0, -4).forEach(token => {
            if (token.type === "markdown" /* Markdown */) {
                adjustTextRange(state, token);
            }
            else {
                output.push({
                    type: "link" /* Link */,
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
function findCustomLinkBound(tokens, start) {
    let linkFound = false;
    let token;
    while (start < tokens.length) {
        token = tokens[start++];
        if (token.type === "markdown" /* Markdown */ && (token.format & TokenFormat.Link)) {
            if (linkFound) {
                return start;
            }
            linkFound = true;
        }
    }
}
function adjustTextRange(state, token) {
    const { range, offset } = state;
    if (range) {
        if (offset < range[0]) {
            range[0] -= token.value.length;
        }
        else if (offset < range[0] + range[1]) {
            // state.range[1] -= token.value.length;
            // Может быть такое, что диапазон находится внутри удаляемых токенов.
            // Как минимум нам надо сохранить фиксированную часть
            const fixed = offset - range[0];
            state.range[1] = fixed + Math.max(0, range[1] - fixed - token.value.length);
        }
    }
}
function pushSymbols(state, value, opening) {
    const { range } = state;
    if (range) {
        const len = state.output.length;
        if (len < range[0] || (len === range[0] && opening)) {
            range[0] += value.length;
        }
        else if (len < range[0] + range[1]) {
            range[1] += value.length;
        }
    }
    state.output += value;
}

/**
 * Вставляет указанный текст `text` в текстовую позицию `pos` списка токенов
 * @return Обновлённый список токенов
 */
function insertText(tokens, pos, text, options) {
    return updateTokens(tokens, text, pos, pos, options);
}
/**
 * Заменяет текст указанной длины в текстовой позиции `pos` на новый `text`
 * @return Обновлённый список токенов
 */
function replaceText(tokens, pos, len, text, options) {
    return updateTokens(tokens, text, pos, pos + len, options);
}
/**
 * Удаляет текст указанной длины из списка токенов в указанной позиции
 */
function removeText(tokens, pos, len, options) {
    return updateTokens(tokens, '', pos, pos + len, options);
}
/**
 * Вырезает текст из диапазона `from:to` и возвращает его и изменённую строку
 */
function cutText(tokens, from, to, options) {
    return {
        cut: normalize(slice(tokens, from, to)),
        tokens: removeText(tokens, from, to - from, options)
    };
}
/**
 * Выставляет текстовый формат `format` для всех токенов из диапазона `pos, pos + len`.
 * Если `len` не указано, вставляет sticky-метку в указанную позицию `pos`
 * @param breakSolid Применять форматирование внутри «сплошных» токенов, то есть
 * можно один сплошной токен разделить на несколько и указать им разное форматирование
 */
function setFormat(tokens, format, pos, len = 0, breakSolid) {
    if (!tokens.length) {
        // Пограничный случай: выставляем формат пустой строке
        return [createToken('', applyFormat(0, format), true)];
    }
    const [start, end] = tokenRange(tokens, pos, pos + len, !breakSolid);
    if (start.index === -1 || end.index === -1 || end.index < start.index) {
        // Невалидные данные, ничего не делаем
        return tokens;
    }
    const startToken = tokens[start.index];
    if (end.index === start.index) {
        if (end.offset === start.offset) {
            // Вставляем sticky-формат в указанную точку
            tokens = applyFormatAt(tokens, start.index, format, start.offset, 0);
        }
        else {
            // Изменения в пределах одного токена, разделим его
            tokens = applyFormatAt(tokens, start.index, format, start.offset, end.offset - start.offset);
        }
    }
    else {
        // Затронули несколько токенов
        tokens = tokens.slice();
        // Обновляем промежуточные токены, пока индексы точные
        for (let i = start.index + 1, nextFormat; i < end.index; i++) {
            nextFormat = applyFormat(tokens[i].format, format);
            if (tokens[i].format !== nextFormat) {
                tokens[i] = Object.assign(Object.assign({}, tokens[i]), { format: nextFormat });
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
function slice(tokens, from, to) {
    if (!tokens.length) {
        return [];
    }
    const fullLen = getLength(tokens);
    if (to == null) {
        to = fullLen;
    }
    else if (to < 0) {
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
        const t = tokens[start.index];
        if (start.offset === 0 && end.offset === t.value.length) {
            // Токен целиком
            return [t];
        }
        return [
            expandToken(sliceToken(tokens[start.index], start.offset, end.offset))
        ];
    }
    const [, left] = splitToken(tokens[start.index], start.offset);
    const [right,] = splitToken(tokens[end.index], end.offset);
    return normalize([
        expandToken(left),
        ...tokens.slice(start.index + 1, end.index),
        expandToken(right)
    ]);
}
/**
 * Делает указанный диапазон ссылкой на `link`.
 */
function setLink(tokens, link, pos, len = 0, sticky) {
    const [start, end] = tokenRange(tokens, pos, pos + len);
    if (start.index === -1 || end.index === -1) {
        console.warn('Invalid range:', { pos, len });
        return tokens;
    }
    let token;
    const nextTokens = tokens.slice();
    // Меняем промежуточные токены на ссылки
    for (let i = start.index + 1; i < end.index; i++) {
        nextTokens[i] = toLinkOrText(nextTokens[i], link, sticky);
    }
    // Обновляем концевые токены
    if (start.index === end.index) {
        // Попали в один токен
        token = nextTokens[start.index];
        const [left, _mid] = splitToken(token, start.offset);
        const [mid, right] = splitToken(_mid, end.offset - start.offset);
        const next = toLinkOrText(mid, link, sticky);
        nextTokens.splice(start.index, 1, left, next, right);
    }
    else {
        let left;
        let right;
        token = nextTokens[end.index];
        [left, right] = splitToken(token, end.offset);
        nextTokens.splice(end.index, 1, toLinkOrText(left, link, sticky), right);
        token = nextTokens[start.index];
        [left, right] = splitToken(token, start.offset);
        nextTokens.splice(start.index, 1, left, toLinkOrText(right, link, sticky));
    }
    return normalize(nextTokens);
}
/**
 * Вставляет указанный текст `text` в текстовую позицию `pos` списка токенов
 * @return Обновлённый список токенов
 */
function mdInsertText(tokens, pos, text, options) {
    return mdUpdateTokens(tokens, text, pos, pos, options);
}
/**
 * Заменяет текст указанной длины в текстовой позиции `pos` на новый `text`
 * @return Обновлённый список токенов
 */
function mdReplaceText(tokens, pos, len, text, options) {
    return mdUpdateTokens(tokens, text, pos, pos + len, options);
}
/**
 * Удаляет текст указанной длины из списка токенов в указанной позиции
 */
function mdRemoveText(tokens, pos, len, options) {
    return mdUpdateTokens(tokens, '', pos, pos + len, options);
}
/**
 * Вырезает текст из диапазона `from:to` и возвращает его и изменённую строку
 */
function mdCutText(tokens, from, to, options) {
    return {
        cut: parse$1(getText$1(tokens).slice(from, to), options),
        tokens: mdRemoveText(tokens, from, to - from, options)
    };
}
/**
 * Универсальный метод для обновления списка токенов: добавление, удаление и замена
 * текста в списке указанных токенов
 */
function updateTokens(tokens, value, from, to, options) {
    if (!tokens.length) {
        return parse$1(value, options);
    }
    const [start, end] = tokenRange(tokens, from, to);
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
    if (startToken.type === "text" /* Text */ && start.index > 0 && isAutoLink(tokens[start.index - 1])) {
        startToken = prefix.pop();
        nextValue = startToken.value + nextValue;
        textBound += startToken.value.length;
        start.index--;
        start.offset = 0;
    }
    let nextTokens = parse$1(nextValue, options);
    if (nextTokens.length) {
        // Вставляем/заменяем фрагмент
        nextTokens.forEach(t => t.format = startToken.format);
        // Применяем форматирование из концевых токенов, но только если можем
        // сделать это безопасно: применяем только для текста
        if (startToken.format !== endToken.format) {
            const splitPoint = tokenForPos(nextTokens, textBound);
            if (splitPoint.index !== -1 && textBound !== nextValue.length && nextTokens.slice(splitPoint.index).every(t => t.type === "text" /* Text */)) {
                nextTokens = setFormat(nextTokens, endToken.format, textBound, nextValue.length - textBound);
            }
        }
        // Проверяем пограничные случаи:
        // — начало изменяемого диапазона находится в пользовательской ссылке:
        //   сохраним ссылку
        if (isCustomLink(startToken)) {
            const { link } = startToken;
            let sticky;
            // Проверяем, куда пришло редактирование: если добавляем текст
            // в самом конце ссылки или в самом начале, то не распространяем
            // ссылку на этот текст
            if (start.offset === startToken.value.length) {
                let len = start.offset;
                if (startToken.sticky) {
                    // Включено sticky-форматирование: значит, мы дописываем ссылку.
                    // Разрешаем сделать это до первого символа-раделителя
                    const m = value.match(/[\s.,!?:;]/);
                    if (m) {
                        len += m.index || 0;
                        sticky = false;
                    }
                    else {
                        len += value.length;
                        sticky = true;
                    }
                }
                nextTokens = setLink(nextTokens, link, 0, len, sticky);
            }
            else if (start.offset === 0 && from === to) {
                nextTokens = setLink(nextTokens, link, value.length, startToken.value.length);
            }
            else {
                // Пограничный случай: полностью выделили ссылку и начинаем её заменять.
                // В этом случае нужно выставить sticky-параметр у текста, чтобы
                // ссылку можно было дописать
                if ((options === null || options === void 0 ? void 0 : options.stickyLink) && (to - from >= startToken.value.length)) {
                    sticky = true;
                }
                nextTokens = nextTokens.map(t => toLink(t, link, sticky));
            }
        }
        // if (isCustomLink(endToken) && value) {
        //     nextTokens = setLink(nextTokens, endToken.link, start.offset, textBound - start.offset);
        // }
    }
    return normalize([...prefix, ...nextTokens, ...suffix]);
}
/**
 * Универсальный метод для обновления списка токенов для markdown-синтаксиса.
 * Из-за некоторых сложностей с инкрементальным обновлением токенов, мы будем
 * просто модифицировать строку и заново её парсить: производительность парсера
 * должно хватить, чтобы делать это на каждое изменение.
 */
function mdUpdateTokens(tokens, value, from, to, options) {
    const prevText = getText$1(tokens);
    const nextText = prevText.slice(0, from) + value + prevText.slice(to);
    return parse$1(nextText, options);
}
/**
 * Применяет изменения формата `update` для токена `tokens[tokenIndex]`,
 * если это необходимо
 */
function applyFormatAt(tokens, tokenIndex, update, pos, len) {
    const token = tokens[tokenIndex];
    const format = applyFormat(token.format, update);
    if (token.format === format) {
        // У токена уже есть нужный формат
        return tokens;
    }
    let nextTokens;
    if (pos === 0 && len === token.value.length) {
        // Частный случай: меняем формат у всего токена
        nextTokens = [Object.assign(Object.assign({}, token), { format })];
    }
    else {
        // Делим токен на части. Если это специальный токен типа хэштэга
        // или команды, превратим его в обычный текст
        const [left, _mid] = splitToken(token, pos);
        const [mid, right] = splitToken(_mid, len);
        mid.format = format;
        nextTokens = [left, mid, right];
        if (isSolidToken(token)) {
            nextTokens = nextTokens.map(t => toText(t));
        }
        nextTokens[1].sticky = len === 0;
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
function applyFormat(format, update) {
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
function toLinkOrText(token, link, sticky) {
    return link ? toLink(token, link, sticky) : toText(token);
}
function expandToken(token) {
    if (token.type === "link" /* Link */) {
        if (!token.auto) {
            return token;
        }
        // Авто-ссылка: проверим её содержимое: если текст соответствует ссылке,
        // то оставим её, иначе превратим в текст
        return parse$1(token.value, { link: true })[0];
    }
    return toText(token);
}

const keyModifier = {
    ctrl: 1 << 0,
    alt: 1 << 1,
    shift: 1 << 2,
    meta: 1 << 3,
    any: 1 << 8,
};
/**
 * Модуль для удобной регистрации действий по клавиатурным сочетаниям
 */
class Shortcuts {
    constructor(ctx) {
        this.ctx = ctx;
        this.shortcuts = {};
    }
    /**
     * Регистрирует обработчик на указанный шорткат
     */
    register(shortcut, handler) {
        if (!Array.isArray(shortcut)) {
            shortcut = [shortcut];
        }
        shortcut.forEach(sh => this.shortcuts[parse(sh)] = handler);
        return this;
    }
    /**
     * Регистрирует все обработчики шортактов из указанной мапы
     */
    registerAll(shortcuts) {
        Object.keys(shortcuts).forEach(sh => {
            this.register(sh, shortcuts[sh]);
        });
    }
    /**
     * Удаляет зарегистрированный шорткат
     * @param handler Если не указано, удалит любой шорткат, зарегистрированный
     * по этому сочетанию, иначе удалит только если зарегистрированный обработчик
     * совпадает с указанным
     */
    unregister(shortcut, handler) {
        if (!Array.isArray(shortcut)) {
            shortcut = [shortcut];
        }
        shortcut.forEach(sh => {
            const key = parse(sh);
            if (this.shortcuts[key] && (!handler || this.shortcuts[key] === handler)) {
                delete this.shortcuts[key];
            }
        });
        return this;
    }
    /**
     * Удаляет все зарегистрированные шорткаты
     */
    unregisterAll() {
        this.shortcuts = {};
        return this;
    }
    /**
     * Выполняет зарегистрированный обработчик для указанного события
     * @returns Вернёт `true` если был найден и выполнен обработчик для указанного события
     */
    handle(evt) {
        // Несмотря на то, что keyCode считается deprecated, пока что это
        // единственный известный мне способ получить код клавиши, независимо
        // от раскладки
        const code = getCode(evt.keyCode ? getKey(evt.keyCode) : evt.key);
        const mask = maskFromEvent(evt);
        let key = `${mask}:${code}`;
        if (!this.shortcuts[key] && mask) {
            key = `${keyModifier.any}:${code}`;
        }
        const handler = this.shortcuts[key];
        if (handler && handler(this.ctx, evt) !== false) {
            evt.preventDefault();
            return true;
        }
        return false;
    }
}
/**
 * Возвращает маску модификаторов из указанного события
 */
function maskFromEvent(evt) {
    let mod = 0;
    if (evt.altKey) {
        mod |= keyModifier.alt;
    }
    if (evt.shiftKey) {
        mod |= keyModifier.shift;
    }
    if (evt.ctrlKey) {
        mod |= keyModifier.ctrl;
    }
    if (evt.metaKey) {
        mod |= keyModifier.meta;
    }
    return mod;
}
/**
 * Возвращает нормализованное название клавиши из события
 */
function getCode(str) {
    return str.replace(/^(Key|Digit|Numpad)/, '').toLowerCase();
}
/**
 * Парсит указанный шорткат во внутренний ключ для идентификации
 */
function parse(shortcut) {
    let mod = 0;
    let key = '';
    shortcut.toLowerCase().split(/[+-]/g).forEach(part => {
        if (part === 'cmd') {
            part = navigator.platform === 'MacIntel' ? 'meta' : 'ctrl';
        }
        if (part in keyModifier) {
            mod |= keyModifier[part];
        }
        else {
            key = part;
        }
    });
    return `${mod}:${key}`;
}
function getKey(code) {
    if (code === 27) {
        return 'Escape';
    }
    if (code === 13) {
        return 'Enter';
    }
    return String.fromCharCode(code);
}

/** MIME-тип для хранения отформатированной строки в буффере */
const fragmentMIME = 'tamtam/fragment';
const defaultPickLinkOptions = {
    url: cur => prompt('Введите ссылку', cur)
};
const blockElements = new Set(['DIV', 'P', 'BLOCKQUOTE']);
// const blockElements = new Set<string>(['BR']);
class Editor {
    /**
     * @param element Контейнер, в котором будет происходить редактирование
     */
    constructor(element, options = {}) {
        this.element = element;
        this.options = options;
        this._inited = false;
        this.caret = [0, 0];
        this.focused = false;
        this.expectEnter = false;
        this.inputState = null;
        this.onKeyDown = (evt) => {
            if (!evt.defaultPrevented) {
                this.shortcuts.handle(evt);
            }
            this.waitExpectedEnter(evt);
        };
        this.onCompositionStart = () => {
            this.expectEnter = false;
            this.handleBeforeInput(true);
        };
        this.onCompositionEnd = (evt) => {
            this.handleInput(evt.data);
        };
        this.onBeforeInput = () => {
            var _a;
            if (!((_a = this.inputState) === null || _a === void 0 ? void 0 : _a.composing)) {
                this.handleBeforeInput();
            }
        };
        this.onInput = (evt) => {
            var _a;
            this.expectEnter = false;
            if (!((_a = this.inputState) === null || _a === void 0 ? void 0 : _a.composing)) {
                this.handleInput(getInputEventText(evt));
            }
        };
        this.onSelectionChange = () => {
            const range = getTextRange(this.element);
            if (range) {
                this.saveSelection(range);
            }
        };
        /**
         * Обработка события копирования текста
         */
        this.onCopy = (evt) => {
            if (this.copyFragment(evt.clipboardData)) {
                evt.preventDefault();
            }
        };
        /**
         * Обработка события вырезания текста
         */
        this.onCut = (evt) => {
            if (this.copyFragment(evt.clipboardData, true)) {
                evt.preventDefault();
            }
        };
        /**
         * Обработка события вставки текста
         */
        this.onPaste = (evt) => {
            const range = getTextRange(this.element);
            let fragment = evt.clipboardData.getData(fragmentMIME);
            if (fragment) {
                fragment = JSON.parse(fragment);
            }
            else if (evt.clipboardData.types.includes('Files')) ;
            else {
                fragment = evt.clipboardData.getData('text/plain');
                if (!fragment) {
                    const html = evt.clipboardData.getData('text/html');
                    if (html) {
                        fragment = htmlToText(html);
                    }
                }
            }
            if (fragment && range) {
                evt.stopPropagation();
                evt.preventDefault();
                const len = typeof fragment === 'string'
                    ? fragment.length : getLength(fragment);
                this.paste(fragment, range[0], range[1]);
                this.setSelection(range[0] + len);
                requestAnimationFrame(() => retainNewlineInViewport(this.element));
            }
        };
        this.onClick = (evt) => {
            if (isEmoji(evt.target)) {
                // Кликнули на эмоджи, будем позиционировать каретку относительно
                // него
                const elem = evt.target;
                const rect = elem.getBoundingClientRect();
                const center = rect.left + rect.width * 0.6;
                const range = document.createRange();
                if (evt.clientX < center) {
                    range.setStartBefore(elem);
                    range.setEndBefore(elem);
                }
                else {
                    range.setStartAfter(elem);
                    range.setEndAfter(elem);
                }
                setDOMRange(range);
            }
        };
        this.onFocus = () => this.focused = true;
        this.onBlur = () => this.focused = false;
        const value = options.value || '';
        this.model = parse$1(value, options.parse);
        this.history = new History({
            compactActions: ["insert" /* Insert */, "remove" /* Remove */]
        });
        this.shortcuts = new Shortcuts(this);
        this.setup();
        // this.setSelection(value.length);
        this.history.push(this.model, 'init', this.caret);
        this._inited = true;
    }
    get model() {
        return this._model;
    }
    set model(value) {
        if (this._model !== value) {
            this._model = value;
            this.render();
            this.emit('editor-update');
        }
    }
    /**
     * Вернёт `true` если редактор работает в режиме Markdown
     */
    get isMarkdown() {
        var _a;
        return !!((_a = this.options.parse) === null || _a === void 0 ? void 0 : _a.markdown);
    }
    /**
     * Настраивает редактор для работы. Вынесено в отдельный метод для удобного
     * переопределения
     */
    setup() {
        const { element } = this;
        element.contentEditable = 'true';
        element.addEventListener('keydown', this.onKeyDown);
        element.addEventListener('compositionstart', this.onCompositionStart);
        element.addEventListener('compositionend', this.onCompositionEnd);
        element.addEventListener('beforeinput', this.onBeforeInput);
        element.addEventListener('input', this.onInput);
        element.addEventListener('cut', this.onCut);
        element.addEventListener('copy', this.onCopy);
        element.addEventListener('paste', this.onPaste);
        element.addEventListener('click', this.onClick);
        element.addEventListener('focus', this.onFocus);
        element.addEventListener('blur', this.onBlur);
        document.addEventListener('selectionchange', this.onSelectionChange);
        const { shortcuts } = this.options;
        if (shortcuts) {
            this.shortcuts.registerAll(shortcuts);
        }
    }
    /**
     * Вызывается для того, чтобы удалить все связи редактора с DOM.
     */
    dispose() {
        this.element.removeEventListener('keydown', this.onKeyDown);
        this.element.removeEventListener('compositionstart', this.onCompositionStart);
        this.element.removeEventListener('compositionend', this.onCompositionEnd);
        this.element.removeEventListener('beforeinput', this.onBeforeInput);
        this.element.removeEventListener('input', this.onInput);
        this.element.removeEventListener('cut', this.onCut);
        this.element.removeEventListener('copy', this.onCopy);
        this.element.removeEventListener('paste', this.onPaste);
        this.element.removeEventListener('click', this.onClick);
        this.element.removeEventListener('focus', this.onFocus);
        this.element.removeEventListener('blur', this.onBlur);
        document.removeEventListener('selectionchange', this.onSelectionChange);
    }
    /////////// Публичные методы для работы с текстом ///////////
    /**
     * Вставляет текст в указанную позицию
     */
    insertText(pos, text) {
        let updated = this.isMarkdown
            ? mdInsertText(this.model, pos, text, this.options.parse)
            : insertText(this.model, pos, text, this.options.parse);
        if (this.options.resetFormatOnNewline && !this.isMarkdown && /^[\n\r]+$/.test(text)) {
            updated = setFormat(updated, TokenFormat.None, pos, text.length);
        }
        const result = this.updateModel(updated, "insert" /* Insert */, [pos, pos + text.length]);
        this.setSelection(pos + text.length);
        return result;
    }
    /**
     * Удаляет указанный диапазон текста
     */
    removeText(from, to) {
        const updated = this.isMarkdown
            ? mdRemoveText(this.model, from, to - from, this.options.parse)
            : removeText(this.model, from, to - from, this.options.parse);
        const result = this.updateModel(updated, "remove" /* Remove */, [from, to]);
        this.setSelection(from);
        return result;
    }
    /**
     * Заменяет текст в указанном диапазоне `from:to` на новый
     */
    replaceText(from, to, text) {
        const result = this.paste(text, from, to);
        this.setSelection(from + text.length);
        return result;
    }
    /**
     * Вырезает фрагмент по указанному диапазону из модели и возвращает его
     * @returns Вырезанный фрагмент модели
     */
    cut(from, to) {
        const result = this.isMarkdown
            ? mdCutText(this.model, from, to, this.options.parse)
            : cutText(this.model, from, to, this.options.parse);
        this.updateModel(result.tokens, 'cut', [from, to]);
        return result.cut;
    }
    /**
     * Вставка текста в указанную позицию
     */
    paste(text, from, to) {
        const value = typeof text === 'string' ? text : getText(text);
        let next = this.isMarkdown
            ? mdReplaceText(this.model, from, to - from, value, this.options.parse)
            : replaceText(this.model, from, to - from, value, this.options.parse);
        // Применяем форматирование из фрагмента
        if (Array.isArray(text)) {
            let offset = from;
            text.forEach(token => {
                const len = token.value.length;
                if (token.format) {
                    next = this.setFormat(next, { add: token.format }, [offset, len]);
                }
                if (isCustomLink(token)) {
                    next = setLink(next, token.link, offset, len);
                }
                offset += len;
            });
        }
        return this.updateModel(next, 'paste', [from, to]);
    }
    /**
     * Ставит фокус в редактор
     */
    focus() {
        this.element.focus();
        this.setSelection(this.caret[0], this.caret[1]);
    }
    /**
     * Обновляет форматирование у указанного диапазона
     */
    updateFormat(format, from, to = from) {
        const range = [from, to - from];
        const result = this.updateModel(this.setFormat(this.model, format, range), 'format', [from, to]);
        setRange(this.element, range[0], range[0] + range[1]);
        this.emit('editor-formatchange');
        return result;
    }
    /**
     * Переключает указанный формат у заданного диапазона текста
     */
    toggleFormat(format, from, to) {
        if (from == null) {
            const range = this.getSelection();
            from = range[0];
            to = range[1];
        }
        else if (to == null) {
            to = from;
        }
        let source;
        if (from !== to) {
            const fragment = slice(this.model, from, to);
            source = fragment[0];
        }
        else {
            const pos = tokenForPos(this.model, from, "start" /* Start */);
            if (pos.index !== -1) {
                source = this.model[pos.index];
            }
        }
        if (source) {
            const update = source.format & format
                ? { remove: format } : { add: format };
            return this.updateFormat(update, from, to);
        }
        else if (!this.model.length && format) {
            return this.updateFormat({ add: format }, 0, 0);
        }
        return this.model;
    }
    /**
     * Выбрать ссылку для указанного диапазона
     * @param callback Функция, которая на вход примет текущую ссылку в указанном
     * диапазоне (если она есть), и должна вернуть новую ссылку. Если надо убрать
     * ссылку, функция должна вернуть пустую строку
     */
    pickLink(options = defaultPickLinkOptions) {
        const [from, to] = options.range || this.getSelection();
        let token = this.tokenForPos(from);
        let currentUrl = '';
        if (token) {
            if (token.format & TokenFormat.LinkLabel) {
                // Это подпись к ссылке в MD-формате. Найдём саму ссылку
                let ix = this.model.indexOf(token) + 1;
                while (ix < this.model.length) {
                    token = this.model[ix++];
                    if (token.type === "link" /* Link */) {
                        break;
                    }
                }
            }
            if (token.type === "link" /* Link */) {
                currentUrl = token.link;
            }
        }
        const result = options.url(currentUrl);
        if (result && typeof result === 'object' && result.then) {
            result.then(nextUrl => {
                if (nextUrl !== currentUrl) {
                    this.setLink(nextUrl, from, to);
                }
            });
        }
        else if (result !== currentUrl) {
            this.setLink(result, from, to);
        }
    }
    /**
     * Ставит ссылку на `url` на указанный диапазон. Если `url` пустой или равен
     * `null`, удаляет ссылку с указанного диапазона
     */
    setLink(url, from, to = from) {
        if (url) {
            url = url.trim();
        }
        let updated;
        const range = [from, to - from];
        if (this.isMarkdown) {
            const text = mdToText(this.model, range);
            const next = setLink(text, url, range[0], range[1]);
            updated = parse$1(textToMd(next, range), this.options.parse);
        }
        else {
            updated = setLink(this.model, url, range[0], range[1]);
        }
        const result = this.updateModel(updated, 'link', [from, to]);
        setRange(this.element, range[0], range[0] + range[1]);
        return result;
    }
    /**
     * Отменить последнее действие
     */
    undo() {
        if (this.history.canUndo) {
            const entry = this.history.undo();
            this.updateModel(entry.state, false);
            const { current } = this.history;
            if (current) {
                const range = current.caret || current.range;
                if (range) {
                    this.setSelection(range[0], range[1]);
                }
            }
            return entry;
        }
    }
    /**
     * Повторить последнее отменённое действие
     */
    redo() {
        if (this.history.canRedo) {
            const entry = this.history.redo();
            this.updateModel(entry.state, false);
            const range = entry.caret || entry.range;
            if (range) {
                this.setSelection(range[0], range[1]);
            }
            return entry;
        }
    }
    /**
     * Возвращает фрагмент модели для указанного диапазона
     */
    slice(from, to) {
        return slice(this.model, from, to);
    }
    /**
     * Возвращает токен для указанной позиции
     * @param tail В случае, если позиция `pos` указывает на границу токенов,
     * при `tail: true` вернётся токен слева от границы, иначе справа
     */
    tokenForPos(pos, tail) {
        let offset = 0;
        let len = 0;
        const { model } = this;
        for (let i = 0, token; i < model.length; i++) {
            token = model[i];
            len = offset + token.value.length;
            if (pos >= offset && (tail ? pos <= len : pos < len)) {
                return token;
            }
            offset += token.value.length;
        }
        if (offset === pos) {
            // Указали самый конец строки — вернём последний токен
            return model[model.length - 1];
        }
    }
    /**
     * Возвращает текущее выделение в виде текстового диапазона
     */
    getSelection() {
        return this.caret;
    }
    /**
     * Указывает текущее выделение текста или позицию каретки
     */
    setSelection(from, to = from) {
        const maxIx = getLength(this.model);
        [from, to] = this.normalizeRange([from, to]);
        this.saveSelection([from, to]);
        if (from === maxIx && to === maxIx) {
            // Ставим позицию в самый конец поля ввода.
            // Если в тексте есть несколько строк, браузеры будут немного тупить:
            // 1. Если `\n` есть в конце ввода, браузеры его не отобразят, поэтому
            //    внутри функции `render()` мы принудительно добавляем `<br>`
            //    в конце (см. fixNewLine)
            // 2. В случае с Firefox не получится правильно спозиционировать каретку,
            //    ему зачем-то нужна позиция перед `\n`, что не соответствует
            //    поведению других браузеров
            // Поэтому для многострочного ввода, если в конце есть перевод строки,
            // мы будем выставлять диапазон перед фиктивным `<br>`
            const { lastChild } = this.element;
            if (lastChild && lastChild.nodeName === 'BR') {
                const offset = this.element.childNodes.length - 1;
                const range = document.createRange();
                range.setStart(this.element, offset);
                range.setEnd(this.element, offset);
                setDOMRange(range);
                return;
            }
        }
        setRange(this.element, from, to);
    }
    /**
     * Заменяет текущее значение редактора на указанное. При этом полностью
     * очищается история изменений редактора
     */
    setValue(value, selection) {
        if (typeof value === 'string') {
            value = parse$1(value, this.options.parse);
        }
        if (!selection) {
            const len = getText(value).length;
            selection = [len, len];
        }
        this.model = value;
        if (this.focused) {
            this.setSelection(selection[0], selection[1]);
        }
        else {
            this.saveSelection(this.normalizeRange(selection));
        }
        this.history.clear();
        this.history.push(this.model, 'init', this.caret);
    }
    /**
     * Возвращает текущее текстовое значение модели редактора
     */
    getText(tokens = this.model) {
        return getText(tokens);
    }
    /**
     * Обновляет опции редактора
     */
    setOptions(options) {
        var _a, _b;
        let markdownUpdated = false;
        if (options.shortcuts) {
            this.shortcuts.unregisterAll();
            this.shortcuts.registerAll(options.shortcuts);
        }
        if (options.parse) {
            const markdown = !!((_a = this.options.parse) === null || _a === void 0 ? void 0 : _a.markdown);
            markdownUpdated = options.parse.markdown !== markdown;
        }
        this.options = Object.assign(Object.assign({}, this.options), options);
        if (markdownUpdated) {
            const sel = this.getSelection();
            const range = [sel[0], sel[1] - sel[0]];
            const tokens = ((_b = this.options.parse) === null || _b === void 0 ? void 0 : _b.markdown)
                ? textToMd(this.model, range)
                : mdToText(this.model, range);
            this.setValue(tokens, [range[0], range[0] + range[1]]);
        }
        else {
            this.render();
        }
    }
    /**
     * Возвращает строковое содержимое поля ввода
     */
    getInputText() {
        const walker = this.element.ownerDocument.createTreeWalker(this.element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        let result = '';
        let node;
        let raw;
        while (node = walker.nextNode()) {
            if (node.nodeType === Node.TEXT_NODE) {
                result += node.nodeValue;
            }
            else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.nodeName === 'BR') {
                    result += '\n';
                }
                else {
                    raw = node.getAttribute('data-raw');
                    if (raw) {
                        result += raw;
                    }
                    else if (blockElements.has(node.nodeName) && result.length > 0 && result.slice(-1) !== '\n') {
                        result += '\n';
                    }
                }
            }
        }
        if (result.slice(-1) === '\n') {
            // С учётом костыля рендеринга переводов строк в конце:
            // в методе `render()` добавляется ещё один для правильной отрисовки.
            // Мы его тут удалим
            result = result.slice(0, -1);
        }
        return result;
    }
    /**
     * Подписываемся на указанное событие
     */
    on(eventType, listener, options) {
        this.element.addEventListener(eventType, listener, options);
        return this;
    }
    /**
     * Отписываемся от указанного события
     */
    off(eventType, listener, options) {
        this.element.removeEventListener(eventType, listener, options);
        return this;
    }
    /**
     * Сохраняет указанный диапазон в текущей записи истории в качестве последнего
     * известного выделения
     */
    saveSelection(range) {
        const { caret } = this;
        this.caret = range;
        this.history.saveCaret(range);
        if (caret[0] !== range[0] || caret[1] !== range[1]) {
            this.emit('editor-selectionchange');
        }
    }
    /**
     * Обновляет значение модели редактора с добавлением записи в историю изменений
     * @param value Новое значение модели
     * @param action Название действия, которое привело к изменению истории, или
     * `false`, если не надо добавлять действие в историю
     * @param range Диапазон выделения, который нужно сохранить в качестве текущего
     * в записи в истории
     */
    updateModel(value, action, range) {
        const prev = this.model;
        if (value !== prev) {
            if (typeof action === 'string') {
                this.history.push(value, action, range);
            }
            this.model = value;
        }
        return this.model;
    }
    /**
     * Правильно помещает фрагмент текста в буффер. Вместе с обычным текстом
     * туда помещается сериализованный фрагмент модели, чтобы сохранить форматирование
     */
    copyFragment(clipboard, cut) {
        const range = getTextRange(this.element);
        if (range && !isCollapsed(range)) {
            const fragment = cut
                ? this.cut(range[0], range[1])
                : this.slice(range[0], range[1]);
            clipboard.setData('text/plain', getText(fragment));
            if (!this.isMarkdown) {
                clipboard.setData(fragmentMIME, JSON.stringify(fragment));
            }
            if (cut) {
                this.setSelection(range[0]);
            }
            return true;
        }
        return false;
    }
    /**
     * Применяет новый формат к указанному диапазону и возвращает новый набор токенов
     */
    setFormat(tokens, format, range) {
        if (this.isMarkdown) {
            // С изменением MD-форматирования немного схитрим: оставим «чистый» набор
            // токенов, без MD-символов, и поменяем ему формат через стандартный `setFormat`.
            // Полученный результат обрамим MD-символами для получения нужного результата
            // и заново распарсим
            const text = mdToText(tokens, range);
            const updated = setFormat(text, format, range[0], range[1]);
            return parse$1(textToMd(updated, range), this.options.parse);
        }
        return setFormat(tokens, format, range[0], range[1]);
    }
    render() {
        var _a;
        render(this.element, this.model, {
            fixTrailingLine: true,
            replaceTextEmoji: (_a = this.options.parse) === null || _a === void 0 ? void 0 : _a.textEmoji,
            emoji: this.options.emoji,
            nowrap: this.options.nowrap
        });
    }
    emit(eventName) {
        if (this._inited) {
            dispatch(this.element, eventName, { editor: this });
        }
    }
    normalizeRange([from, to]) {
        const maxIx = getLength(this.model);
        return [clamp(from, 0, maxIx), clamp(to, 0, maxIx)];
    }
    waitExpectedEnter(evt) {
        if (!this.expectEnter && !evt.defaultPrevented && evt.key === 'Enter') {
            this.expectEnter = true;
            requestAnimationFrame(() => {
                if (this.expectEnter) {
                    this.expectEnter = false;
                    this.insertOrReplaceText(getTextRange(this.element), '\n');
                    retainNewlineInViewport(this.element);
                }
            });
        }
    }
    insertOrReplaceText(range, text) {
        return isCollapsed(range)
            ? this.insertText(range[0], text)
            : this.replaceText(range[0], range[1], text);
    }
    handleBeforeInput(composing = false) {
        const range = getTextRange(this.element);
        if (range) {
            this.inputState = {
                range,
                text: this.getInputText(),
                composing
            };
        }
    }
    handleInput(insert) {
        const { inputState } = this;
        if (!inputState) {
            return;
        }
        const range = getTextRange(this.element);
        const insertFrom = Math.min(inputState.range[0], range[0]);
        const removeFrom = insertFrom;
        let insertTo = range[1];
        let removeTo = inputState.range[1];
        if (!insert) {
            const text = this.getInputText();
            if (isCollapsed(range) && insertFrom === removeFrom && insertTo === removeTo) {
                const delta = inputState.text.length - text.length;
                if (delta > 0) {
                    // Удалили текст
                    removeTo += delta;
                }
                else if (delta < 0) {
                    // Добавили текст, но почему-то не отследили (перевод строки?)
                    insertTo -= delta;
                }
            }
            insert = text.slice(insertFrom, insertTo);
        }
        if (insert) {
            // Вставка текста
            if (removeFrom !== removeTo) {
                this.replaceText(removeFrom, removeTo, insert);
            }
            else {
                this.insertText(insertFrom, insert);
            }
        }
        else if (removeFrom !== removeTo) {
            // Удаление текста
            this.removeText(removeFrom, removeTo);
        }
        this.inputState = null;
    }
}
/**
 * Возвращает текстовое содержимое указанных токенов
 */
function getText(tokens) {
    return tokens.map(t => t.value).join('');
}
function isCollapsed(range) {
    return range[0] === range[1];
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
/**
 * Парсинг HTML-содержимого буффера обмена в обычный текст.
 * Используется для некоторых редких кейсов в Safari.
 * Например, есть сайт https://emojifinder.com, в котором результаты поиска
 * по эмоджи выводится как набор `<input>` элементов.
 * Если копировать такой результат, то Chrome правильно сделает plain-text представление
 * результата, а Safari — нет. В итоге в Safari мы получим пустой текст, а вставленный
 * HTML неправильно обработается и уронит вкладку. В этом методе мы попробуем
 * достать текст из такого HTML-представления
 */
function htmlToText(html) {
    const elem = document.createElement('template');
    elem.innerHTML = html;
    const walker = document.createTreeWalker(elem.content || elem, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.currentNode;
    let result = '';
    while (node) {
        if (node.nodeName === 'INPUT') {
            result += node.value;
        }
        else if (node.nodeType === node.TEXT_NODE) {
            result += node.nodeValue;
        }
        node = walker.nextNode();
    }
    return result;
}
/**
 * Вспомогательная функция, которая при необходимости подкручивает вьюпорт
 * к текущему переводу строки
 */
function retainNewlineInViewport(element) {
    const sel = window.getSelection();
    const r = sel.getRangeAt(0);
    if (!(r === null || r === void 0 ? void 0 : r.collapsed)) {
        return;
    }
    let rect = r.getClientRects().item(0);
    if ((!rect || !rect.height) && isElement(r.startContainer)) {
        const target = getScrollTarget(r);
        if (target) {
            rect = target.getBoundingClientRect();
        }
    }
    if (rect && rect.height > 0) {
        // Есть прямоугольник, к которому можем прицепиться: проверим, что он видим
        // внутри элемента и если нет, подскроллимся к нему
        const parentRect = element.getBoundingClientRect();
        if (rect.top < parentRect.top || rect.bottom > parentRect.bottom) {
            // Курсор за пределами вьюпорта
            element.scrollTop += rect.top - (parentRect.top + parentRect.height / 2);
        }
    }
}
/**
 * Вернёт элемент, к которому нужно подскроллится.
 */
function getScrollTarget(r) {
    let target = r.startContainer.childNodes[r.startOffset];
    if ((target === null || target === void 0 ? void 0 : target.nodeName) === 'BR') {
        return target;
    }
    target = r.startContainer.childNodes[r.startOffset - 1];
    if ((target === null || target === void 0 ? void 0 : target.nodeName) === 'BR') {
        return target;
    }
}
function getInputEventText(evt) {
    if (evt.inputType === 'insertParagraph') {
        return '\n';
    }
    if (evt.data != null) {
        return evt.data;
    }
    // Расширение для Safari, используется. например, для подстановки
    // нового значения на длинное нажатие клавиши (е → ё)
    if (evt.dataTransfer) {
        return evt.dataTransfer.getData('text/plain');
    }
    return '';
}

function split(rawTokens, chunkSize) {
    // Алгоритм разбивки:
    // 1. Из текста берём фрагмент в диапазоне [start, chunkSize]
    // 2. Правую границу фрагмента смещаем до тех пор, пока не найдём место,
    //    в котором можем поделить текст (пробел)
    // 3. Из полученного диапазона достаём кусок токенов и добавляем как чанк
    // 4. Сканироание продолжаем от правой границы диапазона
    // Удалим пустые токены, чтобы не мешались, а также удалим проблемы в начале
    // и в конце сообщения
    rawTokens = rawTokens.filter(token => token.value.length > 0);
    const result = [];
    const { text, tokens } = trim(rawTokens);
    let start = 0;
    let end = 0;
    let endBound = 0;
    while (start < text.length) {
        end = start + chunkSize;
        if (end >= text.length) {
            // Дошли до конца
            result.push(slice(tokens, start));
        }
        else {
            // Подвинем границу влево до ближайшего пробела
            while (end > start && !isWhitespace(text.charCodeAt(end))) {
                end--;
            }
            if (start !== end) {
                // Есть точка деления, уберём пробелы в конце
                endBound = end;
                while (endBound > start && isWhitespace(text.charCodeAt(endBound - 1))) {
                    endBound--;
                }
                if (start !== endBound) {
                    result.push(slice(tokens, start, endBound));
                }
            }
            else {
                // Нет точки деления, придётся разрезать как есть
                end = start + chunkSize;
                result.push(slice(tokens, start, end));
            }
        }
        start = end;
        // Подвинем точку старта вперёд, чтобы убрать пробелы
        while (start < text.length && isWhitespace(text.charCodeAt(start))) {
            start++;
        }
    }
    return result;
}
/**
 * Удаляет пробелы в начале и в конце строки
 */
function trim(tokens) {
    let text = getText$1(tokens);
    const m1 = text.match(/^\s+/);
    if (m1) {
        text = text.slice(m1[0].length);
        tokens = slice(tokens, m1[0].length);
    }
    const m2 = text.match(/\s+$/);
    if (m2) {
        text = text.slice(0, -m2[0].length);
        tokens = slice(tokens, 0, -m2[0].length);
    }
    return { text, tokens };
}

export { Editor, TokenFormat, codePointAt, getLength, getText$1 as getText, locationToRange, mdToText, parse$1 as parse, rangeToLocation, render, setFormat, setLink, slice, split, textToMd, tokenForPos };
