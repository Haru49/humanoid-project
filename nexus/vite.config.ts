import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NEXUS runs locally in a browser window for v0.1.
// Native desktop packaging and serial access are later phases.
export default defineConfig({
  plugins: [react()],
  // index.html is the rebuilt UI (wireframe v8); legacy.html is the previous React UI.
  build: {
    rollupOptions: {
      input: { main: 'index.html', legacy: 'legacy.html' },
    },
  },
  server: {
    port: 5180,
    host: '127.0.0.1',
    proxy: { '/api/telemetry': 'http://127.0.0.1:5181' },
  },
});
