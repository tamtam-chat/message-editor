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
        return node.getAttribute('data-raw') || '';
    }

    return '';
}
