const bearerSecurity = [{ BearerAuth: [] }];

const jsonContent = (schema: Record<string, unknown>) => ({
  'application/json': {
    schema,
  },
});

const okResponse = (description: string, schemaRef: string) => ({
  description,
  content: jsonContent({ $ref: schemaRef }),
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' }),
});

const jsonStringMapSchema = {
  type: 'object',
  additionalProperties: { type: 'string' },
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'System Admin Backend API',
    version: '1.0.0',
    description: 'Swagger documentation for the system-admin backend service.',
  },
  servers: [
    {
      url: '/',
      description: 'Current server',
    },
  ],
  tags: [
    { name: 'System', description: 'System-level endpoints' },
    { name: 'Permission Admin', description: 'Permission management endpoints' },
    { name: 'Plugin Admin', description: 'Plugin management endpoints' },
    { name: 'Public Plugin API', description: 'Public plugin helper endpoints' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Check backend and plugin database health',
        responses: {
          '200': okResponse('Backend is healthy', '#/components/schemas/HealthResponse'),
          '500': errorResponse('Database connectivity failed'),
        },
      },
    },
    '/api/v1/plugin-admin/permissions': {
      get: {
        tags: ['Permission Admin'],
        summary: 'List permission rules',
        security: bearerSecurity,
        parameters: [
          { in: 'query', name: 'role_or_permission', schema: { type: 'string' } },
          { in: 'query', name: 'plugin_name', schema: { type: 'string' } },
          { in: 'query', name: 'action', schema: { type: 'string' } },
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
          { in: 'query', name: 'per_page', schema: { type: 'integer', minimum: 1, default: 20 } },
        ],
        responses: {
          '200': okResponse('Permission rules', '#/components/schemas/PermissionListResponse'),
          '401': errorResponse('Missing or invalid bearer token'),
          '403': errorResponse('Permission denied'),
          '500': errorResponse('Database query failed'),
        },
      },
    },
    '/api/v1/plugin-admin/create-permission': {
      post: {
        tags: ['Permission Admin'],
        summary: 'Create a permission rule',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({ $ref: '#/components/schemas/CreatePermissionRequest' }),
        },
        responses: {
          '200': okResponse('Permission created', '#/components/schemas/PermissionMutationResponse'),
          '400': errorResponse('Validation failed'),
          '401': errorResponse('Missing or invalid bearer token'),
          '403': errorResponse('Permission denied'),
          '422': errorResponse('Duplicate permission rule'),
          '500': errorResponse('Database write failed'),
        },
      },
    },
    '/api/v1/plugin-admin/update-permission': {
      put: {
        tags: ['Permission Admin'],
        summary: 'Update a permission rule',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({ $ref: '#/components/schemas/UpdatePermissionRequest' }),
        },
        responses: {
          '200': okResponse('Permission updated', '#/components/schemas/PermissionMutationResponse'),
          '400': errorResponse('Validation failed'),
          '401': errorResponse('Missing or invalid bearer token'),
          '403': errorResponse('Permission denied'),
          '404': errorResponse('Permission record not found'),
          '422': errorResponse('Duplicate permission rule'),
          '500': errorResponse('Database write failed'),
        },
      },
    },
    '/api/v1/plugin-admin/delete-permission': {
      post: {
        tags: ['Permission Admin'],
        summary: 'Delete a permission rule',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({ $ref: '#/components/schemas/DeletePermissionRequest' }),
        },
        responses: {
          '200': okResponse('Permission deleted', '#/components/schemas/GenericSuccessResponse'),
          '400': errorResponse('Validation failed'),
          '401': errorResponse('Missing or invalid bearer token'),
          '403': errorResponse('Permission denied'),
          '404': errorResponse('Permission record not found'),
          '500': errorResponse('Database delete failed'),
        },
      },
    },
    '/api/v1/plugin-admin/plugins': {
      get: {
        tags: ['Plugin Admin'],
        summary: 'List plugin records',
        security: bearerSecurity,
        parameters: [
          { in: 'query', name: 'organization_name', schema: { type: 'string' } },
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
          { in: 'query', name: 'per_page', schema: { type: 'integer', minimum: 1, default: 20 } },
        ],
        responses: {
          '200': okResponse('Plugin records', '#/components/schemas/PluginListResponse'),
          '401': errorResponse('Missing or invalid bearer token'),
          '403': errorResponse('Permission denied'),
          '500': errorResponse('Database query failed'),
        },
      },
    },
    '/api/v1/plugin-admin/create-plugin': {
      post: {
        tags: ['Plugin Admin'],
        summary: 'Create a plugin record',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({ $ref: '#/components/schemas/CreatePluginRequest' }),
        },
        responses: {
          '200': okResponse('Plugin created', '#/components/schemas/PluginMutationResponse'),
          '400': errorResponse('Validation failed'),
          '401': errorResponse('Missing or invalid bearer token'),
          '403': errorResponse('Permission denied'),
          '422': errorResponse('Duplicate plugin id'),
          '500': errorResponse('Database write failed'),
        },
      },
    },
    '/api/v1/plugin-admin/update-plugin': {
      put: {
        tags: ['Plugin Admin'],
        summary: 'Update a plugin record',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({ $ref: '#/components/schemas/UpdatePluginRequest' }),
        },
        responses: {
          '200': okResponse('Plugin updated', '#/components/schemas/PluginMutationResponse'),
          '400': errorResponse('Validation failed'),
          '401': errorResponse('Missing or invalid bearer token'),
          '403': errorResponse('Permission denied'),
          '404': errorResponse('Plugin record not found'),
          '422': errorResponse('Duplicate plugin id'),
          '500': errorResponse('Database write failed'),
        },
      },
    },
    '/api/v1/plugin-admin/delete-plugin': {
      post: {
        tags: ['Plugin Admin'],
        summary: 'Delete a plugin record',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({ $ref: '#/components/schemas/DeletePluginRequest' }),
        },
        responses: {
          '200': okResponse('Plugin deleted', '#/components/schemas/GenericSuccessResponse'),
          '400': errorResponse('Validation failed'),
          '401': errorResponse('Missing or invalid bearer token'),
          '403': errorResponse('Permission denied'),
          '404': errorResponse('Plugin record not found'),
          '500': errorResponse('Database delete failed'),
        },
      },
    },
    '/api/v1/plugin/check-permission': {
      get: {
        tags: ['Public Plugin API'],
        summary: 'Check whether the current user can perform a plugin action',
        security: bearerSecurity,
        parameters: [
          { in: 'query', name: 'plugin_name', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'action', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': okResponse('Permission result', '#/components/schemas/CheckPermissionResponse'),
          '400': errorResponse('Validation failed'),
          '401': errorResponse('Missing or invalid bearer token'),
        },
      },
    },
    '/api/v1/plugin/allowed-actions': {
      get: {
        tags: ['Public Plugin API'],
        summary: 'List actions available to the current user for one plugin',
        security: bearerSecurity,
        parameters: [
          { in: 'query', name: 'plugin_name', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': okResponse('Allowed action list', '#/components/schemas/AllowedActionsResponse'),
          '400': errorResponse('Validation failed'),
          '401': errorResponse('Missing or invalid bearer token'),
        },
      },
    },
    '/api/v1/plugin/list': {
      get: {
        tags: ['Public Plugin API'],
        summary: 'List public plugin menu groups and enabled plugins',
        responses: {
          '200': okResponse('Public plugin list', '#/components/schemas/PublicPluginListResponse'),
          '500': errorResponse('Database query failed'),
        },
      },
    },
    '/api/v1/plugin/verify-token': {
      get: {
        tags: ['Public Plugin API'],
        summary: 'Proxy token verification to the main API service',
        responses: {
          '200': {
            description: 'Verification result proxied from the main API',
            content: jsonContent({
              type: 'object',
              additionalProperties: true,
            }),
          },
          '401': errorResponse('Token invalid'),
          '502': errorResponse('Main API request failed'),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'integer' },
          message: { type: 'string' },
        },
      },
      GenericSuccessResponse: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'integer', example: 0 },
          message: { type: 'string', example: 'ok' },
          data: {
            nullable: true,
          },
        },
      },
      HealthResponse: {
        type: 'object',
        required: ['code', 'message', 'data'],
        properties: {
          code: { type: 'integer', example: 0 },
          message: { type: 'string', example: 'ok' },
          data: {
            type: 'object',
            required: ['status'],
            properties: {
              status: { type: 'string', example: 'ok' },
            },
          },
        },
      },
      PermissionItem: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          role_or_permission: { type: 'string' },
          plugin_name: { type: 'string' },
          action: { type: 'string' },
          created_at: { type: 'string', nullable: true },
          updated_at: { type: 'string', nullable: true },
        },
      },
      PermissionListResponse: {
        type: 'object',
        required: ['code', 'message', 'data'],
        properties: {
          code: { type: 'integer', example: 0 },
          message: { type: 'string', example: 'ok' },
          data: {
            type: 'object',
            required: ['items', 'total', 'page', 'per_page'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/PermissionItem' },
              },
              total: { type: 'integer' },
              page: { type: 'integer' },
              per_page: { type: 'integer' },
            },
          },
        },
      },
      PermissionMutationResponse: {
        type: 'object',
        required: ['code', 'message', 'data'],
        properties: {
          code: { type: 'integer', example: 0 },
          message: { type: 'string', example: 'ok' },
          data: { $ref: '#/components/schemas/PermissionItem' },
        },
      },
      CreatePermissionRequest: {
        type: 'object',
        required: ['role_or_permission', 'plugin_name', 'action'],
        properties: {
          role_or_permission: { type: 'string', maxLength: 64 },
          plugin_name: { type: 'string', maxLength: 128 },
          action: { type: 'string', maxLength: 128 },
        },
      },
      UpdatePermissionRequest: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer', minimum: 1 },
          role_or_permission: { type: 'string', maxLength: 64 },
          plugin_name: { type: 'string', maxLength: 128 },
          action: { type: 'string', maxLength: 128 },
        },
      },
      DeletePermissionRequest: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer', minimum: 1 },
        },
      },
      PluginItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          name_i18n: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          url: { type: 'string', format: 'uri' },
          icon: { type: 'string', nullable: true },
          enabled: { type: 'integer' },
          order: { type: 'integer' },
          allowed_origin: { type: 'string', nullable: true },
          version: { type: 'string', nullable: true },
          organization_name: { type: 'string', nullable: true },
          created_at: { type: 'string', nullable: true },
          updated_at: { type: 'string', nullable: true },
        },
      },
      PluginListResponse: {
        type: 'object',
        required: ['code', 'message', 'data'],
        properties: {
          code: { type: 'integer', example: 0 },
          message: { type: 'string', example: 'ok' },
          data: {
            type: 'object',
            required: ['items', 'total', 'page', 'per_page'],
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/PluginItem' },
              },
              total: { type: 'integer' },
              page: { type: 'integer' },
              per_page: { type: 'integer' },
            },
          },
        },
      },
      PluginMutationResponse: {
        type: 'object',
        required: ['code', 'message', 'data'],
        properties: {
          code: { type: 'integer', example: 0 },
          message: { type: 'string', example: 'ok' },
          data: { $ref: '#/components/schemas/PluginItem' },
        },
      },
      CreatePluginRequest: {
        type: 'object',
        required: ['id', 'name', 'url'],
        properties: {
          id: { type: 'string', maxLength: 64 },
          name: { type: 'string', maxLength: 128 },
          url: { type: 'string', format: 'uri', maxLength: 512 },
          name_i18n: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          icon: { type: 'string', nullable: true },
          enabled: { type: 'integer' },
          order: { type: 'integer' },
          allowed_origin: { type: 'string', nullable: true },
          version: { type: 'string', nullable: true },
          organization_name: { type: 'string', nullable: true },
        },
      },
      UpdatePluginRequest: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', maxLength: 64 },
          name: { type: 'string', maxLength: 128 },
          url: { type: 'string', format: 'uri', maxLength: 512 },
          name_i18n: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          icon: { type: 'string', nullable: true },
          enabled: { type: 'integer' },
          order: { type: 'integer' },
          allowed_origin: { type: 'string', nullable: true },
          version: { type: 'string', nullable: true },
          organization_name: { type: 'string', nullable: true },
        },
      },
      DeletePluginRequest: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', maxLength: 64 },
        },
      },
      CheckPermissionResponse: {
        type: 'object',
        required: ['code', 'message', 'data'],
        properties: {
          code: { type: 'integer', example: 0 },
          message: { type: 'string', example: 'ok' },
          data: {
            type: 'object',
            required: ['allowed', 'user_id', 'roles'],
            properties: {
              allowed: { type: 'boolean' },
              user_id: { type: 'integer' },
              roles: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
      AllowedActionsResponse: {
        type: 'object',
        required: ['code', 'message', 'data'],
        properties: {
          code: { type: 'integer', example: 0 },
          message: { type: 'string', example: 'ok' },
          data: {
            type: 'object',
            required: ['actions', 'user_id', 'roles'],
            properties: {
              actions: {
                type: 'array',
                items: { type: 'string' },
              },
              user_id: { type: 'integer' },
              roles: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
      PublicMenuGroupItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          nameI18n: jsonStringMapSchema,
          icon: { type: 'string', nullable: true },
          order: { type: 'integer' },
        },
      },
      PublicPluginItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          nameI18n: jsonStringMapSchema,
          description: { type: 'string', nullable: true },
          url: { type: 'string', format: 'uri' },
          icon: { type: 'string', nullable: true },
          group: { type: 'string', nullable: true },
          enabled: { type: 'boolean' },
          order: { type: 'integer' },
          allowedOrigin: { type: 'string', nullable: true },
          version: { type: 'string', nullable: true },
        },
      },
      PublicPluginListResponse: {
        type: 'object',
        required: ['version', 'menuGroups', 'plugins'],
        properties: {
          version: { type: 'string' },
          menuGroups: {
            type: 'array',
            items: { $ref: '#/components/schemas/PublicMenuGroupItem' },
          },
          plugins: {
            type: 'array',
            items: { $ref: '#/components/schemas/PublicPluginItem' },
          },
        },
      },
    },
  },
};
