<template>
  <article class="model-list-item">
    <div class="model-card-shell">
      <div class="model-thumb" aria-hidden="true">
        <span>{{ modelMonogram }}</span>
      </div>

      <div class="model-summary">
        <div class="title-row">
          <h3 :title="model.name">{{ model.name }}</h3>
          <div class="status-row">
            <span class="chip status-chip">{{ model.status || $t('modelCard.catalog') }}</span>
            <span v-if="model.deploy" class="chip deploy-chip">{{ $t('modelCard.deployed') }}</span>
            <span v-if="model.online" class="chip online-chip">{{ $t('modelCard.online') }}</span>
          </div>
        </div>

        <p class="description" :title="model.description">
          {{ truncate(model.description, 220) || $t('ogmsModelView.noDescription') }}
        </p>

        <div class="metric-row">
          <span class="metric-item">{{ formatCompactNumber(viewCount) }} {{ $t('modelCard.views') }}</span>
          <span class="metric-item">{{ formatCompactNumber(invokeCount) }} {{ $t('modelCard.runs') }}</span>
          <span class="metric-item">{{ $t('modelCard.updated') }} {{ formatDate(model.lastModifyTime || model.createTime) }}</span>
          <span v-if="visibleTags.length" class="tag-chip">{{ visibleTags[0] }}</span>
        </div>
      </div>

      <aside class="action-column">
        <button class="primary-btn" @click.stop="emit('run', model)">
          {{ $t('ogmsModelView.runModel') }}
        </button>
        <button class="ghost-btn" @click.stop="openMetadata">
          Metadata
        </button>
      </aside>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  model: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['run'])

const visibleTags = computed(() => (Array.isArray(props.model.tags) ? props.model.tags.slice(0, 5) : []))
const viewCount = computed(() => toNumber(props.model.viewCount))
const invokeCount = computed(() => toNumber(props.model.invokeCount))

const modelMonogram = computed(() => {
  const words = String(props.model.name || '')
    .split(/[\s_-]+/)
    .map(word => word.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (!words.length) return 'GM'
  return words.map(word => word[0]).join('').toUpperCase()
})

const truncate = (text, length) => {
  if (!text) return ''
  return text.length > length ? `${text.slice(0, length)}...` : text
}

const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

const formatCompactNumber = (value) => {
  const count = toNumber(value)
  if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(count)
}

const formatDate = (value) => {
  if (!value) return '--'
  return String(value).split(' ')[0]
}

const openMetadata = () => {
  if (!props.model?.name) return
  window.open(`/api/ogms/models/${encodeURIComponent(props.model.name)}`, '_blank')
}
</script>

<style scoped>
.model-list-item {
  background: rgba(255, 255, 255, 0.98);
  border: none;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(var(--primary-rgb), 0.06);
  transition: background-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
}

.model-list-item:hover {
  background: rgba(213, 227, 255, 0.5);
  box-shadow: 0 14px 30px rgba(var(--primary-rgb), 0.08);
  transform: translateY(-2px);
}

.model-card-shell {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 148px;
  gap: 1.5rem;
  align-items: center;
  padding: 1.5rem;
}

.title-row,
.status-row,
.metric-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.title-row {
  align-items: center;
  gap: 0.7rem;
}

.model-summary {
  min-width: 0;
}

.model-summary h3 {
  margin: 0;
  color: var(--text-primary);
  font-family: 'Manrope', sans-serif;
  font-size: 1.55rem;
  line-height: 1.14;
  letter-spacing: -0.03em;
}

.status-row {
  margin-left: 0.25rem;
}

.chip,
.tag-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  padding: 0.28rem 0.6rem;
  font-size: 0.66rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  font-weight: 800;
}

.status-chip {
  background: rgba(0, 104, 118, 0.1);
  color: var(--accent-color);
}

.deploy-chip {
  background: rgba(245, 158, 11, 0.14);
  color: #b36a00;
}

.online-chip {
  background: rgba(47, 125, 78, 0.12);
  color: var(--success-color);
}

.model-thumb {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  background: rgba(var(--primary-rgb), 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.model-thumb span {
  color: var(--primary-strong);
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.description {
  margin: 0.85rem 0 0;
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.metric-row {
  align-items: center;
  gap: 1rem;
  margin-top: 0.95rem;
}

.metric-item {
  color: var(--text-muted);
  font-size: 0.82rem;
  white-space: nowrap;
}

.tag-chip {
  background: rgba(180, 202, 214, 0.28);
  color: #354a53;
  border-radius: 999px;
  padding: 0.42rem 0.8rem;
  font-size: 0.62rem;
}

.action-column {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.primary-btn {
  border: none;
  border-radius: 8px;
  background: var(--accent-color);
  color: #ffffff;
  font-family: 'Manrope', sans-serif;
  font-size: 0.92rem;
  font-weight: 800;
  padding: 0.92rem 1rem;
  cursor: pointer;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.primary-btn:hover {
  opacity: 0.92;
}

.ghost-btn {
  border: 1px solid rgba(0, 30, 64, 0.12);
  border-radius: 8px;
  background: transparent;
  color: var(--primary-strong);
  font-family: 'Manrope', sans-serif;
  font-size: 0.92rem;
  font-weight: 800;
  padding: 0.92rem 1rem;
  cursor: pointer;
}

@media (max-width: 980px) {
  .model-card-shell {
    grid-template-columns: 80px minmax(0, 1fr);
  }

  .action-column {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: flex-start;
  }

  .primary-btn,
  .ghost-btn {
    min-width: 160px;
  }
}

@media (max-width: 720px) {
  .model-card-shell {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .model-thumb {
    width: 80px;
    height: 80px;
  }

  .title-row,
  .action-column {
    flex-direction: column;
    align-items: flex-start;
  }

  .action-column,
  .primary-btn,
  .ghost-btn {
    width: 100%;
  }
}
</style>
