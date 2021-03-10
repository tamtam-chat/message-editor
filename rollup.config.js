import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';

const mode = process.env.NODE_ENV;
const production = mode === 'production';

export default {
    input: './src/editor/index.ts',
    output: [
        { format: 'es', file: 'dist/editor.js' }
    ],
    plugins: [
        resolve({ browser: true }),
        commonjs(),
        typescript(),
        production && terser({
            module: true
        })
    ],
};
