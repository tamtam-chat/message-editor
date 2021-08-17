import { ParserOptions, Token } from './types';
export default function parse(text: string, opt?: Partial<ParserOptions>): Token[];
export { normalize, getText, getLength, codePointAt } from './utils';
export { ParserOptions, Token, TokenType, TokenFormat, Emoji, TokenCommand, TokenHashTag, TokenLink, TokenMarkdown, TokenMention, TokenText, TokenUserSticker } from './types';
