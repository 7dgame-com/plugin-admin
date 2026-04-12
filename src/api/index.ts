import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import {
  getRuntimeMode,
  getToken,
  setToken,
  removeAllTokens,
  requestParentTokenRefresh,
  getRefreshToken,
  setRefreshToken
} from '../utils/token'

/**
 * 管理接口（指向 system-admin 自有后端 /backend/api/v1/plugin-admin）
 */
const adminApi = axios.create({
  baseURL: '/backend/api/v1/plugin-admin',
  timeout: 10000
})

/**
 * 通用插件接口（指向 system-admin 自有后端 /backend/api/v1/plugin）
 */
export const pluginApi = axios.create({
  baseURL: '/backend/api/v1/plugin',
  timeout: 10000
})

/**
 * 主平台认证接口（指向主平台 /api/v1/auth）
 */
export const authApi = axios.create({
  baseURL: '/api/v1/auth',
  timeout: 10000
})

/**
 * 主后端接口（指向主系统 /api/v1）
 */
export const mainApi = axios.create({
  baseURL: '/api/v1',
  timeout: 10000
})

// --- Token refresh state ---
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: Error) => void
}> = []

function processQueue(error: Error | null, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error || !token) {
      reject(error ?? new Error('Token refresh failed'))
    } else {
      resolve(token)
    }
  })
  failedQueue = []
}

async function tryRefreshToken(): Promise<string | null> {
  if (getRuntimeMode() === 'embedded') {
    const result = await requestParentTokenRefresh()
    if (result?.accessToken) {
      setToken(result.accessToken)
      return result.accessToken
    }
    return null
  }

  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const res = await authApi.post('/refresh', { refreshToken })
    const tokenPayload = res.data?.token
    const accessToken = tokenPayload?.accessToken

    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      return null
    }

    setToken(accessToken)

    if (typeof tokenPayload?.refreshToken === 'string' && tokenPayload.refreshToken.length > 0) {
      setRefreshToken(tokenPayload.refreshToken)
    }

    return accessToken
  } catch {
    return null
  }
}

/**
 * 为 axios 实例添加请求/响应拦截器
 */
function setupInterceptors(instance: ReturnType<typeof axios.create>) {
  // Request: 注入 Authorization header
  instance.interceptors.request.use((config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  // Response: 处理 x-refresh-token 和 401 刷新
  instance.interceptors.response.use(
    (res) => {
      const rt = res.headers['x-refresh-token']
      if (rt) setRefreshToken(rt)
      return res
    },
    async (err: AxiosError) => {
      const originalRequest = err.config as InternalAxiosRequestConfig & {
        _retry?: boolean
      }

      if (err.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(err)
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          originalRequest._retry = true
          return instance(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const newToken = await tryRefreshToken()

        if (!newToken) {
          throw new Error('Token refresh failed')
        }

        processQueue(null, newToken)

        originalRequest.headers = originalRequest.headers ?? {}
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return instance(originalRequest)
      } catch (refreshError) {
        removeAllTokens()

        if (getRuntimeMode() === 'embedded') {
          window.parent.postMessage({ type: 'TOKEN_EXPIRED' }, '*')
        }

        processQueue(
          refreshError instanceof Error
            ? refreshError
            : new Error('Token refresh failed'),
          null
        )

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
  )
}

setupInterceptors(adminApi)
setupInterceptors(pluginApi)
setupInterceptors(authApi)
setupInterceptors(mainApi)

// 默认导出 adminApi，同时具名导出 pluginApi
export default adminApi

// 权限配置 API
export const getPermissions = (params?: Record<string, unknown>) => adminApi.get('/permissions', { params })
export const createPermission = (data: Record<string, unknown>) => adminApi.post('/create-permission', data)
export const updatePermission = (data: Record<string, unknown>) => adminApi.put('/update-permission', data)
export const deletePermission = (id: number) => adminApi.post('/delete-permission', { id })

// 插件注册 API
export const getPlugins = (params?: Record<string, unknown>) => adminApi.get('/plugins', { params })
export const createPlugin = (data: Record<string, unknown>) => adminApi.post('/create-plugin', data)
export const updatePlugin = (data: Record<string, unknown>) => adminApi.put('/update-plugin', data)
export const deletePlugin = (id: string) => adminApi.post('/delete-plugin', { id })

export interface OrganizationItem {
  id: number
  title: string
  name: string
}

// 组织管理 API（主后端）
export const getOrganizations = () => mainApi.get('/organization/list')
export const createOrganization = (data: Pick<OrganizationItem, 'title' | 'name'>) =>
  mainApi.post('/organization/create', data)
export const updateOrganization = (data: Pick<OrganizationItem, 'id' | 'title'>) =>
  mainApi.post('/organization/update', data)
export const bindOrganizationUser = (data: { user_id: number; organization_id: number }) =>
  mainApi.post('/organization/bind-user', data)
export const unbindOrganizationUser = (data: { user_id: number; organization_id: number }) =>
  mainApi.post('/organization/unbind-user', data)
