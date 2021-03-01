import { TokenFormat, TokenType } from '../formatted-string/types';
import ParserState from './state';
import { Codes, consumeIdentifier, isDelimiter } from './utils';

export default function parseMention(state: ParserState): boolean {
    if (state.options.mention && state.atWordBound()) {
        const { pos } = state;
        if (state.consume(Codes.At)) {
            // Разрешаем поглотить самостоятельный символ `@`, чтобы показывать
            // автокомплит в редакторе
            if (consumeIdentifier(state) || isDelimiter(state.peek())) {
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
