<script setup>
import { computed, ref } from 'vue'
import { spotlightData, spotlightItems } from '../content/site'

const activeFeature = ref(spotlightItems[0].key)
const hoveredFeature = ref('')
const displayFeatureKey = computed(() => hoveredFeature.value || activeFeature.value)
const currentFeature = computed(() => spotlightData[displayFeatureKey.value])
const currentItem = computed(
  () => spotlightItems.find(item => item.key === displayFeatureKey.value) || spotlightItems[0]
)

const applyPlaybackRate = event => {
  const video = event.target
  video.playbackRate = 1.25
  video.play().catch(() => {})
}

const previewFeature = key => {
  hoveredFeature.value = key
}

const clearPreview = key => {
  if (hoveredFeature.value === key) {
    hoveredFeature.value = ''
  }
}

const selectFeature = key => {
  activeFeature.value = key
  hoveredFeature.value = ''
}
</script>

<template>
  <section class="page-section section-block">
    <div class="section-heading centered narrow">
      <span class="eyebrow">Features and Use Cases</span>
      <h2>See how GeoCopilot works inside JupyterLab</h2>
      <p>
        Short previews make the product legible fast: the agent reads workspace context, edits
        cells, recovers from failures, and carries longer workflows forward inside the workspace.
      </p>
    </div>

    <div class="spotlight-layout">
      <div class="spotlight-list" role="tablist" aria-label="Feature spotlight">
        <button
          v-for="item in spotlightItems"
          :key="item.key"
          class="spotlight-item"
          :class="{
            'is-active': activeFeature === item.key,
            'is-preview': hoveredFeature === item.key && activeFeature !== item.key
          }"
          :aria-selected="displayFeatureKey === item.key"
          role="tab"
          type="button"
          @mouseenter="previewFeature(item.key)"
          @mouseleave="clearPreview(item.key)"
          @focus="previewFeature(item.key)"
          @blur="clearPreview(item.key)"
          @click="selectFeature(item.key)"
        >
          <span class="spotlight-rail" aria-hidden="true">
            <span class="spotlight-trigger">
              <span class="spotlight-trigger-icon"></span>
            </span>
            <span class="spotlight-index">{{ item.index }}</span>
          </span>

          <span class="spotlight-text">
            <strong>{{ item.title }}</strong>
            <small>Preview demo -&gt;</small>
          </span>
        </button>
      </div>

      <div class="spotlight-preview">
        <div class="preview-window">
          <div class="preview-bar">
            <span class="preview-caption">OUT [{{ spotlightItems.findIndex(item => item.key === displayFeatureKey) + 1 }}]</span>
            <span class="preview-badge">Preview demo</span>
          </div>

          <div class="preview-screen">
            <div class="preview-video-shell">
              <video
                :key="currentFeature.videoSrc"
                class="preview-video"
                :src="currentFeature.videoSrc"
                autoplay
                muted
                loop
                playsinline
                preload="metadata"
                @loadedmetadata="applyPlaybackRate"
              ></video>
            </div>
          </div>

          <div class="preview-output">
            <span class="output-tag">AI Output</span>
            <h3>{{ currentItem.title }}</h3>
            <p>{{ currentFeature.outputCopy }}</p>
            <div class="tag-row">
              <span v-for="point in currentFeature.points" :key="point">{{ point }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
