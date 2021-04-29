import { deepStrictEqual as deepEqual } from 'assert';
import _parse, { Token, TokenType } from '../src/parser';

function parse(text: string) {
    return _parse(text, { command: true });
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

describe('Command', () => {
    it('parse commands', () => {
        // Не разрешаем парсить команды
        let tokens = _parse('/command');
        deepEqual(types(tokens), [TokenType.Text]);

        tokens = parse('/command');
        deepEqual(types(tokens), [TokenType.Command]);
        deepEqual(values(tokens), ['/command']);

        tokens = parse('test /command');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Command]);
        deepEqual(values(tokens), ['test ', '/command']);

        tokens = parse('/command ');
        deepEqual(types(tokens), [TokenType.Command, TokenType.Text]);
        deepEqual(values(tokens), ['/command', ' ']);

        // Не прасим команду, если она не на границе слова
        tokens = parse('foo/bar');
        deepEqual(types(tokens), [TokenType.Text]);
        deepEqual(values(tokens), ['foo/bar']);

        tokens = parse('/приветёЁ');
        deepEqual(types(tokens), [TokenType.Command]);
        deepEqual(values(tokens), ['/приветёЁ']);

        // Распознаём команды только на границах слов
        tokens = parse('http:/');
        deepEqual(types(tokens), [TokenType.Text]);
        deepEqual(values(tokens), ['http:/']);
    });
});
