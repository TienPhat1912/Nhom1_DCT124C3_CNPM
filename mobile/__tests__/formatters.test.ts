import { formatMillisToMinutesSeconds, formatSecondsToMinutesSeconds } from '../src/utils/formatters';

describe('formatters Tests', () => {
  test('formatMillisToMinutesSeconds formats milliseconds to MM:SS string', () => {
    expect(formatMillisToMinutesSeconds(0)).toBe('00:00');
    expect(formatMillisToMinutesSeconds(5000)).toBe('00:05');
    expect(formatMillisToMinutesSeconds(65000)).toBe('01:05');
    expect(formatMillisToMinutesSeconds(600000)).toBe('10:00');
    expect(formatMillisToMinutesSeconds(372000)).toBe('06:12');
  });

  test('formatMillisToMinutesSeconds handles edge cases and NaN', () => {
    expect(formatMillisToMinutesSeconds(NaN)).toBe('00:00');
    expect(formatMillisToMinutesSeconds(-100)).toBe('00:00');
  });

  test('formatSecondsToMinutesSeconds converts seconds correctly', () => {
    expect(formatSecondsToMinutesSeconds(30)).toBe('00:30');
    expect(formatSecondsToMinutesSeconds(125)).toBe('02:05');
  });
});
