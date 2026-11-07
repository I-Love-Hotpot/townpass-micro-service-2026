<script setup lang="ts">
import { usePRList } from '@/composables/usePRList';

const { links, loading, error, loadLinks } = usePRList();
</script>

<template>
  <main class="min-h-screen bg-gray-50 px-4 py-10">
    <div class="mx-auto max-w-3xl">
      <h1 class="text-3xl font-bold text-gray-900">TownPass 預覽選單</h1>
      <p class="mt-2 text-gray-600">選擇正式環境或開啟中的 PR 預覽環境。</p>

      <a
        href="https://tp.dstw.dev"
        class="mt-8 block rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-400 hover:shadow-md"
      >
        <span class="block font-semibold text-blue-700">正式環境</span>
        <span class="mt-1 block break-all text-sm text-gray-600">https://tp.dstw.dev</span>
      </a>

      <p v-if="loading" class="mt-4 text-gray-600" role="status">正在載入預覽列表...</p>
      <div
        v-else-if="error"
        class="mt-8 rounded-lg border border-red-200 bg-red-50 p-4"
        role="alert"
      >
        <p class="font-semibold text-red-900">載入失敗</p>
        <p class="mt-1 text-red-700">{{ error }}</p>
        <button class="mt-3 rounded-lg bg-red-600 px-4 py-2 text-white" @click="loadLinks">
          重新載入
        </button>
      </div>
      <ul v-else class="mt-3 space-y-3">
        <li v-for="link in links.filter((url) => url !== 'https://tp.dstw.dev')" :key="link">
          <a
            :href="link"
            class="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-400 hover:shadow-md"
          >
            <span class="block font-semibold text-blue-700">
              {{ `PR #${link.match(/pr-(\d+)/)?.[1]}` }}
            </span>
            <span class="mt-1 block break-all text-sm text-gray-600">{{ link }}</span>
          </a>
        </li>
      </ul>
      <p class="mt-6 text-sm text-gray-500">PR 已開啟不代表預覽環境已完成部署。</p>
    </div>
  </main>
</template>
