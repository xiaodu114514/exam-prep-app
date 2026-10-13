<script setup lang="ts">
import { computed, ref } from 'vue'
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useAppStore } from '../store/useAppStore'
import { addDays, formatDateShort, getWeekRange, todayKey, weekdayShort } from '../utils/date'
import ProgressBar from '../components/ProgressBar.vue'

const store = useAppStore()
const today = todayKey()

const anchor = ref(today)

const week = computed(() => getWeekRange(anchor.value))

const isCurrentWeek = computed(() => {
  const cur = getWeekRange(today)
  return week.value.start === cur.start
})

/**
 * 每日展开统计（含每日任务）：
 * - 每日任务从创建日起每天计入总量；
 * - 完成状态只有“今天”真实可知，历史天按未完成计（诚实统计，不虚报）。
 */
const daily = computed(() => {
  return week.value.days.map((day) => {
    const tasks = store.tasksOn(day)
    const done = tasks.filter((t) => {
      if (t.daily === true) return day === today && t.completed
      return t.completed
    }).length
    return { day, total: tasks.length, done }
  })
})

const totalCount = computed(() => daily.value.reduce((s, d) => s + d.total, 0))
const doneCount = computed(() => daily.value.reduce((s, d) => s + d.done, 0))
const undoneCount = computed(() => totalCount.value - doneCount.value)
const rate = computed(() => (totalCount.value ? Math.round((doneCount.value / totalCount.value) * 100) : 0))

const maxDone = computed(() => Math.max(1, ...daily.value.map((d) => d.done)))

const subjects = computed(() => store.state.data.subjects)

function shiftWeek(delta: number) {
  anchor.value = addDays(anchor.value, delta * 7)
}

function barHeight(done: number): string {
  if (done <= 0) return '0%'
  return `${Math.max(8, Math.round((done / maxDone.value) * 100))}%`
}
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1 class="page-title">周汇总</h1>
      <p class="page-subtitle">回顾一周的学习成果</p>
    </header>

    <!-- 周切换 -->
    <div class="week-switch">
      <button class="btn btn--icon" type="button" aria-label="上一周" @click="shiftWeek(-1)">
        <ChevronLeft :size="18" />
      </button>
      <div class="week-switch__range">
        <span class="week-switch__text">{{ formatDateShort(week.start) }} — {{ formatDateShort(week.end) }}</span>
        <span v-if="isCurrentWeek" class="chip chip--primary">本周</span>
      </div>
      <button class="btn btn--icon" type="button" aria-label="下一周" @click="shiftWeek(1)">
        <ChevronRight :size="18" />
      </button>
    </div>

    <!-- 统计卡片 -->
    <section class="stat-grid">
      <div class="stat-card card">
        <span class="stat-card__label">任务总量</span>
        <span class="stat-card__value">{{ totalCount }}</span>
      </div>
      <div class="stat-card card">
        <span class="stat-card__label">已完成</span>
        <span class="stat-card__value stat-card__value--success">{{ doneCount }}</span>
      </div>
      <div class="stat-card card">
        <span class="stat-card__label">未完成</span>
        <span class="stat-card__value">{{ undoneCount }}</span>
      </div>
      <div class="stat-card card">
        <span class="stat-card__label">完成率</span>
        <span class="stat-card__value stat-card__value--primary">{{ rate }}%</span>
      </div>
    </section>

    <section class="card rate-card">
      <div class="rate-card__head">
        <span>本周整体进度</span>
        <span>{{ doneCount }} / {{ totalCount }}</span>
      </div>
      <ProgressBar :value="doneCount" :max="totalCount" size="lg" tone="success" />
    </section>

    <!-- 每日完成柱状 -->
    <section class="section">
      <div class="section-title">
        <span>每日任务完成</span>
        <span class="section-title__hint">周一至周日</span>
      </div>
      <div class="card">
        <div class="chart">
          <div v-for="d in daily" :key="d.day" class="chart__col">
            <span class="chart__val">{{ d.done }}<i>/{{ d.total }}</i></span>
            <div class="chart__track">
              <div
                class="chart__bar"
                :class="{ 'chart__bar--active': d.done > 0 }"
                :style="{ height: barHeight(d.done) }"
              ></div>
            </div>
            <span class="chart__label">{{ weekdayShort(d.day) }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 各科背诵进度 -->
    <section class="section">
      <div class="section-title">
        <span>各科背诵进度</span>
      </div>
      <div class="card">
        <div v-if="subjects.length" class="subject-list">
          <div v-for="s in subjects" :key="s.id" class="subject-line">
            <div class="subject-line__head">
              <span class="subject-line__name">{{ s.name }}</span>
              <span class="subject-line__count">{{ s.completed }} / {{ s.total }} {{ s.unit }}</span>
            </div>
            <ProgressBar :value="s.completed" :max="s.total" />
          </div>
        </div>
        <p v-else class="muted">暂无科目数据</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.week-switch {
  display: flex;
  align-items: center;
  gap: 12px;
}
.week-switch__range {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface);
}
.week-switch__text {
  font-size: 13.5px;
  font-weight: 560;
  color: var(--text);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 14px;
}
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
}
.stat-card__label {
  font-size: 12.5px;
  color: var(--text-muted);
}
.stat-card__value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.1;
}
.stat-card__value--success {
  color: var(--success);
}
.stat-card__value--primary {
  color: var(--primary-strong);
}

.rate-card {
  margin-top: 10px;
}
.rate-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 13.5px;
  color: var(--text-secondary);
}

/* 柱状图 */
.chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding-top: 6px;
}
.chart__col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.chart__val {
  font-size: 12px;
  font-weight: 620;
  color: var(--text);
  white-space: nowrap;
}
.chart__val i {
  font-style: normal;
  font-weight: 400;
  color: var(--text-muted);
}
.chart__track {
  width: 100%;
  max-width: 34px;
  height: 110px;
  display: flex;
  align-items: flex-end;
  border-radius: 8px;
  background: var(--surface-2);
  overflow: hidden;
}
.chart__bar {
  width: 100%;
  border-radius: 8px 8px 0 0;
  background: var(--primary-border);
  transition: height 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.chart__bar--active {
  background: var(--primary);
}
.chart__label {
  font-size: 12px;
  color: var(--text-muted);
}

.subject-line + .subject-line {
  margin-top: 14px;
}
.subject-line__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 7px;
}
.subject-line__name {
  font-size: 14px;
  font-weight: 550;
  color: var(--text);
}
.subject-line__count {
  font-size: 12.5px;
  color: var(--text-muted);
}

.muted {
  font-size: 13.5px;
  color: var(--text-muted);
  text-align: center;
  padding: 12px 0;
}

@media (min-width: 560px) {
  .stat-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
