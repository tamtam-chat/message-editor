import { TokenFormat } from './types';
import ParserState from './state';
export declare const charToFormat: Map<number, TokenFormat>;
export default function parseMarkdown(state: ParserState): boolean;
/**
 * Возвращает MS-формат для указанного кода
 */
export declare function formatForChar(ch: number): TokenFormat;
export declare function isStartBoundChar(ch: number): boolean;
export declare function isEndBoundChar(ch: number): boolean;
export declare function peekClosingMarkdown(state: ParserState): boolean;
