<script setup lang="ts">
defineProps<{
  name: 'document' | 'photos' | 'back' | 'close' | 'next' | 'external' | 'chat' | 'refresh' | 'app';
}>();
</script>

<template>
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path
      v-if="name === 'document'"
      d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6v6h6M8 13h8m-8 4h6"
    />
    <path
      v-else-if="name === 'photos'"
      d="M6 3h14a1 1 0 0 1 1 1v13M4 7h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm-2 10 5-5 4 4 2-2 5 5m-5-9h.01"
    />
    <path v-else-if="name === 'back'" d="m15 5-7 7 7 7" />
    <path v-else-if="name === 'next'" d="m9 5 7 7-7 7" />
    <path v-else-if="name === 'close'" d="m6 6 12 12M18 6 6 18" />
    <path
      v-else-if="name === 'external'"
      d="M13 5h6v6m0-6-9 9m7-1v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5"
    />
    <path v-else-if="name === 'chat'" d="M20 12a8 8 0 0 1-8 8H4l1.5-3.5A8 8 0 1 1 20 12Z" />
    <path
      v-else-if="name === 'refresh'"
      d="M20 10a8 8 0 0 0-13-4L4 9m0-5v5h5m-5 5a8 8 0 0 0 13 4l3-3m0 5v-5h-5"
    />
    <path
      v-else
      d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm-2 5h18m-14 4h5m-5 3h8"
    />
  </svg>
</template>
