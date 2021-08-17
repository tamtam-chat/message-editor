export declare const keyModifier: {
    ctrl: number;
    alt: number;
    shift: number;
    meta: number;
    any: number;
};
export declare type ShortcutHandler<T> = (obj: T, evt: KeyboardEvent) => unknown | false;
/**
 * Модуль для удобной регистрации действий по клавиатурным сочетаниям
 */
export default class Shortcuts<T> {
    private ctx;
    private shortcuts;
    constructor(ctx: T);
    /**
     * Регистрирует обработчик на указанный шорткат
     */
    register(shortcut: string | string[], handler: ShortcutHandler<T>): this;
    /**
     * Регистрирует все обработчики шортактов из указанной мапы
     */
    registerAll(shortcuts: Record<string, ShortcutHandler<T>>): void;
    /**
     * Удаляет зарегистрированный шорткат
     * @param handler Если не указано, удалит любой шорткат, зарегистрированный
     * по этому сочетанию, иначе удалит только если зарегистрированный обработчик
     * совпадает с указанным
     */
    unregister(shortcut: string | string[], handler?: ShortcutHandler<T>): this;
    /**
     * Удаляет все зарегистрированные шорткаты
     */
    unregisterAll(): this;
    /**
     * Выполняет зарегистрированный обработчик для указанного события
     * @returns Вернёт `true` если был найден и выполнен обработчик для указанного события
     */
    handle(evt: KeyboardEvent): boolean;
}
