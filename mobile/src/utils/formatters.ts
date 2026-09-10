/**
 * Chuyển đổi milliseconds sang định dạng MM:SS (ví dụ: 125000 -> "02:05")
 */
export function formatMillisToMinutesSeconds(millis: number): string {
  if (isNaN(millis) || millis < 0) {
    return '00:00';
  }
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');
  return `${paddedMinutes}:${paddedSeconds}`;
}

/**
 * Chuyển đổi giây sang định dạng MM:SS
 */
export function formatSecondsToMinutesSeconds(seconds: number): string {
  return formatMillisToMinutesSeconds(seconds * 1000);
}
