<template>
  <div class="page-view-container tasks-page">

    <!-- 顶部筛选面板：与物品图鉴一致的 UiSearchInput + UiFilterRow + UiFilterPill -->
    <div class="filter-panel paper-panel">
      <UiSearchInput v-model="searchQuery" placeholder="搜索任务名称、描述、ID..." />

      <!-- 主分类筛选行 -->
      <UiFilterRow label="分类：">
        <UiFilterPill
          v-for="o in typeOptions"
          :key="o.key"
          :active="filterType === o.key"
          @click="selectType(o.key)"
        >
          {{ o.label }}
        </UiFilterPill>
      </UiFilterRow>

      <!-- 子分类筛选行（二级） -->
      <UiFilterRow v-if="currentSubOptions.length" label="章节：">
        <UiFilterPill
          v-for="so in currentSubOptions"
          :key="so.key"
          :active="filterSub === so.key"
          @click="filterSub = so.key"
        >
          {{ so.label }}
        </UiFilterPill>

        <template #right>
          <div class="tasks-counter">
            数量：<span class="count-num">{{ filteredTasks.length }}</span> / {{ tasks.length }}
          </div>
        </template>
      </UiFilterRow>
    </div>

    <!-- 加载 / 错误 -->
    <UiEmptyState v-if="!isDataReady" type="loading" text="正在装配任务数据..." />
    <UiEmptyState v-else-if="errorMessage" type="error" :text="errorMessage" />

    <!-- 任务列表区（单列宽卡片流，懒加载每批 60 项） -->
    <UiCardGrid v-else id="tasksGridScroll" wide>
      <UiListRow
        v-for="item in displayedTasks"
        :key="item.id"
        class="task-list-row"
        clickable
        @click="openDetail(item)"
      >
        <div class="task-card-main">
          <div class="task-card-icon">
            <img
              :src="getImageUrl(`/images/TaskPanel/task_tag${item.type}.png`)"
              :alt="item.typeLabel"
              class="task-card-icon-img"
              loading="lazy"
              @error="handleImgError"
            />
          </div>
          <div class="task-card-info">
            <div class="task-card-name-row">
              <span class="task-card-name">{{ item.name }}</span>
              <UiTag tone="wood">{{ item.typeLabel }}</UiTag>
              <UiTag tone="wood">{{ item.subLabel }}</UiTag>
              <UiTag v-if="item.close" tone="danger">已下架</UiTag>
            </div>
            <div class="task-card-des">{{ item.des || '（无描述）' }}</div>
          </div>
        </div>

        <template #right>
          <div v-if="item.reward.entries.length" class="task-card-rewards">
            <div
              v-for="(rw, rIdx) in item.reward.entries.slice(0, 4)"
              :key="rIdx"
              class="task-card-reward"
              :title="`${rw.name} ×${rw.count}`"
            >
              <img :src="getImageUrl(rw.icon)" :alt="rw.name" class="task-card-reward-icon" loading="lazy" @error="handleImgError" />
              <span class="task-card-reward-count">×{{ rw.count }}</span>
            </div>
          </div>
          <span class="task-card-arrow">›</span>
        </template>
      </UiListRow>

      <UiEmptyState v-if="filteredTasks.length === 0" text="未找到符合条件的任务" />
    </UiCardGrid>

    <UiBackToTop scroll-container="#tasksGridScroll" />

    <!-- 详情全屏弹窗 -->
    <UiModal
      v-model:visible="detailVisible"
      :title="selectedTask ? selectedTask.name : '任务详情'"
      max-width="820px"
      scroll-id="taskModalScroll"
      :z-index="2000"
      @close="closeDetail"
    >
      <template v-if="selectedTask">
        <!-- 徽标行 -->
        <div class="detail-badges">
          <UiTag tone="wood">{{ selectedTask.typeLabel }}</UiTag>
          <UiTag tone="wood">{{ selectedTask.subLabel }}</UiTag>
        </div>

        <!-- 接取信息与背景 -->
        <UiSection title="接取信息与背景">
          <UiInfoRow v-if="selectedTask.getTask.npc" label="接取 NPC" :value="npcText(selectedTask.getTask.npc)" />
          <UiInfoRow label="接取条件" :value="selectedTask.getTask.condition" />
          <UiInfoRow v-if="selectedTask.getTask.title" label="交互对话" :value="selectedTask.getTask.title" />
          <div v-if="selectedTask.getTask.dialog" class="get-task-dialog-row">
            <div class="step-dialog-header">
              <span class="step-dialog-label">任务目标</span>
              <div v-if="!selectedTask.getTask.dialog.isText" class="dialog-actions">
                <UiButton variant="secondary" size="sm" @click="toggleDialog('getTask', selectedTask.getTask.dialog.raw)">
                  {{ dialogOpen['getTask'] ? '▲ 收起剧情文本' : '▼ 展开剧情文本' }}
                </UiButton>
                <span v-if="selectedTask.getTask.dialog.name" class="dialog-name-label">{{ selectedTask.getTask.dialog.name }}</span>
                <span v-if="dialogLoading['getTask']" class="dialog-loading">剧情读取中...</span>
              </div>
              <span v-else class="dialog-raw">{{ selectedTask.getTask.dialog.raw }}</span>
            </div>
            <DialogLines v-if="dialogOpen['getTask'] && dialogContent['getTask']" :lines="dialogContent['getTask']" />
          </div>
          <p class="task-des">{{ selectedTask.des || '（无描述）' }}</p>
          <blockquote v-if="selectedTask.des2" class="des2-quote">
            📜 委托契约书：{{ selectedTask.des2 }}
          </blockquote>
        </UiSection>

        <!-- 解锁信息 -->
        <UiSection title="解锁信息">
          <UiInfoRow label="解锁任务">
            <span v-if="selectedTask.unlockTasks.length" class="chip-group">
              <UiTag v-for="ut in selectedTask.unlockTasks" :key="ut.id">{{ ut.name === ut.id ? ut.id : ut.name }}</UiTag>
            </span>
            <span v-else>无</span>
          </UiInfoRow>
          <UiInfoRow label="解锁关卡">
            <span v-if="selectedTask.unlockStages.length" class="chip-group">
              <UiTag v-for="us in selectedTask.unlockStages" :key="us.id">
                {{ us.label }}<template v-if="us.sub">（{{ us.sub }}）</template>
              </UiTag>
            </span>
            <span v-else>无</span>
          </UiInfoRow>
        </UiSection>

        <!-- 任务奖励 -->
        <UiSection title="任务奖励">
          <div v-if="selectedTask.reward.entries.length" class="reward-grid">
            <UiRewardCard
              v-for="(rw, rIdx) in selectedTask.reward.entries"
              :key="rIdx"
              :rule="{ targetName: rw.name, targetImg: getImageUrl(rw.icon), min: rw.count, max: rw.count, typeId: rw.typeId }"
              @click="goToItem(rw.typeId)"
            />
            <UiTag v-for="(txt, tIdx) in selectedTask.reward.text" :key="'t' + tIdx" class="reward-text-chip">{{ txt }}</UiTag>
          </div>
          <p v-else class="empty-value-text">无</p>
        </UiSection>

        <!-- 任务步骤 -->
        <UiSection :title="`任务步骤（${selectedTask.steps.length}）`">
          <div class="step-list">
            <UiAccordion
              v-for="(step, sIdx) in selectedTask.steps"
              :key="sIdx"
              class="step-accordion"
              :model-value="!!openSteps[sIdx]"
              @update:model-value="toggleStep(sIdx)"
            >
              <template #title>
                <span class="step-no">步骤 {{ step.index }}</span>
                <span class="step-title">{{ step.name || '（无名步骤）' }}</span>
                <UiTag tone="accent" class="step-type-tag">{{ step.typeName }}</UiTag>
              </template>

              <div class="step-body">
                <UiInfoRow label="步骤奖励">
                  <span v-if="step.reward.entries.length || step.reward.text.length" class="chip-group">
                    <span
                      v-for="(rw, rIdx) in step.reward.entries"
                      :key="rIdx"
                      class="step-reward-chip clickable"
                      :title="`${rw.name}（点击查看物品）`"
                      @click="goToItem(rw.typeId)"
                    >
                      <img :src="getImageUrl(rw.icon)" class="step-reward-icon" loading="lazy" @error="handleImgError" />
                      ×{{ rw.count }}
                    </span>
                    <UiTag v-for="(txt, tIdx) in step.reward.text" :key="'t' + tIdx" tone="default">{{ txt }}</UiTag>
                  </span>
                  <span v-else>无</span>
                </UiInfoRow>

                <UiInfoRow label="解锁关卡" v-if="step.unlockStages.length">
                  <span class="chip-group">
                    <UiTag v-for="us in step.unlockStages" :key="us.id">{{ us.label }}</UiTag>
                  </span>
                </UiInfoRow>
                <UiInfoRow label="解锁关卡" v-else-if="step.unlockSuppressed">
                  <span class="muted-text">（passStage 不显示）</span>
                </UiInfoRow>

                <UiInfoRow v-for="(d, dIdx) in step.detail" :key="'d' + dIdx" :label="d.label" :value="d.value" />

                <UiInfoRow label="目标" v-if="step.monsters && step.monsters.length">
                  <span class="chip-group">
                    <span
                      v-for="mon in step.monsters"
                      :key="mon.id"
                      class="monster-chip clickable"
                      :title="`${mon.name}（点击查看怪物）`"
                      @click="goToMonster(mon.id)"
                    >
                      <img
                        v-if="mon.icon"
                        :src="getImageUrl(`/images/MonstersView/${mon.icon}.png`)"
                        class="monster-icon"
                        loading="lazy"
                        @error="handleImgError"
                      />
                      <span class="monster-name">{{ mon.name }}</span>
                    </span>
                  </span>
                </UiInfoRow>

                <UiInfoRow label="道具" v-if="step.submitItems && step.submitItems.length">
                  <span class="chip-group">
                    <span
                      v-for="it in step.submitItems"
                      :key="it.typeId"
                      class="submit-item-chip clickable"
                      :title="`${it.name}（点击查看物品）`"
                      @click="goToItem(it.typeId)"
                    >
                      <img :src="getImageUrl(it.icon)" class="submit-item-icon" loading="lazy" @error="handleImgError" />
                      <span class="submit-item-name">{{ it.name }}</span>
                      <span class="submit-item-count">×{{ it.count }}</span>
                    </span>
                  </span>
                </UiInfoRow>

                <UiInfoRow v-if="step.des" label="步骤描述" :value="step.des" />

                <div v-for="(dg, dgIdx) in step.dialogs" :key="'dg' + dgIdx" class="step-dialog-row">
                  <div class="step-dialog-header">
                    <span class="step-dialog-label">{{ dg.label }}</span>
                    <div v-if="!dg.meta.isText" class="dialog-actions">
                      <UiButton variant="secondary" size="sm" @click="toggleDialog(sIdx + ':' + dgIdx, dg.meta.raw)">
                        {{ dialogOpen[sIdx + ':' + dgIdx] ? '▲ 收起剧情文本' : '▼ 展开剧情文本' }}
                      </UiButton>
                      <span v-if="dg.meta.name" class="dialog-name-label">{{ dg.meta.name }}</span>
                      <span v-if="dialogLoading[sIdx + ':' + dgIdx]" class="dialog-loading">剧情读取中...</span>
                    </div>
                    <span v-else class="dialog-raw">{{ dg.meta.raw }}</span>
                  </div>
                  <DialogLines v-if="dialogOpen[sIdx + ':' + dgIdx] && dialogContent[sIdx + ':' + dgIdx]" :lines="dialogContent[sIdx + ':' + dgIdx]" />
                </div>
              </div>
            </UiAccordion>
          </div>
        </UiSection>
      </template>
    </UiModal>

    <UiBackToTop scroll-container="#taskModalScroll" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DialogLines from '../components/TaskDialogLines.vue'
import {
  UiSearchInput,
  UiFilterRow,
  UiFilterPill,
  UiCardGrid,
  UiListRow,
  UiEmptyState,
  UiBackToTop,
  UiModal,
  UiSection,
  UiInfoRow,
  UiRewardCard,
  UiTag,
  UiButton,
  UiAccordion
} from '../components/ui/index.js'
import { loadTaskData } from '../utils/taskParser'
import { TASK_TYPE_LABELS, cleanDialogueLine } from '../utils/gameMappings'
import { getImageUrl, getResourceBaseUrl } from '../utils/env'
import { useLazyList } from '../composables/useLazyList'

const route = useRoute()
const router = useRouter()

// ===== 开发者开关：true 时隐藏“已下架”任务（面向公开用户）=====
// 改成 false 则显示已下架任务（卡片上仍带灰色“已下架”徽标）
const HIDE_CLOSED_TASKS = true

const tasks = ref([])
const subOptions = ref({})
const isDataReady = ref(false)
const errorMessage = ref('')

const filterType = ref(route.query.type || 'all')
const filterSub = ref(route.query.sub || null)
const searchQuery = ref(route.query.q || '')

const detailVisible = ref(false)
const selectedTask = ref(null)
const openSteps = ref({})
const dialogOpen = ref({})
const dialogContent = ref({})
const dialogLoading = ref({})

const typeOptions = computed(() => {
  const opts = [{ key: 'all', label: '全部' }]
  for (let i = 1; i <= 5; i++) {
    opts.push({ key: String(i), label: TASK_TYPE_LABELS[i] })
  }
  return opts
})

const currentSubOptions = computed(() => {
  if (filterType.value === 'all') return []
  return subOptions.value[filterType.value] || []
})

const npcText = (npc) => {
  if (!npc) return ''
  return npc.name === '未知' ? `${npc.name}（${npc.id}）` : npc.name
}

const filteredTasks = computed(() => {
  return tasks.value.filter((item) => {
    if (filterType.value !== 'all' && String(item.type) !== filterType.value) return false
    if (filterSub.value && item.subKey !== filterSub.value) return false
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      const hit = [item.name, item.id, item.des, item.typeLabel, item.subLabel].some((x) => x && x.toLowerCase().includes(q))
      if (!hit) return false
    }
    return true
  })
})

const { displayedItems: displayedTasks } = useLazyList(filteredTasks, 20, '#tasksGridScroll')

const selectType = (key) => {
  filterType.value = key
  filterSub.value = null
}

const handleImgError = (e) => {
  e.target.style.opacity = '0.25'
}

// ---------- 详情 ----------
const openDetail = (item) => {
  selectedTask.value = item
  openSteps.value = {}
  dialogOpen.value = {}
  dialogContent.value = {}
  detailVisible.value = true
  router.replace({ query: { ...route.query, task: item.id } })
}

const closeDetail = () => {
  detailVisible.value = false
  selectedTask.value = null
  if (route.query.task) {
    const q = { ...route.query }
    delete q.task
    router.replace({ query: q })
  }
}

const goToItem = (typeId) => {
  if (!typeId) return
  router.push({ query: { ...route.query, itemId: typeId } })
}

const goToMonster = (monId) => {
  if (!monId) return
  router.push({ path: '/monsters', query: { id: monId } })
}

const toggleStep = (idx) => {
  openSteps.value[idx] = !openSteps.value[idx]
}

const toggleDialog = async (key, dialogId) => {
  if (dialogOpen.value[key]) {
    dialogOpen.value[key] = false
    return
  }
  if (!dialogContent.value[key]) {
    dialogLoading.value[key] = true
    try {
      const baseUrl = getResourceBaseUrl()
      const tryFetch = async (name) => {
        try {
          const res = await fetch(`${baseUrl}/data/taskDialogs/${encodeURIComponent(name)}.json?t=${Date.now()}`)
          if (!res.ok) return null
          return await res.json()
        } catch (e) {
          return null
        }
      }
      // 每个剧情入口只加载自己那一个剧本文件（分段事件已在解析时拆成多个入口）
      const direct = await tryFetch(dialogId)
      const listExps = direct ? direct.exps || [] : []
      dialogContent.value[key] = listExps
        .filter((e) => e.key === 'text' || e.key === 'option')
        .map((e) => {
          if (e.key === 'option') {
            return {
              isOption: true,
              options: (e.para.options || []).map((o) => cleanDialogueLine(o.text))
            }
          }
          const cleanedText = cleanDialogueLine(e.para.text || '')
          if (!cleanedText) return null
          let sp = e.para.charaName || ''
          if (sp === '主角' || sp === '[myName]' || sp === '{myName}') sp = '小工匠'
          return { isOption: false, speaker: sp, text: cleanedText }
        })
        .filter(Boolean)
      if (!dialogContent.value[key].length) {
        dialogContent.value[key] = [{ isOption: false, speaker: '', text: '（该剧情无文本内容）' }]
      }
    } catch (err) {
      dialogContent.value[key] = [{ isOption: false, speaker: '', text: `（剧情文件加载失败：${dialogId}）` }]
    } finally {
      dialogLoading.value[key] = false
    }
  }
  dialogOpen.value[key] = true
}


// ---------- 加载 ----------
onMounted(async () => {
  try {
    const data = await loadTaskData()
    tasks.value = HIDE_CLOSED_TASKS ? data.tasks.filter((t) => !t.close) : data.tasks
    subOptions.value = data.subOptions
    isDataReady.value = true
    // 分享链接直达：?task=<任务id> 自动打开详情
    const taskId = route.query.task
    if (taskId) {
      const item = data.tasks.find((t) => t.id === taskId)
      if (item) openDetail(item)
    }
  } catch (err) {
    console.error('加载任务数据失败:', err)
    errorMessage.value = '加载失败：' + (err && err.message ? err.message : err)
    isDataReady.value = true
  }
})

watch([filterType, filterSub, searchQuery], () => {
  const query = {}
  if (filterType.value !== 'all') query.type = filterType.value
  if (filterSub.value) query.sub = filterSub.value
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  if (route.query.task) query.task = route.query.task
  router.replace({ query })
})

// 外部修改 task 参数（如浏览器前进/后退、粘贴分享链接）时同步打开/关闭详情
watch(
  () => route.query.task,
  (val) => {
    if (!val || !isDataReady.value) return
    const item = tasks.value.find((t) => t.id === val)
    if (item) openDetail(item)
  }
)
</script>

<style scoped>
/* ---------- 筛选面板（半透明羊皮纸容器） ---------- */
.filter-panel {
  margin: 0 0 12px 0;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tasks-counter {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
  padding: 0 4px;
}

/* ---------- 任务列表（UiCardGrid 内通栏行布局） ---------- */
.tasks-grid-scroll :deep(.ui-card-grid) {
  align-content: flex-start;
  gap: 6px;
}
.tasks-grid-scroll :deep(.ui-list-row) {
  background-color: rgba(223, 206, 179, 0.92);
}
.dark-mode .tasks-grid-scroll :deep(.ui-list-row) {
  background-color: rgba(63, 48, 32, 0.84);
}
.task-list-row {
  grid-column: 1 / -1;
}
.task-card-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.task-card-icon {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.task-card-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.task-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.task-card-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.task-card-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}
.task-card-des {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.task-card-rewards {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}
.task-card-reward {
  display: flex;
  align-items: center;
  gap: 3px;
}
.task-card-reward-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}
.task-card-reward-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-main);
}
.task-card-arrow {
  color: var(--text-faint);
  font-size: 20px;
  line-height: 1;
}

/* ---------- 详情 ---------- */
.detail-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.task-des {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-main);
  white-space: pre-wrap;
  word-break: break-word;
  text-shadow: none;
  -webkit-font-smoothing: antialiased;
}
.des2-quote {
  margin: 8px 0 0;
  padding: 10px 12px;
  background: rgba(138, 106, 31, 0.10);
  border-left: 3px solid var(--gold);
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-main);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 剧情对话独立行（满宽，消除左侧空隙） */
.step-dialog-row,
.get-task-dialog-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 7px 2px;
  border-bottom: 1px dashed var(--border-soft, rgba(143, 115, 81, 0.45));
  width: 100%;
  box-sizing: border-box;
}
.step-dialog-row:last-child {
  border-bottom: none;
}
.step-dialog-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
}
.step-dialog-label {
  flex: 0 0 75px;
  width: 75px;
  flex-shrink: 0;
  font-weight: 700;
  font-size: 14px;
  color: var(--text-muted, #6b5134);
  white-space: nowrap;
}

/* 详情弹窗与步骤内所有 label 固定宽度（75px），确保右侧内容垂直基准线绝对对齐 */
:deep(.ui-info-row__label) {
  flex: 0 0 75px;
  width: 75px;
  flex-shrink: 0;
}

/* UiInfoRow 值插槽内布局：全左对齐 */
.chip-group {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  gap: 4px;
  text-align: left;
}
.info-slot {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  min-width: 0;
  width: 100%;
  text-align: left;
}
.dialog-actions {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}
.dialog-raw {
  display: block;
  width: 100%;
  text-align: left;
}
.dialog-name-label {
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-word;
}
.dialog-loading {
  font-size: 12px;
  color: var(--text-muted);
}
.muted-text {
  color: var(--text-muted);
}
.empty-value-text {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
}

/* 步骤内部全部左对齐 */
.step-body :deep(.ui-info-row) {
  justify-content: flex-start;
}
.step-body :deep(.ui-info-row__value) {
  text-align: left;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
}

/* 奖励网格 */
.reward-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.reward-text-chip {
  justify-self: start;
}

/* 步骤折叠块 */
.step-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.step-accordion :deep(.ui-accordion__title) {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: 1;
  min-width: 0;
  text-align: left;
}
.step-no {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-ink);
  margin-top: 1px;
}
.step-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  text-align: left;
  line-height: 1.45;
  word-break: break-word;
  white-space: normal;
}
.step-type-tag {
  flex-shrink: 0;
  margin-top: 1px;
}
.step-body {
  display: flex;
  flex-direction: column;
}
.step-reward-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin: 2px 6px 2px 0;
}
.step-reward-chip.clickable {
  cursor: pointer;
}
.step-reward-chip.clickable:hover {
  color: var(--accent-ink);
}
.step-reward-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

/* 狩猎目标：怪物小图标 */
.monster-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 2px 10px 2px 0;
}
.monster-chip.clickable {
  cursor: pointer;
}
.monster-chip.clickable:hover .monster-name {
  color: var(--accent-ink);
}
.monster-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
}
.monster-name {
  font-size: 13px;
  color: var(--text-main);
}

/* 提交/获取道具：图标 + 名称 + 数量 */
.submit-item-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 2px 10px 2px 0;
}
.submit-item-chip.clickable {
  cursor: pointer;
}
.submit-item-chip.clickable:hover .submit-item-name {
  color: var(--accent-ink);
}
.submit-item-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex-shrink: 0;
}
.submit-item-name {
  font-size: 13px;
  color: var(--text-main);
}
.submit-item-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

/* 手机端适配 */
@media (max-width: 640px) {
  .task-list-row {
    flex-wrap: wrap;
  }
  .task-list-row :deep(.ui-list-row__right) {
    width: 100%;
    justify-content: space-between;
    border-top: 1px dashed var(--border-soft);
    padding-top: 6px;
  }
  .step-accordion :deep(.ui-accordion__head) {
    align-items: flex-start;
    padding: 8px 10px;
  }
}
</style>
