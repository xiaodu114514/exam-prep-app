<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  BookOpen,
  Database,
  Download,
  ExternalLink,
  Link2,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-vue-next'
import { useAppStore } from '../store/useAppStore'
import { useToast } from '../composables/useToast'
import { clearLocalAll } from '../services/storage'
import { downloadDataExport } from '../services/api'
import type { StudySite, Subject } from '../types'
import ProgressBar from '../components/ProgressBar.vue'
import SubjectFormDialog from '../components/SubjectFormDialog.vue'
import SiteFormDialog from '../components/SiteFormDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const store = useAppStore()
const toast = useToast()
const router = useRouter()

// ---------- 考试设置 ----------
const examForm = reactive({ name: store.state.data.exam.name, date: store.state.data.exam.date })
const examError = ref('')
const savingExam = ref(false)

async function saveExam() {
  const name = examForm.name.trim()
  if (!name) {
    examError.value = '请输入考试名称'
    return
  }
  if (!examForm.date) {
    examError.value = '请选择考试日期'
    return
  }
  examError.value = ''
  savingExam.value = true
  try {
    const ok = await store.updateExam({ name, date: examForm.date })
    if (ok) toast.success('考试信息已保存')
  } finally {
    savingExam.value = false
  }
}

// ---------- 科目管理 ----------
const showSubjectForm = ref(false)
const editingSubject = ref<Subject | null>(null)

function openAddSubject() {
  editingSubject.value = null
  showSubjectForm.value = true
}
function openEditSubject(s: Subject) {
  editingSubject.value = s
  showSubjectForm.value = true
}
async function saveSubject(input: { name: string; unit: string; total: number; completed: number }) {
  if (editingSubject.value) {
    const ok = await store.updateSubject(editingSubject.value.id, input)
    if (!ok) return
    toast.success('科目已更新')
  } else {
    const subject = await store.addSubject(input)
    if (!subject) return
    toast.success('科目已添加')
  }
  showSubjectForm.value = false
}

// ---------- 网站管理 ----------
const showSiteForm = ref(false)
const editingSite = ref<StudySite | null>(null)

function openAddSite() {
  editingSite.value = null
  showSiteForm.value = true
}
function openEditSite(s: StudySite) {
  editingSite.value = s
  showSiteForm.value = true
}
async function saveSite(input: { name: string; url: string }) {
  if (editingSite.value) {
    const ok = await store.updateSite(editingSite.value.id, input)
    if (!ok) return
    toast.success('网站已更新')
  } else {
    const site = await store.addSite(input)
    if (!site) return
    toast.success('网站已添加')
  }
  showSiteForm.value = false
}

// ---------- 删除 / 清理确认 ----------
interface ConfirmState {
  message: string
  onConfirm: () => void
}
const confirmState = ref<ConfirmState | null>(null)

function askRemoveSubject(s: Subject) {
  confirmState.value = {
    message: `确定要删除科目「${s.name}」吗？相关任务的科目标签将被移除。`,
    onConfirm: async () => {
      const ok = await store.removeSubject(s.id)
      if (ok) toast.success('科目已删除')
    },
  }
}
function askRemoveSite(s: StudySite) {
  confirmState.value = {
    message: `确定要删除网站「${s.name}」吗？`,
    onConfirm: async () => {
      const ok = await store.removeSite(s.id)
      if (ok) toast.success('网站已删除')
    },
  }
}
function askClearLocal() {
  confirmState.value = {
    message:
      '确定要清除本浏览器中保存的本应用本地数据吗？服务器上的数据不受影响；未导入服务器的旧版浏览器数据将被永久删除。',
    onConfirm: () => {
      clearLocalAll()
      toast.success('本地缓存已清理')
    },
  }
}
function runConfirm() {
  void confirmState.value?.onConfirm()
  confirmState.value = null
}

// ---------- 数据导入导出 ----------
async function exportData() {
  try {
    await downloadDataExport()
    toast.success('已导出服务器数据备份')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '导出失败')
  }
}

function importPlaceholder() {
  toast.info('服务器数据导入将在下一阶段开放')
}

// ---------- 账号 ----------
async function doLogout() {
  await store.logout()
  toast.info('已退出登录')
  if (router.currentRoute.value.path !== '/login') {
    await router.replace('/login')
  }
}

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : 'https://' + url
}
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1 class="page-title">设置</h1>
      <p class="page-subtitle">管理考试信息、科目与快捷网站</p>
    </header>

    <!-- 考试设置 -->
    <section class="section">
      <div class="section-title"><span>考试设置</span></div>
      <div class="card">
        <div class="field">
          <label class="label" for="exam-name">考试名称</label>
          <input id="exam-name" v-model="examForm.name" class="input" type="text" placeholder="例如：2026 国家公务员考试" />
        </div>
        <div class="field">
          <label class="label" for="exam-date">考试日期</label>
          <input id="exam-date" v-model="examForm.date" class="input" type="date" />
        </div>
        <p v-if="examError" class="field-error">{{ examError }}</p>
        <button
          class="btn btn--primary btn--block"
          type="button"
          style="margin-top: 6px"
          :disabled="savingExam"
          @click="saveExam"
        >
          保存考试信息
        </button>
      </div>
    </section>

    <!-- 科目管理 -->
    <section class="section">
      <div class="section-title">
        <span>科目管理</span>
        <button class="btn btn--soft btn--sm" type="button" @click="openAddSubject">
          <Plus :size="15" />添加
        </button>
      </div>
      <div class="card">
        <div v-if="store.state.data.subjects.length">
          <div v-for="s in store.state.data.subjects" :key="s.id" class="mgmt-row">
            <div class="mgmt-row__icon"><BookOpen :size="17" /></div>
            <div class="mgmt-row__main">
              <div class="mgmt-row__line">
                <span class="mgmt-row__title">{{ s.name }}</span>
                <span class="mgmt-row__sub">{{ s.completed }} / {{ s.total }} {{ s.unit }}</span>
              </div>
              <ProgressBar :value="s.completed" :max="s.total" />
            </div>
            <div class="mgmt-row__actions">
              <button class="btn btn--icon btn--sm" type="button" aria-label="编辑" @click="openEditSubject(s)">
                <Pencil :size="15" />
              </button>
              <button class="btn btn--icon btn--sm" type="button" aria-label="删除" @click="askRemoveSubject(s)">
                <Trash2 :size="15" />
              </button>
            </div>
          </div>
        </div>
        <p v-else class="muted">暂无科目，点击右上角添加</p>
      </div>
    </section>

    <!-- 快捷网站 -->
    <section class="section">
      <div class="section-title">
        <span>快捷网站</span>
        <button class="btn btn--soft btn--sm" type="button" @click="openAddSite">
          <Plus :size="15" />添加
        </button>
      </div>
      <div class="card">
        <div v-if="store.state.data.sites.length">
          <div v-for="s in store.state.data.sites" :key="s.id" class="mgmt-row">
            <div class="mgmt-row__icon"><Link2 :size="17" /></div>
            <div class="mgmt-row__main">
              <span class="mgmt-row__title">{{ s.name }}</span>
              <a class="mgmt-row__sub mgmt-row__link" :href="normalizeUrl(s.url)" target="_blank" rel="noopener noreferrer">
                {{ s.url }}
                <ExternalLink :size="12" />
              </a>
            </div>
            <div class="mgmt-row__actions">
              <button class="btn btn--icon btn--sm" type="button" aria-label="编辑" @click="openEditSite(s)">
                <Pencil :size="15" />
              </button>
              <button class="btn btn--icon btn--sm" type="button" aria-label="删除" @click="askRemoveSite(s)">
                <Trash2 :size="15" />
              </button>
            </div>
          </div>
        </div>
        <p v-else class="muted">暂无网站，点击右上角添加</p>
      </div>
    </section>

    <!-- 数据管理 -->
    <section class="section">
      <div class="section-title"><span>数据管理</span></div>
      <div class="card">
        <div class="data-row">
          <div class="data-row__icon"><Database :size="17" /></div>
          <div class="data-row__main">
            <span class="data-row__title">数据备份</span>
            <span class="data-row__sub">数据保存在服务器，可导出 JSON 备份</span>
          </div>
        </div>
        <div class="data-actions">
          <button class="btn btn--ghost btn--sm" type="button" @click="exportData">
            <Download :size="15" />导出 JSON
          </button>
          <button class="btn btn--ghost btn--sm" type="button" @click="importPlaceholder">
            <Upload :size="15" />导入到服务器
          </button>
          <button class="btn btn--danger-soft btn--sm" type="button" @click="askClearLocal">
            <RotateCcw :size="15" />清理本地缓存
          </button>
        </div>
        <p class="import-note">「导入到服务器」将在下一阶段开放，用于把旧版浏览器数据迁移到服务器。</p>
      </div>
    </section>

    <!-- 账号 -->
    <section class="section">
      <div class="section-title"><span>账号</span></div>
      <div class="card">
        <div class="account">
          <div class="account__avatar">
            <UserRound :size="20" />
          </div>
          <div class="account__main">
            <span class="account__name">{{ store.state.user?.name ?? '未登录' }}</span>
            <span class="account__sub">已通过服务器会话登录</span>
          </div>
          <button class="btn btn--ghost btn--sm" type="button" @click="doLogout">
            <LogOut :size="15" />退出
          </button>
        </div>
      </div>
    </section>

    <!-- 弹窗 -->
    <SubjectFormDialog
      v-if="showSubjectForm"
      :subject="editingSubject"
      @close="showSubjectForm = false"
      @save="saveSubject"
    />
    <SiteFormDialog v-if="showSiteForm" :site="editingSite" @close="showSiteForm = false" @save="saveSite" />

    <ConfirmDialog
      v-if="confirmState"
      title="确认操作"
      :message="confirmState.message"
      confirm-text="确认"
      @confirm="runConfirm"
      @cancel="confirmState = null"
    />
  </div>
</template>

<style scoped>
.muted {
  font-size: 13.5px;
  color: var(--text-muted);
  text-align: center;
  padding: 16px 0;
}

/* 管理行 */
.mgmt-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}
.mgmt-row + .mgmt-row {
  border-top: 1px solid var(--border);
}
.mgmt-row__icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--primary-weak);
  color: var(--primary-strong);
}
.mgmt-row__main {
  flex: 1;
  min-width: 0;
}
.mgmt-row__line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}
.mgmt-row__title {
  font-size: 14.5px;
  font-weight: 560;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mgmt-row__sub {
  font-size: 12.5px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mgmt-row__link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--primary-strong);
  max-width: 100%;
}
.mgmt-row__actions {
  flex: none;
  display: flex;
  gap: 6px;
}

/* 数据管理 */
.data-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.data-row__icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--text-secondary);
}
.data-row__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.data-row__title {
  font-size: 14.5px;
  font-weight: 560;
  color: var(--text);
}
.data-row__sub {
  font-size: 12.5px;
  color: var(--text-muted);
}
.data-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.import-note {
  margin-top: 10px;
  font-size: 12.5px;
  color: var(--text-muted);
}

/* 账号 */
.account {
  display: flex;
  align-items: center;
  gap: 12px;
}
.account__avatar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--primary-weak);
  color: var(--primary-strong);
}
.account__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.account__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.account__sub {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
