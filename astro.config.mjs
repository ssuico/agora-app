// @ts-check

import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const API_TARGET = process.env.API_URL ?? 'http://localhost:3001';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'middleware' }),
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        // Proxy Socket.IO traffic to Express so network clients work without
        // hardcoding the server IP in the socket client.
        '/socket.io': {
          target: API_TARGET,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  },
  integrations: [react()],
});