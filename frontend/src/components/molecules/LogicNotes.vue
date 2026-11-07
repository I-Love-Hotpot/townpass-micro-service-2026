<script setup lang="ts">
import type { Locale } from '@/interfaces/document';
import type { LogicNote } from '@/services/govclearRag';
import { translate } from '@/services/i18n';

defineProps<{ notes?: LogicNote[]; locale: Locale }>();
</script>

<template>
  <aside v-if="notes?.length" class="space-y-2 rounded bg-brand-light p-4">
    <h3 class="font-semibold">{{ translate(locale, 'logicNotice') }}</h3>
    <p class="text-sm">{{ translate(locale, 'logicHint') }}</p>
    <div v-for="(note, index) in notes" :key="index" class="space-y-1">
      <p>{{ note.text }}</p>
      <blockquote class="text-sm text-muted">{{ note.quote }}</blockquote>
    </div>
  </aside>
</template>
