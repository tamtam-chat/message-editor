import type ParserState from './state';
import { consumeTree, createTree } from './tree';
import { last } from './utils';
import aliases from '../data/emoji-aliases';
import { type Emoji, TokenType } from './types';

const lookup = createTree(Object.keys(aliases));

export default function parseTextEmoji(state: ParserState): boolean {
    if (state.options.textEmoji) {
        const { pos } = state;

        // Если нашли совпадение, то убедимся, что оно на границе слов
        if (consumeTree(state, lookup)) {
            const value = state.substring(pos);
            state.pushEmoji(pos, state.pos, aliases[value] || value);
            return true;
        }

        state.pos = pos;
    }

    return false;
}

function atTextEmojiBound(state: ParserState) {
    let lastTextEmoji: Emoji | undefined;
    if (state.hasPendingText()) {
        const emoji = last(state.emoji);
        if (emoji?.emoji && emoji.to === state.textEnd) {
            lastTextEmoji = emoji;
        }
    } else {
        const token = last(state.tokens);
        if (token?.type === TokenType.Text && token.emoji) {
            const emoji = last(token.emoji);
            if (emoji?.emoji && emoji.to === token.value.length) {
                lastTextEmoji = emoji;
            }
        }
    }

    return lastTextEmoji ? true : state.atWordBound();
}
