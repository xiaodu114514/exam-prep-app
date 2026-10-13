<script setup lang="ts">
import { computed, ref } from 'vue'
import { BookOpen, Plus } from 'lucide-vue-next'
import { useAppStore } from '../store/useAppStore'
import { useToast } from '../composables/useToast'
import type { Subject } from '../types'
import ProgressBar from '../components/ProgressBar.vue'
import SubjectCard from '../components/SubjectCard.vue'
import SubjectFormDialog from '../components/SubjectFormDialog.vue'
import EmptyState from '../components/EmptyState.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const store = useAppStore()
const toast = useToast()

const subjects = computed(() => store.state.data.subjects)

const overallTotal = computed(() => subjects.value.reduce((sum, s) => sum + s.total, 0))
const overallDone = computed(() => subjects.value.reduce((sum, s) => sum + s.completed, 0))
const overallRate = computed(() =>
  overallTotal.value ? Math.round((overallDone.value / overallTotal.value) * 100) : 0,
)

// ---------- 表单 ----------
const showForm = ref(false)
const editing = ref<Subject | null>(null)

function openCreate() {
  editing.value = null
  showForm.value = true
}

function openEdit(subject: Subject) {
  editing.value = subject
  showForm.value = true
}

async function saveSubject(input: { name: string; unit: string; total: number; completed: number }) {
  if (editing.value) {
    const ok = await store.updateSubject(editing.value.id, input)
    if (!ok) return
    toast.success('科目已更新')
  } else {
    const subject = await store.addSubject(input)
    if (!subject) return
    toast.success('科目已添加')
  }
  showForm.value = false
}

// ---------- 删除 ----------
const confirmTarget = ref<Subject | null>(null)

function askRemove(subject: Subject) {
  confirmTarget.value = subject
}

async function confirmRemove() {
  if (confirmTarget.value) {
    const ok = await store.removeSubject(confirmTarget.value.id)
    if (ok) toast.success('科目已删除')
  }
  confirmTarget.value = null
}
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1 class="page-title">背诵计划</h1>
      <p class="page-subtitle">按科目记录背诵与复习进度</p>
    </header>

    <!-- 整体进度概览 -->
    <section class="card overview">
      <div class="overview__head">
        <div>
          <p class="overview__label">整体进度</p>
          <p class="overview__count">
            <strong>{{ overallDone }}</strong> / {{ overallTotal }}
          </p>
        </div>
        <span class="overview__rate">{{ overallRate }}%</span>
      </div>
      <ProgressBar :value="overallDone" :max="overallTotal" size="lg" />
    </section>

    <!-- 科目卡片 -->
    <section class="section">
      <div class="section-title">
        <span>科目</span>
        <button class="btn btn--soft btn--sm" type="button" @click="openCreate">
          <Plus :size="15" />
          添加科目
        </button>
      </div>

      <div v-if="subjects.length" class="subject-grid">
        <SubjectCard
          v-for="s in subjects"
          :key="s.id"
          :subject="s"
          @edit="openEdit"
          @remove="askRemove"
        />
      </div>
      <div v-else class="card">
        <EmptyState
          :icon="BookOpen"
          title="还没有背诵科目"
          desc="添加英语、政治等科目，开始记录每日背诵量"
          action-text="添加科目"
          @action="openCreate"
        />
      </div>
    </section>

    <SubjectFormDialog
      v-if="showForm"
      :subject="editing"
      @close="showForm = false"
      @save="saveSubject"
    />

    <ConfirmDialog
      v-if="confirmTarget"
      title="删除科目"
      :message="`确定要删除「${confirmTarget.name}」吗？相关任务的科目标签将被移除。`"
      confirm-text="删除"
      @confirm="confirmRemove"
      @cancel="confirmTarget = null"
    />
  </div>
</template>

<style scoped>
.overview__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;
}
.overview__label {
  font-size: 13px;
  color: var(--text-muted);
}
.overview__count {
  margin-top: 2px;
  font-size: 14px;
  color: var(--text-secondary);
}
.overview__count strong {
  font-size: 26px;
  font-weight: 700;
  color: var(--text);
}
.overview__rate {
  font-size: 15px;
  font-weight: 620;
  color: var(--primary-strong);
}

.subject-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (min-width: 640px) {
  .subject-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
