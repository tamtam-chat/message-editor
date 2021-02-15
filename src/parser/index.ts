import { Token } from '../formatted-string';
import ParserState from './state';
import { ParserOptions } from './types';
import emoji from './emoji';
import textEmoji from './text-emoji';

const defaultOptions: ParserOptions = {
    formatting: false,
    textEmoji: false,
    hashtag: false,
    mention: false,
    command: false,
}

export default function parse(text: string, opt?: Partial<ParserOptions>): Token[] {
    const options: ParserOptions = { ...defaultOptions, ...opt };
    const state = new ParserState(text);
    let token: Token;

    while (state.hasNext()) {
        token = emoji(state) || textEmoji(state, options);
        if (token) {
            state.push(token);
        } else {
            state.consumeText();
        }
    }

    state.flushText();
    return state.tokens;
}
