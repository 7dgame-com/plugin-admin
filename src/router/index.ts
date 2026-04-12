import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { usePermissions } from '../composables/usePermissions'
import i18n from '../i18n'
import { getRuntimeMode, getToken } from '../utils/token'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    public?: boolean
    requiresPermission?: string
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: '登录', public: true }
    },
    {
      path: '/not-allowed',
      name: 'NotAllowed',
      component: () => import('../views/NotAllowed.vue'),
      meta: { title: '禁止访问', public: true }
    },
    {
      path: '/api-diagnostics',
      name: 'ApiDiagnostics',
      component: () => import('../views/ApiDiagnostics.vue'),
      meta: { title: 'API 诊断', public: true }
    },
    {
      path: '/',
      component: () => import('../layout/AppLayout.vue'),
      redirect: '/permissions',
      children: [
        {
          path: 'permissions',
          name: 'PermissionList',
          component: () => import('../views/PermissionList.vue'),
          meta: { title: '插件权限管理', requiresPermission: 'manage-permissions' }
        },
        {
          path: 'plugins',
          name: 'PluginList',
          component: () => import('../views/PluginList.vue'),
          meta: { title: '插件注册管理', requiresPermission: 'manage-plugins' }
        },
        {
          path: 'menu-groups',
          name: 'MenuGroupList',
          component: () => import('../views/MenuGroupList.vue'),
          meta: { title: '菜单分组管理', requiresPermission: 'manage-plugins' }
        },
      ]
    }
  ]
})

export async function permissionGuard(
  to: { meta: { public?: boolean; requiresPermission?: string }; fullPath: string },
  from: { name?: string | symbol | null | undefined }
): Promise<boolean | string | { name: string; query: { redirect: string } }> {
  if (to.meta.public) return true

  if (getRuntimeMode() === 'standalone' && !getToken()) {
    return {
      name: 'Login',
      query: { redirect: to.fullPath }
    }
  }

  const requiredPermission = to.meta.requiresPermission
  if (!requiredPermission) return true

  try {
    const { can, loaded, fetchPermissions } = usePermissions()
    if (!loaded.value) {
      await fetchPermissions()
    }
    if (can(requiredPermission as Parameters<typeof can>[0])) {
      return true
    }
    // 首次导航（from.name 为空）时直接放行，避免重定向回 '/' 产生无限循环
    if (!from.name) return true
    ElMessage.error(i18n.global.t('layout.permissionDenied'))
    return false
  } catch {
    ElMessage.error(i18n.global.t('layout.permissionCheckFailed'))
    if (!from.name) return true
    return false
  }
}

router.beforeEach(permissionGuard)

export default router
