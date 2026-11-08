import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// The production CSP (connect-src 'none', no inline scripts) would block Vite's HMR socket and the
// React Refresh preamble, so it is only enforced in built output.
const devWithoutCsp = (): Plugin => ({
  name: 'crewbook-dev-without-csp',
  apply: 'serve',
  transformIndexHtml: (html) =>
    html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/, ''),
});

// Relative base so the build works from any GitHub Pages sub-path (HashRouter needs no rewrites).
export default defineConfig({
  base: './',
  plugins: [react(), devWithoutCsp()],
  server: { port: Number(process.env.PORT ?? 5173), strictPort: true },
});
