import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Location } from '../types';
import { colors, typography, layout } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { formatDistance } from '../utils/geoUtils';

interface LocationCardProps {
  location: Location;
  distanceMeters?: number;
  onPress: () => void;
}

export const LocationCard: React.FC<LocationCardProps> = ({
  location,
  distanceMeters,
  onPress,
}) => {
  const { language, t } = useLanguage();
  const { isFavorite, toggleFavorite } = useFavorites();

  const favorite = isFavorite(location.id);
  const name = location.name[language] || location.name.vi;
  const shortDesc = location.shortDescription[language] || location.shortDescription.vi;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: location.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.badgeRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {t(`home.categories.${location.category}`)}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => toggleFavorite(location.id)}
            style={styles.favoriteButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={favorite ? colors.error : colors.textInverse}
            />
          </TouchableOpacity>
        </View>

        {distanceMeters !== undefined && (
          <View style={styles.distanceBadge}>
            <Ionicons name="location-sharp" size={12} color={colors.textInverse} />
            <Text style={styles.distanceText}>{formatDistance(distanceMeters)}</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.audioIndicator}>
            <Ionicons name="headset" size={14} color={colors.primary} />
          </View>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {shortDesc}
        </Text>

        <View style={styles.addressRow}>
          <Ionicons name="navigate-outline" size={13} color={colors.textMuted} />
          <Text style={styles.addressText} numberOfLines={1}>
            {location.address}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: layout.borderRadius.lg,
    marginBottom: layout.spacing.md,
    overflow: 'hidden',
    ...layout.shadows.card,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: colors.surfaceSubtle,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badgeRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: layout.borderRadius.sm,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
    textTransform: 'uppercase',
  },
  favoriteButton: {
    width: 34,
    height: 34,
    borderRadius: layout.borderRadius.full,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 64, 175, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadius.full,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
    marginLeft: 3,
  },
  content: {
    padding: layout.spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: typography.sizes.md + 1,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  audioIndicator: {
    backgroundColor: colors.infoLight,
    padding: 5,
    borderRadius: layout.borderRadius.full,
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginLeft: 4,
    flex: 1,
  },
});
