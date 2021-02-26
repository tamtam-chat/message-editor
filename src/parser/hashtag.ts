import { TokenFormat, TokenType } from '../formatted-string/types';
import ParserState from './state';
import { ParserOptions } from './types';
import { Codes, isBound, isCodeBlock, isCommandName, last } from './utils';

export default function parseHashtag(state: ParserState, options: ParserOptions): boolean {
    if (options.hashtag && !isCodeBlock(state) && atHashtagBound(state)) {
        const { pos } = state;
        if (state.consume(Codes.Hash)) {
            if (state.consumeWhile(isCommandName) || isBound(state.peek())) {
                const value = state.substring(pos);
                state.push({
                    type: TokenType.HashTag,
                    format: TokenFormat.None,
                    value,
                    hashtag: value.slice(1)
                });
                return true;
            }
        }

        state.pos = pos;
    }

    return false;
}

/**
 * Проверяет, находимся ли мы на границе для хэштегов. В отличие от других токенов,
 * хэштэги можно сцеплять вместе
 */
function atHashtagBound(state: ParserState): boolean {
    if (state.atWordBound()) {
        return true;
    }

    if (!state.hasPendingText()) {
        const lastToken = last(state.tokens);
        if (lastToken) {
            return lastToken.type === TokenType.HashTag;
        }
    }

    return false;
}
