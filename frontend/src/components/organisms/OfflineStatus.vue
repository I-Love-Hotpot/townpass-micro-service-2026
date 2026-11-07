<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useWorkspace } from '@/stores/workspace';

const workspace = useWorkspace();
const production = import.meta.env.PROD;
const state = ref<'downloading' | 'ready' | 'update' | 'error'>('downloading');
const currentVersion = ref('');
const nextVersion = ref('');
const updateFailed = ref(false);
const messages = {
  'zh-TW': {
    downloading: '正在下載完整離線版本，完成前請保持連線。',
    ready: '完整離線版本已備妥。',
    version: '目前版本',
    nextVersion: '已下載版本',
    updateFailed: '更新未完成，繼續使用目前離線版本；連線恢復後自動重試。',
    update: '新離線版本已下載，關閉服務後重新開啟即可使用。',
    error: '離線版本未下載完成，請保持連線後重試。'
  },
  en: {
    downloading: 'Downloading the complete offline version. Stay connected.',
    ready: 'The complete offline version is ready.',
    version: 'Current version',
    nextVersion: 'Downloaded version',
    updateFailed:
      'Update incomplete. Keeping the current offline version; retrying when connected.',
    update: 'Offline update downloaded. Close and reopen this service to use it.',
    error: 'Offline download incomplete. Connect and retry.'
  },
  id: {
    downloading: 'Mengunduh versi offline lengkap. Tetap terhubung.',
    ready: 'Versi offline lengkap siap digunakan.',
    version: 'Versi saat ini',
    nextVersion: 'Versi diunduh',
    updateFailed:
      'Pembaruan belum selesai. Versi lama tetap tersedia; mencoba lagi saat terhubung.',
    update: 'Pembaruan diunduh. Tutup dan buka kembali layanan.',
    error: 'Unduhan offline belum selesai. Hubungkan dan coba lagi.'
  }
};
const language = computed(() => workspace.context.appLanguage ?? workspace.context.locale);
const text = computed(() => messages[language.value][state.value]);
let registration: ServiceWorkerRegistration | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let checking = false;
let disposed = false;
const observed = new WeakSet<ServiceWorker>();

function versionOf(worker: ServiceWorker) {
  return new Promise<string>((resolve) => {
    const channel = new MessageChannel();
    const finish = (version = '') => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(version);
    };
    const timeout = setTimeout(() => finish(), 2000);
    channel.port1.onmessage = (event) => finish(typeof event.data === 'string' ? event.data : '');
    try {
      worker.postMessage('GET_VERSION', [channel.port2]);
    } catch {
      finish();
    }
  });
}

async function showVersions() {
  const active = registration?.active;
  const waiting = registration?.waiting;
  if (active) currentVersion.value = await versionOf(active);
  if (waiting) nextVersion.value = await versionOf(waiting);
  else nextVersion.value = '';
}

function observe() {
  const worker = registration?.installing;
  if (!worker || observed.has(worker)) return;
  observed.add(worker);
  if (!registration?.active) state.value = 'downloading';
  worker.addEventListener('statechange', () => {
    if (disposed) return;
    if (worker.state === 'installed') {
      updateFailed.value = false;
      state.value = registration?.active ? 'update' : 'ready';
      void showVersions();
    }
    if (worker.state === 'activated') {
      state.value = 'ready';
      void showVersions();
    }
    if (worker.state === 'redundant') {
      state.value = registration?.active ? 'ready' : 'error';
      updateFailed.value = Boolean(registration?.active);
    }
  });
}

async function download() {
  if (checking || disposed) return;
  checking = true;
  try {
    if (!('serviceWorker' in navigator)) throw new Error('Unavailable');
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      registration.addEventListener('updatefound', observe);
    }
    observe();
    if (registration.waiting) state.value = 'update';
    else if (registration.active) state.value = 'ready';
    void showVersions();
    if (navigator.onLine) {
      await registration.update();
      updateFailed.value = false;
    }
  } catch {
    state.value = registration?.waiting ? 'update' : registration?.active ? 'ready' : 'error';
    updateFailed.value = Boolean(registration?.active);
  } finally {
    checking = false;
  }
}

function checkWhenVisible() {
  if (document.visibilityState === 'visible' && navigator.onLine) void download();
}

onMounted(() => {
  if (!production) return;
  void download();
  window.addEventListener('online', download);
  document.addEventListener('visibilitychange', checkWhenVisible);
  timer = setInterval(checkWhenVisible, 5 * 60 * 1000);
});

onBeforeUnmount(() => {
  disposed = true;
  clearInterval(timer);
  window.removeEventListener('online', download);
  document.removeEventListener('visibilitychange', checkWhenVisible);
  registration?.removeEventListener('updatefound', observe);
});
</script>

<template>
  <div
    v-if="production"
    class="shrink-0 border-b border-line px-4 py-2 text-xs text-muted"
    role="status"
  >
    <span>{{ text }}</span>
    <span v-if="currentVersion" class="mt-1 block font-mono">
      {{ messages[language].version }}: {{ currentVersion }}
    </span>
    <span v-if="nextVersion" class="mt-1 block font-mono">
      {{ messages[language].nextVersion }}: {{ nextVersion }}
    </span>
    <span v-if="updateFailed" class="mt-1 block">{{ messages[language].updateFailed }}</span>
    <button v-if="state === 'error'" type="button" class="text-action ml-2" @click="download">
      {{ language === 'en' ? 'Retry' : language === 'id' ? 'Coba lagi' : '重試' }}
    </button>
  </div>
</template>
