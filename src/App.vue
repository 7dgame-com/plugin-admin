<template>
  <!-- 公开页面直接渲染，不需要 token -->
  <router-view v-if="isPublicRoute" />
  <template v-else>
    <router-view v-if="hasToken" />

    <!-- 握手状态（半透明遮罩） -->
    <Transition name="handshake-fade">
      <!-- iframe 内：简单 loading -->
      <div v-if="showHandshake && inIframe" key="loading" class="handshake-inline">
        <div class="handshake-spinner spin">⚙️</div>
        <p class="handshake-text">{{ t('layout.connecting') }}</p>
      </div>
    </Transition>
  </template>

  <span class="global-version">{{ appVersion }}</span>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { isInIframe, getToken, setToken, removeAllTokens } from './utils/token'
import { usePluginMessageBridge } from './composables/usePluginMessageBridge'
import { setThemeFromConfig } from './composables/useTheme'

declare const __APP_VERSION__: string
const appVersion = `v${__APP_VERSION__}`
const { t } = useI18n()

const route = useRoute()
const hasToken = ref(!!getToken())
const inIframe = ref(isInIframe())

const PUBLIC_ROUTES = ['/api-diagnostics', '/login', '/not-allowed']
const isPublicRoute = computed(() => PUBLIC_ROUTES.some((p) => route.path.startsWith(p)))
const showHandshake = computed(() => !isPublicRoute.value && inIframe.value && !hasToken.value)

usePluginMessageBridge({
  onInit: (payload) => {
    if (payload.token) {
      setToken(payload.token)
      hasToken.value = true
    }
    setThemeFromConfig(payload.config)
  },
  onTokenUpdate: (newToken) => {
    if (newToken) {
      setToken(newToken)
      hasToken.value = true
    }
  },
  onDestroy: () => {
    removeAllTokens()
    hasToken.value = false
  }
})

onMounted(() => {
  inIframe.value = isInIframe()
  if (inIframe.value) {
    // iframe 内不复用旧 token，始终等待 INIT 握手获取新 token
    // 旧 token 可能因 DESTROY 未及时清除而残留且已过期
    removeAllTokens()
    hasToken.value = false
    return
  }

  hasToken.value = !!getToken()
})

watch(
  () => route.fullPath,
  () => {
    inIframe.value = isInIframe()
    hasToken.value = !!getToken()
  },
  { immediate: true }
)
</script>

<style scoped>
.handshake-icon.spin { display: inline-block; animation: spin 2s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.handshake-inline {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-page, #f5f7fa);
}
.handshake-spinner { font-size: 36px; display: inline-block; }
.handshake-spinner.spin { animation: spin 2s linear infinite; }
.handshake-text { margin-top: 12px; font-size: 14px; color: #909399; }
.handshake-fade-enter-active, .handshake-fade-leave-active { transition: opacity 0.4s ease; }
.handshake-fade-enter-from, .handshake-fade-leave-to { opacity: 0; }
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
