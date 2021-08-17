/**
 * @description Методы для работы с древовидной структурой: из указанного массива
 * строк делаем дерево, для более быстрого лукапа, а также предоставляем функцию
 * для поглощения элемента дерева
 */
import ParserState from './state';
export declare type Tree = Map<number, true | Tree>;
/**
 * Создаёт дерево из указанного списка строк
 */
export declare function createTree(items: string[], ignoreCase?: boolean): Tree;
/**
 * Пытается поглотить узел указанного дерева. Вернёт `true`, если удалось поглотить
 * узел: в `state.pos` будет записан конец узла
 */
export declare function consumeTree(state: ParserState, tree: Tree, ignoreCase?: boolean): boolean;
