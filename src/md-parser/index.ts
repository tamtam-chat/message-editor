import ParserState from '../parser/state';
import { TokenType, TokenFormat } from '../parser/types';
import type { ParserOptions, Token } from '../parser/types';
import emoji from '../parser/emoji';
import textEmoji from '../parser/text-emoji';
import userSticker from '../parser/user-sticker';
import mention from '../parser/mention';
import command from '../parser/command';
import hashtag from '../parser/hashtag';
import link from './link';
import markdown from './markdown';
import newline from '../parser/newline';
import { normalize, defaultOptions } from '../parser/utils';

export default function parseMD(text: string, opt?: Partial<ParserOptions>): Token[] {
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

    // Если есть незакрытые токены форматирования, сбрасываем их формат,
    // так как они не валидны
    for (let i = 0, token: Token; i < state.formatStack.length; i++) {
        token = state.formatStack[i] as Token;
        token.format = TokenFormat.None;
        token.type = TokenType.Text;
    }

    tokens = normalize(tokens);

    return tokens;
}
