import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const entrypoint = readFileSync(resolve(process.cwd(), 'docker-entrypoint.sh'), 'utf8')
const nginxTemplate = readFileSync(resolve(process.cwd(), 'nginx.conf.template'), 'utf8')

describe('docker entrypoint nginx generation', () => {
  it('uses direct upstreams for single-backend proxies', () => {
    expect(entrypoint).toContain('Mode: single backend (direct upstream)')
    expect(entrypoint).toContain('proxy_pass ${url};')
    expect(entrypoint).not.toContain('set \\$${PREFIX_NAME}_single_backend')
  })

  it('defaults resolver to Docker DNS', () => {
    expect(entrypoint).toContain('APP_RESOLVER:-127.0.0.11')
  })

  it('generates main-platform, identity, and system-admin upstream blocks', () => {
    expect(entrypoint).toContain('generate_lb_config "APP_API" "/api/" "api"')
    expect(entrypoint).toContain('generate_lb_config "APP_AUTH" "/api-auth/" "auth"')
    expect(entrypoint).toContain('generate_lb_config "APP_BACKEND" "/backend/" "backend"')
    expect(entrypoint).toContain('${ENV_PREFIX}_${i}_URL')
  })

  it('does not generate a runtime topology debug file', () => {
    expect(entrypoint).not.toContain('DEBUG_LIST=')
    expect(entrypoint).toContain('rm -f /usr/share/nginx/html/debug-env.json')
    expect(nginxTemplate).toMatch(/location = \/debug-env \{[\s\S]*?return 404;/)
    expect(nginxTemplate).toMatch(/location = \/debug-env\.json \{[\s\S]*?return 404;/)
    expect(nginxTemplate).toMatch(/location = \/api-diagnostics \{[\s\S]*?return 404;/)
    expect(nginxTemplate).toMatch(/location = \/api-diagnostics\/ \{[\s\S]*?return 404;/)
  })
})
