<template>
  <article class="method-list-item">
    <div class="method-card-shell">
      <div class="engine-thumb" aria-hidden="true">
        <span>{{ engineMonogram }}</span>
      </div>

      <div class="summary-column">
        <div class="title-row">
          <h3 :title="method.name">{{ method.name }}</h3>
          <div class="status-row">
            <span v-if="method.engine" class="chip engine-chip">{{ method.engine.toUpperCase() }}</span>
            <span v-if="method.execution" class="chip exec-chip">{{ method.execution.toUpperCase() }}</span>
            <span v-if="method.methodType" class="chip neutral-chip">{{ formatLabel(method.methodType) }}</span>
          </div>
        </div>

        <p class="description" :title="method.longDescription || method.description">
          {{ truncate(method.longDescription || method.description, 220) }}
        </p>

        <div class="metric-row">
          <span class="metric-item">{{ method.paramCount ?? 0 }} {{ $t('dataMethodCard.parameters') }}</span>
          <span class="metric-item">{{ method.inputCount ?? 0 }} {{ $t('dataMethodCard.inputs') }}</span>
          <span class="metric-item">{{ method.outputCount ?? 0 }} {{ $t('dataMethodCard.outputs') }}</span>
          <span class="metric-item">{{ $t('dataMethodCard.options') }} {{ method.optionCount ?? 0 }}</span>
          <span class="metric-item">{{ formatDate(method.createTime) }}</span>
        </div>

        <div v-if="visibleSummaryTags.length" class="tag-row">
          <span v-for="tag in visibleSummaryTags" :key="tag" class="tag-chip">
            {{ tag }}
          </span>
        </div>
      </div>

      <aside class="action-column">
        <button class="primary-btn" @click.stop="emit('run', method)">
          {{ $t('modelCard.run') }}
        </button>
        <button class="ghost-btn" @click.stop="openSpecs">
          Specs
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
  method: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['run'])

const visibleTags = computed(() => (Array.isArray(props.method.tags) ? props.method.tags.slice(0, 5) : []))
const visibleInputKinds = computed(() => normalizeKinds(props.method.inputKinds).slice(0, 4))
const visibleOutputKinds = computed(() => normalizeKinds(props.method.outputKinds).slice(0, 4))
const visibleSummaryTags = computed(() => [
  ...visibleInputKinds.value.slice(0, 1),
  ...visibleOutputKinds.value.slice(0, 1),
  ...visibleTags.value.slice(0, 2)
])

const engineMonogram = computed(() => {
  const label = String(props.method.engine || 'DM')
  return label.slice(0, 2).toUpperCase()
})

const truncate = (text, length) => {
  if (!text) return t('dataCard.noDescription')
  return text.length > length ? `${text.slice(0, length)}...` : text
}

const normalizeKinds = (value) => {
  if (!Array.isArray(value)) return []
  return value.map(item => formatLabel(item)).filter(Boolean)
}

const formatLabel = (value) => {
  if (!value) return ''
  return String(value)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

const formatDate = (value) => {
  if (!value) return '--'
  return String(value).split(' ')[0]
}

const openSpecs = () => {
  if (!props.method?.name) return
  window.open(`/api/datamethods/${encodeURIComponent(props.method.name)}`, '_blank')
}
</script>

<style scoped>
.method-list-item {
  background: rgba(255, 255, 255, 0.98);
  border: none;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(var(--primary-rgb), 0.06);
  transition: background-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
}

.method-list-item:hover {
  background: rgba(213, 227, 255, 0.5);
  box-shadow: 0 14px 30px rgba(var(--primary-rgb), 0.08);
  transform: translateY(-2px);
}

.method-card-shell {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 148px;
  gap: 1.5rem;
  align-items: center;
  padding: 1.5rem;
}

.summary-column {
  min-width: 0;
}

.title-row,
.status-row,
.metric-row,
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.title-row {
  align-items: center;
  gap: 0.7rem;
}

.summary-column h3 {
  margin: 0;
  color: var(--text-primary);
  font-family: 'Manrope', sans-serif;
  font-size: 1.55rem;
  line-height: 1.14;
  letter-spacing: -0.03em;
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

.engine-chip {
  background: var(--accent-light);
  color: var(--accent-color);
}

.exec-chip,
.output-tag {
  background: rgba(47, 125, 78, 0.12);
  color: var(--success-color);
}

.neutral-chip {
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-secondary);
}

.engine-thumb {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  background: rgba(var(--primary-rgb), 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.engine-thumb span {
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

.tag-row {
  margin-top: 0.9rem;
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
  .method-card-shell {
    grid-template-columns: 96px minmax(0, 1fr);
  }

  .action-column {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: flex-end;
    min-width: 180px;
  }
}

@media (max-width: 720px) {
  .method-card-shell {
    grid-template-columns: 1fr;
  }

  .engine-thumb {
    width: 80px;
    height: 80px;
  }

  .action-column,
  .primary-btn,
  .ghost-btn {
    width: 100%;
  }
}
</style>
