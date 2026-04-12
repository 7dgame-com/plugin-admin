import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const entrypoint = readFileSync(resolve(process.cwd(), 'docker-entrypoint.sh'), 'utf8')

describe('docker entrypoint nginx generation', () => {
  it('uses direct upstreams for single-backend proxies', () => {
    expect(entrypoint).toContain('Mode: single backend (direct upstream)')
    expect(entrypoint).toContain('proxy_pass ${url};')
    expect(entrypoint).not.toContain('set \\$${PREFIX_NAME}_single_backend')
  })

  it('defaults resolver to Docker DNS', () => {
    expect(entrypoint).toContain('APP_RESOLVER:-127.0.0.11')
  })

  it('generates both main-platform /api and system-admin /backend upstream blocks', () => {
    expect(entrypoint).toContain('generate_lb_config "APP_API" "/api/" "api"')
    expect(entrypoint).toContain('generate_lb_config "APP_BACKEND" "/backend/" "backend"')
  })
})
