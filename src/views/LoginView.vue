<template>
  <section class="login-page">
    <form class="login-form" @submit.prevent="submit">
      <h1 class="login-title">{{ t('auth.title') }}</h1>
      <p class="login-hint">{{ t('auth.rootOnly') }}</p>

      <label class="login-label">
        <span>Username</span>
        <input
          v-model.trim="form.username"
          autocomplete="username"
          class="login-input"
          type="text"
        />
      </label>

      <label class="login-label">
        <span>Password</span>
        <input
          v-model="form.password"
          autocomplete="current-password"
          class="login-input"
          type="password"
        />
      </label>

      <p v-if="errorMessage" class="login-error">{{ errorMessage }}</p>

      <button class="login-submit" type="submit" :disabled="loading">
        {{ loading ? t('common.loading') : t('auth.login') }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { authApi, verifyToken } from '../api'
import { removeAllTokens, setRefreshToken, setToken } from '../utils/token'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const form = reactive({
  username: '',
  password: '',
})

const loading = ref(false)
const errorMessage = ref('')

function extractErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  return t('auth.loginFailed')
}

async function submit() {
  loading.value = true
  errorMessage.value = ''

  try {
    const loginResponse = await authApi.post('/login', {
      username: form.username,
      password: form.password,
    })
    const tokenPayload = loginResponse.data?.token

    if (!tokenPayload?.accessToken || !tokenPayload?.refreshToken) {
      throw new Error(t('auth.loginFailed'))
    }

    setToken(tokenPayload.accessToken)
    setRefreshToken(tokenPayload.refreshToken)

    const verifyResponse = await verifyToken()
    const roles = verifyResponse.data?.data?.roles ?? []

    if (!Array.isArray(roles) || !roles.includes('root')) {
      removeAllTokens()
      errorMessage.value = t('auth.rootOnly')
      return
    }

    const redirect = typeof route.query.redirect === 'string'
      ? route.query.redirect
      : '/plugins'

    await router.replace(redirect)
  } catch (error) {
    removeAllTokens()
    errorMessage.value = extractErrorMessage(error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(180deg, #f4f7fb 0%, #e7edf7 100%);
}

.login-form {
  width: min(100%, 420px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 32px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 22px 60px rgba(24, 39, 75, 0.12);
}

.login-title {
  margin: 0;
  font-size: 28px;
  color: #0f172a;
}

.login-hint {
  margin: 0;
  color: #475569;
  font-size: 14px;
}

.login-label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  color: #334155;
}

.login-input {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 14px;
}

.login-input:focus {
  outline: 2px solid #60a5fa;
  outline-offset: 1px;
}

.login-error {
  margin: 0;
  color: #b91c1c;
  font-size: 14px;
}

.login-submit {
  border: 0;
  border-radius: 10px;
  padding: 12px 16px;
  background: #2563eb;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.login-submit:disabled {
  opacity: 0.7;
  cursor: wait;
}
</style>
