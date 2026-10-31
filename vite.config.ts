import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// BASE controls the public path the built bundle is mounted under.
// Default `.` (relative) so the build can be dropped into any subdirectory
// (e.g. codebn.cn/digital/) without rebuilding. Set to `/` for root hosting,
// or to `/digital/` to lock it to one path with absolute references.
const BASE = process.env.VITE_BASE_PATH ?? './';

export default defineConfig({
  base: BASE,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  preview: {
    host: '127.0.0.1',
    port: 4173
  },
  test: {
    environment: 'node',
    globals: true
  }
});
