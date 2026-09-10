import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, layout } from '../constants';
import { SplashScreenProps } from '../navigation/types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        navigation.replace('Home');
      } else {
        navigation.replace('Login');
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [isAuthenticated, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Ionicons name="headset" size={64} color={colors.textInverse} />
      </View>
      <Text style={styles.title}>{t('common.appName')}</Text>
      <Text style={styles.tagline}>{t('common.tagline')}</Text>

      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.playerActive} />
        <Text style={styles.versionText}>v1.0.0 (SE Midterm Demo)</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.spacing.xl,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: layout.spacing.lg,
    ...layout.shadows.floating,
  },
  title: {
    fontSize: typography.sizes.display - 4,
    fontWeight: typography.weights.heavy,
    color: colors.textInverse,
    textAlign: 'center',
    marginBottom: layout.spacing.xs,
  },
  tagline: {
    fontSize: typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  versionText: {
    fontSize: typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 10,
  },
});
