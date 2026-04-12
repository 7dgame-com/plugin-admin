jest.mock('../db/pluginDb', () => ({
  pluginPool: {
    query: jest.fn(),
  },
  pingPluginDb: jest.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import { createApp } from '../index';

describe('swagger routes', () => {
  it('returns an OpenAPI 3.0 document for Swagger consumers', async () => {
    const response = await request(createApp()).get('/swagger/openapi.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toMatch(/^3\.0\./);
    expect(response.body.info).toMatchObject({
      title: 'System Admin Backend API',
      version: '1.0.0',
    });
    expect(response.body.paths['/api/v1/plugin-admin/permissions'].get.security).toEqual([
      { BearerAuth: [] },
    ]);
  });

  it('serves Swagger UI HTML at /swagger', async () => {
    const app = createApp();
    const response = await request(app).get('/swagger').redirects(1);
    const initResponse = await request(app).get('/swagger/swagger-ui-init.js');

    expect(response.status).toBe(200);
    expect(response.text).toContain('<div id="swagger-ui"></div>');
    expect(response.text).toContain('./swagger-ui-init.js');
    expect(initResponse.status).toBe(200);
    expect(initResponse.text).toContain('/swagger/openapi.json');
  });
});
