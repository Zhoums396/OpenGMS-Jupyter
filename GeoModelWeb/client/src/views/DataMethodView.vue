<template>
  <div class="catalog-page">
    <div class="catalog-shell">
      <aside class="catalog-sidebar">
        <h2 class="catalog-sidebar-title font-headline">Repository Filters</h2>

        <div class="catalog-filter-block">
          <button
            :class="['catalog-filter-item', { active: activeFacet === 'all' }]"
            @click="selectFacet('all')"
          >
            <span v-if="activeFacet === 'all'" class="catalog-filter-indicator"></span>
            <span>All Methods</span>
            <strong>{{ facetTotal || total || 0 }}</strong>
          </button>

          <button
            v-for="option in methodFacets"
            :key="option.label"
            :class="['catalog-filter-item', { active: activeFacet === option.label }]"
            @click="selectFacet(option.label)"
          >
            <span v-if="activeFacet === option.label" class="catalog-filter-indicator"></span>
            <span>{{ option.label }}</span>
            <strong>{{ option.count }}</strong>
          </button>
        </div>

        <div class="catalog-status-block">
          <p class="catalog-label">Execution</p>
          <label class="catalog-check">
            <input v-model="preferInteractive" type="checkbox">
            <span>Interactive Ready</span>
          </label>
          <label class="catalog-check">
            <input v-model="preferPython" type="checkbox">
            <span>Python Based</span>
          </label>
        </div>

        <div class="catalog-callout">
          <span class="catalog-callout-icon">⚗</span>
          <h3 class="font-headline">Need a workflow-specific method?</h3>
          <p>Package reusable preprocessing logic and make it executable inside OpenGeoLab-Jupyter.</p>
          <button type="button">Publish Method</button>
        </div>
      </aside>

      <section class="catalog-main">
        <header class="catalog-header">
          <div class="catalog-header-copy">
            <h1 class="font-headline">{{ $t('dataMethodView.title') }}</h1>
            <p>{{ $t('dataMethodView.subtitle') }}</p>
          </div>

          <div class="catalog-search">
            <span class="catalog-search-icon">⌕</span>
            <input
              v-model="searchQuery"
              @keyup.enter="handleSearch"
              type="text"
              :placeholder="$t('dataMethodView.searchPlaceholder')"
              :disabled="loading"
            >
          </div>
        </header>

        <div v-if="searchNote && !loading" class="catalog-note">
          {{ searchNote }}
        </div>

        <div v-if="loading" class="catalog-loading">
          <div class="spinner"></div>
          <p>Loading data methods...</p>
        </div>

        <div v-else class="catalog-list">
          <DataMethodCard
            v-for="method in dataMethods"
            :key="method.id"
            :method="method"
            @run="openRunModal"
          />

          <div v-if="!dataMethods.length" class="catalog-empty">
            <p>No methods match the current filters.</p>
          </div>
        </div>

        <div class="catalog-pagination" v-if="totalPages > 1">
          <button
            class="catalog-page-btn"
            :disabled="loading || currentPage === 1"
            @click="changePage(currentPage - 1)"
          >
            ‹
          </button>

          <span class="catalog-page-current">{{ currentPage }}</span>
          <span class="catalog-page-total">/ {{ totalPages }}</span>

          <button
            class="catalog-page-btn"
            :disabled="loading || currentPage === totalPages"
            @click="changePage(currentPage + 1)"
          >
            ›
          </button>
        </div>
      </section>
    </div>

    <footer class="catalog-footer">
      <div class="catalog-footer-shell">
        <p class="catalog-footer-brand font-headline">OpenGeoLab</p>
        <div class="catalog-footer-links">
          <a href="#">Institutional Repository</a>
          <a href="#">Method Registry</a>
          <a href="#">API Documentation</a>
          <a href="#">Privacy Policy</a>
        </div>
      </div>
    </footer>

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
import { ref, onMounted, computed, watch } from 'vue'
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
const facetTotal = ref(0)
const methodFacets = ref([])

const activeFacet = ref('all')
const preferInteractive = ref(false)
const preferPython = ref(false)

const showModal = ref(false)
const selectedMethod = ref(null)
const executing = ref(false)
const showResultModal = ref(false)
const executionResult = ref(null)

const totalPages = computed(() => Math.ceil(total.value / limit))

const fetchDataMethods = async (page = 1) => {
  loading.value = true
  searchNote.value = ''
  try {
    const response = await axios.get('/api/datamethods', {
      params: {
        page,
        limit,
        q: searchQuery.value,
        facet: activeFacet.value,
        interactive: preferInteractive.value,
        python: preferPython.value
      }
    })
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

const fetchMethodFacets = async () => {
  try {
    const response = await axios.get('/api/datamethods/facets', {
      params: {
        q: searchQuery.value,
        interactive: preferInteractive.value,
        python: preferPython.value
      }
    })
    facetTotal.value = response.data.total || 0
    methodFacets.value = Array.isArray(response.data.facets) ? response.data.facets : []
  } catch (error) {
    console.error('Failed to fetch data method facets:', error)
    facetTotal.value = total.value
    methodFacets.value = []
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchMethodFacets()
  fetchDataMethods()
}

const selectFacet = (facet) => {
  activeFacet.value = facet
  currentPage.value = 1
  fetchDataMethods(1)
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
  fetchMethodFacets()
  fetchDataMethods()
})

watch([preferInteractive, preferPython], () => {
  currentPage.value = 1
  fetchMethodFacets()
  fetchDataMethods(1)
})
</script>

<style scoped>
.catalog-page {
  padding: 2.5rem 2rem 4rem;
  background: #f8f9fa;
}

.catalog-shell,
.catalog-footer-shell {
  max-width: 1560px;
  margin: 0 auto;
}

.catalog-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 3rem;
  align-items: start;
}

.catalog-sidebar {
  padding-top: 0.5rem;
}

.catalog-sidebar-title,
.catalog-footer-brand {
  margin: 0;
  color: var(--primary-strong);
}

.catalog-sidebar-title {
  font-size: 0.98rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.catalog-filter-block,
.catalog-status-block {
  margin-top: 1.75rem;
}

.catalog-filter-item {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  margin-bottom: 0.3rem;
  padding: 0 1rem 0 1.15rem;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.catalog-filter-item:hover {
  background: rgba(243, 244, 245, 0.98);
  color: var(--primary-strong);
}

.catalog-filter-item.active {
  background: rgba(225, 227, 228, 0.95);
  color: var(--primary-strong);
  font-weight: 700;
}

.catalog-filter-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  width: 4px;
  height: 24px;
  border-radius: 0 4px 4px 0;
  background: var(--accent-color);
  transform: translateY(-50%);
}

.catalog-filter-item strong {
  min-width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(0, 30, 64, 0.94);
  color: white;
  font-size: 0.84rem;
}

.catalog-label {
  margin: 0 0 1rem;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--text-muted);
}

.catalog-check {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
  color: var(--text-secondary);
}

.catalog-check input {
  width: 18px;
  height: 18px;
  accent-color: var(--accent-color);
}

.catalog-callout {
  margin-top: 2rem;
  padding: 1.6rem;
  border-radius: 18px;
  background: linear-gradient(150deg, #0a2129, #123248);
  color: white;
}

.catalog-callout-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.14);
}

.catalog-callout h3 {
  margin: 1rem 0 0;
  font-size: 1.2rem;
  line-height: 1.2;
}

.catalog-callout p {
  margin: 0.9rem 0 0;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.78);
}

.catalog-callout button {
  min-height: 46px;
  margin-top: 1.2rem;
  padding: 0 1.2rem;
  border: none;
  border-radius: 8px;
  background: rgba(17, 182, 205, 0.92);
  color: white;
  font-family: 'Manrope', sans-serif;
  font-weight: 800;
  cursor: pointer;
}

.catalog-main {
  min-width: 0;
}

.catalog-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 2rem;
  padding-top: 0.75rem;
}

.catalog-header-copy h1 {
  margin: 0;
  font-size: clamp(2.7rem, 4vw, 3.75rem);
  line-height: 0.97;
  letter-spacing: -0.045em;
  color: var(--primary-strong);
}

.catalog-header-copy p {
  max-width: 780px;
  margin: 1rem 0 0;
  font-size: 1.06rem;
  line-height: 1.65;
  color: var(--text-secondary);
}

.catalog-search {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.8rem;
  width: 380px;
  min-height: 56px;
  padding: 0 1rem;
  border-radius: 12px;
  background: rgba(243, 244, 245, 0.96);
  box-shadow: inset 0 -2px 0 transparent;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.catalog-search:focus-within {
  background: rgba(255, 255, 255, 0.98);
  box-shadow: inset 0 -2px 0 var(--accent-color);
}

.catalog-search-icon {
  color: var(--text-muted);
}

.catalog-search input {
  border: none;
  background: transparent;
  font: inherit;
  color: var(--primary-strong);
  outline: none;
}

.catalog-note {
  margin-top: 1rem;
  padding: 1rem 1.1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  color: var(--text-secondary);
}

.catalog-list {
  display: grid;
  gap: 1rem;
  margin-top: 1.4rem;
}

.catalog-loading,
.catalog-empty {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  padding: 3rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 24px rgba(var(--primary-rgb), 0.05);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 104, 118, 0.15);
  border-top-color: var(--accent-color);
  border-radius: 999px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.catalog-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 2rem;
}

.catalog-page-btn,
.catalog-page-current {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: none;
  font: inherit;
}

.catalog-page-btn {
  background: rgba(243, 244, 245, 0.95);
  color: var(--primary-strong);
  cursor: pointer;
}

.catalog-page-current {
  background: linear-gradient(135deg, var(--primary-strong), var(--primary-soft));
  color: white;
  font-weight: 800;
}

.catalog-page-total {
  color: var(--text-secondary);
}

.catalog-footer {
  margin-top: 4rem;
}

.catalog-footer-shell {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(195, 198, 209, 0.35);
}

.catalog-footer-brand {
  font-size: 1.6rem;
}

.catalog-footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 1rem 2rem;
}

.catalog-footer-links a {
  color: var(--text-secondary);
  text-decoration: none;
}

@media (max-width: 1080px) {
  .catalog-shell {
    grid-template-columns: 1fr;
  }

  .catalog-header {
    flex-direction: column;
    align-items: stretch;
  }

  .catalog-search {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .catalog-page {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .catalog-footer-shell {
    flex-direction: column;
  }

  .catalog-footer-links {
    justify-content: flex-start;
  }
}
</style>
