<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ $t('runModal.title', { name: model?.name }) }}</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div class="modal-body">
        <div v-if="loadingDetails" class="loading-details">
          <div class="spinner"></div>
          <p>{{ $t('runModal.loadingParams') }}</p>
        </div>

        <div v-else-if="error" class="error-message">
          {{ error }}
        </div>

        <div v-else>
          <p class="instruction">{{ modelDetails?.description || $t('runModal.configureParams') }}</p>
          
          <div v-for="(param, index) in params" :key="index" class="form-group">
            <label>
              {{ param.Name }} 
              <span v-if="!param.Optional" class="required">*</span>
              <span v-if="param.default_value" class="default-hint">
                ({{ $t('runModal.default') }}: {{ param.default_value }})
              </span>
            </label>
            <div class="param-desc">
              {{ param.Description }}
              <span v-if="getTypeHint(param)" class="type-hint">• {{ getTypeHint(param) }}</span>
            </div>
            
            <!-- File Input (ExistingFile) -->
            <div v-if="param.parameter_type?.ExistingFile" class="file-input-wrapper">
              <div class="file-upload-container">
                <input 
                  type="file" 
                  @change="(e) => handleFileUpload(e, index)"
                  class="file-input-real"
                >
                <div class="file-status">
                  <span v-if="uploading[index]" class="status-uploading">{{ $t('runModal.uploading') }}</span>
                  <span v-else-if="formValues[`val${index}`]" class="status-success">
                    ✓ {{ $t('runModal.uploaded') }} ({{ $t('runModal.fileId') }}: {{ formValues[`val${index}`].substring(0, 8) }}...)
                  </span>
                  <span v-else class="status-hint">
                    {{ param.Optional ? $t('runModal.optional') : $t('runModal.required') }}: {{ param.parameter_type.ExistingFile }}
                  </span>
                </div>
              </div>
            </div>

            <!-- New File Output (NewFile) -->
            <div v-else-if="param.parameter_type?.NewFile">
               <input 
                type="text" 
                v-model="formValues[`val${index}`]" 
                :placeholder="`${$t('runModal.outputFilename')} (.${param.parameter_type.NewFile})`" 
                class="text-input"
              >
            </div>

            <!-- Boolean Input -->
            <div v-else-if="param.parameter_type === 'Boolean'" class="checkbox-wrapper">
              <label class="switch">
                <input type="checkbox" v-model="formValues[`val${index}`]">
                <span class="slider round"></span>
              </label>
              <span class="bool-label">{{ formValues[`val${index}`] ? $t('common.true') : $t('common.false') }}</span>
            </div>

            <!-- Integer Input -->
            <div v-else-if="param.parameter_type === 'Integer'">
              <input 
                type="number" 
                v-model.number="formValues[`val${index}`]" 
                :placeholder="param.default_value ? `${$t('runModal.enterInteger')} (${$t('runModal.default')}: ${param.default_value})` : $t('runModal.enterInteger')" 
                step="1"
                class="text-input"
              >
            </div>

            <!-- Float Input -->
            <div v-else-if="param.parameter_type === 'Float'">
              <input 
                type="number" 
                v-model.number="formValues[`val${index}`]" 
                :placeholder="param.default_value ? `${$t('runModal.enterDecimal')} (${$t('runModal.default')}: ${param.default_value})` : $t('runModal.enterDecimal')" 
                step="any"
                class="text-input"
              >
            </div>

            <!-- OptionList (Select Dropdown) -->
            <div v-else-if="param.parameter_type?.OptionList">
              <select 
                v-model="formValues[`val${index}`]" 
                class="select-input"
              >
                <option value="" disabled>{{ $t('runModal.selectOption') }}</option>
                <option 
                  v-for="option in param.parameter_type.OptionList.options" 
                  :key="option" 
                  :value="option"
                >
                  {{ option }}
                </option>
              </select>
            </div>

            <!-- Default Text Input (for String or unknown types) -->
            <div v-else>
              <input 
                type="text" 
                v-model="formValues[`val${index}`]" 
                :placeholder="param.default_value ? `${$t('runModal.enterValue')} (${$t('runModal.default')}: ${param.default_value})` : $t('runModal.enterValue')" 
                class="text-input"
              >
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="cancel-btn" @click="$emit('close')">{{ $t('runModal.cancel') }}</button>
        <button class="execute-btn" @click="handleExecute" :disabled="loading || loadingDetails || error">
          <span v-if="loading" class="spinner-sm"></span>
          {{ loading ? $t('runModal.running') : $t('runModal.execute') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import axios from 'axios'

const props = defineProps({
  visible: Boolean,
  model: Object,
  loading: Boolean
})

const emit = defineEmits(['close', 'execute'])

const modelDetails = ref(null)
const params = ref([])
const formValues = ref({})
const loadingDetails = ref(false)
const error = ref(null)
const uploading = ref({})

const getTypeHint = (param) => {
  const type = param.parameter_type
  
  if (typeof type === 'string') {
    return type
  }
  
  if (typeof type === 'object') {
    if (type.ExistingFile) return `File: ${type.ExistingFile}`
    if (type.NewFile) return `Output: ${type.NewFile}`
    if (type.OptionList) return `Options: ${type.OptionList.options?.join(', ')}`
  }
  
  return ''
}

// Fetch model details when modal opens
watch(() => props.visible, async (newVal) => {
  if (newVal && props.model) {
    loadingDetails.value = true
    error.value = null
    modelDetails.value = null
    params.value = []
    formValues.value = {}
    uploading.value = {}

    try {
      const response = await axios.get(`/api/datamethods/${props.model.name}`)
      modelDetails.value = response.data
      params.value = response.data.params || []
      
      // Initialize form values
      params.value.forEach((param, index) => {
        if (param.default_value !== null && param.default_value !== undefined) {
           // Handle string boolean values
           if (param.default_value === 'true') {
             formValues.value[`val${index}`] = true
           } else if (param.default_value === 'false') {
             formValues.value[`val${index}`] = false
           } else {
             formValues.value[`val${index}`] = param.default_value
           }
        } else if (param.parameter_type === 'Boolean') {
           formValues.value[`val${index}`] = false
        } else {
           formValues.value[`val${index}`] = ''
        }
      })
    } catch (err) {
      console.error('Failed to fetch model details:', err)
      error.value = 'Failed to load model parameters.'
    } finally {
      loadingDetails.value = false
    }
  }
})

const handleFileUpload = async (event, index) => {
  const file = event.target.files[0]
  if (!file) return

  uploading.value[index] = true
  const formData = new FormData()
  formData.append('file', file)

  try {
    const response = await axios.post('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    if (response.data.status === 'success') {
      formValues.value[`val${index}`] = response.data.id
    } else {
      alert('Upload failed: ' + (response.data.error || 'Unknown error'))
      event.target.value = ''
    }
  } catch (err) {
    console.error('Upload error:', err)
    alert('Upload failed. Please try again.')
    event.target.value = ''
  } finally {
    uploading.value[index] = false
  }
}

const handleExecute = () => {
  for (let i = 0; i < params.value.length; i++) {
    const param = params.value[i]
    const key = `val${i}`
    const val = formValues.value[key]
    
    if (!param.Optional && (val === '' || val === null || val === undefined)) {
      alert(`Parameter "${param.Name}" is required.`)
      return
    }
  }
  emit('execute', formValues.value)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal-content {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  width: 100%;
  max-width: 650px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  animation: slideUp 0.3s ease;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--nav-bg);
  border-radius: 12px 12px 0 0;
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
}

.loading-details, .error-message {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.error-message {
  color: var(--danger-color);
}

.instruction {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 500;
}

.required {
  color: var(--danger-color);
  margin-left: 4px;
}

.default-hint {
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: normal;
  margin-left: 0.5rem;
}

.param-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.type-hint {
  color: var(--accent-color);
  font-weight: 500;
  margin-left: 0.5rem;
}

.file-input-wrapper {
  display: flex;
  gap: 10px;
}

.file-upload-container {
  width: 100%;
}

.file-input-real {
  width: 100%;
  padding: 0.5rem;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: border-color 0.2s;
}

.file-input-real:hover {
  border-color: var(--accent-color);
}

.file-status {
  font-size: 0.8rem;
}

.status-uploading {
  color: var(--accent-color);
}

.status-success {
  color: var(--success-color);
}

.status-hint {
  color: var(--text-secondary);
  font-style: italic;
}

.text-input, .select-input {
  width: 100%;
  padding: 0.75rem;
  background-color: white;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.text-input:focus, .select-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.select-input {
  cursor: pointer;
}

/* Toggle Switch for Boolean */
.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 26px;
}

.switch input { 
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #555;
  transition: .3s;
  border-radius: 26px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--accent-color);
}

input:checked + .slider:before {
  transform: translateX(24px);
}

.bool-label {
  color: var(--text-primary);
  font-weight: 500;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-light);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  background: var(--bg-color);
  border-radius: 0 0 12px 12px;
}

.cancel-btn {
  background: white;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.cancel-btn:hover {
  border-color: var(--text-secondary);
  background-color: var(--bg-color);
}

.execute-btn {
  background-color: var(--accent-color);
  color: white;
  border: none;
  padding: 0.6rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.execute-btn:hover {
  background-color: var(--accent-hover);
}

.execute-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

.spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
