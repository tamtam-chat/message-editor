import { codePointAt } from '../parser';

export const enum DiffActionType {
    Insert = 'insert',
    Remove = 'remove',
    Replace = 'replace',
    Compose = 'compose'
}

export interface DiffActionBase {
    action: DiffActionType;
    text: string;
    pos: number;
}

export interface DiffActionReplace extends DiffActionBase {
    oldText: string;
}

export type DiffAction = DiffActionBase | DiffActionReplace;

/**
 * Высчитывает разницу между двумя строками: возвращает количество одинаковых символов
 * в начале и в конце обоих строк.
 * Метод оптимизирован только для компонента редактирования, так как определяет
 * только сплошной изменившийся диапазон, как это принято в обычном редакторе.
 */
export function diff(from: string, to: string): [before: number, after: number] | null {
	if (from === to) {
		return null;
	}

	let before = 0
    let after = 0;
    let ch: number;
    let prev: number;
	let len = Math.min(from.length, to.length);

	while (before < len) {
		ch = codePointAt(to, before);
		if (ch !== codePointAt(from, before)) {
			break;
		}

		before += ch > 0xffff ? 2 : 1;
	}

	len -= before;

	const baseFrom = from.length - 1;
	const baseTo = to.length - 1;
	let sp = 0;
	while (after < len) {
		sp = 0;
		ch = to.charCodeAt(baseTo - after);

		if (ch >= 0xDC00 && ch <= 0xDFFF && (after + 1 < len)) { // low surrogate
			prev = to.charCodeAt(baseTo - after);
			if (prev >= 0xD800 && prev <= 0xDBFF) {
				sp++;
			}
		}

		if (codePointAt(from, baseFrom - after - sp) !== codePointAt(to, baseTo - after - sp)) {
			break;
		}

		after += 1 + sp;
	}

	return [before, after];
}

/**
 * Высчитывает разницу между двумя строками и возвращает её в виде объекта с типом
 * операции для превращения `from` в `to`
 */
export default function diffAction(from: string, to: string): DiffAction | null {
    const delta = diff(from, to);

    if (!delta) { // строки равны
        return null;
    }

    const [before, after] = delta;
    const prev = from.slice(before, -after || from.length);
    const next = to.slice(before, -after || to.length);

    if (!prev && next) {
        return {
            action: DiffActionType.Insert,
            text: next,
            pos: before
        };
    }

    if (prev && !next) {
        return {
            action: DiffActionType.Remove,
            text: prev,
            pos: before
        };
    }

    return {
        action: DiffActionType.Replace,
        text: next,
        pos: before,
        oldText: prev,
    };
}
