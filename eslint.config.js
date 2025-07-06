// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import eslintPluginPrettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
    { ignores: ["dist"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
            globals: globals.browser,
        },
        plugins: {
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
            prettier: eslintPluginPrettier,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
            "prettier/prettier": [
                "error",
                {
                    printWidth: 100,
                    tabWidth: 4,
                    semi: true,
                    singleQuote: false,
                    trailingComma: "all",
                    bracketSpacing: true,
                    jsxBracketSameLine: false,
                    arrowParens: "always",
                    endOfLine: "lf",
                },
            ],
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
        },
    },
    prettierConfig, // disables conflicting ESLint formatting rules
);
