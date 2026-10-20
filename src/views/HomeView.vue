<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ExternalLink,
  ListChecks,
  Check,
} from 'lucide-vue-next'
import { useAppStore } from '../store/useAppStore'
import { daysBetween, formatDateLong, todayKey } from '../utils/date'
import type { Task } from '../types'
import ProgressBar from '../components/ProgressBar.vue'
import EmptyState from '../components/EmptyState.vue'

const store = useAppStore()
const router = useRouter()
const today = todayKey()

const texts = computed(
  () => store.state.data.texts ?? { appName: '', greeting: '', slogan: '' },
)

const autoGreeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了，注意休息'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

/** 自定义问候语优先，留空按时间自动 */
const greeting = computed(() => {
  const custom = texts.value.greeting.trim()
  return custom !== '' ? custom : autoGreeting.value
})

/** 自定义口号优先，留空使用默认 */
const slogan = computed(() => {
  const custom = texts.value.slogan.trim()
  return custom !== '' ? custom : '今天也要稳步推进'
})

const exam = computed(() => store.state.data.exam)
const daysLeft = computed(() => daysBetween(today, exam.value.date))

const countdownText = computed(() => {
  if (daysLeft.value > 0) return `距离考试还有 ${daysLeft.value} 天`
  if (daysLeft.value === 0) return '考试就是今天，全力以赴'
  return `考试已结束 ${Math.abs(daysLeft.value)} 天`
})

const todayTasks = computed(() => store.tasksOn(today))
const doneCount = computed(() => todayTasks.value.filter((t) => t.completed).length)
const totalCount = computed(() => todayTasks.value.length)

const subjects = computed(() => store.state.data.subjects)
const sites = computed(() => store.state.data.sites)

function toggleTask(id: string) {
  store.toggleTask(id)
}

function subjectOf(task: Task) {
  return store.getSubject(task.subjectId)
}

function amountOf(task: Task): number {
  const a = task.amount ?? 0
  return a > 0 ? a : 0
}

function goTasks() {
  router.push('/tasks')
}

function goMemorize() {
  router.push('/memorize')
}

function goSettings() {
  router.push('/settings')
}

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : 'https://' + url
}
</script>

<template>
  <div class="page">
    <header class="home-hero">
      <p class="home-hero__greet">{{ greeting }}</p>
      <h1 class="home-hero__slogan">{{ slogan }}</h1>
      <p class="home-hero__date">{{ formatDateLong(today) }}</p>
    </header>

    <!-- 考试倒计时 -->
    <section class="countdown card">
      <div class="countdown__main">
        <div class="countdown__icon">
          <CalendarClock :size="20" />
        </div>
        <div class="countdown__info">
          <p class="countdown__exam">{{ exam.name }}</p>
          <p class="countdown__text">{{ countdownText }}</p>
        </div>
      </div>
      <button class="btn btn--ghost btn--sm countdown__edit" type="button" @click="goSettings">
        修改
      </button>
    </section>

    <!-- 今日任务 -->
    <section class="section">
      <div class="section-title">
        <span>今日任务</span>
        <button class="link-btn" type="button" @click="goTasks">
          查看全部
          <ArrowRight :size="14" />
        </button>
      </div>

      <div class="card">
        <div class="task-summary">
          <div class="task-summary__text">
            <strong>{{ doneCount }}</strong>
            <span> / {{ totalCount }} 项已完成</span>
          </div>
          <span class="task-summary__percent">
            {{ totalCount ? Math.round((doneCount / totalCount) * 100) : 0 }}%
          </span>
        </div>
        <ProgressBar :value="doneCount" :max="totalCount" />

        <div v-if="todayTasks.length" class="home-tasks">
          <button
            v-for="task in todayTasks"
            :key="task.id"
            class="home-task"
            type="button"
            @click="toggleTask(task.id)"
          >
            <span class="home-task__check" :class="{ 'home-task__check--done': task.completed }">
              <Check v-if="task.completed" :size="14" :stroke-width="3" />
            </span>
            <span class="home-task__main">
              <span class="home-task__title" :class="{ 'home-task__title--done': task.completed }">
                {{ task.title }}
              </span>
              <span v-if="task.daily || subjectOf(task) || amountOf(task) > 0" class="home-task__meta">
                <span v-if="task.daily" class="chip">每日</span>
                <span v-if="subjectOf(task)" class="chip chip--primary">{{ subjectOf(task)?.name }}</span>
                <span v-if="amountOf(task) > 0" class="chip chip--amount">
                  +{{ task.amount }} {{ subjectOf(task)?.unit }}
                </span>
              </span>
            </span>
          </button>
        </div>
        <EmptyState
          v-else
          :icon="ListChecks"
          title="今天还没有安排任务"
          desc="去「每日任务」添加几个今天要完成的学习项吧"
          action-text="去添加"
          @action="goTasks"
        />
      </div>
    </section>

    <!-- 背诵进度 -->
    <section class="section">
      <div class="section-title">
        <span>背诵进度</span>
        <button class="link-btn" type="button" @click="goMemorize">
          全部科目
          <ArrowRight :size="14" />
        </button>
      </div>

      <div class="card">
        <div v-if="subjects.length" class="subject-list">
          <div v-for="s in subjects" :key="s.id" class="subject-line">
            <div class="subject-line__head">
              <span class="subject-line__name">
                <BookOpen :size="15" class="subject-line__icon" />
                {{ s.name }}
              </span>
              <span class="subject-line__count">
                {{ s.completed }} / {{ s.total }} {{ s.unit }}
              </span>
            </div>
            <ProgressBar :value="s.completed" :max="s.total" />
          </div>
        </div>
        <EmptyState
          v-else
          :icon="BookOpen"
          title="还没有背诵科目"
          desc="在「背诵计划」中添加科目，开始积累进度"
          action-text="去添加"
          @action="goMemorize"
        />
      </div>
    </section>

    <!-- 快捷网站 -->
    <section class="section">
      <div class="section-title">
        <span>常用网站</span>
        <button class="link-btn" type="button" @click="goSettings">
          管理
          <ArrowRight :size="14" />
        </button>
      </div>

      <div v-if="sites.length" class="site-grid">
        <a
          v-for="site in sites"
          :key="site.id"
          class="site-tile"
          :href="normalizeUrl(site.url)"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="site-tile__name">{{ site.name }}</span>
          <ExternalLink :size="14" class="site-tile__icon" />
        </a>
      </div>
      <div v-else class="card">
        <EmptyState
          :icon="ExternalLink"
          title="还没有快捷网站"
          desc="在「设置」中添加常用备考网站"
          action-text="去添加"
          @action="goSettings"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-hero {
  padding: 26px 4px 14px;
}
.home-hero__greet {
  font-size: 13.5px;
  color: var(--text-muted);
}
.home-hero__slogan {
  margin-top: 4px;
  font-size: 23px;
  font-weight: 680;
  letter-spacing: -0.01em;
  color: var(--text);
}
.home-hero__date {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-muted);
}

/* 倒计时 */
.countdown {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.countdown__main {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
}
.countdown__icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  background: var(--primary-weak);
  color: var(--primary-strong);
}
.countdown__info {
  min-width: 0;
}
.countdown__exam {
  font-size: 15px;
  font-weight: 620;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.countdown__text {
  margin-top: 3px;
  font-size: 13px;
  color: var(--primary-strong);
  font-weight: 550;
}
.countdown__edit {
  flex: none;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  color: var(--primary-strong);
  font-weight: 550;
}
.link-btn:hover {
  text-decoration: underline;
}

/* 今日任务 */
.task-summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}
.task-summary__text {
  font-size: 13.5px;
  color: var(--text-secondary);
}
.task-summary__text strong {
  font-size: 20px;
  font-weight: 680;
  color: var(--text);
}
.task-summary__percent {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--primary-strong);
}

.home-tasks {
  margin-top: 12px;
}
.home-task {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 11px 0;
  text-align: left;
}
.home-task + .home-task {
  border-top: 1px solid var(--border);
}
.home-task__check {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  border: 2px solid var(--border-strong);
  color: #fff;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.home-task__check--done {
  background: var(--primary);
  border-color: var(--primary);
}
.home-task__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.home-task__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.home-task__title {
  font-size: 14.5px;
  color: var(--text);
  overflow-wrap: anywhere;
}
.home-task__title--done {
  color: var(--text-muted);
  text-decoration: line-through;
}

/* 背诵进度 */
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
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 550;
  color: var(--text);
}
.subject-line__icon {
  color: var(--primary);
}
.subject-line__count {
  font-size: 12.5px;
  color: var(--text-muted);
}

/* 网站 */
.site-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.site-tile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-card);
  color: var(--text);
  transition: border-color 0.15s ease, transform 0.05s ease;
}
.site-tile:active {
  transform: translateY(1px);
}
.site-tile:hover {
  border-color: var(--primary-border);
}
.site-tile__name {
  font-size: 14px;
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.site-tile__icon {
  flex: none;
  color: var(--text-muted);
}

@media (min-width: 560px) {
  .site-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
