jest.mock('../db/pluginDb', () => ({
  pluginPool: {
    query: jest.fn(),
  },
  pingPluginDb: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('axios');

import axios from 'axios';
import fc from 'fast-check';
import { createPlugin as createPluginController, listPlugins as listPluginsController } from '../controllers/plugins';
import {
  createPermission as createPermissionController,
  listPermissions as listPermissionsController,
  updatePermission as updatePermissionController,
} from '../controllers/permissions';
import {
  allowedActions as allowedActionsController,
  checkPermission as checkPermissionController,
  list as publicListController,
} from '../controllers/publicApi';
import { error, paginated, success } from '../utils/response';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const { pluginPool } = jest.requireMock('../db/pluginDb') as {
  pluginPool: {
    query: jest.Mock;
  };
};

const ORGANIZATION_NAME = 'acme';
const ORGANIZATION_TITLE = 'Acme Studio';
const FIELD_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'.split('');
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('');
const URL_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-'.split('');
const JSON_KEY_CHARS = 'abcdefghijklmnopqrstuvwxyz-'.split('');
const ROLES = ['root', 'admin', 'manager', 'user'] as const;

type CaseKind = 'valid' | 'empty' | 'tooLong';

type StringCase = {
  kind: CaseKind;
  value: string;
};

type PluginIdCase = StringCase | { kind: 'invalidChars'; value: string };
type PluginUrlCase = StringCase | { kind: 'invalidFormat'; value: string };

type PermissionRow = {
  id: number;
  role_or_permission: string;
  plugin_name: string;
  action: string;
  created_at: string | null;
  updated_at: string | null;
};

type PluginRow = {
  id: string;
  name: string;
  name_i18n: string | null;
  description: string | null;
  url: string;
  icon: string | null;
  enabled: number;
  order: number;
  allowed_origin: string | null;
  version: string | null;
  organization_name: string | null;
};

function expectedPageLength(total: number, page: number, perPage: number): number {
  const offset = (page - 1) * perPage;
  if (offset >= total) {
    return 0;
  }

  return Math.min(perPage, total - offset);
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function fieldString(minLength: number, maxLength: number) {
  return fc
    .array(fc.constantFrom(...FIELD_CHARS), { minLength, maxLength })
    .map((chars) => chars.join(''));
}

function pluginIdString(minLength: number, maxLength: number) {
  return fc
    .array(fc.constantFrom(...ID_CHARS), { minLength, maxLength })
    .map((chars) => chars.join(''));
}

function urlSegmentString(minLength: number, maxLength: number) {
  return fc
    .array(fc.constantFrom(...URL_CHARS), { minLength, maxLength })
    .map((chars) => chars.join(''));
}

function jsonKeyString(minLength: number, maxLength: number) {
  return fc
    .array(fc.constantFrom(...JSON_KEY_CHARS), { minLength, maxLength })
    .map((chars) => chars.join(''));
}

function permissionFieldCase(limit: number): fc.Arbitrary<StringCase> {
  return fc.oneof(
    fc.constant({ kind: 'empty', value: '' }),
    fieldString(1, limit).map((value): StringCase => ({ kind: 'valid', value })),
    fieldString(limit + 1, limit + 20).map((value): StringCase => ({ kind: 'tooLong', value }))
  );
}

function pluginIdCase(): fc.Arbitrary<PluginIdCase> {
  return fc.oneof(
    fc.constant({ kind: 'empty', value: '' }),
    pluginIdString(1, 64).map((value): PluginIdCase => ({ kind: 'valid', value })),
    pluginIdString(65, 84).map((value): PluginIdCase => ({ kind: 'tooLong', value })),
    fc.constant({ kind: 'invalidChars', value: 'plugin.invalid!' })
  );
}

function pluginNameCase(): fc.Arbitrary<StringCase> {
  return fc.oneof(
    fc.constant({ kind: 'empty', value: '' }),
    fieldString(1, 128).map((value): StringCase => ({ kind: 'valid', value })),
    fieldString(129, 148).map((value): StringCase => ({ kind: 'tooLong', value }))
  );
}

function pluginUrlCase(): fc.Arbitrary<PluginUrlCase> {
  return fc.oneof(
    fc.constant({ kind: 'empty', value: '' }),
    urlSegmentString(1, 40).map((segment): PluginUrlCase => ({
      kind: 'valid',
      value: `https://example.com/${segment}`,
    })),
    fc
      .array(fc.constantFrom(...URL_CHARS), { minLength: 500, maxLength: 510 })
      .map((chars): PluginUrlCase => ({
        kind: 'tooLong' as const,
        value: `https://example.com/${chars.join('')}`,
      })),
    fc.constant({ kind: 'invalidFormat', value: 'not-a-url' })
  );
}

function jsonObjectArbitrary() {
  const leaf = fc.oneof(
    fc.string({ maxLength: 24 }),
    fc.integer({ min: -1000, max: 1000 }),
    fc.boolean(),
    fc.constant(null)
  );

  return fc.dictionary(jsonKeyString(2, 12), fc.oneof(leaf, fc.array(leaf, { maxLength: 4 })), {
    maxKeys: 5,
  });
}

function makePermissionRows(length: number) {
  return Array.from({ length }, (_, index) => ({
    id: index + 1,
    role_or_permission: `role-${index + 1}`,
    plugin_name: `plugin-${index + 1}`,
    action: `action-${index + 1}`,
    created_at: '2026-04-12 12:00:00',
    updated_at: '2026-04-12 12:00:01',
  }));
}

function makePluginRows(length: number) {
  return Array.from({ length }, (_, index) => ({
    id: `plugin-${index + 1}`,
    name: `Plugin ${index + 1}`,
    name_i18n: null,
    description: null,
    url: `https://example.com/plugin-${index + 1}`,
    icon: null,
    enabled: 1,
    order: index,
    allowed_origin: null,
    version: '1.0.0',
    organization_name: null,
  }));
}

function expectedPermissionValidation(
  roleOrPermission: StringCase,
  pluginName: StringCase,
  action: StringCase
): string | null {
  if (roleOrPermission.kind === 'empty') {
    return '缺少必要参数: role_or_permission';
  }
  if (roleOrPermission.kind === 'tooLong') {
    return 'role_or_permission 长度不能超过 64';
  }
  if (pluginName.kind === 'empty') {
    return '缺少必要参数: plugin_name';
  }
  if (pluginName.kind === 'tooLong') {
    return 'plugin_name 长度不能超过 128';
  }
  if (action.kind === 'empty') {
    return '缺少必要参数: action';
  }
  if (action.kind === 'tooLong') {
    return 'action 长度不能超过 128';
  }

  return null;
}

function expectedPluginValidation(id: PluginIdCase, name: StringCase, url: PluginUrlCase): string | null {
  if (id.kind === 'empty') {
    return '缺少必要参数: id';
  }
  if (id.kind === 'tooLong') {
    return 'id 长度不能超过 64';
  }
  if (name.kind === 'empty') {
    return '缺少必要参数: name';
  }
  if (name.kind === 'tooLong') {
    return 'name 长度不能超过 128';
  }
  if (url.kind === 'empty') {
    return '缺少必要参数: url';
  }
  if (url.kind === 'tooLong') {
    return 'url 长度不能超过 512';
  }
  if (id.kind === 'invalidChars') {
    return 'id 只能包含字母、数字和连字符';
  }
  if (url.kind === 'invalidFormat') {
    return 'url 格式不合法';
  }

  return null;
}

function installPermissionRoundTripMock() {
  let stored: PermissionRow | null = null;
  const createdAt = '2026-04-12 12:00:00';
  const updatedAt = '2026-04-12 12:30:00';

  pluginPool.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const normalized = normalizeSql(sql);

    if (normalized.startsWith('INSERT INTO plugin_permission_config')) {
      stored = {
        id: 1,
        role_or_permission: String(params[0]),
        plugin_name: String(params[1]),
        action: String(params[2]),
        created_at: createdAt,
        updated_at: null,
      };
      return [{ insertId: 1 }];
    }

    if (
      normalized.startsWith(
        'SELECT id, role_or_permission, plugin_name, action, created_at FROM plugin_permission_config WHERE id = ?'
      )
    ) {
      return [[stored ? { ...stored, updated_at: undefined } : undefined].filter(Boolean)];
    }

    if (
      normalized.startsWith(
        'SELECT id, role_or_permission, plugin_name, action, updated_at FROM plugin_permission_config WHERE id = ?'
      )
    ) {
      return [[stored ? { ...stored, created_at: undefined } : undefined].filter(Boolean)];
    }

    if (normalized.startsWith('UPDATE plugin_permission_config SET')) {
      if (!stored) {
        return [{ affectedRows: 0 }];
      }

      const updateParams = [...params];
      updateParams.pop();

      if (normalized.includes('role_or_permission = ?')) {
        stored.role_or_permission = String(updateParams.shift());
      }
      if (normalized.includes('plugin_name = ?')) {
        stored.plugin_name = String(updateParams.shift());
      }
      if (normalized.includes('action = ?')) {
        stored.action = String(updateParams.shift());
      }
      stored.updated_at = updatedAt;

      return [{ affectedRows: 1 }];
    }

    if (normalized.startsWith('SELECT COUNT(*) AS total FROM plugin_permission_config')) {
      return [[{ total: stored ? 1 : 0 }]];
    }

    if (
      normalized.startsWith(
        'SELECT id, role_or_permission, plugin_name, action, created_at, updated_at FROM plugin_permission_config'
      )
    ) {
      return [stored ? [stored] : []];
    }

    throw new Error(`Unexpected permission query: ${normalized}`);
  });
}

function installPluginListMock() {
  let stored: PluginRow | null = null;

  pluginPool.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const normalized = normalizeSql(sql);

    if (normalized.startsWith('INSERT INTO plugins')) {
      stored = {
        id: String(params[0]),
        name: String(params[1]),
        url: String(params[2]),
        name_i18n: (params[3] ?? null) as string | null,
        description: (params[4] ?? null) as string | null,
        icon: (params[5] ?? null) as string | null,
        enabled: Number(params[6] ?? 1),
        order: Number(params[7] ?? 0),
        allowed_origin: (params[8] ?? null) as string | null,
        version: (params[9] ?? null) as string | null,
        organization_name: (params[10] ?? null) as string | null,
      };
      return [{ affectedRows: 1 }];
    }

    if (normalized.startsWith('SELECT COUNT(*) AS total FROM plugins')) {
      return [[{ total: stored ? 1 : 0 }]];
    }

    if (normalized.startsWith('SELECT * FROM plugins')) {
      return [stored ? [stored] : []];
    }

    throw new Error(`Unexpected plugin query: ${normalized}`);
  });
}

function createPluginRow(
  id: string,
  name: string,
  order: number,
  enabled: number,
  organizationName: string | null
): PluginRow {
  return {
    id,
    name,
    name_i18n: JSON.stringify({ 'en-US': name }),
    description: `${name} description`,
    url: `https://${id}.example.com`,
    icon: null,
    enabled,
    order,
    allowed_origin: `https://${id}.example.com`,
    version: '1.0.0',
    organization_name: organizationName,
  };
}

function makeMockResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

function sortByOrder<T extends { order: number }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => left.order - right.order);
}

describe('property tests', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    pluginPool.query.mockReset();
  });

  it('Feature: system-admin-db-decoupling, Property 1: 分页不变量（permissions）', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 50 }),
        async (total, page, perPage) => {
          pluginPool.query.mockReset();
          const rows = makePermissionRows(expectedPageLength(total, page, perPage));

          pluginPool.query
            .mockResolvedValueOnce([[{ total }]])
            .mockResolvedValueOnce([rows]);

          const response = makeMockResponse();
          await listPermissionsController(
            {
              query: {
                page,
                per_page: perPage,
              },
            } as never,
            response as never
          );

          const payload = response.body as {
            data: {
              items: PermissionRow[];
              total: number;
              page: number;
              per_page: number;
            };
          };

          expect(response.statusCode).toBe(200);
          expect(payload.data.items).toHaveLength(rows.length);
          expect(payload.data.items.length).toBeLessThanOrEqual(perPage);
          expect(Number.isInteger(payload.data.total)).toBe(true);
          expect(payload.data.total).toBeGreaterThanOrEqual(0);
          expect(payload.data.page).toBe(page);
          expect(payload.data.per_page).toBe(perPage);

          if ((page - 1) * perPage < total) {
            expect(payload.data.items.length).toBeGreaterThan(0);
          } else {
            expect(payload.data.items.length).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: system-admin-db-decoupling, Property 1: 分页不变量（plugins）', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 50 }),
        async (total, page, perPage) => {
          pluginPool.query.mockReset();
          const rows = makePluginRows(expectedPageLength(total, page, perPage));

          pluginPool.query
            .mockResolvedValueOnce([[{ total }]])
            .mockResolvedValueOnce([rows]);

          const response = makeMockResponse();
          await listPluginsController(
            {
              query: {
                page,
                per_page: perPage,
              },
            } as never,
            response as never
          );

          const payload = response.body as {
            data: {
              items: PluginRow[];
              total: number;
              page: number;
              per_page: number;
            };
          };

          expect(response.statusCode).toBe(200);
          expect(payload.data.items).toHaveLength(rows.length);
          expect(payload.data.items.length).toBeLessThanOrEqual(perPage);
          expect(Number.isInteger(payload.data.total)).toBe(true);
          expect(payload.data.total).toBeGreaterThanOrEqual(0);
          expect(payload.data.page).toBe(page);
          expect(payload.data.per_page).toBe(perPage);

          if ((page - 1) * perPage < total) {
            expect(payload.data.items.length).toBeGreaterThan(0);
          } else {
            expect(payload.data.items.length).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: system-admin-db-decoupling, Property 2: 权限配置输入验证', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionFieldCase(64),
        permissionFieldCase(128),
        permissionFieldCase(128),
        async (roleOrPermission, pluginName, action) => {
          pluginPool.query.mockReset();
          const expectedMessage = expectedPermissionValidation(roleOrPermission, pluginName, action);

          if (!expectedMessage) {
            pluginPool.query
              .mockResolvedValueOnce([{ insertId: 1 }])
              .mockResolvedValueOnce([
                [
                  {
                    id: 1,
                    role_or_permission: roleOrPermission.value,
                    plugin_name: pluginName.value,
                    action: action.value,
                    created_at: '2026-04-12 12:00:00',
                  },
                ],
              ]);
          }

          const response = makeMockResponse();
          await createPermissionController(
            {
              body: {
                role_or_permission: roleOrPermission.value,
                plugin_name: pluginName.value,
                action: action.value,
              },
            } as never,
            response as never
          );

          if (expectedMessage) {
            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
              code: 4001,
              message: expectedMessage,
            });
            expect(pluginPool.query).not.toHaveBeenCalled();
          } else {
            expect(response.statusCode).toBe(200);
            expect((response.body as { data: PermissionRow }).data).toMatchObject({
              id: 1,
              role_or_permission: roleOrPermission.value,
              plugin_name: pluginName.value,
              action: action.value,
            });
            expect(pluginPool.query).toHaveBeenCalledTimes(2);
          }
        }
      ),
      { numRuns: 60 }
    );
  });

  it('Feature: system-admin-db-decoupling, Property 3: 插件注册输入验证', async () => {
    await fc.assert(
      fc.asyncProperty(pluginIdCase(), pluginNameCase(), pluginUrlCase(), async (id, name, url) => {
        pluginPool.query.mockReset();
        const expectedMessage = expectedPluginValidation(id, name, url);

        if (!expectedMessage) {
          pluginPool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        }

        const response = makeMockResponse();
        await createPluginController(
          {
            body: {
              id: id.value,
              name: name.value,
              url: url.value,
            },
          } as never,
          response as never
        );

        if (expectedMessage) {
          expect(response.statusCode).toBe(400);
          expect(response.body).toEqual({
            code: 4001,
            message: expectedMessage,
          });
          expect(pluginPool.query).not.toHaveBeenCalled();
        } else {
          expect(response.statusCode).toBe(200);
          expect((response.body as { data: PluginRow }).data).toMatchObject({
            id: id.value,
            name: name.value,
            url: url.value,
          });
          expect(pluginPool.query).toHaveBeenCalledTimes(1);
        }
      }),
      { numRuns: 60 }
    );
  });

  it('Feature: system-admin-db-decoupling, Property 4: CRUD round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          role_or_permission: fieldString(1, 32),
          plugin_name: fieldString(1, 32),
          action: fieldString(1, 32),
        }),
        fc.record({
          role_or_permission: fieldString(1, 32),
          plugin_name: fieldString(1, 32),
          action: fieldString(1, 32),
        }),
        async (created, updated) => {
          pluginPool.query.mockReset();
          installPermissionRoundTripMock();
          const createResponse = makeMockResponse();
          await createPermissionController(
            {
              body: created,
            } as never,
            createResponse as never
          );

          expect(createResponse.statusCode).toBe(200);
          expect((createResponse.body as { data: PermissionRow }).data).toMatchObject({
            id: 1,
            ...created,
          });

          const firstListResponse = makeMockResponse();
          await listPermissionsController(
            {
              query: {},
            } as never,
            firstListResponse as never
          );

          expect(firstListResponse.statusCode).toBe(200);
          expect((firstListResponse.body as { data: { total: number; page: number; per_page: number } }).data).toMatchObject({
            total: 1,
            page: 1,
            per_page: 20,
          });
          expect(
            (firstListResponse.body as { data: { items: PermissionRow[] } }).data.items[0]
          ).toMatchObject(created);

          const updateResponse = makeMockResponse();
          await updatePermissionController(
            {
              body: {
                id: 1,
                ...updated,
              },
            } as never,
            updateResponse as never
          );

          expect(updateResponse.statusCode).toBe(200);
          expect((updateResponse.body as { data: PermissionRow }).data).toMatchObject({
            id: 1,
            ...updated,
          });

          const secondListResponse = makeMockResponse();
          await listPermissionsController(
            {
              query: {},
            } as never,
            secondListResponse as never
          );

          expect(secondListResponse.statusCode).toBe(200);
          expect((secondListResponse.body as { data: { items: PermissionRow[] } }).data.items).toHaveLength(1);
          expect(
            (secondListResponse.body as { data: { items: PermissionRow[] } }).data.items[0]
          ).toMatchObject(updated);
        }
      ),
      { numRuns: 40 }
    );
  });

  it('Feature: system-admin-db-decoupling, Property 5: JSON 字段 round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        pluginIdString(1, 24),
        fieldString(1, 32),
        jsonObjectArbitrary(),
        async (id, name, nameI18n) => {
          pluginPool.query.mockReset();
          installPluginListMock();

          const createResponse = makeMockResponse();
          await createPluginController(
            {
              body: {
                id,
                name,
                url: `https://example.com/${id}`,
                name_i18n: nameI18n,
              },
            } as never,
            createResponse as never
          );

          expect(createResponse.statusCode).toBe(200);
          const listResponse = makeMockResponse();
          await listPluginsController(
            {
              query: {},
            } as never,
            listResponse as never
          );

          expect(listResponse.statusCode).toBe(200);
          expect((listResponse.body as { data: { items: PluginRow[] } }).data.items).toHaveLength(1);
          expect((listResponse.body as { data: { items: PluginRow[] } }).data.items[0].id).toBe(id);
          expect((listResponse.body as { data: { items: PluginRow[] } }).data.items[0].name).toBe(name);
          expect(
            JSON.parse(
              (listResponse.body as { data: { items: PluginRow[] } }).data.items[0].name_i18n ?? 'null'
            )
          ).toEqual(nameI18n);
        }
      ),
      { numRuns: 40 }
    );
  });

  it('Feature: system-admin-db-decoupling, Property 7: 响应信封格式不变量', () => {
    fc.assert(
      fc.property(
        fc.jsonValue(),
        fc.integer({ min: 1, max: 9999 }),
        fc.string({ minLength: 1, maxLength: 64 }),
        (payload, code, message) => {
          const successEnvelope = success(payload);
          const paginatedEnvelope = paginated(
            Array.isArray(payload) ? payload : [payload],
            Math.max(0, code - 1),
            1,
            Math.max(1, code % 20 || 1)
          );
          const errorEnvelope = error(code, message, payload);

          expect(successEnvelope).toMatchObject({
            code: 0,
            message: 'ok',
          });
          expect(successEnvelope).toHaveProperty('data');

          expect(paginatedEnvelope).toMatchObject({
            code: 0,
            message: 'ok',
          });
          expect(paginatedEnvelope).toHaveProperty('data');

          expect(errorEnvelope.code).toBeGreaterThan(0);
          expect(errorEnvelope.message).toBeTruthy();
          expect(errorEnvelope).not.toHaveProperty('data');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: system-admin-db-decoupling, Property 8: 权限查询一致性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.constantFrom(...ROLES), { maxLength: ROLES.length }),
        fc.array(fc.uniqueArray(fieldString(1, 12), { minLength: 1, maxLength: 4 }), {
          maxLength: 4,
        }),
        fieldString(1, 12),
        async (roles, actionSets, requestedAction) => {
          mockedAxios.get.mockReset();
          pluginPool.query.mockReset();
          mockedAxios.get.mockResolvedValue({
            data: {
              code: 0,
              message: 'ok',
              data: {
                id: 9,
                username: 'alice',
                roles,
              },
            },
          } as never);

          const permissionRows = actionSets.map((actions) => ({
            action: actions.join(', '),
          }));
          pluginPool.query.mockResolvedValue([permissionRows]);

          const checkResponse = makeMockResponse();
          await checkPermissionController(
            {
              query: {
                plugin_name: 'user-management',
                action: requestedAction,
              },
              user: {
                userId: 9,
                roles,
              },
            } as never,
            checkResponse as never
          );

          const allowedActionsResponse = makeMockResponse();
          await allowedActionsController(
            {
              query: {
                plugin_name: 'user-management',
              },
              user: {
                userId: 9,
                roles,
              },
            } as never,
            allowedActionsResponse as never
          );

          const expectedAllowed =
            roles.includes('root') ||
            (roles.length > 0 && actionSets.some((actions) => actions.includes(requestedAction)));
          const expectedActions = roles.includes('root')
            ? ['*']
            : roles.length === 0
              ? []
              : Array.from(new Set(actionSets.flat()));

          expect(checkResponse.statusCode).toBe(200);
          expect(checkResponse.body).toEqual({
            code: 0,
            message: 'ok',
            data: {
              allowed: expectedAllowed,
              user_id: 9,
              roles,
            },
          });

          expect(allowedActionsResponse.statusCode).toBe(200);
          expect(allowedActionsResponse.body).toEqual({
            code: 0,
            message: 'ok',
            data: {
              actions: expectedActions,
              user_id: 9,
              roles,
            },
          });

          const expectedQueryCount = roles.includes('root') || roles.length === 0 ? 0 : 2;
          expect(pluginPool.query).toHaveBeenCalledTimes(expectedQueryCount);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Feature: system-admin-db-decoupling, Property 9: list 端点组织可见性不变量', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(
          fc.record({
            id: pluginIdString(1, 12),
            name: fieldString(1, 24),
            order: fc.integer({ min: -20, max: 20 }),
            enabled: fc.integer({ min: 0, max: 1 }),
          }),
          { selector: (row) => row.id, maxLength: 6 }
        ),
        fc.uniqueArray(
          fc.record({
            id: pluginIdString(1, 12),
            name: fieldString(1, 24),
            order: fc.integer({ min: -20, max: 20 }),
            enabled: fc.integer({ min: 0, max: 1 }),
          }),
          { selector: (row) => row.id, maxLength: 6 }
        ),
        async (publicPluginsInput, organizationPluginsInput) => {
          pluginPool.query.mockReset();
          mockedAxios.get.mockReset();
          mockedAxios.get.mockResolvedValue({
            data: {
              code: 0,
              message: 'ok',
              data: {
                id: 9,
                username: 'alice',
                roles: ['admin'],
                organizations: [
                  {
                    id: 2,
                    name: ORGANIZATION_NAME,
                    title: ORGANIZATION_TITLE,
                  },
                ],
              },
            },
          } as never);

          const publicPlugins = publicPluginsInput.map((row) =>
            createPluginRow(row.id, row.name, row.order, row.enabled, null)
          );
          const organizationPlugins = organizationPluginsInput.map((row) =>
            createPluginRow(row.id, row.name, row.order, row.enabled, ORGANIZATION_NAME)
          );

          pluginPool.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            const normalized = normalizeSql(sql);

            if (
              normalized.startsWith(
                'SELECT * FROM plugins WHERE enabled = 1 AND (organization_name IS NULL OR organization_name IN (?)) ORDER BY `order` ASC'
              )
            ) {
              expect(params).toEqual([ORGANIZATION_NAME]);
              return [sortByOrder([
                ...publicPlugins.filter((plugin) => plugin.enabled === 1),
                ...organizationPlugins.filter((plugin) => plugin.enabled === 1),
              ])];
            }

            throw new Error(`Unexpected public list query: ${normalized}`);
          });

          const response = makeMockResponse();
          await publicListController(
            {
              headers: {
                authorization: 'Bearer token',
              },
            } as never,
            response as never
          );

          expect(response.statusCode).toBe(200);

          const responseBody = response.body as {
            menuGroups: Array<{
              id: string;
              name: string;
              nameI18n: Record<string, string> | null;
              icon: string | null;
              order: number;
            }>;
            plugins: Array<{
              id: string;
              name: string;
              nameI18n: Record<string, string> | null;
              group: string;
              enabled: boolean;
              order: number;
              url: string;
              allowedOrigin: string | null;
              version: string | null;
            }>;
          };
          const responseGroupIds = responseBody.menuGroups.map((group) => group.id);
          expect(new Set(responseGroupIds).size).toBe(responseGroupIds.length);
          expect(responseBody.menuGroups).toEqual([
            {
              id: 'org:public',
              name: '公共插件',
              nameI18n: null,
              icon: 'Grid',
              order: 0,
            },
            {
              id: `org:${ORGANIZATION_NAME}`,
              name: ORGANIZATION_TITLE,
              nameI18n: null,
              icon: 'OfficeBuilding',
              order: 1,
            },
          ]);

          const responsePlugins = responseBody.plugins;
          const responsePluginIds = responsePlugins.map((plugin) => plugin.id);
          expect(new Set(responsePluginIds).size).toBe(responsePluginIds.length);
          expect(responsePlugins.every((plugin) => plugin.enabled)).toBe(true);

          const expectedPlugins = new Map<string, PluginRow>();
          for (const plugin of sortByOrder(publicPlugins.filter((row) => row.enabled === 1))) {
            expectedPlugins.set(plugin.id, plugin);
          }
          for (const plugin of sortByOrder(organizationPlugins.filter((row) => row.enabled === 1))) {
            expectedPlugins.set(plugin.id, plugin);
          }

          expect(new Set(responsePluginIds)).toEqual(new Set(expectedPlugins.keys()));
          for (const plugin of responsePlugins) {
            const expected = expectedPlugins.get(plugin.id);
            expect(expected).toBeDefined();
            expect(plugin.name).toBe(expected?.name);
            expect(plugin.nameI18n).toEqual(
              expected ? JSON.parse(expected.name_i18n ?? 'null') : null
            );
            expect(plugin.url).toBe(expected?.url);
            expect(plugin.allowedOrigin).toBe(expected?.allowed_origin ?? null);
            expect(plugin.version).toBe(expected?.version ?? null);
            expect(plugin.order).toBe(expected?.order);
            expect(plugin.group).toBe(
              expected?.organization_name ? `org:${expected.organization_name}` : 'org:public'
            );
          }
        }
      ),
      { numRuns: 40 }
    );
  });
});
