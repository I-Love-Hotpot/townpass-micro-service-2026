<script setup lang="ts">
import AppIcon from '@/components/atoms/AppIcon.vue';

defineProps<{
  label: string;
  progressLabel: string;
  primary?: boolean;
  disabled?: boolean;
  progress?: number;
}>();
defineEmits<{ pick: [] }>();
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="action-button w-full"
      :class="{
        'action-primary': primary,
        'text-transparent': progress !== undefined
      }"
      :disabled="disabled"
      @click="$emit('pick')"
    >
      <AppIcon :name="primary ? 'photos' : 'document'" />
      {{ label }}
    </button>
    <div
      v-if="progress !== undefined"
      class="pointer-events-none absolute inset-0 grid grid-cols-[1fr_3rem] items-center gap-3 rounded-lg border border-brand/40 bg-brand-light px-4"
      role="progressbar"
      :aria-label="progressLabel"
      :aria-valuenow="progress"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="h-2 overflow-hidden rounded-full bg-brand/25">
        <div
          class="h-full rounded-full bg-brand-dark transition-[width] duration-150 motion-reduce:transition-none"
          :style="{ width: progress + '%' }"
        ></div>
      </div>
      <span class="text-right font-semibold tabular-nums text-brand-dark">{{ progress }}%</span>
    </div>
  </div>
</template>
