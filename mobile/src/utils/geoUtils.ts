import { Coordinate } from '../types';

/**
 * Tính khoảng cách giữa hai tọa độ địa lý bằng công thức Haversine (tính bằng mét).
 * Sẵn sàng cho tính năng GPS tự động kích hoạt ở Tuần 8.
 */
export function calculateDistance(
  coord1: Coordinate,
  coord2: Coordinate
): number {
  const R = 6371e3; // Bán kính Trái Đất theo mét
  const phi1 = (coord1.latitude * Math.PI) / 180;
  const phi2 = (coord2.latitude * Math.PI) / 180;
  const deltaPhi = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLambda = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Định dạng khoảng cách sang chuỗi dễ đọc (ví dụ: '150m' hoặc '1.2 km')
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} km`;
}

/**
 * Kiểm tra xem người dùng có đang ở trong bán kính kích hoạt địa điểm hay không.
 */
export function isWithinGeofence(
  userCoord: Coordinate,
  targetCoord: Coordinate,
  radiusMeters: number = 50
): boolean {
  const dist = calculateDistance(userCoord, targetCoord);
  return dist <= radiusMeters;
}
