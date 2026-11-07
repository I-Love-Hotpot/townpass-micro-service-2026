import { ref, onMounted } from 'vue';

export interface PRInfo {
  id: number;
  title: string;
  number: number;
  state: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  preview_url?: string;
}

export const usePRList = () => {
  const prList = ref<PRInfo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchPRsFromGitHub = async () => {
    try {
      loading.value = true;
      error.value = null;

      // Get configuration from environment variables or use defaults
      const owner = import.meta.env.VITE_GITHUB_OWNER || 'I-Love-Hotpot';
      const repo = import.meta.env.VITE_GITHUB_REPO || 'townpass-micro-service-2026';
      const token = import.meta.env.VITE_GITHUB_TOKEN;

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=50`,
        { headers }
      );

      if (!response.ok) {
        // More informative error messages
        if (response.status === 404) {
          throw new Error(
            `倉庫未找到: ${owner}/${repo}。請檢查倉庫是否存在或設置正確的環境變數 VITE_GITHUB_OWNER 和 VITE_GITHUB_REPO`
          );
        } else if (response.status === 403) {
          throw new Error(
            `API 限制或無權限訪問。請設置 VITE_GITHUB_TOKEN 環境變數以提高 API 限制`
          );
        }
        throw new Error(`GitHub API 錯誤: ${response.statusText}`);
      }

      const data = await response.json();
      prList.value = data.map((pr: any) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        html_url: pr.html_url,
        preview_url: `${pr.number}.tp.dstw.dev`,
      }));
    } catch (err) {
      error.value = err instanceof Error ? err.message : '無法獲取 PR 列表';
      console.error('Error fetching PRs:', err);
    } finally {
      loading.value = false;
    }
  };

  const handlePRPreviewClick = (prNumber: number) => {
    const previewUrl = `https://${prNumber}.tp.dstw.dev`;
    window.open(previewUrl, '_blank');
  };

  const handleGitHubClick = (htmlUrl: string) => {
    window.open(htmlUrl, '_blank');
  };

  onMounted(() => {
    fetchPRsFromGitHub();
  });

  return {
    prList,
    loading,
    error,
    fetchPRsFromGitHub,
    handlePRPreviewClick,
    handleGitHubClick,
  };
};
