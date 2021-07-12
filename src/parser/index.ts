import ParserState from './state';
import { ParserOptions, Token, TokenType, TokenFormat } from './types';
import emoji from './emoji';
import textEmoji from './text-emoji';
import userSticker from './user-sticker';
import mention from './mention';
import command from './command';
import hashtag from './hashtag';
import link from './link';
import markdown from './markdown';
import newline from './newline';
import { normalize } from './utils';

const defaultOptions: ParserOptions = {
    markdown: false,
    textEmoji: false,
    hashtag: false,
    mention: false,
    command: false,
    userSticker: false,
    link: false,
    stickyLink: false
};

export default function parse(text: string, opt?: Partial<ParserOptions>): Token[] {
    const options: ParserOptions = { ...defaultOptions, ...opt };
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

export {
    ParserOptions, Token, TokenType, TokenFormat, Emoji,
    TokenCommand, TokenHashTag, TokenLink, TokenMarkdown, TokenMention, TokenText, TokenUserSticker
} from './types';
