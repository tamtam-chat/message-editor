import { TokenFormat } from '../formatted-string';
import { TokenTextEmoji, TokenType } from '../formatted-string/types';
import ParserState from './state';
import { ParserOptions } from './types';
import { isDelimiter } from './utils';

type Tree = Map<number, true | Tree>;

const aliases = {
    ':C': '☹️',
    ':c': '☹️',
    ':)': '🙂',
    ':-)': '🙂',
    '<3': '❤️',
    ':(|)': '🐵',
    ':(:)': '🐷',
    '(]:{': '👳',
    '</3': '💔',
    '~@~': '💩',
    ':D': '😀',
    ':-D': '😀',
    '^_^': '😁',
    '=D': '😄',
    ':-@': '😣',
    ':-S': '😖',
    'O:)': '😇',
    'O=)': '😇',
    'O:-)': '😇',
    '}:)': '😈',
    '}=)': '😈',
    '}:-)': '😈',
    ';)': '😉',
    ';-)': '😉',
    '=)': '🙂',
    '^^': '😊',
    'B-)': '😎',
    ':,': '😏',
    ':-,': '😏',
    ':|': '😐',
    '=|': '😐',
    ':-|': '😐',
    '-_-': '😑',
    'u_u': '😔',
    // ':/': '😕',
    '=/': '😕',
    ':-/': '😕',
    ':-\\': '😕',
    ':s': '😖',
    ':-s': '😖',
    ':*': '😗',
    ':-*': '😗',
    ';*': '😘',
    ';-*': '😘',
    '=*': '😚',
    ':p': '😛',
    ':P': '😛',
    ':-p': '😛',
    ':-P': '😛',
    '=p': '😛',
    '=P': '😛',
    ';p': '😜',
    ';P': '😜',
    ';-p': '😜',
    ';-P': '😜',
    ':(': '🙁',
    ':-(': '🙁',
    '=(': '🙁',
    '>:(': '😡',
    ':\'(': '😢',
    '=\'(': '😢',
    'T_T': '😭',
    ';_;': '😭',
    '>.<': '😣',
    '>_<': '😣',
    'D:': '😦',
    ':o': '😮',
    ':O': '😮',
    '=o': '😮',
    '=O': '😮',
    ':-O': '😮',
    ':-o': '😮',
    'o.o': '😮',
    'O.O': '😲',
    'x_x': '😵',
    'X(': '😵',
    'X-(': '😵',
    'X-o': '😵',
    'X-O': '😵',
    ':3': '😸',
    'o/': '🙋',
    '\\o': '🙋',
    '\\m/': '🤘',
    ':-$': '🤐',
    ':$': '🤐',
    '*-)': '😐',
    ':-I': '😠',
    ':I': '😠',
    '8oI': '😡',
    '8o|': '😡',
    '|-)': '😪',
    '(ch)': '😏',
    '(lo)': '😍',
    '(sr)': '😔',
    '|-(': '😴',
    '(y)': '👍',
    '(Y)': '👍',
    '(n)': '👎',
    '(N)': '👎',
    '(H)': '😎',
    '(hu)': '😬',
    '(tr)': '😒',
    '(md)': '😵',
    '(fr)': '😄',
    '(dt)': '😟',
    '(sc)': '😕',
    '(v)': '✌️',
    '(L)': '❤️',
    '(U)': '💔',
    '(K)': '💋',
    '(F)': '🌼',
    '(*)': '⭐',
    '(^)': '🎂',
    '(G)': '🎁',
    '(B)': '🍺',
    '(D)': '🍸',
    '(CC)': '🎂',
    '(pi)': '🍕',
    '(pl)': '🍴',
    '(ic)': '🍦',
    '($)': '💰',
    '(co)': '💻',
    '(so)': '⚽',
    '(te)': '🎾',
    '(nt)': '🎵',
    '(I)': '💡',
    '(E)': '✉️',
    '(Z)': '👦',
    '(X)': '👧',
    '(S)': '🌙',
    '(facepalm)': '🤦‍'
};

const lookup: Tree = createLookupTree(aliases);

export default function parseTextEmoji(state: ParserState, options: ParserOptions): TokenTextEmoji | undefined {
    if (options.textEmoji && !state.hasFormat(TokenFormat.MONOSPACE) && isDelimiter(state.peekPrev())) {
        const { pos } = state;
        let tree = lookup;
        while (state.hasNext()) {
            const entry = tree.get(state.next());

            if (entry === true) {
                // Нашли совпадение, убедимся, что оно на границе слов
                if (!isDelimiter(state.peek())) {
                    return;
                }

                const value = state.substring(pos);
                return {
                    type: TokenType.TextEmoji,
                    format: state.format,
                    value,
                    emoji: aliases[value] || value
                };
            }

            if (entry === undefined) {
                break;
            }

            tree = entry;
        }

        state.pos = pos;
    }
}

function collectTree(tree: Tree, text: string, i = 0): void {
    const ch = text.charCodeAt(i++);

    if (i === text.length) {
        tree.set(ch, true);
    } else {
        if (!tree.has(ch)) {
            tree.set(ch, new Map());
        }
        collectTree(tree.get(ch) as Tree, text, i);
    }
}

function createLookupTree(dict: Record<string, string>): Tree {
    const root = new Map();
    Object.keys(dict).forEach(key => collectTree(root, key));
    return root;
}
