/**
 * Dashboard Ekranı
 * Tüm kullanıcılar için genel ana ekran
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { User, ProductionRecord, Machine } from '../types';
import { productionStore } from '../data/productionStore';
import { workOrdersAPI, machinesAPI, stagesAPI } from '../utils/api';

interface DashboardScreenProps {
  user: User;
  onLogout: () => void;
  onNavigateToRoleScreen: () => void;
  onNavigateToProducts?: () => void;
  onNavigateToMolds?: () => void;
  refreshTrigger?: number;
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

interface BackendMachine {
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

interface MachineReading {
  id: number;
  machine_id: number;
  reading_type: string;
  value: string;
  timestamp: string;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ 
  user, 
  onLogout, 
  onNavigateToRoleScreen,
  onNavigateToProducts,
  onNavigateToMolds 
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeProductions, setActiveProductions] = useState<ProductionRecord[]>([]);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedProductionId, setSelectedProductionId] = useState<string | null>(null);
  const [issueDescription, setIssueDescription] = useState('');
  
  // Backend verileri
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [workOrderStages, setWorkOrderStages] = useState<Map<number, WorkOrderStage[]>>(new Map());
  const [backendMachines, setBackendMachines] = useState<BackendMachine[]>([]);
  const [machineReadingsMap, setMachineReadingsMap] = useState<Map<number, MachineReading[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Backend'den veri yükle
  const loadBackendData = async () => {
    try {
      setLoading(true);
      
      // Work orders yükle
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

      // Machines yükle
      const machinesResponse = await machinesAPI.getMachines();
      const machinesData = machinesResponse.data || machinesResponse;
      const allMachines = Array.isArray(machinesData) ? machinesData : [];
      setBackendMachines(allMachines);

      // Her makine için readings yükle
      const readingsMap = new Map<number, MachineReading[]>();
      for (const machine of allMachines) {
        try {
          const readingsData = await machinesAPI.getMachineReadings(machine.id, 10);
          readingsMap.set(machine.id, Array.isArray(readingsData.data) ? readingsData.data : []);
        } catch (error) {
          console.error(`Error loading readings for machine ${machine.id}:`, error);
          readingsMap.set(machine.id, []);
        }
      }
      setMachineReadingsMap(readingsMap);

      // Aktif work orders'ları ProductionRecord formatına dönüştür
      const activeWOs = allWorkOrders.filter(wo => {
        const stages = stagesMap.get(wo.id) || [];
        // En az bir stage in_progress veya done ise aktif
        return stages.some(s => s.status === 'in_progress' || s.status === 'done');
      });

      const productionRecords: ProductionRecord[] = activeWOs.map(wo => {
        const stages = stagesMap.get(wo.id) || [];
        const firstStage = stages[0];
        const inProgressStage = stages.find(s => s.status === 'in_progress');
        const doneStages = stages.filter(s => s.status === 'done');
        
        // Başlangıç zamanı: ilk stage'in actual_start'i varsa onu kullan, yoksa planned_start
        const startTime = inProgressStage?.actual_start || 
                         doneStages[0]?.actual_start || 
                         firstStage?.planned_start || 
                         wo.planned_start;

        // Cycle time: stage'lerden hesapla veya varsayılan (önce hesapla)
        let cycleTime: number | undefined = 3; // Varsayılan 3 saniye
        if (doneStages.length > 0 && doneStages[0].actual_start && doneStages[0].actual_end) {
          // Tamamlanan stage'in süresinden cycle time hesapla
          const stageDuration = (new Date(doneStages[0].actual_end).getTime() - 
                                 new Date(doneStages[0].actual_start).getTime()) / 1000;
          // Stage süresini ürün sayısına böl (basit yaklaşım)
          if (wo.qty > 0 && stageDuration > 0) {
            cycleTime = Math.max(1, Math.floor(stageDuration / wo.qty));
          }
        } else if (inProgressStage && inProgressStage.actual_start) {
          // İn progress stage varsa, geçen süreye göre tahmin et
          const elapsed = (new Date().getTime() - new Date(inProgressStage.actual_start).getTime()) / 1000;
          // Üretilen miktara göre cycle time tahmin et (basit yaklaşım)
          const estimatedProduced = Math.max(1, Math.floor(elapsed / 3)); // Varsayılan 3 saniye cycle time ile
          if (estimatedProduced > 0 && elapsed > 0) {
            cycleTime = Math.max(1, Math.floor(elapsed / estimatedProduced));
          }
        }

        // Üretilen miktar: in_progress veya done stage varsa, geçen süreye göre hesapla
        let producedCount = 0;
        if (inProgressStage && inProgressStage.actual_start) {
          // İn progress stage varsa, başlangıçtan itibaren geçen süreye göre hesapla
          const startTime = new Date(inProgressStage.actual_start);
          const now = new Date();
          const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
          producedCount = Math.floor(elapsedSeconds / (cycleTime || 3));
          // Hedef miktarı geçmesin
          if (producedCount > wo.qty) {
            producedCount = wo.qty;
          }
        } else if (doneStages.length > 0) {
          // Tüm stage'ler tamamlandıysa, hedef miktarı göster
          producedCount = wo.qty;
        }

        // Makineyi work order'dan veya aktif makinelerden bul
        // Basit eşleştirme: work order ID'sine göre makine seç
        const machineIndex = wo.id % (allMachines.length || 1);
        const machine = allMachines[machineIndex] || (allMachines.length > 0 ? allMachines[0] : { id: 1, name: 'Makine 1' });

        return {
          id: `WO-${wo.id}`,
          machineId: machine.id.toString(),
          operatorId: user.id,
          operatorName: user.name,
          productName: wo.product_code || wo.lot_no,
          startTime: new Date(startTime),
          partCount: producedCount,
          targetCount: wo.qty,
          cycleTime: cycleTime,
          status: inProgressStage ? 'active' as const : 'paused' as const,
          stages: stages.map((s, idx) => ({
            id: `stage-${s.id}`,
            name: s.stage_name,
            order: idx + 1,
            status: s.status === 'done' ? 'completed' as const :
                   s.status === 'in_progress' ? 'in_progress' as const :
                   'pending' as const,
            startTime: s.actual_start ? new Date(s.actual_start) : undefined,
            endTime: s.actual_end ? new Date(s.actual_end) : undefined,
          })),
        };
      });

      setActiveProductions(productionRecords);
    } catch (error: any) {
      console.error('Error loading backend data:', error);
      // Hata durumunda eski productionStore'dan veri göster
      const existing = productionStore.getAll();
      if (existing.length === 0) {
        productionStore.initialize([]);
      }
      setActiveProductions(productionStore.getActive());
    } finally {
      setLoading(false);
    }
  };

  // Component mount olduğunda backend'den veri yükle
  useEffect(() => {
    loadBackendData();
    
    // Her 5 saniyede bir yenile
    const interval = setInterval(loadBackendData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Her 1 saniyede bir yenile (aktif üretimler için - üretilen parça sayısını güncelle)
  useEffect(() => {
    const updateProductions = () => {
      const active = productionStore.getActive();
      
      // Aktif üretimlerin partCount'unu otomatik güncelle
      active.forEach(production => {
        if (production.status === 'active' && production.cycleTime && production.cycleTime > 0) {
          const now = new Date();
          const startTime = new Date(production.startTime);
          const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
          let calculatedPartCount = Math.floor(elapsedSeconds / production.cycleTime);
          
          // Hedef sayı varsa ve hedef sayıya ulaşıldıysa
          if (production.targetCount && calculatedPartCount >= production.targetCount) {
            calculatedPartCount = production.targetCount;
            
            // Üretimi tamamlanmış olarak işaretle
            productionStore.update(production.id, {
              status: 'completed',
              partCount: production.targetCount,
              endTime: now,
            });
          } else {
            // Sadece değiştiyse güncelle
            if (calculatedPartCount !== production.partCount) {
              productionStore.update(production.id, {
                partCount: calculatedPartCount
              });
            }
          }
        }
      });
      
      const updated = productionStore.getActive();
      setActiveProductions([...updated]);
      setRefreshKey(prev => prev + 1);
    };

    updateProductions();
    const interval = setInterval(updateProductions, 1000);
    return () => clearInterval(interval);
  }, []);

  // refreshKey değiştiğinde de güncelle
  useEffect(() => {
    const active = productionStore.getActive();
    setActiveProductions([...active]);
  }, [refreshKey]);

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'worker': return 'Operatör';
      case 'planner': return 'Planlayıcı';
      case 'admin': return 'Yönetici';
      default: return role;
    }
  };

  const getRoleScreenName = () => {
    switch (user.role) {
      case 'worker': return 'ÜRETİM GİRİŞİ';
      case 'planner': return 'MAKİNE RAPORLARI';
      case 'admin': return 'YÖNETİM PANELİ';
      default: return 'ÜRETİM GİRİŞİ';
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Istanbul'
    });
  };

  // Üretilen parça sayısını otomatik hesapla (cycle time ve başlangıç zamanına göre)
  const calculatePartCount = (production: ProductionRecord): number => {
    // Durdurulmuşsa, kaydedilmiş partCount değerini döndür (artmaz)
    if (production.status === 'paused') {
      return production.partCount;
    }
    
    // Tamamlanmışsa, kaydedilmiş partCount değerini döndür
    if (production.status === 'completed') {
      return production.partCount;
    }
    
    // Aktifse, startTime'dan itibaren hesapla
    if (production.status === 'active' && production.cycleTime && production.cycleTime > 0) {
      const now = new Date();
      const elapsedSeconds = (now.getTime() - production.startTime.getTime()) / 1000;
      const calculatedCount = Math.floor(elapsedSeconds / production.cycleTime);
      
      // Hedef sayı varsa ve hedef sayıya ulaşıldıysa, hedef sayıyı döndür
      if (production.targetCount && calculatedCount >= production.targetCount) {
        return production.targetCount;
      }
      
      return calculatedCount;
    }
    
    return production.partCount; // Cycle time yoksa mevcut değeri döndür
  };

  // Cycle time'ı göster (hesaplanmış değil, kaydedilmiş değer)
  const getCycleTime = (production: ProductionRecord): number | null => {
    return production.cycleTime || null;
  };

  // Makineleri backend'den al
  const machines: Machine[] = backendMachines.map(m => ({
    id: m.id.toString(),
    name: m.name,
    status: m.status === 'active' ? 'running' as const :
           m.status === 'maintenance' ? 'maintenance' as const :
           'stopped' as const,
  }));

  const handleStopProduction = (productionId: string) => {
    setSelectedProductionId(productionId);
    setShowIssueModal(true);
  };

  const handleResumeProduction = (productionId: string) => {
    const production = productionStore.getAll().find(p => p.id === productionId);
    if (!production) return;

    // Durdurulma süresini hesapla ve startTime'ı güncelle
    // Yeni startTime = şimdiki zaman - (durdurulma zamanına kadar geçen süre)
    const now = new Date();
    let newStartTime: Date;
    
    if (production.pausedAt && production.startTime) {
      // Durdurulma zamanına kadar geçen süre
      const elapsedBeforePause = production.pausedAt.getTime() - production.startTime.getTime();
      // Yeni startTime = şimdiki zaman - durdurulma zamanına kadar geçen süre
      newStartTime = new Date(now.getTime() - elapsedBeforePause);
    } else {
      // pausedAt yoksa, mevcut partCount'a göre hesapla
      if (production.cycleTime && production.cycleTime > 0) {
        const elapsedSeconds = production.partCount * production.cycleTime;
        newStartTime = new Date(now.getTime() - (elapsedSeconds * 1000));
      } else {
        newStartTime = production.startTime;
      }
    }

    productionStore.update(productionId, {
      status: 'active',
      // issue ve pausedAt bilgilerini koru - geçmiş sorun bildirimi olarak kalacak
      startTime: newStartTime, // Yeni başlangıç zamanı
    });
    
    const active = productionStore.getActive();
    setActiveProductions([...active]);
    Alert.alert('Başarılı', 'Makine çalışmaya devam ediyor.');
  };

  const handleSubmitIssue = () => {
    if (!issueDescription.trim()) {
      Alert.alert('Hata', 'Lütfen sorun açıklaması girin!');
      return;
    }

    if (selectedProductionId) {
      const production = productionStore.getAll().find(p => p.id === selectedProductionId);
      if (!production) return;

      const pausedAt = new Date();
      
      // Durdurulduğunda o anki partCount'u hesapla ve kaydet
      let pausedPartCount: number;
      if (production.cycleTime && production.cycleTime > 0) {
        // Durdurulma zamanına kadar geçen süre
        const elapsedSeconds = (pausedAt.getTime() - production.startTime.getTime()) / 1000;
        pausedPartCount = Math.floor(elapsedSeconds / production.cycleTime);
      } else {
        // Cycle time yoksa mevcut değeri kullan
        pausedPartCount = production.partCount;
      }

      productionStore.update(selectedProductionId, {
        status: 'paused',
        issue: issueDescription.trim(),
        pausedAt: pausedAt,
        partCount: pausedPartCount, // Durdurulduğunda o anki değeri kaydet
      });
      
      const active = productionStore.getActive();
      setActiveProductions([...active]);
      
      Alert.alert('Başarılı', 'Sorun bildirildi. Makine durduruldu.');
      
      setShowIssueModal(false);
      setIssueDescription('');
      setSelectedProductionId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DASHBOARD</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutButtonText}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              setRefreshing(true);
              await loadBackendData();
              setRefreshing(false);
            }} 
          />
        }
      >
        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>
            Hoş geldiniz, {user.name}
          </Text>
          <Text style={styles.roleText}>
            {getRoleDisplayName(user.role)} {user.department ? `- ${user.department}` : ''}
          </Text>
        </View>

        {/* Özet Kartları */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{activeProductions.length}</Text>
            <Text style={styles.summaryLabel}>Aktif Üretim</Text>
          </View>
        </View>

        {/* Aktif Üretimler - Makine Kartları */}
        {loading && activeProductions.length === 0 ? (
          <View style={styles.sectionCard}>
            <ActivityIndicator size="small" color="#3498db" style={{ marginVertical: 20 }} />
          </View>
        ) : activeProductions.length === 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.emptyText}>Aktif üretim bulunmamaktadır.</Text>
          </View>
        ) : (
          activeProductions.map((production: ProductionRecord) => {
            const machine = backendMachines.find(m => m.id.toString() === production.machineId);
            const calculatedPartCount = calculatePartCount(production);
            const cycleTime = getCycleTime(production);
            const machineReadings = machineReadingsMap.get(machine?.id || 0) || [];
            
            // Makine okumalarından bilgileri al
            const injectionTempReading = machineReadings.find(r => 
              r.reading_type.toLowerCase().includes('injection') || 
              r.reading_type.toLowerCase().includes('temp') && !r.reading_type.toLowerCase().includes('mold')
            );
            const moldTempReading = machineReadings.find(r => 
              r.reading_type.toLowerCase().includes('mold') || 
              r.reading_type.toLowerCase() === 'mold_temp'
            );
            const materialReading = machineReadings.find(r => 
              r.reading_type.toLowerCase().includes('material') || 
              r.reading_type.toLowerCase() === 'material_type'
            );
            const weightReading = machineReadings.find(r => 
              r.reading_type.toLowerCase().includes('weight') || 
              r.reading_type.toLowerCase() === 'weight'
            );
            
            // Varsayılan değerler (backend'de yoksa)
            const injectionTemp = injectionTempReading?.value || '220';
            const moldTemp = moldTempReading?.value || '45';
            const material = materialReading?.value || 'ABS';
            const weight = weightReading?.value || '35g';
            
            // Saatlik çıktı hesapla (cycle time'dan)
            const hourlyOutput = cycleTime && cycleTime > 0 ? Math.floor(3600 / cycleTime) : 0;
            
            // Makine kodu (KP-01 formatında) - makine adından veya ID'den
            let machineCode = '';
            if (machine?.name) {
              const numbers = machine.name.match(/\d+/);
              machineCode = numbers ? numbers[0] : machine.id.toString();
            } else {
              machineCode = production.machineId.replace(/[^0-9]/g, '') || machine?.id.toString() || '1';
            }
            const machineDisplayCode = `KP-${machineCode.padStart(2, '0')}`;
            const machineDisplayName = `MACHINE ${machineCode.padStart(2, '0')}`;
            
            // Durum
            const isRunning = production.status === 'active';
            const statusText = isRunning ? 'Running' : 'Stopped';
            const statusColor = isRunning ? '#27ae60' : '#e74c3c';
            
            return (
              <View key={production.id} style={styles.machineCard}>
                {/* Makine Header */}
                <View style={styles.machineCardHeader}>
                  <View>
                    <Text style={styles.machineCardName}>{machineDisplayName}</Text>
                    <Text style={styles.machineCardCode}>{machineDisplayCode}</Text>
                  </View>
                  <View style={[styles.machineStatusDot, { backgroundColor: statusColor }]}>
                    <Text style={styles.machineStatusText}>{statusText}</Text>
                  </View>
                </View>
                
                {/* Ürün Adı */}
                <Text style={styles.machineProductName}>{production.productName}</Text>
                
                {/* Cycle Time ve Hourly Output */}
                <View style={styles.machineMetricsRow}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricIcon}>⏱</Text>
                    <Text style={styles.metricLabel}>Cycle Time</Text>
                    <Text style={styles.metricValue}>{cycleTime || 0} sec</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricIcon}>📦</Text>
                    <Text style={styles.metricLabel}>Hourly Output</Text>
                    <Text style={styles.metricValue}>{hourlyOutput} pcs</Text>
                  </View>
                </View>
                
                {/* Alt Bilgiler */}
                <View style={styles.machineDetailsRow}>
                  <Text style={styles.machineDetail}>Inj: {injectionTemp}°C</Text>
                  <Text style={styles.machineDetail}>Mold: {moldTemp}°C</Text>
                  <Text style={styles.machineDetail}>{material}</Text>
                  <Text style={styles.machineDetail}>{weight}</Text>
                </View>
              </View>
            );
          })
        )}

        {/* Makine Durumu */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Makine Durumu</Text>
          {machines.length === 0 ? (
            <Text style={styles.emptyText}>Makine bulunmamaktadır.</Text>
          ) : (
            machines.map((machine) => (
            <View key={machine.id} style={styles.machineItem}>
              <View style={styles.machineHeader}>
                <Text style={styles.machineName}>{machine.name}</Text>
                <View style={[
                  styles.statusBadge,
                  machine.status === 'running' ? styles.runningBadge :
                  machine.status === 'maintenance' ? styles.maintenanceBadge :
                  styles.stoppedBadge
                ]}>
                  <Text style={styles.statusBadgeText}>
                    {machine.status === 'running' ? 'Çalışıyor' :
                     machine.status === 'maintenance' ? 'Bakım' :
                     'Durdu'}
                  </Text>
                </View>
              </View>
            </View>
            ))
          )}
        </View>

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={() => {
              // ProductsScreen'e git
              if (onNavigateToProducts) {
                onNavigateToProducts();
              }
            }}
          >
            <Text style={styles.navButtonEmoji}>📦</Text>
            <Text style={styles.navButtonText}>Ürünler</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={() => {
              // MoldsScreen'e git
              if (onNavigateToMolds) {
                onNavigateToMolds();
              }
            }}
          >
            <Text style={styles.navButtonEmoji}>🧱</Text>
            <Text style={styles.navButtonText}>Kalıplar</Text>
          </TouchableOpacity>
        </View>

        {/* Role-specific Button */}
        <TouchableOpacity style={styles.roleButton} onPress={onNavigateToRoleScreen}>
          <Text style={styles.roleButtonText}>
            {getRoleScreenName()}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sorun Bildir Modal */}
      <Modal
        visible={showIssueModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowIssueModal(false);
          setIssueDescription('');
          setSelectedProductionId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sorun Bildir</Text>
            <Text style={styles.modalSubtitle}>
              Makineyi neden durdurdunuz? Lütfen sorunu açıklayın.
            </Text>
            
            <TextInput
              style={styles.issueInput}
              placeholder="Örn: Makine arızası, hatalı ürün üretimi, kalite kontrolü..."
              value={issueDescription}
              onChangeText={setIssueDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowIssueModal(false);
                  setIssueDescription('');
                  setSelectedProductionId(null);
                }}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.sendButton, !issueDescription.trim() && styles.sendButtonDisabled]}
                onPress={handleSubmitIssue}
                disabled={!issueDescription.trim()}
              >
                <Text style={styles.sendButtonText}>GÖNDER</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  logoutButtonText: {
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
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 5,
  },
  roleText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  sectionCard: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  productionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  productionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productionProduct: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  productionDetail: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  machineItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  machineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  machineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#27ae60',
  },
  pausedBadge: {
    backgroundColor: '#e74c3c',
  },
  runningBadge: {
    backgroundColor: '#27ae60',
  },
  stoppedBadge: {
    backgroundColor: '#95a5a6',
  },
  maintenanceBadge: {
    backgroundColor: '#f39c12',
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 10,
  },
  navButton: {
    flex: 1,
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  navButtonEmoji: {
    fontSize: 24,
    marginBottom: 5,
  },
  navButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  roleButton: {
    backgroundColor: '#9b59b6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  roleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    marginTop: 15,
    justifyContent: 'space-between',
  },
  stopButton: {
    flex: 1,
    backgroundColor: '#e74c3c',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 5,
  },
  stopButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resumeButton: {
    flex: 1,
    backgroundColor: '#27ae60',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 5,
  },
  resumeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  issueContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  issueLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 5,
  },
  issueText: {
    fontSize: 13,
    color: '#856404',
    marginBottom: 5,
  },
  issueTime: {
    fontSize: 12,
    color: '#856404',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 20,
    textAlign: 'center',
  },
  issueInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    minHeight: 100,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#95a5a6',
    marginRight: 10,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3498db',
  },
  sendButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
    opacity: 0.6,
  },
  buttonTextDisabled: {
    color: '#7f8c8d',
  },
  stagesContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  stagesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7f8c8d',
    marginBottom: 8,
  },
  stageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  stageText: {
    fontSize: 12,
    color: '#2c3e50',
    flex: 1,
  },
  stageStatusBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stagePending: {
    backgroundColor: '#ecf0f1',
  },
  stageInProgress: {
    backgroundColor: '#f39c12',
  },
  stageCompleted: {
    backgroundColor: '#27ae60',
  },
  stageStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  emptyText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  // Makine Kartı Stilleri
  machineCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
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
  machineProductName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  machineMetricsRow: {
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
});

export default DashboardScreen;
