<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import AppIcon from '@/components/atoms/AppIcon.vue';
import LogicNotes from '@/components/molecules/LogicNotes.vue';
import FileAction from '@/components/molecules/FileAction.vue';
import DocumentCrop from '@/components/molecules/DocumentCrop.vue';
import type { FileKind, OriginalFile } from '@/interfaces/document';
import { makeDocument } from '@/services/catalog';
import { preparePages } from '@/services/files';
import { mergePageText, pageReady, type ImagePage } from '@/services/govclearImages';
import { translate } from '@/services/i18n';
import { recognizeDocument } from '@/services/offline';
import { processWithProgress } from '@/services/processing';
import { records } from '@/services/records';
import type { DocumentAnalysis } from '@/services/govclearRag';
import { SIX_QUESTIONS } from '@/services/govclearSixQuestions';
import { useWorkspace } from '@/stores/workspace';

const workspace = useWorkspace();
const router = useRouter();
const t = computed(() => translate.bind(null, workspace.context.locale));
const photos = ref<HTMLInputElement>();
const camera = ref<HTMLInputElement>();
const pdf = ref<HTMLInputElement>();
const pages = ref<ImagePage[]>([]);
const kind = ref<FileKind>('photos');
const pdfOriginal = shallowRef<OriginalFile>();
const collectingPhotos = ref(false);
const cropPage = ref<ImagePage>();
const error = ref('');
const stage = ref('');
const preview = shallowRef<DocumentAnalysis>();
const elapsed = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;
const busy = computed(() => Boolean(workspace.processing || workspace.dataOperation));
const allReady = computed(() => pages.value.length > 0 && pages.value.every(pageReady));
let controller: AbortController | undefined;
let iconTapCount = 0;
let lastIconTap = 0;

function tapHomeIcon() {
  const now = Date.now();
  iconTapCount = now - lastIconTap > 2000 ? 1 : iconTapCount + 1;
  lastIconTap = now;
  if (iconTapCount === 5) {
    iconTapCount = 0;
    void router.push({ name: 'setting' });
  }
}

function pick(target: 'photos' | 'pdf' | 'camera') {
  const input = target === 'camera' ? camera.value : target === 'photos' ? photos.value : pdf.value;
  if (!input || busy.value) return;
  input.value = '';
  input.click();
}

function cancel() {
  cropPage.value = undefined;
  clearInterval(timer);
  timer = undefined;
  controller?.abort();
  controller = undefined;
  workspace.processing = undefined;
  stage.value = '';
  for (const page of pages.value) if (page.status === 'processing') page.status = 'pending';
}

function releasePages() {
  for (const page of pages.value) URL.revokeObjectURL(page.preview);
}

onBeforeRouteLeave(cancel);
onBeforeUnmount(() => {
  cancel();
  releasePages();
});

function removePage(index: number) {
  if (busy.value) return;
  const [page] = pages.value.splice(index, 1);
  URL.revokeObjectURL(page.preview);
  error.value = '';
  if (!pages.value.length) {
    collectingPhotos.value = false;
    pdfOriginal.value = undefined;
    kind.value = 'photos';
  }
}

function movePage(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (busy.value || target < 0 || target >= pages.value.length) return;
  const [page] = pages.value.splice(index, 1);
  pages.value.splice(target, 0, page);
  error.value = '';
}

function corrected(page: ImagePage) {
  page.status = 'done';
  page.error = '';
  error.value = '';
}

function imagePage(file: Blob, name: string): ImagePage {
  return {
    id: crypto.randomUUID(),
    name,
    preview: URL.createObjectURL(file),
    size: file.size,
    file,
    original: file,
    cropConfirmed: kind.value === 'pdf',
    ownedPreview: true,
    text: '',
    status: 'pending',
    error: ''
  };
}

async function handlePhotos(event: Event, fromCamera = false) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (!files.length || busy.value || (pages.value.length && kind.value === 'pdf')) return;
  error.value = '';
  try {
    pages.value.push(...files.map((file) => imagePage(file, file.name)));
    kind.value = 'photos';
    if (fromCamera) collectingPhotos.value = true;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t.value('photoError');
  }
}

async function handlePdf(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (!files.length || busy.value || pages.value.length) return;
  error.value = '';
  const current = new AbortController();
  controller = current;
  try {
    workspace.processing = { kind: 'pdf', percent: 0 };
    const original = { name: files[0].name, blob: files[0] };
    const rendered = await preparePages([original], 'pdf', current.signal);
    current.signal.throwIfAborted();
    pdfOriginal.value = original;
    kind.value = 'pdf';
    pages.value = rendered.map((file, index) => imagePage(file, t.value('page', { n: index + 1 })));
  } catch (cause) {
    if (!current.signal.aborted)
      error.value = cause instanceof Error ? cause.message : t.value('pdfError');
  } finally {
    if (controller === current) {
      controller = undefined;
      workspace.processing = undefined;
    }
  }
  if (!current.signal.aborted && pages.value.length) await run();
}

async function closeCrop() {
  const id = cropPage.value?.id;
  cropPage.value = undefined;
  await nextTick();
  document.getElementById(`crop-${id}`)?.focus();
}

function confirmCrop(blob: Blob) {
  const page = cropPage.value;
  if (!page || busy.value) return;
  URL.revokeObjectURL(page.preview);
  page.file = blob;
  page.preview = URL.createObjectURL(blob);
  page.cropConfirmed = true;
  page.text = '';
  page.status = 'pending';
  page.error = '';
  cropPage.value = pages.value.find((candidate) => !candidate.cropConfirmed);
}

async function run() {
  if (!pages.value.length || busy.value) return;
  const current = new AbortController();
  const { signal } = current;
  controller = current;
  error.value = '';
  preview.value = undefined;
  const started = performance.now();
  elapsed.value = 0;
  timer = setInterval(() => {
    elapsed.value = Math.floor((performance.now() - started) / 1000);
  }, 1000);
  let saving = false;
  workspace.processing = { kind: kind.value, percent: 0 };
  try {
    if (!allReady.value) {
      const failures = await recognizeDocument(pages.value, signal, (index) => {
        stage.value = t.value('recognizingPage', { n: index + 1 });
      });
      signal.throwIfAborted();
      if (failures || !allReady.value) throw new Error(t.value('partialOcrError'));
    }
    stage.value = t.value('explaining');
    const originals =
      kind.value === 'pdf' && pdfOriginal.value
        ? [pdfOriginal.value]
        : pages.value.map((page) => ({ name: page.name, blob: page.original ?? page.file! }));
    const record = await processWithProgress(
      () =>
        makeDocument(
          originals,
          kind.value,
          workspace.context.locale,
          signal,
          pages.value.map((page) => page.file!),
          mergePageText(pages.value),
          (analysis) => {
            if (controller === current && !signal.aborted) {
              const firstResult = !preview.value;
              preview.value = analysis;
              if (firstResult)
                void nextTick(() => {
                  if (controller === current && !signal.aborted)
                    document.getElementById('preview-heading')?.scrollIntoView({ block: 'start' });
                });
              stage.value =
                workspace.context.locale === 'id'
                  ? 'Menyiapkan jawaban'
                  : '已取得可用內容，正在整理具體問題與回答';
            }
          }
        ),
      async (document) => {
        saving = true;
        document.processingSeconds = (performance.now() - started) / 1000;
        await records.put(document, signal);
      },
      (percent) => {
        workspace.processing = { kind: kind.value, percent };
      },
      signal
    );
    signal.throwIfAborted();
    await router.push({ name: 'document', params: { id: record.id } });
  } catch (cause) {
    if (!signal.aborted)
      error.value = saving
        ? t.value('saveError')
        : cause instanceof Error
          ? cause.message
          : t.value('processingError');
  } finally {
    if (controller === current) cancel();
  }
}
</script>

<template>
  <div
    :class="
      pages.length ? 'space-y-5 px-4 py-6' : 'grid min-h-full grid-rows-[minmax(220px,1fr)_auto]'
    "
  >
    <DocumentCrop
      v-if="cropPage?.original"
      :key="cropPage.id"
      :original="cropPage.original"
      :initial="cropPage.cropDraft"
      @draft="cropPage && (cropPage.cropDraft = $event)"
      @confirm="confirmCrop"
      @cancel="closeCrop"
    />
    <template v-else>
      <section
        v-if="!pages.length"
        class="flex flex-col items-center justify-center gap-4 px-6 py-8 text-center"
      >
        <button
          type="button"
          class="grid h-[72px] w-[72px] place-items-center rounded-2xl bg-brand-light text-brand-dark"
          :aria-label="t('app')"
          :disabled="busy"
          @click="tapHomeIcon"
        >
          <AppIcon name="document" class="h-9 w-9" />
        </button>
        <h1 class="page-title">{{ t('hero1') }}<br />{{ t('hero2') }}</h1>
        <p class="text-sm text-muted">{{ t('intro') }}</p>
      </section>
      <section
        :class="
          pages.length
            ? 'space-y-3'
            : 'flex flex-col justify-end gap-3 px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]'
        "
      >
        <h1 v-if="pages.length" class="page-title">{{ t('selectedPages') }}</h1>
        <template v-if="kind === 'photos'">
          <button
            type="button"
            class="action-button w-full"
            :disabled="busy"
            @click="pick('camera')"
          >
            <AppIcon name="photos" />{{ t(pages.length ? 'cameraMore' : 'camera') }}
          </button>
          <FileAction
            :label="t('photos')"
            :progress-label="t('processing')"
            primary
            :disabled="busy"
            @pick="pick('photos')"
          />
        </template>
        <FileAction
          v-if="!pages.length"
          :label="t('pdf')"
          :progress-label="t('processing')"
          :disabled="busy"
          @pick="pick('pdf')"
        />
        <p v-if="collectingPhotos" class="rounded bg-brand-light p-3 text-sm">
          {{ t('batchHint') }}
        </p>
        <p v-if="stage" role="status" class="text-sm text-brand-dark">
          {{ stage }} · {{ t('elapsedSeconds', { n: elapsed }) }}
        </p>
        <p v-if="error" id="scan-error" class="feedback" role="alert">{{ error }}</p>
        <button v-if="busy" type="button" class="text-action" @click="cancel">
          {{ t('stop') }}
        </button>
      </section>
      <section
        v-if="preview"
        aria-labelledby="preview-heading"
        class="space-y-4"
        aria-live="polite"
      >
        <h2 id="preview-heading" class="section-title">
          {{ workspace.context.locale === 'id' ? 'Ringkasan' : '先看重點' }}
        </h2>
        <p v-for="fact in preview.summary.facts" :key="fact" class="whitespace-pre-line">
          {{ fact }}
        </p>
        <p v-if="!preview.summary.facts.length" role="status">{{ preview.summary.action }}</p>
        <LogicNotes :notes="preview.logicNotes" :locale="workspace.context.locale" />
        <dl v-if="preview.sixQuestions" class="grid gap-3 sm:grid-cols-2">
          <div v-for="item in SIX_QUESTIONS" :key="item.key" class="rounded bg-surface p-3">
            <dt class="font-semibold">{{ item.title }}</dt>
            <dd class="whitespace-pre-line">
              {{ preview.sixQuestions[item.key] ?? t('notMentioned') }}
            </dd>
          </div>
        </dl>
        <article v-for="item in preview.questions" :key="item.id" class="rounded bg-surface p-3">
          <h3 class="font-semibold">{{ item.text }}</h3>
          <p class="whitespace-pre-line">
            {{
              item.status === 'pending'
                ? workspace.context.locale === 'id'
                  ? 'Menyiapkan jawaban…'
                  : '正在查資料並產生回答…'
                : item.answer
            }}
          </p>
        </article>
      </section>
      <section
        v-if="pages.length"
        aria-labelledby="ocr-review-heading"
        :aria-busy="busy"
        class="space-y-4"
      >
        <h2 id="ocr-review-heading" class="section-title">{{ t('ocrReview') }}</h2>
        <p id="ocr-help" class="text-sm text-muted">{{ t('ocrHint') }}</p>
        <ol class="space-y-4">
          <li
            v-for="(page, index) in pages"
            :key="page.id"
            class="space-y-3 rounded-lg border border-line p-3"
          >
            <img
              :src="page.preview"
              :alt="t('page', { n: index + 1 })"
              class="max-h-64 w-full rounded bg-surface object-contain"
            />
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="min-w-0 break-all text-sm font-semibold">
                {{ index + 1 }}. {{ page.name }}
              </span>
              <div class="flex flex-wrap">
                <button
                  v-if="kind === 'photos'"
                  type="button"
                  class="text-action"
                  :aria-label="t('moveUp', { n: index + 1 })"
                  :disabled="busy || index === 0"
                  @click="movePage(index, -1)"
                >
                  ↑
                </button>
                <button
                  v-if="kind === 'photos'"
                  type="button"
                  class="text-action"
                  :aria-label="t('moveDown', { n: index + 1 })"
                  :disabled="busy || index === pages.length - 1"
                  @click="movePage(index, 1)"
                >
                  ↓
                </button>
                <button
                  v-if="kind === 'photos' || pages.length === 1"
                  type="button"
                  class="text-action"
                  :aria-label="t('removePage', { n: index + 1 })"
                  :disabled="busy"
                  @click="removePage(index)"
                >
                  {{ t('delete') }}
                </button>
              </div>
            </div>
            <button
              v-if="kind === 'photos'"
              :id="`crop-${page.id}`"
              type="button"
              class="action-button"
              :disabled="busy"
              @click="cropPage = page"
            >
              {{ page.cropConfirmed ? '重新調整文件範圍' : '調整並確認文件範圍（尚未確認）' }}
            </button>
            <label :for="`ocr-${page.id}`" class="block text-sm font-semibold">
              {{ t('ocrText', { n: index + 1 }) }}
            </label>
            <textarea
              :id="`ocr-${page.id}`"
              v-model="page.text"
              rows="4"
              class="block w-full resize-y rounded-lg border border-line px-3 py-2"
              :disabled="busy"
              :aria-describedby="page.error ? `ocr-help error-${page.id}` : 'ocr-help'"
              :aria-invalid="page.status === 'error'"
              @input="corrected(page)"
            ></textarea>
            <p v-if="page.error" :id="`error-${page.id}`" role="alert" class="feedback">
              {{ page.error }}
            </p>
          </li>
        </ol>
        <FileAction
          :label="
            t(collectingPhotos ? 'finishCamera' : allReady ? 'correctedSummary' : 'recognize')
          "
          :progress-label="t('processing')"
          primary
          :disabled="busy"
          :progress="workspace.processing?.percent"
          @pick="run"
        />
      </section>
    </template>
    <input
      ref="camera"
      type="file"
      data-kind="camera"
      accept="image/*"
      capture="environment"
      hidden
      @change="handlePhotos($event, true)"
    />
    <input
      ref="photos"
      type="file"
      data-kind="photos"
      accept="image/*"
      multiple
      hidden
      @change="handlePhotos($event)"
    />
    <input
      ref="pdf"
      type="file"
      data-kind="pdf"
      accept="application/pdf,.pdf"
      hidden
      @change="handlePdf"
    />
  </div>
</template>
