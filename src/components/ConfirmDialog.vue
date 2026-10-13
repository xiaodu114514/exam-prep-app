<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next'
import ModalSheet from './ModalSheet.vue'

withDefaults(
  defineProps<{
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
    danger?: boolean
  }>(),
  {
    title: '确认操作',
    confirmText: '确认',
    cancelText: '取消',
    danger: true,
  },
)

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <ModalSheet :title="title" @close="emit('cancel')">
    <div class="confirm">
      <div class="confirm__icon" :class="{ 'confirm__icon--danger': danger }">
        <TriangleAlert :size="20" />
      </div>
      <p class="confirm__msg">{{ message }}</p>
    </div>
    <template #footer>
      <button class="btn btn--ghost" type="button" @click="emit('cancel')">
        {{ cancelText }}
      </button>
      <button
        class="btn"
        :class="danger ? 'btn--danger-soft' : 'btn--primary'"
        type="button"
        @click="emit('confirm')"
      >
        {{ confirmText }}
      </button>
    </template>
  </ModalSheet>
</template>

<style scoped>
.confirm {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px 0;
}
.confirm__icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--primary-weak);
  color: var(--primary-strong);
}
.confirm__icon--danger {
  background: var(--danger-weak);
  color: var(--danger);
}
.confirm__msg {
  font-size: 14.5px;
  line-height: 1.5;
  color: var(--text);
}
</style>
