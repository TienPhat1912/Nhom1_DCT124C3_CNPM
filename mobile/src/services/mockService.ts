import {
  Location,
  LocationFilter,
  AudioGuide,
  AudioTrack,
  LanguageCode,
  User,
  LoginCredentials,
  RegisterData,
  ApiResponse,
} from '../types';
import { APP_CONFIG } from '../constants/config';
import { MOCK_LOCATIONS } from './mockData/locations';
import { MOCK_AUDIO_GUIDES } from './mockData/audioGuides';
import { MOCK_USERS } from './mockData/users';

const delay = (ms: number = APP_CONFIG.MOCK_DELAY_MS) =>
  new Promise((resolve) => setTimeout(resolve, ms));

class MockService {
  private locations: Location[] = [...MOCK_LOCATIONS];
  private users = [...MOCK_USERS];
  private favorites: Set<string> = new Set(['loc-001']);

  /**
   * Lấy danh sách địa điểm (có hỗ trợ lọc theo danh mục và tìm kiếm)
   */
  async getLocations(filter?: LocationFilter): Promise<ApiResponse<Location[]>> {
    await delay();

    let results = [...this.locations];

    if (filter?.category && filter.category !== 'all') {
      results = results.filter((loc) => loc.category === filter.category);
    }

    if (filter?.searchQuery && filter.searchQuery.trim().length > 0) {
      const q = filter.searchQuery.trim().toLowerCase();
      results = results.filter(
        (loc) =>
          loc.name.vi.toLowerCase().includes(q) ||
          loc.name.en.toLowerCase().includes(q) ||
          loc.name.ja.toLowerCase().includes(q) ||
          loc.name.zh.toLowerCase().includes(q) ||
          loc.shortDescription.vi.toLowerCase().includes(q) ||
          loc.address.toLowerCase().includes(q)
      );
    }

    return {
      success: true,
      data: results,
    };
  }

  /**
   * Lấy chi tiết một địa điểm theo ID
   */
  async getLocationById(id: string): Promise<ApiResponse<Location>> {
    await delay();

    const loc = this.locations.find((l) => l.id === id);
    if (!loc) {
      throw new Error(`Không tìm thấy địa điểm với mã ${id}`);
    }

    return {
      success: true,
      data: loc,
    };
  }

  /**
   * Lấy bản thuyết minh âm thanh cho địa điểm và ngôn ngữ chỉ định
   */
  async getAudioGuide(
    locationId: string,
    language: LanguageCode = 'vi'
  ): Promise<ApiResponse<{ audioGuide: AudioGuide; currentTrack: AudioTrack }>> {
    await delay();

    const guide = Object.values(MOCK_AUDIO_GUIDES).find(
      (g) => g.locationId === locationId
    );

    if (!guide) {
      throw new Error(`Chưa có bài thuyết minh cho địa điểm ${locationId}`);
    }

    const track = guide.tracks[language] || guide.tracks['vi'];

    return {
      success: true,
      data: {
        audioGuide: guide,
        currentTrack: track,
      },
    };
  }

  /**
   * Giả lập đăng nhập
   */
  async login(
    credentials: LoginCredentials
  ): Promise<ApiResponse<{ user: User; token: string }>> {
    await delay();

    const normalizedEmail = credentials.email.trim().toLowerCase();
    const user = this.users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user || user.passwordHash !== credentials.password) {
      throw new Error('Email hoặc mật khẩu không chính xác.');
    }

    const { passwordHash, ...safeUser } = user;

    return {
      success: true,
      data: {
        user: safeUser,
        token: `mock-jwt-token-${Date.now()}-${safeUser.id}`,
      },
      message: 'Đăng nhập thành công',
    };
  }

  /**
   * Giả lập đăng ký tài khoản mới
   */
  async register(
    data: RegisterData
  ): Promise<ApiResponse<{ user: User; token: string }>> {
    await delay();

    const normalizedEmail = data.email.trim().toLowerCase();
    const existing = this.users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (existing) {
      throw new Error('Email này đã được đăng ký tài khoản.');
    }

    const newUser = {
      id: `user-${Date.now()}`,
      name: data.name.trim(),
      email: normalizedEmail,
      passwordHash: data.password,
      createdAt: new Date().toISOString(),
    };

    this.users.push(newUser);
    const { passwordHash, ...safeUser } = newUser;

    return {
      success: true,
      data: {
        user: safeUser,
        token: `mock-jwt-token-${Date.now()}-${safeUser.id}`,
      },
      message: 'Đăng ký tài khoản thành công',
    };
  }

  /**
   * Toggle yêu thích địa điểm
   */
  async toggleFavorite(locationId: string): Promise<ApiResponse<{ isFavorite: boolean }>> {
    await delay(100);

    let isFavorite: boolean;
    if (this.favorites.has(locationId)) {
      this.favorites.delete(locationId);
      isFavorite = false;
    } else {
      this.favorites.add(locationId);
      isFavorite = true;
    }

    return {
      success: true,
      data: { isFavorite },
    };
  }

  /**
   * Lấy danh sách ID các địa điểm yêu thích
   */
  async getFavorites(): Promise<ApiResponse<string[]>> {
    await delay(100);
    return {
      success: true,
      data: Array.from(this.favorites),
    };
  }
}

export const mockService = new MockService();
