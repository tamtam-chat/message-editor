import { deepStrictEqual as deepEqual } from 'assert';
import { setFormat } from '../src/formatted-string';
import parse, { Token, TokenFormat } from '../src/parser';
import split from '../src/formatted-string/split';
import { repr } from './formatted-string';

function toText(chunks: Token[][]): string[] {
    return chunks.map(chunk => repr(chunk));
}

describe('Split string', () => {
    it('basic split', () => {
        let text = parse('Lorem ipsum dolor sit amet consectetur adipisicing, elit.');
        text = setFormat(text, { add: TokenFormat.Bold }, 12, 26);
        let chunks = split(text, 20);

        deepEqual(toText(chunks), [
            'Lorem ipsum <b>dolor</b>',
            '<b>sit amet consectetur</b>',
            'adipisicing, elit.'
        ]);

        // Проверка обрезания пробелов: нарезаем на фрагменты разной длины,
        // чтобы граница попадала в разные места с пробелами
        text = parse('111    222');

        // Середина последовательности пробелов
        chunks = split(text, 5);
        deepEqual(toText(chunks), ['111', '222']);

        // Перед началом последовательности пробелов
        chunks = split(text, 3);
        deepEqual(toText(chunks), ['111', '222']);

        // В конце последовательности пробелов
        chunks = split(text, 7);
        deepEqual(toText(chunks), ['111', '222']);
    });

    it('large words', () => {
        // Деление строки на чанки с длинными словами, которые не помещаются
        // в размер чанка

        const text = parse('111111 22 https://tamtam.chat', { link: true });
        const chunks = split(text, 5);
        deepEqual(toText(chunks), [
            '11111',
            '1 22',
            '<a href="https://tamtam.chat">https</a>',
            '<a href="https://tamtam.chat">://ta</a>',
            '<a href="https://tamtam.chat">mtam.</a>',
            '<a href="https://tamtam.chat">chat</a>'
        ]);
    });
});
