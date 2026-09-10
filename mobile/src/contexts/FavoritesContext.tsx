import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { locationService } from '../services/api/locationService';

interface FavoritesContextType {
  favorites: string[];
  isFavorite: (locationId: string) => boolean;
  toggleFavorite: (locationId: string) => Promise<void>;
  isLoading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<string[]>(['loc-001']);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    locationService
      .getFavorites()
      .then((ids) => {
        if (isMounted) setFavorites(ids);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const isFavorite = (locationId: string): boolean => {
    return favorites.includes(locationId);
  };

  const toggleFavorite = async (locationId: string) => {
    // Cập nhật optimistic UI
    const wasFavorite = favorites.includes(locationId);
    if (wasFavorite) {
      setFavorites((prev) => prev.filter((id) => id !== locationId));
    } else {
      setFavorites((prev) => [...prev, locationId]);
    }

    try {
      await locationService.toggleFavorite(locationId);
    } catch (err) {
      // Revert nếu có lỗi
      if (wasFavorite) {
        setFavorites((prev) => [...prev, locationId]);
      } else {
        setFavorites((prev) => prev.filter((id) => id !== locationId));
      }
    }
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        isFavorite,
        toggleFavorite,
        isLoading,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = (): FavoritesContextType => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites phải được sử dụng bên trong FavoritesProvider');
  }
  return context;
};
