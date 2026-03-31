<template>
  <div class="permission-list">
    <!-- 搜索表单 -->
    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item :label="t('permission.roleOrPermission')">
          <el-input v-model="searchForm.role_or_permission" :placeholder="t('permission.searchRolePlaceholder')" clearable />
        </el-form-item>
        <el-form-item :label="t('permission.pluginName')">
          <el-input v-model="searchForm.plugin_name" :placeholder="t('permission.searchPluginPlaceholder')" clearable />
        </el-form-item>
        <el-form-item :label="t('permission.action')">
          <el-input v-model="searchForm.action" :placeholder="t('permission.searchActionPlaceholder')" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">{{ t('common.search') }}</el-button>
          <el-button @click="resetSearch">{{ t('common.reset') }}</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作栏 -->
    <div class="toolbar">
      <el-button type="primary" @click="openCreateDialog">{{ t('permission.addTitle') }}</el-button>
    </div>

    <!-- 表格 -->
    <el-card>
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" :label="t('common.id')" width="80" />
        <el-table-column prop="role_or_permission" :label="t('permission.roleOrPermissionLabel')" min-width="150" />
        <el-table-column prop="plugin_name" :label="t('permission.pluginName')" min-width="150" />
        <el-table-column prop="action" :label="t('permission.action')" min-width="150" />
        <el-table-column prop="created_at" :label="t('common.createdAt')" width="180" />
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

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? t('permission.editTitle') : t('permission.addTitle')" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item :label="t('permission.roleOrPermission')" prop="role_or_permission">
          <el-input v-model="form.role_or_permission" :placeholder="t('permission.rolePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('permission.pluginName')" prop="plugin_name">
          <el-input v-model="form.plugin_name" :placeholder="t('permission.pluginPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('permission.action')" prop="action">
          <el-input v-model="form.action" :placeholder="t('permission.actionPlaceholder')" />
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
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  getPermissions,
  createPermission,
  updatePermission,
  deletePermission,
} from '../api'

const { t } = useI18n()

interface PermissionItem {
  id: number
  role_or_permission: string
  plugin_name: string
  action: string
  created_at: string
  updated_at: string
}

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<PermissionItem[]>([])
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const searchForm = reactive({
  role_or_permission: '',
  plugin_name: '',
  action: '',
})

const pagination = reactive({
  page: 1,
  perPage: 20,
  total: 0,
})

const form = reactive({
  role_or_permission: '',
  plugin_name: '',
  action: '',
})

const rules: FormRules = {
  role_or_permission: [{ required: true, message: () => t('permission.messages.roleRequired'), trigger: 'blur' }],
  plugin_name: [{ required: true, message: () => t('permission.messages.pluginRequired'), trigger: 'blur' }],
  action: [{ required: true, message: () => t('permission.messages.actionRequired'), trigger: 'blur' }],
}

async function loadData() {
  loading.value = true
  try {
    const { data } = await getPermissions({
      role_or_permission: searchForm.role_or_permission || undefined,
      plugin_name: searchForm.plugin_name || undefined,
      action: searchForm.action || undefined,
      page: pagination.page,
      per_page: pagination.perPage,
    })
    if (data.code === 0) {
      tableData.value = data.data.items
      pagination.total = data.data.total
    } else {
      ElMessage.error(data.message || t('common.messages.loadFailed'))
    }
  } catch {
    ElMessage.error(t('permission.messages.loadFailed'))
  } finally {
    loading.value = false
  }
}

function resetSearch() {
  searchForm.role_or_permission = ''
  searchForm.plugin_name = ''
  searchForm.action = ''
  pagination.page = 1
  loadData()
}

function openCreateDialog() {
  editingId.value = null
  form.role_or_permission = ''
  form.plugin_name = ''
  form.action = ''
  dialogVisible.value = true
}

function openEditDialog(row: PermissionItem) {
  editingId.value = row.id
  form.role_or_permission = row.role_or_permission
  form.plugin_name = row.plugin_name
  form.action = row.action
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      if (editingId.value) {
        const { data } = await updatePermission({ ...form, id: editingId.value })
        if (data.code === 0) {
          ElMessage.success(t('common.messages.updateSuccess'))
          dialogVisible.value = false
          loadData()
        } else {
          ElMessage.error(data.message || t('common.messages.operationFailed'))
        }
      } else {
        const { data } = await createPermission(form)
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

async function handleDelete(row: PermissionItem) {
  try {
    await ElMessageBox.confirm(
      t('permission.deleteConfirm', { role: row.role_or_permission, plugin: row.plugin_name, action: row.action }),
      t('common.deleteConfirmTitle'),
      { type: 'warning' }
    )
    const { data } = await deletePermission(row.id)
    if (data.code === 0) {
      ElMessage.success(t('common.messages.deleteSuccess'))
      loadData()
    } else {
      ElMessage.error(data.message || t('common.messages.operationFailed'))
    }
  } catch {
    // 用户取消
  }
}

onMounted(loadData)
</script>

<style scoped>
.permission-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.search-card {
  margin-bottom: 0;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}

.pagination {
  margin-top: var(--spacing-md);
  justify-content: flex-end;
}
</style>
