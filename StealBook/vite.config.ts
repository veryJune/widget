import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { unfurl } from './api/unfurl.ts';

// 로컬 개발(npm run dev)에서도 /api/unfurl(링크 미리보기)이 동작하도록 붙이는 작은 플러그인.
// 배포(Vercel)에서는 api/unfurl.ts 가 서버리스 함수로 그대로 실행됩니다.
function devApi(): Plugin {
  return {
    name: 'stealbook-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/unfurl', async (req, res) => {
        try {
          const u = new URL(req.url || '', 'http://localhost');
          const data = await unfurl(u.searchParams.get('url') || '');
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(data));
        } catch (e) {
          res.statusCode = 400;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: String((e as Error).message || e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), tailwindcss(), devApi()],
    server: { port: 5173, host: true },
  };
});
