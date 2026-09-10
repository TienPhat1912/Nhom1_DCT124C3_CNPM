import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  Home: undefined;
  LocationDetail: { locationId: string };
  Language: undefined;
  Map: { initialLocationId?: string } | undefined;
  Favorites: undefined;
};

export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export type SplashScreenProps = NativeStackScreenProps<RootStackParamList, 'Splash'>;
export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
export type RegisterScreenProps = NativeStackScreenProps<RootStackParamList, 'Register'>;
export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type LocationDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'LocationDetail'>;
export type LanguageScreenProps = NativeStackScreenProps<RootStackParamList, 'Language'>;
export type MapScreenProps = NativeStackScreenProps<RootStackParamList, 'Map'>;
export type FavoritesScreenProps = NativeStackScreenProps<RootStackParamList, 'Favorites'>;
