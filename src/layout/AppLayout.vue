<template>
  <div class="app-layout">
    <div
      v-if="sidebarOpen && hasAny()"
      class="sidebar-overlay"
      @click="sidebarOpen = false"
    />

    <aside v-if="hasAny()" class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <span class="sidebar-title">{{ t('layout.title') }}</span>
        <button class="sidebar-close" @click="sidebarOpen = false">
          <el-icon><Close /></el-icon>
        </button>
      </div>
      <nav class="sidebar-nav">
        <router-link
          v-if="can('manage-permissions')"
          to="/permissions"
          class="sidebar-item"
          :class="{ active: $route.path === '/permissions' }"
          @click="sidebarOpen = false"
        >
          <el-icon><Key /></el-icon>
          <span>{{ t('permission.title') }}</span>
        </router-link>
        <router-link
          v-if="can('manage-plugins')"
          to="/plugins"
          class="sidebar-item"
          :class="{ active: $route.path === '/plugins' }"
          @click="sidebarOpen = false"
        >
          <el-icon><Grid /></el-icon>
          <span>{{ t('plugin.title') }}</span>
        </router-link>
        <router-link
          v-if="can('manage-organizations')"
          to="/organizations"
          class="sidebar-item"
          :class="{ active: $route.path === '/organizations' }"
          @click="sidebarOpen = false"
        >
          <el-icon><OfficeBuilding /></el-icon>
          <span>{{ t('organization.title') }}</span>
        </router-link>
      </nav>
    </aside>

    <div class="main-area">
      <header class="navbar">
        <button v-if="hasAny()" class="menu-btn" @click="sidebarOpen = true">
          <el-icon :size="20"><Fold /></el-icon>
        </button>
        <h1 class="navbar-title">{{ $route.meta.title || '系统管理' }}</h1>
        <div class="navbar-spacer" />
        <button
          v-if="userInfo"
          type="button"
          class="logout-btn"
          data-testid="logout-button"
          @click="handleLogout"
        >
          {{ t('layout.logout') }}
        </button>
        <div v-if="userInfo" class="user-info">
          <el-icon><User /></el-icon>
          <span>{{ userInfo.nickname || userInfo.username }}</span>
          <el-tag size="small" v-for="role in userInfo.roles" :key="role">{{ role }}</el-tag>
        </div>
      </header>
      <main class="content">
        <!-- 等待权限和用户信息加载完成 -->
        <div v-if="!ready" class="loading-state">
          <el-icon class="is-loading" :size="24"><Loading /></el-icon>
        </div>
        <div v-else-if="loaded && !hasAny()" class="no-permission">
          <el-empty :description="t('layout.noPermission')" />
        </div>
        <router-view v-else />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Close, Fold, Key, Grid, OfficeBuilding, User, Loading } from '@element-plus/icons-vue'
import { pluginApi } from '../api'
import { usePermissions } from '../composables/usePermissions'
import { getRuntimeMode, removeAllTokens } from '../utils/token'

const router = useRouter()
const { t } = useI18n()
const { fetchPermissions, can, hasAny, loaded } = usePermissions()

const sidebarOpen = ref(false)
const userInfo = ref<{
  username: string
  nickname?: string
  roles: string[]
  organizations?: Array<{ id: number; name: string; title: string }>
} | null>(null)
const ready = ref(false)

async function handleLogout() {
  removeAllTokens()

  if (getRuntimeMode() === 'embedded') {
    window.location.reload()
    return
  }

  await router.replace({ name: 'Login' })
}

onMounted(async () => {
  try {
    const [{ data }] = await Promise.all([
      pluginApi.get('/verify-token', {
        params: { plugin_name: 'system-admin' }
      }),
      fetchPermissions(),
    ])
    if (data.code === 0) {
      userInfo.value = data.data
    }
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 403) {
      await router.replace({ name: 'NotAllowed', query: { reason: 'root' } })
    }
  } finally {
    ready.value = true
  }
})
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  background: var(--bg-page);
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 998;
}

.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 260px;
  background: var(--bg-card);
  border-right: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  z-index: 999;
  transform: translateX(-100%);
  transition: transform var(--transition-normal);
  display: flex;
  flex-direction: column;
}

.sidebar.open {
  transform: translateX(0);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
}

.sidebar-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--primary-color);
}

.sidebar-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.sidebar-close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.sidebar-nav {
  flex: 1;
  padding: var(--spacing-sm);
  overflow-y: auto;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 12px var(--spacing-md);
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-bottom: var(--spacing-xs);
  border: none;
  background: none;
  width: 100%;
  font-size: var(--font-size-md);
  font-family: var(--font-family);
}

.sidebar-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-item.active {
  background: var(--primary-light);
  color: var(--primary-color);
  font-weight: var(--font-weight-medium);
}

.navbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 0 var(--spacing-lg);
  height: 56px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
}

.menu-btn:hover {
  background: var(--bg-hover);
  color: var(--primary-color);
}

.navbar-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.navbar-spacer { flex: 1; }

.logout-btn {
  border: 0;
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.logout-btn:hover {
  color: var(--text-primary);
  background: var(--primary-light);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.content {
  padding: var(--spacing-lg);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-muted);
}
</style>
