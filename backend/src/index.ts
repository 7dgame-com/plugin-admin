import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { pingPluginDb } from './db/pluginDb';
import { ensurePluginSchemaColumns } from './db/pluginSchema';
import { openApiDocument } from './openapi/spec';
import diagnosticsRouter from './routes/diagnostics';
import permissionsRouter from './routes/permissions';
import pluginsRouter from './routes/plugins';
import publicApiRouter from './routes/publicApi';
import { getBuildInfo } from './utils/buildInfo';
import { error, success } from './utils/response';
import swaggerUi from 'swagger-ui-express';

dotenv.config();

const swaggerUiOptions = {
  swaggerOptions: {
    url: '/swagger/openapi.json',
    deepLinking: true,
    docExpansion: 'list',
  },
  customSiteTitle: 'System Admin Backend API Docs',
};

const swaggerUiHandler = swaggerUi.setup(undefined, swaggerUiOptions);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(cors());
  app.use(express.json());

  app.use('/diagnostics', diagnosticsRouter);

  app.get('/health', async (_req, res) => {
    try {
      await ensurePluginSchemaColumns();
      await pingPluginDb();
      const buildInfo = getBuildInfo();
      res.set('X-Service-Version', buildInfo.version);
      res.set('X-Git-Sha', buildInfo.gitSha);
      res.json(success({ status: 'ok', ...buildInfo }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      res.status(500).json(error(5001, `数据库连接失败: ${message}`));
    }
  });

  app.get('/swagger/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use('/swagger', swaggerUi.serveFiles(undefined, swaggerUiOptions));
  app.get('/swagger', swaggerUiHandler);
  app.get('/swagger/', swaggerUiHandler);

  app.use('/api/v1/plugin-admin', permissionsRouter);
  app.use('/api/v1/plugin-admin', pluginsRouter);
  app.use('/api/v1/plugin', publicApiRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    res.status(500).json(error(5000, message));
  });

  return app;
}

async function bootstrap() {
  await ensurePluginSchemaColumns();
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
