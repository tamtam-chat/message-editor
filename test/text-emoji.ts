import { strictEqual as equal, deepStrictEqual as deepEqual } from 'assert';
import _parse from '../src/parser';
import { Token, TokenTextEmoji, TokenType } from '../src/formatted-string/types';

function parse(text: string) {
    return _parse(text, { textEmoji: true });
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

describe('Text Emoji', () => {
    it('detect at word bounds', () => {
        let tokens = parse(':)');
        let t = tokens[0] as TokenTextEmoji;
        deepEqual(types(tokens), [TokenType.TextEmoji]);
        equal(t.value, ':)');
        equal(t.emoji, '🙂');

        tokens = parse(':))))');
        t = tokens[0] as TokenTextEmoji;
        deepEqual(types(tokens), [TokenType.TextEmoji, TokenType.Text]);
        deepEqual(values(tokens), [':)', ')))']);
        equal(t.value, ':)');
        equal(t.emoji, '🙂');
        // let t = tokens[0] as TokenTextEmoji;

        tokens = parse('a:)');
        deepEqual(types(tokens), [TokenType.Text]);

        tokens = parse(':)a');
        deepEqual(types(tokens), [TokenType.Text]);
    });
});
