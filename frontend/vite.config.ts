import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

const pdfDirectory = fileURLToPath(new URL('./node_modules/pdfjs-dist/', import.meta.url));
const sampleDirectory = fileURLToPath(new URL('../../docs/idea/papers/', import.meta.url));
const supportFolders = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];

function documentAssets(): Plugin {
  const support = new Map<string, string>();
  for (const folder of supportFolders) {
    for (const file of readdirSync(join(pdfDirectory, folder))) {
      const path = join(pdfDirectory, folder, file);
      if (statSync(path).isFile()) support.set(`assets/${file}`, path);
    }
  }
  const samples = new Map<string, string>();
  if (existsSync(sampleDirectory)) {
    for (const file of readdirSync(sampleDirectory)) {
      if (/\.(pdf|jpe?g)$/i.test(file)) samples.set(file, join(sampleDirectory, file));
    }
  }

  return {
    name: 'baihua-document-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        let path: string;
        try {
          path = decodeURIComponent(url.pathname.slice(1));
        } catch {
          res.writeHead(400).end();
          return;
        }
        const isSample = path.startsWith('local-samples/');
        if (isSample) {
          const host = req.headers.host ?? '';
          const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?$/i.test(host);
          const localPeer = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
            req.socket.remoteAddress ?? ''
          );
          const fetchSite = req.headers['sec-fetch-site'];
          if (
            !localHost ||
            !localPeer ||
            (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') ||
            (req.headers.origin && req.headers.origin !== `http://${host}`)
          ) {
            res.writeHead(403).end();
            return;
          }
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        }
        const file = isSample
          ? samples.get(path.slice('local-samples/'.length))
          : support.get(path);
        if (!file) {
          if (isSample || path.startsWith('assets/')) res.writeHead(404).end();
          else next();
          return;
        }
        res.setHeader(
          'Content-Type',
          file.endsWith('.pdf')
            ? 'application/pdf'
            : isSample
              ? 'image/jpeg'
              : file.endsWith('.js')
                ? 'application/javascript'
                : 'application/octet-stream'
        );
        createReadStream(file)
          .on('error', () => res.destroy())
          .pipe(res);
      });
    },
    generateBundle() {
      for (const [fileName, path] of support) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(path) });
      }
    }
  };
}

export default defineConfig({
  plugins: [vue(), documentAssets()],
  server: { cors: false },
  build: {
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // The release iPhone host serves JavaScript MIME only for .js files.
        assetFileNames: (asset) =>
          asset.name?.endsWith('.mjs') ? 'assets/[name]-[hash].js' : 'assets/[name]-[hash][extname]'
      }
    }
  },
  optimizeDeps: { exclude: ['pdfjs-dist'] },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  }
});
