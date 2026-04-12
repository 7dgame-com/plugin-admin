import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { pingPluginDb } from './db/pluginDb';
import menuGroupsRouter from './routes/menuGroups';
import permissionsRouter from './routes/permissions';
import pluginsRouter from './routes/plugins';
import publicApiRouter from './routes/publicApi';
import { error, success } from './utils/response';

dotenv.config();

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(cors());
  app.use(express.json());

  app.get('/health', async (_req, res) => {
    try {
      await pingPluginDb();
      res.json(success({ status: 'ok' }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      res.status(500).json(error(5001, `数据库连接失败: ${message}`));
    }
  });

  app.use('/api/v1/plugin-admin', permissionsRouter);
  app.use('/api/v1/plugin-admin', pluginsRouter);
  app.use('/api/v1/plugin-admin', menuGroupsRouter);
  app.use('/api/v1/plugin', publicApiRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    res.status(500).json(error(5000, message));
  });

  return app;
}

async function bootstrap() {
  await pingPluginDb();

  const port = Number(process.env.PORT || 8088);
  const app = createApp();
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[system-admin-backend] listening on port ${port}`);
  });
}

if (require.main === module) {
  bootstrap().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[system-admin-backend] failed to start:', err);
    process.exit(1);
  });
}
