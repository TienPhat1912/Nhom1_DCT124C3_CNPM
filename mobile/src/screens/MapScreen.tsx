import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, layout, APP_CONFIG } from '../constants';
import { MapScreenProps } from '../navigation/types';
import { Header, Button } from '../components';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocations, useDistance } from '../hooks';
import { Location, Coordinate } from '../types';

export const MapScreen: React.FC<MapScreenProps> = ({ navigation }) => {
  const { language, t } = useLanguage();
  const { locations } = useLocations();
  const {
    userCoord,
    setUserCoord,
    getDistanceTo,
    getFormattedDistanceTo,
    checkGeofenceTrigger,
  } = useDistance();

  // Giả lập kích hoạt geofence tự động
  const [triggeredLocation, setTriggeredLocation] = useState<Location | null>(null);

  const handleSimulateApproach = (loc: Location) => {
    // Di chuyển toạ độ người dùng tới gần địa điểm này (cách 20 mét)
    const newCoord: Coordinate = {
      latitude: loc.coordinate.latitude + 0.0001,
      longitude: loc.coordinate.longitude + 0.0001,
    };
    setUserCoord(newCoord);
    setTriggeredLocation(loc);
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('map.title')}
        onBack={() => navigation.goBack()}
        onLanguagePress={() => navigation.navigate('Language')}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Banner thông báo kiến trúc GPS chuẩn bị cho Tuần 8 */}
        <View style={styles.gpsBanner}>
          <Ionicons name="navigate" size={24} color={colors.primary} />
          <View style={styles.gpsBannerText}>
            <Text style={styles.gpsBannerTitle}>{t('map.userLocation')}</Text>
            <Text style={styles.gpsCoords}>
              {userCoord.latitude.toFixed(5)}, {userCoord.longitude.toFixed(5)} (Quận 1, TP.HCM)
            </Text>
            <Text style={styles.gpsNotice}>{t('map.autoTriggerNotice')}</Text>
          </View>
        </View>

        {/* Thông báo Geofence Trigger khi người dùng ở gần */}
        {triggeredLocation && (
          <View style={styles.triggerAlert}>
            <View style={styles.triggerHeader}>
              <Ionicons name="volume-high" size={20} color={colors.success} />
              <Text style={styles.triggerTitle}>
                {t('detail.audioGuide')}: {triggeredLocation.name[language] || triggeredLocation.name.vi}
              </Text>
            </View>
            <Text style={styles.triggerMessage}>
              Phát hiện bạn đang ở trong bán kính {APP_CONFIG.GPS.AUTO_TRIGGER_RADIUS_METERS}m. Thuyết minh ngôn ngữ [{language.toUpperCase()}] sẵn sàng phát!
            </Text>
            <Button
              title="Nghe thuyết minh ngay"
              onPress={() =>
                navigation.navigate('LocationDetail', { locationId: triggeredLocation.id })
              }
              variant="primary"
              size="sm"
              style={styles.triggerButton}
            />
          </View>
        )}

        <Text style={styles.sectionHeading}>
          Danh sách địa điểm & Khoảng cách thực tế
        </Text>

        {locations.map((loc) => {
          const name = loc.name[language] || loc.name.vi;
          const distance = getDistanceTo(loc.coordinate);
          const isNearby = checkGeofenceTrigger(loc.coordinate);

          return (
            <View
              key={loc.id}
              style={[styles.markerCard, isNearby && styles.markerCardNearby]}
            >
              <View style={styles.markerInfo}>
                <View style={styles.markerTitleRow}>
                  <Text style={styles.markerTitle} numberOfLines={1}>
                    {name}
                  </Text>
                  {isNearby && (
                    <View style={styles.nearbyBadge}>
                      <Text style={styles.nearbyText}>Đang ở gần</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.markerAddress} numberOfLines={1}>
                  {loc.address}
                </Text>
                <Text style={styles.markerDistance}>
                  {t('map.distanceTo')}:{' '}
                  <Text style={styles.distanceHighlight}>
                    {getFormattedDistanceTo(loc.coordinate)}
                  </Text>
                </Text>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleSimulateApproach(loc)}
                  style={styles.simulateButton}
                >
                  <Ionicons name="walk-outline" size={14} color={colors.primary} />
                  <Text style={styles.simulateText}>Đến gần</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('LocationDetail', { locationId: loc.id })
                  }
                  style={styles.detailButton}
                >
                  <Ionicons name="headset-outline" size={14} color={colors.textInverse} />
                  <Text style={styles.detailButtonText}>Chi tiết</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: layout.spacing.md,
    paddingBottom: 40,
  },
  gpsBanner: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: layout.spacing.md,
    gap: 12,
    ...layout.shadows.subtle,
  },
  gpsBannerText: {
    flex: 1,
  },
  gpsBannerTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  gpsCoords: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    marginVertical: 2,
  },
  gpsNotice: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  triggerAlert: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: layout.borderRadius.lg,
    padding: layout.spacing.md,
    marginBottom: layout.spacing.lg,
  },
  triggerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  triggerTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.success,
    flex: 1,
  },
  triggerMessage: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  triggerButton: {
    backgroundColor: colors.success,
  },
  sectionHeading: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: layout.spacing.sm,
  },
  markerCard: {
    backgroundColor: colors.surface,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    marginBottom: layout.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...layout.shadows.subtle,
  },
  markerCardNearby: {
    borderColor: colors.success,
    backgroundColor: '#F0FDF4',
  },
  markerInfo: {
    marginBottom: layout.spacing.sm,
  },
  markerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  markerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  nearbyBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: layout.borderRadius.full,
  },
  nearbyText: {
    fontSize: 10,
    color: colors.textInverse,
    fontWeight: typography.weights.bold,
  },
  markerAddress: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  markerDistance: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  distanceHighlight: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  simulateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: layout.borderRadius.sm,
    gap: 4,
  },
  simulateText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: layout.borderRadius.sm,
    gap: 4,
  },
  detailButtonText: {
    fontSize: 12,
    color: colors.textInverse,
    fontWeight: typography.weights.medium,
  },
});
