import js from '@eslint/js';
import globals from "globals";

export default [
    js.configs.recommended,
    {
        files: ["**/*.js"],
        ignores: ["ndoe_modules/**", "dist/**"],
        languageOptions: {
            sourceType: "module",  // enable import/export
            ecmaVersion: "latest",
            globals:{
                ...globals.node
            }
        },
        rules: {
            "no-unused-vars": "error",
            "no-undef": "error",
            "semi": ["error", "always"],
            "quotes": ["error", "single"],
           // "indent": ["error", 2],
            "no-trailing-spaces": "error",
            "no-multiple-empty-lines": ["error", { "max": 1 }]
        }
    }
];

        