<template>
  <!-- 公开页面直接渲染，不需要 token -->
  <router-view v-if="isPublicRoute" />
  <template v-else>
    <router-view v-if="hasToken" />

    <Transition name="handshake-fade">
      <div v-if="showHandshake" class="handshake-overlay">
        <div class="handshake-card">
          <template v-if="!inIframe">
            <div class="handshake-icon">⚠️</div>
            <h3 class="handshake-title">{{ t('layout.requireMainSystem') }}</h3>
            <a href="/api-diagnostics" class="diag-link">前往 API 诊断页面 →</a>
          </template>
          <template v-else>
            <div class="handshake-icon spin">⚙️</div>
            <h3 class="handshake-title">{{ t('layout.connecting') }}</h3>
            <div class="handshake-steps">
              <div class="step done">✅ 页面加载完成</div>
              <div class="step done">✅ 发送 PLUGIN_READY</div>
              <div class="step" :class="isReady ? 'done' : 'waiting'">
                {{ isReady ? '✅' : '⏳' }} 等待主系统回复 INIT
              </div>
              <div class="step" :class="hasToken ? 'done' : 'waiting'">
                {{ hasToken ? '✅' : '⏳' }} 获取 JWT Token
              </div>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </template>

  <span class="global-version">{{ appVersion }}</span>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { isInIframe, getToken, setToken, removeToken } from './utils/token'
import { usePluginMessageBridge } from './composables/usePluginMessageBridge'
import { setThemeFromConfig } from './composables/useTheme'

declare const __APP_VERSION__: string
const appVersion = `v${__APP_VERSION__}`
const { t } = useI18n()

const route = useRoute()
const hasToken = ref(!!getToken())
const inIframe = ref(false)

const PUBLIC_ROUTES = ['/api-diagnostics']
const isPublicRoute = computed(() => PUBLIC_ROUTES.some((p) => route.path.startsWith(p)))
const showHandshake = computed(() => !isPublicRoute.value && (!inIframe.value || !hasToken.value))

const { isReady } = usePluginMessageBridge({
  onInit: (payload) => {
    if (payload.token) {
      setToken(payload.token)
      hasToken.value = true
    }
    setThemeFromConfig(payload.config)
  },
  onTokenUpdate: (newToken) => {
    if (newToken) setToken(newToken)
  },
  onDestroy: () => {
    removeToken()
    hasToken.value = false
  }
})

onMounted(() => {
  if (isPublicRoute.value) return
  inIframe.value = isInIframe()
  if (!inIframe.value) {
    removeToken()
    hasToken.value = false
  } else {
    hasToken.value = !!getToken()
  }
})
</script>

<style scoped>
.handshake-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}
.handshake-card {
  background: #fff;
  border-radius: 16px;
  padding: 36px 40px;
  min-width: 360px;
  max-width: 480px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
  text-align: center;
}
.handshake-icon { font-size: 40px; margin-bottom: 12px; }
.handshake-icon.spin {
  display: inline-block;
  animation: spin 2s linear infinite;
}
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.handshake-title { margin: 0 0 8px; font-size: 18px; color: #303133; }
.handshake-steps {
  text-align: left;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}
.step { font-size: 13px; color: #606266; }
.step.done { color: #67c23a; }
.step.waiting { color: #909399; }
.diag-link { font-size: 13px; color: #409eff; text-decoration: none; display: block; margin-top: 16px; }
.diag-link:hover { text-decoration: underline; }
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
