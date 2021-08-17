export declare const enum DiffActionType {
    Insert = "insert",
    Remove = "remove",
    Replace = "replace"
}
export interface DiffActionBase {
    action: DiffActionType;
    text: string;
    pos: number;
}
export interface DiffActionReplace extends DiffActionBase {
    oldText: string;
}
export declare type DiffAction = DiffActionBase | DiffActionReplace;
/**
 * Высчитывает разницу между двумя строками: возвращает количество одинаковых символов
 * в начале и в конце обоих строк.
 * Метод оптимизирован только для компонента редактирования, так как определяет
 * только сплошной изменившийся диапазон, как это принято в обычном редакторе.
 */
export declare function diff(from: string, to: string): [before: number, after: number] | null;
/**
 * Высчитывает разницу между двумя строками и возвращает её в виде объекта с типом
 * операции для превращения `from` в `to`
 */
export default function diffAction(from: string, to: string): DiffAction | null;
