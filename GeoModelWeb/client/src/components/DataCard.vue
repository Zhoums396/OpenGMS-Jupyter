<template>
  <article class="data-list-item">
    <div class="data-card-shell">
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
        <div class="title-row">
          <h3 :title="data.name">{{ data.name }}</h3>
          <div class="status-row">
            <span v-if="headerBadge" class="chip geo-chip" :class="headerBadge.className">
              {{ headerBadge.label }}
            </span>
            <span v-if="primaryFormat" class="chip neutral-chip">{{ primaryFormat }}</span>
            <span class="chip access-chip" :class="{ restricted: !data.publicBoolean }">
              {{ accessLabel }}
            </span>
          </div>
        </div>

        <p class="description" :title="resolvedDescription">
          {{ truncate(resolvedDescription, 220) }}
        </p>

        <div class="metric-row">
          <span class="metric-item">{{ resolvedSize }}</span>
          <span class="metric-item">{{ fileCount }} {{ $t('dataCard.files') }}</span>
          <span class="metric-item">{{ formatCompactNumber(normalizedViews) }} {{ $t('dataCard.views') }}</span>
          <span class="metric-item">{{ formatTime(data.createTime) }}</span>
          <span v-if="compactAuthor" class="metric-item">{{ compactAuthor }}</span>
        </div>

        <div v-if="visibleTopicTags.length" class="tag-row">
          <span
            v-for="tag in visibleTopicTags"
            :key="tag"
            class="tag-chip"
          >
            {{ tag }}
          </span>
        </div>
      </div>

      <aside class="action-column">
        <button class="primary-btn" @click.stop="handleDownload">
          {{ $t('dataCard.download') }}
        </button>
        <button class="ghost-btn" @click.stop="handleClick">
          Details
        </button>
      </aside>
    </div>
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
  if (!value) return ''
  if (value.length <= 28) return value
  return `${value.slice(0, 14)}...${value.slice(-8)}`
})

const accessLabel = computed(() => (props.data.publicBoolean ? t('dataCard.public') : t('dataCard.restricted')))
const visibleTopicTags = computed(() => [...themeTags.value, ...domainTags.value].slice(0, 3))

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
  background: rgba(255, 255, 255, 0.98);
  border: none;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(var(--primary-rgb), 0.06);
  transition: background-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
}

.data-list-item:hover {
  background: rgba(213, 227, 255, 0.5);
  box-shadow: 0 14px 30px rgba(var(--primary-rgb), 0.08);
  transform: translateY(-2px);
}

.data-card-shell {
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

.geo-chip.vector {
  background: rgba(47, 125, 78, 0.12);
  color: var(--success-color);
}

.geo-chip.raster {
  background: rgba(var(--accent-rgb), 0.08);
  color: var(--accent-color);
}

.geo-chip.table {
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

.neutral-chip {
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-secondary);
}

.access-chip {
  background: rgba(47, 125, 78, 0.12);
  color: var(--success-color);
}

.access-chip.restricted {
  background: rgba(0, 30, 64, 0.08);
  color: var(--primary-strong);
}

.preview-image,
.format-tile {
  width: 80px;
  height: 80px;
  border-radius: 12px;
}

.preview-image {
  object-fit: cover;
  background: #f7f8fa;
}

.format-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--primary-rgb), 0.06);
}

.format-tile.vector {
  background: rgba(47, 125, 78, 0.1);
}

.format-tile.raster {
  background: rgba(var(--accent-rgb), 0.08);
}

.format-tile.table {
  background: var(--accent-light);
}

.format-tile.archive,
.format-tile.document,
.format-tile.code,
.format-tile.generic {
  background: rgba(15, 23, 42, 0.05);
}

.format-code {
  color: var(--primary-strong);
  font-size: 0.95rem;
  font-weight: 800;
  max-width: 72px;
  text-align: center;
  word-break: break-word;
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
  .data-card-shell {
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
  .data-card-shell {
    grid-template-columns: 1fr;
  }

  .preview-image,
  .format-tile {
    width: 84px;
    height: 84px;
  }

  .action-column,
  .primary-btn,
  .ghost-btn {
    width: 100%;
  }
}
</style>
