import { useState } from 'react';
import { Coordinate } from '../types';
import { calculateDistance, formatDistance, isWithinGeofence } from '../utils/geoUtils';
import { APP_CONFIG } from '../constants/config';

/**
 * Hook quản lý toạ độ hiện tại và tính khoảng cách đến các địa điểm
 * Sẵn sàng kết nối với GPS thực tế ở Tuần 8.
 */
export function useDistance(initialUserCoord?: Coordinate) {
  // Mặc định sử dụng toạ độ trung tâm Quận 1 cho demo
  const [userCoord, setUserCoord] = useState<Coordinate>(
    initialUserCoord || APP_CONFIG.GPS.DEFAULT_COORDINATE
  );

  const getDistanceTo = (targetCoord: Coordinate): number => {
    return calculateDistance(userCoord, targetCoord);
  };

  const getFormattedDistanceTo = (targetCoord: Coordinate): string => {
    const meters = getDistanceTo(targetCoord);
    return formatDistance(meters);
  };

  const checkGeofenceTrigger = (
    targetCoord: Coordinate,
    radius: number = APP_CONFIG.GPS.AUTO_TRIGGER_RADIUS_METERS
  ): boolean => {
    return isWithinGeofence(userCoord, targetCoord, radius);
  };

  return {
    userCoord,
    setUserCoord,
    getDistanceTo,
    getFormattedDistanceTo,
    checkGeofenceTrigger,
  };
}
