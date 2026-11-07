<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import AppIcon from '@/components/atoms/AppIcon.vue';
import FileAction from '@/components/molecules/FileAction.vue';
import type { FileKind } from '@/interfaces/document';
import { makeDocument } from '@/services/catalog';
import { validateFiles } from '@/services/files';
import { translate, type Label } from '@/services/i18n';
import { delay, processWithProgress } from '@/services/processing';
import { records } from '@/services/records';
import { useWorkspace } from '@/stores/workspace';

const workspace = useWorkspace();
const router = useRouter();
const t = computed(() => translate.bind(null, workspace.context.locale));
const photos = ref<HTMLInputElement>();
const pdf = ref<HTMLInputElement>();
const error = ref<Label>();
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

function pick(kind: FileKind) {
  const input = kind === 'photos' ? photos.value : pdf.value;
  if (!input || controller || workspace.dataOperation) return;
  input.value = '';
  input.click();
}

function cancel() {
  controller?.abort();
  controller = undefined;
  workspace.processing = undefined;
}

onBeforeRouteLeave(cancel);
onBeforeUnmount(cancel);

async function handleFiles(event: Event, kind: FileKind) {
  const files = Array.from((event.target as HTMLInputElement).files ?? []);
  if (!files.length || controller || workspace.dataOperation) return;
  error.value = undefined;
  const current = new AbortController();
  const { signal } = current;
  const fileError = kind === 'pdf' ? 'pdfError' : 'photoError';
  let failedAt: Label = fileError;
  try {
    validateFiles(files, kind);
    controller = current;
    const record = await processWithProgress(
      () =>
        makeDocument(
          files.map((file) => ({ name: file.name, blob: file })),
          kind,
          workspace.context.locale,
          signal
        ),
      async (document) => {
        failedAt = 'saveError';
        await records.put(document, signal);
      },
      (percent) => {
        workspace.processing = { kind, percent };
      },
      signal
    );
    await delay(300, signal);
    await router.push({ name: 'document', params: { id: record.id } });
  } catch {
    if (!signal.aborted) error.value = failedAt;
  } finally {
    if (controller === current) cancel();
  }
}
</script>

<template>
  <div class="grid min-h-full grid-rows-[minmax(240px,2fr)_minmax(160px,1fr)]">
    <section class="flex flex-col items-center justify-center gap-4 px-6 py-8 text-center">
      <button
        type="button"
        class="grid h-[72px] w-[72px] place-items-center rounded-2xl bg-brand-light text-brand-dark"
        :aria-label="t('app')"
        :disabled="Boolean(workspace.processing || workspace.dataOperation)"
        @click="tapHomeIcon"
      >
        <AppIcon name="document" class="h-9 w-9" />
      </button>
      <h1 class="page-title">{{ t('hero1') }}<br />{{ t('hero2') }}</h1>
      <p class="text-sm text-muted">{{ t('intro') }}</p>
    </section>
    <section
      class="flex flex-col justify-end gap-3 px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]"
    >
      <FileAction
        v-for="kind in ['photos', 'pdf'] as const"
        :key="kind"
        :label="t(kind)"
        :progress-label="t('processing')"
        :primary="kind === 'photos'"
        :disabled="Boolean(workspace.processing || workspace.dataOperation)"
        :progress="workspace.processing?.kind === kind ? workspace.processing.percent : undefined"
        @pick="pick(kind)"
      />
      <Transition name="feedback">
        <p v-if="error" class="feedback" role="alert">{{ t(error) }}</p>
      </Transition>
      <input
        ref="photos"
        type="file"
        data-kind="photos"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        multiple
        hidden
        @change="handleFiles($event, 'photos')"
      />
      <input
        ref="pdf"
        type="file"
        data-kind="pdf"
        accept="application/pdf,.pdf"
        hidden
        @change="handleFiles($event, 'pdf')"
      />
    </section>
  </div>
</template>
