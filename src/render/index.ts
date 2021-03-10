import { TokenHashTag, TokenLink, TokenMention, TokenType } from '../formatted-string/types';
import { Token, TokenFormat } from '../parser';
import { codePointAt } from '../parser/utils';

type ClassFormat = [type: TokenFormat, value: string];

const formats: ClassFormat[] = [
    [TokenFormat.Bold, 'bold'],
    [TokenFormat.Italic, 'italic'],
    [TokenFormat.Monospace, 'monospace'],
    [TokenFormat.Strike, 'strike'],
    [TokenFormat.Underline, 'underline'],
    [TokenFormat.Important, 'important'],
    [TokenFormat.Highlight, 'highlight'],
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

export interface RenderOptions {
    /**
     * Функция, которая должна вернуть ссылку на картинку с указанным эмоджи.
     * Если функция не указана, эмоджи рисуется как текст
     */
    emojiUrl?: (emoji: string) => string;

    /**
     * Функция, которая вернёт ссылку на специальный ОК-эмоджи
     */
    userEmojiUrl?: (id: string) => string;

    /**
     * Нужно ли исправлять завершающий перевод строки.
     * Используется для режима редактирования, когда для отображения
     * последнего перевода строки нужно добавить ещё один
     */
    fixTrailingLine: boolean;
}

export default function render(elem: HTMLElement, tokens: Token[], opt?: Partial<RenderOptions>): void {
    const options: RenderOptions = {
        ...opt,
        emojiUrl: debugEmojiUrl,
        userEmojiUrl: id => `//i.mycdn.me/getSmile?smileId=${id}`,
        fixTrailingLine: false
    };
    const state = new ReconcileState(elem, options);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
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

    if  (options.fixTrailingLine && tokens.length) {
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
    if (token.emoji && options.emojiUrl) {
        const state = new ReconcileState(elem, options);
        let offset = 0;
        token.emoji.forEach(emojiToken => {
            const text = token.value.slice(offset, emojiToken.from);
            const rawEmoji = token.value.slice(emojiToken.from, emojiToken.to);
            const emoji = emojiToken.emoji || rawEmoji;

            if (text) {
                state.text(text);
            }

            const img = state.elem('img') as HTMLImageElement;
            const src = options.emojiUrl(emoji);
            if (img.getAttribute('src') !== src) {
                img.setAttribute('src', src);
                img.setAttribute('data-raw', token.value);
                img.alt = rawEmoji;
            }

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
    if (node.textContent !== text) {
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
 * Тестовая функция для проверки вывода эмоджи как картинки
 */
function debugEmojiUrl(emoji: string): string {
    const codePoints: string[] = [];
    let i = 0;
    let cp: number;
    while (i < emoji.length) {
        cp = codePointAt(emoji, i);
        i += cp > 0xFFFF ? 2 : 1;

        if (cp !== 0xFE0F && cp !== 0x200D) {
            codePoints.push(cp.toString(16));
        }
    }

    return `//st.mycdn.me/static/emoji/3-0-4/20/${codePoints.join('-')}@2x.png`;
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
     * Удаляет все дочерние элементы контейнера, которые находятся правее точки `pos`
     */
    trim(): void {
        while (this.pos < this.container.childNodes.length - 1) {
            this.container.childNodes[this.pos].remove();
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

    if (t1.type === t2.value) {
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
        case TokenType.Command:
        case TokenType.HashTag:
        case TokenType.Mention:
            elem = state.elem('a');
            elem.setAttribute('href', token.value);
            break;
        case TokenType.Link:
            elem = state.elem('a');
            elem.setAttribute('href', token.link);
            break;
        case TokenType.UserSticker:
            if (state.options.userEmojiUrl) {
                elem = state.elem('img');
                const src = state.options.userEmojiUrl(token.stickerId);
                if (src !== elem.getAttribute('src')) {
                    elem.setAttribute('src', src);
                    elem.setAttribute('data-raw', token.value);
                }
            } else {
                elem = state.elem('span');
            }
            break;
        default:
            elem = state.elem('span');
    }

    return elem;
}
