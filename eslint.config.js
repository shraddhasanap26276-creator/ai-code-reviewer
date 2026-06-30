module.exports = [{
    languageOptions: {
        ecmaVersion: 2021,
        sourceType: 'commonjs',
        globals: {
            require: 'readonly',
            module: 'readonly',
            process: 'readonly',
            console: 'readonly',
            __dirname: 'readonly',
            Buffer: 'readonly',
            describe: 'readonly',
            it: 'readonly',
            expect: 'readonly',
            fetch: 'readonly',
        },
    },
    rules: {
        'no-unused-vars': 'warn',
        'no-console': 'off',
    },
}, ];