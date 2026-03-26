import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import {
  getToken,
  setToken,
  removeAllTokens,
  isInIframe,
  requestParentTokenRefresh
} from '../utils/token'

/**
 * 管理接口（指向主后端 /v1/plugin-admin）
 */
const adminApi = axios.create({
  baseURL: '/v1/plugin-admin',
  timeout: 10000
})

/**
 * 通用插件接口（指向主后端 /v1/plugin，如 verify-token、allowed-actions）
 */
export const pluginApi = axios.create({
  baseURL: '/v1/plugin',
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

  // Response: 处理 401 刷新
  instance.interceptors.response.use(
    (res) => res,
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
        let result: { accessToken: string } | null = null

        if (isInIframe()) {
          result = await requestParentTokenRefresh()
        }

        if (!result || !result.accessToken) {
          throw new Error('Token refresh failed')
        }

        setToken(result.accessToken)
        processQueue(null, result.accessToken)

        originalRequest.headers.Authorization = `Bearer ${result.accessToken}`
        return instance(originalRequest)
      } catch (refreshError) {
        removeAllTokens()

        if (isInIframe()) {
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

// 菜单分组 API
export const getMenuGroups = () => adminApi.get('/menu-groups')
export const createMenuGroup = (data: Record<string, unknown>) => adminApi.post('/create-menu-group', data)
export const updateMenuGroup = (data: Record<string, unknown>) => adminApi.put('/update-menu-group', data)
export const deleteMenuGroup = (id: string) => adminApi.post('/delete-menu-group', { id })
