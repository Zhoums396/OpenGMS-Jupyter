<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ $t('runModal.title', { name: model?.name }) }}</h3>
        <button class="close-btn" @click="handleClose">×</button>
      </div>
      
      <div class="modal-body">
        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>{{ $t('common.loading') }}</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="error-message">
          {{ error }}
        </div>

        <!-- Results State -->
        <div v-else-if="executionResult" class="results-container">
          <div class="success-header">
            <span class="success-icon">✓</span>
            <h4>Execution Completed</h4>
          </div>
          
          <div class="results-table-wrapper">
            <table class="results-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Event</th>
                  <th>File</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(output, index) in executionResult.outputs" :key="index">
                  <td>{{ output.statename }}</td>
                  <td>{{ output.event }}</td>
                  <td>{{ output.tag }}.{{ output.suffix }}</td>
                  <td>
                    <a :href="output.url" target="_blank" class="download-link">
                      Download
                    </a>
                  </td>
                </tr>
                <tr v-if="!executionResult.outputs || executionResult.outputs.length === 0">
                  <td colspan="4" class="no-data">No outputs generated</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="action-buttons">
            <button class="btn-secondary" @click="resetExecution">Run Again</button>
            <button class="btn-primary" @click="handleClose">Close</button>
          </div>
        </div>

        <!-- Input Form State -->
        <div v-else class="params-container">
          <div v-if="Object.keys(parsedInputs).length === 0" class="no-params">
            No input parameters detected for this model.
          </div>

          <div v-for="(state, stateName) in parsedInputs" :key="stateName" class="state-group">
            <h4 class="state-title">{{ stateName }}</h4>
            
            <div v-for="(event, eventName) in state" :key="eventName" class="form-group">
              <label>
                {{ eventName }}
                <span v-if="!event.optional" class="required">*</span>
                <span class="data-type-badge">{{ event.type }}</span>
              </label>
              
              <div class="param-desc">{{ event.description }}</div>

              <!-- Value Input -->
              <div v-if="event.type === 'Value'" class="value-input-wrapper">
                 <input 
                  type="text" 
                  v-model="formValues[stateName][eventName].value"
                  :placeholder="$t('runModal.enterValue')"
                  class="text-input"
                >
              </div>

              <!-- File Input -->
              <div v-else class="file-input-wrapper">
                <div class="file-upload-container">
                  <input 
                    type="file" 
                    @change="(e) => handleFileUpload(e, stateName, eventName)"
                    class="file-input-real"
                  >
                  <div class="file-status">
                    <span v-if="uploading[`${stateName}-${eventName}`]" class="status-uploading">
                      {{ $t('runModal.uploading') }}
                    </span>
                    <span v-else-if="formValues[stateName]?.[eventName]?.url" class="status-success">
                      ✓ {{ $t('runModal.uploaded') }}
                      <span class="filename-badge">{{ formValues[stateName][eventName].filename }}</span>
                    </span>
                    <span v-else class="status-hint">
                      {{ event.optional ? $t('runModal.optional') : $t('runModal.required') }}
                    </span>
                  </div>
                </div>
                <!-- Manual URL Input fallback -->
                <input 
                  v-if="!uploading[`${stateName}-${eventName}`] && !formValues[stateName]?.[eventName]?.url"
                  type="text" 
                  v-model="formValues[stateName][eventName].url"
                  :placeholder="$t('runModal.enterUrl')"
                  class="text-input sm-input"
                  style="margin-top: 0.5rem;"
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer" v-if="!executionResult">
        <button class="btn-secondary" @click="handleClose">{{ $t('common.cancel') }}</button>
        <button 
          class="btn-primary" 
          @click="handleExecute" 
          :disabled="loading || executing || !isValid"
        >
          <span v-if="executing" class="spinner-sm"></span>
          {{ executing ? executionStatus || $t('runModal.executing') : $t('runModal.execute') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import axios from 'axios'

const props = defineProps({
  visible: Boolean,
  model: Object
})

const emit = defineEmits(['close', 'execute'])

const loading = ref(false)
const executing = ref(false)
const executionStatus = ref('')
const error = ref(null)
const parsedInputs = ref({})
const formValues = ref({})
const uploading = ref({})
const modelInfo = ref(null)
const executionResult = ref(null)

// Watch for model changes to fetch details and parse MDL
watch(() => props.model, async (newModel) => {
  if (newModel && props.visible) {
    await initModel()
  }
}, { immediate: true })

watch(() => props.visible, async (isVisible) => {
  if (isVisible && props.model) {
    await initModel()
  }
})

const handleClose = () => {
  if (executing.value) return // Prevent closing while running
  emit('close')
  resetExecution()
}

const resetExecution = () => {
  executionResult.value = null
  error.value = null
  executing.value = false
  executionStatus.value = ''
}

const initModel = async () => {
  loading.value = true
  error.value = null
  parsedInputs.value = {}
  formValues.value = {}
  executionResult.value = null
  
  try {
    // Fetch full model info to get MDL/Behavior
    const res = await axios.get(`/api/ogms/models/${props.model.name}`)
    modelInfo.value = res.data
    parseModelInfo(res.data)
  } catch (err) {
    console.error(err)
    error.value = 'Failed to load model details'
  } finally {
    loading.value = false
  }
}

const parseModelInfo = (info) => {
  if (!info || !info.mdl) return

  const inputs = {}
  const values = {}

  // Helper to safely add input
  const addInput = (state, event, desc, optional = false, type = 'Data') => {
    if (!inputs[state]) inputs[state] = {}
    if (!values[state]) values[state] = {}
    
    inputs[state][event] = {
      description: desc,
      optional: optional,
      type: type
    }
    
    values[state][event] = {
      value: '',
      url: '',
      type: type === 'Value' ? 'value' : 'file'
    }
  }

  // 1. Handle Parsed JSON (from backend)
  if (info.mdl && typeof info.mdl === 'object') {
      // Case A: Backend returned { inputs: [...] } (My custom format)
      if (info.mdl.inputs && Array.isArray(info.mdl.inputs)) {
          info.mdl.inputs.forEach(input => {
              const stateName = input.statename;
              const eventName = input.event;
              const desc = input.text || eventName;
              const optional = input.optional === "True" || input.optional === true;
              const isValue = input.children && input.children.length > 0;
              
              addInput(stateName, eventName, desc, optional, isValue ? 'Value' : 'File');
          });
      }
      // Case B: Standard OGMS JSON { states: [...] }
      else if (info.mdl.states && Array.isArray(info.mdl.states)) {
          info.mdl.states.forEach(state => {
              if (state.event) {
                  state.event.forEach(event => {
                      if (event.eventType === 'response') {
                          const stateName = state.name;
                          const eventName = event.eventName;
                          const desc = event.eventDesc || eventName;
                          const optional = event.optional;
                          // Check for nodes/children to determine if value
                          const isValue = event.data && event.data.some(d => d.nodes);
                          
                          addInput(stateName, eventName, desc, optional, isValue ? 'Value' : 'File');
                      }
                  });
              }
          });
      }
  } 
  // 2. Handle Legacy XML String (Fallback if backend parsing failed)
  else if (typeof info.mdl === 'string') {
     const parser = new DOMParser()
     const xmlDoc = parser.parseFromString(info.mdl, "text/xml")
     
     const states = xmlDoc.getElementsByTagName("State")
     for (let state of states) {
       const stateName = state.getAttribute("name")
       const events = state.getElementsByTagName("Event")
       for (let event of events) {
         const type = event.getAttribute("type")
         if (type === "response") { // Input
           const eventName = event.getAttribute("name")
           const desc = event.getAttribute("description") || eventName
           const optional = event.getAttribute("optional") === "true"
           
           // Simple heuristic for value vs file in XML without full parsing
           // If it has ResponseParameter with datasetReference, it might be value
           // But hard to know for sure without deep parsing. Default to File.
           addInput(stateName, eventName, desc, optional, 'File')
         }
       }
     }
  }

  parsedInputs.value = inputs
  formValues.value = values
}

const handleFileUpload = async (event, state, eventName) => {
  const file = event.target.files[0]
  if (!file) return

  const key = `${state}-${eventName}`
  uploading.value[key] = true

  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await axios.post('/api/upload', formData)
    if (res.data.status === 'success') {
      formValues.value[state][eventName].url = res.data.id 
      formValues.value[state][eventName].filename = file.name
    }
  } catch (err) {
    console.error('Upload failed', err)
    alert('Upload failed')
  } finally {
    uploading.value[key] = false
  }
}

const isValid = computed(() => {
  for (const state in parsedInputs.value) {
    for (const event in parsedInputs.value[state]) {
      const def = parsedInputs.value[state][event]
      const val = formValues.value[state][event]
      if (!def.optional) {
        if (!val.url && !val.value) return false
      }
    }
  }
  return true
})

const handleExecute = async () => {
  executing.value = true
  executionStatus.value = 'Initializing...'
  error.value = null
  
  try {
    // Prepare payload
    const inputs = {}
    for (const state in formValues.value) {
      inputs[state] = {}
      for (const event in formValues.value[state]) {
        const val = formValues.value[state][event]
        if (val.url || val.value) {
          inputs[state][event] = {
            url: val.url,
            value: val.value,
            name: val.filename || 'param.xml'
          }
        }
      }
    }

    const payload = {
      modelId: modelInfo.value.id || modelInfo.value._id,
      modelName: props.model.name,
      inputs: inputs,
      username: 'test_user'
    }

    const res = await axios.post('/api/ogms/models/execute', payload)
    
    if (res.data.status === 'success') {
      // Start polling
      const taskData = res.data.data;
      // taskData should contain the task ID or initial status
      // If it's already finished (unlikely), show results
      // Otherwise poll
      
      // The backend execute returns invokeRes.data.data
      // OGMS invoke returns { tid: "..." } usually
      
      if (taskData.tid) {
        await pollTask(taskData.tid);
      } else {
        // Maybe it returned results directly?
        executionResult.value = taskData;
      }
    } else {
      error.value = res.data.message || 'Execution failed'
    }
  } catch (err) {
    console.error(err)
    error.value = err.response?.data?.error || 'Execution failed'
  } finally {
    executing.value = false
  }
}

const pollTask = async (tid) => {
  executionStatus.value = 'Running...'
  
  const pollInterval = 2000; // 2 seconds
  const maxAttempts = 600; // 20 minutes timeout
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const res = await axios.post('/api/ogms/models/refresh', { tid: tid });
      const status = res.data.data.status;
      
      if (status === 2) { // Finished
        executionResult.value = res.data.data;
        return;
      } else if (status === -1) { // Error
        throw new Error('Model execution failed on server.');
      }
      
      // Still running (status 1 or 0)
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    } catch (err) {
      console.error('Polling error', err);
      throw err;
    }
  }
  throw new Error('Execution timed out');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: var(--card-bg);
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
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

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-light);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  background: var(--bg-color);
  border-radius: 0 0 12px 12px;
}

.state-group {
  margin-bottom: 1.5rem;
  border: 1px solid var(--border-color);
  padding: 1rem;
  border-radius: 8px;
  background: var(--bg-color);
}

.state-title {
  margin-top: 0;
  color: var(--success-color);
  border-bottom: 1px solid var(--border-light);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
  font-size: 1rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--text-primary);
  font-weight: 500;
}

.param-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.file-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-upload-container {
  position: relative;
  border: 2px dashed var(--border-color);
  padding: 1rem;
  border-radius: 6px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.3s, background 0.3s;
  background: white;
}

.file-upload-container:hover {
  border-color: var(--accent-color);
  background: var(--accent-light);
}

.file-input-real {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.text-input {
  background: white;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.75rem;
  border-radius: 6px;
  width: 100%;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.text-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.btn-primary, .btn-secondary {
  padding: 0.6rem 1.25rem;
  border-radius: 6px;
  cursor: pointer;
  border: none;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--accent-color);
  color: white;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-secondary {
  background: white;
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  border-color: var(--text-secondary);
  background: var(--bg-color);
}

.btn-primary:disabled {
  background: #a0cfff;
  cursor: not-allowed;
  opacity: 0.7;
}

.required {
  color: var(--danger-color);
  margin-left: 4px;
}

.data-type-badge {
  background: var(--bg-color);
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
}

.filename-badge {
  display: block;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.status-success {
  color: var(--success-color);
}

.status-uploading {
  color: var(--accent-color);
}

.status-hint {
  color: var(--text-muted);
}

.loading-state, .error-message {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.error-message {
  color: var(--danger-color);
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

/* Results Table */
.results-container {
  padding: 1rem;
}

.success-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  color: var(--success-color);
}

.success-icon {
  font-size: 1.5rem;
  background: rgba(103, 194, 58, 0.1);
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.results-table-wrapper {
  overflow-x: auto;
  margin-bottom: 1.5rem;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.results-table th, .results-table td {
  padding: 0.875rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
}

.results-table th {
  color: var(--text-secondary);
  font-weight: 600;
  background: var(--bg-color);
  font-size: 0.9rem;
}

.results-table td {
  font-size: 0.9rem;
}

.no-data {
  text-align: center;
  color: var(--text-muted);
}

.download-link {
  color: var(--accent-color);
  text-decoration: none;
  border: 1px solid var(--accent-color);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.download-link:hover {
  background: var(--accent-color);
  color: white;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.spinner-sm {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
