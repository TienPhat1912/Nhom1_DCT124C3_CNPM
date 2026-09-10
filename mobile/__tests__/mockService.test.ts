import { mockService } from '../src/services/mockService';

describe('mockService Tests', () => {
  test('getLocations returns full list of locations', async () => {
    const res = await mockService.getLocations();
    expect(res.success).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(4);
    expect(res.data[0]).toHaveProperty('id');
    expect(res.data[0]).toHaveProperty('name');
    expect(res.data[0]).toHaveProperty('coordinate');
  });

  test('getLocations filters correctly by category', async () => {
    const res = await mockService.getLocations({ category: 'monument' });
    expect(res.success).toBe(true);
    res.data.forEach((loc) => {
      expect(loc.category).toBe('monument');
    });
  });

  test('getLocations filters correctly by search query', async () => {
    const res = await mockService.getLocations({ searchQuery: 'Đức Bà' });
    expect(res.success).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(1);
    expect(res.data[0].id).toBe('loc-001');
  });

  test('getLocationById retrieves correct location', async () => {
    const res = await mockService.getLocationById('loc-001');
    expect(res.success).toBe(true);
    expect(res.data.name.vi).toBe('Nhà Thờ Đức Bà Sài Gòn');
  });

  test('getLocationById throws error for invalid id', async () => {
    await expect(mockService.getLocationById('non-existing-id')).rejects.toThrow();
  });

  test('getAudioGuide returns multi-language tracks', async () => {
    const resVi = await mockService.getAudioGuide('loc-001', 'vi');
    expect(resVi.success).toBe(true);
    expect(resVi.data.currentTrack.language).toBe('vi');
    expect(resVi.data.currentTrack.audioUrl).toBeDefined();

    const resEn = await mockService.getAudioGuide('loc-001', 'en');
    expect(resEn.success).toBe(true);
    expect(resEn.data.currentTrack.language).toBe('en');

    const resJa = await mockService.getAudioGuide('loc-001', 'ja');
    expect(resJa.success).toBe(true);
    expect(resJa.data.currentTrack.language).toBe('ja');

    const resZh = await mockService.getAudioGuide('loc-001', 'zh');
    expect(resZh.success).toBe(true);
    expect(resZh.data.currentTrack.language).toBe('zh');
  });

  test('login succeeds with correct demo credentials', async () => {
    const res = await mockService.login({
      email: 'tourist@example.com',
      password: 'demo123',
    });
    expect(res.success).toBe(true);
    expect(res.data.user.email).toBe('tourist@example.com');
    expect(res.data.token).toBeDefined();
  });

  test('login fails with wrong password', async () => {
    await expect(
      mockService.login({
        email: 'tourist@example.com',
        password: 'wrongpassword',
      })
    ).rejects.toThrow();
  });

  test('toggleFavorite toggles status properly', async () => {
    // Ban đầu loc-001 có sẵn trong favorites
    const res1 = await mockService.toggleFavorite('loc-001');
    expect(res1.data.isFavorite).toBe(false);

    const res2 = await mockService.toggleFavorite('loc-001');
    expect(res2.data.isFavorite).toBe(true);
  });
});
