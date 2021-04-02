import { strictEqual as equal, deepStrictEqual as deepEqual } from 'assert';
import _parse, { Token, TokenMention, TokenType } from '../src/parser';

function parse(text: string, mention: boolean | 'strict' = 'strict') {
    return _parse(text, { mention });
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

describe('Mention', () => {
    it('parse mentions', () => {
        let tokens = parse('@foo test @1 @ foo@bar');
        const mentions = tokens.filter(t => t.type === TokenType.Mention) as TokenMention[];
        deepEqual(types(tokens), [TokenType.Mention, TokenType.Text, TokenType.Mention, TokenType.Text]);
        equal(mentions.length, 2);
        equal(mentions[0].value, '@foo');
        equal(mentions[0].mention, 'foo');
        equal(mentions[1].value, '@');
        equal(mentions[1].mention, '');

        tokens = parse('@foo@');
        // mentions = tokens.filter(t => t.type === TokenType.Mention) as TokenMention[];
        deepEqual(types(tokens), [TokenType.Mention, TokenType.Text]);
        deepEqual(values(tokens), ['@foo', '@']);

        // Игнорируем не-латинские и не начинающиеся с латинского символа упоминания
        tokens = parse('@егор @1егор @1foo');
        deepEqual(types(tokens), [TokenType.Text]);
        deepEqual(values(tokens), ['@егор @1егор @1foo']);

        tokens = parse('@@ @@foo');
        deepEqual(types(tokens), [TokenType.Text]);
        deepEqual(values(tokens), ['@@ @@foo']);
    });

    it('simulate mentions typing', () => {
        let tokens = parse('foo ');
        deepEqual(types(tokens), [TokenType.Text]);
        deepEqual(values(tokens), ['foo ']);

        tokens = parse('foo @');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Mention]);
        deepEqual(values(tokens), ['foo ', '@']);

        tokens = parse('foo @b');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Mention]);
        deepEqual(values(tokens), ['foo ', '@b']);

        tokens = parse('foo @bar');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Mention]);
        deepEqual(values(tokens), ['foo ', '@bar']);

        tokens = parse('foo @@');
        deepEqual(types(tokens), [TokenType.Text]);
        deepEqual(values(tokens), ['foo @@']);
    });
});
