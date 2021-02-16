import { strictEqual as equal, deepStrictEqual as deepEqual } from 'assert';
import _parse from '../src/parser';
import { Token, TokenType, TokenUserSticker } from '../src/formatted-string/types';

function parse(text: string) {
    return _parse(text, { userSticker: true });
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

describe('User Stickers', () => {
    it('parse complete sticker', () => {
        let tokens = parse('#u9b3c2d1af7s#');
        let token = tokens[0] as TokenUserSticker;
        deepEqual(types(tokens), [TokenType.UserSticker]);
        equal(token.stickerId, '9b3c2d1af7');
        equal(token.value, '#u9b3c2d1af7s#');

        tokens = parse('foo#u9b3c2d1af7s#bar');
        token = tokens[1] as TokenUserSticker;
        deepEqual(types(tokens), [TokenType.Text, TokenType.UserSticker, TokenType.Text]);
        deepEqual(values(tokens), ['foo', '#u9b3c2d1af7s#', 'bar']);
        equal(token.stickerId, '9b3c2d1af7');
        equal(token.value, '#u9b3c2d1af7s#');
    });

    it('skip invalid', () => {
        let tokens = parse('#u9b3c 2d1af7s#');
        deepEqual(types(tokens), [TokenType.Text]);

        tokens = parse('#u9b3Ё2d1af7s#');
        deepEqual(types(tokens), [TokenType.Text]);
    });
});
