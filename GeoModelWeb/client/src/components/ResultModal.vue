<template>
  <div v-if="visible" class="result-modal-overlay" @click.self="$emit('close')">
    <div class="result-modal-content">
      <div class="modal-header">
        <h3>{{ title }}</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div class="modal-body">
        <div v-if="result.status === 'success'" class="success-section">
          <div class="status-icon">✓</div>
          <p class="status-message">{{ result.message }}</p>
          
          <div v-if="result.output" class="output-section">
            <h4>{{ $t('resultModal.outputData') }}</h4>
            <div class="output-list">
              <div v-for="(item, index) in formatOutput(result.output)" :key="index" class="output-item">
                <span class="output-label">{{ item.label }}:</span>
                <div v-if="item.isMultiple" class="output-links">
                  <a v-for="(url, idx) in item.urls" :key="idx" :href="url" target="_blank" class="output-link">
                    {{ $t('resultModal.downloadFile') }} {{ idx + 1 }}
                    <span class="download-icon">⬇</span>
                  </a>
                </div>
                <a v-else-if="item.isUrl" :href="item.value" target="_blank" class="output-link">
                  {{ item.originalValue || item.value }}
                  <span class="download-icon">⬇</span>
                </a>
                <span v-else class="output-value">{{ item.value }}</span>
              </div>
            </div>
          </div>
          
          <div v-if="result.info" class="info-section">
            <h4>{{ $t('resultModal.executionInfo') }}</h4>
            <pre class="info-content">{{ result.info }}</pre>
          </div>
        </div>
        
        <div v-else class="error-section">
          <div class="status-icon error">✗</div>
          <p class="status-message error">{{ result.message }}</p>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="close-footer-btn" @click="$emit('close')">{{ $t('resultModal.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  visible: Boolean,
  result: Object,
  title: {
    type: String,
    default: 'Execution Result'
  }
})

const emit = defineEmits(['close'])

const DATA_SERVER_URL = 'http://221.224.35.86:38083/data'

const isUUID = (str) => {
  if (typeof str !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

const formatOutput = (output) => {
  if (!output) return []
  
  if (typeof output === 'string') {
    const isUrl = output.startsWith('http')
    const isFileId = isUUID(output)
    return [{
      label: t('resultModal.result'),
      value: isFileId ? `${DATA_SERVER_URL}/${output}` : output,
      isUrl: isUrl || isFileId,
      originalValue: output
    }]
  }
  
  if (Array.isArray(output)) {
    return output.map((item, idx) => {
      if (typeof item === 'string') {
        const isUrl = item.startsWith('http')
        const isFileId = isUUID(item)
        return {
          label: `${t('resultModal.output')} ${idx + 1}`,
          value: isFileId ? `${DATA_SERVER_URL}/${item}` : item,
          isUrl: isUrl || isFileId,
          originalValue: item
        }
      }
      return {
        label: `${t('resultModal.output')} ${idx + 1}`,
        value: typeof item === 'object' ? JSON.stringify(item, null, 2) : item,
        isUrl: false
      }
    })
  }
  
  if (typeof output === 'object') {
    return Object.entries(output).map(([key, value]) => {
      if (typeof value === 'string') {
        const isUrl = value.startsWith('http')
        const isFileId = isUUID(value)
        return {
          label: key,
          value: isFileId ? `${DATA_SERVER_URL}/${value}` : value,
          isUrl: isUrl || isFileId,
          originalValue: value
        }
      }
      // Handle arrays of UUIDs
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string' && isUUID(value[0])) {
        return {
          label: key,
          value: value.map(id => `${DATA_SERVER_URL}/${id}`).join('\n'),
          isUrl: true,
          isMultiple: true,
          urls: value.map(id => `${DATA_SERVER_URL}/${id}`)
        }
      }
      return {
        label: key,
        value: typeof value === 'object' ? JSON.stringify(value, null, 2) : value,
        isUrl: typeof value === 'string' && value.startsWith('http')
      }
    })
  }
  
  return [{ label: 'Output', value: JSON.stringify(output, null, 2), isUrl: false }]
}
</script>

<style scoped>
.result-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(7, 16, 31, 0.58);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.result-modal-content {
  background: rgba(255, 255, 255, 0.99);
  border: 1px solid rgba(0, 30, 64, 0.08);
  border-radius: 20px;
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 32px 80px rgba(0, 30, 64, 0.22);
  overflow: hidden;
  animation: slideUp 0.3s ease;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, var(--primary-strong), var(--primary-soft));
  border-radius: 20px 20px 0 0;
}

.modal-header h3 {
  margin: 0;
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s;
}

.close-btn:hover {
  color: white;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  background: var(--surface-card);
}

.success-section, .error-section {
  text-align: center;
}

.status-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 1rem;
  border-radius: 50%;
  background-color: var(--success-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
}

.status-icon.error {
  background-color: var(--danger-color);
}

.status-message {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
}

.status-message.error {
  color: var(--danger-color);
}

.output-section, .info-section {
  margin-top: 1.5rem;
  text-align: left;
}

.output-section h4, .info-section h4 {
  color: var(--text-primary);
  margin-bottom: 0.75rem;
  font-size: 1rem;
  font-weight: 600;
}

.output-list {
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
}

.output-item {
  margin-bottom: 0.75rem;
  display: flex;
  gap: 0.5rem;
}

.output-item:last-child {
  margin-bottom: 0;
}

.output-label {
  color: var(--text-secondary);
  font-weight: 500;
  min-width: 100px;
}

.output-value {
  color: var(--text-primary);
  word-break: break-all;
}

.output-link {
  color: var(--accent-color);
  text-decoration: none;
  word-break: break-all;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.output-link:hover {
  text-decoration: underline;
}

.output-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.output-links .output-link {
  padding: 0.5rem;
  background-color: white;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.output-links .output-link:hover {
  border-color: var(--accent-color);
  background-color: var(--accent-light);
}

.download-icon {
  font-size: 0.9rem;
}

.info-content {
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-light);
  display: flex;
  justify-content: flex-end;
  background: #f5f7fb;
  border-radius: 0 0 20px 20px;
}

.close-footer-btn {
  background-color: var(--accent-color);
  color: white;
  border: none;
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.close-footer-btn:hover {
  background-color: var(--accent-hover);
  transform: translateY(-1px);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>
