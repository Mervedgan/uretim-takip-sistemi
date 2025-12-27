/**
 * API Configuration
 * Backend API base URL and endpoints
 * 
 * Platform-specific URL configuration:
 * - Android emulator: http://10.0.2.2:8000
 * - iOS simulator: http://localhost:8000
 * - Physical device: Use your computer's local IP (e.g., http://192.168.1.100:8000)
 * 
 * To find your computer's IP:
 * - Windows: ipconfig (look for IPv4 Address)
 * - Mac/Linux: ifconfig or ip addr
 */

import { Platform } from 'react-native';

// Get API URL based on environment and platform
const getApiBaseUrl = (): string => {
  if (!__DEV__) {
    // Production URL
    return 'https://api.example.com';
  }

  // Development URLs
  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to access host machine's localhost
    return 'http://10.0.2.2:8000';
  } else if (Platform.OS === 'ios') {
    // iOS simulator can access localhost directly
    return 'http://localhost:8000';
  }

  // Default fallback
  return 'http://localhost:8000';
};

// For physical devices, you may need to manually set this to your computer's IP
// Example: 'http://192.168.1.100:8000'
// Uncomment and set the line below if testing on a physical device:
// export const API_BASE_URL = 'http://YOUR_COMPUTER_IP:8000';

export const API_BASE_URL = getApiBaseUrl();

export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  REFRESH_TOKEN: '/auth/refresh',
  
  // User
  CURRENT_USER: '/auth/me',
  
  // Admin
  LIST_USERS: '/auth/users',
  CHANGE_USER_ROLE: '/auth/users',
  DELETE_USER: '/auth/users',
  
  // Stages
  STAGE_START: '/stages',
  STAGE_DONE: '/stages',
  STAGE_ISSUE: '/stages',
  
  // Work Orders
  WORK_ORDERS: '/workorders',
  WORK_ORDER_DETAIL: '/workorders',
  WORK_ORDER_STAGES: '/workorders',
  
  // Machines
  MACHINES: '/machines',
  MACHINE_READINGS: '/machines',
  
  // Products
  PRODUCTS: '/products',
  PRODUCT_DETAIL: '/products',
  PRODUCT_CREATE: '/products',
  PRODUCT_UPDATE: '/products',
  PRODUCT_DELETE: '/products',
  PRODUCT_RESTORE: '/products',
  
  // Molds
  MOLDS: '/molds',
  MOLD_DETAIL: '/molds',
  MOLD_CREATE: '/molds',
  MOLD_UPDATE: '/molds',
  MOLD_DELETE: '/molds',
  MOLD_RESTORE: '/molds',
  
  // Metrics
  WORK_ORDER_METRICS: '/metrics/workorders',
  STAGE_METRICS: '/metrics/stages',
  
  // Issues
  ISSUES: '/issues',
  ISSUE_STATUS: '/issues',
  NOTIFICATIONS: '/issues/notifications',
  NOTIFICATION_READ: '/issues/notifications',
} as const;

