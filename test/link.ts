import { strictEqual as equal, deepStrictEqual as deepEqual } from 'assert';
import _parse from '../src/parser';
import { Token, TokenType } from '../src/formatted-string/types';

function parse(text: string) {
    return _parse(text, { link: true });
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

/**
 * Стандартная функция для проверки ссылок в различных окуржениях
 */
function testLink(link: string) {
    let tokens = parse(link);
    deepEqual(types(tokens), [TokenType.Link], `Types: "${link}" only`);
    deepEqual(values(tokens), [link], `Values: "${link}" only`);

    tokens = parse(`foo ${link} bar`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" in text`);
    deepEqual(values(tokens), ['foo ', link, ' bar'], `Values: "${link}" in text`);

    // Граница слов
    tokens = parse(`.${link}`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link], `Types: "${link}" after word bound`);
    deepEqual(values(tokens), ['.', link], `Values: "${link}" after word bound`);

    // Сразу за эмоджи
    tokens = parse(`${link}😍`);
    deepEqual(types(tokens), [TokenType.Link, TokenType.Emoji], `Types: "${link}" before emoji`);
    deepEqual(values(tokens), [link, '😍'], `Values: "${link}" before emoji`);

    // Перед эмоджи
    tokens = parse(`👌🏻${link}`);
    deepEqual(types(tokens), [TokenType.Emoji, TokenType.Link], `Types: "${link}" after emoji`);
    deepEqual(values(tokens), ['👌🏻', link], `Values: "${link}" after emoji`);

    // Перед keycap-эмоджи
    tokens = parse(`${link}2️⃣`);
    deepEqual(types(tokens), [TokenType.Link, TokenType.Emoji], `Types: "${link}" before keycap emoji`);
    deepEqual(values(tokens), [link, '2️⃣'], `Values: "${link}" before keycap emoji`);

    // Адрес в скобках
    tokens = parse(`(${link})`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" in braces`);
    deepEqual(values(tokens), ['(', link, ')'], `Values: "${link}" in braces`);

    // Внутри русского текста
    tokens = parse(`заходите к нам на сайт ${link} и наслаждайтесь`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" in Russian text`);
    deepEqual(values(tokens), ['заходите к нам на сайт ', link, ' и наслаждайтесь'], `Values: "${link}" in Russian text`);

    // Внутри HTML (кавычки)
    tokens = parse(`<img src="${link}">`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" in HTML`);
    deepEqual(values(tokens), ['<img src="', link, '">'], `Values: "${link}" in HTML`);

    // Знак вопроса в конце предложения
    tokens = parse(`Have you seen ${link}?`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" before questions sign at the end of sentence`);
    deepEqual(values(tokens), ['Have you seen ', link, '?'], `Values: "${link}" before questions sign at the end of sentence`);
}

describe('Link', () => {
    it.only('valid email', () => {
        const emails = [
            'serge.che@gmail.com',
            'some.user@corp.mail.ru',
            'some.user@corp.mail.ru?m=true',
        ];
        // console.log(parse('Have you seen serge.che@gmail.com?'));
        for (const email of emails) {
            testLink(email);
        }
    });
});
