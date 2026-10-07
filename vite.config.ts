/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

/**
 * Curriculum content (skills, curriculum outlines, practice items, reference
 * entries…) is authored in YAML so prose, LaTeX and code can be written without
 * escaping. This plugin converts every `*.yaml` import into a plain JSON module
 * at build time, so the browser never ships a YAML parser.
 */
function yamlContent(): Plugin {
  return {
    name: 'cbmos-yaml-content',
    enforce: 'pre',
    load(id) {
      const [file, query] = id.split('?');
      if (query || !/\.ya?ml$/.test(file)) return null;
      const source = readFileSync(file, 'utf8');
      let data: unknown;
      try {
        data = parseYaml(source, { prettyErrors: true });
      } catch (err) {
        this.error(`YAML parse error in ${file}: ${(err as Error).message}`);
      }
      return { code: `export default ${JSON.stringify(data)};`, map: null, moduleType: 'js' };
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [yamlContent(), react()],
  server: { port: 5173, strictPort: false },
  preview: { port: 4173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    sourcemap: false,
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
