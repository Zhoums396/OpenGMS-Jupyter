<script setup>
import { RouterLink } from 'vue-router'
import DemoVideo from '../components/DemoVideo.vue'
import {
  capabilityCards,
  caseCards,
  docsPageUrl,
  workflowSteps
} from '../content/site'
</script>

<template>
  <section class="page-section page-hero">
    <div class="page-intro centered narrow">
      <span class="eyebrow">Features</span>
      <h1>
        GeoCopilot
        <span>Features</span>
      </h1>
      <p>
        From workspace-aware context and direct cell actions to execution recovery, these are the
        verified behaviors the AI sidebar can perform inside JupyterLab.
      </p>

      <div class="action-row centered">
        <RouterLink class="primary-button" to="/download">Get Started</RouterLink>
        <RouterLink class="secondary-button" to="/video">Watch Demo</RouterLink>
      </div>
    </div>
  </section>

  <section class="page-section">
    <DemoVideo compact caption="Quick walkthrough of the GeoCopilot workflow." />
  </section>

  <section class="page-section section-block">
    <div class="section-heading narrow">
      <span class="eyebrow">Capability Grid</span>
      <h2>Structure the feature story around real notebook operations</h2>
      <p>
        The strongest version of this page is the one that stays close to what the sidebar can do
        during an actual notebook session.
      </p>
    </div>

    <div class="capability-grid">
      <article
        v-for="card in capabilityCards"
        :key="card.title"
        class="capability-card"
        :class="card.tone"
      >
        <span class="capability-icon">{{ card.number }}</span>
        <h3>{{ card.title }}</h3>
        <p>{{ card.body }}</p>

        <div v-if="card.points" class="mini-list">
          <span v-for="point in card.points" :key="point">{{ point }}</span>
        </div>
      </article>
    </div>
  </section>

  <section class="page-section section-block">
    <div class="section-heading">
      <span class="eyebrow">Agent Flow</span>
      <h2>Show the working rhythm instead of a list of disconnected buzzwords</h2>
      <p>
        This sequence mirrors the real product flow: configure once, let the agent inspect the
        workspace state, then let the tool loop write and repair.
      </p>
    </div>

    <div class="workflow-steps">
      <article v-for="step in workflowSteps" :key="step.number" class="workflow-step-card">
        <span class="step-number">{{ step.number }}</span>
        <h3>{{ step.title }}</h3>
        <p>{{ step.body }}</p>
      </article>
    </div>
  </section>

  <section class="page-section section-block">
    <p class="section-note">
      Companion-plugin features such as model browsing and parameter-to-code can still appear in
      the product story, but they should be framed as GeoCopilot context around the agent, not as
      the agent itself.
    </p>

    <div class="case-grid">
      <article v-for="card in caseCards" :key="card.title" class="case-card">
        <span class="case-pill">{{ card.eyebrow }}</span>
        <h3>{{ card.title }}</h3>
        <p>{{ card.body }}</p>
      </article>
    </div>
  </section>

  <section class="page-section section-block">
    <div class="cta-panel">
      <div class="cta-copy">
        <span class="eyebrow">Docs Jump</span>
        <h2>Need the setup details, architecture notes, or scope boundaries behind these features?</h2>
        <p>
          The docs collect installation notes, architecture boundaries, and companion-extension
          context without diluting the core agent story on this page.
        </p>
      </div>

      <div class="action-row">
        <a class="ghost-button" :href="docsPageUrl">Open Docs</a>
        <RouterLink class="primary-button" to="/download">Open Download</RouterLink>
      </div>
    </div>
  </section>
</template>
