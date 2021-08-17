import { TextRange } from './types';
interface RangeBound {
    container: Node;
    offset: number;
}
/**
 * Возвращает текущий допустимый диапазон, который находится в указанном
 * контейнере
 */
export declare function getRange(root: HTMLElement): Range;
/**
 * Создаёт выделенный диапазон по указанным координатам
 */
export declare function setRange(root: HTMLElement, from: number, to?: number): Range | undefined;
/**
 * Обновляет DOM-диапазон, если он отличается от текущего
 */
export declare function setDOMRange(range: Range): Range | undefined;
/**
 * Возвращает текстовый диапазон для указанного контейнера
 */
export declare function getTextRange(root: HTMLElement): TextRange | undefined;
/**
 * Сериализация указанного DOM-диапазона в координаты для модели редактора:
 * для начала и конца диапазона находит узел в модели, которому он соответствует,
 * и высчитывает смещение в символах внутри найденного узла.
 * Координаты модели высчитываются относительно элемента `container`
 */
export declare function rangeToLocation(root: HTMLElement, range: Range): TextRange;
/**
 * Десериализация диапазона из координат модели в DOM
 */
export declare function locationToRange(ctx: HTMLElement, from: number, to?: number): Range;
/**
 * Возвращает позицию символа в тексте `ctx`, на который указывает граница
 * диапазона (DOM Range), определяемая параметрами `container` и `offset`
 */
export declare function rangeBoundToLocation(root: HTMLElement, node: Node, offset: number): number;
/**
 * Выполняет операцию, обратную `rangeBoundToPos`: конвертирует числовую позицию
 * в границу для `Range`
 * @param root Контекстный элемент, внутри которого нужно искать контейнер
 * для узла модели
 */
export declare function locationToRangeBound(root: HTMLElement, pos: number): RangeBound;
export declare function isText(node: Node): node is Text;
export declare function isElement(node: Node): node is Element;
export {};
