import js from "@eslint/js";
import ts from "typescript-eslint";
import globals from "globals";
import nextConfig from "./apps/web/eslint.config.mjs";

const shopifyIgnorePath = [
  "apps/shopify/.shopify/**",
  "apps/shopify/.react-router/**",
]

export default ts.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/out/**",
      "**/generated/**",
      "**/*.config.*",
      ".http/**",
      ...shopifyIgnorePath,
    ],
  },
  // --- Profile: Anything Else ---
  {
    name: "anything-else",
    files: ["**/*.{js,mjs,ts}"],
    ignores: ["apps/**/*"],
    extends: [
      js.configs.recommended,
      ...ts.configs.recommended,
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "warn",
    },
  },
  // --- Profile: Apps ---
  {
    name: "apps-base",
    files: ["apps/**/*.{js,mjs,ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...ts.configs.recommended,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-console": "warn",
    },
  },
  // For apps/web, we also apply its Next.js specific config
  ...nextConfig.map(config => {
    if (config.rules || config.plugins || config.languageOptions || config.settings) {
      return {
        ...config,
        files: config.files || ["apps/web/**/*.{js,mjs,ts,tsx}"],
      };
    }
    return config;
  }),
  {
    settings: {
      next: {
        rootDir: "apps/web",
      },
    },
  },
);
