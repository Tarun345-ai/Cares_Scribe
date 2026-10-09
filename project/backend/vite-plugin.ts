import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';
import type { Plugin } from 'vite';

// Mounts the Express Care Loop API under /api during dev and preview,
// so the frontend and backend share one origin (no CORS, one process).
export function careLoopApiPlugin(): Plugin {
  return {
    name: 'care-loop-api',
    enforce: 'pre',

    // Make everything in .env (GROQ_API_KEY, RESEND_API_KEY, ...) visible
    // to the backend through process.env. Vite does not do this by itself.
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
    },

    // DEV: let Vite itself load the Express app (reliable ESM handling + reload on edit)
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api') && !req.url?.startsWith('/v1')) return next();
        try {
          const mod = await server.ssrLoadModule('/backend/server.js');
          const app = mod.default;
          if (typeof app !== 'function') {
            throw new Error('backend/server.js must `export default app`');
          }
          app(req, res, next);
        } catch (err) {
          server.ssrFixStacktrace(err as Error);
          next(err);
        }
      });
    },

    // PREVIEW (npm run preview): plain Node import of the backend
    configurePreviewServer(server) {
      let appPromise: Promise<any> | null = null;
      const getApp = () =>
        (appPromise ??= import(
          /* @vite-ignore */ pathToFileURL(path.resolve(process.cwd(), 'backend/server.js')).href
        ).then((m) => m.default));

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api') && !req.url?.startsWith('/v1')) return next();
        try {
          const app = await getApp();
          app(req, res, next);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}