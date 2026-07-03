import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/",
      "**/dist/",
      "**/.next/",
      "**/coverage/",
      "**/next-env.d.ts",
      "**/playwright-report/",
      "**/test-results/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Node build scripts (piece baking etc.): Node globals are fine here.
  {
    files: ["**/scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // The engine is pure, dependency-free, and OSS-bound: hold it to
  // type-aware linting and forbid any runtime-environment imports.
  {
    files: ["packages/engine/src/**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["node:*"],
              message:
                "The engine must stay runtime-agnostic — no Node APIs.",
            },
          ],
        },
      ],
    },
  },
);
