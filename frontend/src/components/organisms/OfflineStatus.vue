<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useWorkspace } from '@/stores/workspace';

const workspace = useWorkspace();
const production = import.meta.env.PROD;
const state = ref<'downloading' | 'ready' | 'update' | 'error'>('downloading');
const messages = {
  'zh-TW': {
    downloading: '正在下載完整離線版本，完成前請保持連線。',
    ready: '完整離線版本已備妥。',
    update: '新離線版本已下載，關閉服務後重新開啟即可使用。',
    error: '離線版本未下載完成，請保持連線後重試。'
  },
  en: {
    downloading: 'Downloading the complete offline version. Stay connected.',
    ready: 'The complete offline version is ready.',
    update: 'Offline update downloaded. Close and reopen this service to use it.',
    error: 'Offline download incomplete. Connect and retry.'
  },
  id: {
    downloading: 'Mengunduh versi offline lengkap. Tetap terhubung.',
    ready: 'Versi offline lengkap siap digunakan.',
    update: 'Pembaruan diunduh. Tutup dan buka kembali layanan.',
    error: 'Unduhan offline belum selesai. Hubungkan dan coba lagi.'
  }
};
const language = computed(() => workspace.context.appLanguage ?? workspace.context.locale);
const text = computed(() => messages[language.value][state.value]);
let registration: ServiceWorkerRegistration | undefined;

async function download() {
  state.value = 'downloading';
  try {
    if (!('serviceWorker' in navigator)) throw new Error('Unavailable');
    registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    const observe = () => {
      const worker = registration?.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') state.value = registration?.active ? 'update' : 'ready';
        if (worker.state === 'redundant') state.value = registration?.active ? 'ready' : 'error';
      });
    };
    registration.addEventListener('updatefound', observe);
    observe();
    if (registration.waiting) state.value = 'update';
    else if (registration.active) state.value = 'ready';
    await registration.update();
  } catch {
    state.value = registration?.active ? 'ready' : 'error';
  }
}

onMounted(() => {
  if (import.meta.env.PROD) void download();
});
</script>

<template>
  <div
    v-if="production"
    class="shrink-0 border-b border-line px-4 py-2 text-xs text-muted"
    role="status"
  >
    {{ text }}
    <button v-if="state === 'error'" type="button" class="text-action ml-2" @click="download">
      {{ language === 'en' ? 'Retry' : language === 'id' ? 'Coba lagi' : '重試' }}
    </button>
  </div>
</template>
