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
          <span class="label">mainApi baseURL</span>
          <code>{{ envInfo.mainApiBase }}</code>
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
          <span class="label">System-Admin 后端地址 (APP_BACKEND_N_URL)</span>
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

    <!-- 后端诊断 -->
    <div class="section">
      <div class="section-header">
        <h3>后端诊断</h3>
        <el-button type="primary" size="small" :loading="backendDiagnosticsLoading" @click="loadBackendDiagnostics">刷新诊断</el-button>
      </div>
      <p class="hint">由 system-admin/backend 服务端执行主后端、数据库与配置检查，前端只负责展示结果。</p>
      <div v-if="backendDiagnosticsError" class="error-msg">❌ {{ backendDiagnosticsError }}</div>
      <div v-if="backendDiagnostics" class="backend-diagnostics">
        <div class="info-grid">
          <div class="info-item">
            <span class="label">总体状态</span>
            <el-tag :type="getDiagTagType(backendDiagnostics.status)" size="small">{{ getDiagStatusText(backendDiagnostics.status) }}</el-tag>
          </div>
          <div class="info-item">
            <span class="label">生成时间</span>
            <code>{{ formatGeneratedAt(backendDiagnostics.generated_at) }}</code>
          </div>
          <div class="info-item">
            <span class="label">服务名</span>
            <code>{{ backendDiagnostics.service.name }}</code>
          </div>
          <div class="info-item">
            <span class="label">监听端口</span>
            <code>{{ backendDiagnostics.service.port }}</code>
          </div>
          <div class="info-item">
            <span class="label">运行环境</span>
            <code>{{ backendDiagnostics.service.node_env }}</code>
          </div>
          <div class="info-item">
            <span class="label">运行时长</span>
            <code>{{ formatUptime(backendDiagnostics.service.uptime_seconds) }}</code>
          </div>
        </div>

        <el-table :data="backendCheckRows" stripe border style="margin-top: 12px">
          <el-table-column prop="label" label="检查项" width="220" />
          <el-table-column label="目标" min-width="280">
            <template #default="{ row }"><code class="url">{{ row.target }}</code></template>
          </el-table-column>
          <el-table-column label="状态" width="140">
            <template #default="{ row }">
              <el-tag :type="getDiagTagType(row.status)" size="small">{{ getDiagStatusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="HTTP" width="100">
            <template #default="{ row }">{{ row.http_status ?? '-' }}</template>
          </el-table-column>
          <el-table-column label="耗时" width="100">
            <template #default="{ row }">{{ row.latency_ms }}ms</template>
          </el-table-column>
          <el-table-column label="说明" min-width="320">
            <template #default="{ row }">
              <div v-if="row.note" class="status-note">{{ row.note }}</div>
              <div v-if="row.error" class="error-msg">❌ {{ row.error }}</div>
              <div v-if="!row.note && !row.error">-</div>
            </template>
          </el-table-column>
        </el-table>

        <el-table :data="backendConfigRows" stripe border style="margin-top: 12px">
          <el-table-column prop="key" label="配置项" width="240" />
          <el-table-column label="值" min-width="260">
            <template #default="{ row }"><code class="url">{{ row.value }}</code></template>
          </el-table-column>
          <el-table-column label="状态" width="140">
            <template #default="{ row }">
              <el-tag :type="getDiagTagType(row.status)" size="small">{{ getDiagStatusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="280">
            <template #default="{ row }">{{ row.note || '-' }}</template>
          </el-table-column>
        </el-table>
      </div>
      <div v-else-if="backendDiagnosticsLoading" class="hint">正在加载后端诊断结果...</div>
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
        <el-input v-model="customUrl" placeholder="输入完整或相对 URL，如 /backend/api/v1/plugin-admin/plugins" style="flex:1" />
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
import { computed, ref, reactive, onMounted } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import adminApi, { mainApi, pluginApi } from '../api'
import {
  fetchBackendDiagnostics,
  type BackendDiagnosticsCheck,
  type BackendDiagnosticsConfigItem,
  type BackendDiagnosticsData,
  type BackendDiagnosticsStatus,
} from '../api/backendDiagnostics'
import { getToken, isInIframe } from '../utils/token'

// ---- 环境信息 ----
const envInfo = reactive({
  location: window.location.href,
  origin: window.location.origin,
  adminApiBase: adminApi.defaults.baseURL || '/backend/api/v1/plugin-admin',
  pluginApiBase: pluginApi.defaults.baseURL || '/backend/api/v1/plugin',
  mainApiBase: mainApi.defaults.baseURL || '/api/v1',
  hasToken: !!getToken(),
  isIframe: isInIframe(),
  apiUpstream: '加载中...',
  hostname: '',
  serverBuildTime: '',
})

const backendDiagnostics = ref<BackendDiagnosticsData | null>(null)
const backendDiagnosticsLoading = ref(false)
const backendDiagnosticsError = ref('')

const backendCheckLabels: Record<string, string> = {
  main_backend_health: '主后端 /health',
  main_backend_verify_token: '主后端 /v1/plugin/verify-token',
  plugin_db: '插件数据库',
}

const backendCheckRows = computed(() => {
  if (!backendDiagnostics.value) return []
  return Object.entries(backendDiagnostics.value.checks).map(([key, value]) => ({
    key,
    label: backendCheckLabels[key] || key,
    ...(value as BackendDiagnosticsCheck),
  }))
})

const backendConfigRows = computed(() => {
  if (!backendDiagnostics.value) return []
  return Object.entries(backendDiagnostics.value.config).map(([key, value]) => ({
    key,
    ...(value as BackendDiagnosticsConfigItem),
  }))
})

function getDiagTagType(status: BackendDiagnosticsStatus | 'warning' | 'error') {
  if (status === 'ok') return 'success'
  if (status === 'reachable' || status === 'warning') return 'warning'
  return 'danger'
}

function getDiagStatusText(status: BackendDiagnosticsStatus | 'warning' | 'error') {
  if (status === 'ok') return '正常'
  if (status === 'reachable') return '可达'
  if (status === 'warning') return '告警'
  return '异常'
}

function formatGeneratedAt(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function formatUptime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

async function loadBackendDiagnostics() {
  backendDiagnosticsLoading.value = true
  backendDiagnosticsError.value = ''
  try {
    backendDiagnostics.value = await fetchBackendDiagnostics()
  } catch (err: any) {
    backendDiagnosticsError.value = err?.message || String(err)
  } finally {
    backendDiagnosticsLoading.value = false
  }
}

// ---- API 端点测试 ----
interface TestItem {
  name: string
  method: string
  instance: 'adminApi' | 'pluginApi' | 'mainApi'
  path: string
  params?: Record<string, any>
  fullUrl: string
  status: 'pending' | 'loading' | 'success' | 'error'
  httpStatus: number | string
  responseHeaders: string
  responseBody: string
  errorMessage: string
}

function makeTest(
  name: string,
  method: string,
  instance: 'adminApi' | 'pluginApi' | 'mainApi',
  path: string,
  params?: Record<string, any>
): TestItem {
  const base = instance === 'adminApi'
    ? (adminApi.defaults.baseURL || '/backend/api/v1/plugin-admin')
    : instance === 'pluginApi'
      ? (pluginApi.defaults.baseURL || '/backend/api/v1/plugin')
      : (mainApi.defaults.baseURL || '/api/v1')
  const qs = params ? '?' + new URLSearchParams(params as any).toString() : ''
  return {
    name, method, instance, path, params,
    fullUrl: `${window.location.origin}${base}${path}${qs}`,
    status: 'pending', httpStatus: '', responseHeaders: '', responseBody: '', errorMessage: '',
  }
}

const tests = ref<TestItem[]>([
  makeTest('获取插件列表', 'GET', 'adminApi', '/plugins', { page: '1', per_page: '10' }),
  makeTest('获取组织列表', 'GET', 'mainApi', '/organization/list'),
  makeTest('验证 Token', 'GET', 'mainApi', '/plugin/verify-token'),
])

async function runSingle(item: TestItem) {
  item.status = 'loading'
  item.responseBody = ''
  item.responseHeaders = ''
  item.errorMessage = ''
  item.httpStatus = ''

  const inst = item.instance === 'adminApi'
    ? adminApi
    : item.instance === 'pluginApi'
      ? pluginApi
      : mainApi
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
  { name: 'adminApi /plugins', url: '/backend/api/v1/plugin-admin/plugins?page=1&per_page=5', status: 'pending', httpStatus: '', responseBody: '', errorMessage: '' },
  { name: 'mainApi /plugin/verify-token', url: '/api/v1/plugin/verify-token', status: 'pending', httpStatus: '', responseBody: '', errorMessage: '' },
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
  { name: '/backend/ → adminApi', url: '/backend/api/v1/plugin-admin/plugins?page=1&per_page=1', expectedBackend: 'proxy_pass → system-admin 后端', status: 'pending', httpStatus: '', responseHeaders: '', responseBody: '', latency: null, verdict: 'ok', verdictIcon: '', verdictText: '' },
  { name: '/api/ → mainApi', url: '/api/v1/plugin/verify-token', expectedBackend: 'proxy_pass → 主后端', status: 'pending', httpStatus: '', responseHeaders: '', responseBody: '', latency: null, verdict: 'ok', verdictIcon: '', verdictText: '' },
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
  void loadBackendDiagnostics()
  try {
    const resp = await fetch('/debug-env')
    if (!resp.ok) { envInfo.apiUpstream = `请求失败 (${resp.status})`; return }
    const text = await resp.text()
    let data: Record<string, string> = {}
    try { data = JSON.parse(text) } catch { envInfo.apiUpstream = '/debug-env 返回了非 JSON 内容'; return }

    const upstreams: string[] = []
    const backendUrls: string[] = []
    let i = 1
    while (data[`APP_BACKEND_${i}_URL`]) {
      backendUrls.push(data[`APP_BACKEND_${i}_URL`])
      upstreams.push(`APP_BACKEND_${i}_URL=${data[`APP_BACKEND_${i}_URL`]}`)
      i++
    }
    envInfo.apiUpstream = upstreams.length ? upstreams.join(' | ') : '未设置'
    envInfo.hostname = data.hostname || ''
    envInfo.serverBuildTime = data.buildTime || ''

    if (backendUrls.length) {
      proxyTests.value.forEach(t => {
        if (t.url.startsWith('/backend/')) {
          const backendPath = t.url.replace(/^\/backend/, '')
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
.section-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
.section h3 { margin: 0 0 12px; font-size: 16px; border-bottom: 1px solid var(--border-color, #eee); padding-bottom: 8px; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
.info-item { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; }
.backend-diagnostics { margin-top: 12px; }
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
.status-note { color: #606266; font-size: 12px; }
.latency { color: #909399; font-size: 12px; margin-top: 4px; }
</style>
