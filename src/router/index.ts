import { createRouter, createWebHistory } from 'vue-router'
import { isInIframe, getToken } from '../utils/token'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/not-allowed',
      name: 'NotAllowed',
      component: () => import('../views/NotAllowed.vue'),
      meta: { title: '无法访问' }
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
          meta: { title: '插件权限管理', action: 'manage-permissions' }
        },
        {
          path: 'plugins',
          name: 'PluginList',
          component: () => import('../views/PluginList.vue'),
          meta: { title: '插件注册管理', action: 'manage-plugins' }
        },
        {
          path: 'menu-groups',
          name: 'MenuGroupList',
          component: () => import('../views/MenuGroupList.vue'),
          meta: { title: '菜单分组管理', action: 'manage-plugins' }
        },
      ]
    }
  ]
})

router.beforeEach((to) => {
  if (to.meta.public) return true
  if (to.name === 'NotAllowed') return true
  if (!isInIframe() || !getToken()) {
    return { name: 'NotAllowed' }
  }
  return true
})

export default router
