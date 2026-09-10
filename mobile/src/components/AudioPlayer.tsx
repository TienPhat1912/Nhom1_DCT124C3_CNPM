import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, layout } from '../constants';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { formatMillisToMinutesSeconds } from '../utils/formatters';
import { useLanguage } from '../contexts/LanguageContext';

interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  narratorName?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  title,
  narratorName,
}) => {
  const { t } = useLanguage();
  const [barWidth, setBarWidth] = useState<number>(0);

  const {
    status,
    positionMillis,
    durationMillis,
    progress,
    isBuffering,
    errorMessage,
    play,
    pause,
    togglePlayPause,
    seekTo,
    seekForward10s,
    seekBackward10s,
  } = useAudioPlayer(audioUrl);

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading' || isBuffering;
  const isError = status === 'error';

  const handleBarLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  const handleSeekPress = (e: GestureResponderEvent) => {
    if (barWidth > 0 && durationMillis > 0) {
      const clickX = e.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(clickX / barWidth, 1));
      seekTo(ratio);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header thông tin bài thuyết minh */}
      <View style={styles.header}>
        <View style={styles.infoCol}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <Text style={styles.title}>{t('detail.audioGuide')}</Text>
          )}
          {narratorName && (
            <Text style={styles.narrator}>
              {t('audio.narrator')}: {narratorName}
            </Text>
          )}
        </View>
        <View style={styles.badge}>
          <Ionicons
            name={isPlaying ? 'volume-high' : 'volume-medium'}
            size={16}
            color={colors.playerActive}
          />
        </View>
      </View>

      {/* Thông báo lỗi nếu xảy ra sự cố */}
      {isError && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={styles.errorText} numberOfLines={1}>
            {errorMessage || t('audio.error')}
          </Text>
          <TouchableOpacity onPress={play} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Thanh tiến trình Progress Bar (Interactive Seek) */}
      <TouchableOpacity
        activeOpacity={1}
        onLayout={handleBarLayout}
        onPress={handleSeekPress}
        style={styles.progressBarTouchArea}
      >
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.round(progress * 100)}%` },
            ]}
          />
          {/* Nút tròn chỉ vị trí (Thumb) */}
          <View
            style={[
              styles.progressThumb,
              { left: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>
      </TouchableOpacity>

      {/* Hiển thị thời gian (Current Time / Total Duration) */}
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>
          {formatMillisToMinutesSeconds(positionMillis)}
        </Text>
        <Text style={styles.timeText}>
          {formatMillisToMinutesSeconds(durationMillis)}
        </Text>
      </View>

      {/* Điều khiển phát nhạc: Tua lùi 10s, Play/Pause, Tua tới 10s */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={seekBackward10s}
          disabled={isLoading || isError}
          style={styles.seekButton}
          accessibilityLabel={t('audio.seekBackward')}
        >
          <Ionicons name="play-back" size={24} color={colors.playerText} />
          <Text style={styles.seekLabel}>-10s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={togglePlayPause}
          disabled={isError}
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          accessibilityLabel={isPlaying ? t('audio.paused') : t('audio.playing')}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.playerBackground} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              color={colors.playerBackground}
              style={!isPlaying ? { marginLeft: 3 } : undefined}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={seekForward10s}
          disabled={isLoading || isError}
          style={styles.seekButton}
          accessibilityLabel={t('audio.seekForward')}
        >
          <Ionicons name="play-forward" size={24} color={colors.playerText} />
          <Text style={styles.seekLabel}>+10s</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.playerBackground,
    borderRadius: layout.borderRadius.xl,
    padding: layout.spacing.lg,
    marginVertical: layout.spacing.sm,
    ...layout.shadows.floating,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: layout.spacing.md,
  },
  infoCol: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.playerText,
  },
  narrator: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    padding: 6,
    borderRadius: layout.borderRadius.full,
    backgroundColor: colors.playerSurface,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: layout.borderRadius.sm,
    marginBottom: layout.spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.errorLight,
    flex: 1,
    marginLeft: 6,
  },
  retryButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  retryText: {
    fontSize: typography.sizes.xs,
    color: colors.playerActive,
    fontWeight: typography.weights.bold,
  },
  progressBarTouchArea: {
    paddingVertical: 8,
    justifyContent: 'center',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: colors.playerTrack,
    borderRadius: 3,
    position: 'relative',
    overflow: 'visible',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.playerActive,
    borderRadius: 3,
  },
  progressThumb: {
    position: 'absolute',
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.textInverse,
    marginLeft: -7,
    ...layout.shadows.subtle,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: layout.spacing.sm,
  },
  timeText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginTop: 4,
  },
  seekButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  seekLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  playButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.playerActive,
    alignItems: 'center',
    justifyContent: 'center',
    ...layout.shadows.card,
  },
  playButtonActive: {
    backgroundColor: colors.textInverse,
  },
});
