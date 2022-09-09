import type { TextRange } from './types';

export function createWalker(elem: HTMLElement): TreeWalker {
    return elem.ownerDocument.createTreeWalker(elem, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
}

export function isText(node: Node): node is Text {
    return node.nodeType === Node.TEXT_NODE;
}

export function isElement(node: Node): node is Element {
    return node.nodeType === Node.ELEMENT_NODE;
}

/**
 * Возвращает текстовое значение указанного узла редактора
 */
export function getRawValue(node: Node): string {
    if (isText(node)) {
        return node.nodeValue;
    }

    if (isElement(node)) {
        // NB: Firefox может вставлять <br> в середину строки. Например, на Shift+Enter.
        // Но нам надо убедиться, что это именно середина строки, а не заглушка
        // в пустой строке
        if (node.nodeName === 'BR' && (node.previousSibling || node.nextSibling)) {
            return '\n';
        }

        return node.getAttribute('data-raw')
            // || node.getAttribute('alt')
            || '';
    }

    return '';
}

/**
 * Возвращает текстовое содержимое указанного элемента с contentEditable
 */
export function getInputText(element: Element): string {
    let result = '';
    let node: Node;

    for (let i = 0; i < element.childNodes.length; i++) {
        const line = element.childNodes[i] as HTMLElement;

        // Учитываем случай с Firefox, который при обновлении DOM
        // может перенести содержимое первой строки во вторую, в которой есть
        // data-raw
        if (i > 0) {
            result += getRawValue(line) || '\n';
        }

        const walker = createWalker(line);
        while (node = walker.nextNode()) {
            result += getRawValue(node);
        }
    }

    return result;
}

/**
 * Утилита для старых браузеров
 */
export const startsWith = String.prototype.startsWith
    ? (text: string, prefix: string) => text.startsWith(prefix)
    : (text: string, prefix: string) => text.slice(0, prefix.length) === prefix;


export function isCollapsed(range: TextRange): boolean {
    return range[0] === range[1];
}
