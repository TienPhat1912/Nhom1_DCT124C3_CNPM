import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { colors, typography, layout } from '../constants';
import { RegisterScreenProps } from '../navigation/types';
import { Input, Button, Header } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { isValidEmail, isValidPassword, isValidName } from '../utils/validators';

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const { register, isLoading } = useAuth();
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!isValidName(name)) {
      newErrors.name = t('auth.errors.nameRequired');
    }

    if (!isValidEmail(email)) {
      newErrors.email = t('auth.errors.invalidEmail');
    }

    if (!isValidPassword(password)) {
      newErrors.password = t('auth.errors.passwordTooShort');
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.errors.passwordMismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    try {
      await register({ name, email, password, confirmPassword });
      Alert.alert(t('common.appName'), t('auth.registerSuccess'), [
        { text: 'OK', onPress: () => navigation.replace('Home') },
      ]);
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || 'Lỗi đăng ký tài khoản');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title={t('auth.register')}
        onBack={() => navigation.goBack()}
        onLanguagePress={() => navigation.navigate('Language')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <Text style={styles.title}>{t('auth.register')}</Text>
          <Text style={styles.subtitle}>{t('common.tagline')}</Text>

          <Input
            label={t('auth.name')}
            placeholder={t('auth.namePlaceholder')}
            iconName="person-outline"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={errors.name}
          />

          <Input
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            iconName="mail-outline"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <Input
            label={t('auth.password')}
            placeholder={t('auth.passwordPlaceholder')}
            iconName="lock-closed-outline"
            isPassword
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
          />

          <Input
            label={t('auth.confirmPassword')}
            placeholder={t('auth.confirmPasswordPlaceholder')}
            iconName="shield-checkmark-outline"
            isPassword
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (errors.confirmPassword)
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }}
            error={errors.confirmPassword}
          />

          <Button
            title={t('auth.register')}
            onPress={handleRegister}
            isLoading={isLoading}
            variant="primary"
            size="lg"
            style={styles.submitButton}
          />

          <View style={styles.switchRow}>
            <Text style={styles.haveAccountText}>{t('auth.haveAccount')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>{t('auth.login')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: layout.spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  form: {
    backgroundColor: colors.surface,
    padding: layout.spacing.lg,
    borderRadius: layout.borderRadius.xl,
    ...layout.shadows.card,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: layout.spacing.lg,
  },
  submitButton: {
    marginTop: layout.spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: layout.spacing.lg,
  },
  haveAccountText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginRight: 6,
  },
  loginLink: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
});
