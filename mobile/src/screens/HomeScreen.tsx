import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, layout } from '../constants';
import { HomeScreenProps } from '../navigation/types';
import {
  Header,
  SearchBar,
  LocationCard,
  LoadingIndicator,
  ErrorMessage,
  EmptyState,
} from '../components';
import { useLocations, useDistance } from '../hooks';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Location } from '../types';

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { getDistanceTo } = useDistance();

  const {
    locations,
    category,
    setCategory,
    searchQuery,
    setSearchQuery,
    isLoading,
    isRefreshing,
    error,
    refresh,
    retry,
  } = useLocations();

  const featuredLocations = locations.filter((loc) => loc.isFeatured);

  const renderHeaderComponent = () => {
    return (
      <View>
        <SearchBar
          query={searchQuery}
          onChangeQuery={setSearchQuery}
          selectedCategory={category}
          onSelectCategory={setCategory}
        />

        {/* Featured carousel (chỉ hiện khi không tìm kiếm và đang ở tab All) */}
        {!searchQuery && category === 'all' && featuredLocations.length > 0 && (
          <View style={styles.featuredSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('home.featured')}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredScroll}
            >
              {featuredLocations.map((loc) => {
                const name = loc.name[language] || loc.name.vi;
                const distance = getDistanceTo(loc.coordinate);
                return (
                  <TouchableOpacity
                    key={loc.id}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('LocationDetail', { locationId: loc.id })}
                    style={styles.featuredCard}
                  >
                    <Image source={{ uri: loc.imageUrl }} style={styles.featuredImage} />
                    <View style={styles.featuredGradient}>
                      <Text style={styles.featuredName} numberOfLines={1}>
                        {name}
                      </Text>
                      <View style={styles.featuredMeta}>
                        <Ionicons name="headset" size={12} color={colors.playerActive} />
                        <Text style={styles.featuredMetaText}>Audio Guide</Text>
                        <Text style={styles.featuredMetaDot}>•</Text>
                        <Text style={styles.featuredMetaText}>{distance}m</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>
            {searchQuery ? t('common.search') : t('home.allLocations')} ({locations.length})
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('common.appName')}
        subtitle={user ? `${t('home.welcome')}, ${user.name}` : undefined}
        onLanguagePress={() => navigation.navigate('Language')}
        rightAction={{
          icon: 'map-outline',
          onPress: () => navigation.navigate('Map'),
        }}
      />

      {isLoading && !isRefreshing ? (
        <LoadingIndicator />
      ) : error ? (
        <ErrorMessage message={error} onRetry={retry} />
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeaderComponent}
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
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={t('common.noData')}
              message={t('home.emptySearch')}
              actionText={t('common.retry')}
              onAction={() => {
                setSearchQuery('');
                setCategory('all');
              }}
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
  listContent: {
    padding: layout.spacing.md,
    paddingTop: 0,
  },
  featuredSection: {
    marginTop: layout.spacing.sm,
    marginBottom: layout.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  featuredScroll: {
    gap: 12,
    paddingRight: layout.spacing.md,
  },
  featuredCard: {
    width: 240,
    height: 140,
    borderRadius: layout.borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surfaceSubtle,
    ...layout.shadows.card,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  featuredName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  featuredMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  featuredMetaText: {
    fontSize: 10,
    color: colors.textInverse,
  },
  featuredMetaDot: {
    fontSize: 10,
    color: colors.textMuted,
  },
  listHeaderRow: {
    marginTop: layout.spacing.sm,
    marginBottom: layout.spacing.sm,
  },
});
