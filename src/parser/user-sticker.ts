import { TokenFormat, TokenType } from '../formatted-string/types';
import ParserState from './state';
import { ParserOptions } from './types';
import { consumeArray, isAlphaNumeric, isCodeBlock } from './utils';

const begin = [35, 117]; // #u
const end = [115, 35];  // s#

export default function parseUserSticker(state: ParserState, options: ParserOptions): boolean {
    if (options.userSticker && !isCodeBlock(state)) {
        const { pos } = state;
        if (consumeArray(state, begin)) {
            while (state.hasNext()) {
                if (consumeArray(state, end)) {
                    const value = state.substring(pos);
                    state.push({
                        type: TokenType.UserSticker,
                        format: TokenFormat.None,
                        value,
                        stickerId: value.slice(begin.length, -end.length)
                    });
                    return true;
                } else if (!state.consume(isAlphaNumeric)) {
                    break;
                }
            }
        }

        state.pos = pos;
    }

    return false;
}
