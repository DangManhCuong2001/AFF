import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    // Local render and browser-QA artifacts are already excluded from Git.
    // Linting bundled dependencies and generated one-off scripts produces
    // thousands of unrelated errors and makes the production check unusable.
    "output/**",
    "next-env.d.ts",
  ]),
  {
    // These files are executed directly by Node's test runner, not bundled by
    // Next.js. CommonJS imports are intentional in this isolated harness.
    files: ["tests/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
