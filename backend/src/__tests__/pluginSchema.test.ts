jest.mock('../db/pluginDb', () => ({
  pluginPool: {
    query: jest.fn(),
  },
}));

import { ensurePluginSchemaColumns, resetPluginSchemaCacheForTests } from '../db/pluginSchema';

const { pluginPool } = jest.requireMock('../db/pluginDb') as {
  pluginPool: {
    query: jest.Mock;
  };
};

describe('plugin schema repair', () => {
  beforeEach(() => {
    pluginPool.query.mockReset();
    resetPluginSchemaCacheForTests();
  });

  it('adds missing plugin visibility and organization columns before serving requests', async () => {
    pluginPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    await ensurePluginSchemaColumns();

    expect(pluginPool.query).toHaveBeenNthCalledWith(
      1,
      "SHOW COLUMNS FROM plugins LIKE 'access_scope'"
    );
    expect(pluginPool.query).toHaveBeenNthCalledWith(
      2,
      "SHOW COLUMNS FROM plugins LIKE 'organization_name'"
    );
    expect(pluginPool.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('ADD COLUMN `access_scope`')
    );
    expect(pluginPool.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('ADD COLUMN `organization_name`')
    );
  });
});
