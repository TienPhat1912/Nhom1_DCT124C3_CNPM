import { useState, useEffect, useCallback } from 'react';
import { Location, LocationCategory } from '../types';
import { locationService } from '../services/api/locationService';

export function useLocations(initialCategory: LocationCategory | 'all' = 'all') {
  const [locations, setLocations] = useState<Location[]>([]);
  const [category, setCategory] = useState<LocationCategory | 'all'>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(
    async (isRefresh: boolean = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await locationService.getLocations({
          category,
          searchQuery,
        });
        setLocations(data);
      } catch (err: any) {
        setError(err.message || 'Không thể tải danh sách địa điểm.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [category, searchQuery]
  );

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const onRefresh = () => {
    fetchLocations(true);
  };

  return {
    locations,
    category,
    setCategory,
    searchQuery,
    setSearchQuery,
    isLoading,
    isRefreshing,
    error,
    refresh: onRefresh,
    retry: () => fetchLocations(false),
  };
}
