import type ParserState from './state';
import { Codes, isNumber } from './utils';

const enum EmojiCodes {
    /** Zero-width joiner */
    ZWJ = 0x200d,
    /** EMOJI MODIFIER FITZPATRICK TYPE-1-2 */
    SkinModifierFrom = 0x1f3fb,
    /** EMOJI MODIFIER FITZPATRICK TYPE-6 */
    SkinModifierTo = 0x1f3ff,
    Presentation = 0xfe0f,

    // Модифицирующие последовательности
    TagSeqStart = 0xe0020,
    TagSeqEnd = 0xe007e,
    TagSeqTerm = 0xe007f,
}

/**
 * Набор одиночных эмоджи в диапазоне от 0x2000 до 0x3300.
 * Генерируется из тест-задачи Generate Low Emoji в test/emoji.js
 */
const emojiLow = new Set([0x203c, 0x2049, 0x2122, 0x2139, 0x2328, 0x23cf, 0x24c2, 0x25b6, 0x25c0, 0x260e, 0x2611, 0x2618, 0x261d, 0x2620, 0x2626, 0x262a, 0x2640, 0x2642, 0x2663, 0x2668, 0x267b, 0x2699, 0x26a7, 0x26c8, 0x26d1, 0x26fd, 0x2702, 0x2705, 0x270f, 0x2712, 0x2714, 0x2716, 0x271d, 0x2721, 0x2728, 0x2744, 0x2747, 0x274c, 0x274e, 0x2757, 0x27a1, 0x27b0, 0x27bf, 0x2b50, 0x2b55, 0x3030, 0x303d, 0x3297, 0x3299]);

/**
 * Вернёт `true`, если удалось прочитать эмоджи из текущей позиции потока
 */
export default function parseEmoji(state: ParserState): boolean {
    const { pos } = state;
    if (!state.options.skipEmoji && consumeEmoji(state)) {
        state.pushEmoji(pos, state.pos);
        return true;
    }

    return false;
}

/**
 * Вспомогательный консьюмер для всех эмоджи
 * @param state
 */
export function consumeEmoji(state: ParserState): boolean {
    return keycap(state) || flag(state) || emoji(state) || forcedEmoji(state);
}

/**
 * Поглощает keycap-последовательность.
 * Особенностью keycap-последовательности является то, что она может начинаться
 * с базовых символов, например, цифр, которые после себя содержат специальные
 * коды, указывающие, что символ нужно показать как эмоджи
 */
export function keycap(state: ParserState): boolean {
    const { pos } = state;
    if (state.consume(isKeycapStart)) {
        // Этого символа может не быть
        state.consume(EmojiCodes.Presentation);
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
function flag(state: ParserState): boolean {
    const { pos } = state;

    if (state.consume(isRegionalIndicator) && state.consume(isRegionalIndicator)) {
        return true;
    }

    if (state.consume(0x1f3f4) && state.consume(isTagSequence)) {
        // Частный случай: флаги Англии, Шотландии и Уэльса
        while (state.hasNext()) {
            if (state.consume(EmojiCodes.TagSeqTerm)) {
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
function emoji(state: ParserState): boolean {
    const { pos } = state;

    // Одно изображение эмоджи может быть представлено как несколько самостоятельных
    // эмоджи, соединённых zero-width joiner (ZWJ)
    while (consumeEmojiItem(state)) {
        if (!state.consume(EmojiCodes.ZWJ)) {
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
function forcedEmoji(state: ParserState) {
    const start = state.pos;

    if (state.next() && state.consume(EmojiCodes.Presentation)) {
        return true;
    }

    state.pos = start;
    return false;
}

/**
 * Поглощает самостоятельный символ эмоджи в потоке
 */
function consumeEmojiItem(state: ParserState): boolean {
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
        state.consume(EmojiCodes.Presentation);
        return true;
    }

    state.pos = pos;
    return false;
}

function isKeycapStart(cp: number): boolean {
    return cp === Codes.Hash
        || cp === Codes.Asterisk
        || isNumber(cp);
}

function isRegionalIndicator(cp: number): boolean {
    return cp >= 0x1f1e6 && cp <= 0x1f1ff;
}

function isSkinModifier(cp: number): boolean {
    return cp >= EmojiCodes.SkinModifierFrom && cp <= EmojiCodes.SkinModifierTo;
}

function isTagSequence(cp: number): boolean {
    return cp >= EmojiCodes.TagSeqStart && cp <= EmojiCodes.TagSeqEnd;
}

function isGenderFlag(cp: number): boolean {
    return cp === 0x2640 || cp === 0x2642;
}

function isEmoji(cp: number): boolean {
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
