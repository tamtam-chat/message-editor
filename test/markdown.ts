import { strictEqual as equal, deepStrictEqual as deepEqual } from 'assert';
import _parse, { TokenFormat, TokenType } from '../src/parser';
import type { Token, ParserOptions } from '../src/parser';
import { mdInsertText, mdRemoveText, mdSetFormat, mdToText, textToMd } from '../src/formatted-string';
import type { TextRange } from '../src/formatted-string';

const opt: ParserOptions = {
    command: true,
    hashtag: true,
    link: true,
    mention: true,
    textEmoji: false,
    userSticker: true,
    markdown: true,
};

function parse(text: string) {
    return _parse(text, opt);
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

        tokens = parse('a *b** c');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Text]);
        // deepEqual(values(tokens), ['a ', '*', 'b', '*', '* c']);
    });

    it('custom links', () => {
        let tokens = parse('[some label](tamtam.chat)');
        deepEqual(types(tokens), [TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Markdown, TokenType.Link, TokenType.Markdown]);
        deepEqual(values(tokens), ['[', 'some label', ']', '(', 'tamtam.chat', ')']);

        tokens = parse('aa[some label](tamtam.chat)bb');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Markdown, TokenType.Text, TokenType.Markdown, TokenType.Markdown, TokenType.Link, TokenType.Markdown, TokenType.Text]);
        deepEqual(values(tokens), ['aa', '[', 'some label', ']', '(', 'tamtam.chat', ')', 'bb']);

        // Форматирование внутри подписи
        tokens = parse('[*some* _label_](tamtam.chat)');
        deepEqual(types(tokens), [
            TokenType.Markdown,
            TokenType.Markdown, TokenType.Text,  TokenType.Markdown,
            TokenType.Text,
            TokenType.Markdown, TokenType.Text, TokenType.Markdown,
            TokenType.Markdown,
            TokenType.Markdown, TokenType.Link, TokenType.Markdown]);
        deepEqual(values(tokens), ['[', '*', 'some', '*', ' ', '_', 'label', '_', ']', '(', 'tamtam.chat', ')']);
    });

    it('invalid custom link', () => {
        let tokens = parse('[some label(tamtam.chat)');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text]);
        deepEqual(values(tokens), ['[some label(', 'tamtam.chat', ')']);

        tokens = parse('[some label]tamtam.chat)');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text]);
        deepEqual(values(tokens), ['[some label]', 'tamtam.chat', ')']);

        tokens = parse('[some label](tamtam.chat');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link]);
        deepEqual(values(tokens), ['[some label](', 'tamtam.chat']);
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

        const t4_1 = parse('hello [world](mail.ru)');
        const t4_2 = mdSetFormat(t4_1, { add: TokenFormat.Bold }, 7, 5, opt);
        equal(text(t4_2), 'hello [*world*](mail.ru)');


        // sticky-форматирование
        const t5_1 = parse('hello  world');
        const t5_2 = mdSetFormat(t5_1, { add: TokenFormat.Bold }, 6, 0, opt);

        const pos: TextRange = [7, 0];
        equal(text(t5_2), 'hello ** world');
        const t5_3 = mdToText(t5_2, pos);
        deepEqual(pos, [6, 0]);

        // Правильно обновляем позицию
        textToMd(t5_3, pos);
        deepEqual(pos, [7, 0]);
    });

    it('markdown to text converter', () => {
        // Выделяем текст `some label`
        const pos: TextRange = [16, 12];
        let str = 'hello `world` [*some* _label_](tamtam.chat) here';
        let text = mdToText(parse(str), pos);

        deepEqual(types(text), [
            TokenType.Text, TokenType.Text, TokenType.Text,
            TokenType.Link, TokenType.Link, TokenType.Link,
            TokenType.Text
        ]);
        deepEqual(values(text), ['hello ', 'world', ' ', 'some', ' ', 'label', ' here']);

        // Модифицируем диапазон таким образом, чтобы он выделял чистый текст
        // `some label`
        deepEqual(pos, [12, 10]);
        equal(textToMd(text), str);

        // Две ссылки рядом
        str = '[*a*](mail.ru)[_b_](ok.ru)';
        text = mdToText(parse(str));

        deepEqual(types(text), [TokenType.Link, TokenType.Link]);
        deepEqual(values(text), ['a', 'b']);
        equal(textToMd(text), str);

        text = mdToText(parse('aa *_bb_* cc'));
        deepEqual(types(text), [TokenType.Text, TokenType.Text, TokenType.Text]);
        deepEqual(values(text), ['aa ', 'bb', ' cc']);
    });

    it('adjust text range', () => {
        const md = parse('hello `world` [*some* _label_](tamtam.chat) here');

        // Выделяем `world`
        let pos: TextRange = [6, 7];
        let tokens = mdToText(md, pos);
        deepEqual(pos, [6, 5]);
        equal(text(tokens).substr(pos[0], pos[1]), 'world');

        // Частично выделяем ссылку
        pos = [23, 11];
        tokens = mdToText(md, pos);
        deepEqual(pos, [17, 5]);
        equal(text(tokens).substr(pos[0], pos[1]), 'label');


        // Выделяем подпись ссылки и текст за ним
        pos = [23, 23];
        tokens = mdToText(md, pos);
        deepEqual(pos, [17, 8]);
        equal(text(tokens).substr(pos[0], pos[1]), 'label he');
    });

    it('overlapping format', () => {
        const tokens = parse('_hello, *mark_ down* world!');
        deepEqual(tokens, [
            { type: TokenType.Markdown, format: TokenFormat.Italic, value: '_' },
            { type: TokenType.Text, format: TokenFormat.Italic, value: 'hello, ', sticky: false },
            { type: TokenType.Markdown, format: TokenFormat.Italic | TokenFormat.Bold, value: '*' },
            { type: TokenType.Text, format: TokenFormat.Italic | TokenFormat.Bold, value: 'mark', sticky: false },
            { type: TokenType.Markdown, format: TokenFormat.Italic | TokenFormat.Bold, value: '_' },
            { type: TokenType.Text, format: TokenFormat.Bold, value: ' down', sticky: false },
            { type: TokenType.Markdown, format: TokenFormat.Bold, value: '*' },
            { type: TokenType.Text, format: TokenFormat.None, value: ' world!', sticky: false }
        ]);
    });
});
