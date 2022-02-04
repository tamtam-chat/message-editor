import type { TextRange } from './types';
import { createWalker, getRawValue, isElement, isText } from './utils';
import { clamp } from '../formatted-string/utils';

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
export function rangeBoundToLocation(root: HTMLElement, bound: Node, pos: number): number {
    let result = 0;

    if (root === bound) {
        // Пограничный случай: граница где-то между строками
        pos = clamp(pos, 0, root.childNodes.length);
        for (let i = 0; i < pos; i++) {
            result += getLineLength(root.childNodes[i] as Element);
        }
    } else if (isValidLineMarkup(root)) {
        for (let i = 0; i < root.childNodes.length; i++) {
            const line = root.childNodes[i] as HTMLElement;
            if (line.contains(bound)) {
                // Граница находится внутри текущей строки: нужно получить только
                // фрагмент строки
                result += getLineBlockLength(line);
                result += line === bound
                    ? getFragmentLength(line, pos)
                    : sumNodesLength(line, bound, pos);

                break;
            }

            result += getLineLength(line);
        }
    } else {
        // На случай, если попалась незнакомая структура, например, при использовании
        // Punto Switcher начинаем писать текст при пустом значении инпута (важно!).
        // В этом случае мы не доберёмся до рендеринга, а браузер сделает свою
        // разметку, которая не соответствует ожидаемой
        if (pos > 0 && isElement(bound)) {
            // На случай если попали в контейнер с чем-то, например, эмоджи
            result += getRawValue(bound).length;
        }
        result += sumNodesLength(root, bound, pos);
    }

    return result;
}

function sumNodesLength(root: HTMLElement, bound: Node, pos: number): number {
    let result = 0;
    const walker = createWalker(root);
    let n: Node;
    while ((n = walker.nextNode()) && n !== bound) {
        result += getNodeLength(n, false);
    }

    result += isText(bound)
        ? pos
        : getFragmentLength(bound, pos);

    return result;
}

/**
 * Выполняет операцию, обратную `rangeBoundToPos`: конвертирует числовую позицию
 * в границу для `Range`
 * @param root Контекстный элемент, внутри которого нужно искать контейнер
 * для узла модели
 */
export function locationToRangeBound(root: HTMLElement, pos: number): RangeBound {
    for (let i = 0; i < root.childNodes.length; i++) {
        const line = root.childNodes[i] as HTMLElement;
        pos -= getLineBlockLength(line);
        if (pos <= 0) {
            // Попали в начало строки
            return {
                container: line,
                offset: 0
            };
        }

        // Обходим содержимое строки
        const walker = createWalker(line);
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

                if (pos === 0) {
                    return { container, offset: 0 };
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
    }

    return {
        container: root,
        offset: root.childNodes.length
    };
}

function getFragmentLength(parent: Node, pos: number): number {
    let result = 0;
    pos = clamp(pos, 0, parent.childNodes.length);
    for (let i = 0; i < pos; i++) {
        result += getNodeLength(parent.childNodes[i], true);
    }

    return result;
}

function getLineLength(line: Element): number {
    return getLineBlockLength(line) + getFragmentLength(line, line.childNodes.length);
}

/**
 * Возвращает текстовую длину указанного узла
 */
function getNodeLength(node: Node, deep = false): number {
    if (isText(node)) {
        return node.nodeValue.length;
    }

    let result = 0;
    if (isElement(node)) {
        result = getRawValue(node).length;

        if (deep) {
            for (let i = 0; i < node.childNodes.length; i++) {
                result += getNodeLength(node.childNodes[i], true);
            }
        }
    }

    return result;
}

function getLineBlockLength(elem: Element): number {
    // У первой строки не может быть своего символа перевода. В некоторых случаях
    // Firefox при редактировании может перенести содержимое первой строки во вторую,
    // тем самым оставив там data-raw атрибут. Поэтому принудительно проверяем,
    // чтобы у первой строки не было перевода
    if (elem.previousSibling) {
        // NB у блока строки может не быть атрибута data-raw, если его только
        // что отрисовал браузер
        return getRawValue(elem).length || 1;
    }

    return 0;
}

/**
 * Проверяет, является ли указанный диапазон допустимым, с которым можно работать
 */
function isValidRange(range: Range, container: HTMLElement): boolean {
    return container.contains(range.commonAncestorContainer);
}

function isValidLineMarkup(container: HTMLElement): boolean {
    const node = container.firstChild;
    if (node && isElement(node)) {
        return node.nodeName === 'DIV' || node.nodeName === 'P';
    }

    return false;
}
