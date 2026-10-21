import { fetchVideoInfo } from '@/lib/tauri-commands';
import type { VideoInfo } from '@/types';
import { useFetchInfo, type UseFetchInfoReturn } from './useFetchInfo';

export function useVideoInfo(): UseFetchInfoReturn<VideoInfo> {
  return useFetchInfo(fetchVideoInfo);
}
