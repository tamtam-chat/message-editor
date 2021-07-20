import { TokenFormat, TokenType } from './types';
import ParserState from './state';
import { Codes, consumeIdentifier, isDelimiter, isNumber, isUnicodeAlpha } from './utils';

export default function parseMention(state: ParserState): boolean {
    if (state.options.mention && state.atWordBound()) {
        const { pos } = state;
        const consumer = state.options.mention === 'strict'
            ? consumeIdentifier
            : consumeMentionName;
        if (state.consume(Codes.At)) {
            // Разрешаем поглотить самостоятельный символ `@`, чтобы показывать
            // автокомплит в редакторе
            if (consumer(state) || isDelimiter(state.peek())) {
                const value = state.substring(pos);
                state.push({
                    type: TokenType.Mention,
                    format: TokenFormat.None,
                    value,
                    mention: value.slice(1)
                });
                return true;
            }
        }

        state.pos = pos;
    }

    return false;
}

function consumeMentionName(state: ParserState): boolean {
    // Упоминание является промежуточным токеном, который используется для того,
    // чтобы сгенерировать ссылку (type=Link). Поэтому разрешаем обычный алфавит,
    // чтобы работал поиск по пользователям на UI
    return state.consumeWhile(isMentionName);
}

/**
 * Упоминание является промежуточным
 */
function isMentionName(ch: number): boolean {
    return isNumber(ch) || isUnicodeAlpha(ch) || ch === Codes.Underscore || ch === Codes.Hyphen;
}
