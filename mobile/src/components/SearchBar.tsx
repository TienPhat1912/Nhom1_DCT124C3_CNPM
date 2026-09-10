import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, layout } from '../constants';
import { LocationCategory } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface SearchBarProps {
  query: string;
  onChangeQuery: (text: string) => void;
  selectedCategory: LocationCategory | 'all';
  onSelectCategory: (category: LocationCategory | 'all') => void;
  placeholder?: string;
}

const CATEGORIES: (LocationCategory | 'all')[] = [
  'all',
  'monument',
  'culture',
  'museum',
  'market',
];

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onChangeQuery,
  selectedCategory,
  onSelectCategory,
  placeholder,
}) => {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder={placeholder || t('common.search')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeQuery('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              activeOpacity={0.7}
              onPress={() => onSelectCategory(cat)}
              style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
            >
              <Text
                style={[
                  styles.categoryText,
                  isSelected && styles.categoryTextActive,
                ]}
              >
                {t(`home.categories.${cat}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.spacing.md,
    paddingTop: layout.spacing.sm,
    paddingBottom: layout.spacing.xs,
    backgroundColor: colors.surface,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: layout.borderRadius.md,
    paddingHorizontal: layout.spacing.sm + 4,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  categoryList: {
    flexDirection: 'row',
    paddingVertical: layout.spacing.sm,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: layout.borderRadius.full,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: colors.textInverse,
    fontWeight: typography.weights.semibold,
  },
});
