const editorConfig = {
    entry: './src/index.ts',
    fileName: 'editor',
    formats: ['es', 'cjs'],
};

const parserConfig = {
    entry: './src/parser/index.ts',
    formats: ['es'],
    fileName: () => 'parser.js',
};

/** @type {import('vite').UserConfig} */
const config = {
    build: {
        emptyOutDir: false,
        outDir: './dist',
        lib: process.env.BUILD === 'parser'
            ? parserConfig
            : editorConfig
    }
};

export default config;
