<template>
  <article class="method-list-item" @click="emit('run', method)">
    <header class="method-topline">
      <div class="method-heading">
        <h3 :title="method.name">{{ method.name }}</h3>
        <div class="badge-row">
          <span v-if="method.engine" class="chip engine-chip">{{ method.engine.toUpperCase() }}</span>
          <span v-if="method.execution" class="chip exec-chip">{{ method.execution.toUpperCase() }}</span>
          <span v-if="method.methodType" class="chip neutral-chip">{{ formatLabel(method.methodType) }}</span>
        </div>
      </div>

      <div class="headline-metrics">
        <span class="headline-pill">{{ method.paramCount ?? 0 }} {{ $t('dataMethodCard.parameters') }}</span>
        <span class="headline-pill">{{ method.inputCount ?? 0 }} {{ $t('dataMethodCard.inputs') }}</span>
        <span class="headline-pill">{{ method.outputCount ?? 0 }} {{ $t('dataMethodCard.outputs') }}</span>
      </div>
    </header>

    <div class="method-body">
      <div class="engine-thumb" aria-hidden="true">
        <span>{{ engineMonogram }}</span>
      </div>

      <div class="summary-column">
        <p class="description" :title="method.longDescription || method.description">
          {{ truncate(method.longDescription || method.description, 220) }}
        </p>

        <div class="meta-line" v-if="visibleInputKinds.length">
          <span class="meta-label">{{ $t('dataMethodCard.inputKinds') }}</span>
          <div class="tag-row">
            <span v-for="kind in visibleInputKinds" :key="`input-${kind}`" class="tag-chip input-tag">
              {{ kind }}
            </span>
          </div>
        </div>

        <div class="meta-line" v-if="visibleOutputKinds.length">
          <span class="meta-label">{{ $t('dataMethodCard.outputKinds') }}</span>
          <div class="tag-row">
            <span v-for="kind in visibleOutputKinds" :key="`output-${kind}`" class="tag-chip output-tag">
              {{ kind }}
            </span>
          </div>
        </div>

        <div class="tag-row utility-tags" v-if="visibleTags.length">
          <span v-for="tag in visibleTags" :key="tag" class="tag-chip theme-tag">
            {{ tag }}
          </span>
        </div>
      </div>

      <aside class="action-column">
        <div class="side-stat">
          <span class="stat-label">{{ $t('dataMethodCard.options') }}</span>
          <strong>{{ method.optionCount ?? 0 }}</strong>
        </div>
        <button class="run-btn" @click.stop="emit('run', method)">
          {{ $t('modelCard.run') }}
        </button>
      </aside>
    </div>

    <footer class="method-footer">
      <div class="footer-meta">
        <span v-if="method.category" class="footer-chip">{{ formatLabel(method.category) }}</span>
        <span class="footer-date">{{ formatDate(method.createTime) }}</span>
      </div>

      <div class="footer-meta">
        <span class="footer-date">{{ method.author || $t('dataCard.unknown') }}</span>
      </div>
    </footer>
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
</script>

<style scoped>
.method-list-item {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.method-list-item:hover {
  border-color: rgba(var(--accent-rgb), 0.45);
  box-shadow: var(--shadow-md);
}

.method-topline,
.method-body,
.method-footer {
  padding-left: 1.35rem;
  padding-right: 1.35rem;
}

.method-topline {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding-top: 1.2rem;
}

.method-heading h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.42rem;
  line-height: 1.18;
  letter-spacing: -0.02em;
}

.badge-row,
.headline-metrics,
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.badge-row {
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

.engine-chip,
.theme-tag,
.headline-pill {
  background: var(--accent-light);
  color: var(--accent-color);
}

.exec-chip,
.output-tag {
  background: rgba(47, 125, 78, 0.12);
  color: var(--success-color);
}

.neutral-chip,
.footer-chip {
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-secondary);
}

.input-tag {
  background: rgba(var(--accent-rgb), 0.08);
  color: var(--accent-color);
}

.method-body {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 170px;
  gap: 1rem 1.25rem;
  align-items: center;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.engine-thumb {
  width: 88px;
  height: 88px;
  border-radius: 20px;
  background: rgba(var(--accent-rgb), 0.08);
  border: 1px solid rgba(var(--accent-rgb), 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.engine-thumb span {
  color: var(--accent-color);
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.summary-column {
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

.meta-line {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  margin-top: 0.9rem;
}

.meta-label {
  min-width: 72px;
  padding-top: 0.15rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.utility-tags {
  margin-top: 0.9rem;
}

.action-column {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.85rem;
}

.side-stat {
  padding: 0.85rem 0.9rem;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.03);
  border: 1px solid var(--border-light);
}

.stat-label {
  display: block;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.35rem;
}

.side-stat strong {
  color: var(--text-primary);
  font-size: 0.95rem;
}

.run-btn {
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--accent-color);
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 700;
  padding: 0.9rem 1rem;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.run-btn:hover {
  background: var(--accent-hover);
}

.method-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding-top: 0.9rem;
  padding-bottom: 0.95rem;
  border-top: 1px solid var(--border-light);
  background: #fbfcfd;
}

.footer-meta {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

.footer-date {
  color: var(--text-secondary);
  font-size: 0.86rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 980px) {
  .method-body {
    grid-template-columns: 96px minmax(0, 1fr);
  }

  .action-column {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: flex-end;
  }

  .side-stat {
    min-width: 180px;
  }

  .run-btn {
    min-width: 180px;
  }
}

@media (max-width: 720px) {
  .method-topline,
  .method-footer,
  .footer-meta,
  .action-column,
  .meta-line {
    flex-direction: column;
    align-items: flex-start;
  }

  .method-body {
    grid-template-columns: 1fr;
  }

  .engine-thumb {
    width: 80px;
    height: 80px;
  }

  .action-column,
  .side-stat,
  .run-btn {
    width: 100%;
  }
}
</style>
