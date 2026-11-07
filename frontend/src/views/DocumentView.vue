<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppIcon from '@/components/atoms/AppIcon.vue';
import DocumentGallery from '@/components/organisms/DocumentGallery.vue';
import type { DocumentRecord } from '@/interfaces/document';
import { answerQuestion } from '@/services/answers';
import { fixtures } from '@/services/fixtures';
import { translate, type Label } from '@/services/i18n';
import { delay, explainAgain } from '@/services/processing';
import { records } from '@/services/records';
import { useWorkspace } from '@/stores/workspace';

const route = useRoute();
const workspace = useWorkspace();
const t = computed(() => translate.bind(null, workspace.context.locale));
const entry = shallowRef<DocumentRecord>();
const urls = shallowRef<string[]>([]);
const loadError = ref(false);
const loading = ref(true);
const feedback = ref<Label>();
const failed = ref(false);
const pending = ref(false);
const question = ref('');
const chatEnd = ref<HTMLElement>();
let task: AbortController | undefined;
let requestId = 0;

const documentId = computed(() => String(route.params.id ?? ''));
const currentPage = computed(() => {
  const index = Number(route.params.page) - 1;
  return Number.isInteger(index) && index >= 0 ? urls.value[index] : undefined;
});
const destination = computed(() =>
  entry.value?.destinations.find((item) => item.id === route.params.destination)
);
const isMissing = computed(
  () =>
    !entry.value ||
    (route.name === 'page' && !currentPage.value) ||
    (route.name === 'destination' && !destination.value)
);

function releaseUrls() {
  for (const url of urls.value) URL.revokeObjectURL(url);
  urls.value = [];
}

function cancelAction() {
  task?.abort();
  task = undefined;
  pending.value = false;
  feedback.value = undefined;
}

async function load() {
  const request = ++requestId;
  const id = documentId.value;
  releaseUrls();
  entry.value = undefined;
  question.value = '';
  loading.value = true;
  loadError.value = false;
  try {
    let record = await records.get(id);
    if (!record && fixtures.some((fixture) => fixture.id === id)) {
      await workspace.initialize();
      if (workspace.initError) throw new Error('Sample initialization failed');
      record = await records.get(id);
    }
    if (request !== requestId) return;
    entry.value = record;
    if (record) urls.value = record.pages.map((blob) => URL.createObjectURL(blob));
  } catch {
    if (request === requestId) loadError.value = true;
  } finally {
    if (request === requestId) loading.value = false;
  }
}

watch(documentId, load, { immediate: true });
watch(() => route.path, cancelAction);
onBeforeUnmount(() => {
  requestId++;
  cancelAction();
  releaseUrls();
});

async function applyAction(action: 'explain' | 'chat') {
  const record = entry.value;
  const prompt = question.value.trim();
  if (!record || pending.value || (action === 'chat' && !prompt)) return;
  const current = new AbortController();
  const locale = workspace.context.locale;
  task = current;
  pending.value = true;
  feedback.value = undefined;
  failed.value = false;
  try {
    await delay(450, current.signal);
    const summary = fixtures.find((item) => item.id === record.fixtureId)?.summaries[locale];
    const updated = await records.update(record.id, (stored) => {
      current.signal.throwIfAborted();
      if (action === 'explain') return { ...stored, summary: explainAgain(summary), locale };
      const exchange = {
        question: prompt,
        answer: answerQuestion(prompt, summary, locale),
        locale
      };
      return { ...stored, chat: [...stored.chat, exchange] };
    });
    if (task !== current) return;
    entry.value = updated;
    if (action === 'explain') feedback.value = 'explained';
    else {
      question.value = '';
      await nextTick();
      chatEnd.value?.scrollIntoView({ block: 'nearest' });
    }
  } catch {
    if (task !== current) return;
    failed.value = true;
    feedback.value = action === 'explain' ? 'explainError' : 'chatError';
  } finally {
    if (task === current) {
      pending.value = false;
      task = undefined;
    }
  }
}
</script>

<template>
  <div class="relative px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
    <Transition name="content">
      <p v-if="loading" class="text-sm text-muted" role="status">{{ t('loadingDocument') }}</p>
      <div v-else-if="loadError">
        <p class="feedback" role="alert">{{ t('storageError') }}</p>
        <button type="button" class="text-action mt-2" @click="load">{{ t('retry') }}</button>
      </div>
      <div v-else-if="isMissing || !entry">
        <p>{{ t('notFound') }}</p>
        <RouterLink :to="{ name: 'history' }" replace class="text-action mt-2">
          {{ t('goHistory') }}
        </RouterLink>
      </div>
      <section v-else-if="route.name === 'page'" :key="route.path" class="space-y-4">
        <h1 class="page-title">{{ t('page', { n: String(route.params.page) }) }}</h1>
        <img
          :src="currentPage"
          :alt="t('page', { n: String(route.params.page) })"
          class="w-full rounded border border-line"
        />
      </section>
      <section
        v-else-if="route.name === 'destination' && destination"
        :key="route.path"
        class="space-y-4"
      >
        <h1 class="page-title">{{ destination.label[workspace.context.locale] }}</h1>
        <p class="section-title text-brand-dark">{{ t(destination.kind) }}</p>
        <p v-if="destination.target" class="break-all text-sm text-muted">
          {{ destination.target }}
        </p>
        <p class="rounded bg-brand-light p-4 text-sm text-muted">{{ t('destinationMessage') }}</p>
      </section>
      <section v-else-if="route.name === 'chat'" class="relative space-y-5">
        <div class="space-y-2">
          <h1 class="page-title">{{ t('chat') }}</h1>
          <p class="break-words text-sm text-muted">{{ entry.summary.title }}</p>
        </div>
        <p v-if="!entry.chat.length" class="rounded bg-surface p-4 text-sm text-muted">
          {{ t('chatEmpty') }}
        </p>
        <TransitionGroup name="list">
          <div v-for="(exchange, index) in entry.chat" :key="index" class="space-y-2">
            <p
              class="ml-6 whitespace-pre-line break-words rounded-lg bg-brand-light p-3 text-right"
            >
              {{ exchange.question }}
            </p>
            <p class="mr-6 whitespace-pre-line break-words rounded-lg bg-surface p-3">
              {{ exchange.answer }}
            </p>
          </div>
        </TransitionGroup>
        <form class="space-y-3" @submit.prevent="applyAction('chat')">
          <label for="document-question" class="sr-only">{{ t('chatPlaceholder') }}</label>
          <textarea
            id="document-question"
            v-model="question"
            rows="2"
            maxlength="500"
            class="block w-full resize-y rounded-lg border border-line px-3 py-2"
            :placeholder="t('chatPlaceholder')"
            :disabled="pending"
          ></textarea>
          <button
            type="submit"
            class="action-button action-primary w-full"
            :disabled="pending || !question.trim()"
          >
            {{ t('send') }}
          </button>
          <Transition name="feedback">
            <p v-if="feedback" class="feedback" role="alert">{{ t(feedback) }}</p>
          </Transition>
        </form>
        <div ref="chatEnd"></div>
      </section>
      <article v-else class="space-y-7">
        <h1 class="page-title">{{ entry.summary.title }}</h1>
        <section class="rounded bg-surface p-4" aria-labelledby="summary-heading">
          <h2 id="summary-heading" class="section-title">{{ t('summary') }}</h2>
          <ul class="mt-3 list-disc space-y-2 pl-5">
            <li v-for="fact in entry.summary.facts" :key="fact" class="break-words">{{ fact }}</li>
          </ul>
          <p class="mt-4 break-words border-t border-[#CAD1D5] pt-3 font-semibold text-[#22474E]">
            {{ entry.summary.action }}
          </p>
          <div class="mt-3 flex flex-wrap gap-x-2">
            <RouterLink
              :to="{ name: 'chat', params: { id: entry.id } }"
              class="text-action text-sm"
            >
              <AppIcon name="chat" class="h-5 w-5 shrink-0" />{{ t('chat') }}
            </RouterLink>
            <button
              type="button"
              class="text-action text-sm disabled:text-muted"
              :disabled="pending"
              @click="applyAction('explain')"
            >
              <AppIcon name="refresh" class="h-5 w-5 shrink-0" />{{
                t(pending ? 'explaining' : 'reExplain')
              }}
            </button>
          </div>
          <Transition name="feedback">
            <p
              v-if="feedback"
              class="mt-2 text-sm"
              :class="{ feedback: failed }"
              :role="failed ? 'alert' : 'status'"
            >
              {{ t(feedback) }}
            </p>
          </Transition>
        </section>
        <DocumentGallery :id="entry.id" :urls="urls" :locale="workspace.context.locale" />
        <section aria-labelledby="next-heading">
          <h2 id="next-heading" class="section-title">{{ t('next') }}</h2>
          <RouterLink
            v-for="item in entry.destinations"
            :key="item.id"
            :to="{ name: 'destination', params: { id: entry.id, destination: item.id } }"
            class="flex min-h-16 items-center gap-3 border-b border-line py-3 text-brand-dark"
          >
            <AppIcon :name="item.kind === 'official' ? 'external' : 'app'" class="shrink-0" />
            <div class="min-w-0 flex-1 break-words">
              <div class="font-semibold">{{ item.label[workspace.context.locale] }}</div>
              <div class="mt-1 text-sm text-muted">{{ t(item.kind) }}</div>
            </div>
            <AppIcon name="next" class="h-5 w-5 shrink-0" />
          </RouterLink>
        </section>
      </article>
    </Transition>
  </div>
</template>
