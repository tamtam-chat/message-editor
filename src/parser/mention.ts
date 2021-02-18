import { TokenType } from '../formatted-string/types';
import ParserState from './state';
import { ParserOptions } from './types';
import { Codes, consumeIdentifier, isCodeBlock, isDelimiter } from './utils';

export default function parseMention(state: ParserState, options: ParserOptions): boolean {
    if (options.mention && !isCodeBlock(state) && state.atWordBound()) {
        const { pos } = state;
        if (state.consume(Codes.At)) {
            // Разрешаем поглотить самостоятельный символ `@`, чтобы показывать
            // автокомплит в редакторе
            if (consumeIdentifier(state) || isDelimiter(state.peek())) {
                const value = state.substring(pos);
                state.push({
                    type: TokenType.Mention,
                    format: state.format,
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
