<template>
  <div class="organization-list">
    <div class="toolbar">
      <el-button type="primary" @click="openCreateDialog">{{ t('organization.addTitle') }}</el-button>
    </div>

    <el-card>
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" :label="t('common.id')" width="100" />
        <el-table-column prop="title" :label="t('organization.organizationTitle')" min-width="180" />
        <el-table-column prop="name" :label="t('organization.organizationName')" min-width="180" />
        <el-table-column :label="t('common.actions')" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEditDialog(row)">{{ t('common.edit') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="binding-card">
      <template #header>
        <div class="binding-header">
          <span>{{ t('organization.bindUserTitle') }}</span>
        </div>
      </template>

      <p class="binding-hint">{{ t('organization.bindingHint') }}</p>

      <el-form :model="bindingForm" label-width="110px" class="binding-form">
        <el-form-item :label="t('organization.userId')">
          <el-input v-model="bindingForm.user_id" :placeholder="t('organization.userIdPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('organization.organizationTitle')">
          <el-select
            v-model="bindingForm.organization_id"
            :placeholder="t('organization.bindingPlaceholder')"
            style="width: 100%"
          >
            <el-option
              v-for="organization in tableData"
              :key="organization.id"
              :label="organization.title"
              :value="organization.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="bindingLoading" @click="handleBind">
            {{ t('organization.bindAction') }}
          </el-button>
          <el-button :loading="unbindingLoading" @click="handleUnbind">
            {{ t('organization.unbindAction') }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? t('organization.editTitle') : t('organization.addTitle')"
      width="520px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item :label="t('organization.organizationTitle')" prop="title">
          <el-input v-model="form.title" :placeholder="t('organization.organizationTitlePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('organization.organizationName')" prop="name">
          <el-input
            v-model="form.name"
            :placeholder="t('organization.organizationNamePlaceholder')"
            :disabled="!!editingId"
          />
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
import { reactive, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  bindOrganizationUser,
  createOrganization,
  getOrganizations,
  unbindOrganizationUser,
  updateOrganization,
  type OrganizationItem,
} from '../api'

const { t } = useI18n()

const loading = ref(false)
const submitting = ref(false)
const bindingLoading = ref(false)
const unbindingLoading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const tableData = ref<OrganizationItem[]>([])

const form = reactive({
  title: '',
  name: '',
})

const bindingForm = reactive({
  user_id: '',
  organization_id: null as number | null,
})

const rules: FormRules = {
  title: [{ required: true, message: () => t('organization.messages.titleRequired'), trigger: 'blur' }],
  name: [{ required: true, message: () => t('organization.messages.nameRequired'), trigger: 'blur' }],
}

async function loadData() {
  loading.value = true
  try {
    const { data } = await getOrganizations()
    if (data.code === 0) {
      tableData.value = data.data
    } else {
      ElMessage.error(data.message || t('organization.messages.loadFailed'))
    }
  } catch (err: any) {
    const status = err?.response?.status
    if (status !== 401 && status !== 403) {
      ElMessage.error(t('organization.messages.loadFailed'))
    }
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.title = ''
  form.name = ''
}

function openCreateDialog() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row: OrganizationItem) {
  editingId.value = row.id
  form.title = row.title
  form.name = row.name
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    submitting.value = true
    try {
      if (editingId.value) {
        const { data } = await updateOrganization({
          id: editingId.value,
          title: form.title,
        })
        if (data.code === 0) {
          ElMessage.success(t('common.messages.updateSuccess'))
          dialogVisible.value = false
          loadData()
        } else {
          ElMessage.error(data.message || t('common.messages.operationFailed'))
        }
      } else {
        const { data } = await createOrganization({
          title: form.title,
          name: form.name,
        })
        if (data.code === 0) {
          ElMessage.success(t('common.messages.createSuccess'))
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

function getBindingPayload() {
  const userId = Number(bindingForm.user_id)
  if (!Number.isInteger(userId) || userId <= 0) {
    ElMessage.error(t('organization.messages.userIdRequired'))
    return null
  }

  if (!bindingForm.organization_id) {
    ElMessage.error(t('organization.messages.organizationRequired'))
    return null
  }

  return {
    user_id: userId,
    organization_id: bindingForm.organization_id,
  }
}

async function handleBind() {
  const payload = getBindingPayload()
  if (!payload) return

  bindingLoading.value = true
  try {
    const { data } = await bindOrganizationUser(payload)
    if (data.code === 0) {
      ElMessage.success(t('organization.messages.bindSuccess'))
    } else {
      ElMessage.error(data.message || t('common.messages.operationFailed'))
    }
  } catch {
    ElMessage.error(t('common.messages.operationFailed'))
  } finally {
    bindingLoading.value = false
  }
}

async function handleUnbind() {
  const payload = getBindingPayload()
  if (!payload) return

  unbindingLoading.value = true
  try {
    const { data } = await unbindOrganizationUser(payload)
    if (data.code === 0) {
      ElMessage.success(t('organization.messages.unbindSuccess'))
    } else {
      ElMessage.error(data.message || t('common.messages.operationFailed'))
    }
  } catch {
    ElMessage.error(t('common.messages.operationFailed'))
  } finally {
    unbindingLoading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.organization-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}

.binding-card {
  margin-top: 0;
}

.binding-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.binding-hint {
  margin: 0 0 var(--spacing-md);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.binding-form {
  max-width: 560px;
}
</style>
