<template>
  <div class="menu-group-list">
    <div class="toolbar">
      <el-button type="primary" @click="openCreateDialog">{{ t('menuGroup.addTitle') }}</el-button>
    </div>

    <el-card>
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" :label="t('common.id')" width="160" />
        <el-table-column prop="name" :label="t('common.name')" min-width="120" />
        <el-table-column prop="icon" :label="t('common.icon')" width="100" />
        <el-table-column prop="order" :label="t('common.order')" width="80" />
        <el-table-column prop="domain" :label="t('common.domain')" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('common.actions')" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEditDialog(row)">{{ t('common.edit') }}</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">{{ t('common.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? t('menuGroup.editTitle') : t('menuGroup.addTitle')" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item :label="t('menuGroup.groupId')" prop="id">
          <el-input v-model="form.id" :placeholder="t('menuGroup.groupIdPlaceholder')" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item :label="t('common.name')" prop="name">
          <el-input v-model="form.name" :placeholder="t('menuGroup.namePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('common.icon')">
          <el-input v-model="form.icon" :placeholder="t('menuGroup.iconPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('common.order')">
          <el-input-number v-model="form.order" :min="0" />
        </el-form-item>
        <el-form-item :label="t('common.domain')">
          <el-input v-model="form.domain" :placeholder="t('menuGroup.domainPlaceholder')" />
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
import { getMenuGroups, createMenuGroup, updateMenuGroup, deleteMenuGroup } from '../api'

const { t } = useI18n()

interface MenuGroupItem {
  id: string
  name: string
  icon: string | null
  order: number
  domain: string | null
}

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<MenuGroupItem[]>([])
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const formRef = ref<FormInstance>()

const form = reactive({
  id: '',
  name: '',
  icon: '',
  order: 0,
  domain: '',
})

const rules: FormRules = {
  id: [{ required: true, message: () => t('menuGroup.messages.idRequired'), trigger: 'blur' }],
  name: [{ required: true, message: () => t('menuGroup.messages.nameRequired'), trigger: 'blur' }],
}

async function loadData() {
  loading.value = true
  try {
    const { data } = await getMenuGroups()
    if (data.code === 0) {
      tableData.value = data.data.items
    } else {
      ElMessage.error(data.message || t('common.messages.loadFailed'))
    }
  } catch (err: any) {
    const status = err?.response?.status
    if (status !== 401 && status !== 403) {
      ElMessage.error(t('menuGroup.messages.loadFailed'))
    }
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  editingId.value = null
  Object.assign(form, { id: '', name: '', icon: '', order: 0, domain: '' })
  dialogVisible.value = true
}

function openEditDialog(row: MenuGroupItem) {
  editingId.value = row.id
  Object.assign(form, {
    id: row.id,
    name: row.name,
    icon: row.icon || '',
    order: row.order,
    domain: row.domain || '',
  })
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      if (editingId.value) {
        const { data } = await updateMenuGroup({ ...form, id: editingId.value })
        if (data.code === 0) { ElMessage.success(t('common.messages.updateSuccess')); dialogVisible.value = false; loadData() }
        else ElMessage.error(data.message || t('common.messages.operationFailed'))
      } else {
        const { data } = await createMenuGroup(form)
        if (data.code === 0) { ElMessage.success(t('common.messages.createSuccess')); dialogVisible.value = false; loadData() }
        else ElMessage.error(data.message || t('common.messages.operationFailed'))
      }
    } catch {
      ElMessage.error(t('common.messages.operationFailed'))
    } finally {
      submitting.value = false
    }
  })
}

async function handleDelete(row: MenuGroupItem) {
  try {
    await ElMessageBox.confirm(t('menuGroup.deleteConfirm', { name: row.name }), t('common.deleteConfirmTitle'), { type: 'warning' })
    const { data } = await deleteMenuGroup(row.id)
    if (data.code === 0) { ElMessage.success(t('common.messages.deleteSuccess')); loadData() }
    else ElMessage.error(data.message || t('common.messages.operationFailed'))
  } catch {
    // 用户取消
  }
}

onMounted(loadData)
</script>

<style scoped>
.menu-group-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
