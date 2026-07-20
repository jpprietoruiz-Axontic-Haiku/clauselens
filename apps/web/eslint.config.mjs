import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next 15.x todavía exporta configuración en formato legacy
// (eslintrc), no flat config nativo (eso llega en Next.js 16). FlatCompat es
// el puente oficial documentado por Next.js para usarla desde eslint.config.mjs.
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
