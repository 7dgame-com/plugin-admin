import { computed, readonly, ref } from 'vue'
import { verifyToken } from '../api'

type OrganizationSummary = {
  id: number
  name: string
  title: string
}

export type AuthSessionUser = {
  id?: number
  userId?: number
  username: string
  nickname?: string
  roles: string[]
  organizations?: OrganizationSummary[]
}

const user = ref<AuthSessionUser | null>(null)
const loaded = ref(false)
const loading = ref(false)
let loadingPromise: Promise<void> | null = null

const isRootUser = computed(() => Array.isArray(user.value?.roles) && user.value.roles.includes('root'))
const isManagerUser = computed(
  () => Array.isArray(user.value?.roles) && user.value.roles.includes('manager')
)
const hasManagerAccess = computed(() => isRootUser.value || isManagerUser.value)

export function useAuthSession() {
  async function fetchSession(force = false) {
    if (loaded.value && !force) {
      return
    }

    if (loadingPromise && !force) {
      await loadingPromise
      return
    }

    loading.value = true
    loadingPromise = (async () => {
      try {
        const response = await verifyToken()
        const payload =
          (response.data as { data?: AuthSessionUser }).data ??
          (response.data as AuthSessionUser)

        user.value = {
          ...payload,
          roles: Array.isArray(payload?.roles) ? payload.roles : [],
        }
        loaded.value = true
      } catch (error) {
        user.value = null
        loaded.value = false
        throw error
      } finally {
        loading.value = false
        loadingPromise = null
      }
    })()

    await loadingPromise
  }

  return {
    user: readonly(user),
    loaded: readonly(loaded),
    loading: readonly(loading),
    isRootUser,
    isManagerUser,
    hasManagerAccess,
    fetchSession,
  }
}
