<script setup lang="ts">
import { computed } from 'vue'
import { Pencil, Trash2 } from 'lucide-vue-next'
import ProgressBar from './ProgressBar.vue'
import type { Subject } from '../types'

const props = defineProps<{
  subject: Subject
}>()

const emit = defineEmits<{
  (e: 'edit', subject: Subject): void
  (e: 'remove', subject: Subject): void
}>()

const percent = computed(() => {
  if (props.subject.total <= 0) return 0
  const p = (props.subject.completed / props.subject.total) * 100
  return Math.round(Math.min(100, Math.max(0, p)))
})
</script>

<template>
  <div class="subject-card">
    <div class="subject-card__head">
      <div class="subject-card__name">
        {{ subject.name }}
      </div>
      <div class="subject-card__actions">
        <button class="btn btn--icon btn--sm" type="button" aria-label="编辑" @click="emit('edit', subject)">
          <Pencil :size="15" />
        </button>
        <button
          class="btn btn--icon btn--sm subject-card__del"
          type="button"
          aria-label="删除"
          @click="emit('remove', subject)"
        >
          <Trash2 :size="15" />
        </button>
      </div>
    </div>

    <div class="subject-card__stats">
      <span class="subject-card__count">
        <strong>{{ subject.completed }}</strong> / {{ subject.total }} {{ subject.unit }}
      </span>
      <span class="subject-card__percent">{{ percent }}%</span>
    </div>

    <ProgressBar :value="subject.completed" :max="subject.total" />
  </div>
</template>

<style scoped>
.subject-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 16px;
}
.subject-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.subject-card__name {
  font-size: 16px;
  font-weight: 620;
  color: var(--text);
}
.subject-card__actions {
  display: flex;
  gap: 6px;
}
.subject-card__del:hover {
  color: var(--danger);
  border-color: var(--danger);
}
.subject-card__stats {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}
.subject-card__count {
  font-size: 13.5px;
  color: var(--text-secondary);
}
.subject-card__count strong {
  font-size: 17px;
  font-weight: 650;
  color: var(--text);
}
.subject-card__percent {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--primary-strong);
}
</style>
