<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'

defineProps<{
  title?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="sheet" role="dialog" aria-modal="true">
        <header class="sheet__head">
          <h3 class="sheet__title">{{ title }}</h3>
          <button class="sheet__close" type="button" aria-label="关闭" @click="emit('close')">
            <X :size="18" />
          </button>
        </header>
        <div class="sheet__body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="sheet__foot">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(20, 28, 40, 0.42);
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
.sheet {
  width: 100%;
  max-width: 440px;
  max-height: min(82vh, 640px);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: 20px;
  box-shadow: var(--shadow-float);
  animation: rise 0.2s ease-out;
}
.sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 4px;
}
.sheet__title {
  font-size: 16.5px;
  font-weight: 650;
  color: var(--text);
}
.sheet__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--text-muted);
}
.sheet__close:hover {
  background: var(--surface-2);
  color: var(--text-secondary);
}
.sheet__body {
  padding: 14px 20px 20px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.sheet__foot {
  display: flex;
  gap: 10px;
  padding: 0 20px 20px;
}
.sheet__foot > * {
  flex: 1;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (min-width: 720px) {
  .overlay {
    align-items: center;
  }
}
</style>
