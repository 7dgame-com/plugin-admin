<template>
  <div class="permission-list">
    <!-- 搜索表单 -->
    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="角色/权限">
          <el-input v-model="searchForm.role_or_permission" placeholder="搜索角色或权限" clearable />
        </el-form-item>
        <el-form-item label="插件标识">
          <el-input v-model="searchForm.plugin_name" placeholder="搜索插件" clearable />
        </el-form-item>
        <el-form-item label="操作">
          <el-input v-model="searchForm.action" placeholder="搜索操作" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作栏 -->
    <div class="toolbar">
      <el-button type="primary" @click="openCreateDialog">新增权限配置</el-button>
    </div>

    <!-- 表格 -->
    <el-card>
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="role_or_permission" label="角色/权限名" min-width="150" />
        <el-table-column prop="plugin_name" label="插件标识" min-width="150" />
        <el-table-column prop="action" label="操作" min-width="150" />
        <el-table-column prop="created_at" label="创建时间" width="180" />
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
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑权限配置' : '新增权限配置'" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="角色/权限" prop="role_or_permission">
          <el-input v-model="form.role_or_permission" placeholder="如: root, admin" />
        </el-form-item>
        <el-form-item label="插件标识" prop="plugin_name">
          <el-input v-model="form.plugin_name" placeholder="如: user-management" />
        </el-form-item>
        <el-form-item label="操作" prop="action">
          <el-input v-model="form.action" placeholder="如: manage-permissions" />
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
import {
  getPermissions,
  createPermission,
  updatePermission,
  deletePermission,
} from '../api'

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
  role_or_permission: [{ required: true, message: '请输入角色/权限名', trigger: 'blur' }],
  plugin_name: [{ required: true, message: '请输入插件标识', trigger: 'blur' }],
  action: [{ required: true, message: '请输入操作', trigger: 'blur' }],
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
      ElMessage.error(data.message || '加载失败')
    }
  } catch {
    ElMessage.error('加载权限配置失败')
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
        const { data } = await updatePermission({ id: editingId.value, ...form })
        if (data.code === 0) {
          ElMessage.success('更新成功')
          dialogVisible.value = false
          loadData()
        } else {
          ElMessage.error(data.message || '更新失败')
        }
      } else {
        const { data } = await createPermission(form)
        if (data.code === 0) {
          ElMessage.success('创建成功')
          dialogVisible.value = false
          loadData()
        } else {
          ElMessage.error(data.message || '创建失败')
        }
      }
    } catch {
      ElMessage.error('操作失败')
    } finally {
      submitting.value = false
    }
  })
}

async function handleDelete(row: PermissionItem) {
  try {
    await ElMessageBox.confirm(`确定删除权限配置 "${row.role_or_permission} / ${row.plugin_name} / ${row.action}"？`, '确认删除', {
      type: 'warning',
    })
    const { data } = await deletePermission(row.id)
    if (data.code === 0) {
      ElMessage.success('删除成功')
      loadData()
    } else {
      ElMessage.error(data.message || '删除失败')
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
