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
            || node.getAttribute('alt')
            || '';
    }

    return '';
}
