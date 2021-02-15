export interface ParserOptions {
    /** Использовать MD-форматирование  */
    formatting: boolean;

    /** Находить текстовые эмоджи типа `:)` */
    textEmoji: boolean;

    /** Находить упоминания: `@user_name` */
    mention: boolean;

    /** Находить хэштэги: `#hashtag` */
    hashtag: boolean;

    /** Находить команды для ботов: `/command` */
    command: boolean;
}
