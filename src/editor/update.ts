import { getLength, Token } from '../parser';
import parse, { TokenFormat } from '../parser';
import {
    insertText as plainInsertText, removeText as plainRemoveText, replaceText as plainReplaceText,
    mdInsertText, mdRemoveText, mdReplaceText, mdCutText, mdToText, textToMd,
    cutText as plainCutText, setFormat as plainSetFormat, setLink, slice, updateEmojiData,
} from '../formatted-string';
import type { TokenFormatUpdate, CutText } from '../formatted-string';
import { createEmojiUpdatePayload, isCustomLink, tokenForPos } from '../formatted-string/utils';
import type { BaseEditorOptions, TextRange, Model } from './types';
import { getInputText, isCollapsed, startsWith } from './utils';

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
        if ('sticky' in token && token.sticky) {
            model = setFormat(model, token.format, offset, offset + len, options);
        } else if (token.format) {
            model = setFormat(model, { add: token.format }, offset, offset + len, options);
        }

        if (isCustomLink(token)) {
            model = setLink(model, token.link, offset, len);
        }

        if (token.emoji?.length) {
            const payload = createEmojiUpdatePayload(token.emoji, offset, token.value);
            model = updateEmojiData(model, payload);
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

function handleSkipEvent(evt: InputEvent, model: Model): Model | undefined {
    if (skipInputTypes.has(evt.inputType)) {
        evt.preventDefault();
        return model;
    }
}

function handleFormatEvent(evt: InputEvent, model: Model, range: TextRange, options: BaseEditorOptions): Model | undefined {
    const { inputType } = evt;
    if (inputType && startsWith(inputType, 'format')) {
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
            return toggleFormat(model, inputToFormat[inputType], from, to, options);
        }

        return model;
    }
}

function handleInsertEvent(evt: InputEvent, model: Model, range: TextRange, options: BaseEditorOptions): Model | undefined {
    const { inputType } = evt;
    if (inputType && startsWith(inputType, 'insert')) {
        const text = getInputEventText(evt);
        return replaceText(model, text, range[0], range[1], options);
    }
}

/**
 * Выполняет обновление для старых браузеров, которые ещё не поддерживают
 * полноценный `InputEvent`
 */
export function updateFromOldEvent(text: string, model: Model, range: TextRange, prevRange: TextRange, options: BaseEditorOptions) {
    let [from, to] = prevRange;
    let update = '';
    if (isCollapsed(prevRange)) {
        const len = getLength(model);
        if (len > text.length) {
            // Удалили контент
            from = Math.min(from, range[0]);
            to = Math.max(to, range[1]);
            if (from === to) {
                // Удаление справа от курсора
                to += len - text.length;
            }
        } else {
            // Добавили контент
            update = text.slice(from, Math.max(range[0], range[1]));
        }
    } else {
        // Было выделение: либо заменили контент, либо удалили
        update = text.slice(Math.min(from, range[0]), range[1]);
    }

    return replaceText(model, update, from, to, options);
}

export function updateFromInputEventFallback(evt: InputEvent, model: Model, range: TextRange, prevRange: TextRange, options: BaseEditorOptions): Model {
    const updated = handleSkipEvent(evt, model)
        || handleFormatEvent(evt, model, range, options)
        || handleInsertEvent(evt, model, prevRange, options);

    if (updated) {
        return updated;
    }

    const { inputType } = evt;
    if (inputType && startsWith(inputType, 'delete')) {
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

        return removeText(model, boundFrom, boundTo, options);
    }

    return model;
}

export function updateFromInputEvent(evt: InputEvent, model: Model, range: TextRange, options: BaseEditorOptions): Model {
    const updated = handleSkipEvent(evt, model)
        || handleFormatEvent(evt, model, range, options)
        || handleInsertEvent(evt, model, range, options);

    if (updated) {
        return updated;
    }

    const { inputType } = evt;
    if (inputType && inputType.startsWith('delete')) {
        return removeText(model, range[0], range[1], options);
    }

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
