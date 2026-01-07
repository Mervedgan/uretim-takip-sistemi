/**
 * Ürünler Ekranı
 * Production_db'deki ürünleri listeler
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { User } from '../types';
import { productsAPI, moldsAPI, workOrdersAPI } from '../utils/api';

interface ProductsScreenProps {
  user: User;
  onBack: () => void;
}

interface Product {
  id: number;
  code: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

interface Mold {
  id: number;
  code: string;
  name: string;
  product_id?: number;
  // Excel kolonları kaldırıldı - artık Product interface'inde
}

interface WorkOrder {
  id: number;
  product_code: string;
  produced_qty: number;
  qty: number;  // Hedef üretim miktarı
  machine_id?: number | null;  // Operatör tarafından başlatıldıysa dolu
}

interface ProductWithDetails extends Product {
  mold?: Mold;
  producedQty: number;
  isActive: boolean;  // Aktif üretimde mi?
}

const ProductsScreen: React.FC<ProductsScreenProps> = ({ user, onBack }) => {
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Ürün ekleme/silme için state'ler
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [addingProduct, setAddingProduct] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(false);
  
  // Yeni ürün form state'leri
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [cavityCount, setCavityCount] = useState('');
  const [cycleTime, setCycleTime] = useState('');
  const [injectionTemp, setInjectionTemp] = useState('');
  const [moldTemp, setMoldTemp] = useState('');
  const [material, setMaterial] = useState('');
  const [partWeight, setPartWeight] = useState('');
  const [hourlyProduction, setHourlyProduction] = useState('');
  const [selectedMoldId, setSelectedMoldId] = useState<number | null>(null);
  const [molds, setMolds] = useState<Mold[]>([]);
  
  // Sadece planner ve admin ürün ekleyebilir/silebilir
  const canManageProducts = user.role === 'planner' || user.role === 'admin';

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      // Products yükle
      const productsData = await productsAPI.getProducts();
      const allProducts: Product[] = Array.isArray(productsData) ? productsData : [];
      
      // Molds yükle
      const moldsData = await moldsAPI.getMolds();
      const allMolds: Mold[] = Array.isArray(moldsData) ? moldsData : [];
      setMolds(allMolds); // Molds'ı state'e kaydet
      
      // Work orders yükle (mevcut ürün sayısı için)
      const woResponse = await workOrdersAPI.getWorkOrders();
      const woData = woResponse.data || woResponse;
      const allWorkOrders: WorkOrder[] = Array.isArray(woData) ? woData : [];
      
      // Her ürün için mold ve produced_qty bilgilerini ekle
      const productsWithDetails: ProductWithDetails[] = allProducts.map(product => {
        // Bu ürüne ait mold'u bul
        const mold = allMolds.find(m => m.product_id === product.id);
        
        // Bu ürün için work order'ları bul ve toplam produced_qty hesapla
        const productWorkOrders = allWorkOrders.filter(wo => wo.product_code === product.code);
        const totalProducedQty = productWorkOrders.reduce((sum, wo) => sum + (wo.produced_qty || 0), 0);
        
        // Aktif üretimde mi? (Operatör tarafından başlatılmış VE tamamlanmamış work order var mı?)
        // machine_id varsa operatör tarafından başlatılmış demektir
        const hasActiveWorkOrder = productWorkOrders.some(wo => 
          wo.machine_id && (wo.produced_qty || 0) < (wo.qty || 0)
        );
        
        return {
          ...product,
          mold: mold,
          producedQty: totalProducedQty,
          isActive: hasActiveWorkOrder,
        };
      });
      
      setProducts(productsWithDetails);
    } catch (error: any) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const toggleProduct = (productId: number) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleAddProduct = async () => {
    // Validation
    if (!productName.trim()) {
      Alert.alert('Hata', 'Lütfen ürün adı girin!');
      return;
    }

    // Ürün kodu otomatik oluştur (ürün adından)
    const autoProductCode = productName.trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '-')
      .substring(0, 10);

    try {
      setAddingProduct(true);
      await productsAPI.createProduct({
        code: autoProductCode,
        name: productName.trim(),
        description: description.trim() || undefined,
        cavity_count: cavityCount.trim() ? parseInt(cavityCount) : undefined,
        cycle_time_sec: cycleTime.trim() ? parseFloat(cycleTime) : undefined,
        injection_temp_c: injectionTemp.trim() ? parseFloat(injectionTemp) : undefined,
        mold_temp_c: moldTemp.trim() ? parseFloat(moldTemp) : undefined,
        material: material.trim() || undefined,
        part_weight_g: partWeight.trim() ? parseFloat(partWeight) : undefined,
        hourly_production: hourlyProduction.trim() ? parseFloat(hourlyProduction) : undefined,
      });

      // Eğer kalıp seçildiyse, kalıbı güncelle
      if (selectedMoldId) {
        const productsData = await productsAPI.getProducts();
        const newProduct = Array.isArray(productsData) 
          ? productsData.find((p: any) => p.code === autoProductCode)
          : null;
        
        if (newProduct) {
          await moldsAPI.updateMold(selectedMoldId, {
            product_id: newProduct.id,
          });
        }
      }

      Alert.alert('Başarılı', 'Ürün başarıyla eklendi!');
      setShowAddModal(false);
      await loadProducts();
    } catch (error: any) {
      console.error('Error adding product:', error);
      Alert.alert('Hata', error.message || 'Ürün eklenirken bir hata oluştu!');
    } finally {
      setAddingProduct(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProductId) return;

    try {
      setDeletingProduct(true);
      await productsAPI.deleteProduct(selectedProductId);
      Alert.alert('Başarılı', 'Ürün başarıyla silindi!');
      setShowDeleteModal(false);
      setSelectedProductId(null);
      await loadProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      Alert.alert('Hata', error.message || 'Ürün silinirken bir hata oluştu!');
    } finally {
      setDeletingProduct(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ÜRÜNLER</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Ürün Listesi</Text>
          {canManageProducts && (
            <TouchableOpacity style={styles.addButtonContent} onPress={() => {
              setProductCode('');
              setProductName('');
              setDescription('');
              setCavityCount('');
              setCycleTime('');
              setInjectionTemp('');
              setMoldTemp('');
              setMaterial('');
              setPartWeight('');
              setHourlyProduction('');
              setSelectedMoldId(null);
              setShowAddModal(true);
            }}>
              <Text style={styles.addButtonText}>+ Ürün Ekle</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Arama Çubuğu */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Ürün adı veya kodu ile ara..."
            placeholderTextColor="#95a5a6"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {(() => {
          // Arama sorgusuna göre filtrele
          const filteredProducts = searchQuery.trim() === '' 
            ? products 
            : products.filter(product => {
                const query = searchQuery.toLowerCase().trim();
                const productName = (product.name || '').toLowerCase();
                const productCode = (product.code || '').toLowerCase();
                
                return (
                  productName.includes(query) ||
                  productCode.includes(query)
                );
              });

          return loading && products.length === 0 ? (
            <ActivityIndicator size="large" color="#3498db" style={{ marginVertical: 40 }} />
          ) : filteredProducts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {searchQuery.trim() ? 'Arama sonucu bulunamadı' : 'Ürün bulunmamaktadır.'}
              </Text>
            </View>
          ) : (
            filteredProducts.map((product) => {
            const mold = product.mold;
            // Excel kolonları artık product'ta
            const cycleTime = product.cycle_time_sec || 0;
            const hourlyOutput = product.hourly_production || 0;
            const injectionTemp = product.injection_temp_c || 0;
            const moldTemp = product.mold_temp_c || 0;
            const material = product.material || '-';
            const partWeight = product.part_weight_g || 0;
            // Kalıp kodu: önce mold.code, yoksa product.code kullan
            const moldCode = mold?.code || product.code || '-';
            const isExpanded = expandedProducts.has(product.id);
            
            return (
              <View key={product.id} style={styles.productCard}>
                {/* Tıklanabilir Header - Sadece Ürün Adı */}
                <TouchableOpacity 
                  style={styles.productHeaderButton}
                  onPress={() => toggleProduct(product.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.productHeader}>
                    <Text style={styles.productNameCollapsed}>{product.name}</Text>
                    <View style={styles.productHeaderRight}>
                      {canManageProducts && (
                        <TouchableOpacity
                          style={styles.deleteIconButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            setSelectedProductId(product.id);
                            setShowDeleteModal(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.deleteIcon}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                      <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                
                {/* Detaylar - Sadece açıkken göster */}
                {isExpanded && (
                  <View style={styles.productDetails}>
                    {/* Header - Sadece aktif üretimde ise badge göster */}
                    {product.isActive && (
                      <View style={styles.detailHeader}>
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusText}>Aktif</Text>
                        </View>
                      </View>
                    )}
                    
                    {/* Metrikler - 4 ayrı kutucuk */}
                    <View style={styles.metricsRow}>
                      <View style={styles.metricBox}>
                        <Text style={styles.metricIcon}>⏱</Text>
                        <Text style={styles.metricLabel}>Cycle Time</Text>
                        <Text style={styles.metricValue}>{cycleTime} sec</Text>
                      </View>
                      <View style={styles.metricBox}>
                        <Text style={styles.metricIcon}>📊</Text>
                        <Text style={styles.metricLabel}>Mevcut Ürün</Text>
                        <Text style={styles.metricValue}>{product.producedQty} adet</Text>
                      </View>
                    </View>
                    <View style={styles.metricsRow}>
                      <View style={styles.metricBox}>
                        <Text style={styles.metricIcon}>📦</Text>
                        <Text style={styles.metricLabel}>Hourly Output</Text>
                        <Text style={styles.metricValue}>{hourlyOutput} pcs</Text>
                      </View>
                      <View style={styles.metricBox}>
                        <Text style={styles.metricIcon}>🏭</Text>
                        <Text style={styles.metricLabel}>Kalıp</Text>
                        <Text style={styles.metricValue}>{moldCode}</Text>
                      </View>
                    </View>
                    
                    {/* Alt Bilgiler */}
                    <View style={styles.detailsRow}>
                      <Text style={styles.detailText}>Inj: {injectionTemp}°C</Text>
                      <Text style={styles.detailText}>Mold: {moldTemp}°C</Text>
                      <Text style={styles.detailText}>{material}</Text>
                      <Text style={styles.detailText}>{partWeight}g</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })
          );
        })()}
      </ScrollView>

      {/* Ürün Ekleme Modal'ı */}
      {canManageProducts && (
        <Modal
          visible={showAddModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalOverlay}>
            <ScrollView style={styles.modalScrollView} nestedScrollEnabled={true}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Yeni Ürün Ekle</Text>
                
                <Text style={styles.modalLabel}>Ürün Adı *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Örn: Şişe Kapağı"
                  value={productName}
                  onChangeText={setProductName}
                  autoCapitalize="words"
                />

                <Text style={styles.modalLabel}>Açıklama</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Opsiyonel açıklama"
                  value={description}
                  onChangeText={setDescription}
                />

                <Text style={styles.modalLabel}>Göz Adedi</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Örn: 4"
                  value={cavityCount}
                  onChangeText={setCavityCount}
                  keyboardType="numeric"
                />

                <Text style={styles.modalLabel}>Çevrim Süresi (saniye)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Örn: 15"
                  value={cycleTime}
                  onChangeText={setCycleTime}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.modalLabel}>Enjeksiyon Sıcaklığı (°C)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Örn: 200"
                  value={injectionTemp}
                  onChangeText={setInjectionTemp}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.modalLabel}>Kalıp Sıcaklığı (°C)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Örn: 30"
                  value={moldTemp}
                  onChangeText={setMoldTemp}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.modalLabel}>Malzeme</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Örn: PP, ABS, PC"
                  value={material}
                  onChangeText={setMaterial}
                  autoCapitalize="characters"
                />

                <Text style={styles.modalLabel}>Parça Ağırlığı (g)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Örn: 6"
                  value={partWeight}
                  onChangeText={setPartWeight}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.modalLabel}>Saatlik Üretim</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Örn: 1920"
                  value={hourlyProduction}
                  onChangeText={setHourlyProduction}
                  keyboardType="numeric"
                />

                <Text style={styles.modalLabel}>Kalıp Seçimi (Opsiyonel)</Text>
                <ScrollView style={styles.moldsListScroll} nestedScrollEnabled={true}>
                  {molds.map((mold) => (
                    <TouchableOpacity
                      key={mold.id}
                      style={[
                        styles.moldItem,
                        selectedMoldId === mold.id && styles.moldItemSelected
                      ]}
                      onPress={() => setSelectedMoldId(mold.id)}
                    >
                      <Text style={styles.moldItemText}>
                        {mold.code} - {mold.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setShowAddModal(false)}
                    disabled={addingProduct}
                  >
                    <Text style={styles.modalButtonCancelText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSave]}
                    onPress={handleAddProduct}
                    disabled={addingProduct}
                  >
                    {addingProduct ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.modalButtonSaveText}>Kaydet</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Ürün Silme Onay Modal'ı */}
      {canManageProducts && (
        <Modal
          visible={showDeleteModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDeleteModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.deleteModalContent}>
              <Text style={styles.modalTitle}>Ürünü Sil</Text>
              <Text style={styles.deleteConfirmText}>
                Bu ürünü silmek istediğinize emin misiniz?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowDeleteModal(false);
                    setSelectedProductId(null);
                  }}
                  disabled={deletingProduct}
                >
                  <Text style={styles.modalButtonCancelText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonDelete]}
                  onPress={handleDeleteProduct}
                  disabled={deletingProduct}
                >
                  {deletingProduct ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.modalButtonDeleteText}>Sil</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecf0f1',
  },
  header: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 50,
  },
  addButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  userInfo: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  addButtonContent: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  productHeaderButton: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productNameCollapsed: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  productHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteIconButton: {
    padding: 5,
  },
  deleteIcon: {
    fontSize: 20,
  },
  expandIcon: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  productDetails: {
    padding: 20,
    paddingTop: 15,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  statusBadge: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 10,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  metricIcon: {
    fontSize: 20,
    marginBottom: 5,
  },
  metricLabel: {
    fontSize: 11,
    color: '#7f8c8d',
    marginBottom: 4,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  detailText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 15,
    marginTop: 10,
  },
  searchInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14,
    color: '#2c3e50',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    maxHeight: '90%',
    width: '90%',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginVertical: 20,
  },
  deleteModalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 12,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  moldsListScroll: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 8,
  },
  moldItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  moldItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  moldItemText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  deleteConfirmText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#95a5a6',
  },
  modalButtonCancelText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonSave: {
    backgroundColor: '#27ae60',
  },
  modalButtonSaveText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalButtonDelete: {
    backgroundColor: '#e74c3c',
  },
  modalButtonDeleteText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ProductsScreen;

