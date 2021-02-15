import { TokenEmoji, TokenType } from '../formatted-string/types';
import ParserState from './state';

const enum EmojiCodes {
    /** Zero-width joiner */
    ZWJ = 0x200d,
    /** EMOJI MODIFIER FITZPATRICK TYPE-1-2 */
    SkinModifierFrom = 0x1f3fb,
    /** EMOJI MODIFIER FITZPATRICK TYPE-6 */
    SkinModifierTo = 0x1f3ff,
    /** VARIATION SELECTOR-16 */
    Presentation = 0xfe0f,

    // Модифицирующие последовательности
    TagSeqStart = 0xe0020,
    TagSeqEnd = 0xe007e,
    TagSeqTerm = 0xe007f,
}

/**
 * Вернёт `true`, если удалось прочитать эмоджи из текущей позиции потока
 */
export default function parseEmoji(state: ParserState): boolean {
    const { pos } = state;
    if (keycap(state) || flag(state) || emoji(state) || forcedEmoji(state)) {
        state.push({
            type: TokenType.Emoji,
            format: state.format,
            value: state.substring(pos)
        });
        return true;
    }

    return false;
}

/**
 * Поглощает keycap-последовательность
 */
function keycap(state: ParserState): boolean {
    const pos = state.pos;
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
    while (consumeEmoji(state)) {
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
function consumeEmoji(state: ParserState): boolean {
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
    return cp === 35 /* # */
        || cp === 42 /* * */
        || cp >= 48 && cp <= 57 /* 0-9 */;
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
        || (cp >= 0x2000 && cp <= 0x3300)
        || (cp >= 0x1e400 && cp <= 0x1f3f)
        || (cp >= 0x1e800 && cp <= 0x1f7ff)
        || (cp >= 0x1ec00 && cp <= 0x1fbff);
}
