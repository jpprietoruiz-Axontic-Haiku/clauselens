import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next 15.x still exports configuration in the legacy
// (eslintrc) format, not native flat config (that arrives in Next.js 16).
// FlatCompat is the official bridge documented by Next.js to use it from
// eslint.config.mjs.
const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"],
  }),
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
