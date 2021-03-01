import { strictEqual as equal, deepStrictEqual as deepEqual } from 'assert';
import _parse from '../src/parser';
import { Token, TokenFormat, TokenType } from '../src/formatted-string/types';

function parse(text: string) {
    return _parse(text, {
        markdown: true,
        mention: true,
        userSticker: true,
        command: true,
        hashtag: true,
        link: true,
        textEmoji: true,
    });
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

function format(tokens: Token[]): TokenFormat[] {
    return tokens.map(t => t.format);
}

describe('Markdown', () => {
    it('text', () => {
        let tokens = parse('hello world');
        deepEqual(types(tokens), [TokenType.Text]);
        deepEqual(values(tokens), ['hello world']);
        deepEqual(format(tokens), [TokenFormat.None]);

        tokens = parse('*world*');
        deepEqual(types(tokens), [TokenType.Markdown, TokenType.Text, TokenType.Markdown]);
        deepEqual(values(tokens), ['*', 'world', '*']);
        deepEqual(format(tokens), [TokenFormat.Bold, TokenFormat.Bold, TokenFormat.Bold]);

        tokens = parse('*');
        deepEqual(types(tokens), [TokenType.Markdown]);
        deepEqual(values(tokens), ['*']);
        deepEqual(format(tokens), [TokenFormat.None]);

        tokens = parse('_df_df_df_df_df_');
        deepEqual(types(tokens), [TokenType.Markdown, TokenType.Text, TokenType.Markdown]);
        deepEqual(values(tokens), ['_', 'df_df_df_df_df', '_']);
        deepEqual(format(tokens), [TokenFormat.Italic, TokenFormat.Italic, TokenFormat.Italic]);

        tokens = parse('*hello _world_*');
        deepEqual(types(tokens), [TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Markdown]);
        deepEqual(values(tokens), ['*', 'hello ', '_', 'world', '_', '*']);
        deepEqual(format(tokens), [TokenFormat.Bold, TokenFormat.Bold, TokenFormat.Bold | TokenFormat.Italic, TokenFormat.Bold | TokenFormat.Italic, TokenFormat.Bold | TokenFormat.Italic, TokenFormat.Bold]);

        tokens = parse('*hello           _world_*    ');
        deepEqual(types(tokens), [TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Markdown, TokenType.Text]);
        deepEqual(values(tokens), ['*', 'hello           ', '_', 'world', '_', '*', '    ']);
        deepEqual(format(tokens), [TokenFormat.Bold, TokenFormat.Bold, TokenFormat.Bold | TokenFormat.Italic, TokenFormat.Bold | TokenFormat.Italic, TokenFormat.Bold | TokenFormat.Italic, TokenFormat.Bold, TokenFormat.None]);

        tokens = parse('*гибдд.рф и auto.ru*');
        deepEqual(types(tokens), [TokenType.Markdown, TokenType.Link, TokenType.Text, TokenType.Link, TokenType.Markdown]);
        deepEqual(values(tokens), ['*', 'гибдд.рф', ' и ', 'auto.ru', '*']);

        tokens = parse('mail.ru?_id=123');
        deepEqual(types(tokens), [TokenType.Link]);
        deepEqual(values(tokens), ['mail.ru?_id=123']);

        tokens = parse('(_italic_)');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Text]);
        deepEqual(values(tokens), ['(', '_', 'italic', '_', ')']);

        tokens = parse('_italic😀)_');
        deepEqual(types(tokens), [TokenType.Markdown, TokenType.Text, TokenType.Markdown]);
        deepEqual(values(tokens), ['_', 'italic😀)', '_']);

        tokens = parse('test, *bold _italic_*, test');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Markdown, TokenType.Text]);
        deepEqual(values(tokens), ['test, ', '*', 'bold ', '_', 'italic', '_', '*', ', test']);

        tokens = parse('test, *bold _italic_*, test');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Markdown, TokenType.Text]);
        deepEqual(values(tokens), ['test, ', '*', 'bold ', '_', 'italic', '_', '*', ', test']);

        tokens = parse('`{ ... }`, not code');
        deepEqual(types(tokens), [TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Text]);
        deepEqual(values(tokens), ['`', '{ ... }', '`', ', not code']);
    });

    it.skip('debug', () => {
        const tokens = parse('(_italic_)');
        console.log(tokens);
    });
});
