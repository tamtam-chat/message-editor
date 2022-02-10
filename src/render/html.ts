import { TokenFormat, TokenType } from '../parser/types';
import type { Token, TokenLink } from '../parser/types';
import { isPlainText, isRenderLink, nextInGroup } from './index';

type ClassFormat = [format: TokenFormat, prop: string];

const formats: ClassFormat[] = [
    [TokenFormat.Bold, 'font-weight:bold'],
    [TokenFormat.Italic, 'font-style:italic'],
    [TokenFormat.Monospace, 'font-family:monospace'],
    [TokenFormat.Strike, 'text-decoration:line-through'],
    [TokenFormat.Underline, 'text-decoration:underline'],
    [TokenFormat.Heading, 'font-size:2em'],
    [TokenFormat.Marked, 'color:#FB372B'],
];

export default function renderHTML(tokens: Token[]): string {
    const chunks: string[] = []
    for (let i = 0; i < tokens.length; i++) {
        i = renderTokens(tokens, i, chunks);
    }
    return chunks.join('');
}

function renderTokens(tokens: Token[], i: number,  chunks: string[]): number {
    const token = tokens[i];
    if (!token.value) {
        // Скорее всего sticky-токен, пропускаем
        return i;
    }

    const groupEnd = nextInGroup(tokens, i);
    if (groupEnd !== i) {
        // Можем схлопнуть несколько токенов в один
        const baseFormat = token.format;
        const tagName = renderTokenContainer(token, chunks);

        while (i <= groupEnd) {
            const innerToken = tokens[i];
            if (innerToken.format === baseFormat) {
                chunks.push(token.value);
            } else {
                renderTextToken(innerToken, chunks);
            }
            i++;
        }
        chunks.push(`</${tagName}>`);
        return groupEnd;
    }

    if (token.type === TokenType.Newline || isPlainText(token)) {
        chunks.push(token.value);
    } else {
        renderTextToken(token, chunks);
    }

    return i;
}

/**
 * Отрисовывает контейнер для указанного токена
 */
function renderTokenContainer(token: Token, chunks: string[]): string {
    let attrs = styleAttr(token);
    let tagName = 'span';

    // Ссылки рисуем только если нет моноширинного текста
    if (isRenderLink(token)) {
        tagName = 'a';
        attrs += ` href="${(token as TokenLink).link}"`;
    }

    chunks.push(`<${tagName}${attrs}>`);
    return tagName;
}

function renderTextToken(token: Token, chunks: string[]) {
    if (token.type !== TokenType.UserSticker) {
        chunks.push(`<span${styleAttr(token)}>${token.value}</span>`);
    }
}

function styleAttr(token: Token): string {
    const css = formatCSS(token.format);
    return css ? ` style="${css}"` : '';
}

/**
 * Возвращает список классов форматирования для указанного формата токена
 */
function formatCSS(format: TokenFormat): string {
    const chunks: string[] = [];

    formats.forEach(([f, value]) => {
        if (format & f) {
            chunks.push(value);
        }
    });

    return chunks.join(';');
}
