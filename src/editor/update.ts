import { getLength, Token } from '../parser';
import parse, { TokenFormat } from '../parser';
import {
    insertText as plainInsertText, removeText as plainRemoveText, replaceText as plainReplaceText,
    mdInsertText, mdRemoveText, mdReplaceText, mdCutText, mdToText, textToMd,
    cutText as plainCutText, setFormat as plainSetFormat, setLink, slice,
} from '../formatted-string';
import type { TokenFormatUpdate, CutText } from '../formatted-string';
import { isCustomLink, tokenForPos } from '../formatted-string/utils';
import type { BaseEditorOptions, TextRange, Model } from './types';
import { getInputText } from './utils';

const skipInputTypes = new Set<string>([
    'insertOrderedList',
    'insertUnorderedList',
    'deleteOrderedList',
    'deleteUnorderedList'
]);

/**
 * Вставляет указанный текст в модель в указанную позицию
 */
export function insertText(model: Model, pos: number, text: string, options: BaseEditorOptions): Model {
    const md = isMarkdown(options);
    let updated = md
        ? mdInsertText(model, pos, text, options.parse)
        : plainInsertText(model, pos, text, options.parse);

    if (options.resetFormatOnNewline && !md && /^[\n\r]+$/.test(text)) {
        updated = plainSetFormat(updated, TokenFormat.None, pos, text.length);
    }

    return updated;
}

export function removeText(model: Model, from: number, to: number, options: BaseEditorOptions): Model {
    return isMarkdown(options)
        ? mdRemoveText(model, from, to - from, options.parse)
        : plainRemoveText(model, from, to - from, options.parse);
}

export function replaceText(model: Model, text: Model | string, from: number, to: number, options: BaseEditorOptions): Model {
    const value = typeof text === 'string' ? text : getText(text);
    model = isMarkdown(options)
        ? mdReplaceText(model, from, to - from, value, options.parse)
        : plainReplaceText(model, from, to - from, value, options.parse);

    // Применяем форматирование из фрагмента
    if (Array.isArray(text)) {
        model = applyFormatFromFragment(model, text, from, options);
    }

    return model;
}

/**
 * Вырезает фрагмент по указанному диапазону из модели и возвращает его
 */
export function cutText(model: Model, from: number, to: number, options: BaseEditorOptions): CutText {
    return isMarkdown(options)
        ? mdCutText(model, from, to, options.parse)
        : plainCutText(model, from, to, options.parse);
}

/**
 * Применяет новый формат к указанному диапазону и возвращает новый набор токенов
 */
export function setFormat(tokens: Model, format: TokenFormat | TokenFormatUpdate, from: number, to: number, options: BaseEditorOptions): Model {
    const len = to - from;
    if (isMarkdown(options)) {
        // С изменением MD-форматирования немного схитрим: оставим «чистый» набор
        // токенов, без MD-символов, и поменяем ему формат через стандартный `setFormat`.
        // Полученный результат обрамим MD-символами для получения нужного результата
        // и заново распарсим
        const text = mdToText(tokens, [from, len]);
        const updated = plainSetFormat(text, format, from, len);
        return parse(textToMd(updated, [from, len]), options.parse);
    }

    return plainSetFormat(tokens, format, from, len);
}

export function toggleFormat(model: Model, format: TokenFormat, from: number, to: number, options: BaseEditorOptions): Model {
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

        return setFormat(model, update, from, to, options);
    }

    if (!model.length && format) {
        return setFormat(model, { add: format }, 0, 0, options);
    }

    return model;
}

export function applyFormatFromFragment(model: Model, fragment: Model, offset = 0, options: BaseEditorOptions): Model {
    fragment.forEach(token => {
        const len = token.value.length;
        if (token.format) {
            model = setFormat(model, { add: token.format }, offset, offset + len, options);
        }

        if (isCustomLink(token)) {
            model = setLink(model, token.link, offset, len);
        }

        offset += len;
    });

    return model;
}

const inputToFormat: Record<string, TokenFormat> = {
    formatBold: TokenFormat.Bold,
    formatItalic: TokenFormat.Italic,
    formatUnderline: TokenFormat.Underline,
    formatStrikeThrough: TokenFormat.Strike
}

export function updateFromInputEventFallback(evt: InputEvent, model: Model, range: TextRange, prevRange: TextRange, options: BaseEditorOptions): Model {
    if (skipInputTypes.has(evt.inputType)) {
        evt.preventDefault();
        return model;
    }

    const { inputType } = evt;
    const [from, to] = range;
    const [prevFrom, prevTo] = prevRange;

    if (inputType.startsWith('format')) {
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
            return toggleFormat(model, inputToFormat[inputType], from, to, options);
        }

        return model;
    }

    if (inputType.startsWith('insert')) {
        const text = getInputEventText(evt);
        return replaceText(model, text, prevFrom, prevTo, options);
    }

    if (inputType.startsWith('delete')) {
        const boundFrom = Math.min(from, prevFrom);
        let boundTo = Math.max(to, prevTo);
        if (boundFrom === boundTo && inputType.includes('Forward')) {
            const curLen = getInputText(evt.currentTarget as Element).length;
            const prevLen = getLength(model);
            if (prevLen > curLen) {
                boundTo += prevLen - curLen;
            }
        }

        return removeText(model, boundFrom, boundTo, options);
    }

    return model;
}

export function updateFromInputEvent(model: Model, range: TextRange, evt: InputEvent, options: BaseEditorOptions, inputText?: string): Model {
    if (skipInputTypes.has(evt.inputType)) {
        evt.preventDefault();
        return model;
    }

    const [from, to] = range;

    if (evt.inputType.startsWith('format')) {
        // Применяем форматирование: скорее всего это Safari с тачбаром
        switch (evt.inputType) {
            case 'formatBold':
                model = toggleFormat(model, TokenFormat.Bold, from, to, options);
                break;
            case 'formatItalic':
                model = toggleFormat(model, TokenFormat.Italic, from, to, options);
                break;
            case 'formatUnderline':
                model = toggleFormat(model, TokenFormat.Underline, from, to, options);
                break;
            case 'formatStrikeThrough':
                model = toggleFormat(model, TokenFormat.Strike, from, to, options);
                break;
            case 'formatFontColor':
                // eslint-disable-next-line no-case-declarations
                const update: TokenFormatUpdate = /^rgb\(0,\s*0,\s*0\)/.test(evt.data) || evt.data === 'transparent'
                    ? { remove: TokenFormat.Marked }
                    : { add: TokenFormat.Marked };

                model = plainSetFormat(model, update, from, to - from);
                break;
        }

        // evt.preventDefault();
        return model;
    }

    if (evt.inputType.startsWith('insert')) {
        // В Chrome в событии `input` на действие insertReplacementText при
        // замене спеллчекера будет отсутствовать информация о заменяемом текст.
        // Поэтому текст пробрасывается снаружи
        const text = getInputEventText(evt) || inputText;
        return text
            ? replaceText(model, text, from, to, options)
            : model;
    }

    if (evt.inputType.startsWith('delete')) {
        return removeText(model, from, to, options);
    }

    console.warn('unknown action type', evt.inputType);
    return model;
}

/**
 * Возвращает текстовое содержимое указанных токенов
 */
export function getText(tokens: Token[]): string {
    return tokens.map(t => t.value).join('');
}

function isMarkdown(options: BaseEditorOptions): boolean {
    return !!(options.parse?.markdown);
}

export function getInputEventText(evt: InputEvent): string {
    if (evt.inputType === 'insertParagraph' || evt.inputType === 'insertLineBreak') {
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
