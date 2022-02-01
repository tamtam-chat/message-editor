import ParserState from './state';
import { TokenFormat, TokenType } from './types';
import { Codes } from './utils';

export default function parseNewline(state: ParserState): boolean {
    const { pos } = state;
    if (consumeNewline(state)) {
        const value = state.substring(pos);
        state.push({
            type: TokenType.Newline,
            format: TokenFormat.None,
            value,
        });
        return true;
    }
}

export function consumeNewline(state: ParserState): boolean {
    if (state.consume(Codes.Return)) {
        state.consume(Codes.NewLine);
        return true;
    }

    return state.consume(Codes.NewLine) || state.consume(Codes.LineFeed);
}
