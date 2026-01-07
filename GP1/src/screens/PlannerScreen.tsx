/**
 * Planlayıcı Ekranı
 * İş emri oluşturma, stage başlatma ve makine raporları görüntüleme
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { User } from '../types';
import { workOrdersAPI, stagesAPI, machinesAPI, issuesAPI, productsAPI } from '../utils/api';

interface PlannerScreenProps {
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
  machine_id: number | null;
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

interface Issue {
  id: number;
  work_order_stage_id: number;
  type: string;
  description: string | null;
  status: string;
  created_by: number;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

interface BackendMachine {
  id: number;
  name: string;
  machine_type: string;
  location: string | null;
  status: string;
}

const PlannerScreen: React.FC<PlannerScreenProps> = ({ user, onBack }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new'>('dashboard');
  
  // Dashboard state
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [backendMachines, setBackendMachines] = useState<BackendMachine[]>([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<number | null>(null);
  const [stages, setStages] = useState<WorkOrderStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [workOrderStages, setWorkOrderStages] = useState<Map<number, WorkOrderStage[]>>(new Map());

  // Work Order form state
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [lotNo, setLotNo] = useState('');
  const [qty, setQty] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedStartTime, setPlannedStartTime] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [plannedEndTime, setPlannedEndTime] = useState('');
  const [stageCount, setStageCount] = useState('2'); // Varsayılan 2 aşama
  const [stageNames, setStageNames] = useState<string[]>([]);
  const [showStages, setShowStages] = useState(false);
  
  // Dashboard accordion states
  const [showIssues, setShowIssues] = useState<boolean>(true); // Varsayılan açık
  const [showActiveWorkOrders, setShowActiveWorkOrders] = useState<boolean>(true); // Varsayılan açık
  const [workOrderSearchQuery, setWorkOrderSearchQuery] = useState<string>(''); // İş emri arama sorgusu
  const [showWorkOrderStages, setShowWorkOrderStages] = useState<boolean>(true); // Varsayılan açık
  const [stageSearchQuery, setStageSearchQuery] = useState<string>(''); // Arama sorgusu
  const [showMachineStatus, setShowMachineStatus] = useState<boolean>(false);
  
  // Products state (ürün adı göstermek için)
  const [products, setProducts] = useState<any[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [showProductsList, setShowProductsList] = useState<boolean>(false);
  

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const productsResponse = await productsAPI.getProducts();
      const allProducts = Array.isArray(productsResponse) ? productsResponse : [];
      setProducts(allProducts);
    } catch (error: any) {
      console.error('Error loading products:', error);
    }
  };

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

  // Aşama sayısı değiştiğinde veya "Yeni İş Emri" sekmesine geçildiğinde input alanlarını göster
  useEffect(() => {
    if (activeTab === 'new') {
      const countNum = parseInt(stageCount) || 0;
      if (countNum > 0 && countNum <= 10) {
        const newStageNames = Array(countNum).fill('').map((_, index) => 
          stageNames[index] || ''
        );
        setStageNames(newStageNames);
        setShowStages(true);
      } else {
        setShowStages(false);
      }
    }
  }, [activeTab, stageCount]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load work orders
      const woResponse = await workOrdersAPI.getWorkOrders();
      const woData = woResponse.data || woResponse;
      const allWorkOrders: WorkOrder[] = Array.isArray(woData) ? woData : [];
      setWorkOrders(allWorkOrders);

      // Her work order için stages yükle
      const stagesMap = new Map<number, WorkOrderStage[]>();
      for (const wo of allWorkOrders) {
        try {
          const stages = await workOrdersAPI.getWorkOrderStages(wo.id);
          stagesMap.set(wo.id, Array.isArray(stages) ? stages : []);
        } catch (error) {
          console.error(`Error loading stages for WO ${wo.id}:`, error);
          stagesMap.set(wo.id, []);
        }
      }
      setWorkOrderStages(stagesMap);

      // Issues yükle
      try {
        const issuesResponse = await issuesAPI.listIssues();
        const issuesData = issuesResponse.data || issuesResponse;
        const allIssues: Issue[] = Array.isArray(issuesData) ? issuesData : [];
        // Sadece açık (open) ve kabul edilmiş (acknowledged) sorunları göster
        const activeIssues = allIssues.filter(issue => 
          issue.status === 'open' || issue.status === 'acknowledged'
        );
        setIssues(activeIssues);
      } catch (error) {
        console.error('Error loading issues:', error);
        setIssues([]);
      }

      // Load machines
      const machinesResponse = await machinesAPI.getMachines();
      const machinesData = machinesResponse.data || machinesResponse;
      const allMachines: BackendMachine[] = Array.isArray(machinesData) ? machinesData : [];
      setMachines(allMachines);
      setBackendMachines(allMachines);
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
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

  const handleStartStage = async (stageId: number) => {
    try {
      await stagesAPI.startStage(stageId);
      Alert.alert('Başarılı', 'Aşama başlatıldı!');
      if (selectedWorkOrder) {
        loadWorkOrderStages(selectedWorkOrder);
      }
      loadDashboardData();
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Aşama başlatılamadı');
    }
  };

  const handleDoneStage = async (stageId: number) => {
    try {
      await stagesAPI.doneStage(stageId);
      Alert.alert('Başarılı', 'Aşama tamamlandı!');
      if (selectedWorkOrder) {
        loadWorkOrderStages(selectedWorkOrder);
      }
      loadDashboardData();
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Aşama tamamlanamadı');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    if (selectedWorkOrder) {
      await loadWorkOrderStages(selectedWorkOrder);
    }
    setRefreshing(false);
  };

  // Aşama sayısı değiştiğinde input alanlarını oluştur
  // Her zaman input alanlarını güncelle, değer aynı olsa bile
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

  const handleCreateWorkOrder = async () => {
    // Validation
    if (!productCode.trim()) {
      Alert.alert('Hata', 'Lütfen ürün kodu girin!');
      return;
    }

    if (!productName.trim()) {
      Alert.alert('Hata', 'Lütfen ürün ismini girin!');
      return;
    }

    if (!qty.trim() || isNaN(parseInt(qty)) || parseInt(qty) <= 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir miktar girin!');
      return;
    }

    if (!plannedStartDate.trim()) {
      Alert.alert('Hata', 'Lütfen planlanan başlangıç tarihini girin!');
      return;
    }

    if (!plannedStartTime.trim()) {
      Alert.alert('Hata', 'Lütfen planlanan başlangıç saatini girin!');
      return;
    }

    if (!plannedEndDate.trim()) {
      Alert.alert('Hata', 'Lütfen planlanan bitiş tarihini girin!');
      return;
    }

    if (!plannedEndTime.trim()) {
      Alert.alert('Hata', 'Lütfen planlanan bitiş saatini girin!');
      return;
    }

    if (!stageCount.trim() || isNaN(parseInt(stageCount)) || parseInt(stageCount) <= 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir aşama sayısı girin! (En az 1)');
      return;
    }

    try {
      setLoading(true);

      // Parse dates - DD.MM.YYYY formatından Date objesine çevir
      const parseDate = (dateStr: string, timeStr: string): Date => {
        // DD.MM.YYYY formatını parse et
        const parts = dateStr.trim().split('.');
        if (parts.length !== 3) {
          throw new Error('Geçersiz tarih formatı! DD.MM.YYYY formatında olmalı.');
        }
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const year = parseInt(parts[2], 10);

        // HH:mm formatını parse et
        const timeParts = timeStr.trim().split(':');
        if (timeParts.length !== 2) {
          throw new Error('Geçersiz saat formatı! HH:mm formatında olmalı.');
        }
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);

        const date = new Date(year, month, day, hours, minutes);
        if (isNaN(date.getTime())) {
          throw new Error('Geçersiz tarih/saat!');
        }
        return date;
      };

      let startDate: Date;
      let endDate: Date;
      
      try {
        startDate = parseDate(plannedStartDate, plannedStartTime);
      } catch (error: any) {
        Alert.alert('Hata', error.message || 'Geçersiz başlangıç tarihi/saat formatı!');
        setLoading(false);
        return;
      }

      try {
        endDate = parseDate(plannedEndDate, plannedEndTime);
      } catch (error: any) {
        Alert.alert('Hata', error.message || 'Geçersiz bitiş tarihi/saat formatı!');
        setLoading(false);
        return;
      }

      if (endDate <= startDate) {
        Alert.alert('Hata', 'Bitiş tarihi başlangıç tarihinden sonra olmalıdır!');
        setLoading(false);
        return;
      }

      // Otomatik LOT numarası oluştur
      const now = new Date();
      const autoLotNo = `LOT-${now.toISOString().slice(0,10)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const workOrderData = {
        product_code: productCode.trim(),
        lot_no: autoLotNo,
        qty: parseInt(qty),
        planned_start: startDate.toISOString(),
        planned_end: endDate.toISOString(),
        stage_count: parseInt(stageCount),
        stage_names: stageNames.filter(name => name.trim() !== ''), // Boş olmayan isimleri gönder
      };

      console.log('📤 PlannerScreen - İş emri oluşturuluyor:', workOrderData);
      const result = await workOrdersAPI.createWorkOrder(workOrderData);
      
      Alert.alert(
        'Başarılı', 
        `İş emri oluşturuldu! (ID: ${result.work_order_id})\n${result.stages_created} aşama otomatik oluşturuldu.`,
        [{ text: 'Tamam', onPress: () => {
          // Formu temizle
          setProductCode('');
          setProductName('');
          setProductSearchQuery('');
          setLotNo('');
          setQty('');
          setPlannedStartDate('');
          setPlannedStartTime('');
          setPlannedEndDate('');
          setPlannedEndTime('');
          setStageCount('2');
          setStageNames([]);
          setShowStages(false);
          // Dashboard'a geç ve verileri yenile
          setActiveTab('dashboard');
          loadDashboardData();
        }}]
      );
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'İş emri oluşturulamadı');
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
      >
        {/* Sorun Bildirimleri */}
        {issues.length > 0 && (
          <View style={styles.dashboardCard}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => setShowIssues(!showIssues)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle}>⚠️ Sorun Bildirimleri</Text>
              <Text style={styles.expandIcon}>
                {showIssues ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
            
            {showIssues && (
              <>
                {issues.map((issue, index) => {
              // Issue'un hangi work order ve stage'e ait olduğunu bul
              let workOrderId: number | null = null;
              let productCode = 'Bilinmeyen Ürün';
              let machineId: number | null = null;
              
              for (const [woId, stages] of workOrderStages.entries()) {
                const stage = stages.find(s => s.id === issue.work_order_stage_id);
                if (stage) {
                  workOrderId = woId;
                  // Work order'ı bul
                  const workOrder = workOrders.find(wo => wo.id === woId);
                  if (workOrder) {
                    productCode = workOrder.product_code;
                    machineId = workOrder.machine_id;
                  }
                  break;
                }
              }

              // Makine bilgisini bul
              let machineName = '';
              if (machineId) {
                const machine = machines.find(m => m.id === machineId);
                if (machine) {
                  machineName = machine.name;
                }
              }
              
              // Eğer makine bilgisi yoksa, sırayla makine ismi ata
              if (!machineName) {
                const machineNumber = (index + 1).toString().padStart(2, '0');
                machineName = `makine${machineNumber}`;
              }

              // Ürün adını bul
              const productForIssue = products.find((p: any) => p.code === productCode);
              const productName = productForIssue?.name || productCode;

              return (
                <View key={issue.id} style={styles.issueCard}>
                  <View style={styles.issueHeader}>
                    <Text style={styles.issueTitle}>{machineName}</Text>
                  </View>
                  <Text style={styles.issueProductCode}>Ürün: {productName}</Text>
                  <Text style={styles.issueDescription}>{issue.description || 'Açıklama yok'}</Text>
                  <Text style={styles.issueTime}>
                    Bildirilme: {formatDate(issue.created_at)}
                  </Text>
                </View>
              );
                })}
              </>
            )}
          </View>
        )}

        {/* Aktif İş Emirleri */}
        <View style={styles.dashboardCard}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setShowActiveWorkOrders(!showActiveWorkOrders)}
            activeOpacity={0.7}
          >
            <Text style={styles.cardTitle}>📋 Aktif İş Emirleri</Text>
            <Text style={styles.expandIcon}>
              {showActiveWorkOrders ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          
          {showActiveWorkOrders && (
            <>
              {/* Arama Çubuğu */}
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="İş emri, ürün kodu veya lot no ile ara..."
                  placeholderTextColor="#95a5a6"
                  value={workOrderSearchQuery}
                  onChangeText={setWorkOrderSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {(() => {
                // Arama sorgusuna göre filtrele
                const filteredWorkOrders = workOrderSearchQuery.trim() === '' 
                  ? activeWorkOrders 
                  : activeWorkOrders.filter(wo => {
                      const query = workOrderSearchQuery.toLowerCase().trim();
                      const workOrderId = wo.id.toString();
                      const productCode = (wo.product_code || '').toLowerCase();
                      const lotNo = (wo.lot_no || '').toLowerCase();
                      
                      return (
                        workOrderId.includes(query) ||
                        productCode.includes(query) ||
                        lotNo.includes(query)
                      );
                    });
                
                return loading && !workOrders.length ? (
                  <ActivityIndicator size="small" color="#9b59b6" style={{ marginVertical: 20 }} />
                ) : filteredWorkOrders.length === 0 ? (
                  <Text style={styles.emptyText}>
                    {workOrderSearchQuery.trim() ? 'Arama sonucu bulunamadı' : 'Aktif iş emri bulunmuyor'}
                  </Text>
                ) : (
                  filteredWorkOrders.map((wo) => {
                    // Bu iş emrine ait stage'leri bul
                    const woStages = workOrderStages.get(wo.id) || [];
                    // Bu stage'lere ait en son issue'yu bul
                    const latestIssue = woStages.length > 0 
                      ? issues.find(issue => {
                          return woStages.some(stage => stage.id === issue.work_order_stage_id);
                        })
                      : null;
                    
                    return (
                    <TouchableOpacity
                      key={wo.id}
                      style={[
                        styles.workOrderItem,
                        selectedWorkOrder === wo.id && styles.workOrderItemSelected
                      ]}
                      onPress={() => loadWorkOrderStages(wo.id)}
                    >
                      <View style={styles.workOrderHeader}>
                        <Text style={styles.workOrderId}>İş Emri #{wo.id}</Text>
                      </View>
                      <Text style={styles.workOrderDetail}>Ürün: {products.find((p: any) => p.code === wo.product_code)?.name || wo.product_code}</Text>
                      <Text style={styles.workOrderDetail}>Miktar: {wo.qty}</Text>
                      <Text style={styles.workOrderDetail}>
                        Başlangıç: {formatDate(wo.planned_start)}
                      </Text>
                      <Text style={styles.workOrderDetail}>
                        Bitiş: {formatDate(wo.planned_end)}
                      </Text>
                      
                      {/* Sorun Bildirimi - Eğer varsa göster */}
                      {latestIssue && (
                        <View style={styles.issueContainer}>
                          <Text style={styles.issueLabel}>
                            ⚠️ Sorun Bildirimi:
                          </Text>
                          <Text style={styles.issueText}>
                            {latestIssue.description || 'Açıklama yok'}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    );
                  })
                );
              })()}
            </>
          )}
        </View>

        {/* Aşamalar */}
        {selectedWorkOrder && stages.length > 0 && (
          <View style={styles.dashboardCard}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => setShowWorkOrderStages(!showWorkOrderStages)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle}>
                🔄 İş Emri #{selectedWorkOrder} - Aşamalar
              </Text>
              <Text style={styles.expandIcon}>
                {showWorkOrderStages ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
            
            {showWorkOrderStages && (
              <>
                {/* Arama Çubuğu */}
                <View style={styles.searchContainer}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Aşama adı ile ara..."
                    placeholderTextColor="#95a5a6"
                    value={stageSearchQuery}
                    onChangeText={setStageSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {(() => {
                  // Arama sorgusuna göre filtrele
                  const filteredStages = stageSearchQuery.trim() === '' 
                    ? stages 
                    : stages.filter(stage => {
                        const query = stageSearchQuery.toLowerCase().trim();
                        const stageName = stage.stage_name.toLowerCase();
                        return stageName.includes(query);
                      });
                  
                  if (filteredStages.length === 0) {
                    return <Text style={styles.emptyText}>Arama sonucu bulunamadı</Text>;
                  }
                  
                  return filteredStages.map((stage) => (
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
                <Text style={styles.stageDetail}>
                  Planlanan: {formatDate(stage.planned_start)} - {formatDate(stage.planned_end)}
                </Text>
                {(stage.actual_start || stage.actual_end) && (
                  <Text style={styles.stageDetail}>
                    Gerçek: {formatDate(stage.actual_start)}
                    {stage.actual_end ? ` - ${formatDate(stage.actual_end)}` : ''}
                  </Text>
                )}
                <View style={styles.stageActions}>
                  {stage.status === 'planned' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.startButton]}
                      onPress={() => handleStartStage(stage.id)}
                    >
                      <Text style={styles.actionButtonText}>Başlat</Text>
                    </TouchableOpacity>
                  )}
                  {stage.status === 'in_progress' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.doneButton]}
                      onPress={() => handleDoneStage(stage.id)}
                    >
                      <Text style={styles.actionButtonText}>Tamamla</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
                  ));
                })()}
              </>
            )}
          </View>
        )}

      </ScrollView>
    );
  };

  const renderNewWorkOrder = () => {
    return (
      <ScrollView style={styles.content}>
        {/* İş Emri Oluşturma Formu */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Yeni İş Emri Oluştur</Text>

          {/* Ürün Ara / Seç */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Ürün Ara / Seç *</Text>
            <View style={styles.productsListContainer}>
              {/* Arama Çubuğu ve Dropdown Toggle */}
              <TouchableOpacity 
                style={styles.productSearchRow}
                onPress={() => setShowProductsList(!showProductsList)}
                activeOpacity={0.9}
              >
                <TextInput
                  style={styles.productSearchInputInRow}
                  placeholder="Ürün adı veya kodu ile ara..."
                  placeholderTextColor="#95a5a6"
                  value={productSearchQuery}
                  onChangeText={(text) => {
                    setProductSearchQuery(text);
                  }}
                  onFocus={() => setShowProductsList(true)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.dropdownArrow}>
                  {showProductsList ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
            
              {showProductsList && (
                <ScrollView style={styles.productsListScroll} nestedScrollEnabled={true}>
                  {(() => {
                    const filteredProducts = productSearchQuery.trim() === '' 
                      ? products 
                      : products.filter(product => 
                          product.code.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                          product.name.toLowerCase().includes(productSearchQuery.toLowerCase())
                        );
                    
                    if (filteredProducts.length === 0) {
                      return (
                        <Text style={styles.hintText}>
                          {productSearchQuery.trim() ? 'Arama sonucu bulunamadı' : 'Ürün bulunamadı.'}
                        </Text>
                      );
                    }
                    
                    return filteredProducts.map((product) => (
                      <TouchableOpacity
                        key={product.id}
                        style={styles.productItem}
                        onPress={() => {
                          setProductCode(product.code);
                          setProductName(product.name);
                          setProductSearchQuery(product.name);
                          setShowProductsList(false);
                        }}
                      >
                        <Text style={styles.productItemText}>
                          {product.code} - {product.name}
                        </Text>
                      </TouchableOpacity>
                    ));
                  })()}
                </ScrollView>
              )}
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Ürün İsmi *</Text>
            <TextInput
              style={styles.input}
              value={productName}
              onChangeText={setProductName}
              placeholder="Ürün adını girin veya yukarıdan seçin"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Miktar *</Text>
            <TextInput
              style={styles.input}
              value={qty}
              onChangeText={setQty}
              placeholder="Üretilecek adet sayısı"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Planlanan Başlangıç Tarihi *</Text>
            <TextInput
              style={styles.input}
              value={plannedStartDate}
              onChangeText={setPlannedStartDate}
              placeholder="GG.AA.YYYY"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Planlanan Başlangıç Saati *</Text>
            <TextInput
              style={styles.input}
              value={plannedStartTime}
              onChangeText={setPlannedStartTime}
              placeholder="SS:DD"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Planlanan Bitiş Tarihi *</Text>
            <TextInput
              style={styles.input}
              value={plannedEndDate}
              onChangeText={setPlannedEndDate}
              placeholder="GG.AA.YYYY"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Planlanan Bitiş Saati *</Text>
            <TextInput
              style={styles.input}
              value={plannedEndTime}
              onChangeText={setPlannedEndTime}
              placeholder="SS:DD"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Üretim Aşama Sayısı *</Text>
            <TextInput
              style={styles.input}
              value={stageCount}
              onChangeText={handleStageCountChange}
              placeholder="Örn: 2"
              keyboardType="numeric"
            />
          </View>

          {/* Aşama İsimleri */}
          {showStages && stageNames.length > 0 && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Aşama Başlıkları (Her aşamada ne yapılacağını yazın)</Text>
              {stageNames.map((name, index) => (
                <View key={index} style={{ marginBottom: 10 }}>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={(text) => handleStageNameChange(index, text)}
                    placeholder={`Aşama ${index + 1} (örn: Enjeksiyon, Montaj, Kontrol)`}
                  />
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity 
            style={styles.createButton} 
            onPress={handleCreateWorkOrder}
          >
            <Text style={styles.createButtonText}>İŞ EMRİ OLUŞTUR</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>PLANLAYICI PANELİ</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dashboard' && styles.tabActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>
            📊 İş Emirleri
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'new' && styles.tabActive]}
          onPress={() => setActiveTab('new')}
        >
          <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>
            ➕ Yeni İş Emri
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'dashboard' ? renderDashboard() : renderNewWorkOrder()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecf0f1',
  },
  header: {
    backgroundColor: '#9b59b6',
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
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#9b59b6',
  },
  tabText: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#9b59b6',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  userInfo: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 13,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  dashboardCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: 14,
    paddingVertical: 20,
  },
  workOrderItem: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#ecf0f1',
    borderRadius: 8,
    marginBottom: 10,
  },
  workOrderItemSelected: {
    borderColor: '#9b59b6',
    borderWidth: 2,
    backgroundColor: '#f8f9fa',
  },
  workOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  workOrderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  workOrderDetail: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  issueContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff3cd',
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  issueLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#e67e22',
    marginBottom: 4,
  },
  issueText: {
    fontSize: 13,
    color: '#d35400',
    fontStyle: 'italic',
  },
  // Makine Kartı Stilleri (Aktif Üretimler için)
  machineCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  machineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  machineCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  machineCardCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  machineStatusDot: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  machineStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  machineMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  machineDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  machineDetail: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  pausedIssueInfo: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  pausedIssueLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#e67e22',
    marginBottom: 6,
  },
  pausedIssueText: {
    fontSize: 13,
    color: '#d35400',
    lineHeight: 18,
    marginBottom: 4,
  },
  pausedIssueTime: {
    fontSize: 11,
    color: '#95a5a6',
    fontStyle: 'italic',
    marginTop: 4,
  },
  stageItem: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#ecf0f1',
    borderRadius: 8,
    marginBottom: 10,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stageName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  stageDetail: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  stageActions: {
    marginTop: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#27ae60',
  },
  doneButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  machineItem: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#ecf0f1',
    borderRadius: 8,
    marginBottom: 10,
  },
  machineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  machineName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  machineLocation: {
    fontSize: 13,
    color: '#95a5a6',
    marginTop: 2,
  },
  machineProductionInfo: {
    fontSize: 13,
    color: '#7f8c8d',
    marginTop: 8,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  machineDetail: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  formCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 12,
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
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ecf0f1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  hintText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 5,
  },
  createButton: {
    backgroundColor: '#9b59b6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
    lineHeight: 20,
  },
  issueCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  issueTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  issueStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  issueStatusText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  issueProductCode: {
    fontSize: 13,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  issueDescription: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 8,
    lineHeight: 20,
  },
  issueTime: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  issueType: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  expandIcon: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: 'bold',
  },
  searchContainer: {
    marginBottom: 15,
    marginTop: 10,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#2c3e50',
  },
  // Ürün arama stilleri
  productsListContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  productSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingRight: 12,
  },
  productSearchInputInRow: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#2c3e50',
  },
  dropdownArrow: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  productsListScroll: {
    maxHeight: 200,
    marginTop: 10,
  },
  productItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  productItemText: {
    fontSize: 14,
    color: '#2c3e50',
  },
});

export default PlannerScreen;
