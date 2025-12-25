import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Eğer apiConfig dosyan yoksa veya hataysa, URL'i aşağıda elle yazdım.
// import { API_BASE_URL, API_ENDPOINTS } from './apiConfig'; 

// 1. İŞÇİYİ OLUŞTUR (Genel İstek Aracı)
const apiClient = axios.create({
  baseURL: 'http://10.0.2.2:8000', // Android Emülatör için standart adres
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. ÖNEMLİ: TOKEN EKLEME (Her istekten önce çalışır)
apiClient.interceptors.request.use(
  async (config) => {
    // Telefondan token'ı oku
    const token = await AsyncStorage.getItem('userToken');
    
    // Eğer token varsa, mektubun üzerine yapıştır
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("🔑 Token eklendi:", token.substring(0, 10) + "...");
    } else {
      console.log("⚠️ Token bulunamadı! İstek tokensiz gidiyor.");
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. SERVİSLERİ TANIMLA
export const productionAPI = {
  // Kalıpları Getir
  async getMolds() {
    // apiClient kullanıyoruz ki token eklensin!
    return apiClient.get('/molds'); 
  },

  // Üretim Verilerini Getir (Dashboard için)
  async getProduction() {
    return apiClient.get('/production');
  },

  // Metrikleri Getir
  async getMetrics() {
    return apiClient.get('/production/metrics');
  },
  
  // Ürünleri Getir
  async getProducts() {
      return apiClient.get('/products');
  }
};

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
      
      // User bilgisini formatla (backend'den geliyorsa kullan, yoksa token'dan çıkar)
      let user;
      if (userData) {
        user = {
          id: userData.id?.toString() || userData.user_id?.toString() || '1',
          username: userData.username || username.trim(),
          password: '', // Şifreyi saklamıyoruz
          role: userData.role || 'operator',
          name: userData.name || userData.username || username.trim(),
          department: userData.department || undefined,
          phone: userData.phone || undefined,
          email: userData.email || undefined,
        };
      } else {
        // Backend'den user bilgisi gelmediyse, username'den oluştur
        user = {
          id: '1',
          username: username.trim(),
          password: '',
          role: 'operator', // Varsayılan rol
          name: username.trim(),
        };
      }
      
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

  async getCurrentUser() {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        throw new Error('Token bulunamadı');
      }
      // Token'dan user bilgisini decode etmek için backend'e istek atabiliriz
      // Şimdilik token'dan user bilgisini çıkaramıyoruz, bu yüzden storage'dan alalım
      // Backend'de /auth/me endpoint'i yok, bu yüzden tokenStorage'dan alıyoruz
      const user = await AsyncStorage.getItem('user');
      if (user) {
        return JSON.parse(user);
      }
      throw new Error('Kullanıcı bilgisi bulunamadı');
    } catch (error: any) {
      console.error('Get current user error:', error);
      throw new Error(error.message || 'Kullanıcı bilgisi alınamadı');
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
};

/**
 * Work Orders API
 */
export const workOrdersAPI = {
  async getWorkOrders() {
    try {
      const response = await apiClient.get('/workorders/');
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
  }) {
    try {
      const response = await apiClient.post('/workorders/', data);
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
      const response = await apiClient.get('/machines/');
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
      const response = await apiClient.post('/machines/', data);
      return response.data;
    } catch (error: any) {
      console.error('Error creating machine:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Makine oluşturulamadı');
    }
  },
};

/**
 * Stages API
 */
export const stagesAPI = {
  async startStage(stageId: number) {
    try {
      const response = await apiClient.post(`/stages/${stageId}/start`);
      return response.data;
    } catch (error: any) {
      console.error('Error starting stage:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Aşama başlatılamadı');
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
};

/**
 * Products API
 */
export const productsAPI = {
  async getProducts() {
    try {
      const response = await apiClient.get('/products/');
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
};

/**
 * Molds API
 */
export const moldsAPI = {
  async getMolds() {
    try {
      const response = await apiClient.get('/molds/');
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
};