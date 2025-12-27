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
import { workOrdersAPI, machinesAPI, stagesAPI, productsAPI, moldsAPI } from '../utils/api';

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
  qty: number;  // Hedef ürün sayısı
  produced_qty?: number;  // Mevcut üretilen ürün sayısı
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

interface Product {
  id: number;
  code: string;
  name: string;
  description?: string;
}

interface Mold {
  id: number;
  code: string;
  name: string;
  description?: string;
  product_id?: number;
  status: string;
  cavity_count?: number;
  cycle_time_sec?: number;
  injection_temp_c?: number;
  mold_temp_c?: number;
  material?: string;
  part_weight_g?: number;
  hourly_production?: number;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [molds, setMolds] = useState<Mold[]>([]);
  const [productCodeToProductMap, setProductCodeToProductMap] = useState<Map<string, Product>>(new Map());
  const [productIdToMoldsMap, setProductIdToMoldsMap] = useState<Map<number, Mold[]>>(new Map());
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

      // Products yükle
      const productsResponse = await productsAPI.getProducts();
      const allProducts = Array.isArray(productsResponse) ? productsResponse : [];
      setProducts(allProducts);
      
      // Product code'dan product'a mapping oluştur
      const codeToProductMap = new Map<string, Product>();
      allProducts.forEach((product: Product) => {
        codeToProductMap.set(product.code, product);
      });
      setProductCodeToProductMap(codeToProductMap);

      // Molds yükle
      const moldsResponse = await moldsAPI.getMolds();
      const allMolds = Array.isArray(moldsResponse) ? moldsResponse : [];
      setMolds(allMolds);
      
      // Product ID'den molds'lara mapping oluştur
      const productIdToMolds = new Map<number, Mold[]>();
      allMolds.forEach((mold: Mold) => {
        if (mold.product_id) {
          if (!productIdToMolds.has(mold.product_id)) {
            productIdToMolds.set(mold.product_id, []);
          }
          productIdToMolds.get(mold.product_id)!.push(mold);
        }
      });
      setProductIdToMoldsMap(productIdToMolds);

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

      // Benzersiz product'ları bul (product_code'a göre)
      const uniqueProducts = new Map<string, { product: Product; workOrders: typeof activeWOs }>();
      
      for (const wo of activeWOs) {
        const product = codeToProductMap.get(wo.product_code);
        if (!product) continue;
        
        if (!uniqueProducts.has(product.code)) {
          uniqueProducts.set(product.code, { product, workOrders: [] });
        }
        uniqueProducts.get(product.code)!.workOrders.push(wo);
      }
      
      // İlk 4 ürünü seç (database'den - otomotiv klipsi dahil)
      const selectedProducts = Array.from(uniqueProducts.values()).slice(0, 4);

      // Product code'dan product'ı bul ve molds'ları al
      const productionRecords: ProductionRecord[] = [];
      
      for (const { product, workOrders: productWorkOrders } of selectedProducts) {
        // Bu product için ilk aktif work order'ı al
        const wo = productWorkOrders[0];
        
        // Product'a ait ilk mold'u al (her ürün için 1 mold)
        const productMolds = productIdToMolds.get(product.id) || [];
        const mold = productMolds[0]; // İlk mold'u al
        
        const stages = stagesMap.get(wo.id) || [];
        const firstStage = stages[0];
        const inProgressStage = stages.find(s => s.status === 'in_progress');
        const doneStages = stages.filter(s => s.status === 'done');
        
        const startTime = inProgressStage?.actual_start || 
                         doneStages[0]?.actual_start || 
                         firstStage?.planned_start || 
                         wo.planned_start;

        const machineIndex = wo.id % (allMachines.length || 1);
        const machine = allMachines[machineIndex] || (allMachines.length > 0 ? allMachines[0] : { id: 1, name: 'Makine 1' });

        // Her ürün için 1 production record oluştur (mold varsa mold bilgileriyle, yoksa sadece product bilgileriyle)
        productionRecords.push({
          id: mold ? `WO-${wo.id}-PRODUCT-${product.id}-MOLD-${mold.id}` : `WO-${wo.id}-PRODUCT-${product.id}`,
          machineId: machine.id.toString(),
          operatorId: user.id,
          operatorName: user.name,
          productName: product.name || wo.product_code,
          startTime: new Date(startTime),
          partCount: wo.produced_qty || 0,  // Database'den gelen mevcut üretilen ürün sayısı
          targetCount: wo.qty,  // Database'den gelen hedef ürün sayısı
          cycleTime: mold?.cycle_time_sec || 3,
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
          // Mold bilgilerini ekle (database'den) - eğer varsa
          moldData: mold ? {
            id: mold.id,
            name: mold.name,
            code: mold.code,
            cycle_time_sec: mold.cycle_time_sec,
            hourly_production: mold.hourly_production,
            injection_temp_c: mold.injection_temp_c,
            mold_temp_c: mold.mold_temp_c,
            material: mold.material,
            part_weight_g: mold.part_weight_g,
          } : undefined,
          // Product bilgilerini de ekle
          productData: {
            id: product.id,
            code: product.code,
            name: product.name,
          },
        });
      }

      // Backend'den gelen verileri hem state'e hem de productionStore'a kaydet
      setActiveProductions(productionRecords);
      productionStore.initialize(productionRecords);
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
      // Mevcut state'i kullan (productionStore yerine)
      setActiveProductions(prevProductions => {
        const updated = prevProductions.map(production => {
          if (production.status === 'active' && production.cycleTime && production.cycleTime > 0) {
            const now = new Date();
            const startTime = new Date(production.startTime);
            const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
            let calculatedPartCount = Math.floor(elapsedSeconds / production.cycleTime);
            
            // Hedef sayı varsa ve hedef sayıya ulaşıldıysa
            if (production.targetCount && calculatedPartCount >= production.targetCount) {
              calculatedPartCount = production.targetCount;
              
              // Üretimi tamamlanmış olarak işaretle
              return {
                ...production,
                status: 'completed' as const,
                partCount: production.targetCount,
                endTime: now,
              };
            } else {
              // Sadece değiştiyse güncelle
              if (calculatedPartCount !== production.partCount) {
                return {
                  ...production,
                  partCount: calculatedPartCount
                };
              }
            }
          }
          return production;
        });
        
        // Store'u da güncelle (senkronizasyon için)
        productionStore.initialize(updated);
        
        return updated;
      });
    };

    updateProductions();
    const interval = setInterval(updateProductions, 1000);
    return () => clearInterval(interval);
  }, []); // activeProductions dependency olarak eklenmemeli (sonsuz loop olur)

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
            // Database'den gelen mevcut üretilen ürün sayısını kullan (production.partCount)
            const calculatedPartCount = production.partCount || 0;
            
            // Mold verilerini kullan (database'den)
            const moldData = production.moldData;
            
            // Mold verilerinden bilgileri al
            const moldName = moldData?.name || 'N/A'; // KP-01 -> molds.name
            const productName = production.productName; // priz -> products.name (zaten production.productName'de)
            const cycleTime = moldData?.cycle_time_sec || production.cycleTime; // molds.cycle_time_sec
            const hourlyOutput = moldData?.hourly_production; // molds.hourly_production
            const injectionTemp = moldData?.injection_temp_c; // molds.injection_temp_c
            const moldTemp = moldData?.mold_temp_c; // molds.mold_temp_c
            const material = moldData?.material; // molds.material
            const partWeight = moldData?.part_weight_g; // molds.part_weight_g
            
            // Makine kodu (KP-01 formatında) - mold name'den veya makine ID'den
            let machineCode = '';
            if (moldName && moldName.match(/\d+/)) {
              const numbers = moldName.match(/\d+/);
              machineCode = numbers ? numbers[0] : '1';
            } else if (machine?.name) {
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
                    <Text style={styles.machineCardCode}>{moldName}</Text>
                  </View>
                  <View style={[styles.machineStatusDot, { backgroundColor: statusColor }]}>
                    <Text style={styles.machineStatusText}>{statusText}</Text>
                  </View>
                </View>
                
                {/* Ürün Adı */}
                <Text style={styles.machineProductName}>{productName}</Text>
                
                {/* Metrikler - 4 ayrı kutucuk */}
                <View style={styles.machineMetricsRow}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricIcon}>⏱</Text>
                    <Text style={styles.metricLabel}>Cycle Time</Text>
                    <Text style={styles.metricValue}>{cycleTime} sec</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricIcon}>📊</Text>
                    <Text style={styles.metricLabel}>Mevcut Üretim</Text>
                    <Text style={styles.metricValue}>{calculatedPartCount} adet</Text>
                  </View>
                </View>
                <View style={styles.machineMetricsRow}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricIcon}>📦</Text>
                    <Text style={styles.metricLabel}>Hourly Output</Text>
                    <Text style={styles.metricValue}>{hourlyOutput} pcs</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricIcon}>🎯</Text>
                    <Text style={styles.metricLabel}>Hedef Üretim</Text>
                    <Text style={styles.metricValue}>{production.targetCount || 0} adet</Text>
                  </View>
                </View>
                
                {/* Alt Bilgiler */}
                <View style={styles.machineDetailsRow}>
                  <Text style={styles.machineDetail}>Inj: {injectionTemp}°C</Text>
                  <Text style={styles.machineDetail}>Mold: {moldTemp}°C</Text>
                  <Text style={styles.machineDetail}>{material}</Text>
                  <Text style={styles.machineDetail}>{partWeight}g</Text>
                </View>
              </View>
            );
          })
        )}

        {/* Makine Durumu */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Makine Durumu</Text>
          {backendMachines.length === 0 ? (
            <Text style={styles.emptyText}>Makine bulunmamaktadır.</Text>
          ) : (
            backendMachines.map((machine) => {
              // Backend status değerlerini Türkçe'ye çevir
              const getStatusText = (status: string) => {
                if (status === 'active') return 'Çalışıyor';
                if (status === 'maintenance') return 'Bakımda';
                if (status === 'inactive') return 'Çalışmıyor';
                return status; // Fallback
              };

              const getStatusColor = (status: string) => {
                if (status === 'active') return '#27ae60'; // Yeşil - Çalışıyor
                if (status === 'maintenance') return '#f39c12'; // Turuncu - Bakımda
                if (status === 'inactive') return '#e74c3c'; // Kırmızı - Çalışmıyor
                return '#95a5a6'; // Gri - Bilinmeyen
              };

              return (
                <View key={machine.id} style={styles.machineItem}>
                  <View style={styles.machineHeader}>
                    <Text style={styles.machineName}>{machine.name}</Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(machine.status) }
                    ]}>
                      <Text style={styles.statusBadgeText}>
                        {getStatusText(machine.status)}
                      </Text>
                    </View>
                  </View>
                  {machine.machine_type && (
                    <Text style={styles.machineDetail}>Tip: {machine.machine_type}</Text>
                  )}
                  {machine.location && (
                    <Text style={styles.machineDetail}>Konum: {machine.location}</Text>
                  )}
                </View>
              );
            })
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
  metricSubValue: {
    fontSize: 12,
    color: '#3498db',
    marginTop: 4,
    fontWeight: '600',
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
