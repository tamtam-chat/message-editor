import Editor, { defaultPickLinkOptions, EditorOptions, PickLinkOptions } from "../editor";
import parse, { TokenFormat, TokenType } from "../parser";
import type { Model } from "../editor/types";
import { setLink, mdToText, TextRange as Rng, textToMd } from '../formatted-string';
import { setRange } from "../editor/range";

/**
 * Класс наследуется от едитора. Использование маркдаунов
 */
export default class MDEditor extends Editor {
    constructor(public element: HTMLElement, public options: EditorOptions = {}) {
        super(element, options);
    }

    /**
     * Выбрать ссылку для указанного диапазона
     */
    pickLink(options: PickLinkOptions = defaultPickLinkOptions): void {
        const [from, to] = options.range || this.getSelection();
        let token = this.tokenForPos(from);

        if (token && token.format & TokenFormat.LinkLabel) {
            // Это подпись к ссылке в MD-формате. Найдём саму ссылку
            let ix = this.model.indexOf(token) + 1;
            while (ix < this.model.length) {
                token = this.model[ix++];
                if (token.type === TokenType.Link) {
                    break;
                }
            }
        }
        super.pickLink(options, token);
    }

    /**
     * Ставит ссылку на `url` на указанный диапазон. Если `url` пустой или равен
     * `null`, удаляет ссылку с указанного диапазона
     */
    setLink(url: string | null, from: number, to = from): Model {
        if (this.isMarkdown) {
            if (url) {
                url = url.trim();
            }

            let updated: Model;
            const range: Rng = [from, to - from];

            const text = mdToText(this.model, range);
            const next = setLink(text, url, range[0], range[1]);
            updated = parse(textToMd(next, range), this.options.parse);
            const result = super.updateModel(updated, 'link', [from, to]);
            setRange(this.element, range[0], range[0] + range[1]);
            return result;
        } else {
            return super.setLink(url, from, to)
        }
    }

    /**
     * Обновляет опции редактора
     */
    setOptions(options: Partial<EditorOptions>): void {
        let markdownUpdated = false;
        if (options.parse) {
            const markdown = !!this.options.parse?.markdown;
            markdownUpdated = options.parse?.markdown !== markdown;
        }

        if (markdownUpdated) {
            const sel = this.getSelection();
            const range: Rng = [sel[0], sel[1] - sel[0]];
            const tokens = options?.parse?.markdown
                ? textToMd(this.model, range)
                : mdToText(this.model, range);

            this.setValue(tokens, [range[0], range[0] + range[1]]);
        }

        super.setOptions(options, markdownUpdated);
    }
}
