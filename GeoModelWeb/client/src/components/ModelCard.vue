<template>
  <article class="model-list-item" @click="emit('run', model)">
    <header class="model-topline">
      <div class="model-heading">
        <h3 :title="model.name">{{ model.name }}</h3>
        <div class="status-row">
          <span class="chip status-chip">{{ model.status || $t('modelCard.catalog') }}</span>
          <span v-if="model.deploy" class="chip deploy-chip">{{ $t('modelCard.deployed') }}</span>
          <span v-if="model.online" class="chip online-chip">{{ $t('modelCard.online') }}</span>
        </div>
      </div>

      <div class="headline-metrics">
        <span class="headline-pill">{{ formatCompactNumber(viewCount) }} {{ $t('modelCard.views') }}</span>
        <span class="headline-pill">{{ formatCompactNumber(invokeCount) }} {{ $t('modelCard.runs') }}</span>
      </div>
    </header>

    <div class="model-body">
      <div class="model-thumb" aria-hidden="true">
        <span>{{ modelMonogram }}</span>
      </div>

      <div class="model-summary">
        <p class="description" :title="model.description">
          {{ truncate(model.description, 240) || $t('ogmsModelView.noDescription') }}
        </p>

        <div class="tag-row" v-if="visibleTags.length">
          <span v-for="tag in visibleTags" :key="tag" class="tag-chip">
            {{ tag }}
          </span>
        </div>
      </div>

      <aside class="action-column">
        <div class="side-metric">
          <span class="metric-label">{{ $t('modelCard.updated') }}</span>
          <strong>{{ formatDate(model.lastModifyTime || model.createTime) }}</strong>
        </div>
        <button class="primary-btn" @click.stop="emit('run', model)">
          {{ $t('ogmsModelView.runModel') }}
        </button>
      </aside>
    </div>

    <footer class="model-footer">
      <div class="author-meta">
        <span class="author-avatar">{{ authorInitial }}</span>
        <span class="author-text" :title="model.author || $t('dataCard.unknown')">
          {{ compactAuthor }}
        </span>
      </div>

      <div class="footer-meta">
        <span v-if="healthLabel" class="footer-chip">{{ healthLabel }}</span>
        <span class="footer-date">{{ formatDate(model.createTime) }}</span>
      </div>
    </footer>
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

const compactAuthor = computed(() => {
  const value = String(props.model.author || '').trim()
  if (!value) return t('dataCard.unknown')
  if (value.length <= 28) return value
  return `${value.slice(0, 14)}...${value.slice(-8)}`
})

const authorInitial = computed(() => {
  const value = String(props.model.author || '').trim()
  return value ? value[0].toUpperCase() : 'U'
})

const healthLabel = computed(() => {
  if (props.model.healthText) return props.model.healthText
  if (props.model.online) return t('modelCard.healthy')
  return ''
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
</script>

<style scoped>
.model-list-item {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.model-list-item:hover {
  border-color: rgba(var(--accent-rgb), 0.5);
  box-shadow: var(--shadow-md);
}

.model-topline,
.model-body,
.model-footer {
  padding-left: 1.35rem;
  padding-right: 1.35rem;
}

.model-topline {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding-top: 1.2rem;
}

.model-heading {
  min-width: 0;
}

.model-heading h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.45rem;
  line-height: 1.18;
  letter-spacing: -0.02em;
}

.status-row,
.headline-metrics,
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.status-row {
  margin-top: 0.7rem;
}

.chip,
.headline-pill,
.tag-chip,
.footer-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.32rem 0.72rem;
  font-size: 0.74rem;
  font-weight: 600;
}

.status-chip {
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-secondary);
}

.deploy-chip {
  background: rgba(47, 125, 78, 0.12);
  color: var(--success-color);
}

.online-chip,
.headline-pill,
.tag-chip {
  background: var(--accent-light);
  color: var(--accent-color);
}

.model-body {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 170px;
  gap: 1rem 1.25rem;
  align-items: center;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.model-thumb {
  width: 88px;
  height: 88px;
  border-radius: 20px;
  background: rgba(var(--accent-rgb), 0.08);
  border: 1px solid rgba(var(--accent-rgb), 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.model-thumb span {
  color: var(--accent-color);
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.model-summary {
  min-width: 0;
}

.description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.97rem;
  line-height: 1.72;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tag-row {
  margin-top: 0.9rem;
}

.action-column {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.85rem;
}

.side-metric {
  padding: 0.85rem 0.9rem;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.03);
  border: 1px solid var(--border-light);
}

.metric-label {
  display: block;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.35rem;
}

.side-metric strong {
  color: var(--text-primary);
  font-size: 0.95rem;
}

.primary-btn {
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--accent-color);
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 700;
  padding: 0.9rem 1rem;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.primary-btn:hover {
  background: var(--accent-hover);
}

.model-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding-top: 0.9rem;
  padding-bottom: 0.95rem;
  border-top: 1px solid var(--border-light);
  background: #fbfcfd;
}

.author-meta,
.footer-meta {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

.author-avatar {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: rgba(var(--accent-rgb), 0.14);
  color: var(--accent-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.84rem;
  font-weight: 700;
  flex-shrink: 0;
}

.author-text,
.footer-date {
  color: var(--text-secondary);
  font-size: 0.86rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.footer-chip {
  background: rgba(47, 125, 78, 0.12);
  color: var(--success-color);
}

@media (max-width: 980px) {
  .model-body {
    grid-template-columns: 96px minmax(0, 1fr);
  }

  .action-column {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: flex-end;
  }

  .side-metric {
    min-width: 180px;
  }

  .primary-btn {
    min-width: 180px;
  }
}

@media (max-width: 720px) {
  .model-topline,
  .model-footer,
  .footer-meta,
  .author-meta,
  .action-column {
    flex-direction: column;
    align-items: flex-start;
  }

  .model-body {
    grid-template-columns: 1fr;
  }

  .model-thumb {
    width: 80px;
    height: 80px;
  }

  .action-column,
  .side-metric,
  .primary-btn {
    width: 100%;
  }
}
</style>
