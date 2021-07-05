export const keyModifier = {
    ctrl: 1 << 0,
    alt: 1 << 1,
    shift: 1 << 2,
    meta: 1 << 3,
    any: 1 << 8,
}

export type ShortcutHandler<T> = (obj: T, evt: KeyboardEvent) => unknown | false;

/**
 * Модуль для удобной регистрации действий по клавиатурным сочетаниям
 */
export default class Shortcuts<T> {
    private shortcuts: Record<string, ShortcutHandler<T>> = {}

    constructor(private ctx: T) {}

    /**
     * Регистрирует обработчик на указанный шорткат
     */
    register(shortcut: string | string[], handler: ShortcutHandler<T>): this {
        if (!Array.isArray(shortcut)) {
            shortcut = [shortcut];
        }

        shortcut.forEach(sh => this.shortcuts[parse(sh)] = handler);
        return this;
    }

    /**
     * Регистрирует все обработчики шортактов из указанной мапы
     */
    registerAll(shortcuts: Record<string, ShortcutHandler<T>>): void {
        Object.keys(shortcuts).forEach(sh => {
            this.register(sh, shortcuts[sh]);
        });
    }

    /**
     * Удаляет зарегистрированный шорткат
     * @param handler Если не указано, удалит любой шорткат, зарегистрированный
     * по этому сочетанию, иначе удалит только если зарегистрированный обработчик
     * совпадает с указанным
     */
    unregister(shortcut: string | string[], handler?: ShortcutHandler<T>): this {
        if (!Array.isArray(shortcut)) {
            shortcut = [shortcut];
        }

        shortcut.forEach(sh => {
            const key = parse(sh);
            if (this.shortcuts[key] && (!handler || this.shortcuts[key] === handler)) {
                delete this.shortcuts[key];
            }
        });

        return this;
    }

    /**
     * Удаляет все зарегистрированные шорткаты
     */
    unregisterAll(): this {
        this.shortcuts = {};
        return this;
    }

    /**
     * Выполняет зарегистрированный обработчик для указанного события
     * @returns Вернёт `true` если был найден и выполнен обработчик для указанного события
     */
    handle(evt: KeyboardEvent): boolean {
        // Несмотря на то, что keyCode считается deprecated, пока что это
        // единственный известный мне способ получить код клавиши, независимо
        // от раскладки
        const code = getCode(evt.keyCode ? getKey(evt.keyCode) : evt.key);
        const mask = maskFromEvent(evt);
        let key = `${mask}:${code}`;

        if (!this.shortcuts[key] && mask) {
            key = `${keyModifier.any}:${code}`;
        }

        const handler = this.shortcuts[key];
        if (handler && handler(this.ctx, evt) !== false) {
            evt.preventDefault();
            return true;
        }

        return false;
    }
}

/**
 * Возвращает маску модификаторов из указанного события
 */
function maskFromEvent(evt: KeyboardEvent): number {
    let mod = 0;
    if (evt.altKey)   { mod |= keyModifier.alt; }
    if (evt.shiftKey) { mod |= keyModifier.shift; }
    if (evt.ctrlKey)  { mod |= keyModifier.ctrl; }
    if (evt.metaKey)  { mod |= keyModifier.meta; }

    return mod;
}

/**
 * Возвращает нормализованное название клавиши из события
 */
function getCode(str: string): string {
    return str.replace(/^(Key|Digit|Numpad)/, '').toLowerCase();
}

/**
 * Парсит указанный шорткат во внутренний ключ для идентификации
 */
function parse(shortcut: string): string {
    let mod = 0;
    let key = '';

    shortcut.toLowerCase().split(/[+-]/g).forEach(part => {
        if (part === 'cmd') {
            part = navigator.platform === 'MacIntel' ? 'meta' : 'ctrl';
        }

        if (part in keyModifier) {
            mod |= keyModifier[part];
        } else {
            key = part;
        }
    });

    return `${mod}:${key}`;
}

function getKey(code: number): string {
    if (code === 27) {
        return 'Escape';
    }

    if (code === 13) {
        return 'Enter';
    }

    return String.fromCharCode(code);
}
