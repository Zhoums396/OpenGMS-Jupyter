<script setup>
import { RouterLink } from 'vue-router'
import DemoVideo from '../components/DemoVideo.vue'
import { videoHighlights } from '../content/site'
</script>

<template>
  <section class="page-section page-hero">
    <div class="page-intro centered narrow">
      <span class="eyebrow">Video</span>
      <h1>
        See the workspace workflow
        <span>in action</span>
      </h1>
      <p>
        This walkthrough should show the agent working inside a real workspace: reading context,
        writing cells, running code, reacting to output, and landing on a visible result.
      </p>

      <div class="action-row centered">
        <RouterLink class="primary-button" to="/download">Open Download</RouterLink>
        <RouterLink class="secondary-button" to="/features">Review Features</RouterLink>
      </div>
    </div>
  </section>

  <section class="page-section">
    <div class="video-page-frame">
      <DemoVideo caption="Default playback rate is 1.25× so the walkthrough stays tighter." />
    </div>
  </section>

  <section class="page-section section-block">
    <div class="section-heading narrow">
      <span class="eyebrow">What To Notice</span>
      <h2>Use the walkthrough to reinforce how the agent actually behaves</h2>
      <p>
        A strong demo focuses on workspace-aware interaction, visible execution steps, and a clear
        final outcome instead of a floating-chat presentation.
      </p>
    </div>

    <div class="summary-grid">
      <article v-for="item in videoHighlights" :key="item.title" class="summary-card">
        <span class="card-eyebrow">{{ item.eyebrow }}</span>
        <h3>{{ item.title }}</h3>
        <p>{{ item.body }}</p>
      </article>
    </div>
  </section>

  <section class="page-section section-block">
    <div class="cta-panel">
      <div class="cta-copy">
        <span class="eyebrow">Page Flow</span>
        <h2>Use video to prove the workflow, then send users to setup or feature detail</h2>
        <p>
          After the walkthrough, users usually want one of two things: install the extension or
          inspect the feature breakdown in more detail.
        </p>
      </div>

      <div class="action-row">
        <RouterLink class="ghost-button" to="/features">Open Features</RouterLink>
        <RouterLink class="primary-button" to="/download">Open Download</RouterLink>
      </div>
    </div>
  </section>
</template>
