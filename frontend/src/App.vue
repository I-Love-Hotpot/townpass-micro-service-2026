<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import AppIcon from '@/components/atoms/AppIcon.vue';
import { translate } from '@/services/i18n';
import { useWorkspace } from '@/stores/workspace';

const router = useRouter();
const route = useRoute();
const workspace = useWorkspace();
const t = computed(() => translate.bind(null, workspace.context.locale));
const viewport = ref<HTMLElement>();
const closed = ref(false);
const scrollPositions = new Map<string, number>();
const isRoot = computed(() => route.name === 'scan' || route.name === 'history');

router.beforeEach((_to, from) => {
  if (viewport.value) scrollPositions.set(from.path, viewport.value.scrollTop);
});
watch(
  () => route.path,
  async (path) => {
    await nextTick();
    if (viewport.value) viewport.value.scrollTop = scrollPositions.get(path) ?? 0;
  }
);
watch(
  () => workspace.context.locale,
  (locale) => {
    document.documentElement.lang = locale === 'id' ? 'id' : 'zh-Hant';
  },
  { immediate: true }
);

onMounted(() => {
  void workspace.initialize();
});

function goBack() {
  if (window.history.state?.back) router.back();
  else if (route.name !== 'document' && route.params.id) {
    void router.replace({ name: 'document', params: { id: route.params.id } });
  } else void router.replace({ name: 'history' });
}

function close() {
  closed.value = true;
  scrollPositions.clear();
  void router.replace({ name: 'scan' });
}
</script>

<template>
  <div
    class="mx-auto flex h-[100dvh] w-full flex-col bg-white"
    :class="{ 'max-w-[480px] sm:border-x sm:border-line': !workspace.context.embedded }"
  >
    <header v-if="workspace.context.showHeader" class="shrink-0 bg-brand text-[#112629]">
      <div class="grid min-h-14 grid-cols-[48px_1fr_48px] items-center px-2">
        <button
          v-if="!isRoot && !closed"
          type="button"
          class="grid h-11 w-11 place-items-center rounded"
          :aria-label="t('back')"
          @click="goBack"
        >
          <AppIcon name="back" />
        </button>
        <span v-else></span>
        <span class="text-center text-lg font-semibold">{{ t('app') }}</span>
        <button
          v-if="!closed"
          type="button"
          class="grid h-11 w-11 place-items-center rounded"
          :aria-label="t('close')"
          @click="close"
        >
          <AppIcon name="close" />
        </button>
      </div>
    </header>
    <nav
      v-if="!closed && isRoot"
      :aria-label="t('app')"
      class="grid shrink-0 grid-cols-2 border-b border-line px-4"
    >
      <button
        v-for="tab in ['scan', 'history'] as const"
        :key="tab"
        type="button"
        class="min-h-12 border-b-[3px] border-transparent font-semibold text-muted disabled:text-[#5E6D76]"
        :class="{ '!border-brand !text-brand-dark': route.name === tab }"
        :aria-current="route.name === tab ? 'page' : undefined"
        :disabled="Boolean(workspace.processing)"
        @click="router.replace({ name: tab })"
      >
        {{ t(tab) }}
      </button>
    </nav>
    <main ref="viewport" class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div v-if="closed" class="p-6">
        <button type="button" class="action-button action-primary w-full" @click="closed = false">
          {{ t('reopen') }}
        </button>
      </div>
      <RouterView v-else />
    </main>
  </div>
</template>
