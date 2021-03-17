import { strictEqual as equal, deepStrictEqual as deepEqual } from 'assert';
import _parse, { ParserOptions } from '../src/parser';
import { Token, TokenFormat, TokenType } from '../src/formatted-string/types';
import { mdInsertText, mdRemoveText, mdSetFormat } from '../src/formatted-string/markdown';

function parse(text: string) {
    return _parse(text, {
        markdown: true,
        mention: true,
        userSticker: true,
        command: true,
        hashtag: true,
        link: true,
        textEmoji: false,
    });
}

const opt: ParserOptions = {
    command: true,
    hashtag: true,
    link: true,
    mention: true,
    textEmoji: true,
    userSticker: true,
    markdown: true,
};

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

function format(tokens: Token[]): TokenFormat[] {
    return tokens.map(t => t.format);
}

function text(tokens: Token[]): string {
    return tokens.map(t => t.value).join('');
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
        deepEqual(types(tokens), [TokenType.Text]);
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

    it('update text', () => {
        const tokens = parse('foo bar tamtam.chat');

        const t1 = mdInsertText(tokens, 4, '*', opt);
        deepEqual(types(t1), [TokenType.Text, TokenType.Link]);
        deepEqual(values(t1), ['foo *bar ', 'tamtam.chat']);
        equal(t1[0].format, TokenFormat.None);

        const t2 = mdInsertText(t1, 8, '*', opt);
        deepEqual(types(t2), [TokenType.Text, TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Text, TokenType.Link]);
        deepEqual(values(t2), ['foo ', '*', 'bar', '*', ' ', 'tamtam.chat']);
        equal(t2[1].format, TokenFormat.Bold);
        equal(t2[2].format, TokenFormat.Bold);
        equal(t2[3].format, TokenFormat.Bold);

        const t3 = mdRemoveText(t2, 4, 1, opt);
        deepEqual(types(t3), [TokenType.Text, TokenType.Link]);
        deepEqual(values(t3), ['foo bar* ', 'tamtam.chat']);
        equal(t3[0].format, TokenFormat.None);
    });

    it('update formatting', () => {
        const tokens = parse('foo bar baz');

        const t1 = mdSetFormat(tokens, TokenFormat.Bold, 0, 7, opt);
        equal(text(t1), '*foo bar* baz');

        // Добавляем формат внутри
        const t2_1 = mdSetFormat(t1, { add: TokenFormat.Italic }, 5, 3, opt);
        equal(text(t2_1), '*foo _bar_* baz');

        // Добавляем формат с «неправильным» пересечением
        const t2_2 = mdSetFormat(t1, { add: TokenFormat.Italic }, 5, 8, opt);
        equal(text(t2_2), '*foo _bar* baz_');

        // Добавление форматирования в нахлёст символов, которые не могут быть
        // границами
        const t3_1 = mdSetFormat(tokens, { add: TokenFormat.Italic }, 3, 5, opt);
        equal(text(t3_1), 'foo _bar_ baz');

        const t3_2 = mdSetFormat(tokens, { add: TokenFormat.Italic }, 2, 4, opt);
        equal(text(t3_2), 'fo _o ba_ r baz');

    });

    it.skip('debug', () => {
        const tokens = parse('-_-');
        console.log(tokens[0]);
    });
});
