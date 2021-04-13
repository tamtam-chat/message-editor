import { slice } from '.';
import { getText, Token } from '../parser';
import { isWhitespace } from '../parser/utils';

export default function split(tokens: Token[], chunkSize: number): Token[][] {
    // Алгоритм разбивки:
    // 1. Из текста берём фрагмент в диапазоне [start, chunkSize]
    // 2. Правую границу фрагмента смещаем до тех пор, пока не найдём место,
    //    в котором можем поделить текст (пробел)
    // 3. Из полученного диапазона достаём кусок токенов и добавляем как чанк
    // 4. Сканироание продолжаем от правой границы диапазона
    const result: Token[][] = [];
    const text = getText(tokens);
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
