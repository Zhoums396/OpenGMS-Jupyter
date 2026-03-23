<template>
  <article class="data-list-item" @click="handleClick">
    <header class="data-topline">
      <div class="data-heading">
        <h3 :title="data.name">{{ data.name }}</h3>
        <div class="badge-row">
          <span v-if="headerBadge" class="chip geo-chip" :class="headerBadge.className">
            {{ headerBadge.label }}
          </span>
          <span v-if="primaryFormat" class="chip neutral-chip">{{ primaryFormat }}</span>
          <span v-if="data.publicBoolean" class="chip public-chip">{{ $t('dataCard.public') }}</span>
        </div>
      </div>

      <div class="headline-metrics">
        <span class="headline-pill">{{ resolvedSize }}</span>
        <span class="headline-pill">{{ fileCount }} {{ $t('dataCard.files') }}</span>
        <span class="headline-pill">{{ formatCompactNumber(normalizedViews) }} {{ $t('dataCard.views') }}</span>
      </div>
    </header>

    <div class="data-body">
      <div class="media-column">
        <img
          v-if="activePreviewUrl"
          :src="activePreviewUrl"
          :alt="data.name"
          class="preview-image"
          @error="handlePreviewError"
        >
        <div v-else class="format-tile" :class="headerBadge?.className || 'generic'">
          <span class="format-code">{{ primaryFormat || 'DATA' }}</span>
        </div>
      </div>

      <div class="summary-column">
        <p class="description" :title="resolvedDescription">
          {{ truncate(resolvedDescription, 220) }}
        </p>

        <div class="meta-line" v-if="themeTags.length">
          <span class="meta-label">{{ $t('dataCard.themes') }}</span>
          <div class="tag-row">
            <span v-for="tag in themeTags.slice(0, 2)" :key="`theme-${tag}`" class="tag-chip theme-tag">
              {{ tag }}
            </span>
          </div>
        </div>

        <div class="meta-line" v-if="domainTags.length">
          <span class="meta-label">{{ $t('dataCard.domains') }}</span>
          <div class="tag-row">
            <span v-for="tag in domainTags.slice(0, 4)" :key="`domain-${tag}`" class="tag-chip domain-tag">
              {{ tag }}
            </span>
          </div>
        </div>
      </div>

      <aside class="action-column">
        <div class="side-stat">
          <span class="stat-label">{{ $t('dataCard.access') }}</span>
          <strong>{{ data.publicBoolean ? $t('dataCard.public') : $t('dataCard.restricted') }}</strong>
        </div>
        <button class="download-btn" @click.stop="handleDownload">
          {{ $t('dataCard.download') }}
        </button>
      </aside>
    </div>

    <footer class="data-footer">
      <div class="footer-meta">
        <span class="author-avatar">{{ authorInitial }}</span>
        <span class="author-text" :title="data.userEmail || $t('dataCard.unknown')">
          {{ compactAuthor }}
        </span>
      </div>

      <div class="footer-meta">
        <span class="footer-chip">{{ data.publicBoolean ? $t('dataCard.public') : $t('dataCard.restricted') }}</span>
        <span class="footer-date">{{ formatTime(data.createTime) }}</span>
      </div>
    </footer>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['view', 'download'])

const VECTOR_TYPES = new Set(['shp', 'geojson', 'json', 'kml', 'kmz', 'gpx', 'gpkg'])
const RASTER_TYPES = new Set(['tif', 'tiff', 'geotiff', 'img', 'dem', 'asc', 'grd', 'nc', 'netcdf', 'hdf', 'h5'])
const TABLE_TYPES = new Set(['csv', 'tsv', 'xlsx', 'xls'])
const ARCHIVE_TYPES = new Set(['zip', 'rar', '7z', 'tar', 'gz'])
const DOCUMENT_TYPES = new Set(['html', 'htm', 'pdf', 'txt', 'doc', 'docx', 'xml', 'license'])
const CODE_TYPES = new Set(['py', 'js', 'ts', 'java', 'cpp', 'c', 'iml', 'mdl'])
const DATA_CENTER_BASE_URL = 'https://geomodeling.njnu.edu.cn/OpenGMPBack'
const DATA_CENTER_WEB_HOST = 'https://geomodeling.njnu.edu.cn'
const DATA_CENTER_NODE_HOST = 'https://geomodeling.njnu.edu.cn/OpenGMPNodeBack'

const fileCount = computed(() => {
  const count = props.data.subDataItems?.length || 0
  return count > 0 ? count : 1
})

const resolvedDescription = computed(() => {
  const description = String(props.data.description || '').trim()
  if (description) return description

  const subDescription = String(props.data.subDataItems?.[0]?.description || '').trim()
  if (subDescription) return subDescription

  return t('dataCard.noDescription')
})

const normalizedViews = computed(() => {
  const value = Number(props.data.pageviews)
  return Number.isFinite(value) && value > 0 ? value : 0
})

const themeTags = computed(() => splitTags(props.data.problemTags))
const domainTags = computed(() => splitTags(props.data.normalTags))

const compactAuthor = computed(() => {
  const value = String(props.data.userEmail || '').trim()
  if (!value) return t('dataCard.unknown')
  if (value.length <= 28) return value
  return `${value.slice(0, 14)}...${value.slice(-8)}`
})

const authorInitial = computed(() => {
  const value = String(props.data.userEmail || '').trim()
  return value ? value[0].toUpperCase() : 'U'
})

const normalizePreviewCandidate = (value) => {
  const text = String(value || '').trim()
  if (!text) return []

  if (text.startsWith('http://') || text.startsWith('https://')) return [text]

  if (text.startsWith('/store/')) {
    return [
      `${DATA_CENTER_BASE_URL}${text}`,
      `${DATA_CENTER_WEB_HOST}${text}`,
      `${DATA_CENTER_NODE_HOST}${text}`
    ]
  }

  if (text.startsWith('/resourceData/')) {
    return [
      `${DATA_CENTER_BASE_URL}${text}`,
      `${DATA_CENTER_BASE_URL}/store${text}`,
      `${DATA_CENTER_WEB_HOST}${text}`,
      `${DATA_CENTER_WEB_HOST}/store${text}`,
      `${DATA_CENTER_NODE_HOST}${text}`,
      `${DATA_CENTER_NODE_HOST}/store${text}`
    ]
  }

  if (text.startsWith('/')) {
    return [
      `${DATA_CENTER_BASE_URL}${text}`,
      `${DATA_CENTER_WEB_HOST}${text}`,
      `${DATA_CENTER_NODE_HOST}${text}`
    ]
  }

  return [
    `${DATA_CENTER_BASE_URL}/${text}`,
    `${DATA_CENTER_WEB_HOST}/${text}`,
    `${DATA_CENTER_NODE_HOST}/${text}`
  ]
}

const previewCandidates = computed(() => {
  const input = [
    ...(Array.isArray(props.data.thumbnailCandidates) ? props.data.thumbnailCandidates : []),
    props.data.thumbnailUrl,
    props.data.imgWebAddress,
    props.data.imgRelativePath,
    props.data.subDataItems?.[0]?.visualWebAddress
  ]

  const seen = new Set()
  const resolved = []

  input.forEach(candidate => {
    normalizePreviewCandidate(candidate).forEach(url => {
      if (!seen.has(url)) {
        seen.add(url)
        resolved.push(url)
      }
    })
  })

  return resolved
})

const previewCandidateIndex = ref(0)

watch(previewCandidates, () => {
  previewCandidateIndex.value = 0
}, { immediate: true })

const activePreviewUrl = computed(() => previewCandidates.value[previewCandidateIndex.value] || '')

const handlePreviewError = () => {
  if (previewCandidateIndex.value < previewCandidates.value.length - 1) {
    previewCandidateIndex.value += 1
    return
  }

  previewCandidateIndex.value = previewCandidates.value.length
}

const getFirstSubType = (data) => {
  const subType = data.subDataItems?.[0]?.type
  if (subType) return String(subType).trim()

  const subName = data.subDataItems?.[0]?.name
  if (subName && subName.includes('.')) return subName.split('.').pop()

  return ''
}

const primaryFormat = computed(() => {
  const rawType = getFirstSubType(props.data) || props.data.type || ''
  if (!rawType) return ''

  const normalized = rawType.toLowerCase()
  if (normalized === 'data') return fileCount.value > 1 ? t('dataCard.resourceSet') : 'DATA'
  return rawType.toUpperCase()
})

const headerBadge = computed(() => {
  const geoType = props.data.geoType
  if (geoType === '矢量' || geoType === 'vector') return { label: t('dataCard.vector'), className: 'vector' }
  if (geoType === '栅格' || geoType === 'raster') return { label: t('dataCard.raster'), className: 'raster' }

  const rawSubType = getFirstSubType(props.data)
  if (!rawSubType) return null

  const normalizedSubType = rawSubType.toLowerCase()
  if (VECTOR_TYPES.has(normalizedSubType)) return { label: t('dataCard.vector'), className: 'vector' }
  if (RASTER_TYPES.has(normalizedSubType)) return { label: t('dataCard.raster'), className: 'raster' }
  if (TABLE_TYPES.has(normalizedSubType)) return { label: rawSubType.toUpperCase(), className: 'table' }
  if (ARCHIVE_TYPES.has(normalizedSubType)) return { label: rawSubType.toUpperCase(), className: 'archive' }
  if (DOCUMENT_TYPES.has(normalizedSubType)) return { label: rawSubType.toUpperCase(), className: 'document' }
  if (CODE_TYPES.has(normalizedSubType)) return { label: rawSubType.toUpperCase(), className: 'code' }
  return { label: rawSubType.toUpperCase(), className: 'generic' }
})

const resolvedSize = computed(() => {
  if (props.data.fileSize) return formatSize(props.data.fileSize)

  const firstSize = props.data.subDataItems?.[0]?.size
  if (firstSize) return normalizeSubItemSize(firstSize)

  return t('dataCard.unknown')
})

const splitTags = (value) => {
  if (!value) return []
  return String(value)
    .split(/[，,]/)
    .map(item => item.trim())
    .filter(Boolean)
}

const truncate = (text, length) => {
  if (!text) return t('dataCard.noDescription')
  return text.length > length ? `${text.slice(0, length)}...` : text
}

const formatSize = (bytes) => {
  const size = Number.parseInt(bytes, 10)
  if (!Number.isFinite(size) || size <= 0) return t('dataCard.unknown')
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const normalizeSubItemSize = (value) => {
  const text = String(value).trim()
  if (!text) return t('dataCard.unknown')
  if (/^[\d.]+\s*(KB|MB|GB|B)$/i.test(text)) return text.toUpperCase()

  const numeric = Number.parseFloat(text)
  if (Number.isFinite(numeric) && numeric > 0) return formatSize(numeric)
  return text
}

const formatTime = (timeStr) => {
  if (!timeStr) return '--'
  return String(timeStr).split(' ')[0]
}

const formatCompactNumber = (value) => {
  const count = Number(value)
  if (!Number.isFinite(count) || count <= 0) return '0'
  if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(count)
}

const handleClick = () => emit('view', props.data)
const handleDownload = () => emit('download', props.data)
</script>

<style scoped>
.data-list-item {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.data-list-item:hover {
  border-color: rgba(var(--accent-rgb), 0.45);
  box-shadow: var(--shadow-md);
}

.data-topline,
.data-body,
.data-footer {
  padding-left: 1.35rem;
  padding-right: 1.35rem;
}

.data-topline {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding-top: 1.2rem;
}

.data-heading h3 {
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

.neutral-chip,
.headline-pill {
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-secondary);
}

.geo-chip.vector {
  background: rgba(47, 125, 78, 0.12);
  color: var(--success-color);
}

.geo-chip.raster,
.domain-tag {
  background: rgba(var(--accent-rgb), 0.08);
  color: var(--accent-color);
}

.geo-chip.table,
.theme-tag {
  background: var(--accent-light);
  color: var(--accent-color);
}

.geo-chip.archive,
.geo-chip.document,
.geo-chip.code,
.geo-chip.generic {
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-secondary);
}

.public-chip,
.footer-chip {
  background: rgba(47, 125, 78, 0.12);
  color: var(--success-color);
}

.data-body {
  display: grid;
  grid-template-columns: 116px minmax(0, 1fr) 170px;
  gap: 1rem 1.25rem;
  align-items: center;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.media-column {
  display: flex;
  justify-content: center;
}

.preview-image,
.format-tile {
  width: 96px;
  height: 96px;
  border-radius: 20px;
}

.preview-image {
  object-fit: cover;
  background: #f7f8fa;
  border: 1px solid var(--border-light);
}

.format-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.03);
  border: 1px solid transparent;
}

.format-tile.vector {
  background: rgba(47, 125, 78, 0.1);
  border-color: rgba(47, 125, 78, 0.18);
}

.format-tile.raster {
  background: rgba(var(--accent-rgb), 0.08);
  border-color: rgba(var(--accent-rgb), 0.16);
}

.format-tile.table {
  background: var(--accent-light);
  border-color: rgba(var(--accent-rgb), 0.2);
}

.format-tile.archive,
.format-tile.document,
.format-tile.code,
.format-tile.generic {
  background: rgba(15, 23, 42, 0.05);
  border-color: rgba(15, 23, 42, 0.06);
}

.format-code {
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 800;
  max-width: 78px;
  text-align: center;
  word-break: break-word;
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
  min-width: 56px;
  padding-top: 0.15rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
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

.download-btn {
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

.download-btn:hover {
  background: var(--accent-hover);
}

.data-footer {
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

@media (max-width: 980px) {
  .data-body {
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

  .download-btn {
    min-width: 180px;
  }
}

@media (max-width: 720px) {
  .data-topline,
  .data-footer,
  .footer-meta,
  .action-column,
  .meta-line {
    flex-direction: column;
    align-items: flex-start;
  }

  .data-body {
    grid-template-columns: 1fr;
  }

  .preview-image,
  .format-tile {
    width: 84px;
    height: 84px;
  }

  .action-column,
  .side-stat,
  .download-btn {
    width: 100%;
  }
}
</style>
