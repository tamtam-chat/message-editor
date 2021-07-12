import { TextRange } from './types';

interface RangeBound {
    container: Node;
    offset: number;
}

/**
 * Возвращает текущий допустимый диапазон, который находится в указанном
 * контейнере
 */
export function getRange(root: HTMLElement): Range {
    const sel = window.getSelection();
    const range = sel.rangeCount && sel.getRangeAt(0);
    if (range && isValidRange(range, root)) {
        return range;
    }
}

/**
 * Создаёт выделенный диапазон по указанным координатам
 */
export function setRange(root: HTMLElement, from: number, to?: number): Range | undefined {
    const range = locationToRange(root, from, to);
    if (range) {
        return setDOMRange(range);
    }
}

/**
 * Обновляет DOM-диапазон, если он отличается от текущего
 */
export function setDOMRange(range: Range): Range | undefined {
    const sel = window.getSelection();

    // Если уже есть выделение, сравним указанный диапазон с текущим:
    // если они равны, то ничего не делаем, чтобы лишний раз не напрягать
    // браузер и не портить UX
    try {
        if (sel.rangeCount) {
            const curRange = sel.getRangeAt(0);
            const startBound = curRange.compareBoundaryPoints(Range.START_TO_START, range);
            const endBound = curRange.compareBoundaryPoints(Range.END_TO_END, range);
            if (startBound === 0 && endBound === 0) {
                return;
            }
        }
    } catch {
        // Может быть ошибка, если элемент ещё не в DOM-дереве: игнорируем её
    }
    sel.empty();
    sel.addRange(range);
    return range;
}

/**
 * Возвращает текстовый диапазон для указанного контейнера
 */
export function getTextRange(root: HTMLElement): TextRange | undefined {
    const range = getRange(root);
    if (range) {
        return rangeToLocation(root, range);
    }
}

/**
 * Сериализация указанного DOM-диапазона в координаты для модели редактора:
 * для начала и конца диапазона находит узел в модели, которому он соответствует,
 * и высчитывает смещение в символах внутри найденного узла.
 * Координаты модели высчитываются относительно элемента `container`
 */
export function rangeToLocation(root: HTMLElement, range: Range): TextRange {
    const { collapsed } = range;
    const from = rangeBoundToLocation(root, range.startContainer, range.startOffset);
    const to = collapsed ? from : rangeBoundToLocation(root, range.endContainer, range.endOffset);
    return [from, to];
}

/**
 * Десериализация диапазона из координат модели в DOM
 */
export function locationToRange(ctx: HTMLElement, from: number, to?: number): Range {
    const start = locationToRangeBound(ctx, from);
    const end = to == null || to === from ? start : locationToRangeBound(ctx, to);

    if (start && end) {
        const range = document.createRange();
        range.setStart(start.container, start.offset);
        range.setEnd(end.container, end.offset);

        return range;
    }
}

/**
 * Возвращает позицию символа в тексте `ctx`, на который указывает граница
 * диапазона (DOM Range), определяемая параметрами `container` и `offset`
 */
export function rangeBoundToLocation(root: HTMLElement, node: Node, offset: number): number {
    let result = 0;

    if (isText(node)) {
        result = offset;
    } else {
        const nodeLen = getNodeLength(node, false);
        if (nodeLen) {
            // Сам узел является представлением какого-то токена.
            // Если смещение больше 0, значит диапазон выставили внутри токена
            // и его надо поглотить
            if (offset > 0) {
                result += nodeLen;
            }
        } else {
            let i = 0;
            while (i < offset) {
                result += getNodeLength(node.childNodes[i++], true);
            }
            result += getNodeLength(node, false);
        }
    }

    if (root !== node) {
        // Tree walker идёт по узлам в их порядке следования в DOM. Соответственно,
        // как только мы дойдём до указанного контейнера, мы посчитаем весь предыдущий
        // контент
        const walker = createWalker(root);
        let n: Node;
        while ((n = walker.nextNode()) && n !== node) {
            result += getNodeLength(n);
        }
    }

    return result;
}

/**
 * Выполняет операцию, обратную `rangeBoundToPos`: конвертирует числовую позицию
 * в границу для `Range`
 * @param root Контекстный элемент, внутри которого нужно искать контейнер
 * для узла модели
 */
export function locationToRangeBound(root: HTMLElement, pos: number): RangeBound {
    const walker = createWalker(root);
    let len: number
    let container: Node;

    while (container = walker.nextNode()) {
        len = getNodeLength(container, false);

        if (len === 0) {
            continue;
        }

        if (pos <= len) {
            if (isText(container)) {
                return { container, offset: pos };
            }

            // Если попали в элемент (например, эмоджи), делаем адресацию относительно
            // его родителя.
            // Учитываем захват элемента в зависимости того, попадает ли позиция
            // внутрь токена (pos > 0) или нет
            let offset = pos === 0 ? 0 : 1;
            let node = container;
            while (node = node.previousSibling) {
                offset++;
            }

            return { container: container.parentNode, offset };
        }

        pos -= len;
    }

    return {
        container: root,
        offset: 0
    };
}

/**
 * Проверяет, является ли указанный диапазон допустимым, с которым можно работать
 */
function isValidRange(range: Range, container: HTMLElement): boolean {
    return container.contains(range.commonAncestorContainer);
}

/**
 * Возвращает текстовую длину указанного узла
 */
function getNodeLength(node: Node, deep = false): number {
    if (isText(node)) {
        return node.nodeValue.length;
    }

    if (isElement(node) && node.hasAttribute('data-raw')) {
        return (node.getAttribute('data-raw') || '').length;
    }

    let result = 0;
    if (deep) {
        for (let i = 0; i < node.childNodes.length; i++) {
            result += getNodeLength(node.childNodes[i], true);
        }
    }

    return result;
}

export function isText(node: Node): node is Text {
    return node.nodeType === Node.TEXT_NODE;
}

export function isElement(node: Node): node is Element {
    return node.nodeType === Node.ELEMENT_NODE;
}

function createWalker(elem: HTMLElement): TreeWalker {
    return elem.ownerDocument.createTreeWalker(elem, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
}
