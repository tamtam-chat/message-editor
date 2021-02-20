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

    /** Находить ОК-специфические стикеры: #u9b3c2d1af7s# */
    userSticker: boolean;

    /** Находить ссылки в тексте */
    link: boolean;
}
