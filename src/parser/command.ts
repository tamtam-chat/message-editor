import { TokenFormat, TokenType } from '../formatted-string/types';
import ParserState from './state';
import { Codes, isCommandName, isDelimiter } from './utils';

export default function parseCommand(state: ParserState): boolean {
    if (state.options.command && state.atWordBound()) {
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
