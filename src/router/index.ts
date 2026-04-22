import { createRouter, createWebHistory } from 'vue-router'
import { useAuthSession } from '../composables/useAuthSession'
import { getRuntimeMode, getToken } from '../utils/token'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    public?: boolean
    requiresRoot?: boolean
    requiresManager?: boolean
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
      redirect: '/plugins',
      children: [
        {
          path: 'plugins',
          name: 'PluginList',
          component: () => import('../views/PluginList.vue'),
          meta: { title: '插件注册管理', requiresRoot: true }
        },
        {
          path: 'organizations',
          name: 'OrganizationList',
          component: () => import('../views/OrganizationList.vue'),
          meta: { title: '组织管理', requiresRoot: true }
        },
      ]
    }
  ]
})

export async function permissionGuard(
  to: { meta: { public?: boolean; requiresRoot?: boolean; requiresManager?: boolean }; fullPath: string },
  _from: { name?: string | symbol | null | undefined }
): Promise<boolean | string | { name: string; query: { redirect?: string; reason?: string } }> {
  if (to.meta.public) return true

  if (getRuntimeMode() === 'standalone' && !getToken()) {
    return {
      name: 'Login',
      query: { redirect: to.fullPath }
    }
  }

  if (!to.meta.requiresRoot && !to.meta.requiresManager) return true

  try {
    const { fetchSession, isRootUser, hasManagerAccess } = useAuthSession()
    await fetchSession()
    if (to.meta.requiresRoot && isRootUser.value) {
      return true
    }
    if (to.meta.requiresManager && hasManagerAccess.value) {
      return true
    }
    return {
      name: 'NotAllowed',
      query: { reason: to.meta.requiresRoot ? 'root' : 'manager' }
    }
  } catch {
    if (getRuntimeMode() === 'standalone') {
      return {
        name: 'Login',
        query: { redirect: to.fullPath }
      }
    }
    return { name: 'NotAllowed', query: { reason: 'root' } }
  }
}

router.beforeEach(permissionGuard)

export default router
