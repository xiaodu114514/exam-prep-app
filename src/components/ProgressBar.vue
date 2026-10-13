<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    max?: number
    tone?: 'primary' | 'success'
    size?: 'md' | 'lg'
  }>(),
  { max: 100, tone: 'primary', size: 'md' },
)

const percent = computed(() => {
  if (props.max <= 0) return 0
  const p = (props.value / props.max) * 100
  return Math.min(100, Math.max(0, p))
})
</script>

<template>
  <div
    class="progress"
    :class="[`progress--${tone}`, size === 'lg' ? 'progress--lg' : '']"
    role="progressbar"
    :aria-valuenow="Math.round(percent)"
    :aria-valuemin="0"
    :aria-valuemax="100"
  >
    <div class="progress__bar" :style="{ width: percent + '%' }"></div>
  </div>
</template>

<style scoped>
.progress {
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  overflow: hidden;
}
.progress--lg {
  height: 10px;
}
.progress__bar {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--primary);
  transition: width 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.progress--success .progress__bar {
  background: var(--success);
}
</style>
