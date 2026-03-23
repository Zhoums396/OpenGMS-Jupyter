<template>
  <div class="model-view">
    <div class="view-header">
      <h1>{{ $t('ogmsModelView.title') }}</h1>
      <p class="subtitle">{{ $t('ogmsModelView.subtitle') }}</p>
      
      <div class="search-container">
        <input 
          v-model="searchQuery" 
          @keyup.enter="handleSearch"
          type="text" 
          :placeholder="$t('ogmsModelView.searchPlaceholder')"
          class="search-input"
        >
        <button @click="handleSearch" class="search-btn">
          {{ $t('ogmsModelView.search') }}
        </button>
      </div>
    </div>

    <div v-if="loading && !models.length" class="loading-state">
      <div class="spinner"></div>
      <p>{{ $t('ogmsModelView.loading') }}</p>
    </div>

    <div v-else class="content-wrapper">
      <div class="model-grid">
        <ModelCard 
          v-for="model in models" 
          :key="model.id" 
          :model="model" 
          @run="openRunModal"
        />
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <button 
          class="page-btn" 
          :disabled="currentPage === 1" 
          @click="changePage(currentPage - 1)"
        >
          &lt; {{ $t('dataMethodView.previous') }}
        </button>
        
        <span class="page-info">{{ $t('dataMethodView.pageOf', { current: currentPage, total: totalPages }) }}</span>
        
        <button 
          class="page-btn" 
          :disabled="currentPage === totalPages" 
          @click="changePage(currentPage + 1)"
        >
          {{ $t('dataMethodView.next') }} &gt;
        </button>
      </div>
    </div>

    <!-- Model Execution Modals -->
    <ModelRunModal 
      :visible="showRunModal" 
      :model="selectedModel" 
      @close="closeRunModal"
      @execute="handleExecutionStart"
    />

    <ResultModal
      :visible="showResultModal"
      :result="executionResult"
      :title="`${selectedModel?.name || 'Model'} - Execution Result`"
      @close="closeResultModal"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import ModelCard from '../components/ModelCard.vue'
import ModelRunModal from '../components/ModelRunModal.vue'
import ResultModal from '../components/ResultModal.vue'

const searchQuery = ref('')
const models = ref([])
const loading = ref(false)
const currentPage = ref(1)
const total = ref(0)
const limit = 12

const showRunModal = ref(false)
const selectedModel = ref(null)
const executing = ref(false)
const showResultModal = ref(false)
const executionResult = ref(null)
const taskInfo = ref(null)

const totalPages = computed(() => Math.ceil(total.value / limit))

const fetchModels = async (page = 1) => {
  loading.value = true
  try {
    const response = await axios.get(`/api/ogms/models?page=${page}&limit=${limit}&q=${searchQuery.value}`)
    models.value = response.data.data
    total.value = response.data.total
    currentPage.value = response.data.page
  } catch (error) {
    console.error('Failed to fetch models:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchModels(1)
}

const changePage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    fetchModels(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const openRunModal = (model) => {
  selectedModel.value = model
  showRunModal.value = true
}

const closeRunModal = () => {
  showRunModal.value = false
  selectedModel.value = null
}

const handleExecutionStart = (result) => {
  console.log('Execution started:', result)
  taskInfo.value = result.data 
  pollTaskStatus(result.data.tid)
}

const pollTaskStatus = async (tid) => {
  executing.value = true
  const pollInterval = setInterval(async () => {
    try {
      const res = await axios.post('/api/ogms/models/refresh', { tid: tid })
      const status = res.data.data.status
      
      if (status === 2) { // Success
        clearInterval(pollInterval)
        executing.value = false
        executionResult.value = res.data.data
        showResultModal.value = true
      } else if (status === -1) { // Failed
        clearInterval(pollInterval)
        executing.value = false
        alert('Task failed')
      }
    } catch (err) {
      console.error('Polling error', err)
      clearInterval(pollInterval)
      executing.value = false
    }
  }, 2000)
}

const closeResultModal = () => {
  showResultModal.value = false
  executionResult.value = null
}

onMounted(() => {
  fetchModels()
})
</script>

<style scoped>
.model-view {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  animation: fadeIn 0.5s ease;
}

.view-header {
  text-align: center;
  margin-bottom: 2.5rem;
  padding: 2rem 2rem 1.5rem;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

.view-header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
  font-weight: 700;
  letter-spacing: 0.01em;
}

.subtitle {
  color: #606266;
  font-size: 1rem;
  margin-bottom: 1.5rem;
}

.search-container {
  display: flex;
  gap: 0.75rem;
  max-width: 600px;
  margin: 0 auto;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.95rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.search-btn {
  padding: 0 1.5rem;
  background: var(--accent-color);
  border: 1px solid transparent;
  border-radius: 6px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-btn:hover {
  background: var(--accent-hover);
}

.model-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.loading-state {
  text-align: center;
  padding: 4rem;
  color: var(--text-secondary);
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
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

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
  padding: 1rem;
  background: var(--card-bg);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
}

.page-btn {
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--bg-color);
}

.page-info {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
