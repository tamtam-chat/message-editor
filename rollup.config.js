import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';

const mode = process.env.NODE_ENV;
const production = mode === 'production';

export default [{
    input: './src/index.ts',
    output: [
        { format: 'es', file: 'dist/editor.es.js' },
        { format: 'cjs', file: 'dist/editor.cjs.js' }
    ],
    plugins: [
        typescript(),
        production && terser({ module: true })
    ],
}, {
    input: './src/parser/index.ts',
    output: {
        file: 'dist/parser.js',
        format: 'es'
    },
    plugins: [
        typescript(),
        production && terser({ module: true })
    ]
}];
