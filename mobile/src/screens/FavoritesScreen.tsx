import React, { useMemo } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { colors, layout } from '../constants';
import { FavoritesScreenProps } from '../navigation/types';
import { Header, LocationCard, EmptyState, LoadingIndicator } from '../components';
import { useLanguage } from '../contexts/LanguageContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useLocations, useDistance } from '../hooks';
import { Location } from '../types';

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ navigation }) => {
  const { t } = useLanguage();
  const { favorites, isLoading: isFavLoading } = useFavorites();
  const { locations, isLoading: isLocLoading } = useLocations();
  const { getDistanceTo } = useDistance();

  const favoriteLocations = useMemo(() => {
    return locations.filter((loc) => favorites.includes(loc.id));
  }, [locations, favorites]);

  const isLoading = isFavLoading || isLocLoading;

  return (
    <View style={styles.container}>
      <Header
        title={t('favorites.title')}
        subtitle={`${favoriteLocations.length} ${t('favorites.count')}`}
        onBack={() => navigation.goBack()}
        onLanguagePress={() => navigation.navigate('Language')}
      />

      {isLoading ? (
        <LoadingIndicator />
      ) : (
        <FlatList
          data={favoriteLocations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }: { item: Location }) => {
            const distance = getDistanceTo(item.coordinate);
            return (
              <LocationCard
                location={item}
                distanceMeters={distance}
                onPress={() =>
                  navigation.navigate('LocationDetail', { locationId: item.id })
                }
              />
            );
          }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              iconName="heart-dislike-outline"
              title={t('favorites.title')}
              message={t('home.emptyFavorites')}
              actionText={t('home.title')}
              onAction={() => navigation.navigate('Home')}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: layout.spacing.md,
    flexGrow: 1,
  },
});
