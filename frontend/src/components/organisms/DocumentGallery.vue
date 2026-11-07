<script setup lang="ts">
import type { Locale } from '@/interfaces/document';
import { translate } from '@/services/i18n';

defineProps<{ id: string; urls: string[]; locale: Locale }>();
</script>

<template>
  <section aria-labelledby="original-heading">
    <h2 id="original-heading" class="section-title">{{ translate(locale, 'original') }}</h2>
    <div class="mt-3 grid grid-cols-2 gap-3">
      <RouterLink
        v-for="(url, index) in urls"
        :key="url"
        :to="{ name: 'page', params: { id, page: index + 1 } }"
        class="overflow-hidden rounded border border-line text-center text-sm text-muted"
      >
        <img
          :src="url"
          alt=""
          loading="lazy"
          class="aspect-[1/1.414] w-full bg-surface object-contain"
        />
        <span class="block px-2 py-2">{{ translate(locale, 'page', { n: index + 1 }) }}</span>
      </RouterLink>
    </div>
  </section>
</template>
