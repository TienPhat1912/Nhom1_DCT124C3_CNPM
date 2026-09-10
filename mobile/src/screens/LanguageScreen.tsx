import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, layout } from '../constants';
import { LanguageScreenProps } from '../navigation/types';
import { Header } from '../components';
import { useLanguage } from '../contexts/LanguageContext';
import { Language, LanguageCode } from '../types';

export const LanguageScreen: React.FC<LanguageScreenProps> = ({ navigation }) => {
  const { language, setLanguage, supportedLanguages, t } = useLanguage();

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
    setTimeout(() => {
      navigation.goBack();
    }, 200);
  };

  const renderItem = ({ item }: { item: Language }) => {
    const isSelected = item.code === language;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleSelect(item.code)}
        style={[styles.languageCard, isSelected && styles.languageCardSelected]}
      >
        <View style={styles.leftRow}>
          <Text style={styles.flag}>{item.flag}</Text>
          <View style={styles.textColumn}>
            <Text style={[styles.nativeName, isSelected && styles.textSelected]}>
              {item.nativeName}
            </Text>
            <Text style={styles.subName}>{item.name}</Text>
          </View>
        </View>

        {isSelected ? (
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={18} color={colors.textInverse} />
          </View>
        ) : (
          <View style={styles.uncheckCircle} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('language.selectTitle')}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.content}>
        <View style={styles.banner}>
          <Ionicons name="globe-outline" size={24} color={colors.primary} />
          <Text style={styles.bannerText}>{t('language.selectDescription')}</Text>
        </View>

        <FlatList
          data={supportedLanguages}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      </View>
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
    flex: 1,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    marginBottom: layout.spacing.lg,
    gap: 12,
  },
  bannerText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  list: {
    gap: 12,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: layout.spacing.md,
    borderRadius: layout.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...layout.shadows.subtle,
  },
  languageCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF', // subtle blue tint
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  flag: {
    fontSize: 28,
  },
  textColumn: {
    justifyContent: 'center',
  },
  nativeName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  subName: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  textSelected: {
    color: colors.primary,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uncheckCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
});
