import { calculateDistance, formatDistance, isWithinGeofence } from '../src/utils/geoUtils';
import { Coordinate } from '../src/types';

describe('geoUtils Tests', () => {
  // Toạ độ Nhà thờ Đức Bà: 10.77978, 106.69902
  const notreDame: Coordinate = { latitude: 10.77978, longitude: 106.69902 };
  // Toạ độ Bưu điện Trung tâm: 10.77988, 106.69998 (~105m)
  const postOffice: Coordinate = { latitude: 10.77988, longitude: 106.69998 };
  // Toạ độ Chợ Bến Thành: 10.77254, 106.69802 (~810m)
  const benThanh: Coordinate = { latitude: 10.77254, longitude: 106.69802 };

  test('calculateDistance should accurately compute distance between landmarks', () => {
    const distToPostOffice = calculateDistance(notreDame, postOffice);
    expect(distToPostOffice).toBeGreaterThan(80);
    expect(distToPostOffice).toBeLessThan(140);

    const distToBenThanh = calculateDistance(notreDame, benThanh);
    expect(distToBenThanh).toBeGreaterThan(700);
    expect(distToBenThanh).toBeLessThan(950);
  });

  test('formatDistance should format meters and kilometers correctly', () => {
    expect(formatDistance(50)).toBe('50m');
    expect(formatDistance(999)).toBe('999m');
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(2500)).toBe('2.5 km');
  });

  test('isWithinGeofence should correctly identify whether user is in trigger range', () => {
    // Khoảng cách ~105m, với bán kính 50m sẽ trả về false
    expect(isWithinGeofence(notreDame, postOffice, 50)).toBe(false);

    // Với bán kính 150m sẽ trả về true
    expect(isWithinGeofence(notreDame, postOffice, 150)).toBe(true);

    // Ngay tại điểm đó (khoảng cách 0m) trả về true
    expect(isWithinGeofence(notreDame, notreDame, 50)).toBe(true);
  });
});
