/**
 * Kiểm tra tính hợp lệ của định dạng Email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Kiểm tra độ dài mật khẩu (tối thiểu 6 ký tự)
 */
export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.trim().length >= 6;
}

/**
 * Kiểm tra họ tên không được để trống
 */
export function isValidName(name: string): boolean {
  return typeof name === 'string' && name.trim().length >= 2;
}
