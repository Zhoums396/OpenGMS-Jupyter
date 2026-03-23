<template>
  <div class="datamethod-view">
    <div class="view-header">
      <h1>{{ $t('dataMethodView.title') }}</h1>
      <p class="subtitle">{{ $t('dataMethodView.subtitle') }}</p>
      
      <div class="search-container">
        <input 
          v-model="searchQuery" 
          @keyup.enter="handleSearch"
          type="text" 
          :placeholder="$t('dataMethodView.searchPlaceholder')"
          class="search-input"
          :disabled="loading"
        >
        <button @click="handleSearch" class="search-btn" :disabled="loading">
          {{ $t('dataMethodView.search') }}
        </button>
      </div>
    </div>

    <div class="content-wrapper">
      <!-- 搜索提示 -->
      <div v-if="searchNote && !loading" class="search-note">
        {{ searchNote }}
      </div>
      
      <!-- 搜索结果统计 -->
      <div v-if="searchQuery && total > 0 && !loading" class="search-stats">
        找到 {{ total }} 个匹配的数据方法
      </div>
      
      <div v-if="loading" class="model-grid skeleton-grid" aria-live="polite" aria-busy="true">
        <div
          v-for="item in skeletonItems"
          :key="item"
          class="skeleton-card"
        >
          <div class="skeleton skeleton-visual"></div>
          <div class="skeleton-content">
            <div class="skeleton-header">
              <div class="skeleton skeleton-title"></div>
              <div class="skeleton skeleton-badge"></div>
            </div>
            <div class="skeleton-body">
              <div class="skeleton skeleton-line long"></div>
              <div class="skeleton skeleton-line"></div>
              <div class="skeleton-tag-row">
                <div class="skeleton skeleton-tag"></div>
                <div class="skeleton skeleton-tag short"></div>
              </div>
            </div>
          </div>
          <div class="skeleton-side">
            <div class="skeleton skeleton-metric"></div>
            <div class="skeleton skeleton-metric"></div>
            <div class="skeleton skeleton-metric"></div>
            <div class="skeleton skeleton-button"></div>
          </div>
        </div>
      </div>

      <div v-else class="model-grid">
        <DataMethodCard
          v-for="method in dataMethods" 
          :key="method.id" 
          :method="method"
          @run="openRunModal"
        />
      </div>

      <div class="pagination">
        <button 
          class="page-btn" 
          :disabled="loading || currentPage === 1" 
          @click="changePage(currentPage - 1)"
        >
          &lt; {{ $t('dataMethodView.previous') }}
        </button>
        
        <span class="page-info">{{ $t('dataMethodView.pageOf', { current: currentPage, total: totalPages }) }}</span>
        
        <button 
          class="page-btn" 
          :disabled="loading || currentPage === totalPages" 
          @click="changePage(currentPage + 1)"
        >
          {{ $t('dataMethodView.next') }} &gt;
        </button>
      </div>
    </div>

    <RunModal 
      :visible="showModal" 
      :model="selectedMethod" 
      :loading="executing"
      @close="closeModal"
      @execute="executeMethod"
    />
    
    <ResultModal
      :visible="showResultModal"
      :result="executionResult"
      :title="`${selectedMethod?.name || 'Data Method'} - Execution Result`"
      @close="closeResultModal"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import DataMethodCard from '../components/DataMethodCard.vue'
import RunModal from '../components/RunModal.vue'
import ResultModal from '../components/ResultModal.vue'

const searchQuery = ref('')
const dataMethods = ref([])
const loading = ref(false)
const currentPage = ref(1)
const total = ref(0)
const searchNote = ref('')
const limit = 12

const showModal = ref(false)
const selectedMethod = ref(null)
const executing = ref(false)
const showResultModal = ref(false)
const executionResult = ref(null)

const totalPages = computed(() => Math.ceil(total.value / limit))
const skeletonItems = computed(() => Array.from({ length: limit }, (_, index) => index))

const fetchDataMethods = async (page = 1) => {
  loading.value = true
  searchNote.value = ''
  try {
    const response = await axios.get(`/api/datamethods?page=${page}&limit=${limit}&q=${searchQuery.value}`)
    dataMethods.value = response.data.data
    total.value = response.data.total
    currentPage.value = response.data.page
    searchNote.value = response.data.searchNote || ''
  } catch (error) {
    console.error('Failed to fetch data methods:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchDataMethods()
}

const changePage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    fetchDataMethods(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const openRunModal = (method) => {
  selectedMethod.value = method
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  selectedMethod.value = null
}

const closeResultModal = () => {
  showResultModal.value = false
  executionResult.value = null
}

const executeMethod = async (payload) => {
  executing.value = true
  try {
    const response = await axios.post('/api/datamethods/run', {
      modelId: selectedMethod.value.id,
      inputs: payload
    })
    
    executionResult.value = response.data
    closeModal()
    showResultModal.value = true
  } catch (error) {
    console.error('Execution failed:', error)
    executionResult.value = {
      status: 'error',
      message: error.response?.data?.message || 'Execution failed. Please try again.'
    }
    showResultModal.value = true
  } finally {
    executing.value = false
  }
}

onMounted(() => {
  fetchDataMethods()
})
</script>

<style scoped>
.datamethod-view {
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

.search-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.search-btn:disabled,
.search-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.model-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.skeleton-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  padding: 1.25rem 1.35rem;
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 230px;
  gap: 1.25rem;
  align-items: start;
  box-shadow: var(--shadow-sm);
}

.skeleton-content {
  min-width: 0;
}

.skeleton-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.skeleton-body {
  padding-top: 1rem;
}

.skeleton-side {
  display: grid;
  gap: 0.7rem;
}

.skeleton {
  position: relative;
  overflow: hidden;
  background: #e8edf5;
  border-radius: 999px;
}

.skeleton::after {
  content: none;
}

.skeleton {
  animation: skeletonPulse 1.1s ease-in-out infinite alternate;
}

.skeleton-visual {
  width: 92px;
  height: 92px;
  border-radius: 22px;
}

.skeleton-title {
  width: 52%;
  height: 30px;
  border-radius: 10px;
}

.skeleton-badge {
  width: 92px;
  height: 22px;
}

.skeleton-line {
  height: 14px;
  margin-bottom: 0.75rem;
  border-radius: 8px;
}

.skeleton-line.long {
  width: 92%;
}

.skeleton-line:not(.long) {
  width: 78%;
}

.skeleton-tag-row {
  display: flex;
  gap: 0.6rem;
  margin-top: 1rem;
}

.skeleton-tag {
  width: 110px;
  height: 28px;
  border-radius: 8px;
}

.skeleton-tag.short {
  width: 84px;
}

.skeleton-metric {
  width: 100%;
  height: 52px;
  border-radius: 14px;
}

.skeleton-button {
  width: 100%;
  height: 48px;
  border-radius: 12px;
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
  background-color: white;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.5rem 1rem;
  border-radius: 6px;
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

.search-note {
  background: rgba(230, 162, 60, 0.1);
  border: 1px solid rgba(230, 162, 60, 0.3);
  color: var(--warning-color);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  text-align: center;
  font-size: 0.9rem;
}

.search-stats {
  color: var(--text-secondary);
  margin-bottom: 1rem;
  text-align: center;
  font-size: 0.95rem;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes skeletonPulse {
  from { opacity: 0.62; }
  to { opacity: 1; }
}

@media (max-width: 1080px) {
  .skeleton-card {
    grid-template-columns: 96px minmax(0, 1fr);
  }

  .skeleton-side {
    grid-column: 1 / -1;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .skeleton-card {
    grid-template-columns: 1fr;
  }

  .skeleton-side {
    grid-template-columns: 1fr;
  }
}
</style>
