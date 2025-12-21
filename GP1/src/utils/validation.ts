/**
 * Validation Utilities
 * Centralized form validation functions
 */

export const validators = {
  /**
   * Validate email format
   */
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  },

  /**
   * Validate phone number (10-11 digits)
   */
  phone: (phone: string): boolean => {
    const phoneDigits = phone.replace(/\s/g, '');
    return /^[0-9]{10,11}$/.test(phoneDigits);
  },

  /**
   * Validate password (min 6 characters)
   */
  password: (password: string): boolean => {
    return password.length >= 6;
  },

  /**
   * Validate username (alphanumeric, min 3 characters)
   */
  username: (username: string): boolean => {
    const trimmed = username.trim();
    return trimmed.length >= 3 && /^[a-zA-Z0-9_]+$/.test(trimmed);
  },

  /**
   * Validate required field
   */
  required: (value: string): boolean => {
    return value.trim().length > 0;
  },
};

export const validationMessages = {
  email: 'Lütfen geçerli bir e-posta adresi girin! (örn: ornek@email.com)',
  phone: 'Lütfen geçerli bir telefon numarası girin! (10-11 haneli)',
  password: 'Şifre en az 6 karakter olmalıdır!',
  username: 'Kullanıcı adı en az 3 karakter olmalı ve sadece harf, rakam ve alt çizgi içermelidir!',
  required: (field: string) => `Lütfen ${field} girin!`,
  passwordMismatch: 'Şifreler eşleşmiyor!',
};

