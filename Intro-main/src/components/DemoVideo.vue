<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { withBase } from '../content/site'

const props = defineProps({
  caption: {
    type: String,
    default: ''
  },
  compact: {
    type: Boolean,
    default: false
  },
  hero: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'GeoCopilot Demo'
  },
  status: {
    type: String,
    default: 'Live product walkthrough'
  },
  rate: {
    type: Number,
    default: 1.25
  }
})

const videoRef = ref(null)
const demoVideoSrc = withBase('safari-demo-h264.mp4')

const syncRate = () => {
  if (videoRef.value) {
    videoRef.value.playbackRate = props.rate
    videoRef.value.defaultPlaybackRate = props.rate
  }
}

onMounted(() => {
  nextTick(syncRate)
})
</script>

<template>
  <div class="demo-video-wrap">
    <div class="video-shell" :class="{ 'video-shell--compact': compact, 'video-shell--hero': hero }">
      <div v-if="!hero" class="video-header">
        <span class="traffic" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <span class="window-title">{{ title }}</span>
        <span class="window-status">{{ status }}</span>
      </div>

      <video
        ref="videoRef"
        class="video-frame"
        :class="{ 'video-frame--hero': hero }"
        :src="demoVideoSrc"
        autoplay
        muted
        loop
        playsinline
        preload="metadata"
        controls
        @loadedmetadata="syncRate"
        @play="syncRate"
      >
        Your browser does not support embedded MP4 playback.
      </video>
    </div>

    <p v-if="caption && !hero" class="video-caption">{{ caption }}</p>
  </div>
</template>
