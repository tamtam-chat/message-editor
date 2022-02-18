import { TokenFormat, TokenType } from './types';
import type ParserState from './state';
import { consumeArray, isAlphaNumeric } from './utils';

const begin = [35, 117]; // #u
const end = [115, 35];  // s#

export default function parseUserSticker(state: ParserState): boolean {
    if (state.options.userSticker) {
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
