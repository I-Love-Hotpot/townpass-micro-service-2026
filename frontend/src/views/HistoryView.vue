<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import HistoryCard from '@/components/molecules/HistoryCard.vue';
import type { RecordCard } from '@/interfaces/document';
import { translate } from '@/services/i18n';
import { records } from '@/services/records';
import { useWorkspace } from '@/stores/workspace';

const workspace = useWorkspace();
const t = computed(() => translate.bind(null, workspace.context.locale));
const selected = ref<RecordCard>();
const confirmation = ref<HTMLDialogElement>();
const deleting = ref(false);
const deleteError = ref(false);
const refreshError = ref(false);

async function load() {
  refreshError.value = false;
  await workspace.initialize();
  if (!workspace.initError) {
    try {
      await workspace.refresh();
    } catch {
      refreshError.value = true;
    }
  }
}
onMounted(load);

function ask(card: RecordCard) {
  selected.value = card;
  deleteError.value = false;
  confirmation.value?.showModal();
}

async function remove() {
  if (!selected.value || deleting.value) return;
  deleting.value = true;
  deleteError.value = false;
  try {
    const id = selected.value.id;
    await records.delete(id);
    workspace.cards = workspace.cards.filter((card) => card.id !== id);
    confirmation.value?.close();
  } catch {
    deleteError.value = true;
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="min-h-full bg-surface px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
    <h1 class="section-title mb-5">{{ t('historyTitle') }}</h1>
    <p v-if="workspace.initializing" role="status" class="text-sm text-muted">{{ t('loading') }}</p>
    <div v-else-if="workspace.initError || refreshError" role="alert">
      <p class="feedback">{{ t('storageError') }}</p>
      <button type="button" class="text-action mt-2" @click="load">{{ t('retry') }}</button>
    </div>
    <div v-else-if="workspace.cards.length" class="space-y-4">
      <HistoryCard
        v-for="card in workspace.cards"
        :key="card.id"
        :card="card"
        :locale="workspace.context.locale"
        @remove="ask(card)"
      />
    </div>
    <div v-else class="rounded bg-white p-4">
      <p class="text-sm text-muted">{{ t('empty') }}</p>
      <RouterLink :to="{ name: 'scan' }" replace class="text-action mt-2">
        {{ t('scan') }}
      </RouterLink>
    </div>

    <dialog
      ref="confirmation"
      aria-labelledby="delete-title"
      class="m-auto w-[min(90vw,360px)] rounded-lg p-5 text-ink backdrop:bg-black/40"
      @cancel="deleting && $event.preventDefault()"
    >
      <h2 id="delete-title" class="section-title">{{ t('deleteTitle') }}</h2>
      <p class="mt-2 break-words font-semibold">{{ selected?.summary.title }}</p>
      <p class="mt-2 text-sm text-muted">{{ t('deleteBody') }}</p>
      <p v-if="deleteError" class="feedback mt-2" role="alert">{{ t('deleteError') }}</p>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          class="text-action"
          :disabled="deleting"
          @click="confirmation?.close()"
        >
          {{ t('cancel') }}
        </button>
        <button
          type="button"
          class="text-action !text-red-800"
          :disabled="deleting"
          @click="remove"
        >
          {{ t('delete') }}
        </button>
      </div>
    </dialog>
  </div>
</template>
