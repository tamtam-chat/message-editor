import { slice } from '.';
import { getText, Token } from '../parser';
import { isWhitespace } from '../parser/utils';

export default function split(rawTokens: Token[], chunkSize: number): Token[][] {
    // Алгоритм разбивки:
    // 1. Из текста берём фрагмент в диапазоне [start, chunkSize]
    // 2. Правую границу фрагмента смещаем до тех пор, пока не найдём место,
    //    в котором можем поделить текст (пробел)
    // 3. Из полученного диапазона достаём кусок токенов и добавляем как чанк
    // 4. Сканирование продолжаем от правой границы диапазона

    // Удалим пустые токены, чтобы не мешались, а также удалим проблемы в начале
    // и в конце сообщения
    rawTokens = rawTokens.filter(token => token.value.length > 0);

    const result: Token[][] = [];
    const { text, tokens } = trim(rawTokens);

    let start = 0;
    let end = 0;
    let endBound = 0;

    while (start < text.length) {
        end = start + chunkSize;
        if (end >= text.length) {
            // Дошли до конца
            result.push(slice(tokens, start));
        } else {
            // Подвинем границу влево до ближайшего пробела
            while (end > start && !isWhitespace(text.charCodeAt(end))) {
                end--;
            }

            if (start !== end) {
                // Есть точка деления, уберём пробелы в конце
                endBound = end;
                while (endBound > start && isWhitespace(text.charCodeAt(endBound - 1))) {
                    endBound--;
                }

                if (start !== endBound) {
                    result.push(slice(tokens, start, endBound));
                }
            } else {
                // Нет точки деления, придётся разрезать как есть
                end = start + chunkSize;
                result.push(slice(tokens, start, end));
            }
        }

        start = end;

        // Подвинем точку старта вперёд, чтобы убрать пробелы
        while (start < text.length && isWhitespace(text.charCodeAt(start))) {
            start++;
        }
    }

    return result;
}

/**
 * Удаляет пробелы в начале и в конце строки
 */
export function trim(tokens: Token[]): { text: string, tokens: Token[] } {
    let text = getText(tokens);
    const m1 = text.match(/^\s+/);
    if (m1) {
        text = text.slice(m1[0].length);
        tokens = slice(tokens, m1[0].length);
    }

    const m2 = text.match(/\s+$/);
    if (m2) {
        text = text.slice(0, -m2[0].length);
        tokens = slice(tokens, 0, -m2[0].length);
    }

    return { text, tokens };
}
