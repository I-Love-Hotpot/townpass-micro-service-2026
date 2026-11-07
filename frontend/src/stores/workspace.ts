import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type { AppContext, FileKind, RecordCard } from '@/interfaces/document';
import { readAppContext } from '@/services/context';
import { records } from '@/services/records';

export const useWorkspace = defineStore('workspace', () => {
  const context = shallowRef<AppContext>(readAppContext(new URL(location.href)));
  const cards = shallowRef<RecordCard[]>([]);
  const initializing = ref(false);
  const initError = ref(false);
  const processing = shallowRef<{ kind: FileKind; percent: number }>();
  const dataOperation = ref<'import' | 'clear'>();
  let initialLoad: Promise<void> | undefined;

  async function refresh() {
    cards.value = await records.list();
  }

  function initialize() {
    if (initialLoad) return initialLoad;
    initializing.value = true;
    initError.value = false;
    initialLoad = refresh()
      .catch(() => {
        initError.value = true;
        initialLoad = undefined;
      })
      .finally(() => {
        initializing.value = false;
      });
    return initialLoad;
  }

  return {
    context,
    cards,
    initializing,
    initError,
    processing,
    dataOperation,
    initialize,
    refresh
  };
});
