import { ref, readonly } from 'vue'
import { pluginApi } from '../api'

export interface Permissions {
  'manage-permissions': boolean
  'manage-plugins': boolean
}

const permissions = ref<Permissions>({
  'manage-permissions': false,
  'manage-plugins': false,
})

const loaded = ref(false)
const loading = ref(false)

export function usePermissions() {
  async function fetchPermissions() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const { data } = await pluginApi.get('/allowed-actions', {
        params: { plugin_name: 'system-admin' }
      })
      if (data.code === 0) {
        const allowedActions: string[] = data.data?.actions || []
        const allActions: (keyof Permissions)[] = [
          'manage-permissions',
          'manage-plugins',
        ]
        const hasWildcard = allowedActions.includes('*')
        allActions.forEach((a) => {
          permissions.value[a] = hasWildcard || allowedActions.includes(a)
        })
      }
      loaded.value = true
    } catch {
      // 权限获取失败时保持默认（全部 false）
    } finally {
      loading.value = false
    }
  }

  function can(action: keyof Permissions): boolean {
    return permissions.value[action]
  }

  function hasAny(): boolean {
    return Object.values(permissions.value).some(Boolean)
  }

  return {
    permissions: readonly(permissions),
    loaded: readonly(loaded),
    loading: readonly(loading),
    fetchPermissions,
    can,
    hasAny,
  }
}
