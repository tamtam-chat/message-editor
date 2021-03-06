import { isAutoLink, isCustomLink } from '../formatted-string/utils';
import { Token, TokenFormat, TokenHashTag, TokenLink, TokenMention, TokenType, Emoji, TokenCommand } from '../parser';

declare global {
    interface Element {
        $$emoji?: boolean;
    }
}

type ClassFormat = [type: TokenFormat, value: string];
export type EmojiRender = (emoji: string | null, elem?: Element) => Element | void;

export interface RenderOptions {
    /**
     * Функция для отрисовки эмоджи
     * @param emoji Эмоджи, который нужно нарисовать. Если указано `null`, значит,
     * элемент с эмоджи сейчас удаляется и нужно подчистить ресурсы для него
     * @param elem Существующий элемент, в котором нужно обновить эмоджи. Если не
     * указан, его нужно создать
     */
    emoji?: EmojiRender;

    /**
     * Обработчик ссылок: принимает токен ссылки и должен вернуть значение для
     * атрибута `href`. На вход может быть несколько типов токенов: Link, Hashtag
     */
    link: (token: Token) => string,

    /**
     * Нужно ли исправлять завершающий перевод строки.
     * Используется для режима редактирования, когда для отображения
     * последнего перевода строки нужно добавить ещё один
     */
    fixTrailingLine: boolean;

    /** Заменять текстовые смайлы на эмоджи */
    replaceTextEmoji: boolean;

    /** Заменяем все пробелы и переводы строк на неразрывный пробел */
    nowrap?: boolean;
}

const formats: ClassFormat[] = [
    [TokenFormat.Bold, 'bold'],
    [TokenFormat.Italic, 'italic'],
    [TokenFormat.Monospace, 'monospace'],
    [TokenFormat.Strike, 'strike'],
    [TokenFormat.Underline, 'underline'],
    [TokenFormat.Heading, 'heading'],
    [TokenFormat.Marked, 'marked'],
    [TokenFormat.Highlight, 'highlight'],
    [TokenFormat.Link, 'md-link'],
    [TokenFormat.LinkLabel, 'md-link-label'],
];

const tokenTypeClass: Record<TokenType, string> = {
    [TokenType.Command]: 'command',
    [TokenType.HashTag]: 'hashtag',
    [TokenType.Link]: 'link',
    [TokenType.Markdown]: 'md',
    [TokenType.Mention]: 'mention',
    [TokenType.Text]: '',
    [TokenType.UserSticker]: 'user-sticker',
    [TokenType.Newline]: 'newline',
}

const defaultOptions: RenderOptions = {
    fixTrailingLine: false,
    replaceTextEmoji: false,
    link: getLink
}

export default function render(elem: HTMLElement, tokens: Token[], opt?: Partial<RenderOptions>): void {
    const options: RenderOptions = opt ? { ...defaultOptions, ...opt }: defaultOptions;
    const state = new ReconcileState(elem, options);
    // let prevToken: Token | undefined;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (!token.value) {
            continue;
        }

        const elem = renderTokenContainer(token, state);
        const groupEnd = nextInGroup(tokens, i);
        if (groupEnd !== i) {
            // Можем схлопнуть несколько токенов в один
            elem.className = getTokenTypeClass(token);
            const innerState = new ReconcileState(elem, options);

            while (i <= groupEnd) {
                const innerElem = innerState.elem('span');
                innerElem.className = formatClassNames(tokens[i].format);
                renderText(tokens[i], innerElem, options);
                i++;
            }
            i = groupEnd;
            innerState.trim();
        } else {
            elem.className = joinClassNames([
                getTokenTypeClass(token),
                formatClassNames(token.format)
            ]);

            if (token.type !== TokenType.UserSticker && (token.type !== TokenType.Newline || options.nowrap)) {
                renderText(token, elem, options);
            }
        }

        // prevToken = token;
    }

    // NB: Проверяем именно `prevToken`, который мы обработали.
    // Если брать последний, это может быть sticky-токен, который надо пропустить
    // if (options.fixTrailingLine && prevToken && prevToken.value.slice(-1) === '\n') {
    //     state.elem('br');
    // }
    if (options.fixTrailingLine && tokens.length) {
        state.elem('br');
    }

    state.trim();
}

/**
 * Отрисовка текстового содержимого в указанном контейнере с учётом наличия эмоджи
 * внутри токена
 */
function renderText(token: Token, elem: HTMLElement, options: RenderOptions): void {
    let { emoji, value } = token;

    if (options.nowrap) {
        value = value
            .replace(/\r\n/g, '\n')
            .replace(/[\s\n]/g, '\u00a0')
    }

    if (emoji && options.emoji) {
        let offset = 0;
        const state = new ReconcileState(elem, options);

        if (!options.replaceTextEmoji || (token.format & TokenFormat.Monospace)) {
            // Для monospace не заменяем текстовые эмоджи, также не заменяем их,
            // если отключена опция
            emoji = emoji.filter(isEmojiSymbol);
        }

        emoji.forEach(emojiToken => {
            const text = value.slice(offset, emojiToken.from);
            const rawEmoji = value.slice(emojiToken.from, emojiToken.to);
            const emoji = emojiToken.emoji || rawEmoji;

            if (text) {
                state.text(text);
            }

            state.emoji(emoji, rawEmoji);
            offset = emojiToken.to;
        });

        const tail = value.slice(offset);
        if (tail) {
            state.text(tail);
        }

        state.trim();
    } else {
        setTextValue(elem, value);
    }
}

/**
 * Возвращает список классов форматирования для указанного формата токена
 */
function formatClassNames(format: TokenFormat): string {
    let result = '';
    let glue = '';

    // Укажем классы с форматированием
    formats.forEach(([f, value]) => {
        if (format & f) {
            result += glue + value;
            glue = ' ';
        }
    });

    return result;
}

function joinClassNames(classNames: string[]): string {
    let result = '';
    let glue = '';
    classNames.forEach(cl => {
        if (cl) {
            result += glue + cl;
            glue = ' ';
        }
    });

    return result;
}

function setTextValue(node: Node, text: string): void {
    if (isElement(node)) {
        // В элементе могут быть в том числе картинки с эмоджи, которые не отобразятся
        // в node.textContent. Поэтому сделаем проверку: если есть потомок и
        // он только один, то меняем `textContent`, иначе очищаем узел
        let ptr = node.firstChild;
        let next: ChildNode;
        let updated = false;

        // Чтобы меньше моргала подсветка спеллчекера, попробуем
        // найти ближайший текстовый узел и обновить его, попутно удаляя все
        // промежуточные узлы
        while (ptr) {
            if (ptr.nodeType === Node.TEXT_NODE) {
                setTextValue(ptr, text);
                updated = true;

                // Удаляем оставшиеся узлы
                while (ptr.nextSibling) {
                    ptr.nextSibling.remove();
                }
                break;
            } else {
                next = ptr.nextSibling;
                ptr.remove();
                ptr = next;
            }
        }

        if (!updated) {
            node.textContent = text;
        }
    } else if (node.textContent !== text) {
        node.textContent = text;
    }
}

/**
 * Добавляет указанный узел `node` в позицию `pos` потомков `elem`
 */
function insertAt<T extends Node>(elem: HTMLElement, child: T, pos: number): T {
    const curChild = elem.childNodes[pos];
    if (curChild) {
        elem.insertBefore(child, curChild);
    } else {
        elem.appendChild(child);
    }

    return child;
}

/**
 * Удаляет указанный DOM-узел
 */
function remove(node: ChildNode, emoji?: EmojiRender): void {
    if (emoji && isElement(node)) {
        cleanUpEmoji(node, emoji);
    }
    node.remove();
}

class ReconcileState {
    /** Указатель на текущую позицию потомка внутри `container` */
    public pos = 0;
    constructor(public container: HTMLElement, public options: RenderOptions) {}

    /**
     * Ожидает текстовый узел в позиции `pos`. Если его нет, то автоматически создаст
     * со значением `value`, а если есть, то обновит значение на `value`
     */
    text(value: string): Text {
        let node = this.container.childNodes[this.pos];
        if (node?.nodeType === 3) {
            if (node.nodeValue !== value) {
                node.nodeValue = value;
            }
        } else {
            node = document.createTextNode(value);
            insertAt(this.container, node, this.pos);
        }
        this.pos++;
        return node as Text;
    }

    /**
     * Ожидает элемент с именем `name` в текущей позиции. Если его нет, то создаст
     * такой
     */
    elem(name: string): HTMLElement {
        let node = this.container.childNodes[this.pos];
        if (!isElement(node) || node.localName !== name) {
            node = document.createElement(name);
            insertAt(this.container, node, this.pos);
        }
        this.pos++;
        return node as HTMLElement;
    }

    /**
     * Ожидает элемент с указанным эмоджи, при необходимости создаёт или обновляет его
     */
    emoji(actualEmoji: string, rawEmoji: string): Element | void {
        const { emoji } = this.options;
        const node = this.container.childNodes[this.pos];
        const isCurEmoji = node ? isEmoji(node) : false;
        const next = emoji(actualEmoji, isCurEmoji ? node as Element : null);

        if (next) {
            if (node !== next) {
                insertAt(this.container, next, this.pos);
                if (isCurEmoji) {
                    remove(node, emoji);
                }
            }
            next.$$emoji = true;
            next.setAttribute('data-raw', rawEmoji);
            this.pos++;
            return next;
        } else if (isCurEmoji) {
            remove(node, emoji);
        }
    }

    /**
     * Удаляет все дочерние элементы контейнера, которые находятся правее точки `pos`
     */
    trim(): void {
        const { emoji } = this.options;
        while (this.pos < this.container.childNodes.length) {
            remove(this.container.childNodes[this.pos], emoji);
        }
    }
}

function isElement(node?: Node): node is HTMLElement {
    return node?.nodeType === 1;
}

/**
 * Возвращает позицию элемента, до которого можно сделать единую с элементом
 * в позиции `pos` группу. Используется, например, для того, чтобы сгруппировать
 * в единый `<a>`-элемент ссылку с внутренним форматированием
 */
function nextInGroup(tokens: Token[], pos: number): number {
    const cur = tokens[pos];
    let nextPos = pos;

    while (nextPos < tokens.length - 1) {
        if (!canGroup(cur, tokens[nextPos + 1])) {
            break;
        }
        nextPos++;
    }

    return nextPos;
}

/**
 * Вернёт `true`, если два токена можно сгруппировать в один
 */
function canGroup(t1: Token, t2: Token): boolean {
    if (t1 === t2) {
        return true;
    }

    if (t1.type === t2.type) {
        return (t1.type === TokenType.Link && t1.link === (t2 as TokenLink).link)
            || (t1.type === TokenType.Mention && t1.mention === (t2 as TokenMention).mention)
            || (t1.type === TokenType.HashTag && t1.hashtag === (t2 as TokenHashTag).hashtag);
    }

    return false;
}

/**
 * Отрисовывает контейнер для указанного токена
 */
function renderTokenContainer(token: Token, state: ReconcileState): HTMLElement {
    let elem: HTMLElement;

    // Ссылки рисуем только если нет моноширинного текста
    if (isRenderLink(token)) {
        elem = state.elem('a');
        elem.setAttribute('href', state.options.link(token));
        elem.setAttribute('target', '_blank');
        elem.addEventListener('mouseenter', onLinkEnter);
        elem.addEventListener('mouseleave', onLinkLeave);
    } else if (token.type === TokenType.UserSticker && state.options.emoji) {
        elem = state.emoji(token.value, token.value) as HTMLElement;
    } else if (token.type === TokenType.Newline) {
        elem = state.elem(state.options.nowrap ? 'span' : 'br');
        elem.setAttribute('data-raw', token.value);
    } else {
        elem = state.elem('span');
    }

    return elem;
}

function isEmojiSymbol(emoji: Emoji): boolean {
    return emoji.emoji === undefined;
}

export function isEmoji(elem: Node): elem is Element {
    return elem.nodeType === 1 ? (elem as Element).$$emoji : false;
}

/**
 * Очищает ресурсы эмоджи внутри указанном элементе
 */
function cleanUpEmoji(elem: Element, emoji: EmojiRender): void {
    const walker = document.createTreeWalker(elem, NodeFilter.SHOW_ELEMENT);
    let node: Element;
    while (node = walker.nextNode() as Element) {
        if (isEmoji(node)) {
            emoji(null, node);
        }
    }

    if (isEmoji(elem)) {
        emoji(null, elem);
    }
}

function getLink(token: Token): string {
    if (token.type === TokenType.HashTag) {
        return token.value;
    }

    if (token.type === TokenType.Link) {
        return token.link;
    }

    return '';
}

/**
 * Возвращает класс для указанного токена
 */
function getTokenTypeClass(token: Token): string {
    if (isAutoLink(token) && (token.format & TokenFormat.Monospace)) {
        return '';
    }

    if (isPrefixedToken(token) && token.value.length === 1) {
        return '';
    }

    if (isRenderLink(token)) {
        let { type } = token;
        if (isCustomLink(token) && token.link[0] === '@') {
            type = TokenType.Mention;
        }

        return type !== TokenType.Link ? `${tokenTypeClass.link} ${tokenTypeClass[type]}` : tokenTypeClass[type];
    }

    return tokenTypeClass[token.type];
}

/**
 * Если указанный токен является ссылкой, вернёт `true`, если его можно нарисовать
 * как ссылку
 */
function isRenderLink(token: Token): boolean {
    if ((token.format & TokenFormat.Monospace)) {
        // Внутри моноширинного текста разрешаем только «ручные» ссылки либо
        // полные автоссылки (начинаются с протокола)
        return token.type === TokenType.Link && (!token.auto || /^[a-z+]+:\/\//i.test(token.value));
    }

    if (isPrefixedToken(token)) {
        return token.value.length > 1;
    }

    return token.type === TokenType.Link;
}

function isPrefixedToken(token: Token): token is TokenMention | TokenCommand | TokenHashTag {
    return token.type === TokenType.Mention
        || token.type === TokenType.Command
        || token.type === TokenType.HashTag;
}

function onLinkEnter(evt: MouseEvent) {
    dispatch(evt.target as Element, 'linkenter');
}

function onLinkLeave(evt: MouseEvent) {
    dispatch(evt.target as Element, 'linkleave');
}

export function dispatch<T = unknown>(elem: Element, eventName: string, detail?: T): void {
    elem.dispatchEvent(new CustomEvent<T>(eventName, {
        bubbles: true,
        cancelable: true,
        detail
    }));
}
