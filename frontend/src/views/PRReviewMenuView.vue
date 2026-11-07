<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { usePRList } from '@/composables/usePRList';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';

const { prList, loading, error, handlePRPreviewClick, handleGitHubClick } = usePRList();

const formatTime = (dateString: string) => {
  try {
    return formatDistanceToNow(new Date(dateString), { locale: zhTW, addSuffix: true });
  } catch {
    return dateString;
  }
};

const getStatusBadgeClass = (state: string) => {
  return state === 'open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
};

const getStatusText = (state: string) => {
  return state === 'open' ? '開啟' : '已關閉';
};
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <RouterLink to="/" class="text-2xl font-bold text-gray-900 hover:text-gray-700">
              ← 返回首頁
            </RouterLink>
            <h1 class="text-2xl font-bold text-gray-900 mt-2">PR 預覽選單</h1>
            <p class="text-gray-600 mt-1">查看及預覽所有開啟的 Pull Request</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block">
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"
          ></div>
          <p class="text-gray-600 mt-4">正在載入 PR 列表...</p>
        </div>
      </div>

      <!-- Error State -->
      <div
        v-if="error && !loading"
        class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"
      >
        <h3 class="text-red-900 font-semibold mb-2">載入失敗</h3>
        <p class="text-red-700">{{ error }}</p>
        <button
          @click="$router.go(0)"
          class="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          重新載入
        </button>
      </div>

      <!-- Empty State -->
      <div v-if="!loading && !error && prList.length === 0" class="text-center py-12">
        <div class="text-gray-400 text-6xl mb-4">🎉</div>
        <p class="text-gray-600 text-lg">目前沒有開啟的 PR</p>
        <p class="text-gray-500 text-sm mt-2">所有 PR 都已經合併或關閉</p>
      </div>

      <!-- PR List -->
      <div v-if="!loading && !error && prList.length > 0" class="space-y-4">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p class="text-blue-900 text-sm">
            <strong>共 {{ prList.length }} 個開啟的 PR</strong> - 點擊 "預覽" 按鈕查看部署預覽，點擊 PR 標題前往 GitHub
          </p>
        </div>

        <div class="grid gap-4">
          <div
            v-for="pr in prList"
            :key="pr.id"
            class="bg-white rounded-lg shadow-sm hover:shadow-md transition border border-gray-200 overflow-hidden"
          >
            <div class="p-6">
              <!-- PR Header -->
              <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <span
                      :class="['inline-block px-3 py-1 rounded-full text-xs font-semibold', getStatusBadgeClass(pr.state)]"
                    >
                      {{ getStatusText(pr.state) }}
                    </span>
                    <span class="text-gray-500 text-sm font-mono">#{{ pr.number }}</span>
                  </div>
                  <button
                    @click="handleGitHubClick(pr.html_url)"
                    class="text-xl font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left"
                  >
                    {{ pr.title }}
                  </button>
                </div>
              </div>

              <!-- PR Metadata -->
              <div class="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-600 mb-4">
                <div class="flex items-center gap-4">
                  <span>建立於 {{ formatTime(pr.created_at) }}</span>
                  <span v-if="pr.updated_at !== pr.created_at">更新於 {{ formatTime(pr.updated_at) }}</span>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex flex-col sm:flex-row gap-3">
                <button
                  @click="handlePRPreviewClick(pr.number)"
                  class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  🔍 預覽 PR ({{ pr.number }}.tp.dstw.dev)
                </button>
                <button
                  @click="handleGitHubClick(pr.html_url)"
                  class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  📖 查看 GitHub PR
                </button>
              </div>

              <!-- Additional Info -->
              <div class="mt-4 pt-4 border-t border-gray-200">
                <p class="text-xs text-gray-500">
                  預覽URL: <code class="bg-gray-100 px-2 py-1 rounded">{{ pr.preview_url }}</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="bg-white border-t border-gray-200 mt-12">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <p class="text-center text-gray-600 text-sm">
          此頁面用於開發測試，自動從 GitHub API 獲取最新的開啟 PR
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
code {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
}
</style>
