jest.mock('../db/pluginDb', () => ({
  pluginPool: { query: jest.fn() },
  pingPluginDb: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('axios');

import axios from 'axios';
import request from 'supertest';
import { createApp } from '../index';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const { pluginPool } = jest.requireMock('../db/pluginDb') as { pluginPool: { query: jest.Mock } };
const path = '/api/v1/plugin/access-config/sn-management';
const row = { id: 'sn-management', enabled: 1, access_scope: 'root-only', organization_name: null };

function identify(roles = ['admin'], organizations: unknown[] = []) {
  mockedAxios.get.mockResolvedValue({ data: { id: 123, roles, organizations } });
}

describe('trusted plugin access configuration', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    pluginPool.query.mockReset();
    identify();
    pluginPool.query.mockResolvedValue([[row]]);
  });

  it('serves only existing public metadata without calling back into a waiting API worker', async () => {
    const response = await request(createApp()).get(path);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns only strict policy metadata; the consuming backend authorizes the current role', async () => {
    pluginPool.query.mockResolvedValue([[{ ...row, url: 'https://unused.example', private_value: 'withheld' }]]);
    const response = await request(createApp()).get(path).set('Authorization', 'Bearer test');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ code: 0, message: 'ok', data: {
      policy_version: 1, id: 'sn-management', enabled: true, access_scope: 'root-only',
    } });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(pluginPool.query).toHaveBeenCalledWith(
      'SELECT id, enabled, access_scope, organization_name FROM plugins WHERE id = ? AND organization_name IS NULL LIMIT 2',
      ['sn-management'],
    );
  });

  it('reads every request so switching to admin and back has no permission cache', async () => {
    pluginPool.query.mockResolvedValueOnce([[row]])
      .mockResolvedValueOnce([[{ ...row, access_scope: 'admin-only' }]])
      .mockResolvedValueOnce([[row]]);
    const app = createApp();
    const scopes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const response = await request(app).get(path).set('Authorization', 'Bearer unchanged-token');
      expect(response.status).toBe(200);
      scopes.push(response.body.data.access_scope);
    }
    expect(scopes).toEqual(['root-only', 'admin-only', 'root-only']);
    expect(pluginPool.query).toHaveBeenCalledTimes(3);
  });

  it.each([null, undefined, '', 'ROOT-ONLY', 'unknown'])('fails closed for invalid scope %p', async (scope) => {
    pluginPool.query.mockResolvedValue([[{ ...row, access_scope: scope }]]);
    const response = await request(createApp()).get(path).set('Authorization', 'Bearer test');
    expect(response.status).toBe(503);
    expect(response.body).not.toHaveProperty('data');
  });

  it.each([{ rows: [] }, { rows: [{ ...row, enabled: 0 }] }])('denies unavailable plugins even for root', async ({ rows }) => {
    identify(['root']);
    pluginPool.query.mockResolvedValue([rows]);
    expect((await request(createApp()).get(path).set('Authorization', 'Bearer test')).status).toBe(404);
  });

  it('does not disclose database or schema failures', async () => {
    pluginPool.query.mockRejectedValue(new Error('secret connection information'));
    const response = await request(createApp()).get(path).set('Authorization', 'Bearer test');
    expect(response.status).toBe(503);
    expect(response.text).not.toContain('secret');
    expect(response.body).not.toHaveProperty('data');
  });

  it.each(['example-org', '', '   '])('never discloses non-null organization configuration %p', async (organization) => {
    pluginPool.query.mockResolvedValue([[{ ...row, organization_name: organization }]]);
    identify(['root']);
    const response = await request(createApp()).get(path + '?roles=root').set('Authorization', 'Bearer test');
    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty('data');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
