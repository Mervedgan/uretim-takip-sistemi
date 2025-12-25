/**
 * API Configuration
 * Backend API base URL and endpoints
 */

// TODO: Update this with your actual FastAPI backend URL
// For Android emulator, use: http://10.0.2.2:8000
// For iOS simulator, use: http://localhost:8000
// For physical device, use your computer's IP: http://192.168.x.x:8000
export const API_BASE_URL = __DEV__ 
  ? 'http://10.0.2.2:8000'  // Android emulator default
  : 'https://api.example.com';  // Production URL

export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  REFRESH_TOKEN: '/auth/refresh',
  
  // User
  CURRENT_USER: '/auth/me',
  
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
  
  // Metrics
  WORK_ORDER_METRICS: '/metrics/workorders',
  STAGE_METRICS: '/metrics/stages',
  
  // Production (legacy - may not be used)
  PRODUCTION: '/production',
  PRODUCTION_METRICS: '/production/metrics',
  
  // Reporting (TODO: Backend kalan işler)
  REPORTS_EFFICIENCY: '/reports/efficiency',
  REPORTS_PRODUCTION: '/reports/production',
  
  // AI Data (TODO: Backend kalan işler)
  AI_DATA: '/ai/data',
} as const;

