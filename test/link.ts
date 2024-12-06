import { describe, it } from 'node:test'
import { equal, deepEqual } from 'node:assert/strict';
import _parse, { type ParserOptions, TokenType } from '../src/parser';
import type { Token, TokenLink } from '../src/parser';

function parse(text: string, opt?: Partial<ParserOptions>) {
    return _parse(text, { link: true, ...opt });
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

/**
 * Стандартная функция для проверки ссылок в различных окружениях
 */
function testLink(link: string, isEmail = false) {
    let tokens = parse(link);
    const validate = (ix: number) => {
        const linkToken = tokens[ix] as TokenLink;
        if (isEmail) {
            equal(linkToken.link, `mailto:${link}`);
        } else {
            let linkValue = link;
            if (/^\/\//.test(linkValue)) {
                linkValue = `http:${linkValue}`;
            } else if (!/^[a-z0-9+-]+:/i.test(linkValue)) {
                linkValue = `http://${linkValue}`;
            }

            equal(linkToken.link, linkValue);
        }
    };

    deepEqual(types(tokens), [TokenType.Link], `Types: "${link}" only`);
    deepEqual(values(tokens), [link], `Values: "${link}" only`);
    validate(0);

    tokens = parse(`foo ${link} bar`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" in text`);
    deepEqual(values(tokens), ['foo ', link, ' bar'], `Values: "${link}" in text`);
    validate(1);

    // Граница слов
    tokens = parse(`;${link}`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link], `Types: "${link}" after word bound`);
    deepEqual(values(tokens), [';', link], `Values: "${link}" after word bound`);
    validate(1);

    // Перед эмоджи
    // NB: Проверка больше не валидна, так как в жизни эмоджи также могут быть частью ссылки
    // tokens = parse(`${link}😍`);
    // deepEqual(types(tokens), [TokenType.Link, TokenType.Text], `Types: "${link}" before emoji`);
    // deepEqual(values(tokens), [link, '😍'], `Values: "${link}" before emoji`);
    // validate(0);

    // За эмоджи
    tokens = parse(`👌🏻${link}`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link], `Types: "${link}" after emoji`);
    deepEqual(values(tokens), ['👌🏻', link], `Values: "${link}" after emoji`);
    validate(1);

    // Перед keycap-эмоджи
    // NB: Проверка больше не валидна, так как в жизни эмоджи также могут быть частью ссылки
    // tokens = parse(`${link}2️⃣`);
    // deepEqual(types(tokens), [TokenType.Link, TokenType.Text], `Types: "${link}" before keycap emoji`);
    // deepEqual(values(tokens), [link, '2️⃣'], `Values: "${link}" before keycap emoji`);
    // validate(0);

    // Адрес в скобках
    tokens = parse(`(${link})`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" in braces`);
    deepEqual(values(tokens), ['(', link, ')'], `Values: "${link}" in braces`);
    validate(1);

    // Внутри русского текста
    tokens = parse(`заходите к нам на сайт ${link} и наслаждайтесь`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" in Russian text`);
    deepEqual(values(tokens), ['заходите к нам на сайт ', link, ' и наслаждайтесь'], `Values: "${link}" in Russian text`);
    validate(1);

    // Внутри HTML (кавычки)
    tokens = parse(`<img src="${link}">`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" in HTML`);
    deepEqual(values(tokens), ['<img src="', link, '">'], `Values: "${link}" in HTML`);
    validate(1);

    tokens = parse(`'${link}'`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: '${link}' in text`);
    deepEqual(values(tokens), ['\'', link, '\''], `Values: '${link}' in text`);
    validate(1);

    // Знак вопроса в конце предложения
    tokens = parse(`Have you seen ${link}?`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" before questions sign at the end of sentence`);
    deepEqual(values(tokens), ['Have you seen ', link, '?'], `Values: "${link}" before questions sign at the end of sentence`);
    validate(1);

    // Знак вопроса в конце предложения + перевод строки
    tokens = parse(`Have you seen ${link}?\ntest`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text, TokenType.Newline, TokenType.Text], `Types: "${link}" before questions sign at the end of sentence with newline`);
    deepEqual(values(tokens), ['Have you seen ', link, '?', '\n', 'test'], `Values: "${link}" before questions sign at the end of sentence with newline`);
    validate(1);

    // Точка в конце предложения
    tokens = parse(`Go to ${link}.`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" before period at the end of sentence`);
    deepEqual(values(tokens), ['Go to ', link, '.'], `Values: "${link}" before period at the end of sentence`);
    validate(1);

    // Внутри скобок и текста
    tokens = parse(`Был на сайте (${link}), не понравилось.`);
    deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text], `Types: "${link}" in brackets in sentence`);
    deepEqual(values(tokens), ['Был на сайте (', link, '), не понравилось.'], `Values: "${link}" in brackets in sentence`);
    validate(1);

    // Перед переводом строки
    tokens = parse(`${link}\ntest`);
    deepEqual(types(tokens), [TokenType.Link, TokenType.Newline, TokenType.Text], `Types: "${link}" before newline`);
    deepEqual(values(tokens), [link, '\n', 'test'], `Values: "${link}" before newline`);
    validate(0);
}

describe('Link', () => {
    it('valid email', () => {
        const emails = [
            'serge.che@gmail.com',
            'some.user@corp.mail.ru',
            'some.user@corp.mail.ru?m=true',

            // https://en.wikipedia.org/wiki/Email_address / Examples / Valid email addresses
            'simple@example.com',
            'very.common@example.com',
            'disposable.style.email.with+symbol@example.com',
            'other.email-with-hyphen@example.com',
            'fully-qualified-domain@example.com',
            'user.name+tag+sorting@example.com',
            'x@example.com',
            'example-indeed@strange-example.com',
            // 'admin@mailserver1'
            // 'example@s.example',
            // '" "@example.org',
            // '"john..doe"@example.org',
            'mailhost!username@example.org',
            'user%example.com@example.org',
            'user-@example.org'
        ];

        // console.log(parse('Have you seen serge.che@gmail.com?'));
        for (const email of emails) {
            testLink(email, true);
        }
    });

    it('invalid email', () => {
        // https://en.wikipedia.org/wiki/Email_address / Examples / Invalid email addresses
        let tokens = parse('Abc.example.com');
        const link = (ix: number) => tokens[ix] as TokenLink;

        // Не e-mail
        deepEqual(types(tokens), [TokenType.Link]);
        equal(link(0).link, 'http://Abc.example.com');

        tokens = parse('A@b@c@example.com');
        deepEqual(types(tokens), [TokenType.Text]);

        tokens = parse('a"b(c)d,e:f;g<h>i[j\\k]l@example.com');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link]);
        deepEqual(values(tokens), ['a"b(c)d,e:f;g<h>i[j\\k]', 'l@example.com']);

        tokens = parse('just"not"right@example.com');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link]);
        deepEqual(values(tokens), ['just"not"', 'right@example.com']);

        // Слишком длинная локальная часть
        tokens = parse('1234567890123456789012345678901234567890123456789012345678901234+x@example.com');
        deepEqual(types(tokens), [TokenType.Text]);

        // Подчёркивания -нельзя-/пока можно
        // tokens = parse('i_like_underscore@but_its_not_allowed_in_this_part.example.com');
        // deepEqual(types(tokens), [TokenType.Text]);
    });

    it('valid url', () => {
        const urls = [
            'http://vk.co.uk',
            'https://jira.odkl.ru/browse/DWH-10584',
            'https://incrussia.ru/news/fake-zoom/',
            'group_calls2.messenger.okdev.mail.msk',
            'https://zen.yandex.ru/media/id/5ce506fd81f64200b4db5a94/navalnyi-snial-s-bitkoinkoshelka-dlia-pojertvovanii-bolee-800-tys-rublei-na-semeinyi-otdyh-v-tailande-5e1d4fc4dddaf400b1f70a9e',
            'http://s9500ebtc04.sk.roskazna.local/viewLog.html?buildTypeId=id12skiao_LibCades&buildId=130',
            'https://tc.odkl.ru/viewType.html?buildTypeId=NewWeb_MainSh_Messenger&branch_NewWeb_MainSh=%3Cdefault%3E',
            '//tc.odkl.ru',
            'ftp://tc.odkl.ru:80',
            'skype://raquelmota1977?chat',
            'magnet:?xt=urn:btih5dee65101db281ac9c46344cd6b175cdcad53426&dn=name',
            'дом.рф',
            'www.google.com',
            'www.google.com:8000',
            'www.google.com/?key=value',
            'github.io',
            'https://127.0.0.1:8000/somethinghere',
            'http://dummyimage.com/50',
            'FTP://GOOGLE.COM',
            'WWW.ДОМ.РФ',
            'youtube.com/watch?v=pS-gbqbVd8c',
            'en.c.org/a_(b)',
            'https://ka.wikipedia.org/wiki/მთავარი_გვერდი',
            'http://username:password@example.com',
            'github.com/minimaxir/big-list-of-naughty-strings/blob/master/blns.txt',
            'http://a/%%30%30',
            'http://ok.ru/#myanchor',
            '中国.中国',
            'xn--90adear.xn--p1ai',
            'https://vk.com/@superappkit-web-sdk',
            'https://ok.ru/#/foo/bar',
            'https://ok.ru/?a:b=c|d',
            'https://ok.ru/foo/bar..5',
        ];

        // console.log(parse('Have you seen group_calls2.messenger.okdev.mail.msk?'));
        // console.log(parse('xn--90adear.xn--p1ai'));
        for (const url of urls) {
            testLink(url, false);
        }

        // Отдельно парсим хитрую ссылку с кавычками, так как проверка на ординарные
        // кавычки всё поломает
        let tokens = parse('foo https://www.tutorialspoint.com/how-to-use-xpath-in-selenium-webdriver-to-grab-svg-elements#:~:text=To%20create%20a%20xpath%20for,name()%3D\'svg\'%5D.&text=Here%2C%20data%2Dicon%20is%20an,child%20of%20the%20svg%20tagname bar');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text]);
        deepEqual(values(tokens), ['foo ', 'https://www.tutorialspoint.com/how-to-use-xpath-in-selenium-webdriver-to-grab-svg-elements#:~:text=To%20create%20a%20xpath%20for,name()%3D\'svg\'%5D.&text=Here%2C%20data%2Dicon%20is%20an,child%20of%20the%20svg%20tagname', ' bar']);

        tokens = parse('https://www.example.com/file/6lhB89Sk5K6IQ/✅sample?a=1%3A638')
        deepEqual(types(tokens), [TokenType.Link]);
        deepEqual(values(tokens), ['https://www.example.com/file/6lhB89Sk5K6IQ/✅sample?a=1%3A638']);
    });

    it('invalid url', () => {
        let tokens = parse('/var/tmp/foo_bar.cf');
        deepEqual(types(tokens), [TokenType.Text]);
        deepEqual(values(tokens), ['/var/tmp/foo_bar.cf']);

        tokens = parse('/ok.ru');
        deepEqual(types(tokens), [TokenType.Text]);
        deepEqual(values(tokens), ['/ok.ru']);
    });

    it('custom protocols', () => {
        const tokens = parse('ok.ru http://ok.ru ftp://ok.ru', {
            linkProtocols: ['http://']
        });

        deepEqual(types(tokens), [TokenType.Link, TokenType.Text, TokenType.Link, TokenType.Text]);
        deepEqual(values(tokens), ['ok.ru', ' ', 'http://ok.ru', ' ftp://ok.ru']);
    });
});
