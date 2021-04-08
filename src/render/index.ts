import { Token, TokenFormat, TokenHashTag, TokenLink, TokenMention, TokenType, Emoji } from '../parser';

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
     * Нужно ли исправлять завершающий перевод строки.
     * Используется для режима редактирования, когда для отображения
     * последнего перевода строки нужно добавить ещё один
     */
    fixTrailingLine: boolean;

    /** Заменять текстовые смайлы на эмоджи */
    replaceTextEmoji: boolean;
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
}

const defaultOptions: RenderOptions = {
    fixTrailingLine: false,
    replaceTextEmoji: false,
}

export default function render(elem: HTMLElement, tokens: Token[], opt?: Partial<RenderOptions>): void {
    const options: RenderOptions = opt ? { ...defaultOptions, ...opt }: defaultOptions;
    const state = new ReconcileState(elem, options);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (!token.value) {
            continue;
        }

        const elem = renderTokenContainer(token, state);
        const groupEnd = nextInGroup(tokens, i);
        if (groupEnd !== i) {
            // Можем схлопнуть несколько токенов в один
            elem.className = tokenTypeClass[token.type];
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
                tokenTypeClass[token.type],
                formatClassNames(token.format)
            ]);
            if (token.type !== TokenType.UserSticker) {
                renderText(token, elem, options);
            }
        }
    }

    if (options.fixTrailingLine && tokens.length) {
        const lastToken = tokens[tokens.length - 1];
        if (lastToken.value.slice(-1) === '\n') {
            state.text('\n');
        }
    }

    state.trim();
}

/**
 * Отрисовка текстового содержимого в указанном контейнере с учётом наличия эмоджи
 * внутри токена
 */
function renderText(token: Token, elem: HTMLElement, options: RenderOptions): void {
    let { emoji } = token;
    if (emoji && options.emoji) {
        let offset = 0;
        const state = new ReconcileState(elem, options);

        if (!options.replaceTextEmoji || (token.format & TokenFormat.Monospace)) {
            // Для monospace не заменяем текстовые эмоджи, также не заменяем их,
            // если отключена опция
            emoji = emoji.filter(isEmojiSymbol);
        }

        emoji.forEach(emojiToken => {
            const text = token.value.slice(offset, emojiToken.from);
            const rawEmoji = token.value.slice(emojiToken.from, emojiToken.to);
            const emoji = emojiToken.emoji || rawEmoji;

            if (text) {
                state.text(text);
            }

            state.emoji(emoji, rawEmoji);
            offset = emojiToken.to;
        });

        const tail = token.value.slice(offset);
        if (tail) {
            state.text(tail);
        }

        state.trim();
    } else {
        setTextValue(elem, token.value);
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
    switch (token.type) {
        // case TokenType.Command:
        // case TokenType.Mention:
        case TokenType.HashTag:
            elem = state.elem('a');
            elem.setAttribute('href', token.value);
            break;
        case TokenType.Link:
            elem = state.elem('a');
            elem.setAttribute('href', token.link);
            break;
        case TokenType.UserSticker:
            if (state.options.emoji) {
                elem = state.emoji(token.value, token.value) as HTMLElement;
            } else {
                elem = state.elem('span');
            }
            break;
        default:
            elem = state.elem('span');
    }

    return elem;
}

function isEmojiSymbol(emoji: Emoji): boolean {
    return emoji.emoji === undefined;
}

function isEmoji(elem: Node): elem is Element {
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
