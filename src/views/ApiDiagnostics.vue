<template>
  <div class="diagnostics">
    <div class="diag-header">
      <h2>API 诊断面板</h2>
      <el-button type="primary" :loading="runningAll" @click="runAll">全部测试</el-button>
    </div>

    <!-- 环境信息 -->
    <div class="section">
      <h3>环境信息</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">当前页面地址</span>
          <code>{{ envInfo.location }}</code>
        </div>
        <div class="info-item">
          <span class="label">Origin</span>
          <code>{{ envInfo.origin }}</code>
        </div>
        <div class="info-item">
          <span class="label">adminApi baseURL</span>
          <code>{{ envInfo.adminApiBase }}</code>
        </div>
        <div class="info-item">
          <span class="label">pluginApi baseURL</span>
          <code>{{ envInfo.pluginApiBase }}</code>
        </div>
        <div class="info-item">
          <span class="label">Token 状态</span>
          <code :class="envInfo.hasToken ? 'ok' : 'warn'">{{ envInfo.hasToken ? '已设置' : '未设置' }}</code>
        </div>
        <div class="info-item">
          <span class="label">是否在 iframe 中</span>
          <code>{{ envInfo.isIframe ? '是' : '否' }}</code>
        </div>
        <div class="info-item">
          <span class="label">API 后端地址 (APP_API_N_URL)</span>
          <code :class="envInfo.apiUpstream === '加载中...' ? '' : envInfo.apiUpstream.startsWith('http') ? 'ok' : 'warn'">{{ envInfo.apiUpstream }}</code>
        </div>
        <div class="info-item">
          <span class="label">容器 hostname</span>
          <code>{{ envInfo.hostname || '-' }}</code>
        </div>
        <div class="info-item">
          <span class="label">容器启动时间</span>
          <code>{{ envInfo.serverBuildTime || '-' }}</code>
        </div>
      </div>
    </div>

    <!-- 反向代理连通性检测 -->
    <div class="section">
      <h3>反向代理连通性检测</h3>
      <p class="hint">直接用 fetch 探测各 Nginx proxy_pass location，检测代理是否正确配置并能到达后端</p>
      <el-button type="primary" :loading="runningProxy" @click="runAllProxy" style="margin-bottom: 12px">全部检测</el-button>
      <el-table :data="proxyTests" stripe border>
        <el-table-column prop="name" label="代理路径" width="220" />
        <el-table-column label="请求 URL" min-width="300">
          <template #default="{ row }"><code class="url">{{ row.url }}</code></template>
        </el-table-column>
        <el-table-column label="预期后端" width="240">
          <template #default="{ row }"><code class="url">{{ row.expectedBackend }}</code></template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'pending'" type="info" size="small">待检测</el-tag>
            <el-tag v-else-if="row.status === 'loading'" type="warning" size="small">
              <el-icon class="is-loading"><Loading /></el-icon> 检测中
            </el-tag>
            <el-tag v-else-if="row.status === 'success'" type="success" size="small">{{ row.httpStatus }} 可达</el-tag>
            <el-tag v-else-if="row.status === 'proxy-error'" type="danger" size="small">{{ row.httpStatus }} 代理异常</el-tag>
            <el-tag v-else type="danger" size="small">{{ row.httpStatus || '不可达' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="诊断结果" min-width="380">
          <template #default="{ row }">
            <div v-if="row.status !== 'pending' && row.status !== 'loading'" class="resp-detail">
              <div class="diag-verdict" :class="row.verdict">{{ row.verdictIcon }} {{ row.verdictText }}</div>
              <div v-if="row.responseHeaders" class="resp-headers">
                <span class="label">关键响应头:</span>
                <code>{{ row.responseHeaders }}</code>
              </div>
              <div class="resp-body">
                <span class="label">响应体 (前300字):</span>
                <pre>{{ row.responseBody }}</pre>
              </div>
              <div v-if="row.latency" class="latency">⏱ 响应耗时: {{ row.latency }}ms</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="runProxyTest(row)">检测</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- API 端点测试 -->
    <div class="section">
      <h3>API 端点测试</h3>
      <el-table :data="tests" stripe border>
        <el-table-column prop="name" label="接口名称" width="200" />
        <el-table-column prop="method" label="方法" width="80" />
        <el-table-column label="请求地址" min-width="320">
          <template #default="{ row }"><code class="url">{{ row.fullUrl }}</code></template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'pending'" type="info" size="small">待测试</el-tag>
            <el-tag v-else-if="row.status === 'loading'" type="warning" size="small">
              <el-icon class="is-loading"><Loading /></el-icon> 测试中
            </el-tag>
            <el-tag v-else-if="row.status === 'success'" type="success" size="small">{{ row.httpStatus }} OK</el-tag>
            <el-tag v-else type="danger" size="small">{{ row.httpStatus || '失败' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="响应详情" min-width="360">
          <template #default="{ row }">
            <div v-if="row.status === 'success' || row.status === 'error'" class="resp-detail">
              <div v-if="row.responseHeaders" class="resp-headers">
                <span class="label">响应头:</span>
                <code>{{ row.responseHeaders }}</code>
              </div>
              <div class="resp-body">
                <span class="label">响应体:</span>
                <pre>{{ row.responseBody }}</pre>
              </div>
              <div v-if="row.errorMessage" class="error-msg">❌ {{ row.errorMessage }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="runSingle(row)">测试</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 原始 Fetch 测试 -->
    <div class="section">
      <h3>原始 Fetch 测试（绕过 Axios）</h3>
      <p class="hint">直接用 fetch 请求，排除 Axios 拦截器的影响</p>
      <el-table :data="rawTests" stripe border>
        <el-table-column prop="name" label="接口" width="200" />
        <el-table-column label="请求地址" min-width="320">
          <template #default="{ row }"><code class="url">{{ row.url }}</code></template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'pending'" type="info" size="small">待测试</el-tag>
            <el-tag v-else-if="row.status === 'loading'" type="warning" size="small">测试中</el-tag>
            <el-tag v-else-if="row.status === 'success'" type="success" size="small">{{ row.httpStatus }}</el-tag>
            <el-tag v-else type="danger" size="small">{{ row.httpStatus || '失败' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="响应" min-width="360">
          <template #default="{ row }">
            <div v-if="row.responseBody"><pre>{{ row.responseBody }}</pre></div>
            <div v-if="row.errorMessage" class="error-msg">❌ {{ row.errorMessage }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="runRawTest(row)">测试</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-button style="margin-top: 12px" @click="runAllRaw" :loading="runningAllRaw">全部测试</el-button>
    </div>

    <!-- 自定义 URL 测试 -->
    <div class="section">
      <h3>自定义 URL 测试</h3>
      <div class="custom-test">
        <el-input v-model="customUrl" placeholder="输入完整或相对 URL，如 /api/v1/plugin-admin/permissions" style="flex:1" />
        <el-select v-model="customMethod" style="width: 120px">
          <el-option label="GET" value="GET" />
          <el-option label="POST" value="POST" />
        </el-select>
        <el-button type="primary" @click="runCustom" :loading="customLoading">发送</el-button>
      </div>
      <div v-if="customResult" class="custom-result">
        <div>HTTP {{ customResult.status }} {{ customResult.statusText }}</div>
        <pre>{{ customResult.body }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import adminApi, { pluginApi } from '../api'
import { getToken, isInIframe } from '../utils/token'

// ---- 环境信息 ----
const envInfo = reactive({
  location: window.location.href,
  origin: window.location.origin,
  adminApiBase: adminApi.defaults.baseURL || '/api/v1/plugin-admin',
  pluginApiBase: pluginApi.defaults.baseURL || '/api/v1/plugin',
  hasToken: !!getToken(),
  isIframe: isInIframe(),
  apiUpstream: '加载中...',
  hostname: '',
  serverBuildTime: '',
})

// ---- API 端点测试 ----
interface TestItem {
  name: string
  method: string
  instance: 'adminApi' | 'pluginApi'
  path: string
  params?: Record<string, any>
  fullUrl: string
  status: 'pending' | 'loading' | 'success' | 'error'
  httpStatus: number | string
  responseHeaders: string
  responseBody: string
  errorMessage: string
}

function makeTest(name: string, method: string, instance: 'adminApi' | 'pluginApi', path: string, params?: Record<string, any>): TestItem {
  const base = instance === 'adminApi'
    ? (adminApi.defaults.baseURL || '/api/v1/plugin-admin')
    : (pluginApi.defaults.baseURL || '/api/v1/plugin')
  const qs = params ? '?' + new URLSearchParams(params as any).toString() : ''
  return {
    name, method, instance, path, params,
    fullUrl: `${window.location.origin}${base}${path}${qs}`,
    status: 'pending', httpStatus: '', responseHeaders: '', responseBody: '', errorMessage: '',
  }
}

const tests = ref<TestItem[]>([
  makeTest('获取权限配置列表', 'GET', 'adminApi', '/permissions', { page: '1', per_page: '10' }),
  makeTest('获取插件列表', 'GET', 'adminApi', '/plugins', { page: '1', per_page: '10' }),
  makeTest('获取菜单分组', 'GET', 'adminApi', '/menu-groups'),
  makeTest('验证 Token', 'GET', 'pluginApi', '/verify-token', { plugin_name: 'system-admin' }),
  makeTest('获取权限列表', 'GET', 'pluginApi', '/allowed-actions', { plugin_name: 'system-admin' }),
])

async function runSingle(item: TestItem) {
  item.status = 'loading'
  item.responseBody = ''
  item.responseHeaders = ''
  item.errorMessage = ''
  item.httpStatus = ''

  const inst = item.instance === 'adminApi' ? adminApi : pluginApi
  try {
    const resp = await inst.request({
      method: item.method,
      url: item.path,
      params: item.params,
      validateStatus: () => true,
    })
    item.httpStatus = resp.status
    item.status = resp.status >= 200 && resp.status < 400 ? 'success' : 'error'
    item.responseHeaders = `content-type: ${resp.headers['content-type'] || 'N/A'}`
    item.responseBody = typeof resp.data === 'string'
      ? resp.data.slice(0, 500)
      : JSON.stringify(resp.data, null, 2).slice(0, 500)
  } catch (err: any) {
    item.status = 'error'
    item.httpStatus = err.response?.status || 'N/A'
    item.errorMessage = err.message || String(err)
    if (err.response) {
      item.responseBody = typeof err.response.data === 'string'
        ? err.response.data.slice(0, 500)
        : JSON.stringify(err.response.data, null, 2).slice(0, 500)
    }
  }
}

const runningAll = ref(false)
async function runAll() {
  runningAll.value = true
  for (const t of tests.value) await runSingle(t)
  runningAll.value = false
}

// ---- 原始 Fetch 测试 ----
interface RawTestItem {
  name: string
  url: string
  status: 'pending' | 'loading' | 'success' | 'error'
  httpStatus: number | string
  responseBody: string
  errorMessage: string
}

const rawTests = ref<RawTestItem[]>([
  { name: 'adminApi /permissions', url: '/api/v1/plugin-admin/permissions?page=1&per_page=5', status: 'pending', httpStatus: '', responseBody: '', errorMessage: '' },
  { name: 'pluginApi /verify-token', url: '/api/v1/plugin/verify-token?plugin_name=system-admin', status: 'pending', httpStatus: '', responseBody: '', errorMessage: '' },
  { name: 'pluginApi /allowed-actions', url: '/api/v1/plugin/allowed-actions?plugin_name=system-admin', status: 'pending', httpStatus: '', responseBody: '', errorMessage: '' },
  { name: 'Health Check', url: '/health', status: 'pending', httpStatus: '', responseBody: '', errorMessage: '' },
  { name: 'Debug Env', url: '/debug-env', status: 'pending', httpStatus: '', responseBody: '', errorMessage: '' },
])

async function runRawTest(item: RawTestItem) {
  item.status = 'loading'
  item.responseBody = ''
  item.errorMessage = ''
  try {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const resp = await fetch(item.url, { headers })
    item.httpStatus = resp.status
    item.status = resp.ok ? 'success' : 'error'
    const text = await resp.text()
    item.responseBody = text.slice(0, 500)
  } catch (err: any) {
    item.status = 'error'
    item.errorMessage = err.message || String(err)
  }
}

const runningAllRaw = ref(false)
async function runAllRaw() {
  runningAllRaw.value = true
  for (const t of rawTests.value) await runRawTest(t)
  runningAllRaw.value = false
}

// ---- 自定义 URL 测试 ----
const customUrl = ref('')
const customMethod = ref('GET')
const customLoading = ref(false)
const customResult = ref<{ status: number; statusText: string; body: string } | null>(null)

async function runCustom() {
  if (!customUrl.value) return
  customLoading.value = true
  customResult.value = null
  try {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const resp = await fetch(customUrl.value, { method: customMethod.value, headers })
    const text = await resp.text()
    customResult.value = { status: resp.status, statusText: resp.statusText, body: text.slice(0, 1000) }
  } catch (err: any) {
    customResult.value = { status: 0, statusText: 'Error', body: err.message }
  } finally {
    customLoading.value = false
  }
}

// ---- 反向代理连通性检测 ----
interface ProxyTestItem {
  name: string
  url: string
  expectedBackend: string
  status: 'pending' | 'loading' | 'success' | 'proxy-error' | 'error'
  httpStatus: number | string
  responseHeaders: string
  responseBody: string
  latency: number | null
  verdict: 'ok' | 'warn' | 'fail'
  verdictIcon: string
  verdictText: string
}

const proxyTests = ref<ProxyTestItem[]>([
  { name: '/api/ → adminApi', url: '/api/v1/plugin-admin/permissions?page=1&per_page=1', expectedBackend: 'proxy_pass → API 后端', status: 'pending', httpStatus: '', responseHeaders: '', responseBody: '', latency: null, verdict: 'ok', verdictIcon: '', verdictText: '' },
  { name: '/api/ → pluginApi', url: '/api/v1/plugin/allowed-actions?plugin_name=system-admin', expectedBackend: 'proxy_pass → API 后端', status: 'pending', httpStatus: '', responseHeaders: '', responseBody: '', latency: null, verdict: 'ok', verdictIcon: '', verdictText: '' },
  { name: '/health', url: '/health', expectedBackend: '本地 Nginx 直接返回', status: 'pending', httpStatus: '', responseHeaders: '', responseBody: '', latency: null, verdict: 'ok', verdictIcon: '', verdictText: '' },
  { name: '/debug-env', url: '/debug-env', expectedBackend: '本地 Nginx 静态文件', status: 'pending', httpStatus: '', responseHeaders: '', responseBody: '', latency: null, verdict: 'ok', verdictIcon: '', verdictText: '' },
])

async function runProxyTest(item: ProxyTestItem) {
  item.status = 'loading'
  item.responseBody = ''
  item.responseHeaders = ''
  item.latency = null
  item.verdict = 'ok'
  item.verdictIcon = ''
  item.verdictText = ''

  const start = performance.now()
  try {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const resp = await fetch(item.url, { headers })
    item.latency = Math.round(performance.now() - start)
    item.httpStatus = resp.status

    const headerNames = ['content-type', 'server', 'x-powered-by']
    const headerParts: string[] = []
    headerNames.forEach(h => { const v = resp.headers.get(h); if (v) headerParts.push(`${h}: ${v}`) })
    item.responseHeaders = headerParts.join(' | ')

    const text = await resp.text()
    item.responseBody = text.slice(0, 300)

    if (resp.status === 502 || resp.status === 503 || resp.status === 504) {
      item.status = 'proxy-error'
      item.verdict = 'fail'
      item.verdictIcon = '❌'
      item.verdictText = `代理目标不可达 (${resp.status})，Nginx 无法连接后端服务`
    } else if (resp.status === 404 && text.includes('<html')) {
      item.status = 'error'
      item.verdict = 'warn'
      item.verdictIcon = '⚠️'
      item.verdictText = 'Nginx 未匹配到代理规则，返回了静态 404'
    } else if (resp.ok) {
      item.status = 'success'
      item.verdict = 'ok'
      item.verdictIcon = '✅'
      item.verdictText = '代理正常，后端已响应'
    } else {
      item.status = 'success'
      item.verdict = 'ok'
      item.verdictIcon = '✅'
      item.verdictText = `代理连通（后端返回 ${resp.status}，可能需要认证或参数）`
    }
  } catch (err: any) {
    item.latency = Math.round(performance.now() - start)
    item.status = 'error'
    item.httpStatus = 'N/A'
    item.verdict = 'fail'
    item.verdictIcon = '❌'
    item.verdictText = `请求失败: ${err.message}`
  }
}

const runningProxy = ref(false)
async function runAllProxy() {
  runningProxy.value = true
  for (const t of proxyTests.value) await runProxyTest(t)
  runningProxy.value = false
}

onMounted(async () => {
  envInfo.hasToken = !!getToken()
  try {
    const resp = await fetch('/debug-env')
    if (!resp.ok) { envInfo.apiUpstream = `请求失败 (${resp.status})`; return }
    const text = await resp.text()
    let data: Record<string, string> = {}
    try { data = JSON.parse(text) } catch { envInfo.apiUpstream = '/debug-env 返回了非 JSON 内容'; return }

    const upstreams: string[] = []
    const backendUrls: string[] = []
    let i = 1
    while (data[`APP_API_${i}_URL`]) {
      backendUrls.push(data[`APP_API_${i}_URL`])
      upstreams.push(`APP_API_${i}_URL=${data[`APP_API_${i}_URL`]}`)
      i++
    }
    envInfo.apiUpstream = upstreams.length ? upstreams.join(' | ') : '未设置'
    envInfo.hostname = data.hostname || ''
    envInfo.serverBuildTime = data.buildTime || ''

    if (backendUrls.length) {
      proxyTests.value.forEach(t => {
        if (t.url.startsWith('/api/')) {
          const backendPath = t.url.replace(/^\/api/, '')
          t.expectedBackend = backendUrls.length === 1
            ? backendUrls[0].replace(/\/$/, '') + backendPath
            : backendUrls.map((u, idx) => `[${idx + 1}] ${u.replace(/\/$/, '') + backendPath}`).join(' → ')
        }
      })
    }
  } catch (e: any) {
    envInfo.apiUpstream = `请求异常: ${e.message}`
  }
})
</script>

<style scoped>
.diagnostics { padding: 20px; max-width: 1400px; margin: 0 auto; }
.diag-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.diag-header h2 { margin: 0; }
.section { margin-bottom: 32px; }
.section h3 { margin: 0 0 12px; font-size: 16px; border-bottom: 1px solid var(--border-color, #eee); padding-bottom: 8px; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
.info-item { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; }
.info-item .label { color: #666; min-width: 200px; flex-shrink: 0; }
.info-item code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; word-break: break-all; font-size: 13px; }
code.ok { color: #67c23a; }
code.warn { color: #e6a23c; }
code.url { font-size: 12px; word-break: break-all; }
.resp-detail { font-size: 12px; }
.resp-detail pre { margin: 4px 0; white-space: pre-wrap; word-break: break-all; max-height: 150px; overflow: auto; background: #f9f9f9; padding: 4px 8px; border-radius: 4px; font-size: 11px; }
.error-msg { color: #f56c6c; margin: 4px 0; }
.hint { color: #999; font-size: 13px; margin: 0 0 8px; }
.custom-test { display: flex; gap: 8px; margin-bottom: 12px; }
.custom-result { background: #f9f9f9; padding: 12px; border-radius: 6px; font-size: 13px; }
.custom-result pre { margin: 8px 0 0; white-space: pre-wrap; word-break: break-all; max-height: 300px; overflow: auto; }
.diag-verdict { font-weight: 600; margin-bottom: 4px; font-size: 13px; }
.diag-verdict.ok { color: #67c23a; }
.diag-verdict.warn { color: #e6a23c; }
.diag-verdict.fail { color: #f56c6c; }
.latency { color: #909399; font-size: 12px; margin-top: 4px; }
</style>
