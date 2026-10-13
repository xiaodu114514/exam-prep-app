<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import ModalSheet from './ModalSheet.vue'
import type { StudySite } from '../types'

const props = defineProps<{
  site: StudySite | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', input: { name: string; url: string }): void
}>()

const form = reactive({ name: '', url: '' })
const error = ref('')

watch(
  () => props.site,
  (s) => {
    form.name = s?.name ?? ''
    form.url = s?.url ?? ''
    error.value = ''
  },
  { immediate: true },
)

function submit() {
  const name = form.name.trim()
  if (!name) {
    error.value = '请输入网站名称'
    return
  }
  let url = form.url.trim()
  if (!url) {
    error.value = '请输入网址'
    return
  }
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url
  }
  emit('save', { name, url })
}
</script>

<template>
  <ModalSheet :title="site ? '编辑网站' : '添加网站'" @close="emit('close')">
    <div class="field">
      <label class="label" for="site-name">网站名称</label>
      <input id="site-name" v-model="form.name" class="input" type="text" placeholder="例如：粉笔网" />
    </div>
    <div class="field">
      <label class="label" for="site-url">网址</label>
      <input id="site-url" v-model="form.url" class="input" type="text" inputmode="url" placeholder="例如：fenbi.com" />
    </div>
    <p v-if="error" class="field-error">{{ error }}</p>
    <template #footer>
      <button class="btn btn--ghost" type="button" @click="emit('close')">取消</button>
      <button class="btn btn--primary" type="button" @click="submit">保存</button>
    </template>
  </ModalSheet>
</template>
