import { useQuery } from '@tanstack/react-query';
import { api, getAuthToken } from '@/lib/api';

/**
 * Hook to get a presigned URL for a screenshot or video artifact.
 * Falls back to appending ?token= for direct access if presigned URL fetch fails.
 */
export function usePresignedUrl(executionId: string | undefined, filename: string | undefined) {
  const { data: presignedUrl } = useQuery({
    queryKey: ['presigned-url', executionId, filename],
    queryFn: async () => {
      if (!executionId || !filename) return null;
      try {
        const result = await api.get<{ url: string }>(`/screenshots/url/${executionId}/${filename}`);
        return result.url;
      } catch {
        // Fallback: direct URL with token
        const token = getAuthToken();
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
        return `${baseUrl}/screenshots/${executionId}/${filename}${token ? `?token=${token}` : ''}`;
      }
    },
    enabled: !!executionId && !!filename,
    staleTime: 4 * 60 * 1000, // 4 minutes (presigned URLs last 1 hour)
    gcTime: 5 * 60 * 1000,
  });

  return presignedUrl;
}

/**
 * Build a screenshot URL with auth token appended.
 * Simpler alternative to presigned URLs for cases where we just need a direct URL.
 */
export function getScreenshotUrl(executionId: string, filename: string): string {
  const token = getAuthToken();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return `${baseUrl}/screenshots/${executionId}/${filename}${token ? `?token=${token}` : ''}`;
}
