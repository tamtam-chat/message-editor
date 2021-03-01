import { Token, TokenFormat } from '../formatted-string';
import ParserState from './state';
import { ParserOptions } from './types';
import emoji from './emoji';
import textEmoji from './text-emoji';
import userSticker from './user-sticker';
import mention from './mention';
import command from './command';
import hashtag from './hashtag';
import link from './link';
import markdown from './markdown';

const defaultOptions: ParserOptions = {
    markdown: false,
    textEmoji: false,
    hashtag: false,
    mention: false,
    command: false,
    userSticker: false,
    link: true,
};

export default function parse(text: string, opt?: Partial<ParserOptions>): Token[] {
    const options: ParserOptions = { ...defaultOptions, ...opt };
    const state = new ParserState(text, options);

    while (state.hasNext()) {
        markdown(state)
            || emoji(state) || textEmoji(state) || userSticker(state)
            || mention(state) || command(state) || hashtag(state)
            || link(state)
            || state.consumeText();
    }

    state.flushText();

    // Если есть незакрытые токены форматирования, сбрасываем их формат,
    // так как они не валидны
    for (let i = 0; i < state.formatStack.length; i++) {
        state.formatStack[i].format = TokenFormat.None;
    }

    return state.tokens;
}
