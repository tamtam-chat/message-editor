import type { BaseEditorOptions, Model } from "../editor/types";
import { getInputEventText, getText, handleSkipEvent, inputToFormat } from "../editor/update";
import { CutText, setLink, slice, TextRange, TokenFormatUpdate, tokenForPos } from "../formatted-string";
import { getLength, Token, TokenFormat } from "../parser";
import { setFormat as plainSetFormat } from "../formatted-string";
import parseMD from "../md-parser";
import { isCustomLink } from "../formatted-string/utils";
import { getInputText } from "../editor/utils";
import { mdCutText, mdInsertText, mdRemoveText, mdReplaceText, mdToText, textToMd } from "../md-formatted-string";

/**
 * Вставляет указанный текст в модель в указанную позицию
 */
export function insertTextMD(model: Model, pos: number, text: string, options: BaseEditorOptions): Model {
    return mdInsertText(model, pos, text, options.parse);
}

/**
 * Вырезает фрагмент по указанному диапазону из модели и возвращает его
 */
 export function cutTextMD(model: Model, from: number, to: number, options: BaseEditorOptions): CutText {
    return mdCutText(model, from, to, options.parse)
}

export function updateFromInputEventMD(evt: InputEvent, model: Model, range: TextRange, options: BaseEditorOptions): Model {
    const updated = handleSkipEvent(evt, model)
        || handleFormatEventMD(evt, model, range, options)
        || handleInsertEventMD(evt, model, range, options);

    if (updated) {
        return updated;
    }

    if (evt.inputType.startsWith('delete')) {
        return removeTextMD(model, range[0], range[1], options);
    }

    return model;
}

export function updateFromInputEventFallbackMD(evt: InputEvent, model: Model, range: TextRange, prevRange: TextRange, options: BaseEditorOptions): Model {
    const updated = handleSkipEvent(evt, model)
        || handleFormatEventMD(evt, model, range, options)
        || handleInsertEventMD(evt, model, prevRange, options);

    if (updated) {
        return updated;
    }

    if (evt.inputType.startsWith('delete')) {
        const [from, to] = range;
        const [prevFrom, prevTo] = prevRange;
        const boundFrom = Math.min(from, prevFrom);
        let boundTo = Math.max(to, prevTo);

        if (boundFrom === boundTo && evt.inputType.includes('Forward')) {
            const curLen = getInputText(evt.currentTarget as Element).length;
            const prevLen = getLength(model);
            if (prevLen > curLen) {
                boundTo += prevLen - curLen;
            }
        }

        return removeTextMD(model, boundFrom, boundTo, options);
    }

    return model;
}


export function removeTextMD(model: Model, from: number, to: number, options: BaseEditorOptions): Model {
    return mdRemoveText(model, from, to - from, options.parse);
}

export function replaceTextMD(model: Model, text: Model | string, from: number, to: number, options: BaseEditorOptions): Model {
    const value = typeof text === 'string' ? text : getText(text);
    model = mdReplaceText(model, from, to - from, value, options.parse)

    // Применяем форматирование из фрагмента
    if (Array.isArray(text)) {
        model = applyFormatFromFragmentMD(model, text, from, options);
    }

    return model;
}

export function applyFormatFromFragmentMD(model: Model, fragment: Model, offset = 0, options: BaseEditorOptions): Model {
    fragment.forEach(token => {
        const len = token.value.length;
        if ('sticky' in token && token.sticky) {
            model = setFormatMD(model, token.format, offset, offset + len, options);
        } else if (token.format) {
            model = setFormatMD(model, { add: token.format }, offset, offset + len, options);
        }

        if (isCustomLink(token)) {
            model = setLink(model, token.link, offset, len);
        }

        offset += len;
    });

    return model;
}

function handleFormatEventMD(evt: InputEvent, model: Model, range: TextRange, options: BaseEditorOptions): Model | undefined {
    const { inputType } = evt;
    if (inputType.startsWith('format')) {
        const [from, to] = range;
        // Применяем форматирование: скорее всего это Safari с тачбаром
        if (inputType === 'formatFontColor') {
            const update: TokenFormatUpdate = /^rgb\(0,\s*0,\s*0\)/.test(evt.data) || evt.data === 'transparent'
                ? { remove: TokenFormat.Marked }
                : { add: TokenFormat.Marked };

            return plainSetFormat(model, update, from, to - from);
        }

        if (inputType === 'formatRemove') {
            return plainSetFormat(model, TokenFormat.None, from, to - from);
        }

        if (inputType in inputToFormat) {
            return toggleFormatMD(model, inputToFormat[inputType], from, to, options);
        }

        return model;
    }
}

function handleInsertEventMD(evt: InputEvent, model: Model, range: TextRange, options: BaseEditorOptions): Model | undefined {
    if (evt.inputType.startsWith('insert')) {
        const text = getInputEventText(evt);
        return replaceTextMD(model, text, range[0], range[1], options);
    }
}

export function toggleFormatMD(model: Model, format: TokenFormat, from: number, to: number, options: BaseEditorOptions): Model {
    let source: Token | undefined;
    if (from !== to) {
        const fragment = slice(model, from, to);
        source = fragment[0];
    } else {
        const pos = tokenForPos(model, from, 'start');
        if (pos.index !== -1) {
            source = model[pos.index];
        }
    }

    if (source) {
        const update: TokenFormatUpdate = source.format & format
            ? { remove: format }
            : { add: format };

        return setFormatMD(model, update, from, to, options);
    }

    if (!model.length && format) {
        return setFormatMD(model, { add: format }, 0, 0, options);
    }

    return model;
}

/**
 * Применяет новый формат к указанному диапазону и возвращает новый набор токенов
 */
 export function setFormatMD(tokens: Model, format: TokenFormat | TokenFormatUpdate, from: number, to: number, options: BaseEditorOptions): Model {
    // С изменением MD-форматирования немного схитрим: оставим «чистый» набор
    // токенов, без MD-символов, и поменяем ему формат через стандартный `setFormat`.
    // Полученный результат обрамим MD-символами для получения нужного результата
    // и заново распарсим
    const len = to - from;
    const text = mdToText(tokens, [from, len]);
    const updated = plainSetFormat(text, format, from, len);
    return parseMD(textToMd(updated, [from, len]), options.parse);
}
