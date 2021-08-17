export interface ParserOptions {
    /** Использовать MD-форматирование  */
    markdown: boolean;
    /** Находить текстовые эмоджи типа `:)` */
    textEmoji: boolean;
    /** Находить упоминания: `@user_name` */
    mention: boolean | 'strict';
    /** Находить хэштэги: `#hashtag` */
    hashtag: boolean;
    /** Находить команды для ботов: `/command` */
    command: boolean;
    /** Находить ОК-специфические стикеры: #u9b3c2d1af7s# */
    userSticker: boolean;
    /** Находить ссылки в тексте */
    link: boolean;
    /** Возможность делать sticky-ссылки при заменен текста ссылки */
    stickyLink?: boolean;
}
export declare const enum TokenType {
    /** Обычный текстовый фрагмент */
    Text = "text",
    /** Ссылка на внешний ресурс */
    Link = "link",
    /**
     * Специальный пользовательский стикер с древних времён OK:
     * #u123456789s#
     */
    UserSticker = "user_sticker",
    /** Упоминание: @user_name */
    Mention = "mention",
    /** Команда: /command */
    Command = "command",
    /** Хэштэг: #hashtag */
    HashTag = "hashtag",
    /** Символ форматирования Markdown */
    Markdown = "markdown",
    /** Перенос строки */
    Newline = "newline"
}
export declare enum TokenFormat {
    None = 0,
    /** Жирный текст */
    Bold = 1,
    /** Курсивный текст */
    Italic = 2,
    /** Подчёркнутый текст */
    Underline = 4,
    /** Перечёркнутый текст */
    Strike = 8,
    /** Моноширинный текст */
    Monospace = 16,
    /** Важный текст/заголовок */
    Heading = 32,
    /** Красный текст */
    Marked = 64,
    /** Подсвеченный фрагмент текста */
    Highlight = 128,
    /** Текст ссылки в Markdown: `[label]` */
    LinkLabel = 256,
    /** Ссылка в Markdown: `(example.com)` */
    Link = 512
}
export declare type Token = TokenText | TokenLink | TokenUserSticker | TokenMention | TokenCommand | TokenHashTag | TokenMarkdown | TokenNewline;
export interface TokenBase {
    /** Тип токена */
    type: TokenType;
    /** Текстовое содержимое токена */
    value: string;
    /** Текущий формат токена */
    format: TokenFormat;
    /** Список эмоджи внутри значения токена */
    emoji?: Emoji[];
}
export interface TokenText extends TokenBase {
    type: TokenType.Text;
    /**
     * Признак, указывающий, что при добавлении текста точно на границу текущего
     * и предыдущего токена, текст будет добавлен именно в текущий, а не в
     * предыдущий токен
     */
    sticky: boolean;
}
export interface TokenLink extends TokenBase {
    type: TokenType.Link;
    link: string;
    /**
     * Флаг, означающий, что ссылка была автоматически распознана в тексте,
     * а не добавлена пользователем.
     */
    auto: boolean;
    /**
     * Признак, указывающий, что при добавлении текста точно на границу текущего
     * и предыдущего токена, текст будет добавлен именно в текущий, а не в
     * предыдущий токен
     */
    sticky: boolean;
}
export interface TokenUserSticker extends TokenBase {
    type: TokenType.UserSticker;
    /** ID стикера */
    stickerId: string;
}
export interface TokenMention extends TokenBase {
    type: TokenType.Mention;
    /** Значение упоминания */
    mention: string;
}
export interface TokenCommand extends TokenBase {
    type: TokenType.Command;
    /** Команда */
    command: string;
}
export interface TokenHashTag extends TokenBase {
    type: TokenType.HashTag;
    /** Значение хэштэга */
    hashtag: string;
}
export interface TokenMarkdown extends TokenBase {
    type: TokenType.Markdown;
}
export interface TokenNewline extends TokenBase {
    type: TokenType.Newline;
}
export interface Emoji {
    /** Начало эмоджи в родительском токене */
    from: number;
    /** Конец эмоджи в родительском токене */
    to: number;
    /**
     * Фактический эмоджи для указанного диапазона.
     * Используется для текстовых эмоджи (алиасов)
     * */
    emoji?: string;
}
