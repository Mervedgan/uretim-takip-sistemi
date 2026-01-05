/**
 * Yönetici Ekranı
 * Tüm veriler ve genel üretim analizleri
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { User, ProductionRecord, Machine, ProductionAnalysis, OperatorPerformance, MachinePerformance, DailyProduction } from '../types';
import { workOrdersAPI, machinesAPI, issuesAPI, authAPI, productsAPI } from '../utils/api';

interface ManagerScreenProps {
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
  created_by?: number | null;
  created_by_username?: string;
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
  status: 'planned' | 'in_progress' | 'done' | 'paused';
  paused_at?: string | null;
}

interface BackendMachine {
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

const ManagerScreen: React.FC<ManagerScreenProps> = ({ user, onBack }) => {
  const [activeProductions, setActiveProductions] = useState<ProductionRecord[]>([]);
  const [productionAnalysis, setProductionAnalysis] = useState<ProductionAnalysis | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [backendMachines, setBackendMachines] = useState<BackendMachine[]>([]);
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [workOrderStages, setWorkOrderStages] = useState<Map<number, WorkOrderStage[]>>(new Map());
  const [showAllStages, setShowAllStages] = useState<boolean>(false);
  const [stageSearchQuery, setStageSearchQuery] = useState<string>(''); // Arama sorgusu
  const [showIssues, setShowIssues] = useState<boolean>(true); // Varsayılan açık
  const [showOperatorPerformance, setShowOperatorPerformance] = useState<boolean>(false);
  const [showMachinePerformance, setShowMachinePerformance] = useState<boolean>(false);
  const [showDailyProduction, setShowDailyProduction] = useState<boolean>(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showUsers, setShowUsers] = useState<boolean>(false);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [isUserSectionExpanding, setIsUserSectionExpanding] = useState<boolean>(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPositionRef = useRef<number>(0);
  const userSectionYRef = useRef<number>(0); // Bölümün Y pozisyonu
  const savedScrollYRef = useRef<number>(0); // Kaydedilen scroll pozisyonu
  
  // Products state (ürün adı göstermek için)
  const [products, setProducts] = useState<any[]>([]);

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

      // Machines yükle
      const machinesResponse = await machinesAPI.getMachines();
      const machinesData = machinesResponse.data || machinesResponse;
      const allMachines = Array.isArray(machinesData) ? machinesData : [];
      setBackendMachines(allMachines);

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
        
        // Başlangıç zamanı
        const startTime = inProgressStage?.actual_start || 
                         doneStages[0]?.actual_start || 
                         firstStage?.planned_start || 
                         wo.planned_start;

        // Cycle time hesapla
        let cycleTime: number | undefined = 3;
        if (doneStages.length > 0 && doneStages[0].actual_start && doneStages[0].actual_end) {
          const stageDuration = (new Date(doneStages[0].actual_end).getTime() - 
                                 new Date(doneStages[0].actual_start).getTime()) / 1000;
          if (wo.qty > 0 && stageDuration > 0) {
            cycleTime = Math.max(1, Math.floor(stageDuration / wo.qty));
          }
        }

        // Üretilen miktar
        let producedCount = 0;
        if (inProgressStage && inProgressStage.actual_start) {
          const startTime = new Date(inProgressStage.actual_start);
          const now = new Date();
          const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
          producedCount = Math.floor(elapsedSeconds / (cycleTime || 3));
          if (producedCount > wo.qty) {
            producedCount = wo.qty;
          }
        } else if (doneStages.length > 0) {
          producedCount = wo.qty;
        }

        // Makine seç
        const machineIndex = wo.id % (allMachines.length || 1);
        const machine = allMachines[machineIndex] || (allMachines.length > 0 ? allMachines[0] : { id: 1, name: 'Makine 1' });

        // Ürün adını bul
        const productForWO = products.find((p: any) => p.code === wo.product_code);

        return {
          id: `WO-${wo.id}`,
          machineId: machine.id.toString(),
          operatorId: wo.created_by?.toString() || 'unknown',
          operatorName: wo.created_by_username || 'Bilinmeyen',
          productName: productForWO?.name || wo.product_code || wo.lot_no,
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

      // Tüm work orders'ları kullanarak analiz hesapla (hem aktif hem tamamlanmış)
      const allProductionRecords: ProductionRecord[] = allWorkOrders.map(wo => {
        const stages = stagesMap.get(wo.id) || [];
        const firstStage = stages[0];
        const inProgressStage = stages.find(s => s.status === 'in_progress');
        const doneStages = stages.filter(s => s.status === 'done');
        
        const startTime = inProgressStage?.actual_start || 
                         doneStages[0]?.actual_start || 
                         firstStage?.planned_start || 
                         wo.planned_start;
        
        const lastDoneStage = doneStages.length === stages.length ? doneStages[doneStages.length - 1] : null;
        const endTime = lastDoneStage?.actual_end
          ? new Date(lastDoneStage.actual_end)
          : undefined;

        let cycleTime: number | undefined = 3;
        if (doneStages.length > 0 && doneStages[0].actual_start && doneStages[0].actual_end) {
          const stageDuration = (new Date(doneStages[0].actual_end).getTime() - 
                                 new Date(doneStages[0].actual_start).getTime()) / 1000;
          if (wo.qty > 0 && stageDuration > 0) {
            cycleTime = Math.max(1, Math.floor(stageDuration / wo.qty));
          }
        }

        let producedCount = wo.qty;
        if (inProgressStage && inProgressStage.actual_start) {
          const startTime = new Date(inProgressStage.actual_start);
          const now = new Date();
          const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
          producedCount = Math.floor(elapsedSeconds / (cycleTime || 3));
          if (producedCount > wo.qty) {
            producedCount = wo.qty;
          }
        }

        const machineIndex = wo.id % (allMachines.length || 1);
        const machine = allMachines[machineIndex] || (allMachines.length > 0 ? allMachines[0] : { id: 1, name: 'Makine 1' });

        // Ürün adını bul
        const productForWO2 = products.find((p: any) => p.code === wo.product_code);

        return {
          id: `WO-${wo.id}`,
          machineId: machine.id.toString(),
          operatorId: wo.created_by?.toString() || 'unknown',
          operatorName: wo.created_by_username || 'Bilinmeyen',
          productName: productForWO2?.name || wo.product_code || wo.lot_no,
          startTime: new Date(startTime),
          endTime: endTime,
          partCount: producedCount,
          targetCount: wo.qty,
          cycleTime: cycleTime,
          status: inProgressStage ? 'active' : doneStages.length === stages.length ? 'completed' : 'paused',
        };
      });

      // Analiz hesapla
      calculateAnalysis(allProductionRecords, allMachines);
    } catch (error: any) {
      console.error('Error loading backend data:', error);
      setActiveProductions([]);
      calculateAnalysis([], []);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalysis = (allProductions: ProductionRecord[], allMachines: BackendMachine[]) => {
      
      // Makine listesini backend'den al
      const machineMap = new Map<string, Machine>();
      allMachines.forEach(machine => {
        const machineProductions = allProductions.filter(p => p.machineId === machine.id.toString());
        const activeProduction = machineProductions.find(p => p.status === 'active');
        let status: 'running' | 'stopped' | 'maintenance' = 'stopped';
        if (activeProduction) {
          status = 'running';
        }
        machineMap.set(machine.id.toString(), {
          id: machine.id.toString(),
          name: machine.name || `Makine ${machine.id}`,
          status: status,
        });
      });
      setMachines(Array.from(machineMap.values()));
      
      // Toplam üretim sayısı (tüm work orders)
      const totalProductions = allProductions.length;
      
      // Toplam parça sayısı
      const totalParts = allProductions.reduce((sum, p) => {
        if (p.status === 'active' && p.cycleTime && p.cycleTime > 0) {
          const now = new Date();
          const startTime = new Date(p.startTime);
          const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
          return sum + Math.floor(elapsedSeconds / p.cycleTime);
        }
        return sum + p.partCount;
      }, 0);
      
      // Aktif makine sayısı (machineMap'ten hesapla)
      const totalActiveMachines = Array.from(machineMap.values()).filter(m => m.status === 'running').length;
      
      // Verimlilik hesaplaması kaldırıldı - AI destekli hesaplama için sembolik olarak 0
      const averageEfficiency = 0;
      
      // Operatör performansı
      const operatorMap = new Map<string, OperatorPerformance>();
      allProductions.forEach(p => {
        if (!operatorMap.has(p.operatorId)) {
          operatorMap.set(p.operatorId, {
            operatorId: p.operatorId,
            operatorName: p.operatorName,
            totalProductions: 0,
            totalParts: 0,
            averageEfficiency: 0,
            averageDuration: 0,
          });
        }
        const op = operatorMap.get(p.operatorId)!;
        op.totalProductions++;
        
        let currentParts = p.partCount;
        if (p.status === 'active' && p.cycleTime && p.cycleTime > 0) {
          const now = new Date();
          const startTime = new Date(p.startTime);
          const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
          currentParts = Math.floor(elapsedSeconds / p.cycleTime);
        }
        op.totalParts += currentParts;
        
        if (p.endTime && p.startTime) {
          const durationHours = (new Date(p.endTime).getTime() - new Date(p.startTime).getTime()) / (1000 * 60 * 60);
          op.averageDuration = (op.averageDuration * (op.totalProductions - 1) + durationHours) / op.totalProductions;
        }
      });
      
      // Operatör verimliliklerini hesapla - AI destekli hesaplama için sembolik olarak 0
      operatorMap.forEach((op) => {
        op.averageEfficiency = 0;
      });
      
      // Makine performansı (PlannerScreen'deki gibi)
      const machinePerformance: MachinePerformance[] = Array.from(machineMap.values()).map(machine => {
        const machineProductions = allProductions.filter(p => p.machineId === machine.id);
        const totalProd = machineProductions.length;
        const totalPartsForMachine = machineProductions.reduce((sum, p) => {
          if (p.status === 'active' && p.cycleTime && p.cycleTime > 0) {
            const now = new Date();
            const startTime = new Date(p.startTime);
            const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
            return sum + Math.floor(elapsedSeconds / p.cycleTime);
          }
          return sum + p.partCount;
        }, 0);
        
        // Verimlilik hesaplaması kaldırıldı - AI destekli hesaplama için sembolik olarak 0
        const avgEff = 0;
        
        const completedProductions = machineProductions.filter(p => p.endTime);
        const avgDuration = completedProductions.length > 0
          ? completedProductions.reduce((sum, p) => {
              if (p.endTime) {
                const startTime = new Date(p.startTime);
                const endTime = new Date(p.endTime);
                const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                return sum + durationHours;
              }
              return sum;
            }, 0) / completedProductions.length
          : 0;
        
        const uptime = machineProductions.reduce((sum, p) => {
          const startTime = new Date(p.startTime);
          if (p.endTime) {
            const endTime = new Date(p.endTime);
            return sum + (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          } else if (p.status === 'active') {
            const now = new Date();
            return sum + (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          } else if (p.status === 'paused' && p.pausedAt) {
            const pausedAt = new Date(p.pausedAt);
            return sum + (pausedAt.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          }
          return sum;
        }, 0);
        
        const lastProductionDate = machineProductions.length > 0
          ? machineProductions.reduce((latest, p) => {
              const pDate = new Date(p.startTime);
              const latestDate = new Date(latest);
              return pDate > latestDate ? pDate : latestDate;
            }, new Date(machineProductions[0].startTime))
          : new Date();
        
        return {
          machineId: machine.id,
          machineName: machine.name,
          totalProductions: totalProd,
          totalParts: totalPartsForMachine,
          averageEfficiency: avgEff,
          averageDuration: avgDuration,
          uptime: Math.round(uptime * 10) / 10,
          lastProductionDate
        };
      });
      
      // Günlük üretim
      const dailyMap = new Map<string, DailyProduction>();
      allProductions.forEach(p => {
        const dateStr = new Date(p.startTime).toISOString().split('T')[0];
        if (!dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, {
            date: dateStr,
            totalProductions: 0,
            totalParts: 0,
            efficiency: 0,
          });
        }
        const daily = dailyMap.get(dateStr)!;
        daily.totalProductions++;
        
        let currentParts = p.partCount;
        if (p.status === 'active' && p.cycleTime && p.cycleTime > 0) {
          const now = new Date();
          const startTime = new Date(p.startTime);
          const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
          currentParts = Math.floor(elapsedSeconds / p.cycleTime);
        }
        daily.totalParts += currentParts;
      });
      
      // Günlük verimlilik hesapla - AI destekli hesaplama için sembolik olarak 0
      dailyMap.forEach((daily) => {
        daily.efficiency = 0;
      });
      
      const dailyProduction = Array.from(dailyMap.values()).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setProductionAnalysis({
        totalProductions,
        totalParts,
        totalActiveMachines: Array.from(machineMap.values()).filter(m => m.status === 'running').length,
        averageEfficiency,
        operatorPerformance: Array.from(operatorMap.values()),
        machinePerformance,
        dailyProduction: dailyProduction.slice(0, 7), // Son 7 gün
      });
  };

  // Backend'den kullanıcıları yükle
  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const usersData = await authAPI.listUsers();
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (error: any) {
      console.error('Error loading users:', error);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Silme fonksiyonu
  const handleDeleteUser = (userId: number, username: string) => {
    Alert.alert(
      'Kullanıcıyı Sil',
      `${username} kullanıcısını silmek istediğinize emin misiniz?`,
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await authAPI.deleteUser(userId);
              Alert.alert('Başarılı', 'Kullanıcı başarıyla silindi.');
              await loadUsers(); // Listeyi yenile
            } catch (error: any) {
              Alert.alert('Hata', error.message || 'Kullanıcı silinemedi.');
            }
          },
        },
      ]
    );
  };

  // Rol değiştirme fonksiyonu
  const handleChangeRole = async (userId: number, currentRole: string) => {
    const roles = ['admin', 'planner', 'worker'];
    const currentIndex = roles.indexOf(currentRole);
    const nextRole = roles[(currentIndex + 1) % roles.length];
    
    try {
      await authAPI.changeUserRole(userId, nextRole);
      Alert.alert('Başarılı', 'Kullanıcı rolü değiştirildi.');
      await loadUsers(); // Listeyi yenile
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Kullanıcı rolü değiştirilemedi.');
    }
  };

  // Component mount olduğunda backend'den veri yükle
  useEffect(() => {
    loadBackendData();
    loadUsers(); // Kullanıcıları yükle
    
    // Her 5 saniyede bir yenile
    const interval = setInterval(() => {
      loadBackendData();
      loadUsers(); // Kullanıcıları da yenile
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // showUsers değiştiğinde scroll pozisyonunu koru - KALDIRILDI
  // Scroll pozisyonu onPress içinde yönetiliyor

  const formatDate = (date: string | Date) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>YÖNETİM PANELİ</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        scrollEnabled={!isUserSectionExpanding}
        onScroll={(event) => {
          if (!isUserSectionExpanding) {
            scrollPositionRef.current = event.nativeEvent.contentOffset.y;
          }
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Yönetici: {user.name}</Text>
          <Text style={styles.infoText}>Genel üretim analizleri ve raporlar</Text>
        </View>

        {/* Genel Özet */}
        {productionAnalysis && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Genel Özet</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>
                  {productionAnalysis.totalProductions}
                </Text>
                <Text style={styles.summaryLabel}>Toplam Üretim</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>
                  {productionAnalysis.totalParts.toLocaleString()}
                </Text>
                <Text style={styles.summaryLabel}>Toplam Parça</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>
                  {productionAnalysis.totalActiveMachines}
                </Text>
                <Text style={styles.summaryLabel}>Aktif Makine</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>
                  %{productionAnalysis.averageEfficiency.toFixed(1)}
                </Text>
                <Text style={styles.summaryLabel}>Ort. Verimlilik</Text>
              </View>
            </View>
          </View>
        )}

        {/* Sorun Bildirimleri */}
        {issues.length > 0 && (
          <View style={styles.sectionCard}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => setShowIssues(!showIssues)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>⚠️ Sorun Bildirimleri</Text>
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
                const machine = backendMachines.find(m => m.id === machineId);
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
                    Bildirilme: {formatDateTime(new Date(issue.created_at))}
                  </Text>
                </View>
              );
                })}
              </>
            )}
          </View>
        )}

        {/* Tüm İş Aşamaları */}
        <View style={styles.sectionCard}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setShowAllStages(!showAllStages)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>🔄 Tüm İş Aşamaları</Text>
            <Text style={styles.expandIcon}>
              {showAllStages ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          
          {showAllStages && (
            <>
              {/* Arama Çubuğu */}
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="İş emri, aşama adı, ürün kodu veya lot no ile ara..."
                  placeholderTextColor="#95a5a6"
                  value={stageSearchQuery}
                  onChangeText={setStageSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {loading && !workOrders.length ? (
            <ActivityIndicator size="small" color="#e74c3c" style={{ marginVertical: 20 }} />
          ) : (() => {
            // Tüm stage'leri topla (planned, in_progress, paused, done)
            const allStages: Array<{
              stage: WorkOrderStage;
              workOrder: WorkOrder;
            }> = [];
            
            for (const wo of workOrders) {
              const stages = workOrderStages.get(wo.id) || [];
              
              // Tüm stage'leri ekle (sadece aktif olanlar değil)
              for (const stage of stages) {
                // Sadece done olmayan stage'leri göster
                if (stage.status !== 'done') {
                  allStages.push({ stage, workOrder: wo });
                }
              }
            }
            
            if (allStages.length === 0) {
              return <Text style={styles.emptyText}>İş aşaması bulunmuyor</Text>;
            }
            
            // Arama sorgusuna göre filtrele
            const filteredStages = stageSearchQuery.trim() === '' 
              ? allStages 
              : allStages.filter(({ stage, workOrder }) => {
                  const query = stageSearchQuery.toLowerCase().trim();
                  const workOrderId = workOrder.id.toString();
                  const stageName = stage.stage_name.toLowerCase();
                  const productCode = (workOrder.product_code || '').toLowerCase();
                  const lotNo = (workOrder.lot_no || '').toLowerCase();
                  
                  return (
                    workOrderId.includes(query) ||
                    stageName.includes(query) ||
                    productCode.includes(query) ||
                    lotNo.includes(query)
                  );
                });
            
            if (filteredStages.length === 0) {
              return <Text style={styles.emptyText}>Arama sonucu bulunamadı</Text>;
            }
            
            // Stage'leri duruma göre sırala: in_progress > paused > planned
            filteredStages.sort((a, b) => {
              const statusOrder: Record<string, number> = {
                'in_progress': 1,
                'paused': 2,
                'planned': 3,
                'done': 4
              };
              return (statusOrder[a.stage.status] || 99) - (statusOrder[b.stage.status] || 99);
            });
            
            return filteredStages.map(({ stage, workOrder }) => {
              let statusText = '';
              let statusColor = '#95a5a6';
              
              if (stage.status === 'in_progress') {
                statusText = 'Devam Ediyor';
                statusColor = '#3498db';
              } else if (stage.status === 'paused') {
                statusText = 'Durduruldu';
                statusColor = '#e74c3c';
              } else if (stage.status === 'planned') {
                statusText = 'Planlandı';
                statusColor = '#95a5a6';
              } else if (stage.status === 'done') {
                statusText = 'Tamamlandı';
                statusColor = '#27ae60';
              }
              
              // Stage'in başlangıç zamanından itibaren geçen süreyi hesapla (sadece başlatılmışsa)
              let elapsedTime = '';
              if (stage.actual_start) {
                const startTime = new Date(stage.actual_start);
                const now = new Date();
                const elapsedMs = now.getTime() - startTime.getTime();
                const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
                const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
                if (hours > 0) {
                  elapsedTime = `${hours}sa ${minutes}dk`;
                } else {
                  elapsedTime = `${minutes}dk`;
                }
              }
              
              return (
                <View key={`${workOrder.id}-${stage.id}`} style={styles.activeStageCard}>
                  <View style={styles.activeStageHeader}>
                    <View>
                      <Text style={styles.activeStageTitle}>
                        İş Emri #{workOrder.id} - {stage.stage_name}
                      </Text>
                      <Text style={styles.activeStageProduct}>
                        Ürün: {products.find((p: any) => p.code === workOrder.product_code)?.name || workOrder.product_code}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                      <Text style={styles.statusBadgeText}>{statusText}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.activeStageDetails}>
                    <Text style={styles.activeStageDetail}>
                      Hedef: {workOrder.qty} adet
                    </Text>
                    {stage.planned_start && (
                      <Text style={styles.activeStageDetail}>
                        Planlanan Başlangıç: {formatDateTime(new Date(stage.planned_start))}
                      </Text>
                    )}
                    {stage.actual_start && (
                      <Text style={styles.activeStageDetail}>
                        Gerçek Başlangıç: {formatDateTime(new Date(stage.actual_start))}
                      </Text>
                    )}
                    {elapsedTime && (
                      <Text style={styles.activeStageDetail}>
                        Süre: {elapsedTime}
                      </Text>
                    )}
                    {workOrder.created_by_username && (
                      <Text style={styles.activeStageDetail}>
                        Operatör: {workOrder.created_by_username}
                      </Text>
                    )}
                  </View>
                  
                  {/* Eğer paused ise, issue bilgisini göster */}
                  {stage.status === 'paused' && (() => {
                    const stageIssue = issues.find(
                      issue => issue.work_order_stage_id === stage.id
                    );
                    if (stageIssue) {
                      return (
                        <View style={styles.pausedIssueInfo}>
                          <Text style={styles.pausedIssueLabel}>⚠️ Durdurma Sebebi:</Text>
                          <Text style={styles.pausedIssueText}>
                            {stageIssue.description || 'Açıklama yok'}
                          </Text>
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>
              );
            });
          })()}
            </>
          )}
        </View>

        {/* Operatör Performansı */}
        {productionAnalysis && productionAnalysis.operatorPerformance.length > 0 && (
          <View style={styles.sectionCard}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => setShowOperatorPerformance(!showOperatorPerformance)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Operatör Performansı</Text>
              <Text style={styles.expandIcon}>
                {showOperatorPerformance ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
            
            {showOperatorPerformance && (
              <>
                {productionAnalysis.operatorPerformance.map((operator) => (
            <View key={operator.operatorId} style={styles.operatorCard}>
              <View style={styles.operatorHeader}>
                <Text style={styles.operatorName}>{operator.operatorName}</Text>
                <View style={styles.efficiencyBadge}>
                  <Text style={styles.efficiencyBadgeText}>
                    %{operator.averageEfficiency.toFixed(1)}
                  </Text>
                </View>
              </View>
              <View style={styles.operatorStats}>
                <View style={styles.operatorStat}>
                  <Text style={styles.operatorStatLabel}>Üretim</Text>
                  <Text style={styles.operatorStatValue}>{operator.totalProductions}</Text>
                </View>
                <View style={styles.operatorStat}>
                  <Text style={styles.operatorStatLabel}>Parça</Text>
                  <Text style={styles.operatorStatValue}>
                    {operator.totalParts.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.operatorStat}>
                  <Text style={styles.operatorStatLabel}>Ort. Süre</Text>
                  <Text style={styles.operatorStatValue}>
                    {operator.averageDuration.toFixed(1)}s
                  </Text>
                </View>
              </View>
              <View style={styles.efficiencyContainer}>
                <View style={[
                  styles.efficiencyBar,
                  { width: `${operator.averageEfficiency}%` }
                ]} />
              </View>
            </View>
          ))}
              </>
            )}
          </View>
        )}

        {/* Makine Performansı */}
        {productionAnalysis && productionAnalysis.machinePerformance.length > 0 && (
          <View style={styles.sectionCard}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => setShowMachinePerformance(!showMachinePerformance)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Makine Performansı</Text>
              <Text style={styles.expandIcon}>
                {showMachinePerformance ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
            
            {showMachinePerformance && (
              <>
                {productionAnalysis.machinePerformance.map((machine) => (
            <View key={machine.machineId} style={styles.machineCard}>
              <View style={styles.machineHeader}>
                <Text style={styles.machineName}>{machine.machineName}</Text>
                <Text style={styles.machineId}>{machine.machineId}</Text>
              </View>
              <View style={styles.machineStats}>
                <View style={styles.machineStat}>
                  <Text style={styles.machineStatLabel}>Üretim</Text>
                  <Text style={styles.machineStatValue}>{machine.totalProductions}</Text>
                </View>
                <View style={styles.machineStat}>
                  <Text style={styles.machineStatLabel}>Parça</Text>
                  <Text style={styles.machineStatValue}>
                    {machine.totalParts.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.machineStat}>
                  <Text style={styles.machineStatLabel}>Verimlilik</Text>
                  <Text style={styles.machineStatValue}>
                    %{machine.averageEfficiency.toFixed(1)}
                  </Text>
                </View>
                <View style={styles.machineStat}>
                  <Text style={styles.machineStatLabel}>Çalışma</Text>
                  <Text style={styles.machineStatValue}>{machine.uptime}s</Text>
                </View>
              </View>
            </View>
          ))}
              </>
            )}
          </View>
        )}

        {/* Günlük Üretim */}
        {productionAnalysis && productionAnalysis.dailyProduction.length > 0 && (
          <View style={styles.sectionCard}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => setShowDailyProduction(!showDailyProduction)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Günlük Üretim Trendi</Text>
              <Text style={styles.expandIcon}>
                {showDailyProduction ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
            
            {showDailyProduction && (
              <>
                {productionAnalysis.dailyProduction.map((daily, index) => (
            <View key={index} style={styles.dailyCard}>
              <View style={styles.dailyHeader}>
                <Text style={styles.dailyDate}>{formatDate(daily.date)}</Text>
                <Text style={styles.dailyEfficiency}>
                  %{daily.efficiency.toFixed(1)} verimlilik
                </Text>
              </View>
              <View style={styles.dailyStats}>
                <Text style={styles.dailyStat}>
                  {daily.totalProductions} üretim
                </Text>
                <Text style={styles.dailyStat}>
                  {daily.totalParts.toLocaleString()} parça
                </Text>
              </View>
            </View>
          ))}
              </>
            )}
          </View>
        )}

        {/* Kullanıcı Yönetimi */}
        <View 
          style={styles.sectionCard}
          onLayout={(event) => {
            // Bölümün ekrandaki Y pozisyonunu al (üstten uzaklık)
            const { y } = event.nativeEvent.layout;
            userSectionYRef.current = y;
          }}
        >
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => {
              // Mevcut scroll pozisyonunu kaydet
              const currentScrollY = scrollPositionRef.current;
              savedScrollYRef.current = currentScrollY;
              
              // State'i değiştir
              const newShowUsers = !showUsers;
              setShowUsers(newShowUsers);
              
              // Layout değişikliği tamamlandıktan sonra scroll pozisyonunu koru
              // Daha kısa delay kullan ve scroll'u geçici olarak devre dışı bırak
              setIsUserSectionExpanding(true);
              
              setTimeout(() => {
                if (scrollViewRef.current) {
                  scrollViewRef.current.scrollTo({
                    y: currentScrollY,
                    animated: false,
                  });
                }
                // Scroll'u tekrar aktif et
                setTimeout(() => {
                  setIsUserSectionExpanding(false);
                }, 100);
              }, 100); // Daha kısa delay
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>👥 Kullanıcı Yönetimi</Text>
            <Text style={styles.expandIcon}>
              {showUsers ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          
          {showUsers && (
            <>
              {loadingUsers ? (
                <ActivityIndicator size="small" color="#e74c3c" style={{ marginVertical: 20 }} />
              ) : users.length === 0 ? (
                <Text style={styles.emptyText}>Kullanıcı bulunmuyor</Text>
              ) : (
                users.map((u) => {
                  if (!u || !u.id) {
                    return null; // Geçersiz kullanıcıyı atla
                  }
                  
                  const roleColors: Record<string, string> = {
                    'admin': '#e74c3c',
                    'planner': '#9b59b6',
                    'worker': '#3498db',
                  };
                  const roleTexts: Record<string, string> = {
                    'admin': 'Yönetici',
                    'planner': 'Planlayıcı',
                    'worker': 'Operatör',
                  };
                  
                  const userRole = (u.role && typeof u.role === 'string') ? u.role : 'worker';
                  const isCurrentUser = u.id.toString() === user.id.toString();
                  const username = (u.username && typeof u.username === 'string') ? u.username : 'Bilinmeyen Kullanıcı';
                  
                  return (
                    <View key={u.id} style={styles.userCard}>
                      <View style={styles.userHeader}>
                        <View>
                          <Text style={styles.userName}>{username}</Text>
                          {u.email && typeof u.email === 'string' && (
                            <Text style={styles.userEmail}>{u.email}</Text>
                          )}
                          {u.phone && typeof u.phone === 'string' && (
                            <Text style={styles.userPhone}>{u.phone}</Text>
                          )}
                        </View>
                        <View style={[styles.roleBadge, { backgroundColor: roleColors[userRole] || '#95a5a6' }]}>
                          <Text style={styles.roleBadgeText}>{roleTexts[userRole] || userRole}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.userActions}>
                        <TouchableOpacity
                          style={[styles.roleButton, { backgroundColor: '#9b59b6' }]}
                          onPress={() => handleChangeRole(u.id, userRole)}
                          disabled={isCurrentUser}
                        >
                          <Text style={styles.actionButtonText}>Rol Değiştir</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.deleteButton, { backgroundColor: '#e74c3c' }]}
                          onPress={() => handleDeleteUser(u.id, username)}
                          disabled={isCurrentUser}
                        >
                          <Text style={styles.actionButtonText}>Sil</Text>
                        </TouchableOpacity>
                      </View>
                      {isCurrentUser && (
                        <Text style={styles.currentUserNote}>
                          ⚠️ Kendi hesabınızı silemez veya rolünüzü değiştiremezsiniz
                        </Text>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}
        </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecf0f1',
  },
  header: {
    backgroundColor: '#e74c3c',
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
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  summaryCard: {
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
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 10,
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e74c3c',
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
  operatorCard: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  operatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  operatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  efficiencyBadge: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  efficiencyBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  operatorStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  operatorStat: {
    alignItems: 'center',
  },
  operatorStatLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  operatorStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  efficiencyContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#ecf0f1',
    borderRadius: 4,
    overflow: 'hidden',
  },
  efficiencyBar: {
    height: '100%',
    backgroundColor: '#27ae60',
    borderRadius: 4,
  },
  machineCard: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  machineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  machineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  machineId: {
    fontSize: 12,
    color: '#7f8c8d',
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  machineStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  machineStat: {
    alignItems: 'center',
  },
  machineStatLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  machineStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  dailyCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  dailyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dailyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  dailyEfficiency: {
    fontSize: 14,
    fontWeight: '600',
    color: '#27ae60',
  },
  dailyStats: {
    flexDirection: 'row',
    gap: 15,
  },
  dailyStat: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  productionCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
    marginBottom: 15,
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
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
  issueType: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  activeStageCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeStageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  activeStageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  activeStageProduct: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  activeStageDetails: {
    marginTop: 8,
  },
  activeStageDetail: {
    fontSize: 13,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  pausedIssueInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff3cd',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#ffc107',
  },
  pausedIssueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  pausedIssueText: {
    fontSize: 13,
    color: '#856404',
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
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
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  userActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  currentUserNote: {
    fontSize: 12,
    color: '#e74c3c',
    fontStyle: 'italic',
    marginTop: 8,
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

export default ManagerScreen;

