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
import { workOrdersAPI, stagesAPI, machinesAPI, issuesAPI } from '../utils/api';

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

const PlannerScreen: React.FC<PlannerScreenProps> = ({ user, onBack }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new'>('dashboard');
  
  // Dashboard state
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<number | null>(null);
  const [stages, setStages] = useState<WorkOrderStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [workOrderStages, setWorkOrderStages] = useState<Map<number, WorkOrderStage[]>>(new Map());

  // Work Order form state
  const [productCode, setProductCode] = useState('');
  const [lotNo, setLotNo] = useState('');
  const [qty, setQty] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [stageCount, setStageCount] = useState('2'); // Varsayılan 2 aşama
  const [stageNames, setStageNames] = useState<string[]>([]);
  const [showStages, setShowStages] = useState(false);
  
  // Dashboard accordion states
  const [showIssues, setShowIssues] = useState<boolean>(true); // Varsayılan açık
  const [showActiveWorkOrders, setShowActiveWorkOrders] = useState<boolean>(true); // Varsayılan açık
  const [workOrderSearchQuery, setWorkOrderSearchQuery] = useState<string>(''); // İş emri arama sorgusu
  const [showWorkOrderStages, setShowWorkOrderStages] = useState<boolean>(true); // Varsayılan açık
  const [stageSearchQuery, setStageSearchQuery] = useState<string>(''); // Arama sorgusu
  const [showMachines, setShowMachines] = useState<boolean>(false);

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
      setMachines(Array.isArray(machinesData) ? machinesData : []);
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

    if (!lotNo.trim()) {
      Alert.alert('Hata', 'Lütfen lot numarası girin!');
      return;
    }

    if (!qty.trim() || isNaN(parseInt(qty)) || parseInt(qty) <= 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir miktar girin!');
      return;
    }

    if (!plannedStart.trim()) {
      Alert.alert('Hata', 'Lütfen planlanan başlangıç zamanını girin!');
      return;
    }

    if (!plannedEnd.trim()) {
      Alert.alert('Hata', 'Lütfen planlanan bitiş zamanını girin!');
      return;
    }

    if (!stageCount.trim() || isNaN(parseInt(stageCount)) || parseInt(stageCount) <= 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir aşama sayısı girin! (En az 1)');
      return;
    }

    try {
      setLoading(true);

      // Parse dates - assuming format YYYY-MM-DDTHH:mm or similar
      const startDate = new Date(plannedStart);
      const endDate = new Date(plannedEnd);

      if (isNaN(startDate.getTime())) {
        Alert.alert('Hata', 'Geçersiz başlangıç tarihi formatı!');
        return;
      }

      if (isNaN(endDate.getTime())) {
        Alert.alert('Hata', 'Geçersiz bitiş tarihi formatı!');
        return;
      }

      if (endDate <= startDate) {
        Alert.alert('Hata', 'Bitiş tarihi başlangıç tarihinden sonra olmalıdır!');
        return;
      }

      const workOrderData = {
        product_code: productCode.trim(),
        lot_no: lotNo.trim(),
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
          setLotNo('');
          setQty('');
          setPlannedStart('');
          setPlannedEnd('');
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
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Planlayıcı: {user.name}</Text>
        </View>

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
                {issues.map((issue) => {
              // Issue'un hangi work order ve stage'e ait olduğunu bul
              let workOrderId: number | null = null;
              let stageName = 'Bilinmeyen Aşama';
              let productCode = 'Bilinmeyen Ürün';
              
              for (const [woId, stages] of workOrderStages.entries()) {
                const stage = stages.find(s => s.id === issue.work_order_stage_id);
                if (stage) {
                  workOrderId = woId;
                  stageName = stage.stage_name;
                  // Work order'ı bul
                  const workOrder = workOrders.find(wo => wo.id === woId);
                  if (workOrder) {
                    productCode = workOrder.product_code;
                  }
                  break;
                }
              }

              const issueDate = new Date(issue.created_at);
              const statusText = issue.status === 'open' ? 'Açık' : 
                                issue.status === 'acknowledged' ? 'Kabul Edildi' : 
                                'Çözüldü';
              const statusColor = issue.status === 'open' ? '#e74c3c' : 
                                 issue.status === 'acknowledged' ? '#f39c12' : 
                                 '#27ae60';

              return (
                <View key={issue.id} style={styles.issueCard}>
                  <View style={styles.issueHeader}>
                    <Text style={styles.issueTitle}>İş Emri #{workOrderId || 'N/A'} - {stageName}</Text>
                    <View style={[styles.issueStatusBadge, { backgroundColor: statusColor }]}>
                      <Text style={styles.issueStatusText}>{statusText}</Text>
                    </View>
                  </View>
                  <Text style={styles.issueProductCode}>Ürün: {productCode}</Text>
                  <Text style={styles.issueDescription}>{issue.description || 'Açıklama yok'}</Text>
                  <Text style={styles.issueTime}>
                    Bildirilme: {formatDate(issue.created_at)}
                  </Text>
                  {issue.type && (
                    <Text style={styles.issueType}>Tip: {issue.type}</Text>
                  )}
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
                  filteredWorkOrders.map((wo) => (
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
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: '#3498db' }
                          ]}
                        >
                          <Text style={styles.statusText}>Aktif</Text>
                        </View>
                      </View>
                      <Text style={styles.workOrderDetail}>Ürün: {wo.product_code}</Text>
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

        {/* Makineler */}
        <View style={styles.dashboardCard}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setShowMachines(!showMachines)}
            activeOpacity={0.7}
          >
            <Text style={styles.cardTitle}>🏭 Makineler</Text>
            <Text style={styles.expandIcon}>
              {showMachines ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          
          {showMachines && (
            <>
              {loading && !machines.length ? (
            <ActivityIndicator size="small" color="#9b59b6" style={{ marginVertical: 20 }} />
          ) : machines.length === 0 ? (
            <Text style={styles.emptyText}>Makine bulunmuyor</Text>
          ) : (
            machines.map((machine) => (
              <View key={machine.id} style={styles.machineItem}>
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
              </View>
            ))
              )}
            </>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderNewWorkOrder = () => {
    return (
      <ScrollView style={styles.content}>
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Planlayıcı: {user.name}</Text>
        </View>

        {/* İş Emri Oluşturma Formu */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Yeni İş Emri Oluştur</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Ürün Kodu *</Text>
            <TextInput
              style={styles.input}
              value={productCode}
              onChangeText={setProductCode}
              placeholder="Örn: PROD-001"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Lot Numarası *</Text>
            <TextInput
              style={styles.input}
              value={lotNo}
              onChangeText={setLotNo}
              placeholder="Örn: LOT-2024-001"
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
            <Text style={styles.label}>Planlanan Başlangıç Zamanı *</Text>
            <TextInput
              style={styles.input}
              value={plannedStart}
              onChangeText={setPlannedStart}
              placeholder="YYYY-MM-DDTHH:mm (örn: 2024-01-15T08:00)"
            />
            <Text style={styles.hintText}>
              Format: YYYY-MM-DDTHH:mm (örn: 2024-01-15T08:00)
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Planlanan Bitiş Zamanı *</Text>
            <TextInput
              style={styles.input}
              value={plannedEnd}
              onChangeText={setPlannedEnd}
              placeholder="YYYY-MM-DDTHH:mm (örn: 2024-01-15T18:00)"
            />
            <Text style={styles.hintText}>
              Format: YYYY-MM-DDTHH:mm (örn: 2024-01-15T18:00)
            </Text>
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
            <Text style={styles.hintText}>
              Oluşturulacak üretim aşaması sayısı (örn: 2, 3, 4...)
            </Text>
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
                    placeholder={`Aşama ${index + 1} - Ne yapılacak? (örn: Enjeksiyon, Montaj, Kontrol)`}
                  />
                </View>
              ))}
              <Text style={styles.hintText}>
                Her aşama için başlık yazın (örn: "Enjeksiyon", "Montaj", "Kontrol"). 
                Boş bırakırsanız otomatik isimler oluşturulur.
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={styles.createButton} 
            onPress={handleCreateWorkOrder}
          >
            <Text style={styles.createButtonText}>İŞ EMRİ OLUŞTUR</Text>
          </TouchableOpacity>
        </View>

        {/* Bilgi Kartı */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ Bilgi</Text>
          <Text style={styles.infoText}>
            • İş emri oluşturulduğunda belirttiğiniz sayıda aşama otomatik olarak oluşturulur.
          </Text>
          <Text style={styles.infoText}>
            • İş emirlerini Dashboard sekmesinden görüntüleyebilir ve aşamaları başlatabilirsiniz.
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
            📊 Dashboard
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
});

export default PlannerScreen;
