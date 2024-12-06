import { describe, it } from 'node:test'
import { equal, deepEqual } from 'node:assert/strict';
import { insertText, removeText, setFormat, slice, cutText, setLink, replaceText } from '../src/formatted-string';
import { createToken as token } from '../src/formatted-string/utils';
import type { ParserOptions, Token, TokenHashTag, TokenLink, TokenText } from '../src/parser';
import parse, { TokenFormat, TokenType } from '../src/parser';

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
export function repr(tokens: Token[]): string {
    return tokens.map(t => {
        const format = getFormat(t.format);
        let out = format ? `<${format}>${t.value}</${format}>` : t.value;

        if (t.type === TokenType.Link) {
            out = `<a href="${t.link}">${out}</a>`;
        }

        return out;
    }).join('');
}

function text(tokens: Token[]): string {
    return tokens.map(t => t.value).join('');
}

function emojiText(token: Token): string[] | undefined {
    return token.emoji?.map(e => token.value.substring(e.from, e.to));
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
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

        // Убираем форматирование в точке и дописываем текст
        const t10 = setFormat(tokens, { add: TokenFormat.Bold }, 3, 5);
        equal(repr(t10), 'aa <b>bb cc</b> dd');

        const t10_1 = setFormat(t10, { remove: TokenFormat.Bold }, 6);
        equal(repr(t10_1), 'aa <b>bb </b><b>cc</b> dd');

        const t10_2 = insertText(t10_1, 6, 'f', opt);
        equal(repr(t10_2), 'aa <b>bb </b>f<b>cc</b> dd');
        const t10_3 = insertText(t10_2, 7, 'f', opt);
        equal(repr(t10_3), 'aa <b>bb </b>ff<b>cc</b> dd');

        // Добавляем sticky в конце фрагмента с форматированием
        const t11 = setFormat(tokens, { add: TokenFormat.Bold }, 3, 5);
        equal(repr(t11), 'aa <b>bb cc</b> dd');

        const t11_1 = setFormat(t11, { remove: TokenFormat.Bold }, 8);
        equal(repr(t11_1), 'aa <b>bb cc</b> dd');

        const t11_2 = insertText(t11_1, 8, 'f', opt);
        equal(repr(t11_2), 'aa <b>bb cc</b>f dd');
        const t11_3 = insertText(t11_2, 9, 'f', opt);
        equal(repr(t11_3), 'aa <b>bb cc</b>ff dd');
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

        const t5 = slice(parse('@aaa', { mention: true }), 0, 4);
        equal(t5[0].type, TokenType.Mention);
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
        equal(text.value, 'aaa foo 😈 bar😇 ccc 🤷🏼‍♂️ ddd');
        deepEqual(emojiText(text), ['😈', '😇', '🤷🏼‍♂️']);

        // Получаем фрагмент
        // NB: правая граница попадает на середину эмоджи
        const tokens4 = slice(tokens3_1, 0, 9);
        text = tokens4[0] as TokenText;
        equal(tokens4.length, 1);
        equal(text.value, 'aaa foo 😈');
        deepEqual(emojiText(text), ['😈']);

        // Вырезаем фрагмент
        // NB: правая граница попадает на середину эмоджи
        const tokens5 = cutText(tokens3_1, 4, 9, opt);
        text = tokens5.cut[0] as TokenText;
        equal(tokens5.cut.length, 1);
        equal(tokens5.tokens.length, 1);

        equal(text.value, 'foo 😈');
        deepEqual(emojiText(text), ['😈']);

        equal(tokens5.tokens[0].value, 'aaa  bar😇 ccc 🤷🏼‍♂️ ddd');
        deepEqual(emojiText(tokens5.tokens[0] as TokenText), ['😇', '🤷🏼‍♂️']);
    });

    it('edit edge cases', () => {
        let tokens = [
            token('foo '),
            token('bar', TokenFormat.Bold | TokenFormat.Italic),
            token(' ', TokenFormat.Bold),
            token(' baz',),
        ];

        // Удаляем текст на границе форматов
        const t1 = removeText(tokens, 8, 1, opt);
        equal(repr(t1), 'foo <bi>bar</bi><b> </b>baz');

        const t2 = removeText(t1, 7, 1, opt);
        equal(repr(t2), 'foo <bi>bar</bi>baz');

        // Меняем формат у неразрывного токена
        tokens = parse('foo @bar', opt);
        const t3 = setFormat(tokens, { add: TokenFormat.Bold }, 6);
        equal(repr(t3), 'foo <b>@bar</b>');

        // Дописываем текст к ссылке
        tokens = parse('test mail.ru', opt);
        const t4_1 = insertText(tokens, 12, '?', opt);
        deepEqual(types(t4_1), [TokenType.Text, TokenType.Link, TokenType.Text]);
        deepEqual(values(t4_1), ['test ', 'mail.ru', '?']);

        const t4_2 = insertText(t4_1, 13, 'a', opt);
        deepEqual(types(t4_2), [TokenType.Text, TokenType.Link]);
        deepEqual(values(t4_2), ['test ', 'mail.ru?a']);

        // Удаление текста после ссылки
        const t5_1 = setLink(parse('[asd ]', opt), 'ok.ru', 1, 3);
        deepEqual(types(t5_1), [TokenType.Text, TokenType.Link, TokenType.Text]);
        deepEqual(values(t5_1), ['[', 'asd', ' ]']);

        const t5_2 = removeText(t5_1, 4, 1, opt);
        deepEqual(types(t5_2), [TokenType.Text, TokenType.Link, TokenType.Text]);
        deepEqual(values(t5_2), ['[', 'asd', ']']);
    });

    it('set link', () => {
        let link: TokenLink;
        const url = 'https://tamtam.chat';
        const url2 = 'https://ok.ru';
        let tokens = setFormat(parse('regular bold mail.ru', opt), { add: TokenFormat.Bold }, 8, 4);

        const t1 = setLink(tokens, url, 0, 7);
        link = t1[0] as TokenLink;
        deepEqual(types(t1), [TokenType.Link, TokenType.Text, TokenType.Text, TokenType.Text, TokenType.Link]);
        deepEqual(values(t1), ['regular', ' ', 'bold', ' ', 'mail.ru']);
        equal(link.auto, false);
        equal(link.value, 'regular');
        equal(link.link, url);

        // Добавляем ссылку двум словам с разным форматом
        const t2 = setLink(tokens, url, 0, 12);
        deepEqual(types(t2), [TokenType.Link, TokenType.Link, TokenType.Text, TokenType.Link]);
        deepEqual(values(t2), ['regular ', 'bold', ' ', 'mail.ru']);
        link = t2[0] as TokenLink;
        equal(link.auto, false);
        equal(link.value, 'regular ');
        equal(link.format, TokenFormat.None);

        link = t2[1] as TokenLink;
        equal(link.auto, false);
        equal(link.value, 'bold');
        equal(link.format, TokenFormat.Bold);

        // Добавляем ссылку поверх другой ссылки
        const t3 = setLink(t2, url2, 3, 7);
        deepEqual(types(t3), [TokenType.Link, TokenType.Link, TokenType.Link, TokenType.Link, TokenType.Text, TokenType.Link]);
        deepEqual(values(t3), ['reg', 'ular ', 'bo', 'ld', ' ', 'mail.ru']);

        link = t3[0] as TokenLink;
        equal(link.value, 'reg');
        equal(link.link, url);
        equal(link.format, TokenFormat.None);

        link = t3[1] as TokenLink;
        equal(link.value, 'ular ');
        equal(link.link, url2);
        equal(link.format, TokenFormat.None);

        link = t3[2] as TokenLink;
        equal(link.value, 'bo');
        equal(link.link, url2);
        equal(link.format, TokenFormat.Bold);

        link = t3[3] as TokenLink;
        equal(link.value, 'ld');
        equal(link.link, url);
        equal(link.format, TokenFormat.Bold);

        // Удаление ссылки
        const t4 = setLink(t3, null, 0, 10);
        deepEqual(types(t4), [TokenType.Text, TokenType.Text, TokenType.Link, TokenType.Text, TokenType.Link]);
        deepEqual(values(t4), ['regular ', 'bo', 'ld', ' ', 'mail.ru']);

        // Ссылка поверх сплошного токена: удаляем его, заменяем на ссылку
        tokens = parse('text1 @user text2', opt);
        const t5 = setLink(tokens, url, 2, 12);
        deepEqual(types(t5), [TokenType.Text, TokenType.Link, TokenType.Text]);
        deepEqual(values(t5), ['te', 'xt1 @user te', 'xt2']);
    });

    it('edit link', () => {
        let tokens = setLink(parse('aa bb cc'), 'https://ok.ru', 3, 2);
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text]);
        deepEqual(values(tokens), ['aa ', 'bb', ' cc']);

        tokens = insertText(tokens, 5, 'd', opt);
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text]);
        deepEqual(values(tokens), ['aa ', 'bb', 'd cc']);

        tokens = insertText(tokens, 4, 'e', opt);
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text]);
        deepEqual(values(tokens), ['aa ', 'beb', 'd cc']);

        tokens = insertText(tokens, 3, 'f', opt);
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text]);
        deepEqual(values(tokens), ['aa f', 'beb', 'd cc']);

        // Целиком удаляем ссылку, выходя за её пределы справа
        const t1 = setLink(parse('foo bar'), '@foo', 0, 3);
        const t2 = removeText(t1, 0, 4, opt);
        deepEqual(types(t2), [TokenType.Text]);
        deepEqual(values(t2), ['bar']);
        // console.log(tokens);
    });

    it('insert text before link', () => {
        let tokens = parse('https://ok.ru', { link: true });
        deepEqual(types(tokens), [TokenType.Link]);
        deepEqual(values(tokens), ['https://ok.ru']);

        tokens = insertText(tokens, 0, 'a', { link: true });
        deepEqual(types(tokens), [TokenType.Text]);
        deepEqual(values(tokens), ['ahttps://ok.ru']);

        tokens = insertText(tokens, 1, ' ', { link: true });
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link]);
        deepEqual(values(tokens), ['a ', 'https://ok.ru']);
    });

    it('insert text before custom link', () => {
        let tokens = setLink(parse('foo'), 'ok.ru', 0, 3);
        deepEqual(types(tokens), [TokenType.Link]);
        deepEqual(values(tokens), ['foo']);

        tokens = insertText(tokens, 0, 'a', { link: true });
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link]);
        deepEqual(values(tokens), ['a', 'foo']);
    });

    it('insert text inside link at format bound', () => {
        let tokens = setLink(parse('foo bar baz'), 'ok.ru', 0, 11);
        tokens = setFormat(tokens, TokenFormat.Bold, 4, 3);

        tokens = insertText(tokens, 7, 'a', { link: true });
        deepEqual(types(tokens), [TokenType.Link, TokenType.Link, TokenType.Link]);
        deepEqual(values(tokens), ['foo ', 'bara', ' baz']);
    });

    describe('Solid tokens', () => {
        it('link', () => {
            const source = parse('http://ok.ru mail.ru ', { link: true });
            source.push({
                type: TokenType.Link,
                format: 0,
                sticky: false,
                link: 'https://tamtam.chat',
                auto: false,
                value: 'Чат'
            });
            let link = source[2] as TokenLink;

            equal(link.type, TokenType.Link);
            equal(link.link, 'http://mail.ru');
            equal(link.value, 'mail.ru');

            // Модификация текста авто-ссылки: должны обновить и ссылку
            const t1 = insertText(source, 17, '123', opt);
            link = t1[2] as TokenLink;
            equal(t1.length, 5);
            equal(link.type, TokenType.Link);
            equal(link.link, 'http://mail123.ru');
            equal(link.value, 'mail123.ru');

            // Модификация текста ссылки пользовательской ссылки: должны оставить ссылку
            const t2 = insertText(source, 23, '123😈', opt);
            link = t2[4] as TokenLink;
            equal(t2.length, 5);
            equal(link.type, TokenType.Link);
            equal(link.link, 'https://tamtam.chat');
            equal(link.value, 'Ча123😈т');
            deepEqual(emojiText(link), ['😈']);

            // Удаляем символ, из-за чего ссылка становится невалидной
            const t3 = removeText(source, 17, 1, opt);
            const text = t3[1] as TokenText;
            equal(t3.length, 3);
            equal(text.type, TokenType.Text);
            equal(text.value, ' mailru ');

            // Удаляем содержимое кастомной ссылки: должны удалить сам токен
            const t4 = removeText(source, 21, 3, opt);
            deepEqual(types(t4), [TokenType.Link, TokenType.Text, TokenType.Link, TokenType.Text]);
            deepEqual(values(t4), ['http://ok.ru', ' ', 'mail.ru', ' ']);

            // Удаляем пересечение токенов
            const t5 = removeText(source, 7, 9, opt);
            link = t5[0] as TokenLink;
            equal(link.link, 'http://l.ru');
            equal(link.value, 'http://l.ru');
            deepEqual(types(t5), [TokenType.Link, TokenType.Text, TokenType.Link]);
            deepEqual(values(t5), ['http://l.ru', ' ', 'Чат']);

            // Меняем формат у части строгой ссылки: меняем формат у всей ссылки
            const t6 = setFormat(source, { add: TokenFormat.Bold }, 7, 2);
            link = t6[0] as TokenLink;
            equal(link.link, 'http://ok.ru');
            equal(link.value, 'http://ok.ru');
            equal(link.format, TokenFormat.Bold);
            deepEqual(types(t6), [TokenType.Link, TokenType.Text, TokenType.Link, TokenType.Text, TokenType.Link]);
            deepEqual(values(t6), ['http://ok.ru', ' ', 'mail.ru', ' ', 'Чат']);
        });

        it('hashtag', () => {
            const source = parse('#foo #bar #baz', opt);
            let hashtag = source[0] as TokenHashTag;
            equal(hashtag.type, TokenType.HashTag);
            equal(hashtag.hashtag, 'foo');
            equal(hashtag.value, '#foo');

            const t1 = insertText(source, 4, '123', opt);
            hashtag = t1[0] as TokenHashTag;
            equal(hashtag.type, TokenType.HashTag);
            equal(hashtag.hashtag, 'foo123');
            equal(hashtag.value, '#foo123');
            deepEqual(types(t1), [TokenType.HashTag, TokenType.Text, TokenType.HashTag, TokenType.Text, TokenType.HashTag]);
            deepEqual(values(t1), ['#foo123', ' ', '#bar', ' ', '#baz']);

            // Удаляем символ, из-за чего хэштэг становится невалидным
            const t2 = removeText(source, 5, 1, opt);
            deepEqual(types(t2), [TokenType.HashTag, TokenType.Text, TokenType.HashTag]);
            deepEqual(values(t2), ['#foo', ' bar ', '#baz']);

            // Удаляем диапазон, два хэштэга сливаются в один
            const t3 = removeText(source, 3, 3, opt);
            deepEqual(types(t3), [TokenType.HashTag, TokenType.Text, TokenType.HashTag]);
            deepEqual(values(t3), ['#fobar', ' ', '#baz']);

            // Меняем форматирование у диапазона: так как хэштэг — это сплошной
            // токен
            const t4 = setFormat(source, { add: TokenFormat.Bold }, 3, 3);
            deepEqual(types(t4), [TokenType.HashTag, TokenType.Text, TokenType.HashTag, TokenType.Text, TokenType.HashTag]);
            deepEqual(values(t4), ['#foo', ' ', '#bar', ' ', '#baz']);
            deepEqual(t4.map(t => t.format), [TokenFormat.Bold, TokenFormat.Bold, TokenFormat.Bold, TokenFormat.None, TokenFormat.None]);
        });

        it('sticky links', () => {
            // Поддержка sticky-ссылок: при замене текста ссылки разрешаем дописать туда текст
            const opt2: Partial<ParserOptions> = {
                stickyLink: true
            };

            let tokens = parse('a b c', opt2);
            tokens = setLink(parse('a b c', opt2), '@foo', 2, 1);

            let link = tokens[1] as TokenLink;
            equal(link.type, TokenType.Link);
            equal(link.value, 'b');
            equal(link.sticky, false);

            // sticky-ссылки включаются при полной замене текста
            tokens = replaceText(tokens, 2, 1, 'dd', opt2);
            link = tokens[1] as TokenLink;
            equal(link.type, TokenType.Link);
            equal(link.value, 'dd');
            equal(link.sticky, true);

            // Дописываем текст
            tokens = insertText(tokens, 4, '1', opt2);
            tokens = insertText(tokens, 5, '2', opt2);
            link = tokens[1] as TokenLink;
            equal(link.type, TokenType.Link);
            equal(link.value, 'dd12');
            equal(link.sticky, true);

            // Завершаем sticky-форматирование символом-разделителем
            tokens = insertText(tokens, 6, '.', opt2);
            link = tokens[1] as TokenLink;
            equal(link.type, TokenType.Link);
            equal(link.value, 'dd12');
            equal(link.sticky, false);

            deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text]);
            deepEqual(values(tokens), ['a ', 'dd12', '. c']);
        });
    });
});
