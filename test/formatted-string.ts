import { strictEqual as equal, deepStrictEqual as deepEqual } from 'assert';
import {
    createToken as token, insertText, removeText, setFormat, slice, cutText,
    Token, TokenFormat
} from '../src/formatted-string';
import { TokenText, TokenType } from '../src/formatted-string/types';
import parse, { ParserOptions } from '../src/parser';

type StringFormat = [TokenFormat, string];

const formats: StringFormat[] = [
    [TokenFormat.Bold, 'b'],
    [TokenFormat.Italic, 'i'],
    [TokenFormat.Underline, 'u'],
    [TokenFormat.Strike, 's'],
    [TokenFormat.Monospace, 'm'],
];

const opt: ParserOptions = {
    command: true,
    hashtag: true,
    link: true,
    mention: true,
    textEmoji: true,
    userSticker: true,
    // NB строго `false`, так как редактирование MD-строки строго через
    // парсинг всего текста
    markdown: false,
};

/** Возвращает строковое представление формата */
function getFormat(format: TokenFormat): string {
    return formats.reduce((acc, f) => {
        if (format & f[0]) {
            acc += f[1];
        }

        return acc;
    }, '');
}

/**
 * Строковое представление токенов
 */
function repr(tokens: Token[]): string {
    return tokens.map(t => {
        const format = getFormat(t.format);
        return format ? `<${format}>${t.value}</${format}>` : t.value;
    }).join('');
}

function text(tokens: Token[]): string {
    return tokens.map(t => t.value).join('');
}

describe('Formatted String', () => {
    it('insert text', () => {
        const tokens = [
            token('hello', TokenFormat.Italic),
            token(' '),
            token('world', TokenFormat.Bold)
        ];

        const t1 = insertText(tokens, 0, 'aaa', opt);
        equal(text(t1), 'aaahello world');
        equal(t1.length, 3);
        equal(repr(t1), '<i>aaahello</i> <b>world</b>');

        const t2 = insertText(t1, 8, 'bbb', opt);
        equal(text(t2), 'aaahellobbb world');
        equal(t2.length, 3);
        equal(repr(t2), '<i>aaahellobbb</i> <b>world</b>');

        const t3 = insertText(t2, 12, 'ccc', opt);
        equal(text(t3), 'aaahellobbb cccworld');
        equal(t3.length, 3);
        equal(repr(t3), '<i>aaahellobbb</i> ccc<b>world</b>');

        const t4 = insertText(t3, 20, 'ddd', opt);
        equal(text(t4), 'aaahellobbb cccworldddd');
        equal(t4.length, 3);
        equal(repr(t4), '<i>aaahellobbb</i> ccc<b>worldddd</b>');
    });

    it('insert text into empty string', () => {
        const t1 = insertText([], 0, 'hello world', opt);
        equal(text(t1), 'hello world');
        equal(t1.length, 1);
        equal(repr(t1), 'hello world');
    });

    it('remove text', () => {
        const tokens = [
            token('aaa', TokenFormat.Italic),
            token(' '),
            token('bbb', TokenFormat.Bold),
            token(' ccc '),
            token('ddd', TokenFormat.Underline),
        ];

        const t1 = removeText(tokens, 0, 4, opt);
        equal(text(t1), 'bbb ccc ddd');
        equal(t1.length, 3);
        equal(repr(t1), '<b>bbb</b> ccc <u>ddd</u>');

        const t2 = removeText(t1, 1, 2, opt);
        equal(text(t2), 'b ccc ddd');
        equal(t2.length, 3);
        equal(repr(t2), '<b>b</b> ccc <u>ddd</u>');

        const t3 = removeText(t2, 4, 3, opt);
        equal(t3.length, 3);
        equal(repr(t3), '<b>b</b> cc<u>dd</u>');

        const t4 = removeText(tokens, 2, 13, opt);
        equal(t4.length, 1);
        equal(repr(t4), '<i>aa</i>');
    });

    it('change format', () => {
        const tokens = [token('aa bb cc dd')];
        equal(text(tokens), 'aa bb cc dd');

        const t1 = setFormat(tokens, { add: TokenFormat.Bold }, 3, 5);
        equal(t1.length, 3);
        equal(repr(t1), 'aa <b>bb cc</b> dd');

        const t2 = setFormat(t1, { add: TokenFormat.Italic }, 0, 5);
        equal(t2.length, 4);
        equal(repr(t2), '<i>aa </i><bi>bb</bi><b> cc</b> dd');

        const t3 = setFormat(t2, { remove: TokenFormat.Italic }, 0, 9);
        equal(t3.length, 3);
        equal(repr(t3), 'aa <b>bb cc</b> dd');

        const t4 = setFormat(t3, { remove: TokenFormat.Bold }, 0, 9);
        equal(t4.length, 1);
        equal(repr(t4), 'aa bb cc dd');
    });

    it('update text with sticky mark', () => {
        const tokens = [token('aa bb cc dd')];

        // Insert sticky mark inside plain text
        const t1 = setFormat(tokens, { add: TokenFormat.Bold }, 3);

        equal(text(t1), 'aa bb cc dd');
        equal(t1.length, 3);
        equal((t1[1] as TokenText).sticky, true);

        const t2 = insertText(t1, 3, '123', opt);
        equal(repr(t2), 'aa <b>123</b>bb cc dd');
        equal((t2[1] as TokenText).sticky, false);

        const t3 = removeText(t2, 3, 3, opt);
        equal(repr(t3), 'aa bb cc dd');
        equal(t3.length, 1);

        // Insert sticky mark before another format
        const t4 = setFormat(tokens, { add: TokenFormat.Bold }, 3, 2);
        equal(repr(t4), 'aa <b>bb</b> cc dd');

        const t5 = setFormat(t4, { add: TokenFormat.Italic }, 3);
        const t6 = insertText(t5, 3, '123', opt);
        equal(repr(t6), 'aa <i>123</i><b>bb</b> cc dd');

        const t7 = removeText(t6, 3, 3, opt);
        equal(repr(t7), 'aa <b>bb</b> cc dd');
        equal(t7.length, 3);

        // Insert sticky mark inside existing format
        const t8 = setFormat(tokens, { add: TokenFormat.Italic }, 0, 5);
        equal(repr(t8), '<i>aa bb</i> cc dd');

        const t9 = insertText(setFormat(t8, { add: TokenFormat.Bold }, 3), 3, '123', opt);
        equal(repr(t9), '<i>aa </i><bi>123</bi><i>bb</i> cc dd');
    });

    it('slice tokens', () => {
        const tokens = [
            token('12'),
            token('34', TokenFormat.Bold),
            token('56', TokenFormat.Italic),
            token('78')
        ];

        const t1 = slice(tokens, 0, 2);
        equal(repr(t1), '12');

        const t2 = slice(tokens, 2, -2);
        equal(repr(t2), '<b>34</b><i>56</i>');

        const t3 = slice(tokens, 3, 5);
        equal(repr(t3), '<b>4</b><i>5</i>');

        const t4 = slice(tokens, -3);
        equal(repr(t4), '<i>6</i>78');

        deepEqual(slice(tokens, 0, 0), []);
        deepEqual(slice(tokens, 1, 1), []);
        deepEqual(slice(tokens, 8, 8), []);
        deepEqual(slice([], 0, 0), []);
    });

    it('cut text', () => {
        const tokens = [
            token('12'),
            token('34', TokenFormat.Bold),
            token('56', TokenFormat.Italic),
            token('78')
        ];

        let result = cutText(tokens, 3, 5, opt);
        equal(repr(result.cut), '<b>4</b><i>5</i>');
        equal(repr(result.tokens), '12<b>3</b><i>6</i>78');

        result = cutText(tokens, 2, 6, opt);
        equal(repr(result.cut), '<b>34</b><i>56</i>');
        equal(repr(result.tokens), '1278');
    });

    it('handle emoji in string', () => {
        const emojiText = (token: TokenText) => token.emoji.map(e => token.value.substring(e.from, e.to));

        const tokens = parse('aaa 😍 bbb 😘😇 ccc 🤷🏼‍♂️ ddd');
        let text = tokens[0] as TokenText;
        equal(tokens.length, 1);
        equal(text.type, TokenType.Text);
        deepEqual(text.emoji, [
            { from: 4, to: 6 },
            { from: 11, to: 13 },
            { from: 13, to: 15 },
            { from: 20, to: 27 }
        ]);
        deepEqual(emojiText(text), ['😍', '😘', '😇', '🤷🏼‍♂️']);

        // Добавляем текст
        const tokens2 = insertText(tokens, 13, 'foo 😈 bar', opt);
        text = tokens2[0] as TokenText;
        equal(tokens2.length, 1);
        equal(text.value, 'aaa 😍 bbb 😘foo 😈 bar😇 ccc 🤷🏼‍♂️ ddd');
        deepEqual(emojiText(text), ['😍', '😘', '😈', '😇', '🤷🏼‍♂️']);

        // Удаляем текст
        const tokens3 = removeText(tokens2, 2, 14, opt);
        text = tokens3[0] as TokenText;
        equal(tokens3.length, 1);
        equal(text.value, 'aa 😈 bar😇 ccc 🤷🏼‍♂️ ddd');
        deepEqual(emojiText(text), ['😈', '😇', '🤷🏼‍♂️']);

        // Удаляем текст с позицией внутри эмоджи
        const tokens3_1 = removeText(tokens2, 5, 7, opt);
        text = tokens3_1[0] as TokenText;
        equal(tokens3_1.length, 1);
        equal(text.value, 'aaa 😍foo 😈 bar😇 ccc 🤷🏼‍♂️ ddd');
        deepEqual(emojiText(text), ['😍', '😈', '😇', '🤷🏼‍♂️']);

        // Получаем фрагмент
        // NB: правая граница попадает на середину эмоджи
        const tokens4 = slice(tokens3_1, 0, 11);
        text = tokens4[0] as TokenText;
        equal(tokens4.length, 1);
        equal(text.value, 'aaa 😍foo 😈');
        deepEqual(emojiText(text), ['😍', '😈']);

        // Вырезаем фрагмент
        // NB: левая граница попадает на середину эмоджи
        const tokens5 = cutText(tokens3_1, 5, 12, opt);
        text = tokens5.cut[0] as TokenText;
        equal(tokens5.cut.length, 1);
        equal(tokens5.tokens.length, 1);

        equal(text.value, 'foo 😈');
        deepEqual(emojiText(text), ['😈']);

        equal(tokens5.tokens[0].value, 'aaa 😍 bar😇 ccc 🤷🏼‍♂️ ddd');
        deepEqual(emojiText(tokens5.tokens[0] as TokenText), ['😍', '😇', '🤷🏼‍♂️']);
    });
});
