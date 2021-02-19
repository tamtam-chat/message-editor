import { TokenType } from '../formatted-string/types';
import ParserState from './state';
import { ParserOptions } from './types';
import { Codes, isCodeBlock, isCommandName, isDelimiter } from './utils';

export default function parseCommand(state: ParserState, options: ParserOptions): boolean {
    if (options.command && !isCodeBlock(state) && state.atWordBound()) {
        const { pos } = state;
        if (state.consume(Codes.Slash)) {
            // Разрешаем поглотить самостоятельный символ `/`, чтобы показывать
            // автокомплит в редакторе
            if (state.consumeWhile(isCommandName) || isDelimiter(state.peek())) {
                const value = state.substring(pos);
                state.push({
                    type: TokenType.Command,
                    format: state.format,
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
