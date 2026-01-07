import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './apiConfig';

// Base64 decode helper (React Native için)
function base64Decode(str: string): string {
  try {
    // React Native'de atob global olabilir, yoksa polyfill kullan
    if (typeof atob !== 'undefined') {
      return atob(str);
    }
    // Fallback: Manuel base64 decode (basit versiyon)
    // Base64 karakter seti
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    str = str.replace(/[^A-Za-z0-9\+\/]/g, '');
    
    while (i < str.length) {
      const encoded1 = chars.indexOf(str.charAt(i++));
      const encoded2 = chars.indexOf(str.charAt(i++));
      const encoded3 = chars.indexOf(str.charAt(i++));
      const encoded4 = chars.indexOf(str.charAt(i++));
      
      const bitmap = (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;
      
      result += String.fromCharCode((bitmap >> 16) & 255);
      if (encoded3 !== 64) result += String.fromCharCode((bitmap >> 8) & 255);
      if (encoded4 !== 64) result += String.fromCharCode(bitmap & 255);
    }
    
    return result;
  } catch (error) {
    console.error('Base64 decode error:', error);
    throw error;
  }
} 

// 1. İŞÇİYİ OLUŞTUR (Genel İstek Aracı)
const apiClient = axios.create({
  baseURL: API_BASE_URL, // apiConfig.ts'den alınan URL
  timeout: 10000, // 10 saniye timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. ÖNEMLİ: TOKEN EKLEME (Her istekten önce çalışır)
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Telefondan token'ı oku
      const token = await AsyncStorage.getItem('userToken');
      
      // Eğer token varsa, mektubun üzerine yapıştır
      if (token && token.trim()) {
        // Headers'ı garanti et - Axios tip güvenliği için
        if (!config.headers) {
          config.headers = {} as any;
        }
        // Authorization header'ı ekle
        (config.headers as any)['Authorization'] = `Bearer ${token.trim()}`;
        console.log("🔑 Token eklendi:", token.substring(0, 20) + "...");
        console.log("📤 Request:", config.method?.toUpperCase(), config.baseURL + config.url);
      } else {
        console.log("⚠️ Token bulunamadı veya boş! İstek tokensiz gidiyor.");
        console.log("📤 Request:", config.method?.toUpperCase(), config.baseURL + config.url);
      }
      return config;
    } catch (error) {
      console.error("❌ Token ekleme hatası:", error);
      return config;
    }
  },
  (error) => {
    console.error("❌ Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// 3. SERVİSLERİ TANIMLA
// Not: productionAPI kaldırıldı - moldsAPI ve productsAPI kullanılmalı
// Legacy endpoint'ler (/production, /production/metrics) backend'de yok

export const authAPI = {
  async login(username: string, password: string) {
    try {
      // OAuth2PasswordRequestForm expects form-data (application/x-www-form-urlencoded)
      const params = new URLSearchParams();
      params.append('username', username.trim());
      params.append('password', password);
      
      const response = await apiClient.post('/auth/login', params.toString(), {
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        
        
      });
      
      const { access_token, token_type, user: userData } = response.data;
      
      // Token'ı kaydet
      await AsyncStorage.setItem('userToken', access_token);
      
      // User bilgisini formatla
      let user;
      if (userData) {
        // Backend'den user bilgisi geliyorsa kullan
        user = {
          id: userData.id?.toString() || userData.user_id?.toString() || '1',
          username: userData.username || username.trim(),
          password: '', // Şifreyi saklamıyoruz
          role: userData.role || 'worker',
          name: userData.name || userData.username || username.trim(),
          department: userData.department || undefined,
          phone: userData.phone || undefined,
          email: userData.email || undefined,
        };
      } else {
        // Backend'den user bilgisi gelmiyorsa, JWT token'ından decode et
        try {
          // JWT token formatı: header.payload.signature
          // Payload'ı decode et (base64)
          const tokenParts = access_token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(base64Decode(tokenParts[1])); // Base64 decode
            const decodedRole = payload.role;
            const decodedUsername = payload.sub;
            
            console.log('🔍 Token\'dan decode edilen bilgiler:', { username: decodedUsername, role: decodedRole });
            
            user = {
              id: '1',
              username: decodedUsername || username.trim(),
              password: '',
              role: decodedRole || 'worker', // Token'dan gelen role bilgisini kullan
              name: decodedUsername || username.trim(),
            };
          } else {
            throw new Error('Invalid token format');
          }
        } catch (decodeError) {
          console.error('❌ Token decode hatası:', decodeError);
          // Token decode edilemezse, username'den oluştur (fallback)
          user = {
            id: '1',
            username: username.trim(),
            password: '',
            role: 'worker', // Son çare: varsayılan rol
            name: username.trim(),
          };
        }
      }
      
      console.log('✅ Login başarılı - User bilgisi:', { username: user.username, role: user.role });
      
      // User bilgisini de kaydet
      await AsyncStorage.setItem('user', JSON.stringify(user));
      
      return {
        access_token,
        token_type,
        user,
      };
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response) {
        const errorMessage = error.response.data?.detail || 'Giriş yapılamadı';
        throw new Error(errorMessage);
      }
      throw new Error(error.message || 'Giriş yapılamadı');
    }
  },

  async register(
    username: string,
    password: string,
    name: string,
    role: string,
    phone: string,
    email: string,
    department?: string
  ) {
    try {
      // Backend UserCreate schema: username, password, email, phone, role
      // name ve department backend'de desteklenmiyor, sadece frontend'de kullanılıyor
      const response = await apiClient.post('/auth/register', {
        username: username.trim(),
        password: password,
        role: role.toLowerCase(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });

      const { user: userData, access_token } = response.data;
      
      // Token varsa kaydet (backend register sonrası token döndürüyor)
      if (access_token) {
        await AsyncStorage.setItem('userToken', access_token);
      }
      
      // User bilgisini formatla (frontend için name ve department ekle)
      const user = {
        id: userData.id?.toString() || userData.user_id?.toString() || '1',
        username: userData.username || username.trim(),
        password: '',
        role: userData.role || role.toLowerCase(),
        name: name.trim() || userData.username || username.trim(), // Frontend için name
        department: department || undefined, // Frontend için department
        phone: userData.phone || phone.trim(),
        email: userData.email || email.trim(),
      };

      // User bilgisini de kaydet
      await AsyncStorage.setItem('user', JSON.stringify(user));

      return {
        user,
        access_token: access_token || null,
      };
    } catch (error: any) {
      console.error('Register error:', error);
      if (error.response) {
        const errorMessage = error.response.data?.detail || 'Kayıt işlemi başarısız';
        throw new Error(errorMessage);
      }
      throw new Error(error.message || 'Kayıt işlemi başarısız');
    }
  },

  async getCurrentUser() {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        throw new Error('Token bulunamadı');
      }
      // Backend'den kullanıcı bilgisini al
      const response = await apiClient.get('/auth/me');
      const userData = response.data;
      
      // User bilgisini formatla
      const user = {
        id: userData.id?.toString() || userData.user_id?.toString() || '1',
        username: userData.username || '',
        password: '', // Şifreyi saklamıyoruz
        role: userData.role || 'worker',
        name: userData.name || userData.username || '',
        department: userData.department || undefined,
        phone: userData.phone || undefined,
        email: userData.email || undefined,
      };
      
      // User bilgisini de kaydet (offline kullanım için)
      await AsyncStorage.setItem('user', JSON.stringify(user));
      
      return user;
    } catch (error: any) {
      console.error('Get current user error:', error);
      // Fallback: Storage'dan al
      try {
        const user = await AsyncStorage.getItem('user');
        if (user) {
          return JSON.parse(user);
        }
      } catch (storageError) {
        // Storage'dan da alınamazsa hata fırlat
      }
      throw new Error(error.response?.data?.detail || error.message || 'Kullanıcı bilgisi alınamadı');
    }
  },

  async isAuthenticated() {
    try {
      const token = await AsyncStorage.getItem('userToken');
      return token !== null;
    } catch (error) {
      return false;
    }
  },

  async logout() {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('user');
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  async updateProfile(data: { full_name: string; email: string; phone: string }) {
    try {
      const response = await apiClient.put('/auth/me', {
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
      });
      
      // Güncellenmiş user bilgisini storage'a kaydet
      const userData = response.data;
      const currentUser = await AsyncStorage.getItem('user');
      if (currentUser) {
        const user = JSON.parse(currentUser);
        const updatedUser = {
          ...user,
          name: userData.full_name || data.full_name,
          email: userData.email || data.email,
          phone: userData.phone || data.phone,
        };
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Update profile error:', error);
      if (error.response) {
        const errorMessage = error.response.data?.detail || 'Profil güncellenemedi';
        throw new Error(errorMessage);
      }
      throw new Error(error.message || 'Profil güncellenemedi');
    }
  },

  async changePassword(data: { current_password: string; new_password: string }) {
    try {
      const response = await apiClient.post('/auth/change-password', {
        current_password: data.current_password,
        new_password: data.new_password,
      });
      return response.data;
    } catch (error: any) {
      console.error('Change password error:', error);
      if (error.response) {
        const errorMessage = error.response.data?.detail || 'Şifre değiştirilemedi';
        throw new Error(errorMessage);
      }
      throw new Error(error.message || 'Şifre değiştirilemedi');
    }
  },

  async listUsers() {
    try {
      const response = await apiClient.get('/auth/users');
      return response.data;
    } catch (error: any) {
      console.error('Error listing users:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Kullanıcılar yüklenemedi');
    }
  },

  async deleteUser(userId: number) {
    try {
      const response = await apiClient.delete(`/auth/users/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error deleting user:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Kullanıcı silinemedi');
    }
  },

  async changeUserRole(userId: number, role: string) {
    try {
      const response = await apiClient.patch(`/auth/users/${userId}/role`, { role });
      return response.data;
    } catch (error: any) {
      console.error('Error changing user role:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Kullanıcı rolü değiştirilemedi');
    }
  },
};

/**
 * Work Orders API
 */
export const workOrdersAPI = {
  async getWorkOrders() {
    try {
      const response = await apiClient.get('/workorders');
      return response.data;
    } catch (error: any) {
      console.error('Error getting work orders:', error);
      throw new Error(error.response?.data?.detail || error.message || 'İş emirleri yüklenemedi');
    }
  },

  async getWorkOrder(woId: number) {
    try {
      const response = await apiClient.get(`/workorders/${woId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting work order:', error);
      throw new Error(error.response?.data?.detail || error.message || 'İş emri yüklenemedi');
    }
  },

  async getWorkOrderStages(woId: number) {
    try {
      const response = await apiClient.get(`/workorders/${woId}/stages`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting work order stages:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Aşamalar yüklenemedi');
    }
  },

  async createWorkOrder(data: {
    product_code: string;
    lot_no: string;
    qty: number;
    planned_start: string;
    planned_end: string;
    stage_count?: number;
  }) {
    try {
      const response = await apiClient.post('/workorders', data);
      return response.data;
    } catch (error: any) {
      console.error('Error creating work order:', error);
      throw new Error(error.response?.data?.detail || error.message || 'İş emri oluşturulamadı');
    }
  },
};

/**
 * Machines API
 */
export const machinesAPI = {
  async getMachines() {
    try {
      const response = await apiClient.get('/machines');
      return response.data;
    } catch (error: any) {
      console.error('Error getting machines:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Makineler yüklenemedi');
    }
  },

  async getMachineReadings(machineId: number, limit: number = 100) {
    try {
      const response = await apiClient.get(
        `/machines/${machineId}/readings`,
        { params: { limit } }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error getting machine readings:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Makine okumaları yüklenemedi');
    }
  },

  async createMachine(data: {
    name: string;
    machine_type: string;
    location?: string;
    status?: string;
  }) {
    try {
      const response = await apiClient.post('/machines', data);
      return response.data;
    } catch (error: any) {
      console.error('Error creating machine:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Makine oluşturulamadı');
    }
  },

  async postMachineReading(machineId: number, data: {
    reading_type: string;
    value: string;
    timestamp?: string;
  }) {
    try {
      const response = await apiClient.post(`/machines/${machineId}/readings`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error posting machine reading:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Makine okuması gönderilemedi');
    }
  },
};

/**
 * Stages API
 */
export const stagesAPI = {
  async startStage(stageId: number) {
    try {
      if (!stageId || typeof stageId !== 'number') {
        throw new Error(`Geçersiz stage ID: ${stageId}`);
      }
      const response = await apiClient.post(`/stages/${stageId}/start`);
      return response.data;
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail || error.message || 'Aşama başlatılamadı';
      console.error('Error starting stage:', {
        stageId,
        status: error.response?.status,
        detail: errorDetail,
        fullError: error
      });
      throw new Error(errorDetail);
    }
  },

  async doneStage(stageId: number) {
    try {
      const response = await apiClient.post(`/stages/${stageId}/done`);
      return response.data;
    } catch (error: any) {
      console.error('Error completing stage:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Aşama tamamlanamadı');
    }
  },

  async issueStage(stageId: number, issueData: { type: string; description?: string }) {
    try {
      const response = await apiClient.post(`/stages/${stageId}/issue`, issueData);
      return response.data;
    } catch (error: any) {
      console.error('Error reporting issue:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Sorun bildirilemedi');
    }
  },

  async pauseStage(stageId: number) {
    try {
      if (!stageId || typeof stageId !== 'number') {
        throw new Error(`Geçersiz stage ID: ${stageId}`);
      }
      const response = await apiClient.post(`/stages/${stageId}/pause`);
      return response.data;
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail || error.message || 'Aşama durdurulamadı';
      console.error('Error pausing stage:', {
        stageId,
        status: error.response?.status,
        detail: errorDetail,
        fullError: error
      });
      throw new Error(errorDetail);
    }
  },

  async resumeStage(stageId: number) {
    try {
      if (!stageId || typeof stageId !== 'number') {
        throw new Error(`Geçersiz stage ID: ${stageId}`);
      }
      const response = await apiClient.post(`/stages/${stageId}/resume`);
      return response.data;
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail || error.message || 'Aşama devam ettirilemedi';
      console.error('Error resuming stage:', {
        stageId,
        status: error.response?.status,
        detail: errorDetail,
        fullError: error
      });
      throw new Error(errorDetail);
    }
  },
};

/**
 * Products API
 */
export const productsAPI = {
  async getProducts() {
    try {
      const response = await apiClient.get('/products');
      return response.data;
    } catch (error: any) {
      console.error('Error getting products:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Ürünler yüklenemedi');
    }
  },

  async getProduct(productId: number) {
    try {
      const response = await apiClient.get(`/products/${productId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting product:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Ürün yüklenemedi');
    }
  },

  async createProduct(data: {
    code: string;
    name: string;
    description?: string;
    // Molds'tan taşınan Excel kolonları
    cavity_count?: number;
    cycle_time_sec?: number;
    injection_temp_c?: number;
    mold_temp_c?: number;
    material?: string;
    part_weight_g?: number;
    hourly_production?: number;
  }) {
    try {
      const response = await apiClient.post('/products', data);
      return response.data;
    } catch (error: any) {
      console.error('Error creating product:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Ürün oluşturulamadı');
    }
  },

  async updateProduct(productId: number, data: {
    name?: string;
    description?: string;
    // Molds'tan taşınan Excel kolonları
    cavity_count?: number;
    cycle_time_sec?: number;
    injection_temp_c?: number;
    mold_temp_c?: number;
    material?: string;
    part_weight_g?: number;
    hourly_production?: number;
  }) {
    try {
      const response = await apiClient.patch(`/products/${productId}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error updating product:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Ürün güncellenemedi');
    }
  },

  async deleteProduct(productId: number) {
    try {
      const response = await apiClient.delete(`/products/${productId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error deleting product:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Ürün silinemedi');
    }
  },

  async restoreProduct(productId: number) {
    try {
      const response = await apiClient.post(`/products/${productId}/restore`);
      return response.data;
    } catch (error: any) {
      console.error('Error restoring product:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Ürün geri yüklenemedi');
    }
  },
};

/**
 * Molds API
 */
export const moldsAPI = {
  async getMolds() {
    try {
      const response = await apiClient.get('/molds');
      return response.data;
    } catch (error: any) {
      console.error('Error getting molds:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Kalıplar yüklenemedi');
    }
  },

  async getMold(moldId: number) {
    try {
      const response = await apiClient.get(`/molds/${moldId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting mold:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Kalıp yüklenemedi');
    }
  },

  async createMold(data: {
    code: string;
    name: string;
    description?: string;
    product_id?: number;
    status?: string;
    // Excel kolonları kaldırıldı - artık products tablosunda
  }) {
    try {
      const response = await apiClient.post('/molds', data);
      return response.data;
    } catch (error: any) {
      console.error('Error creating mold:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Kalıp oluşturulamadı');
    }
  },

  async updateMold(moldId: number, data: {
    name?: string;
    description?: string;
    product_id?: number;
    status?: string;
    // Excel kolonları kaldırıldı - artık products tablosunda
  }) {
    try {
      const response = await apiClient.patch(`/molds/${moldId}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error updating mold:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Kalıp güncellenemedi');
    }
  },

  async deleteMold(moldId: number) {
    try {
      const response = await apiClient.delete(`/molds/${moldId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error deleting mold:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Kalıp silinemedi');
    }
  },

  async restoreMold(moldId: number) {
    try {
      const response = await apiClient.post(`/molds/${moldId}/restore`);
      return response.data;
    } catch (error: any) {
      console.error('Error restoring mold:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Kalıp geri yüklenemedi');
    }
  },
};

/**
 * Metrics API
 */
export const metricsAPI = {
  async getWorkOrderMetrics(woId: number) {
    try {
      const response = await apiClient.get(`/metrics/workorders/${woId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting work order metrics:', error);
      throw new Error(error.response?.data?.detail || error.message || 'İş emri metrikleri yüklenemedi');
    }
  },

  async getStageMetrics(stageId: number) {
    try {
      const response = await apiClient.get(`/metrics/stages/${stageId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting stage metrics:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Aşama metrikleri yüklenemedi');
    }
  },
};

/**
 * Auth API (Admin functions)
 */
export const adminAPI = {
  async listUsers() {
    try {
      const response = await apiClient.get('/auth/users');
      return response.data;
    } catch (error: any) {
      console.error('Error getting users:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Kullanıcılar yüklenemedi');
    }
  },

  async changeUserRole(userId: number, role: string) {
    try {
      const response = await apiClient.patch(`/auth/users/${userId}/role`, { role });
      return response.data;
    } catch (error: any) {
      console.error('Error changing user role:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Kullanıcı rolü değiştirilemedi');
    }
  },

  async deleteUser(userId: number) {
    try {
      const response = await apiClient.delete(`/auth/users/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error deleting user:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Kullanıcı silinemedi');
    }
  },
};

/**
 * Issues API (Admin/Planner)
 */
export const issuesAPI = {
  async listIssues(filters?: {
    status?: string;
    type?: string;
    work_order_stage_id?: number;
  }) {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.work_order_stage_id) params.append('work_order_stage_id', filters.work_order_stage_id.toString());
      
      const queryString = params.toString();
      const url = queryString ? `/issues?${queryString}` : '/issues';
      const response = await apiClient.get(url);
      return response.data;
    } catch (error: any) {
      console.error('Error getting issues:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Sorunlar yüklenemedi');
    }
  },

  async updateIssueStatus(issueId: number, newStatus: string) {
    try {
      const response = await apiClient.patch(`/issues/${issueId}/status?new_status=${newStatus}`);
      return response.data;
    } catch (error: any) {
      console.error('Error updating issue status:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Sorun durumu güncellenemedi');
    }
  },

  async getNotifications(read?: boolean) {
    try {
      const params = read !== undefined ? `?read=${read ? 'true' : 'false'}` : '';
      const response = await apiClient.get(`/issues/notifications${params}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting notifications:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Bildirimler yüklenemedi');
    }
  },

  async markNotificationRead(notificationId: number) {
    try {
      const response = await apiClient.patch(`/issues/notifications/${notificationId}/read`);
      return response.data;
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Bildirim okundu olarak işaretlenemedi');
    }
  },
};

/**
 * Reçete API (AI Tahmin)
 */
export const receteAPI = {
  /**
   * Ürün adına göre reçete bilgilerini getirir
   * Kayıtlı ürün için gerçek değerler, kayıtlı değilse hata döner
   */
  async getRecete(urunAdi: string) {
    try {
      const response = await apiClient.post('/api/recete', { urun_adi: urunAdi });
      return response.data;
    } catch (error: any) {
      console.error('Error getting recete:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Reçete alınamadı');
    }
  },

  /**
   * Malzeme bazlı AI tahmini yapar (yeni ürünler için)
   */
  async getMalzemeTahmin(malzeme: string, parcaAgirligiG: number, gozAdedi: number) {
    try {
      const response = await apiClient.post('/api/ai/tahmin', {
        malzeme: malzeme,
        parca_agirligi_g: parcaAgirligiG,
        goz_adedi: gozAdedi,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error getting AI tahmin:', error);
      throw new Error(error.response?.data?.detail || error.message || 'AI tahmini alınamadı');
    }
  },

  /**
   * Mevcut malzemeleri listeler
   */
  async getMalzemeler() {
    try {
      const response = await apiClient.get('/api/ai/malzemeler');
      return response.data;
    } catch (error: any) {
      console.error('Error getting malzemeler:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Malzemeler alınamadı');
    }
  },

  /**
   * Tüm ürünleri listeler
   */
  async getUrunler() {
    try {
      const response = await apiClient.get('/api/urunler');
      return response.data;
    } catch (error: any) {
      console.error('Error getting urunler:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Ürünler alınamadı');
    }
  },
};