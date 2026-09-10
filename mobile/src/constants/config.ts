export const APP_CONFIG = {
  APP_NAME: 'AudioGuide',
  VERSION: '1.0.0',
  API_BASE_URL: 'https://api.audioguide.example.com/v1',
  USE_MOCK_API: true, // Chuyển sang false khi Backend REST API sẵn sàng
  MOCK_DELAY_MS: 300,  // Giả lập độ trễ mạng thực tế
  DEFAULT_LANGUAGE: 'vi' as const,

  // Tham số GPS chuẩn bị cho Tuần 8
  GPS: {
    DEFAULT_COORDINATE: {
      latitude: 10.7769, // Trung tâm Quận 1, TP. Hồ Chí Minh
      longitude: 106.7009,
    },
    AUTO_TRIGGER_RADIUS_METERS: 50, // Bán kính tự động phát thuyết minh (50m)
    LOCATION_CHECK_INTERVAL_MS: 5000,
  },
};
