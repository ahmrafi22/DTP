import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Vendored, minified MapLibre worker files — never lint dist output.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/maplibre-gl-*.mjs",
  ]),
  {
    // Vendored mapcn component (components/ui/map.tsx): its ref-during-render
    // and effect setState patterns are intentional library internals that the
    // new react-hooks v6 rules flag; keep them from failing lint.
    files: ["components/ui/map.tsx"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
