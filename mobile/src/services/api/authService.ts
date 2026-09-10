import { APP_CONFIG } from '../../constants';
import { mockService } from '../mockService';
import { apiClient } from './apiClient';
import { User, LoginCredentials, RegisterData } from '../../types';

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
    if (APP_CONFIG.USE_MOCK_API) {
      const res = await mockService.login(credentials);
      apiClient.setAuthToken(res.data.token);
      return res.data;
    }
    const res = await apiClient.post<{ user: User; token: string }>('/auth/login', credentials);
    apiClient.setAuthToken(res.data.token);
    return res.data;
  },

  async register(data: RegisterData): Promise<{ user: User; token: string }> {
    if (APP_CONFIG.USE_MOCK_API) {
      const res = await mockService.register(data);
      apiClient.setAuthToken(res.data.token);
      return res.data;
    }
    const res = await apiClient.post<{ user: User; token: string }>('/auth/register', data);
    apiClient.setAuthToken(res.data.token);
    return res.data;
  },

  logout() {
    apiClient.setAuthToken(null);
  },
};
