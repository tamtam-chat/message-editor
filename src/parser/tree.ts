/**
 * @description Методы для работы с древовидной структурой: из указанного массива
 * строк делаем дерево, для более быстрого лукапа, а также предоставляем функцию
 * для поглощения элемента дерева
 */

import type ParserState from './state';
import { asciiToUpper } from './utils';

export type Tree = Map<number, true | Tree>;

/**
 * Создаёт дерево из указанного списка строк
 */
export function createTree(items: string[], ignoreCase = false): Tree {
    const root = new Map();
    items.forEach(key => collectTree(root, key, ignoreCase));
    return root;
}

/**
 * Пытается поглотить узел указанного дерева. Вернёт `true`, если удалось поглотить
 * узел: в `state.pos` будет записан конец узла
 */
export function consumeTree(state: ParserState, tree: Tree, ignoreCase = false): boolean {
    const { pos } = state;
    let node = tree;
    let ch: number;
    let entry: Tree | true;

    while (state.hasNext()) {
        ch = state.next();
        if (ignoreCase) {
            ch = asciiToUpper(ch);
        }

        entry = node.get(ch);
        if (entry === true) {
            return true;
        }

        if (entry === undefined) {
            break;
        }

        node = entry;
    }

    state.pos = pos;
    return false;
}

function collectTree(tree: Tree, text: string, ignoreCase: boolean, i = 0): void {
    let ch = text.charCodeAt(i++);
    if (ignoreCase) {
        ch = asciiToUpper(ch);
    }

    if (i === text.length) {
        tree.set(ch, true);
    } else {
        if (!tree.has(ch)) {
            tree.set(ch, new Map());
        }
        collectTree(tree.get(ch) as Tree, text, ignoreCase, i);
    }
}
