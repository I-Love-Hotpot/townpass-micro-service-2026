<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from '@/components/atoms/AppIcon.vue';
import { importExampleRecords } from '@/services/catalog';
import { translate, type Label } from '@/services/i18n';
import { records } from '@/services/records';
import { useWorkspace } from '@/stores/workspace';

const workspace = useWorkspace();
const t = computed(() => translate.bind(null, workspace.context.locale));
const busy = computed(() => Boolean(workspace.processing || workspace.dataOperation));
const examplesAvailable = import.meta.env.DEV;
const confirmation = ref<HTMLDialogElement>();
const status = ref<Label>();
const importedCount = ref(0);
const error = ref<Label>();

async function importExamples() {
  if (busy.value || !examplesAvailable) return;
  workspace.dataOperation = 'import';
  status.value = undefined;
  error.value = undefined;
  try {
    await workspace.initialize();
    importedCount.value = await importExampleRecords(workspace.context.locale);
    await workspace.refresh();
    workspace.initError = false;
    status.value = 'examplesImported';
  } catch {
    error.value = 'importExamplesError';
  } finally {
    workspace.dataOperation = undefined;
  }
}

function askToClear() {
  status.value = undefined;
  error.value = undefined;
  confirmation.value?.showModal();
}

async function clearData() {
  if (busy.value) return;
  workspace.dataOperation = 'clear';
  status.value = undefined;
  error.value = undefined;
  try {
    await workspace.initialize();
    await records.clear();
    workspace.cards = [];
    workspace.initError = false;
    status.value = 'dataCleared';
    confirmation.value?.close();
  } catch {
    error.value = 'clearDataError';
  } finally {
    workspace.dataOperation = undefined;
  }
}
</script>

<template>
  <div class="min-h-full bg-surface px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
    <RouterLink :to="{ name: 'scan' }" replace class="text-action mb-3">
      <AppIcon name="back" />
      {{ t('back') }}
    </RouterLink>
    <h1 class="page-title mb-6">{{ t('setting') }}</h1>

    <section class="rounded-lg bg-white p-4">
      <h2 class="section-title">{{ t('importExamples') }}</h2>
      <p class="mt-2 text-sm text-muted">{{ t('importExamplesBody') }}</p>
      <p v-if="!examplesAvailable" class="mt-2 text-sm text-muted">
        {{ t('examplesUnavailable') }}
      </p>
      <button
        type="button"
        class="action-button action-primary mt-4 w-full"
        :disabled="busy || !examplesAvailable"
        @click="importExamples"
      >
        {{ t(workspace.dataOperation === 'import' ? 'importingExamples' : 'importExamples') }}
      </button>
    </section>

    <section class="mt-4 rounded-lg bg-white p-4">
      <h2 class="section-title">{{ t('clearData') }}</h2>
      <p class="mt-2 text-sm text-muted">{{ t('clearDataBody') }}</p>
      <button
        type="button"
        class="action-button mt-4 w-full !border-red-800 !text-red-800 disabled:!border-line disabled:!text-muted"
        :disabled="busy"
        @click="askToClear"
      >
        {{ t(workspace.dataOperation === 'clear' ? 'clearingData' : 'clearData') }}
      </button>
    </section>
    <Transition name="feedback">
      <p v-if="status" role="status" class="mt-4 text-sm text-brand-dark">
        {{ t(status, { n: importedCount }) }}
      </p>
    </Transition>
    <Transition name="feedback">
      <p v-if="error && !confirmation?.open" role="alert" class="feedback mt-4">{{ t(error) }}</p>
    </Transition>

    <dialog
      ref="confirmation"
      aria-labelledby="clear-data-title"
      aria-describedby="clear-data-description"
      class="m-auto w-[min(90vw,360px)] rounded-lg p-5 text-ink backdrop:bg-black/40"
      @cancel="busy && $event.preventDefault()"
    >
      <h2 id="clear-data-title" class="section-title">{{ t('clearDataTitle') }}</h2>
      <p id="clear-data-description" class="mt-2 text-sm text-muted">
        {{ t('clearDataBody') }}
      </p>
      <Transition name="feedback">
        <p v-if="error" role="alert" class="feedback mt-2">{{ t(error) }}</p>
      </Transition>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          class="text-action"
          :disabled="busy"
          autofocus
          @click="confirmation?.close()"
        >
          {{ t('cancel') }}
        </button>
        <button type="button" class="text-action !text-red-800" :disabled="busy" @click="clearData">
          {{ t(workspace.dataOperation === 'clear' ? 'clearingData' : 'clearData') }}
        </button>
      </div>
    </dialog>
  </div>
</template>
