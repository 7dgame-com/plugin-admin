<template>
  <div class="menu-group-list">
    <div class="toolbar">
      <el-button type="primary" @click="openCreateDialog">新增菜单分组</el-button>
    </div>

    <el-card>
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="160" />
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="icon" label="图标" width="100" />
        <el-table-column prop="order" label="排序" width="80" />
        <el-table-column prop="domain" label="域名" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑菜单分组' : '新增菜单分组'" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="分组ID" prop="id">
          <el-input v-model="form.id" placeholder="如: tools" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="分组显示名称" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="form.icon" placeholder="Element Plus 图标名" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.order" :min="0" />
        </el-form-item>
        <el-form-item label="域名">
          <el-input v-model="form.domain" placeholder="绑定域名（留空为默认）" />
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
import { getMenuGroups, createMenuGroup, updateMenuGroup, deleteMenuGroup } from '../api'

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
  id: [{ required: true, message: '请输入分组ID', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
}

async function loadData() {
  loading.value = true
  try {
    const { data } = await getMenuGroups()
    if (data.code === 0) {
      tableData.value = data.data.items
    } else {
      ElMessage.error(data.message || '加载失败')
    }
  } catch {
    ElMessage.error('加载菜单分组失败')
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
        if (data.code === 0) { ElMessage.success('更新成功'); dialogVisible.value = false; loadData() }
        else ElMessage.error(data.message || '更新失败')
      } else {
        const { data } = await createMenuGroup(form)
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

async function handleDelete(row: MenuGroupItem) {
  try {
    await ElMessageBox.confirm(`确定删除菜单分组 "${row.name}"？`, '确认删除', { type: 'warning' })
    const { data } = await deleteMenuGroup(row.id)
    if (data.code === 0) { ElMessage.success('删除成功'); loadData() }
    else ElMessage.error(data.message || '删除失败')
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
