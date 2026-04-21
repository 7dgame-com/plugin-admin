<template>
  <div class="plugin-list">
    <div class="toolbar">
      <el-button type="primary" @click="openCreateDialog">{{ t('plugin.addTitle') }}</el-button>
    </div>

    <el-card>
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" :label="t('common.id')" width="160" />
        <el-table-column prop="name" :label="t('common.name')" min-width="120" />
        <el-table-column prop="url" :label="t('common.url')" min-width="200" show-overflow-tooltip />
        <el-table-column :label="t('organization.binding')" min-width="180">
          <template #default="{ row }">
            <span>{{ getOrganizationLabel(row.organization_name) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('plugin.accessScope')" min-width="150">
          <template #default="{ row }">
            <span>{{ getAccessScopeLabel(row.access_scope) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('common.enabled')" width="80">
          <template #default="{ row }">
            <el-switch
              :model-value="!!row.enabled"
              :loading="isPluginTogglePending(row.id)"
              :disabled="isPluginTogglePending(row.id)"
              :before-change="() => handleEnabledBeforeChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="version" :label="t('common.version')" width="100" />
        <el-table-column :label="t('common.actions')" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEditDialog(row)">{{ t('common.edit') }}</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">{{ t('common.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination"
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.perPage"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="loadData"
        @size-change="loadData"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? t('plugin.editTitle') : t('plugin.addTitle')" width="600px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="110px">
        <el-form-item :label="t('plugin.pluginId')" prop="id">
          <el-input v-model="form.id" :placeholder="t('plugin.pluginIdPlaceholder')" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item :label="t('common.name')" prop="name">
          <el-input v-model="form.name" :placeholder="t('plugin.namePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('common.url')" prop="url">
          <el-input v-model="form.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item :label="t('organization.binding')">
          <el-select
            v-model="form.organization_name"
            :placeholder="t('plugin.organizationPlaceholder')"
            clearable
            style="width: 100%"
          >
            <el-option :label="t('organization.publicOption')" value="" />
            <el-option
              v-for="organization in organizations"
              :key="organization.id"
              :label="organization.title"
              :value="organization.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('plugin.accessScope')">
          <el-select
            v-model="form.access_scope"
            :placeholder="t('plugin.accessScopePlaceholder')"
            style="width: 100%"
          >
            <el-option :label="t('plugin.accessScopes.authOnly')" value="auth-only" />
            <el-option :label="t('plugin.accessScopes.adminOnly')" value="admin-only" />
            <el-option :label="t('plugin.accessScopes.managerOnly')" value="manager-only" />
            <el-option :label="t('plugin.accessScopes.rootOnly')" value="root-only" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('common.icon')">
          <el-input v-model="form.icon" :placeholder="t('plugin.iconPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('common.enabled')">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item :label="t('common.order')">
          <el-input-number v-model="form.order" :min="0" />
        </el-form-item>
        <el-form-item :label="t('common.version')">
          <el-input v-model="form.version" :placeholder="t('plugin.versionPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('plugin.pluginOrigin')">
          <el-input
            :model-value="derivedPluginOrigin"
            :placeholder="t('plugin.pluginOriginPlaceholder')"
            disabled
          />
        </el-form-item>
        <el-form-item :label="t('plugin.allowedHostOrigins')">
          <el-select
            v-model="form.allowed_host_origins"
            multiple
            filterable
            allow-create
            default-first-option
            clearable
            collapse-tags
            collapse-tags-tooltip
            :reserve-keyword="false"
            style="width: 100%"
            :placeholder="t('plugin.allowedHostOriginsPlaceholder')"
          />
          <div class="form-hint">{{ t('plugin.allowedHostOriginsHint') }}</div>
        </el-form-item>
        <el-form-item :label="t('common.description')">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  createPlugin,
  deletePlugin,
  getOrganizations,
  getPlugins,
  updatePlugin,
  type OrganizationItem,
} from '../api'
import { notifyHostPluginRegistryChanged } from '../utils/hostEvents'

const { t } = useI18n()

interface PluginItem {
  id: string
  name: string
  url: string
  organization_name: string | null
  access_scope: 'auth-only' | 'admin-only' | 'manager-only' | 'root-only'
  enabled: number
  version: string | null
  icon: string | null
  order: number
  description: string | null
  allowed_origin: string | null
  allowed_host_origins?: string[]
}

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<PluginItem[]>([])
const organizations = ref<OrganizationItem[]>([])
const togglingPluginIds = reactive<Record<string, boolean>>({})
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const formRef = ref<FormInstance>()

const pagination = reactive({ page: 1, perPage: 20, total: 0 })

const form = reactive({
  id: '',
  name: '',
  url: '',
  organization_name: '',
  access_scope: 'auth-only' as PluginItem['access_scope'],
  icon: '',
  enabled: true,
  order: 0,
  version: '',
  allowed_host_origins: [] as string[],
  description: '',
})

const rules: FormRules = {
  id: [{ required: true, message: () => t('plugin.messages.idRequired'), trigger: 'blur' }],
  name: [{ required: true, message: () => t('plugin.messages.nameRequired'), trigger: 'blur' }],
  url: [{ required: true, message: () => t('plugin.messages.urlRequired'), trigger: 'blur' }],
}

function getOrganizationLabel(organizationName: string | null) {
  if (!organizationName) {
    return t('organization.publicOption')
  }

  const organization = organizations.value.find((item) => item.name === organizationName)
  return organization?.title || organizationName
}

function getAccessScopeLabel(accessScope: PluginItem['access_scope']) {
  switch (accessScope) {
    case 'admin-only':
      return t('plugin.accessScopes.adminOnly')
    case 'manager-only':
      return t('plugin.accessScopes.managerOnly')
    case 'root-only':
      return t('plugin.accessScopes.rootOnly')
    default:
      return t('plugin.accessScopes.authOnly')
  }
}

function getOriginFromUrl(value: string) {
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

function normalizeOriginList(values: string[]) {
  const seen = new Set<string>()
  const origins: string[] = []

  values.forEach((value) => {
    const origin = getOriginFromUrl(value.trim())
    if (!origin || seen.has(origin)) return
    seen.add(origin)
    origins.push(origin)
  })

  return origins
}

const derivedPluginOrigin = computed(() => getOriginFromUrl(form.url))

function isPluginTogglePending(pluginId: string) {
  return togglingPluginIds[pluginId] === true
}

async function handleEnabledBeforeChange(row: PluginItem) {
  const nextEnabled = row.enabled ? 0 : 1
  const confirmMessage = nextEnabled
    ? t('plugin.enableConfirm', { name: row.name })
    : t('plugin.disableConfirm', { name: row.name })

  try {
    await ElMessageBox.confirm(confirmMessage, t('plugin.toggleConfirmTitle'), {
      type: 'warning',
    })
  } catch {
    return false
  }

  togglingPluginIds[row.id] = true

  try {
    const { data } = await updatePlugin({
      id: row.id,
      enabled: nextEnabled,
    })

    if (data.code === 0) {
      row.enabled = nextEnabled
      ElMessage.success(t('common.messages.updateSuccess'))
      notifyHostPluginRegistryChanged()
    } else {
      ElMessage.error(data.message || t('common.messages.operationFailed'))
    }
  } catch {
    ElMessage.error(t('common.messages.operationFailed'))
  } finally {
    delete togglingPluginIds[row.id]
  }

  return false
}

async function loadData() {
  loading.value = true
  try {
    const { data } = await getPlugins({ page: pagination.page, per_page: pagination.perPage })
    if (data.code === 0) {
      tableData.value = data.data.items
      pagination.total = data.data.total
    } else {
      ElMessage.error(data.message || t('common.messages.loadFailed'))
    }
  } catch (err: any) {
    const status = err?.response?.status
    if (status !== 401 && status !== 403) {
      ElMessage.error(t('plugin.messages.loadFailed'))
    }
  } finally {
    loading.value = false
  }
}

async function loadOrganizations() {
  try {
    const { data } = await getOrganizations()
    if (data.code === 0) {
      organizations.value = data.data
    }
  } catch (err: any) {
    const status = err?.response?.status
    if (status !== 401 && status !== 403) {
      ElMessage.error(t('organization.messages.loadFailed'))
    }
  }
}

function resetForm() {
  Object.assign(form, {
    id: '',
    name: '',
    url: '',
    organization_name: '',
    access_scope: 'auth-only',
    icon: '',
    enabled: true,
    order: 0,
    version: '',
    allowed_host_origins: [],
    description: '',
  })
}

function openCreateDialog() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row: PluginItem) {
  editingId.value = row.id
  Object.assign(form, {
    id: row.id,
    name: row.name,
    url: row.url,
    organization_name: row.organization_name || '',
    access_scope: row.access_scope || 'auth-only',
    icon: row.icon || '',
    enabled: !!row.enabled,
    order: row.order,
    version: row.version || '',
    allowed_host_origins: row.allowed_host_origins || [],
    description: row.description || '',
  })
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    submitting.value = true
    try {
      const invalidAllowedHostOrigin = form.allowed_host_origins.find((value) => {
        const trimmed = value.trim()
        return trimmed !== '' && getOriginFromUrl(trimmed) === ''
      })
      if (invalidAllowedHostOrigin) {
        ElMessage.error(t('plugin.messages.allowedHostOriginInvalid'))
        return
      }

      const payload = {
        ...form,
        enabled: form.enabled ? 1 : 0,
        organization_name: form.organization_name || null,
        allowed_host_origins: normalizeOriginList(form.allowed_host_origins),
      }

      if (editingId.value) {
        const { data } = await updatePlugin(payload)
        if (data.code === 0) {
          ElMessage.success(t('common.messages.updateSuccess'))
          notifyHostPluginRegistryChanged()
          dialogVisible.value = false
          loadData()
        } else {
          ElMessage.error(data.message || t('common.messages.operationFailed'))
        }
      } else {
        const { data } = await createPlugin(payload)
        if (data.code === 0) {
          ElMessage.success(t('common.messages.createSuccess'))
          notifyHostPluginRegistryChanged()
          dialogVisible.value = false
          loadData()
        } else {
          ElMessage.error(data.message || t('common.messages.operationFailed'))
        }
      }
    } catch {
      ElMessage.error(t('common.messages.operationFailed'))
    } finally {
      submitting.value = false
    }
  })
}

async function handleDelete(row: PluginItem) {
  try {
    await ElMessageBox.confirm(
      t('plugin.deleteConfirm', { name: row.name }),
      t('common.deleteConfirmTitle'),
      { type: 'warning' }
    )
    const { data } = await deletePlugin(row.id)
    if (data.code === 0) {
      ElMessage.success(t('common.messages.deleteSuccess'))
      notifyHostPluginRegistryChanged()
      loadData()
    } else {
      ElMessage.error(data.message || t('common.messages.operationFailed'))
    }
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  loadData()
  loadOrganizations()
})
</script>

<style scoped>
.plugin-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}

.pagination {
  margin-top: var(--spacing-md);
  justify-content: flex-end;
}

.form-hint {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}
</style>
