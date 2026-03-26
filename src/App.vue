<template>
  <div v-if="waiting" class="iframe-waiting">
    <p>正在连接主系统...</p>
  </div>
  <div v-else-if="!hasToken" class="iframe-waiting">
    <p>请通过主系统访问</p>
  </div>
  <router-view v-else />

  <!-- 全局版本号 -->
  <span class="global-version">{{ appVersion }}</span>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { isInIframe, getToken, setToken, removeToken } from './utils/token'
import { usePluginMessageBridge } from './composables/usePluginMessageBridge'
import { setThemeFromConfig } from './composables/useTheme'

declare const __APP_VERSION__: string
const appVersion = `v${__APP_VERSION__}`

const waiting = ref(false)
const hasToken = ref(!!getToken())

usePluginMessageBridge({
  onInit: (payload) => {
    if (payload.token) {
      setToken(payload.token)
      hasToken.value = true
      waiting.value = false
    }
    setThemeFromConfig(payload.config)
  },
  onTokenUpdate: (newToken) => {
    if (newToken) {
      setToken(newToken)
    }
  },
  onDestroy: () => {
    removeToken()
    hasToken.value = false
  }
})

onMounted(() => {
  if (isInIframe()) {
    if (getToken()) {
      hasToken.value = true
      return
    }
    waiting.value = true
  } else {
    hasToken.value = !!getToken()
  }
})
</script>

<style scoped>
.iframe-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: #999;
  font-size: 14px;
}
.global-version {
  position: fixed;
  right: 12px;
  bottom: 8px;
  font-size: 11px;
  color: #ccc;
  pointer-events: none;
  z-index: 9999;
  user-select: none;
}
</style>
