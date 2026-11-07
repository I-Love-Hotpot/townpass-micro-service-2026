<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppIcon from '@/components/atoms/AppIcon.vue';
import LogicNotes from '@/components/molecules/LogicNotes.vue';
import DocumentGallery from '@/components/organisms/DocumentGallery.vue';
import type { DocumentRecord } from '@/interfaces/document';
import { answerQuestion } from '@/services/answers';
import { fixtures } from '@/services/fixtures';
import { translate, type Label } from '@/services/i18n';
import { explainAgain } from '@/services/processing';
import { analyzeDocument, analyzeSixQuestions, askDocument } from '@/services/offline';
import type { DocumentAnalysis } from '@/services/govclearRag';
import { hashText } from '@/services/govclearJson';
import { SIX_QUESTIONS } from '@/services/govclearSixQuestions';
import { records } from '@/services/records';
import { useWorkspace } from '@/stores/workspace';

const route = useRoute();
const workspace = useWorkspace();
const t = computed(() => translate.bind(null, workspace.context.locale));
const entry = shallowRef<DocumentRecord>();
const explanationPreview = shallowRef<DocumentAnalysis>();
const visibleSummary = computed(() => explanationPreview.value?.summary ?? entry.value?.summary);
const urls = shallowRef<string[]>([]);
const loadError = ref(false);
const loading = ref(true);
const feedback = ref<Label>();
const failed = ref(false);
const pending = ref(false);
const question = ref('');
const draftSource = ref('');
const sixError = ref('');
const actionError = ref('');
const sixCopied = ref(false);
const phase = ref<'explain' | 'chat' | 'six'>();
const elapsed = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

function startTimer() {
  const started = performance.now();
  clearInterval(timer);
  elapsed.value = 0;
  timer = setInterval(() => {
    elapsed.value = Math.floor((performance.now() - started) / 1000);
  }, 1000);
  return started;
}
const sourceDirty = computed(() => draftSource.value !== (entry.value?.source ?? ''));
const sixLabels = {
  who: 'sixWho',
  what: 'sixWhat',
  when: 'sixWhen',
  where: 'sixWhere',
  why: 'sixWhy',
  how: 'sixHow'
} as const;
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
  clearInterval(timer);
  timer = undefined;
  task?.abort();
  task = undefined;
  pending.value = false;
  feedback.value = undefined;
  actionError.value = '';
  explanationPreview.value = undefined;
  phase.value = undefined;
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
    if (record?.analysis && record.analysis.sourceHash !== (await hashText(record.source ?? ''))) {
      throw new Error('來源版本已改變，請重新整理文件。');
    }
    if (request !== requestId) return;
    entry.value = record;
    draftSource.value = record?.source ?? '';
    sixError.value = '';
    sixCopied.value = false;
    if (record) urls.value = record.pages.map((blob) => URL.createObjectURL(blob));
  } catch {
    if (request === requestId) loadError.value = true;
  } finally {
    if (request === requestId) loading.value = false;
  }
  if (
    request === requestId &&
    route.name === 'document' &&
    entry.value?.source &&
    !entry.value.sixQuestions
  )
    void generateSix();
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
  if (!record || pending.value || (action === 'chat' && sourceDirty.value)) return;
  const current = new AbortController();
  const locale = workspace.context.locale;
  task = current;
  pending.value = true;
  phase.value = action;
  actionError.value = '';
  feedback.value = undefined;
  failed.value = false;
  let refreshSix = false;
  const started = startTimer();
  try {
    const sample = fixtures.find((item) => item.id === record.fixtureId)?.summaries[locale];
    const analysis =
      action === 'explain' && record.source
        ? await analyzeDocument(
            draftSource.value,
            record.summary.title,
            locale,
            current.signal,
            (analysis) => {
              if (task === current && !current.signal.aborted) explanationPreview.value = analysis;
            }
          )
        : undefined;
    const summary =
      action === 'explain'
        ? record.source
          ? analysis!.summary
          : explainAgain(sample)
        : record.summary;
    const rag =
      action === 'chat' && record.source
        ? await askDocument(record, prompt, locale, current.signal)
        : undefined;
    const answer =
      action === 'chat' ? (rag ? rag.answer : answerQuestion(prompt, sample, locale)) : '';
    current.signal.throwIfAborted();
    const updated = await records.update(record.id, (stored) => {
      current.signal.throwIfAborted();
      if (stored.source !== record.source) throw new Error(t.value('sourceChanged'));
      if (action === 'explain')
        return {
          ...stored,
          summary: explainAgain(summary),
          locale,
          source: record.source === undefined ? undefined : draftSource.value,
          sixQuestions: analysis?.sixQuestions,
          analysis,
          sixQuestionsSeconds: undefined,
          processingSeconds: (performance.now() - started) / 1000,
          chat: []
        };
      const exchange = {
        question: prompt,
        rag,
        answer,
        locale
      };
      return { ...stored, chat: [...stored.chat, exchange] };
    });
    if (task !== current) return;
    entry.value = updated;
    if (action === 'explain') {
      feedback.value = 'explained';
      draftSource.value = updated.source ?? '';
      sixError.value = '';
      sixCopied.value = false;
      refreshSix = Boolean(updated.source && !updated.sixQuestions);
    } else {
      question.value = '';
      await nextTick();
      chatEnd.value?.scrollIntoView({ block: 'nearest' });
    }
  } catch (cause) {
    if (task !== current) return;
    actionError.value = cause instanceof Error ? cause.message : '';
    failed.value = true;
    feedback.value = action === 'explain' ? 'explainError' : 'chatError';
  } finally {
    if (task === current) {
      clearInterval(timer);
      pending.value = false;
      explanationPreview.value = undefined;
      task = undefined;
      phase.value = undefined;
    }
  }
  if (refreshSix && !current.signal.aborted && route.name === 'document') void generateSix();
}

async function generateSix() {
  const record = entry.value;
  if (!record?.source || pending.value || sourceDirty.value) return;
  const current = new AbortController();
  task = current;
  pending.value = true;
  phase.value = 'six';
  sixError.value = '';
  sixCopied.value = false;
  const started = startTimer();
  try {
    const analysis = record.analysis
      ? await analyzeDocument(
          record.source,
          record.summary.title,
          workspace.context.locale,
          current.signal
        )
      : undefined;
    const answers =
      analysis?.sixQuestions ??
      (await analyzeSixQuestions(record.source, workspace.context.locale, current.signal));
    current.signal.throwIfAborted();
    const updated = await records.update(record.id, (stored) => {
      current.signal.throwIfAborted();
      if (stored.source !== record.source) throw new Error(t.value('sourceChanged'));
      return {
        ...stored,
        sixQuestions: answers,
        analysis,
        summary: analysis?.summary ?? stored.summary,
        sixQuestionsSeconds: (performance.now() - started) / 1000
      };
    });
    if (task === current) entry.value = updated;
  } catch (cause) {
    if (task === current && !current.signal.aborted)
      sixError.value = cause instanceof Error ? cause.message : t.value('processingError');
  } finally {
    if (task === current) {
      clearInterval(timer);
      task = undefined;
      pending.value = false;
      phase.value = undefined;
    }
  }
}

async function copySix() {
  const answers = entry.value?.sixQuestions;
  if (!answers || sourceDirty.value) return;
  try {
    await navigator.clipboard.writeText(
      SIX_QUESTIONS.map(
        ({ key }) => `${t.value(sixLabels[key])}：${answers[key] ?? t.value('notMentioned')}`
      ).join('\n\n')
    );
    sixCopied.value = true;
  } catch {
    sixError.value = t.value('copyError');
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
        <LogicNotes
          v-if="!sourceDirty"
          :notes="entry.analysis?.logicNotes"
          :locale="workspace.context.locale"
        />
        <p v-if="sourceDirty" class="feedback" role="status">{{ t('sourceChanged') }}</p>
        <p v-if="!entry.chat.length" class="rounded bg-surface p-4 text-sm text-muted">
          {{ t('chatEmpty') }}
        </p>
        <TransitionGroup name="list">
          <div
            v-for="(exchange, index) in sourceDirty ? [] : entry.chat"
            :key="index"
            class="space-y-2"
          >
            <p
              class="ml-6 whitespace-pre-line break-words rounded-lg bg-brand-light p-3 text-right"
            >
              {{ exchange.question }}
            </p>
            <p class="mr-6 whitespace-pre-line break-words rounded-lg bg-surface p-3">
              {{ exchange.answer }}
            </p>
            <details v-if="exchange.rag?.evidence.length" class="mr-6 rounded bg-surface p-3">
              <summary>
                {{
                  workspace.context.locale === 'id'
                    ? 'Referensi dokumen dan peraturan'
                    : '參考資料（文件與法條）'
                }}
              </summary>
              <div
                v-for="evidence in exchange.rag.evidence"
                :key="evidence.unit_id"
                class="mt-3 space-y-2"
              >
                <a
                  :href="evidence.source_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-action"
                >
                  {{ evidence.title }} · {{ evidence.unit_label }}
                </a>
                <p class="text-xs text-muted">{{ evidence.version_id }}</p>
                <p class="whitespace-pre-line">{{ evidence.text }}</p>
              </div>
            </details>
          </div>
        </TransitionGroup>
        <form class="space-y-3" @submit.prevent="applyAction('chat')">
          <label for="document-question" class="sr-only">{{ t('chatPlaceholder') }}</label>
          <textarea
            id="document-question"
            v-model="question"
            rows="2"
            class="block w-full resize-y rounded-lg border border-line px-3 py-2"
            :placeholder="t('chatPlaceholder')"
            :disabled="pending"
          ></textarea>
          <button
            type="submit"
            class="action-button action-primary w-full"
            :disabled="pending || sourceDirty"
          >
            {{ t('send') }}
          </button>
          <Transition name="feedback">
            <p v-if="feedback" class="feedback" role="alert">{{ actionError || t(feedback) }}</p>
          </Transition>
        </form>
        <div ref="chatEnd"></div>
      </section>
      <article v-else class="space-y-7">
        <h1 class="page-title">{{ entry.summary.title }}</h1>
        <LogicNotes
          v-if="!sourceDirty || explanationPreview"
          :notes="explanationPreview?.logicNotes ?? entry.analysis?.logicNotes"
          :locale="workspace.context.locale"
        />
        <section
          v-if="visibleSummary && (!sourceDirty || explanationPreview)"
          class="rounded bg-surface p-4"
          aria-labelledby="summary-heading"
        >
          <h2 id="summary-heading" class="section-title">{{ t('summary') }}</h2>
          <p v-if="phase === 'explain'" class="mt-2 text-sm text-brand-dark" role="status">
            {{ t('elapsedSeconds', { n: elapsed }) }}
          </p>
          <p v-else-if="entry.processingSeconds !== undefined" class="mt-2 text-sm text-muted">
            {{ t('completedSeconds', { n: entry.processingSeconds.toFixed(1) }) }}
          </p>
          <ul class="mt-3 list-disc space-y-2 pl-5">
            <li
              v-for="fact in visibleSummary.facts"
              :key="fact"
              class="whitespace-pre-line break-words"
            >
              {{ fact }}
            </li>
          </ul>
          <p class="mt-4 break-words border-t border-[#CAD1D5] pt-3 font-semibold text-[#22474E]">
            {{ visibleSummary.action }}
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
                t(phase === 'explain' ? 'explaining' : 'reExplain')
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
              {{ actionError || t(feedback) }}
            </p>
          </Transition>
        </section>
        <section
          v-if="entry.source !== undefined"
          class="space-y-3"
          aria-labelledby="source-heading"
          :aria-busy="phase === 'explain'"
        >
          <h2 id="source-heading" class="section-title">{{ t('ocrReview') }}</h2>
          <details class="rounded-lg border border-line p-3" :open="sourceDirty">
            <summary class="cursor-pointer font-semibold text-brand-dark">
              {{ t('sourceText') }}
            </summary>
            <label for="document-source" class="mt-3 block text-sm">{{ t('sourceText') }}</label>
            <textarea
              id="document-source"
              v-model="draftSource"
              rows="8"
              :disabled="pending"
              class="mt-2 block w-full resize-y rounded-lg border border-line px-3 py-2"
              aria-describedby="source-notice"
              @input="sixCopied = false"
            ></textarea>
          </details>
          <p
            id="source-notice"
            class="text-sm text-muted"
            :role="sourceDirty ? 'status' : undefined"
          >
            {{ t(sourceDirty ? 'sourceChanged' : 'ocrHint') }}
          </p>
          <template v-if="sourceDirty">
            <p v-if="phase === 'explain'" role="status" class="text-sm text-brand-dark">
              {{ t('explaining') }} · {{ t('elapsedSeconds', { n: elapsed }) }}
            </p>
            <button
              type="button"
              class="action-button action-primary w-full"
              :disabled="pending"
              @click="applyAction('explain')"
            >
              {{ t('correctedSummary') }}
            </button>
            <button
              type="button"
              class="text-action"
              :disabled="pending"
              @click="draftSource = entry.source ?? ''"
            >
              {{ t('discardEdits') }}
            </button>
            <p v-if="failed && actionError" role="alert" class="feedback">{{ actionError }}</p>
          </template>
        </section>
        <section
          v-if="entry.source && !sourceDirty"
          class="space-y-3"
          aria-labelledby="six-heading"
          :aria-busy="phase === 'six'"
        >
          <h2 id="six-heading" class="section-title">{{ t('sixQuestions') }}</h2>
          <p v-if="phase === 'six'" role="status" class="text-sm text-brand-dark">
            {{ t('sixGenerating') }} · {{ t('elapsedSeconds', { n: elapsed }) }}
          </p>
          <p
            v-else-if="entry.sixQuestions && entry.sixQuestionsSeconds !== undefined"
            class="text-sm text-muted"
          >
            {{ t('sixCompletedSeconds', { n: entry.sixQuestionsSeconds.toFixed(1) }) }}
          </p>
          <dl v-if="entry.sixQuestions" class="grid gap-3 sm:grid-cols-2">
            <div v-for="item in SIX_QUESTIONS" :key="item.key" class="rounded bg-surface p-4">
              <dt class="font-semibold text-brand-dark">{{ t(sixLabels[item.key]) }}</dt>
              <dd class="mt-2 whitespace-pre-line break-words">
                {{ entry.sixQuestions[item.key] ?? t('notMentioned') }}
              </dd>
            </div>
          </dl>
          <p v-if="sixError" role="alert" class="feedback">{{ sixError }}</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="text-action" :disabled="pending" @click="generateSix">
              {{ t(entry.sixQuestions ? 'sixRegenerate' : 'sixGenerate') }}
            </button>
            <button
              v-if="entry.sixQuestions"
              type="button"
              class="text-action"
              :disabled="pending"
              @click="copySix"
            >
              {{ t('copySix') }}
            </button>
          </div>
          <p v-if="sixCopied" role="status" class="text-sm text-brand-dark">{{ t('copied') }}</p>
        </section>
        <section
          v-if="entry.analysis && !sourceDirty"
          class="space-y-3"
          aria-labelledby="rag-heading"
        >
          <h2 id="rag-heading" class="section-title">
            {{
              workspace.context.locale === 'id'
                ? 'Pertanyaan yang mungkin Anda ajukan'
                : '你可能想問'
            }}
          </h2>
          <p class="text-sm text-muted">
            {{
              workspace.context.locale === 'id'
                ? 'Konten dibuat oleh AI tanpa pemeriksaan tambahan. Periksa dokumen asli.'
                : 'AI 直接生成，未經額外複核，請核對原文與引用來源。'
            }}
          </p>
          <p v-if="entry.analysis.publication === 'partial'" role="status" class="feedback">
            {{
              workspace.context.locale === 'id'
                ? 'Sebagian pertanyaan atau jawaban belum tersedia.'
                : '部分問題或回答未生成；已保留可用結果。'
            }}
          </p>
          <article
            v-for="item in entry.analysis.questions"
            :key="item.id"
            class="rounded bg-surface p-4 space-y-2"
          >
            <h3 class="font-semibold">{{ item.text }}</h3>
            <p class="whitespace-pre-line">{{ item.answer }}</p>
            <details>
              <summary>
                {{
                  workspace.context.locale === 'id'
                    ? 'Referensi dokumen dan peraturan'
                    : '參考資料（文件與法條）'
                }}
              </summary>
              <blockquote class="my-2 whitespace-pre-line">{{ item.sourceQuote }}</blockquote>
              <div v-for="evidence in item.evidence" :key="evidence.unit_id" class="my-3">
                <a
                  :href="evidence.source_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-action"
                >
                  {{ evidence.title }} · {{ evidence.unit_label }}
                </a>
                <p class="text-xs text-muted">{{ evidence.version_id }} · {{ item.retrievedAt }}</p>
                <p class="whitespace-pre-line">{{ evidence.text }}</p>
              </div>
            </details>
          </article>
        </section>
        <button v-if="pending" type="button" class="text-action" @click="cancelAction">
          {{ t('stop') }}
        </button>
        <DocumentGallery :id="entry.id" :urls="urls" :locale="workspace.context.locale" />
      </article>
    </Transition>
  </div>
</template>
