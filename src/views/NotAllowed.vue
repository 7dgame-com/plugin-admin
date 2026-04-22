<template>
  <div class="not-allowed">
    <div class="not-allowed-card">
      <el-empty :description="description" />
      <p class="not-allowed-hint">{{ hint }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t } = useI18n()

const isRootOnly = computed(() => route.query.reason === 'root')
const isManagerOnly = computed(() => route.query.reason === 'manager')
const description = computed(() =>
  isRootOnly.value
    ? t('layout.rootOnlyDenied')
    : isManagerOnly.value
      ? t('layout.managerOnlyDenied')
      : t('layout.permissionDenied')
)
const hint = computed(() =>
  isRootOnly.value
    ? t('auth.rootOnly')
    : isManagerOnly.value
      ? t('auth.managerOnly')
      : t('layout.noPermission')
)
</script>

<style scoped>
.not-allowed {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 24px;
}

.not-allowed-card {
  width: min(100%, 420px);
  padding: 32px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 22px 60px rgba(24, 39, 75, 0.12);
}

.not-allowed-hint {
  margin: 16px 0 0;
  text-align: center;
  color: #64748b;
}
</style>
