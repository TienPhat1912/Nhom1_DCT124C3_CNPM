import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, layout } from '../constants';
import { LocationDetailScreenProps } from '../navigation/types';
import { Header, AudioPlayer, LoadingIndicator, ErrorMessage, Button } from '../components';
import { locationService } from '../services/api/locationService';
import { Location, AudioGuide, AudioTrack } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useDistance } from '../hooks/useDistance';

export const LocationDetailScreen: React.FC<LocationDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { locationId } = route.params;
  const { language, t } = useLanguage();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { getFormattedDistanceTo } = useDistance();

  const [location, setLocation] = useState<Location | null>(null);
  const [audioTrack, setAudioTrack] = useState<AudioTrack | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);

  const favorite = location ? isFavorite(location.id) : false;

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loc = await locationService.getLocationById(locationId);
      setLocation(loc);

      const guideData = await locationService.getAudioGuide(locationId, language);
      setAudioTrack(guideData.currentTrack);
    } catch (err: any) {
      setError(err.message || 'Không thể tải thông tin địa điểm.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [locationId, language]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title={t('detail.title')} onBack={() => navigation.goBack()} />
        <LoadingIndicator />
      </View>
    );
  }

  if (error || !location) {
    return (
      <View style={styles.container}>
        <Header title={t('detail.title')} onBack={() => navigation.goBack()} />
        <ErrorMessage message={error || t('common.error')} onRetry={loadData} />
      </View>
    );
  }

  const name = location.name[language] || location.name.vi;
  const desc = location.description[language] || location.description.vi;
  const admissionFee = location.admissionFee ? location.admissionFee[language] || location.admissionFee.vi : null;
  const distance = getFormattedDistanceTo(location.coordinate);

  return (
    <View style={styles.container}>
      <Header
        title={name}
        onBack={() => navigation.goBack()}
        onLanguagePress={() => navigation.navigate('Language')}
        rightAction={{
          icon: favorite ? 'heart' : 'heart-outline',
          onPress: () => toggleFavorite(location.id),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Banner ảnh địa điểm */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: location.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>
                {t(`home.categories.${location.category}`)}
              </Text>
            </View>
            <View style={styles.distanceBadge}>
              <Ionicons name="location-sharp" size={13} color={colors.textInverse} />
              <Text style={styles.distanceText}>{distance}</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.locationTitle}>{name}</Text>

          <View style={styles.metaBox}>
            <View style={styles.metaItem}>
              <Ionicons name="navigate-outline" size={16} color={colors.primary} />
              <Text style={styles.metaText}>{location.address}</Text>
            </View>

            {location.openingHours && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={styles.metaText}>
                  {t('common.openingHours')}: {location.openingHours}
                </Text>
              </View>
            )}

            {admissionFee && (
              <View style={styles.metaItem}>
                <Ionicons name="ticket-outline" size={16} color={colors.primary} />
                <Text style={styles.metaText}>
                  {t('common.admissionFee')}: {admissionFee}
                </Text>
              </View>
            )}
          </View>

          {/* Nút Xem trên bản đồ */}
          <Button
            title={t('common.viewMap')}
            onPress={() => navigation.navigate('Map', { initialLocationId: location.id })}
            variant="outline"
            size="sm"
            icon={<Ionicons name="map-outline" size={18} color={colors.primary} />}
            style={styles.mapButton}
          />

          {/* AUDIO PLAYER REUSABLE COMPONENT */}
          <View style={styles.audioSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('detail.audioGuide')}</Text>
              <View style={styles.langIndicator}>
                <Ionicons name="globe-outline" size={14} color={colors.primary} />
                <Text style={styles.langCodeText}>{language.toUpperCase()}</Text>
              </View>
            </View>

            {audioTrack ? (
              <AudioPlayer
                audioUrl={audioTrack.audioUrl}
                title={audioTrack.title}
                narratorName={audioTrack.narratorName}
              />
            ) : (
              <Text style={styles.noAudioText}>{t('audio.error')}</Text>
            )}

            {/* Transcript Accordion */}
            {audioTrack?.transcriptText && (
              <View style={styles.transcriptCard}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowTranscript(!showTranscript)}
                  style={styles.transcriptHeader}
                >
                  <View style={styles.transcriptTitleRow}>
                    <Ionicons name="document-text-outline" size={18} color={colors.textPrimary} />
                    <Text style={styles.transcriptTitle}>{t('detail.transcript')}</Text>
                  </View>
                  <Ionicons
                    name={showTranscript ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
                {showTranscript && (
                  <Text style={styles.transcriptBody}>{audioTrack.transcriptText}</Text>
                )}
              </View>
            )}
          </View>

          {/* Mô tả chi tiết địa điểm */}
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>{t('detail.overview')}</Text>
            <Text style={styles.descriptionText}>{desc}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroContainer: {
    width: '100%',
    height: 240,
    backgroundColor: colors.surfaceSubtle,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: layout.borderRadius.sm,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
    textTransform: 'uppercase',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: layout.borderRadius.full,
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
  content: {
    padding: layout.spacing.md,
  },
  locationTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.heavy,
    color: colors.textPrimary,
    marginBottom: layout.spacing.sm,
  },
  metaBox: {
    backgroundColor: colors.surface,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    gap: 8,
    marginBottom: layout.spacing.md,
    ...layout.shadows.subtle,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  mapButton: {
    marginBottom: layout.spacing.lg,
  },
  audioSection: {
    marginBottom: layout.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  langIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadius.full,
    gap: 4,
  },
  langCodeText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  noAudioText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginVertical: 12,
  },
  transcriptCard: {
    backgroundColor: colors.surface,
    borderRadius: layout.borderRadius.md,
    padding: layout.spacing.md,
    marginTop: layout.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transcriptTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transcriptTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  transcriptBody: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: layout.spacing.sm,
    paddingTop: layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  descriptionSection: {
    backgroundColor: colors.surface,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    ...layout.shadows.subtle,
  },
  descriptionText: {
    fontSize: typography.sizes.sm + 1,
    color: colors.textSecondary,
    lineHeight: 24,
    marginTop: layout.spacing.sm,
  },
});
