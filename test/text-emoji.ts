import { strictEqual as equal, deepStrictEqual as deepEqual } from 'assert';
import _parse, { TokenType }  from '../src/parser';
import type { Token, TokenText } from '../src/parser';

function parse(text: string) {
    return _parse(text, { textEmoji: true });
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

function emojiValue(token: Token, pos = 0): string | undefined {
    if (token.type === TokenType.Text && token.emoji) {
        const e = token.emoji[pos];
        return token.value.substring(e.from, e.to);
    }
}

function emojiAlias(token: Token, pos = 0): string | undefined {
    if (token.type === TokenType.Text && token.emoji) {
        return token.emoji[pos].emoji;
    }
}

describe('Text Emoji', () => {
    it('detect at word bounds', () => {
        let tokens = parse(':)');
        let t = tokens[0] as TokenText;
        deepEqual(types(tokens), [TokenType.Text]);
        equal(emojiValue(t, 0), ':)');
        equal(emojiAlias(t, 0), '🙂');

        tokens = parse(':))))');
        t = tokens[0] as TokenText;
        deepEqual(types(tokens), [TokenType.Text]);
        deepEqual(values(tokens), [':))))']);
        equal(emojiValue(t, 0), ':)');
        equal(emojiAlias(t, 0), '🙂');
        // let t = tokens[0] as TokenTextEmoji;

        tokens = parse('a:)');
        t = tokens[0] as TokenText;
        deepEqual(types(tokens), [TokenType.Text]);
        // equal(t.emoji, undefined);
        equal(emojiValue(t, 0), ':)');
        equal(emojiAlias(t, 0), '🙂');

        tokens = parse(':)a');
        t = tokens[0] as TokenText;
        deepEqual(types(tokens), [TokenType.Text]);
        equal(emojiValue(t, 0), ':)');
        equal(emojiAlias(t, 0), '🙂');
    });

    it('multiple text smiles', () => {
        const tokens = parse(':):):):)');
        const t = tokens[0] as TokenText;
        deepEqual(types(tokens), [TokenType.Text]);
        deepEqual(t.emoji, [
            { from: 0, to: 2, emoji: '🙂' },
            { from: 2, to: 4, emoji: '🙂' },
            { from: 4, to: 6, emoji: '🙂' },
            { from: 6, to: 8, emoji: '🙂' }
        ]);
    });
});
