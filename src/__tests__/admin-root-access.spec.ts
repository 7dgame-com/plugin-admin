import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('system-admin root-only wiring', () => {
  it('marks admin routes as root-only and removes permission-based route guards', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../router/index.ts'), 'utf8')

    expect(source).toContain('requiresRoot: true')
    expect(source).toContain('to.meta.requiresRoot')
    expect(source).toContain('fetchSession')
    expect(source).not.toContain('requiresPermission')
    expect(source).not.toContain('usePermissions')
    expect(source).toContain("name: 'NotAllowed'")
  })

  it('renders navigation from root session state instead of plugin permission actions', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../layout/AppLayout.vue'), 'utf8')

    expect(source).toContain('isRootUser')
    expect(source).toContain('<router-link')
    expect(source).not.toContain("can('manage-permissions')")
    expect(source).not.toContain("can('manage-plugins')")
    expect(source).not.toContain("can('manage-organizations')")
    expect(source).not.toContain('fetchPermissions')
    expect(source).not.toContain('usePermissions')
  })

  it('removes the obsolete permission configuration UI route and navigation', () => {
    const routerSource = fs.readFileSync(path.resolve(__dirname, '../router/index.ts'), 'utf8')
    const layoutSource = fs.readFileSync(path.resolve(__dirname, '../layout/AppLayout.vue'), 'utf8')

    expect(routerSource).not.toContain('/permissions')
    expect(routerSource).not.toContain('PermissionList')
    expect(layoutSource).not.toContain('/permissions')
    expect(layoutSource).not.toContain('permission.title')
  })
})
