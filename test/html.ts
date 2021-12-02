import { strictEqual as equal } from 'assert';
import { repr } from './formatted-string';
import html from '../src/parser/html';
import toHTML from '../src/render/html';

const parse = (text: string) => repr(html(text));
const convert = (text: string) => toHTML(html(text));

describe('HTML Parser', () => {
    it('format from tags', () => {
        equal(parse('hello world!'), 'hello world!');
        equal(parse('hello <strong>world</strong>!'), 'hello <b>world</b>!');
        equal(parse('<b>foo bar baz</b>'), '<b>foo bar baz</b>');
        equal(parse('<b><em>foo bar</em> baz</b>'), '<bi>foo bar</bi><b> baz</b>');
        equal(parse('<b><strong><em>foo bar</em></strong> baz</b>'), '<bi>foo bar</bi><b> baz</b>');
    });

    it('format from style', () => {
        equal(parse('hello <span style="font-weight: bold;font-style: italic">world</span>!'), 'hello <bi>world</bi>!');

        // Стиль отменяет тэг
        equal(parse('<b style="font-weight: normal;">text</b>!'), 'text!');

        // Вложенный стиль отменяет внешний стиль
        equal(parse('<span style="font-weight: bold;">foo <i style="font-weight: normal">bar</i> baz</span>'), '<b>foo </b><i>bar</i><b> baz</b>');
    });

    it('skip special', () => {
        equal(parse('hello <script>var a = "<b>text</b>";</script>world</span>!'), 'hello world!');
        equal(parse('hello <style>body { font-style: italic }</style>world</span>!'), 'hello world!');
    });

    it('links', () => {
        equal(
            parse('bar <a href="https://mail.ru" style="font-weight: bold">baz</a>'),
            'bar <a href="https://mail.ru"><b>baz</b></a>');
    });

    it('input tag', () => {
        equal(parse('foo <input value="bar"> baz'), 'foo bar baz');
        equal(parse('foo <input type="radio" value="bar"> baz'), 'foo  baz');
    });

    it('MS Word', () => {
        equal(
            parse('<html xmlns:o="urn:schemas-microsoft-com:office:office"\n  xmlns:w="urn:schemas-microsoft-com:office:word">\n\n\n<body>hello <i\nstyle=\'mso-bidi-font-style:normal\'>word</i>!</body>\n\t\n\t</html>'),
            'hello <i>word</i>!');
    });

    it('block-level tags', () => {
        equal(
            parse('<div>foo</div><div style="font-weight: bold">bar</div>'),
            'foo\n<b>bar</b>');

        equal(
            parse('<div>foo</div><br /><div></div><div style="font-weight: bold">bar</div>'),
            'foo\n<b>bar</b>');
    });
});

describe('HTML Export', () => {
    it('export to HTML', () => {
        equal(
            convert('<b><i>hello</i> world</b>'),
            '<span style="font-weight:bold;font-style:italic">hello</span><span style="font-weight:bold"> world</span>');

        equal(
            convert('<html xmlns:o="urn:schemas-microsoft-com:office:office"\n  xmlns:w="urn:schemas-microsoft-com:office:word">\n\n\n<body>hello <i\nstyle=\'mso-bidi-font-style:normal\'>word</i>!</body>\n\t\n\t</html>'),
            'hello <span style="font-style:italic">word</span>!');
    });
});
