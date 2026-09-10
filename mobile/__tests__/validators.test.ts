import { isValidEmail, isValidPassword, isValidName } from '../src/utils/validators';

describe('validators Tests', () => {
  describe('isValidEmail', () => {
    test('accepts valid email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('tourist.vietnam@gmail.com')).toBe(true);
      expect(isValidEmail('student_3124411222@sgu.edu.vn')).toBe(true);
    });

    test('rejects invalid email formats', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user@domain')).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    test('accepts passwords with length >= 6', () => {
      expect(isValidPassword('123456')).toBe(true);
      expect(isValidPassword('securePassword123')).toBe(true);
    });

    test('rejects passwords shorter than 6 characters', () => {
      expect(isValidPassword('')).toBe(false);
      expect(isValidPassword('12345')).toBe(false);
      expect(isValidPassword('   ')).toBe(false);
    });
  });

  describe('isValidName', () => {
    test('accepts valid names with length >= 2', () => {
      expect(isValidName('Nguyễn Văn A')).toBe(true);
      expect(isValidName('John')).toBe(true);
    });

    test('rejects empty or 1-character names', () => {
      expect(isValidName('')).toBe(false);
      expect(isValidName('A')).toBe(false);
    });
  });
});
