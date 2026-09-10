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
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, layout } from '../constants';
import { LoginScreenProps } from '../navigation/types';
import { Input, Button, Header } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { isValidEmail, isValidPassword } from '../utils/validators';

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { login, demoLogin, isLoading } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!isValidEmail(email)) {
      newErrors.email = t('auth.errors.invalidEmail');
    }

    if (!isValidPassword(password)) {
      newErrors.password = t('auth.errors.passwordTooShort');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    try {
      await login({ email, password });
      navigation.replace('Home');
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('auth.errors.loginFailed'));
    }
  };

  const handleDemoLogin = async () => {
    try {
      await demoLogin();
      navigation.replace('Home');
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || 'Lỗi đăng nhập');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title={t('auth.login')}
        onLanguagePress={() => navigation.navigate('Language')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandHeader}>
          <View style={styles.iconCircle}>
            <Ionicons name="headset" size={40} color={colors.primary} />
          </View>
          <Text style={styles.welcomeTitle}>{t('common.appName')}</Text>
          <Text style={styles.subtitle}>{t('common.tagline')}</Text>
        </View>

        <View style={styles.form}>
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
            autoCorrect={false}
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

          <Button
            title={t('auth.login')}
            onPress={handleLogin}
            isLoading={isLoading}
            variant="primary"
            size="lg"
            style={styles.submitButton}
          />

          {/* Nút Demo Login 1-Click tiện lợi cho Hội đồng chấm điểm */}
          <Button
            title={t('auth.demoLogin')}
            onPress={handleDemoLogin}
            isLoading={isLoading}
            variant="outline"
            size="md"
            icon={<Ionicons name="flash-outline" size={18} color={colors.primary} />}
            style={styles.demoButton}
          />

          <View style={styles.switchRow}>
            <Text style={styles.noAccountText}>{t('auth.noAccount')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>{t('auth.register')}</Text>
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
  brandHeader: {
    alignItems: 'center',
    marginBottom: layout.spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: layout.spacing.md,
  },
  welcomeTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  form: {
    backgroundColor: colors.surface,
    padding: layout.spacing.lg,
    borderRadius: layout.borderRadius.xl,
    ...layout.shadows.card,
  },
  submitButton: {
    marginTop: layout.spacing.sm,
  },
  demoButton: {
    marginTop: layout.spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: layout.spacing.lg,
  },
  noAccountText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginRight: 6,
  },
  registerLink: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
});
