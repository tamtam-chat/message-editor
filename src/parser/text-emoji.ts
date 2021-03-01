import ParserState from './state';
import { consumeTree, createTree } from './tree';
import { isDelimiter } from './utils';
import aliases from '../data/emoji-aliases';

const lookup = createTree(Object.keys(aliases));

export default function parseTextEmoji(state: ParserState): boolean {
    if (state.options.textEmoji && state.atWordBound()) {
        const { pos } = state;

        // Если нашли совпадение, то убедимся, что оно на границе слов
        if (consumeTree(state, lookup) && isDelimiter(state.peek())) {
            const value = state.substring(pos);
            state.pushEmoji(pos, state.pos, aliases[value] || value);
            return true;
        }

        state.pos = pos;
    }

    return false;
}
