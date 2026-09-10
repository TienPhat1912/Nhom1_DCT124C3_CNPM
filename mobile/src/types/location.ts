import { LanguageCode } from './language';

export type LocationCategory = 'monument' | 'market' | 'museum' | 'park' | 'culture';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface MultilingualText {
  vi: string;
  en: string;
  ja: string;
  zh: string;
}

export interface Location {
  id: string;
  name: MultilingualText;
  shortDescription: MultilingualText;
  description: MultilingualText;
  address: string;
  category: LocationCategory;
  imageUrl: string;
  galleryImages: string[];
  coordinate: Coordinate;
  distanceInMeters?: number; // Calculated dynamically relative to user GPS
  openingHours?: string;
  admissionFee?: MultilingualText;
  isFeatured?: boolean;
  audioGuideId: string;
}

export interface LocationFilter {
  category?: LocationCategory | 'all';
  searchQuery?: string;
}
