import { Token } from '../parser';
import { TextRange } from './types';
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
export default class History<S = Token[]> {
    options: HistoryOptions;
    private _stack;
    private _ptr;
    constructor(options?: Partial<HistoryOptions>);
    /**
     * Добавляет запись в стэк истории
     */
    push(state: S, action: string, range: TextRange, time?: number): void;
    /**
     * Можно ли отменить последнее действие
     */
    get canUndo(): boolean;
    /**
     * Можно ли повторить ранее отменённое действие
     */
    get canRedo(): boolean;
    /**
     * Текущая запись в истории
     */
    get current(): HistoryEntry<S> | undefined;
    /**
     * Откатывается к предыдущему состоянию, если это возможно, и возвращает его
     * значение
     */
    undo(): HistoryEntry<S> | undefined;
    /**
     * Откатывается к следующему состоянию, ели это возможно, и возвращает его
     * значение
     */
    redo(): HistoryEntry<S> | undefined;
    /**
     * Возвращает список всех значений в истории
     */
    entries(): S[];
    /**
     * Сохраняет указанный диапазон в текущей записи истории в качестве последнего
     * известного выделения
     */
    saveCaret(range: TextRange): void;
    /**
     * Очищает всю историю
     */
    clear(): void;
}
