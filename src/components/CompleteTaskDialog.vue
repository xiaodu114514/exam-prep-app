<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import ModalSheet from './ModalSheet.vue'
import type { Task } from '../types'

const props = defineProps<{
  task: Task
  subjectName?: string
  subjectUnit?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', amount: number): void
}>()

const form = reactive({ amount: '' })
const error = ref('')

watch(
  () => props.task,
  (t) => {
    // 默认值为任务设置的数量
    form.amount = t.amount != null ? String(t.amount) : ''
    error.value = ''
  },
  { immediate: true },
)

function submit() {
  const raw = String(form.amount ?? '').trim()
  if (raw === '') {
    error.value = '请输入实际完成量'
    return
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    error.value = '实际完成量必须是不小于 0 的数字'
    return
  }
  emit('confirm', n)
}

function quickFill() {
  if (props.task.amount != null) form.amount = String(props.task.amount)
}
</script>

<template>
  <ModalSheet title="完成任务" @close="emit('close')">
    <p class="complete-task__name">{{ task.title }}</p>
    <p class="complete-task__hint">
      计划量：<strong>{{ task.amount }}</strong> {{ subjectUnit ?? '项' }}
    </p>

    <div class="field">
      <label class="label" for="actual-amount">实际完成量（{{ subjectUnit ?? '项' }}）</label>
      <input
        id="actual-amount"
        v-model="form.amount"
        class="input"
        type="number"
        min="0"
        inputmode="numeric"
        placeholder="请输入实际完成量"
      />
      <div class="complete-task__quick">
        <button class="btn btn--ghost btn--sm" type="button" @click="quickFill">
          按计划量填写
        </button>
        <span class="complete-task__tip">按实际完成量累计到「{{ subjectName ?? '该科目' }}」的背诵进度</span>
      </div>
    </div>

    <p v-if="error" class="field-error">{{ error }}</p>

    <template #footer>
      <button class="btn btn--ghost" type="button" @click="emit('close')">取消</button>
      <button class="btn btn--primary" type="button" @click="submit">确认完成</button>
    </template>
  </ModalSheet>
</template>

<style scoped>
.complete-task__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  overflow-wrap: anywhere;
}
.complete-task__hint {
  margin-top: 6px;
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--text-muted);
}
.complete-task__hint strong {
  color: var(--text);
  font-weight: 650;
}
.complete-task__quick {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.complete-task__tip {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}
</style>
