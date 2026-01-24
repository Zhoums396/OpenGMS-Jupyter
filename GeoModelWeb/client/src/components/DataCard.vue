<template>
  <div class="data-card" @click="handleClick">
    <div class="card-header">
      <div class="data-icon">{{ getDataIcon(data.type) }}</div>
      <div class="header-info">
        <h3 :title="data.name">{{ data.name }}</h3>
        <span class="geo-type" :class="data.geoType === '矢量' ? 'vector' : 'raster'">
          {{ getGeoTypeLabel(data.geoType) }}
        </span>
      </div>
    </div>
    
    <div class="card-body">
      <p class="description" :title="data.description">{{ truncate(data.description, 80) }}</p>
      
      <div class="meta-info">
        <span class="meta-item">
          <span class="meta-label">{{ $t('dataCard.type') }}</span>
          <span class="meta-value type-tag">{{ data.type?.toUpperCase() || $t('dataCard.unknown') }}</span>
        </span>
        <span class="meta-item">
          <span class="meta-label">{{ $t('dataCard.size') }}</span>
          <span class="meta-value">{{ formatSize(data.fileSize) }}</span>
        </span>
      </div>
      
      <div class="tags" v-if="data.problemTags">
        <span class="tag">{{ data.problemTags }}</span>
      </div>
    </div>
    
    <div class="card-footer">
      <div class="footer-left">
        <span class="author" :title="data.userEmail">
          {{ data.userEmail || 'Unknown' }}
        </span>
        <span class="time">{{ formatTime(data.createTime) }}</span>
      </div>
      <div class="footer-right">
        <span class="view-count" v-if="data.pageviews">
          {{ data.pageviews }}
        </span>
        <button class="action-btn" @click.stop="handleDownload">
          {{ $t('dataCard.download') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['view', 'download'])

const truncate = (text, length) => {
  if (!text) return t('dataCard.noDescription')
  return text.length > length ? text.substring(0, length) + '...' : text
}

const getGeoTypeLabel = (geoType) => {
  if (!geoType) return t('dataCard.unknownType')
  if (geoType === '矢量') return t('dataCard.vector')
  if (geoType === '栅格') return t('dataCard.raster')
  return geoType
}

const formatSize = (bytes) => {
  if (!bytes) return t('dataCard.unknown')
  const size = parseInt(bytes)
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + ' MB'
  return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  // 只显示日期部分
  return timeStr.split(' ')[0]
}

const getDataIcon = (type) => {
  const iconMap = {
    'shp': '',
    'tiff': '',
    'tif': '',
    'csv': '',
    'json': '',
    'geojson': '',
    'nc': '',
    'netcdf': '',
    'xlsx': '',
    'xls': '',
    'zip': '',
    'pdf': '',
    'txt': ''
  }
  return iconMap[type?.toLowerCase()] || ''
}

const handleClick = () => {
  emit('view', props.data)
}

const handleDownload = () => {
  emit('download', props.data)
}
</script>

<style scoped>
.data-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 240px;
  box-shadow: var(--shadow-sm);
}

.data-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--accent-color);
}

.card-header {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.data-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.header-info h3 {
  margin: 0 0 6px 0;
  font-size: 1.05rem;
  color: var(--text-primary);
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.geo-type {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 500;
}

.geo-type.vector {
  background: rgba(103, 194, 58, 0.1);
  color: #67c23a;
  border: 1px solid rgba(103, 194, 58, 0.3);
}

.geo-type.raster {
  background: rgba(230, 162, 60, 0.1);
  color: #e6a23c;
  border: 1px solid rgba(230, 162, 60, 0.3);
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.description {
  color: var(--text-secondary);
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta-info {
  display: flex;
  gap: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.meta-value {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.type-tag {
  background: var(--accent-light);
  color: var(--accent-color);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
}

.tag {
  background: var(--accent-light);
  color: var(--accent-color);
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid var(--border-light);
  gap: 8px;
}

.footer-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.author {
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.view-count {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.action-btn {
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.action-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}
</style>
