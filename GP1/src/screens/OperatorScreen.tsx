/**
 * Operatör Ekranı
 * Dashboard ve Üretim Girişi
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { User, ProductionRecord, ProductionStage } from '../types';
import { productionStore } from '../data/productionStore';
import { workOrdersAPI, machinesAPI, stagesAPI, metricsAPI, productsAPI } from '../utils/api';

interface OperatorScreenProps {
  user: User;
  onBack: () => void;
}

// Backend veri tipleri
interface WorkOrder {
  id: number;
  product_code: string;
  lot_no: string;
  qty: number;
  planned_start: string;
  planned_end: string;
}

interface WorkOrderStage {
  id: number;
  work_order_id: number;
  stage_name: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: 'planned' | 'in_progress' | 'done';
}

interface Machine {
  id: number;
  name: string;
  machine_type: string;
  location: string | null;
  status: string;
}

interface MachineReading {
  id: number;
  machine_id: number;
  reading_type: string;
  value: string;
  timestamp: string;
}

const OperatorScreen: React.FC<OperatorScreenProps> = ({ user, onBack }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new'>('dashboard');
  
  // Dashboard state
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<number | null>(null);
  const [stages, setStages] = useState<WorkOrderStage[]>([]);
  const [machineReadings, setMachineReadings] = useState<MachineReading[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [processingStageId, setProcessingStageId] = useState<number | null>(null);

  // Form state
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [lotNo, setLotNo] = useState('');
  const [targetCount, setTargetCount] = useState('');
  const [cycleTime, setCycleTime] = useState('');
  const [machineId, setMachineId] = useState('');
  const [stageCount, setStageCount] = useState('');
  const [stageNames, setStageNames] = useState<string[]>([]);
  const [showStages, setShowStages] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  // Load products when new production tab is active
  useEffect(() => {
    if (activeTab === 'new') {
      loadProducts();
    }
  }, [activeTab]);

  // Load dashboard data
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
    }
  }, [activeTab]);

  // Auto-refresh dashboard every 5 seconds
  useEffect(() => {
    if (activeTab === 'dashboard') {
      const interval = setInterval(() => {
        loadDashboardData();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const loadProducts = async () => {
    try {
      const productsResponse = await productsAPI.getProducts();
      const allProducts = Array.isArray(productsResponse) ? productsResponse : [];
      setProducts(allProducts);
    } catch (error: any) {
      console.error('Error loading products:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load work orders
      const woResponse = await workOrdersAPI.getWorkOrders();
      // Backend returns { total, data, requested_by } or just array
      const woData = woResponse.data || woResponse;
      setWorkOrders(Array.isArray(woData) ? woData : []);

      // Load machines
      const machinesResponse = await machinesAPI.getMachines();
      // Backend returns { total, data } or just array
      const machinesData = machinesResponse.data || machinesResponse;
      setMachines(Array.isArray(machinesData) ? machinesData : []);

      // Select first active machine if available
      const activeMachine = machines.find(m => m.status === 'active') || machines[0];
      if (activeMachine && !selectedMachine) {
        setSelectedMachine(activeMachine.id);
        loadMachineReadings(activeMachine.id);
      }
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      // Don't show alert on every refresh, just log
    } finally {
      setLoading(false);
    }
  };

  const loadWorkOrderStages = async (woId: number) => {
    try {
      const stagesData = await workOrdersAPI.getWorkOrderStages(woId);
      setStages(Array.isArray(stagesData) ? stagesData : []);
      setSelectedWorkOrder(woId);
    } catch (error: any) {
      console.error('Error loading stages:', error);
      Alert.alert('Hata', 'Aşamalar yüklenemedi: ' + error.message);
    }
  };

  const loadMachineReadings = async (machineId: number) => {
    try {
      const readingsData = await machinesAPI.getMachineReadings(machineId, 10);
      setMachineReadings(Array.isArray(readingsData.data) ? readingsData.data : []);
      setSelectedMachine(machineId);
    } catch (error: any) {
      console.error('Error loading machine readings:', error);
    }
  };

  const handleStartStage = async (stageId: number) => {
    if (processingStageId !== null) {
      return; // Already processing
    }
    
    try {
      setProcessingStageId(stageId);
      console.log('Starting stage:', stageId);
      await stagesAPI.startStage(stageId);
      Alert.alert('Başarılı', 'Aşama başlatıldı!');
      if (selectedWorkOrder) {
        await loadWorkOrderStages(selectedWorkOrder);
      }
      loadDashboardData(); // Refresh dashboard
    } catch (error: any) {
      console.error('Error starting stage:', error);
      Alert.alert('Hata', error.message || 'Aşama başlatılamadı');
    } finally {
      setProcessingStageId(null);
    }
  };

  const handleDoneStage = async (stageId: number) => {
    if (processingStageId !== null) {
      return; // Already processing
    }
    
    try {
      setProcessingStageId(stageId);
      console.log('Completing stage:', stageId);
      await stagesAPI.doneStage(stageId);
      Alert.alert('Başarılı', 'Aşama tamamlandı!');
      if (selectedWorkOrder) {
        await loadWorkOrderStages(selectedWorkOrder);
      }
      loadDashboardData(); // Refresh dashboard
    } catch (error: any) {
      console.error('Error completing stage:', error);
      Alert.alert('Hata', error.message || 'Aşama tamamlanamadı');
    } finally {
      setProcessingStageId(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    if (selectedMachine) {
      await loadMachineReadings(selectedMachine);
    }
    if (selectedWorkOrder) {
      await loadWorkOrderStages(selectedWorkOrder);
    }
    setRefreshing(false);
  };

  // Aşama sayısı değiştiğinde input alanlarını oluştur
  const handleStageCountChange = (count: string) => {
    const countNum = parseInt(count) || 0;
    setStageCount(count);
    
    if (countNum > 0 && countNum <= 10) {
      const newStageNames = Array(countNum).fill('').map((_, index) => 
        stageNames[index] || ''
      );
      setStageNames(newStageNames);
      setShowStages(true);
    } else if (countNum === 0) {
      setStageNames([]);
      setShowStages(false);
    }
  };

  // Aşama ismini güncelle
  const handleStageNameChange = (index: number, name: string) => {
    const newStageNames = [...stageNames];
    newStageNames[index] = name;
    setStageNames(newStageNames);
  };

  // Aşamaları oluştur
  const createStages = (): ProductionStage[] => {
    return stageNames
      .filter(name => name.trim() !== '')
      .map((name, index) => ({
        id: `stage-${index + 1}`,
        name: name.trim(),
        order: index + 1,
        status: 'pending' as const
      }));
  };

  const handleStartProduction = async () => {
    // Validasyonlar
    if (!productCode.trim()) {
      Alert.alert('Hata', 'Lütfen ürün kodu girin!');
      return;
    }

    if (!lotNo.trim()) {
      Alert.alert('Hata', 'Lütfen lot numarası girin!');
      return;
    }

    if (!targetCount.trim() || isNaN(parseInt(targetCount)) || parseInt(targetCount) <= 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir hedef miktar girin!');
      return;
    }

    try {
      setLoading(true);

      // Tarih hesaplamaları - şimdi başla, 4 saat sonra bitir (varsayılan)
      const now = new Date();
      const endTime = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 saat sonra

      // Backend'e work order oluştur
      const workOrderData = {
        product_code: productCode.trim(),
        lot_no: lotNo.trim(),
        qty: parseInt(targetCount),
        planned_start: now.toISOString(),
        planned_end: endTime.toISOString(),
      };

      console.log('📤 OperatorScreen - Work order oluşturuluyor:', workOrderData);
      const result = await workOrdersAPI.createWorkOrder(workOrderData);
      
      // Work order oluşturulduktan sonra ilk stage'i başlat
      if (result.work_order_id && result.stages && result.stages.length > 0) {
        const firstStageId = result.stages[0].id;
        if (firstStageId && typeof firstStageId === 'number') {
          try {
            await stagesAPI.startStage(firstStageId);
            console.log('✅ İlk stage başlatıldı:', firstStageId);
          } catch (stageError: any) {
            const errorMessage = stageError.response?.data?.detail || stageError.message || 'Bilinmeyen hata';
            console.error('⚠️ Stage başlatılamadı (work order oluşturuldu):', errorMessage);
            // Stage başlatılamasa bile devam et - work order zaten oluşturuldu
          }
        } else {
          console.warn('⚠️ Stage ID geçersiz:', firstStageId);
        }
      }

      // Formu temizle
      setProductCode('');
      setProductName('');
      setLotNo('');
      setTargetCount('');
      setCycleTime('');
      setMachineId('');
      setStageCount('');
      setStageNames([]);
      setShowStages(false);

      Alert.alert(
        'Başarılı', 
        `Üretim başlatıldı!\nWork Order ID: ${result.work_order_id}\nDashboard'daki "Aktif Üretimler" bölümünden takip edebilirsiniz.`,
        [{ text: 'Tamam', onPress: () => {
          setActiveTab('dashboard');
          loadDashboardData(); // Dashboard'ı yenile
        }}]
      );
    } catch (error: any) {
      console.error('Error creating work order:', error);
      Alert.alert(
        'Hata', 
        error.response?.data?.detail || error.message || 'Üretim başlatılamadı. Lütfen tekrar deneyin.'
      );
    } finally {
      setLoading(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
      case 'active':
        return '#27ae60';
      case 'in_progress':
        return '#f39c12';
      case 'planned':
        return '#3498db';
      default:
        return '#95a5a6';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'done':
        return 'Tamamlandı';
      case 'in_progress':
        return 'Devam Ediyor';
      case 'planned':
        return 'Planlandı';
      default:
        return status;
    }
  };

  const renderDashboard = () => {
    const activeWorkOrders = workOrders.filter(wo => {
      const endDate = new Date(wo.planned_end);
      return endDate > new Date();
    });

    return (
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Operatör: {user.name}</Text>
        </View>

        {/* Aktif İş Emirleri */}
        <View style={styles.dashboardCard}>
          <Text style={styles.cardTitle}>📋 Aktif İş Emirleri</Text>
          {loading && !workOrders.length ? (
            <ActivityIndicator size="small" color="#3498db" style={{ marginVertical: 20 }} />
          ) : activeWorkOrders.length === 0 ? (
            <Text style={styles.emptyText}>Aktif iş emri bulunmuyor</Text>
          ) : (
            activeWorkOrders.slice(0, 5).map((wo) => (
              <TouchableOpacity
                key={wo.id}
                style={[
                  styles.workOrderItem,
                  selectedWorkOrder === wo.id && styles.workOrderItemSelected
                ]}
                onPress={() => loadWorkOrderStages(wo.id)}
              >
                <View style={styles.workOrderHeader}>
                  <Text style={styles.workOrderTitle}>İş Emri #{wo.id}</Text>
                  <Text style={styles.workOrderCode}>{wo.product_code}</Text>
                </View>
                <Text style={styles.workOrderDetail}>Lot: {wo.lot_no}</Text>
                <Text style={styles.workOrderDetail}>Miktar: {wo.qty}</Text>
                <Text style={styles.workOrderDetail}>
                  Başlangıç: {formatDate(wo.planned_start)}
                </Text>
                <Text style={styles.workOrderDetail}>
                  Bitiş: {formatDate(wo.planned_end)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* İş Emri Aşamaları */}
        {selectedWorkOrder && stages.length > 0 && (
          <View style={styles.dashboardCard}>
            <Text style={styles.cardTitle}>🔄 İş Emri Aşamaları (WO #{selectedWorkOrder})</Text>
            {stages.map((stage) => (
              <View key={stage.id} style={styles.stageItem}>
                <View style={styles.stageHeader}>
                  <Text style={styles.stageName}>{stage.stage_name}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(stage.status) }
                    ]}
                  >
                    <Text style={styles.statusText}>{getStatusText(stage.status)}</Text>
                  </View>
                </View>
                {stage.planned_start && (
                  <Text style={styles.stageDetail}>
                    Planlanan: {formatDate(stage.planned_start)} - {formatDate(stage.planned_end)}
                  </Text>
                )}
                {stage.actual_start && (
                  <Text style={styles.stageDetail}>
                    Gerçek: {formatDate(stage.actual_start)}
                    {stage.actual_end ? ` - ${formatDate(stage.actual_end)}` : ''}
                  </Text>
                )}
                <View style={styles.stageActions}>
                  {stage.status === 'planned' && (
                    <TouchableOpacity
                      style={[
                        styles.actionButton, 
                        styles.startButton,
                        processingStageId === stage.id && styles.actionButtonDisabled
                      ]}
                      onPress={() => handleStartStage(stage.id)}
                      disabled={processingStageId !== null}
                      activeOpacity={0.7}
                    >
                      {processingStageId === stage.id ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.actionButtonText}>Başlat</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {stage.status === 'in_progress' && (
                    <TouchableOpacity
                      style={[
                        styles.actionButton, 
                        styles.doneButton,
                        processingStageId === stage.id && styles.actionButtonDisabled
                      ]}
                      onPress={() => handleDoneStage(stage.id)}
                      disabled={processingStageId !== null}
                      activeOpacity={0.7}
                    >
                      {processingStageId === stage.id ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.actionButtonText}>Tamamla</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Makineler */}
        <View style={styles.dashboardCard}>
          <Text style={styles.cardTitle}>🏭 Makineler</Text>
          {loading && !machines.length ? (
            <ActivityIndicator size="small" color="#3498db" style={{ marginVertical: 20 }} />
          ) : machines.length === 0 ? (
            <Text style={styles.emptyText}>Makine bulunmuyor</Text>
          ) : (
            machines.map((machine) => (
              <TouchableOpacity
                key={machine.id}
                style={[
                  styles.machineItem,
                  selectedMachine === machine.id && styles.machineItemSelected
                ]}
                onPress={() => loadMachineReadings(machine.id)}
              >
                <View style={styles.machineHeader}>
                  <Text style={styles.machineName}>{machine.name}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(machine.status) }
                    ]}
                  >
                    <Text style={styles.statusText}>{machine.status}</Text>
                  </View>
                </View>
                <Text style={styles.machineDetail}>Tip: {machine.machine_type}</Text>
                {machine.location && (
                  <Text style={styles.machineDetail}>Konum: {machine.location}</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Makine Okumaları */}
        {selectedMachine && machineReadings.length > 0 && (
          <View style={styles.dashboardCard}>
            <Text style={styles.cardTitle}>
              📊 Makine Okumaları ({machines.find(m => m.id === selectedMachine)?.name || 'Makine'})
            </Text>
            {machineReadings.slice(0, 5).map((reading) => (
              <View key={reading.id} style={styles.readingItem}>
                <View style={styles.readingHeader}>
                  <Text style={styles.readingType}>{reading.reading_type}</Text>
                  <Text style={styles.readingValue}>{reading.value}</Text>
                </View>
                <Text style={styles.readingTime}>
                  {formatDate(reading.timestamp)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderNewProduction = () => {
    return (
      <ScrollView style={styles.content}>
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Operatör: {user.name}</Text>
        </View>

        {/* Üretim Başlatma Formu */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Yeni Üretim Başlat</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Ürün Kodu *</Text>
            <TextInput
              style={styles.input}
              value={productCode}
              onChangeText={setProductCode}
              placeholder="Örn: PRD-001, PRD-002..."
              autoCapitalize="none"
            />
            <Text style={styles.hintText}>
              Database'de kayıtlı ürün kodunu girin
            </Text>
            {products.length > 0 && (
              <View style={styles.productsList}>
                <Text style={styles.productsListTitle}>Mevcut Ürünler:</Text>
                {products.slice(0, 5).map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.productItem}
                    onPress={() => {
                      setProductCode(product.code);
                      setProductName(product.name);
                    }}
                  >
                    <Text style={styles.productItemText}>
                      {product.code} - {product.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Lot Numarası *</Text>
            <TextInput
              style={styles.input}
              value={lotNo}
              onChangeText={setLotNo}
              placeholder="Örn: LOT-001, LOT-2024-01..."
              autoCapitalize="none"
            />
            <Text style={styles.hintText}>
              Bu üretim için lot numarası girin
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Hedef Ürün Sayısı *</Text>
            <TextInput
              style={styles.input}
              value={targetCount}
              onChangeText={setTargetCount}
              placeholder="Hedef miktarı girin"
              keyboardType="numeric"
            />
            <Text style={styles.hintText}>
              Üretilmesi planlanan toplam ürün sayısı
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Cycle Time (Saniye) *</Text>
            <TextInput
              style={styles.input}
              value={cycleTime}
              onChangeText={setCycleTime}
              placeholder="Örn: 5.5 (1 ürün kaç saniyede üretiliyor)"
              keyboardType="decimal-pad"
            />
            <Text style={styles.hintText}>
              Bir ürünün üretilmesi için geçen süre (saniye cinsinden)
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Üretim Aşama Sayısı (Opsiyonel)</Text>
            <TextInput
              style={styles.input}
              value={stageCount}
              onChangeText={handleStageCountChange}
              placeholder="Örn: 3 (Parça Basım, Montaj, Boyama)"
              keyboardType="numeric"
            />
            <Text style={styles.hintText}>
              Ürün birden fazla aşamada üretiliyorsa aşama sayısını girin
            </Text>
          </View>

          {/* Aşama İsimleri */}
          {showStages && stageNames.length > 0 && (
            <View style={styles.stagesContainer}>
              <Text style={styles.stagesTitle}>Aşama İsimleri</Text>
              {stageNames.map((stageName, index) => (
                <View key={index} style={styles.stageInputContainer}>
                  <Text style={styles.stageLabel}>Aşama {index + 1}:</Text>
                  <TextInput
                    style={styles.input}
                    value={stageName}
                    onChangeText={(name) => handleStageNameChange(index, name)}
                    placeholder={`Aşama ${index + 1} adı (örn: Parça Basım)`}
                  />
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity 
            style={styles.startButton} 
            onPress={handleStartProduction}
          >
            <Text style={styles.startButtonText}>ÜRETİMİ BAŞLAT</Text>
          </TouchableOpacity>
        </View>

        {/* Bilgi Kartı */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ Bilgi</Text>
          <Text style={styles.infoText}>
            • Üretim başlatıldıktan sonra Dashboard'daki "Aktif Üretimler" bölümünden takip edebilirsiniz.
          </Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>OPERATÖR PANELİ</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dashboard' && styles.tabActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>
            📊 Dashboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'new' && styles.tabActive]}
          onPress={() => setActiveTab('new')}
        >
          <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>
            ➕ Yeni Üretim
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'dashboard' ? renderDashboard() : renderNewProduction()}
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3498db',
  },
  tabText: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#3498db',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  userInfo: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  dashboardCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    paddingVertical: 20,
  },
  workOrderItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  workOrderItemSelected: {
    borderColor: '#3498db',
    backgroundColor: '#ebf5fb',
  },
  workOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workOrderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  workOrderCode: {
    fontSize: 14,
    color: '#3498db',
    fontWeight: '600',
  },
  workOrderDetail: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  stageItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  stageDetail: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  stageActions: {
    marginTop: 10,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  startButton: {
    backgroundColor: '#27ae60',
  },
  doneButton: {
    backgroundColor: '#f39c12',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  machineItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  machineItemSelected: {
    borderColor: '#3498db',
    backgroundColor: '#ebf5fb',
  },
  machineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  machineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  machineDetail: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  readingItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  readingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  readingType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  readingValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3498db',
  },
  readingTime: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  hintText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 5,
    fontStyle: 'italic',
  },
  productsList: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  productsListTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  productItem: {
    padding: 8,
    marginBottom: 4,
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  productItemText: {
    fontSize: 14,
    color: '#3498db',
  },
  stagesContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  stagesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 15,
  },
  stageInputContainer: {
    marginBottom: 15,
  },
  stageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 5,
  },
  startButton: {
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: '#ebf5fb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default OperatorScreen;
