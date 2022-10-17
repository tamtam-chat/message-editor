import Editor, { DiffActionType } from "../editor";
import { getTextRange, setRange } from "../editor/range";
import { setLink, TextRange, TokenFormatUpdate } from "../formatted-string";
import parseMD from "../md-parser";
import type { ParserOptions, TokenFormat } from "../parser";
import type { Model } from '../editor/types';
import { cutTextMD, insertTextMD, removeTextMD, setFormatMD, updateFromInputEventFallbackMD, updateFromInputEventMD } from "./update";
import toHTML from '../render/html';
import { mdToText, textToMd } from "../md-formatted-string";
import type { HTMLParserOptions } from "../parser/html2";
import parseHTMLMD from "../md-parser/html2";

export default class MDEditor extends Editor {
    parse(value: string, parseOptions?: Partial<ParserOptions>) {
        return parseMD(value, parseOptions);
    }

    parseHTML(html: string, options?: Partial<HTMLParserOptions>) {
        return parseHTMLMD(html, options);
    }

    updateFromInputEvent(evt: InputEvent, range: TextRange) {
        return updateFromInputEventMD(evt, this.model, range, this.options)
    }

    updateFromInputEventFallback(evt: InputEvent, range: TextRange | undefined, prevRange: TextRange) {
        return updateFromInputEventFallbackMD(evt, this.model, range, prevRange, this.options);
    }

    /**
     * Правильно помещает фрагмент текста в буффер. Вместе с обычным текстом
     * туда помещается сериализованный фрагмент модели, чтобы сохранить форматирование
     */
    copyFragment(clipboard: DataTransfer, cut?: boolean): boolean {
        const range = getTextRange(this.element);

        if (range && !this.isCollapsed(range)) {
            const fragment = cut
                ? this.cut(range[0], range[1])
                : this.slice(range[0], range[1]);

            clipboard.setData('text/plain', this.getText(fragment));
            clipboard.setData('text/html', toHTML(fragment));

            if (cut) {
                this.setSelection(range[0]);
            }

            return true;
        }

        return false;
    }

    /**
     * Удаляет указанный диапазон текста
     */
    removeText(from: number, to: number): Model {
        const result = this.updateModel(
            removeTextMD(this.model, from, to, this.options),
            DiffActionType.Remove,
            [from, to]);

        this.setSelection(from);
        return result;
    }

    /**
     * Обновляет форматирование у указанного диапазона
     */
    updateFormat(format: TokenFormat | TokenFormatUpdate, from: number, to = from): Model {
        const result = this.updateModel(
            setFormatMD(this.model, format, from, to, this.options),
            'format',
            [from, to]
        );
        setRange(this.element, from, to);
        this.emit('editor-formatchange');
        return result;
    }

    /**
     * Ставит ссылку на `url` на указанный диапазон. Если `url` пустой или равен
     * `null`, удаляет ссылку с указанного диапазона
     */
    setLink(url: string | null, from: number, to = from): Model {
        if (url) {
            url = url.trim();
        }

        let updated: Model;
        const range: TextRange = [from, to - from];
        const text = mdToText(this.model, range);
        const next = setLink(text, url, range[0], range[1]);
        updated = this.parse(textToMd(next, range), this.options.parse);

        const result = this.updateModel(updated, 'link', [from, to]);
        setRange(this.element, range[0], range[0] + range[1]);
        return result;
    }

    updateInsertText(pos: number, text: string) {
        return insertTextMD(this.model, pos, text, this.options);
    }


    cutText(from: number, to: number) {
        return cutTextMD(this.model, from, to, this.options);
    }
}
