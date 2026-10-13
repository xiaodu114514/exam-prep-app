<script setup lang="ts">
import type { Component } from 'vue'
import { Plus } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    icon: Component
    title: string
    desc?: string
    actionText?: string
  }>(),
  { desc: '', actionText: '' },
)

const emit = defineEmits<{
  (e: 'action'): void
}>()
</script>

<template>
  <div class="empty">
    <div class="empty__icon">
      <component :is="icon" :size="24" :stroke-width="1.8" />
    </div>
    <p class="empty__title">{{ title }}</p>
    <p v-if="desc" class="empty__desc">{{ desc }}</p>
    <button
      v-if="actionText"
      class="btn btn--soft btn--sm empty__action"
      type="button"
      @click="emit('action')"
    >
      <Plus :size="16" />
      {{ actionText }}
    </button>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 36px 20px;
}
.empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--surface-2);
  color: var(--text-muted);
  margin-bottom: 12px;
}
.empty__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
}
.empty__desc {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-muted);
  max-width: 260px;
  line-height: 1.5;
}
.empty__action {
  margin-top: 14px;
}
</style>
