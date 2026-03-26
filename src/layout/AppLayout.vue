<template>
  <div class="app-layout">
    <div
      v-if="sidebarOpen && hasAny()"
      class="sidebar-overlay"
      @click="sidebarOpen = false"
    />

    <aside v-if="hasAny()" class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <span class="sidebar-title">系统管理</span>
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
          <span>插件权限管理</span>
        </router-link>
        <router-link
          v-if="can('manage-plugins')"
          to="/plugins"
          class="sidebar-item"
          :class="{ active: $route.path === '/plugins' }"
          @click="sidebarOpen = false"
        >
          <el-icon><Grid /></el-icon>
          <span>插件注册管理</span>
        </router-link>
        <router-link
          v-if="can('manage-plugins')"
          to="/menu-groups"
          class="sidebar-item"
          :class="{ active: $route.path === '/menu-groups' }"
          @click="sidebarOpen = false"
        >
          <el-icon><Menu /></el-icon>
          <span>菜单分组管理</span>
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
      </header>
      <main class="content">
        <div v-if="loaded && !hasAny()" class="no-permission">
          <el-empty description="权限不足，请联系管理员配置" />
        </div>
        <router-view v-else />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Close, Fold, Key, Grid, Menu } from '@element-plus/icons-vue'
import { usePermissions } from '../composables/usePermissions'

const { fetchPermissions, can, hasAny, loaded } = usePermissions()

const sidebarOpen = ref(false)
const userInfo = ref<{ username: string; nickname?: string; roles: string[] } | null>(null)

onMounted(async () => {
  await fetchPermissions()
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
</style>
