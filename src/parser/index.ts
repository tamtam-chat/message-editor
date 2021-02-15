import { Token } from '../formatted-string';
import ParserState from './state';
import emoji from './emoji';

export default function parse(text: string): Token[] {
    const state = new ParserState(text);
    let token: Token;

    while (state.hasNext()) {
        token = emoji(state);
        if (token) {
            state.push(token);
        } else {
            state.consumeText();
        }
    }

    state.flushText();
    return state.tokens;
}
