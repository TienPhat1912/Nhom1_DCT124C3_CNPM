import { APP_CONFIG } from '../../constants';
import { mockService } from '../mockService';
import { apiClient } from './apiClient';
import { Location, LocationFilter, AudioGuide, AudioTrack, LanguageCode } from '../../types';

export const locationService = {
  async getLocations(filter?: LocationFilter): Promise<Location[]> {
    if (APP_CONFIG.USE_MOCK_API) {
      const res = await mockService.getLocations(filter);
      return res.data;
    }
    const query = new URLSearchParams();
    if (filter?.category && filter.category !== 'all') query.append('category', filter.category);
    if (filter?.searchQuery) query.append('q', filter.searchQuery);
    const res = await apiClient.get<Location[]>(`/locations?${query.toString()}`);
    return res.data;
  },

  async getLocationById(id: string): Promise<Location> {
    if (APP_CONFIG.USE_MOCK_API) {
      const res = await mockService.getLocationById(id);
      return res.data;
    }
    const res = await apiClient.get<Location>(`/locations/${id}`);
    return res.data;
  },

  async getAudioGuide(
    locationId: string,
    language: LanguageCode = 'vi'
  ): Promise<{ audioGuide: AudioGuide; currentTrack: AudioTrack }> {
    if (APP_CONFIG.USE_MOCK_API) {
      const res = await mockService.getAudioGuide(locationId, language);
      return res.data;
    }
    const res = await apiClient.get<{ audioGuide: AudioGuide; currentTrack: AudioTrack }>(
      `/locations/${locationId}/audio?lang=${language}`
    );
    return res.data;
  },

  async toggleFavorite(locationId: string): Promise<boolean> {
    if (APP_CONFIG.USE_MOCK_API) {
      const res = await mockService.toggleFavorite(locationId);
      return res.data.isFavorite;
    }
    const res = await apiClient.post<{ isFavorite: boolean }>(`/favorites/toggle`, {
      locationId,
    });
    return res.data.isFavorite;
  },

  async getFavorites(): Promise<string[]> {
    if (APP_CONFIG.USE_MOCK_API) {
      const res = await mockService.getFavorites();
      return res.data;
    }
    const res = await apiClient.get<string[]>(`/favorites`);
    return res.data;
  },
};
