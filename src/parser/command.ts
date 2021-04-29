import { TokenFormat, TokenType } from './types';
import ParserState from './state';
import { Codes, isCommandName, isDelimiter, isWhitespace } from './utils';

export default function parseCommand(state: ParserState): boolean {
    if (state.options.command && atWordBound(state.peekPrev())) {
        const { pos } = state;
        if (state.consume(Codes.Slash)) {
            // Разрешаем поглотить самостоятельный символ `/`, чтобы показывать
            // автокомплит в редакторе
            if (state.consumeWhile(isCommandName) || isDelimiter(state.peek())) {
                const value = state.substring(pos);
                state.push({
                    type: TokenType.Command,
                    format: TokenFormat.None,
                    value,
                    command: value.slice(1)
                });
                return true;
            }
        }

        state.pos = pos;
    }

    return false;
}

function atWordBound(ch: number) {
    return ch !== ch || isWhitespace(ch);
}
