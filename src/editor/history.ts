import type { Token } from '../parser';
import type { TextRange } from './types';

export interface HistoryOptions {
    /** Список действий, которые можно схлопнуть в одно */
    compactActions: string[];

    /** Таймаут в миллисекундах, в течение которого можно схлопывать действия */
    compactTimeout: number;

    /** Максимальное количество записей в истории */
    maxEntries: number;
}

export interface HistoryEntry<S> {
    state: S;
    time: number;
    action: string;
    range: TextRange;
    caret?: TextRange;
}

const defaultOptions: HistoryOptions = {
	compactActions: [],
    compactTimeout: 600,
	maxEntries: 100
};

export default class History<S = Token[]> {
    public options: HistoryOptions;

    private _stack: HistoryEntry<S>[] = [];
    private _ptr = -1;

	constructor(options?: Partial<HistoryOptions>) {
		this.options = {
			...defaultOptions,
			...options
		};
	}

	/**
	 * Добавляет запись в стэк истории
	 */
	push(state: S, action: string, range: TextRange, time = Date.now()): void {
		const { canRedo } = this;

		if (this._stack.length > this._ptr + 1) {
			// Удаляем записи из стэка, которые находятся за пределами указателя
			this._stack = this._stack.slice(0, this._ptr + 1);
		}

		const prevEntry = this._stack[this._ptr];
		const nextEntry: HistoryEntry<S> = { state, time, action, range };

		if (prevEntry && action && !canRedo && prevEntry.action === action
			&& this.options.compactActions.includes(action)
			&& time - prevEntry.time < this.options.compactTimeout) {
			// Можно объединить два действия в одно
			combineEntries(prevEntry, nextEntry);
		} else {
			this._stack.push(nextEntry);
			this._ptr++;

			while (this._stack.length > this.options.maxEntries) {
				this._stack.shift();
				this._ptr--;
			}
		}
	}

	/**
	 * Можно ли отменить последнее действие
	 */
	get canUndo(): boolean {
		return this._ptr > 0;
	}

	/**
	 * Можно ли повторить ранее отменённое действие
	 */
	get canRedo(): boolean {
		return this._ptr < this._stack.length - 1;
	}

	/**
	 * Текущая запись в истории
	 */
	get current(): HistoryEntry<S> | undefined {
		return this._stack[this._ptr];
	}

	/**
	 * Откатывается к предыдущему состоянию, если это возможно, и возвращает его
	 * значение
	 */
	undo(): HistoryEntry<S> | undefined {
		if (this.canUndo) {
			return this._stack[--this._ptr];
		}
	}

	/**
	 * Откатывается к следующему состоянию, ели это возможно, и возвращает его
	 * значение
	 */
	redo(): HistoryEntry<S> | undefined {
		if (this.canRedo) {
			return this._stack[++this._ptr];
		}
	}

	/**
	 * Возвращает список всех значений в истории
	 */
	entries(): S[] {
		return this._stack.map(entry => entry.state);
	}

	/**
	 * Сохраняет указанный диапазон в текущей записи истории в качестве последнего
	 * известного выделения
	 */
	saveCaret(range: TextRange): void {
        const { current } = this;
		if (current) {
			current.caret = range;
		}
	}

    /**
     * Очищает всю историю
     */
    clear(): void {
        this._stack = [];
        this._ptr = -1;
    }
}

function combineEntries<S>(prev: HistoryEntry<S>, next: HistoryEntry<S>): HistoryEntry<S> {
	prev.time = next.time;
	prev.state = next.state;

	if (prev.range && next.range) {
        prev.range = [
            Math.min(prev.range[0], next.range[0]),
            Math.max(prev.range[1], next.range[1]),
        ];
	}

	return prev;
}
