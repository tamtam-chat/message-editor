import { TextRange } from './types';
import { Token } from '../parser';
/**
 * Конвертация MD-токенов в список обычных текстовых токенов
 * @param range Диапазон внутри MD-строки. Если указан, значения параметра будут
 * изменены таким образом, чтобы указывать на ту же самую позицию внутри
 * внутри нового списка токенов
 */
export declare function mdToText(tokens: Token[], range?: TextRange): Token[];
/**
 * Конвертация обычных текстовых токенов в MD-строку
 * @param range Диапазон внутри текстовой строки. Если указан, значения параметра будут
 * изменены таким образом, чтобы указывать на ту же самую позицию внутри
 * внутри нового списка токенов
 */
export declare function textToMd(tokens: Token[], range?: TextRange): string;
