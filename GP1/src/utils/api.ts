import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Eğer apiConfig dosyan yoksa veya hataysa, URL'i aşağıda elle yazdım.
// import { API_BASE_URL, API_ENDPOINTS } from './apiConfig';

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
  baseURL: 'http://10.0.2.2:8000', // Android Emülatör için standart adres
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
      
      // User bilgisini formatla
      let user;
      if (userData) {
        // Backend'den user bilgisi geliyorsa kullan
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
              role: decodedRole || 'operator', // Token'dan gelen role bilgisini kullan
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
            role: 'operator', // Son çare: varsayılan rol
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