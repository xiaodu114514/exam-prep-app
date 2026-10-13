<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { BookOpen, ChevronLeft, ChevronRight, ListTodo, Plus } from 'lucide-vue-next'
import { useAppStore } from '../store/useAppStore'
import { useToast } from '../composables/useToast'
import { addDays, formatDateLong, todayKey } from '../utils/date'
import type { Subject, Task } from '../types'
import ProgressBar from '../components/ProgressBar.vue'
import TaskRow from '../components/TaskRow.vue'
import EmptyState from '../components/EmptyState.vue'
import ModalSheet from '../components/ModalSheet.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const store = useAppStore()
const toast = useToast()
const today = todayKey()

const selectedDate = ref(today)

const dayTasks = computed(() => store.tasksOn(selectedDate.value))
const doneCount = computed(() => dayTasks.value.filter((t) => t.completed).length)
const totalCount = computed(() => dayTasks.value.length)
const rate = computed(() => (totalCount.value ? Math.round((doneCount.value / totalCount.value) * 100) : 0))

const isToday = computed(() => selectedDate.value === today)

// ---------- 背诵专区 ----------
/** 背诵任务：关联了科目的任务 */
const reciteTasks = computed(() => dayTasks.value.filter((t) => t.subjectId))
/** 其他任务：未关联科目的任务 */
const otherTasks = computed(() => dayTasks.value.filter((t) => !t.subjectId))

/** 今日按科目汇总的已背数量 */
const reciteSummary = computed(() => {
  const rows: { subject: Subject; amount: number }[] = []
  for (const s of store.state.data.subjects) {
    let sum = 0
    for (const t of reciteTasks.value) {
      if (t.completed && t.subjectId === s.id) sum += t.amount ?? 0
    }
    if (sum > 0) rows.push({ subject: s, amount: sum })
  }
  return rows
})

const reciteDone = computed(() => reciteTasks.value.filter((t) => t.completed).length)

function shiftDay(delta: number) {
  selectedDate.value = addDays(selectedDate.value, delta)
}
function goToday() {
  selectedDate.value = today
}

// ---------- 任务勾选（背诵联动：以服务端响应为准，前端不计算贡献） ----------
async function onToggle(id: string) {
  const result = await store.toggleTask(id)
  if (!result) return
  const { task, subject } = result
  const amount = task.amount ?? 0
  if (subject && amount > 0) {
    if (task.completed) {
      const contributed = task.contributed ?? amount
      toast.success(`已计入「${subject.name}」+${contributed} ${subject.unit}`)
    } else {
      toast.info(`已撤销「${subject.name}」的背诵贡献`)
    }
  }
}

// ---------- 表单 ----------
const showForm = ref(false)
const editing = ref<Task | null>(null)
const form = reactive({
  title: '',
  date: today,
  subjectId: null as string | null,
  amount: '' as string | number,
  daily: false,
})
const formError = ref('')
const pendingForm = ref(false)

const selectedSubject = computed(() => store.getSubject(form.subjectId))

function openCreate() {
  editing.value = null
  form.title = ''
  form.date = selectedDate.value
  form.subjectId = null
  form.amount = ''
  form.daily = false
  formError.value = ''
  showForm.value = true
}

/** 快捷新建背诵任务：默认选中第一个科目 */
function openCreateRecite() {
  openCreate()
  form.subjectId = store.state.data.subjects[0]?.id ?? null
}

function openEdit(task: Task) {
  editing.value = task
  form.title = task.title
  form.date = task.date
  form.subjectId = task.subjectId
  form.amount = task.amount != null ? String(task.amount) : ''
  form.daily = task.daily === true
  formError.value = ''
  showForm.value = true
}

async function submitForm() {
  const title = form.title.trim()
  if (!title) {
    formError.value = '请输入任务名称'
    return
  }
  if (!form.date) {
    formError.value = '请选择任务日期'
    return
  }
  let amount: number | null = null
  if (form.subjectId) {
    const raw = String(form.amount ?? '').trim()
    if (raw !== '') {
      const n = Number(raw)
      if (!Number.isFinite(n) || n < 0) {
        formError.value = '背诵量必须是不小于 0 的数字'
        return
      }
      amount = n
    }
  }
  pendingForm.value = true
  try {
    if (editing.value) {
      const ok = await store.updateTask(editing.value.id, {
        title,
        date: form.date,
        subjectId: form.subjectId,
        amount,
        daily: form.daily,
      })
      if (!ok) return
      toast.success('任务已更新')
    } else {
      const task = await store.addTask({
        title,
        date: form.date,
        subjectId: form.subjectId,
        amount,
        daily: form.daily,
      })
      if (!task) return
      toast.success('任务已添加')
    }
    showForm.value = false
  } finally {
    pendingForm.value = false
  }
}

// ---------- 删除 ----------
const confirmTarget = ref<Task | null>(null)

function askRemove(task: Task) {
  confirmTarget.value = task
}

async function confirmRemove() {
  if (confirmTarget.value) {
    const ok = await store.removeTask(confirmTarget.value.id)
    if (ok) toast.success('任务已删除')
  }
  confirmTarget.value = null
}
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1 class="page-title">每日任务</h1>
      <p class="page-subtitle">{{ formatDateLong(selectedDate) }}</p>
    </header>

    <!-- 日期切换 -->
    <div class="date-switch">
      <button class="btn btn--icon" type="button" aria-label="前一天" @click="shiftDay(-1)">
        <ChevronLeft :size="18" />
      </button>
      <button
        class="date-switch__today"
        :class="{ 'date-switch__today--active': isToday }"
        type="button"
        @click="goToday"
      >
        今天
      </button>
      <button class="btn btn--icon" type="button" aria-label="后一天" @click="shiftDay(1)">
        <ChevronRight :size="18" />
      </button>
    </div>

    <!-- 完成率 -->
    <section class="card stats-card">
      <div class="stats-card__top">
        <div class="stats-card__rate">
          <span class="stats-card__number">{{ rate }}%</span>
          <span class="stats-card__label">当日完成率</span>
        </div>
        <div class="stats-card__count">
          <span>共 <strong>{{ totalCount }}</strong> 项</span>
          <span>完成 <strong>{{ doneCount }}</strong> 项</span>
        </div>
      </div>
      <ProgressBar :value="doneCount" :max="totalCount" size="lg" tone="success" />
    </section>

    <!-- 背诵专区 -->
    <section class="section">
      <div class="section-title">
        <span class="section-title__label">
          <BookOpen :size="15" class="section-title__icon" />
          背诵专区
        </span>
        <button class="btn btn--soft btn--sm" type="button" @click="openCreateRecite">
          <Plus :size="15" />
          背诵任务
        </button>
      </div>

      <div class="card">
        <div v-if="reciteSummary.length" class="recite-summary">
          <span class="recite-summary__label">今日已背</span>
          <div class="recite-summary__chips">
            <span v-for="row in reciteSummary" :key="row.subject.id" class="chip chip--amount">
              {{ row.subject.name }} +{{ row.amount }} {{ row.subject.unit }}
            </span>
          </div>
        </div>

        <div v-if="reciteTasks.length">
          <p class="recite-zone__hint">
            已背 {{ reciteDone }} / {{ reciteTasks.length }} 项，勾选完成后自动累计到背诵计划进度
          </p>
          <TaskRow
            v-for="task in reciteTasks"
            :key="task.id"
            :task="task"
            :subject-name="store.getSubject(task.subjectId)?.name"
            :subject-unit="store.getSubject(task.subjectId)?.unit"
            @toggle="onToggle"
            @edit="openEdit"
            @remove="askRemove"
          />
        </div>
        <EmptyState
          v-else
          :icon="BookOpen"
          title="今天还没有背诵任务"
          desc="新建任务时选择科目，任务就会出现在背诵专区"
          action-text="新建背诵任务"
          @action="openCreateRecite"
        />
      </div>
    </section>

    <!-- 其他任务 -->
    <section class="section">
      <div class="section-title">
        <span>任务列表</span>
        <button class="btn btn--soft btn--sm" type="button" @click="openCreate">
          <Plus :size="15" />
          新建任务
        </button>
      </div>

      <div class="card">
        <div v-if="otherTasks.length">
          <TaskRow
            v-for="task in otherTasks"
            :key="task.id"
            :task="task"
            @toggle="onToggle"
            @edit="openEdit"
            @remove="askRemove"
          />
        </div>
        <EmptyState
          v-else
          :icon="ListTodo"
          title="没有其他任务"
          desc="点击「新建任务」，安排当天的学习计划"
          action-text="新建任务"
          @action="openCreate"
        />
      </div>
    </section>

    <!-- 新建 / 编辑弹窗 -->
    <ModalSheet v-if="showForm" :title="editing ? '编辑任务' : '新建任务'" @close="showForm = false">
      <div class="field">
        <label class="label" for="task-title">任务名称</label>
        <input id="task-title" v-model="form.title" class="input" type="text" placeholder="例如：行测·言语理解刷题 30 道" />
      </div>
      <div class="field">
        <label class="label" for="task-date">日期</label>
        <input id="task-date" v-model="form.date" class="input" type="date" />
      </div>
      <div class="field">
        <label class="label" for="task-subject">科目标签（可选）</label>
        <select id="task-subject" v-model="form.subjectId" class="select">
          <option :value="null">无科目</option>
          <option v-for="s in store.state.data.subjects" :key="s.id" :value="s.id">
            {{ s.name }}
          </option>
        </select>
      </div>
      <div v-if="form.subjectId" class="field">
        <label class="label" for="task-amount">
          背诵量（{{ selectedSubject?.unit ?? '项' }}）
        </label>
        <input
          id="task-amount"
          v-model="form.amount"
          class="input"
          type="number"
          min="0"
          inputmode="numeric"
          placeholder="留空则不累计背诵进度"
        />
        <p class="field-hint">勾选完成后，该数量会自动累计到「{{ selectedSubject?.name }}」的背诵进度</p>
      </div>
      <div class="field">
        <label class="label" for="task-daily">任务类型</label>
        <label class="switch-row" for="task-daily">
          <input id="task-daily" v-model="form.daily" type="checkbox" />
          <span>设为每日任务（从创建日起每天自动出现在任务列表）</span>
        </label>
        <p class="field-hint">每日任务的完成状态按天独立：今天勾选完成，明天自动回到未完成</p>
      </div>
      <p v-if="formError" class="field-error">{{ formError }}</p>
      <template #footer>
        <button class="btn btn--ghost" type="button" @click="showForm = false">取消</button>
        <button class="btn btn--primary" type="button" :disabled="pendingForm" @click="submitForm">
          {{ pendingForm ? '保存中…' : '保存' }}
        </button>
      </template>
    </ModalSheet>

    <ConfirmDialog
      v-if="confirmTarget"
      title="删除任务"
      :message="`确定要删除「${confirmTarget.title}」吗？此操作无法撤销。`"
      confirm-text="删除"
      @confirm="confirmRemove"
      @cancel="confirmTarget = null"
    />
  </div>
</template>

<style scoped>
.date-switch {
  display: flex;
  align-items: center;
  gap: 12px;
}
.date-switch__today {
  flex: 1;
  min-height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 13.5px;
  font-weight: 550;
}
.date-switch__today--active {
  background: var(--primary-weak);
  border-color: var(--primary-border);
  color: var(--primary-strong);
}

.stats-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.stats-card__rate {
  display: flex;
  flex-direction: column;
}
.stats-card__number {
  font-size: 26px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.1;
}
.stats-card__label {
  margin-top: 3px;
  font-size: 12.5px;
  color: var(--text-muted);
}
.stats-card__count {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  font-size: 13px;
  color: var(--text-secondary);
}
.stats-card__count strong {
  font-weight: 650;
  color: var(--text);
}

/* 背诵专区 */
.section-title__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.section-title__icon {
  color: var(--primary);
}
.recite-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 6px;
}
.recite-summary__label {
  font-size: 12.5px;
  color: var(--text-muted);
}
.recite-summary__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.recite-zone__hint {
  padding: 10px 0 2px;
  font-size: 12.5px;
  color: var(--text-muted);
}

.field-hint {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.5;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 32px;
  user-select: none;
}
.switch-row input[type='checkbox'] {
  width: 17px;
  height: 17px;
  accent-color: var(--primary);
  flex: none;
}
</style>
