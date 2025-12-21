/**
 * API Service
 * Optimized API functions for FastAPI backend
 */
import apiClient from './apiClient';
import { API_ENDPOINTS } from './apiConfig';
import { tokenStorage } from './tokenStorage';
import { User, UserRole } from '../types';

// API Response Types
export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  user: User;
}

export interface RegisterResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  detail: string | string[];
  message?: string;
}

// Backend Request Types (FastAPI Pydantic format)
export interface RegisterRequest {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Format API error message
 */
const formatApiError = (error: any): string => {
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (Array.isArray(detail)) {
      return detail.map((err: any) => {
        const field = err.loc?.join('.') || 'field';
        return `${field}: ${err.msg}`;
      }).join('\n');
    }
    return typeof detail === 'string' ? detail : JSON.stringify(detail);
  }
  return error.message || 'Bir hata oluştu';
};

/**
 * Authentication API
 */
export const authAPI = {
  /**
   * Login with username and password
   * Backend expects query parameters, not body
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const params = {
        username: username.trim(),
        password: password,
      };

      console.log('Sending POST request to:', API_ENDPOINTS.LOGIN);
      console.log('Query params:', params);
      
      const response = await apiClient.post<LoginResponse>(
        API_ENDPOINTS.LOGIN,
        null, // No body
        { params } // Query parameters
      );
      
      console.log('Login response:', response.status, response.data);

      const { access_token, refresh_token, user } = response.data;

      // Save tokens
      await tokenStorage.saveToken(access_token);
      if (refresh_token) {
        await tokenStorage.saveRefreshToken(refresh_token);
      }
      await tokenStorage.saveUser(user);

      return response.data;
    } catch (error: any) {
      const errorMessage = formatApiError(error);
      throw new Error(errorMessage);
    }
  },

  /**
   * Register new user
   * Backend expects query parameters, not body
   * Backend format: username, password, name, role, phone (optional), email (optional), department (optional)
   */
  async register(
    username: string,
    password: string,
    name: string,
    role: UserRole,
    phone?: string,
    email?: string,
    department?: string
  ): Promise<RegisterResponse> {
    try {
      // Backend'e gönderilecek veri - Query parameters olarak
      const params: any = {
        username: username.trim(),
        password: password,
        name: name.trim(),
        role: role,
      };

      // Optional parameters - sadece varsa ekle
      if (phone && phone.trim()) {
        params.phone = phone.trim();
      }
      if (email && email.trim()) {
        params.email = email.trim();
      }
      if (department && department.trim()) {
        params.department = department.trim();
      }

      console.log('Sending POST request to:', API_ENDPOINTS.REGISTER);
      console.log('Query params:', params);
      
      const response = await apiClient.post<RegisterResponse>(
        API_ENDPOINTS.REGISTER,
        null, // No body
        { params } // Query parameters
      );
      
      console.log('Register response:', response.status, response.data);

      const { access_token, refresh_token, user } = response.data;

      // Save tokens
      await tokenStorage.saveToken(access_token);
      if (refresh_token) {
        await tokenStorage.saveRefreshToken(refresh_token);
      }
      await tokenStorage.saveUser(user);

      return response.data;
    } catch (error: any) {
      const errorMessage = formatApiError(error);
      throw new Error(errorMessage);
    }
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User> {
    try {
      const response = await apiClient.get<User>(API_ENDPOINTS.CURRENT_USER);
      return response.data;
    } catch (error: any) {
      const errorMessage = formatApiError(error);
      throw new Error(errorMessage);
    }
  },

  /**
   * Logout - clear stored tokens
   */
  async logout(): Promise<void> {
    await tokenStorage.clearAll();
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await tokenStorage.getToken();
    return token !== null;
  },
};

/**
 * Stages API
 */
export const stagesAPI = {
  async startStage(stageId: string, data?: any): Promise<any> {
    try {
      const response = await apiClient.post(
        `${API_ENDPOINTS.STAGE_START}/${stageId}`,
        data
      );
      return response.data;
    } catch (error: any) {
      throw new Error(formatApiError(error));
    }
  },

  async doneStage(stageId: string, data?: any): Promise<any> {
    try {
      const response = await apiClient.post(
        `${API_ENDPOINTS.STAGE_DONE}/${stageId}`,
        data
      );
      return response.data;
    } catch (error: any) {
      throw new Error(formatApiError(error));
    }
  },

  async issueStage(stageId: string, issueData: any): Promise<any> {
    try {
      const response = await apiClient.post(
        `${API_ENDPOINTS.STAGE_ISSUE}/${stageId}`,
        issueData
      );
      return response.data;
    } catch (error: any) {
      throw new Error(formatApiError(error));
    }
  },

  async getStages(): Promise<any[]> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.STAGES);
      return response.data;
    } catch (error: any) {
      throw new Error(formatApiError(error));
    }
  },
};

/**
 * Work Orders API
 */
export const workOrdersAPI = {
  async getWorkOrders(): Promise<any[]> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.WORK_ORDERS);
      return response.data;
    } catch (error: any) {
      throw new Error(formatApiError(error));
    }
  },

  async createWorkOrder(data: any): Promise<any> {
    try {
      const response = await apiClient.post(
        API_ENDPOINTS.WORK_ORDER_CREATE,
        data
      );
      return response.data;
    } catch (error: any) {
      throw new Error(formatApiError(error));
    }
  },
};

/**
 * Production API
 */
export const productionAPI = {
  async getProduction(): Promise<any> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.PRODUCTION);
      return response.data;
    } catch (error: any) {
      throw new Error(formatApiError(error));
    }
  },

  async getMetrics(): Promise<any> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.PRODUCTION_METRICS);
      return response.data;
    } catch (error: any) {
      throw new Error(formatApiError(error));
    }
  },
};

/**
 * Reports API
 */
export const reportsAPI = {
  async getEfficiencyReport(params?: any): Promise<any> {
    try {
      const response = await apiClient.get(
        API_ENDPOINTS.REPORTS_EFFICIENCY,
        { params }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(formatApiError(error));
    }
  },

  async getProductionReport(params?: any): Promise<any> {
    try {
      const response = await apiClient.get(
        API_ENDPOINTS.REPORTS_PRODUCTION,
        { params }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(formatApiError(error));
    }
  },
};

/**
 * AI Data API
 */
export const aiDataAPI = {
  async getAIData(params?: any): Promise<any> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.AI_DATA, { params });
      return response.data;
    } catch (error: any) {
      throw new Error(formatApiError(error));
    }
  },
};
