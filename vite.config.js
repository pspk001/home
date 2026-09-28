import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { copyFileSync } from 'node:fs';

// `npm run build` produces ONE self-contained HTML file (JS + CSS inlined)
// that opens with a double-click — no server or internet needed.
export default defineConfig({
  base: './',
  plugins: [
    viteSingleFile(),
    {
      name: 'copy-standalone',
      apply: 'build',
      closeBundle() {
        copyFileSync('dist/index.html', 'Home-3D-Viewer.html');
      },
    },
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2500,
  },
  server: { open: true },
});
