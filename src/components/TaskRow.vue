<script setup lang="ts">
import { Check, Pencil, Trash2 } from 'lucide-vue-next'
import type { Task } from '../types'

defineProps<{
  task: Task
  subjectName?: string
  subjectUnit?: string
}>()

const emit = defineEmits<{
  (e: 'toggle', id: string): void
  (e: 'edit', task: Task): void
  (e: 'remove', task: Task): void
}>()
</script>

<template>
  <div class="task-row" :class="{ 'task-row--done': task.completed }">
    <button
      class="check"
      type="button"
      role="checkbox"
      :aria-checked="task.completed"
      :aria-label="task.completed ? '标记为未完成' : '标记为已完成'"
      @click="emit('toggle', task.id)"
    >
      <Check v-if="task.completed" :size="15" :stroke-width="3" />
    </button>

    <div class="task-row__main">
      <p class="task-row__title">{{ task.title }}</p>
      <div v-if="task.daily || subjectName || (task.amount && task.amount > 0)" class="task-row__meta">
        <span v-if="task.daily" class="chip">每日</span>
        <span v-if="subjectName" class="chip chip--primary">{{ subjectName }}</span>
        <span v-if="task.amount && task.amount > 0" class="chip chip--amount">
          +{{ task.amount }} {{ subjectUnit }}
        </span>
      </div>
    </div>

    <div class="task-row__actions">
      <button class="btn btn--icon btn--sm" type="button" aria-label="编辑" @click="emit('edit', task)">
        <Pencil :size="15" />
      </button>
      <button
        class="btn btn--icon btn--sm task-row__del"
        type="button"
        aria-label="删除"
        @click="emit('remove', task)"
      >
        <Trash2 :size="15" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.task-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 0;
}
.task-row + .task-row {
  border-top: 1px solid var(--border);
}
.check {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  border: 2px solid var(--border-strong);
  background: var(--surface);
  color: #fff;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.task-row--done .check {
  background: var(--primary);
  border-color: var(--primary);
}
.task-row__main {
  flex: 1;
  min-width: 0;
}
.task-row__title {
  font-size: 14.5px;
  font-weight: 520;
  color: var(--text);
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.task-row--done .task-row__title {
  color: var(--text-muted);
  text-decoration: line-through;
}
.task-row__meta {
  margin-top: 5px;
}
.task-row__actions {
  flex: none;
  display: flex;
  gap: 6px;
}
.task-row__del:hover {
  color: var(--danger);
  border-color: var(--danger);
}
</style>
