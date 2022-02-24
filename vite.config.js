function getBuildConfig() {
    switch (process.env.BUILD) {
        case 'parser':
            return {
                emptyOutDir: false,
                lib: {
                    entry: './src/parser/index.ts',
                    formats: ['es'],
                    fileName: () => 'parser.js',
                }
            };
        case 'lib':
            return {
                emptyOutDir: false,
                lib: {
                    entry: './src/index.ts',
                    fileName: 'editor',
                    formats: ['es', 'cjs'],
                }
            };
        case 'demo':
            return {
                outDir: './public',
            }
    }

    return {};
}

/** @type {import('vite').UserConfig} */
const config = {
    build: {
        outDir: './dist',
        ...getBuildConfig()
    }
};

if (process.env.BUILD) {
    config.base = './';
}

export default config;
