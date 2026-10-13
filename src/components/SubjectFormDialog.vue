<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import ModalSheet from './ModalSheet.vue'
import type { Subject } from '../types'

const props = defineProps<{
  subject: Subject | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', input: { name: string; unit: string; total: number; completed: number }): void
}>()

const form = reactive<{
  name: string
  unit: string
  // type="number" 的 v-model 会自动绑定为 number，因此兼容 string | number
  total: string | number
  completed: string | number
}>({ name: '', unit: '', total: '', completed: '' })
const error = ref('')

watch(
  () => props.subject,
  (s) => {
    form.name = s?.name ?? ''
    form.unit = s?.unit ?? ''
    form.total = s ? String(s.total) : ''
    form.completed = s ? String(s.completed) : ''
    error.value = ''
  },
  { immediate: true },
)

function submit() {
  const name = form.name.trim()
  if (!name) {
    error.value = '请输入科目名称'
    return
  }
  const totalRaw = String(form.total ?? '').trim()
  if (!totalRaw) {
    error.value = '请输入总任务量'
    return
  }
  const total = Number(totalRaw)
  if (!Number.isFinite(total) || total <= 0) {
    error.value = '总任务量必须是大于 0 的数字'
    return
  }
  const completedRaw = String(form.completed ?? '').trim()
  // 已完成量留空时默认为 0，便于新增科目直接保存
  const completed = completedRaw === '' ? 0 : Number(completedRaw)
  if (!Number.isFinite(completed) || completed < 0) {
    error.value = '已完成量必须是不小于 0 的数字'
    return
  }
  if (completed > total) {
    error.value = '已完成量不能超过总任务量'
    return
  }
  emit('save', { name, unit: form.unit.trim() || '项', total, completed })
}
</script>

<template>
  <ModalSheet :title="subject ? '编辑科目' : '添加科目'" @close="emit('close')">
    <div class="field">
      <label class="label" for="subject-name">科目名称</label>
      <input id="subject-name" v-model="form.name" class="input" type="text" placeholder="例如：英语" />
    </div>
    <div class="field">
      <label class="label" for="subject-unit">任务单位</label>
      <input id="subject-unit" v-model="form.unit" class="input" type="text" placeholder="例如：单词 / 知识点 / 章节" />
    </div>
    <div class="input-row">
      <div class="field">
        <label class="label" for="subject-total">总任务量</label>
        <input id="subject-total" v-model="form.total" class="input" type="number" min="1" inputmode="numeric" placeholder="0" />
      </div>
      <div class="field">
        <label class="label" for="subject-completed">已完成量</label>
        <input
          id="subject-completed"
          v-model="form.completed"
          class="input"
          type="number"
          min="0"
          inputmode="numeric"
          placeholder="0"
        />
      </div>
    </div>
    <p v-if="error" class="field-error">{{ error }}</p>
    <template #footer>
      <button class="btn btn--ghost" type="button" @click="emit('close')">取消</button>
      <button class="btn btn--primary" type="button" @click="submit">保存</button>
    </template>
  </ModalSheet>
</template>
