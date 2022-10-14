import ParserState from './state';
import { TokenType, TokenFormat } from './types';
import type { ParserOptions, Token } from './types';
import emoji from './emoji';
import textEmoji from './text-emoji';
import userSticker from './user-sticker';
import mention from './mention';
import command from './command';
import hashtag from './hashtag';
import link from './link';
import newline from './newline';
import { defaultOptions } from './utils';

export default function parse(text: string, opt?: Partial<ParserOptions>): Token[] {
    const options: ParserOptions = { ...defaultOptions, ...opt };
    const state = new ParserState(text, options);

    while (state.hasNext()) {
         newline(state)
            || emoji(state) || textEmoji(state) || userSticker(state)
            || mention(state) || command(state) || hashtag(state)
            || link(state)
            || state.consumeText();
    }

    state.flushText();

    let { tokens } = state;

    return tokens;
}

export { normalize, getText, getLength, codePointAt } from './utils';

export type {
    ParserOptions, Emoji,
    Token, TokenCommand, TokenHashTag, TokenLink, TokenMarkdown, TokenMention, TokenText, TokenUserSticker
} from './types';

export { TokenType, TokenFormat } from './types';
