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
import markdown from './markdown';
import newline from './newline';
import { normalize, defaultOptions } from './utils';
import { objectMerge } from '../utils/objectMerge';

export default function parse(text: string, opt?: Partial<ParserOptions>): Token[] {
    const options: ParserOptions = objectMerge(defaultOptions, opt);
    const state = new ParserState(text, options);

    while (state.hasNext()) {
        markdown(state) || newline(state)
            || emoji(state) || textEmoji(state) || userSticker(state)
            || mention(state) || command(state) || hashtag(state)
            || link(state)
            || state.consumeText();
    }

    state.flushText();

    let { tokens } = state;

    if (options.markdown && state.formatStack.length) {
        // Если есть незакрытые токены форматирования, сбрасываем их формат,
        // так как они не валидны
        for (let i = 0, token: Token; i < state.formatStack.length; i++) {
            token = state.formatStack[i] as Token;
            token.format = TokenFormat.None;
            token.type = TokenType.Text;
        }

        tokens = normalize(tokens);
    }

    return tokens;
}

export { normalize, getText, getLength, codePointAt } from './utils';

export type {
    ParserOptions, Emoji,
    Token, TokenCommand, TokenHashTag, TokenLink, TokenMarkdown, TokenMention, TokenText, TokenUserSticker
} from './types';

export { TokenType, TokenFormat } from './types';
