<script setup>
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { docsPages, getDocsPageHref } from '../content/docs'
import { faviconUrl, siteHomeUrl } from '../content/site'

const route = useRoute()
const searchQuery = ref('')

const normalize = value => value.toLowerCase().trim()

const filteredPages = computed(() => {
  const query = normalize(searchQuery.value)

  if (!query) {
    return docsPages
  }

  return docsPages.filter(page => {
    const haystack = [
      page.navTitle,
      page.title,
      page.description,
      page.intro,
      ...(page.paragraphs || []),
      ...(page.bullets || []),
      ...page.sections.flatMap(section => [
        section.title,
        ...(section.paragraphs || []),
        ...(section.bullets || []),
        section.code || ''
      ])
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
})

const isPageActive = page => {
  const expected = page.slug ? `/docs/${page.slug}/` : '/docs/'
  return route.path === expected.replace('/docs', '') || route.fullPath.startsWith(expected)
}
</script>

<template>
  <div class="docs-shell">
    <div class="docs-layout">
      <aside class="docs-sidebar">
        <div class="docs-brand-box">
          <a class="docs-brand-link" :href="siteHomeUrl">
            <span class="docs-brand-mark" aria-hidden="true">
              <img class="docs-brand-icon" :src="faviconUrl" alt="">
            </span>
            <span class="docs-brand-copy">
              <strong>OpenGeoLab</strong>
              <span>Docs</span>
            </span>
          </a>
        </div>

        <div class="docs-panel docs-panel--sidebar">
          <div class="docs-panel-header">
            <strong>GeoCopilot Docs</strong>
            <span>Product documentation</span>
          </div>

          <label class="docs-search">
            <span class="docs-search-label">Search</span>
            <span class="docs-search-input">
              <input v-model="searchQuery" type="search" placeholder="Search docs" />
              <span class="docs-search-shortcut">⌘ K</span>
            </span>
          </label>

          <div v-if="filteredPages.length" class="docs-nav-list">
            <RouterLink
              v-for="page in filteredPages"
              :key="page.slug || 'docs-home'"
              :to="page.slug ? `/${page.slug}/` : '/'"
              custom
              v-slot="{ href, navigate, isExactActive }"
            >
              <a
                :href="getDocsPageHref(page.slug)"
                class="docs-nav-link"
                :class="{ 'is-active': isExactActive }"
                @click="navigate"
              >
                {{ page.navTitle }}
              </a>
            </RouterLink>
          </div>

          <p v-else class="docs-empty-state">No pages matched that search.</p>

          <div class="docs-sidebar-actions">
            <a class="docs-ghost-button" :href="siteHomeUrl">Back to site</a>
          </div>
        </div>
      </aside>

      <RouterView />
    </div>
  </div>
</template>
