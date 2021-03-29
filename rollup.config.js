import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';

const mode = process.env.NODE_ENV;
const production = mode === 'production';

export default {
    input: './src/index.ts',
    output: [
        { format: 'es', file: 'dist/editor.es.js' },
        { format: 'cjs', file: 'dist/editor.cjs.js' }
    ],
    plugins: [
        resolve({ browser: true }),
        commonjs(),
        typescript({
            tsconfigOverride: {
                compilerOptions: {
                    target: 'es5',
                    module: 'ESNext',
                    declaration: true
                }
            }
        }),
        production && terser({
            module: true
        })
    ],
};
