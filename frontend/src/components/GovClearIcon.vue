<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 });
const paths: Record<string, string[]> = {
  up: ['m6 15 6-6 6 6'],
  down: ['m6 9 6 6 6-6'],
  remove: ['m6 6 12 12M18 6 6 18'],
  book: ['M3 3v16h7l2 2 2-2h7V3h-7l-2 2-2-2H3Z', 'M12 5v16'],
  text: ['M4 6h16M4 12h16M4 18h10'],
  scan: ['M7 3H3v4m14-4h4v4M3 17v4h4m10 0h4v-4', 'M7 7h10v10H7zM10 10h4m-4 4h4'],
  photo: ['M4 5h16v14H4z', 'm4 16 5-5 4 4 3-3 4 4', 'M15 9h.01'],
  check: ['M22 11v1a10 10 0 1 1-6-9', 'm8 11 4 4L22 5'],
  refresh: ['M20 7a9 9 0 1 0 1 9', 'M20 2v6h-6'],
  spark: ['m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z'],
  shield: ['m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z', 'm8 12 3 3 5-6'],
  copy: ['M9 9h12v12H9z', 'M15 5V3H3v12h2'],
  chevron: ['m8 5 7 7-7 7'],
  leaf: ['M12 21V11', 'M12 17C5 17 2 12 3 8c5 0 9 3 9 9Z', 'M12 14c7 0 10-5 9-9-5 0-9 3-9 9Z']
};
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in paths[name] || paths.text" :key="i" :d="d" />
  </svg>
</template>
