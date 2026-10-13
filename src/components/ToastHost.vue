<script setup lang="ts">
import { CheckCircle2, Info, XCircle, X } from 'lucide-vue-next'
import type { ToastItem } from '../composables/useToast'

defineProps<{
  toasts: ToastItem[]
}>()

const emit = defineEmits<{
  (e: 'dismiss', id: number): void
}>()

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const
</script>

<template>
  <Teleport to="body">
    <div class="toasts" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.type}`">
          <component :is="icons[t.type]" :size="18" class="toast__icon" />
          <span class="toast__msg">{{ t.message }}</span>
          <button class="toast__close" type="button" aria-label="关闭" @click="emit('dismiss', t.id)">
            <X :size="15" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toasts {
  position: fixed;
  top: calc(12px + env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(calc(100vw - 32px), 400px);
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-radius: 12px;
  background: #232a33;
  color: #fff;
  box-shadow: var(--shadow-float);
  font-size: 14px;
}
.toast__icon {
  flex: none;
}
.toast--success .toast__icon {
  color: #5dd39e;
}
.toast--error .toast__icon {
  color: #ff8b84;
}
.toast--info .toast__icon {
  color: #8fc0ff;
}
.toast__msg {
  flex: 1;
  line-height: 1.4;
}
.toast__close {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.65);
}
.toast__close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
