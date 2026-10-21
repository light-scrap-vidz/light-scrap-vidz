import { fetchPlaylistInfo } from '@/lib/tauri-commands';
import type { PlaylistInfo } from '@/types';
import { useFetchInfo, type UseFetchInfoReturn } from './useFetchInfo';

export function usePlaylistInfo(): UseFetchInfoReturn<PlaylistInfo> {
  return useFetchInfo(fetchPlaylistInfo);
}
