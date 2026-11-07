import { onMounted, ref } from 'vue';
import { fetchPreviewLinks } from './prListApi';

export const usePRList = () => {
  const links = ref<string[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const loadLinks = async () => {
    if (loading.value) return;
    loading.value = true;
    error.value = null;
    try {
      links.value = await fetchPreviewLinks(import.meta.env.VITE_API_BASE_URL || '');
    } catch (err) {
      error.value = err instanceof Error ? err.message : '無法載入預覽列表。';
      console.error('Error fetching preview links:', err);
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    void loadLinks();
  });

  return { links, loading, error, loadLinks };
};
