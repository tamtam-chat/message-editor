import { strictEqual as equal, deepStrictEqual as deepEqual } from 'assert';
import {
    createToken as token, insertText, removeText, setFormat, slice, cutText,
    Token, TokenFormat
} from '../src/formatted-string';
import { TokenText } from '../src/formatted-string/types';

type StringFormat = [TokenFormat, string];

const formats: StringFormat[] = [
    [TokenFormat.BOLD, 'b'],
    [TokenFormat.ITALIC, 'i'],
    [TokenFormat.UNDERLINE, 'u'],
    [TokenFormat.STRIKE, 's'],
    [TokenFormat.MONOSPACE, 'm'],
];

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

describe.skip('Formatted String', () => {
    it('should insert text', () => {
        const tokens = [
            token('hello', TokenFormat.ITALIC),
            token(' '),
            token('world', TokenFormat.BOLD)
        ];

        const t1 = insertText(tokens, 0, 'aaa');
        equal(text(t1), 'aaahello world');
        equal(t1.length, 3);
        equal(repr(t1), '<i>aaahello</i> <b>world</b>');

        const t2 = insertText(t1, 8, 'bbb');
        equal(text(t2), 'aaahellobbb world');
        equal(t2.length, 3);
        equal(repr(t2), '<i>aaahellobbb</i> <b>world</b>');

        const t3 = insertText(t2, 12, 'ccc');
        equal(text(t3), 'aaahellobbb cccworld');
        equal(t3.length, 3);
        equal(repr(t3), '<i>aaahellobbb</i> ccc<b>world</b>');

        const t4 = insertText(t3, 20, 'ddd');
        equal(text(t4), 'aaahellobbb cccworldddd');
        equal(t4.length, 3);
        equal(repr(t4), '<i>aaahellobbb</i> ccc<b>worldddd</b>');
    });

    it('should insert text into empty string', () => {
        const t1 = insertText([], 0, 'hello world');
        equal(text(t1), 'hello world');
        equal(t1.length, 1);
        equal(repr(t1), 'hello world');
    });

    it('should insert formatted text', () => {
        const tokens = [
            token('aa', TokenFormat.ITALIC),
            token('bb'),
            token('cc', TokenFormat.BOLD)
        ];

        const t1 = insertText(tokens, 3, [
            token('11', TokenFormat.UNDERLINE)
        ]);
        equal(repr(t1), '<i>aa</i>b<u>11</u>b<b>cc</b>');

        const t2 = insertText(tokens, 1, [
            token('11', TokenFormat.UNDERLINE)
        ]);
        equal(repr(t2), '<i>a</i><iu>11</iu><i>a</i>bb<b>cc</b>');

        const t3 = insertText(tokens, 6, [
            token('11', TokenFormat.BOLD)
        ]);
        equal(repr(t3), '<i>aa</i>bb<b>cc11</b>');
    });

    it('should remove text', () => {
        const tokens = [
            token('aaa', TokenFormat.ITALIC),
            token(' '),
            token('bbb', TokenFormat.BOLD),
            token(' ccc '),
            token('ddd', TokenFormat.UNDERLINE),
        ];

        const t1 = removeText(tokens, 0, 4);
        equal(text(t1), 'bbb ccc ddd');
        equal(t1.length, 3);
        equal(repr(t1), '<b>bbb</b> ccc <u>ddd</u>');

        const t2 = removeText(t1, 1, 2);
        equal(text(t2), 'b ccc ddd');
        equal(t2.length, 3);
        equal(repr(t2), '<b>b</b> ccc <u>ddd</u>');

        const t3 = removeText(t2, 4, 3);
        equal(t3.length, 3);
        equal(repr(t3), '<b>b</b> cc<u>dd</u>');

        const t4 = removeText(tokens, 2, 13);
        equal(t4.length, 1);
        equal(repr(t4), '<i>aa</i>');
    });

    it('should change format', () => {
        const tokens = [token('aa bb cc dd')];
        equal(text(tokens), 'aa bb cc dd');

        const t1 = setFormat(tokens, { add: TokenFormat.BOLD }, 3, 5);
        equal(t1.length, 3);
        equal(repr(t1), 'aa <b>bb cc</b> dd');

        const t2 = setFormat(t1, { add: TokenFormat.ITALIC }, 0, 5);
        equal(t2.length, 4);
        equal(repr(t2), '<i>aa </i><bi>bb</bi><b> cc</b> dd');

        const t3 = setFormat(t2, { remove: TokenFormat.ITALIC }, 0, 9);
        equal(t3.length, 3);
        equal(repr(t3), 'aa <b>bb cc</b> dd');

        const t4 = setFormat(t3, { remove: TokenFormat.BOLD }, 0, 9);
        equal(t4.length, 1);
        equal(repr(t4), 'aa bb cc dd');
    });

    it('should update text with sticky mark', () => {
        const tokens = [token('aa bb cc dd')];

        // Insert sticky mark inside plain text
        const t1 = setFormat(tokens, { add: TokenFormat.BOLD }, 3);
        equal(text(t1), 'aa bb cc dd');
        equal(t1.length, 3);
        equal((t1[1] as TokenText).sticky, true);

        const t2 = insertText(t1, 3, '123');
        equal(repr(t2), 'aa <b>123</b>bb cc dd');
        equal((t2[1] as TokenText).sticky, false);

        const t3 = removeText(t2, 3, 3);
        equal(repr(t3), 'aa bb cc dd');
        equal(t3.length, 1);

        // Insert sticky mark before another format
        const t4 = setFormat(tokens, { add: TokenFormat.BOLD }, 3, 2);
        equal(repr(t4), 'aa <b>bb</b> cc dd');

        const t5 = setFormat(t4, { add: TokenFormat.ITALIC }, 3);
        const t6 = insertText(t5, 3, '123');
        equal(repr(t6), 'aa <i>123</i><b>bb</b> cc dd');

        const t7 = removeText(t6, 3, 3);
        equal(repr(t7), 'aa <b>bb</b> cc dd');
        equal(t7.length, 3);

        // Insert sticky mark inside existing format
        const t8 = setFormat(tokens, { add: TokenFormat.ITALIC }, 0, 5);
        equal(repr(t8), '<i>aa bb</i> cc dd');

        const t9 = insertText(setFormat(t8, { add: TokenFormat.BOLD }, 3), 3, '123');
        equal(repr(t9), '<i>aa </i><bi>123</bi><i>bb</i> cc dd');
    });

    it('should slice tokens', () => {
        const tokens = [
            token('12'),
            token('34', TokenFormat.BOLD),
            token('56', TokenFormat.ITALIC),
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

    it('should cut text', () => {
        const tokens = [
            token('12'),
            token('34', TokenFormat.BOLD),
            token('56', TokenFormat.ITALIC),
            token('78')
        ];

        let result = cutText(tokens, 3, 5);
        equal(repr(result.cut), '<b>4</b><i>5</i>');
        equal(repr(result.tokens), '12<b>3</b><i>6</i>78');

        result = cutText(tokens, 2, 6);
        equal(repr(result.cut), '<b>34</b><i>56</i>');
        equal(repr(result.tokens), '1278');
    });
});
