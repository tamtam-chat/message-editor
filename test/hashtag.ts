import { deepStrictEqual as deepEqual } from 'assert';
import _parse, { TokenType } from '../src/parser';
import type { Token } from '../src/parser';

function parse(text: string) {
    return _parse(text, { hashtag: true });
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

describe('Hashtags', () => {
    it('parse hashtags', () => {
        // Не разрешаем парсить команды
        let tokens = _parse('#foo');
        deepEqual(types(tokens), [TokenType.Text]);

        tokens = parse('#foo test #1 # #@bar #!attention #!new_life');
        deepEqual(types(tokens), [TokenType.HashTag, TokenType.Text, TokenType.HashTag, TokenType.Text, TokenType.HashTag, TokenType.Text]);
        deepEqual(values(tokens), ['#foo', ' test ', '#1', ' ', '#', ' #@bar #!attention #!new_life']);

        // Хэштэги можно писать вместе
        tokens = parse('#hello#world');
        deepEqual(types(tokens), [TokenType.HashTag, TokenType.HashTag]);
        deepEqual(values(tokens), ['#hello', '#world']);
    });

    it('non-latin hashtags', () => {
        // Русские хэштэги
        let tokens = parse('#привет русский текст с хэштегами - #мир труд май');
        deepEqual(types(tokens), [TokenType.HashTag, TokenType.Text, TokenType.HashTag, TokenType.Text]);
        deepEqual(values(tokens), ['#привет', ' русский текст с хэштегами - ', '#мир', ' труд май']);

        tokens = parse('#а#я#А#Я');
        deepEqual(types(tokens), [TokenType.HashTag, TokenType.HashTag, TokenType.HashTag, TokenType.HashTag]);
        deepEqual(values(tokens), ['#а', '#я', '#А', '#Я']);

        // Арабские хэштэги
        tokens = parse('#سلام');
        deepEqual(types(tokens), [TokenType.HashTag]);
        deepEqual(values(tokens), ['#سلام']);
    });
});
