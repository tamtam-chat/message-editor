/**
 * @description Методы для работы с древовидной структурой: из указанного массива
 * строк делаем дерево, для более быстрого лукапа, а также предоставляем функцию
 * для поглощения элемента дерева
 */

import ParserState from './state';

export type Tree = Map<number, true | Tree>;

/**
 * Создаёт дерево из указанного списка строк
 */
export function createTree(items: string[]): Tree {
    const root = new Map();
    items.forEach(key => collectTree(root, key));
    return root;
}

/**
 * Пытается поглотить узел указанного дерева. Вернёт `true`, если удалось поглотить
 * узел: в `state.pos` будет записан конец узла
 */
export function consumeTree(state: ParserState, tree: Tree): boolean {
    const { pos } = state;
    let node = tree;

    while (state.hasNext()) {
        const entry = node.get(state.next());
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

function collectTree(tree: Tree, text: string, i = 0): void {
    const ch = text.charCodeAt(i++);

    if (i === text.length) {
        tree.set(ch, true);
    } else {
        if (!tree.has(ch)) {
            tree.set(ch, new Map());
        }
        collectTree(tree.get(ch) as Tree, text, i);
    }
}
