<template>
  <div class="organization-list">
    <div class="page-toolbar">
      <h3 class="page-title">{{ t('organization.title') }}</h3>
    </div>

    <div class="readonly-banner">
      {{ t('organization.readonlyHint') }}
    </div>

    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" :label="t('common.id')" width="100" />
        <el-table-column prop="title" :label="t('organization.organizationTitle')" min-width="180" />
        <el-table-column prop="name" :label="t('organization.organizationName')" min-width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getOrganizations, type OrganizationItem } from '../api'

const { t } = useI18n()

const loading = ref(false)
const tableData = ref<OrganizationItem[]>([])

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

onMounted(loadData)
</script>

<style scoped>
.organization-list {
  display: grid;
  gap: var(--spacing-lg);
}

.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.page-title {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-xl);
}

.readonly-banner {
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--warning-color, #e6a23c) 25%, white);
  background: color-mix(in srgb, var(--warning-color, #e6a23c) 12%, white);
  color: var(--text-primary);
}

.table-card {
  border: 1px solid var(--border-color);
}

@media (max-width: 640px) {
  .page-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
