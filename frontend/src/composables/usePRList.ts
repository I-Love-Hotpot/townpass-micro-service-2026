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

      // Using GitHub API to fetch open PRs from the current repository
      const owner = 'I-Love-Hotpot';
      const repo = 'townpass-micro-service-2026';
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=50`
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
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
      error.value = err instanceof Error ? err.message : 'Failed to fetch PRs';
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
