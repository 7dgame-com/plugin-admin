<template>
  <div class="plugin-list">
    <div class="toolbar">
      <el-button type="primary" @click="openCreateDialog">新增插件</el-button>
    </div>

    <el-card>
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="160" />
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="url" label="URL" min-width="200" show-overflow-tooltip />
        <el-table-column prop="group_id" label="所属分组" width="120" />
        <el-table-column label="启用" width="80">
          <template #default="{ row }">
            <el-switch :model-value="!!row.enabled" disabled />
          </template>
        </el-table-column>
        <el-table-column prop="domain" label="域名" width="160" show-overflow-tooltip />
        <el-table-column prop="version" label="版本" width="100" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
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
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑插件' : '新增插件'" width="600px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="插件ID" prop="id">
          <el-input v-model="form.id" placeholder="如: my-plugin" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="插件显示名称" />
        </el-form-item>
        <el-form-item label="URL" prop="url">
          <el-input v-model="form.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="所属分组">
          <el-select v-model="form.group_id" placeholder="选择分组" clearable style="width: 100%">
            <el-option
              v-for="g in menuGroups"
              :key="g.id"
              :label="g.name"
              :value="g.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="form.icon" placeholder="Element Plus 图标名" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.order" :min="0" />
        </el-form-item>
        <el-form-item label="版本">
          <el-input v-model="form.version" placeholder="1.0.0" />
        </el-form-item>
        <el-form-item label="域名">
          <el-input v-model="form.domain" placeholder="绑定域名（留空为默认）" />
        </el-form-item>
        <el-form-item label="允许来源">
          <el-input v-model="form.allowed_origin" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { getPlugins, createPlugin, updatePlugin, deletePlugin, getMenuGroups } from '../api'

interface PluginItem {
  id: string
  name: string
  url: string
  group_id: string | null
  enabled: number
  domain: string | null
  version: string | null
  icon: string | null
  order: number
  description: string | null
  allowed_origin: string | null
}

interface MenuGroup {
  id: string
  name: string
}

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<PluginItem[]>([])
const menuGroups = ref<MenuGroup[]>([])
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const formRef = ref<FormInstance>()

const pagination = reactive({ page: 1, perPage: 20, total: 0 })

const form = reactive({
  id: '',
  name: '',
  url: '',
  group_id: '',
  icon: '',
  enabled: true,
  order: 0,
  version: '',
  domain: '',
  allowed_origin: '',
  description: '',
})

const rules: FormRules = {
  id: [{ required: true, message: '请输入插件ID', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  url: [{ required: true, message: '请输入URL', trigger: 'blur' }],
}

async function loadData() {
  loading.value = true
  try {
    const { data } = await getPlugins({ page: pagination.page, per_page: pagination.perPage })
    if (data.code === 0) {
      tableData.value = data.data.items
      pagination.total = data.data.total
    } else {
      ElMessage.error(data.message || '加载失败')
    }
  } catch {
    ElMessage.error('加载插件列表失败')
  } finally {
    loading.value = false
  }
}

async function loadMenuGroups() {
  try {
    const { data } = await getMenuGroups()
    if (data.code === 0) menuGroups.value = data.data.items
  } catch {
    // 静默失败
  }
}

function openCreateDialog() {
  editingId.value = null
  Object.assign(form, { id: '', name: '', url: '', group_id: '', icon: '', enabled: true, order: 0, version: '', domain: '', allowed_origin: '', description: '' })
  dialogVisible.value = true
}

function openEditDialog(row: PluginItem) {
  editingId.value = row.id
  Object.assign(form, {
    id: row.id,
    name: row.name,
    url: row.url,
    group_id: row.group_id || '',
    icon: row.icon || '',
    enabled: !!row.enabled,
    order: row.order,
    version: row.version || '',
    domain: row.domain || '',
    allowed_origin: row.allowed_origin || '',
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
      const payload = { ...form, enabled: form.enabled ? 1 : 0 }
      if (editingId.value) {
        const { data } = await updatePlugin(payload)
        if (data.code === 0) { ElMessage.success('更新成功'); dialogVisible.value = false; loadData() }
        else ElMessage.error(data.message || '更新失败')
      } else {
        const { data } = await createPlugin(payload)
        if (data.code === 0) { ElMessage.success('创建成功'); dialogVisible.value = false; loadData() }
        else ElMessage.error(data.message || '创建失败')
      }
    } catch {
      ElMessage.error('操作失败')
    } finally {
      submitting.value = false
    }
  })
}

async function handleDelete(row: PluginItem) {
  try {
    await ElMessageBox.confirm(`确定删除插件 "${row.name}"？`, '确认删除', { type: 'warning' })
    const { data } = await deletePlugin(row.id)
    if (data.code === 0) { ElMessage.success('删除成功'); loadData() }
    else ElMessage.error(data.message || '删除失败')
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  loadData()
  loadMenuGroups()
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
</style>
