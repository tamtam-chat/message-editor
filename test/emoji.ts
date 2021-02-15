import fs from 'fs';
import path from 'path';
import { strictEqual as equal, deepStrictEqual as deepEqual } from 'assert';
import parse from '../src/parser';
import { Token, TokenType } from '../src/formatted-string/types';

function read(file: string): string {
    return fs.readFileSync(path.resolve(__dirname, file), 'utf8');
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

describe('Emoji', () => {
    describe('Unicode standard', () => {
        const parseEmoji = (text: string) => {
            const token = parse(text)[0];
            return token.type === TokenType.Emoji ? token.value : null;
        };
        const repr = (text: string) => {
            const chars = [];
            let i = 0;
            while (i < text.length) {
                const cp = text.codePointAt(i);
                chars.push(`U+${cp.toString(16).toUpperCase()}`);
                i += cp > 0xffff ? 2 : 1;
            }

            return chars.join(', ');
        };
        const trim = (str: string) => str.trim();

        const check = (data: string) => {
            data.split('\n')
                .map(trim)
                .filter(line => line && line[0] !== '#')
                .forEach(line => {
                    const parts = line.split(';').map(trim);
                    const emoji = parts[0].split(' ').map(code => String.fromCodePoint(parseInt(code, 16))).join('');
                    const qualified = parts[1].split('#')[0].trim() === 'fully-qualified';

                    if (qualified) {
                        equal(parseEmoji(emoji), emoji, `Test ${emoji} ${parts[0]} (presented as ${repr(emoji)}) ${parts[1]}`);
                    }
                });
        };

        it('unicode 12.1', () => {
            check(read('emoji-test-12.txt'));
        });

        it('unicode 13.1', () => {
            check(read('emoji-test-13.txt'));
        });
    });

    it('basic emoji in text', () => {
        let tokens = parse('a✊b');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Emoji, TokenType.Text]);
        deepEqual(values(tokens), ['a', '✊', 'b']);

        tokens = parse('a✊ba✊ba✊b');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Emoji, TokenType.Text, TokenType.Emoji, TokenType.Text, TokenType.Emoji, TokenType.Text]);
        deepEqual(values(tokens), ['a', '✊', 'ba', '✊', 'ba', '✊', 'b']);

        tokens = parse('😃✊😃');
        deepEqual(types(tokens), [TokenType.Emoji, TokenType.Emoji, TokenType.Emoji], 'Emoji of different size');
        deepEqual(values(tokens), ['😃', '✊', '😃'], 'Emoji of different size');
    });

    it('keycaps', () => {
        const tokens = parse('12️⃣');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Emoji]);
        deepEqual(values(tokens), ['1', '2️⃣']);
    });

    it('dingbats', () => {
        const tokens = parse('♨*');
        deepEqual(types(tokens), [TokenType.Emoji, TokenType.Text]);
        deepEqual(values(tokens), ['♨', '*']);
    });

    it('flags', () => {
        const tokens = parse('a🇯🇵🇰🇷🇩🇪b');
        deepEqual(types(tokens), [TokenType.Text, TokenType.Emoji, TokenType.Emoji, TokenType.Emoji, TokenType.Text]);
        deepEqual(values(tokens), ['a', '🇯🇵', '🇰🇷', '🇩🇪', 'b']);
    });

    it('skin tone', () => {
        const tokens = parse('👍🏽 🧒🏼');
        deepEqual(types(tokens), [TokenType.Emoji, TokenType.Text, TokenType.Emoji]);
        deepEqual(values(tokens), ['👍🏽', ' ', '🧒🏼']);
    });

    it('combined emoji', () => {
        const tokens = parse('👩🏼👩🏼‍🦰🤦🏼‍♀️');
        deepEqual(types(tokens), [TokenType.Emoji, TokenType.Emoji, TokenType.Emoji]);
        deepEqual(values(tokens), ['👩🏼', '👩🏼‍🦰', '🤦🏼‍♀️']);
    });
});
