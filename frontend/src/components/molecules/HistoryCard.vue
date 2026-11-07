<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/atoms/AppIcon.vue';
import type { Locale, RecordCard } from '@/interfaces/document';
import { translate } from '@/services/i18n';

const props = defineProps<{ card: RecordCard; locale: Locale }>();
defineEmits<{ remove: [] }>();
const t = computed(() => translate.bind(null, props.locale));
const date = computed(() =>
  new Intl.DateTimeFormat(props.locale, {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(props.card.createdAt)
);
</script>

<template>
  <article class="overflow-hidden rounded bg-white shadow-[0_4px_12px_#0000000a]">
    <RouterLink
      :to="{ name: 'document', params: { id: card.id } }"
      class="block space-y-3 px-4 pt-4 pb-3"
    >
      <div class="flex items-start gap-2 text-brand-dark">
        <AppIcon name="document" class="mt-0.5 h-5 w-5 shrink-0" />
        <h2 class="min-w-0 flex-1 break-words font-semibold text-ink">{{ card.summary.title }}</h2>
        <AppIcon name="next" class="h-5 w-5 shrink-0" />
      </div>
      <p class="break-words text-sm leading-5 text-muted">{{ card.summary.action }}</p>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
        <span>
          {{ t(card.kind === 'pdf' ? 'pdfCount' : 'imageCount', { n: card.pageCount }) }} ·
          {{ date }}
        </span>
        <span
          v-if="card.status"
          class="rounded px-2 py-0.5 font-semibold"
          :class="
            card.status === 'due-soon'
              ? 'bg-[#FDF8ED] text-[#74521B]'
              : 'bg-brand-light text-brand-dark'
          "
        >
          {{ t(card.status === 'due-soon' ? 'due' : 'completed') }}
        </span>
        <span v-if="card.scenarioDate">
          {{ t('scenario', { date: card.scenarioDate.split('-').join('/') }) }}
        </span>
      </div>
    </RouterLink>
    <div class="flex justify-end border-t border-line px-2">
      <button type="button" class="text-action !text-red-800" @click="$emit('remove')">
        {{ t('delete') }}
      </button>
    </div>
  </article>
</template>
