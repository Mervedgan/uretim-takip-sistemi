/**
 * Dashboard Ekranı
 * Tüm kullanıcılar için genel ana ekran
 */

import React, { useState, useEffect, useRef } from 'react';
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
import { workOrdersAPI, machinesAPI, stagesAPI, productsAPI, moldsAPI, issuesAPI } from '../utils/api';

interface DashboardScreenProps {
  user: User;
  onLogout: () => void;
  onNavigateToRoleScreen: () => void;
  onNavigateToProducts?: () => void;
  onNavigateToMolds?: () => void;
  onNavigateToProfile?: () => void;
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
  machine_id?: number;  // Üretim için seçilen makine ID'si
}

interface WorkOrderStage {
  id: number;
  work_order_id: number;
  stage_name: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: 'planned' | 'in_progress' | 'paused' | 'done';
  paused_at?: string | null;
  resumed_at?: string | null;
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

interface Product {
  id: number;
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
}

interface Mold {
  id: number;
  code: string;
  name: string;
  description?: string;
  product_id?: number;
  status: string;
  // Excel kolonları kaldırıldı - artık Product interface'inde
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ 
  user, 
  onLogout, 
  onNavigateToRoleScreen,
  onNavigateToProducts,
  onNavigateToMolds,
  onNavigateToProfile,
  refreshTrigger
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeProductions, setActiveProductions] = useState<ProductionRecord[]>([]);
  // useRef ile activeProductions'ın güncel değerini takip et (closure sorununu önlemek için)
  const activeProductionsRef = useRef<ProductionRecord[]>([]);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedProductionId, setSelectedProductionId] = useState<string | null>(null);
  const [issueDescription, setIssueDescription] = useState('');
  const [selectedStopReason, setSelectedStopReason] = useState<string | null>(null);
  const [targetReachedNotified, setTargetReachedNotified] = useState<Set<string>>(new Set());
  const [lastQualityCheckTime, setLastQualityCheckTime] = useState<Map<string, Date>>(new Map());
  const [qualityCheckNotified, setQualityCheckNotified] = useState<Set<string>>(new Set());
  
  // Dashboard accordion states
  const [showActiveProductions, setShowActiveProductions] = useState<boolean>(true); // Varsayılan açık
  const [showMachineStatus, setShowMachineStatus] = useState<boolean>(false);
  
  // activeProductions değiştiğinde ref'i güncelle
  useEffect(() => {
    activeProductionsRef.current = activeProductions;
  }, [activeProductions]);
  
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
      // Makine listesini ID'ye göre sırala (deterministik makine seçimi için)
      allMachines.sort((a, b) => a.id - b.id);
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

      // Tüm issue'ları yükle (paused stage'ler için)
      let allIssues: any[] = [];
      try {
        const issuesResponse = await issuesAPI.listIssues();
        const issuesData = issuesResponse.data || issuesResponse;
        allIssues = Array.isArray(issuesData) ? issuesData : [];
      } catch (error) {
        console.error('Error loading issues:', error);
      }

      // Aktif work orders'ları ProductionRecord formatına dönüştür
      // Sadece operatör tarafından başlatılan üretimleri göster (machine_id olan work order'lar)
      const activeWOs = allWorkOrders.filter(wo => {
        // Machine_id olmalı (operatör tarafından başlatılan üretimler)
        if (!wo.machine_id || wo.machine_id <= 0) {
          return false;
        }
        
        const stages = stagesMap.get(wo.id) || [];
        // Sadece in_progress veya paused stage'leri olan work order'ları göster (done'ları çıkar)
        // Tamamlanmış üretimler aktif üretimlerde gösterilmemeli
        return stages.some(s => s.status === 'in_progress' || s.status === 'paused');
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
      
      // Tüm ürünleri al (ilk 4 seçimi kaldırıldı - sadece operatör tarafından başlatılan üretimler)
      const selectedProducts = Array.from(uniqueProducts.values())
        .sort((a, b) => a.product.code.localeCompare(b.product.code));

      // Product code'dan product'ı bul ve molds'ları al
      const productionRecords: ProductionRecord[] = [];
      
      for (const { product, workOrders: productWorkOrders } of selectedProducts) {
        // Bu product için en son aktif work order'ı seç (ID'ye göre sırala - deterministik)
        const sortedWorkOrders = [...productWorkOrders].sort((a, b) => b.id - a.id);
        const wo = sortedWorkOrders[0];
        
        // Product'a ait ilk mold'u al (her ürün için 1 mold)
        const productMolds = productIdToMolds.get(product.id) || [];
        const mold = productMolds[0]; // İlk mold'u al
        
        const stages = stagesMap.get(wo.id) || [];
        const firstStage = stages[0];
        const inProgressStage = stages.find(s => s.status === 'in_progress');
        const pausedStage = stages.find(s => s.status === 'paused');
        const doneStages = stages.filter(s => s.status === 'done');
        
        // Paused stage için issue bilgisini al
        let issueDescription: string | undefined;
        let pausedAtDate: Date | undefined;
        if (pausedStage) {
          // Bu stage için en son issue'u bul
          const stageIssue = allIssues
            .filter((issue: any) => issue.work_order_stage_id === pausedStage.id)
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          if (stageIssue && stageIssue.description) {
            issueDescription = stageIssue.description;
            pausedAtDate = pausedStage.paused_at ? new Date(pausedStage.paused_at) : undefined;
          }
        }
        
        const startTime = inProgressStage?.actual_start || 
                         pausedStage?.actual_start ||
                         doneStages[0]?.actual_start || 
                         firstStage?.planned_start || 
                         wo.planned_start;

        // Production ID'yi bir kez hesapla (deterministik makine seçimi için kullanılacak)
        const productionId = mold ? `WO-${wo.id}-PRODUCT-${product.id}-MOLD-${mold.id}` : `WO-${wo.id}-PRODUCT-${product.id}`;
        
        // Makine seçimi: Sadece work order'da machine_id varsa makineyi göster
        // Varsayılan makine gösterilmemeli - sadece worker'ın başlattığı üretimlerde makine olmalı
        let machine;
        if (wo.machine_id && wo.machine_id > 0) {
          // Work order'da machine_id varsa onu kullan
          machine = allMachines.find(m => m.id === wo.machine_id);
          // Makine bulunamazsa null bırak (varsayılan makine gösterme)
          if (!machine) {
            machine = null;
          }
        } else {
          // machine_id yoksa makine gösterme (zaten filtreleme yapıldı ama ekstra güvenlik)
          machine = null;
        }
        
        // Makine yoksa bu production'ı atla (sadece worker'ın başlattığı üretimler gösterilmeli)
        if (!machine) {
          continue;
        }

        // Mevcut production'ı bul (eğer varsa) - ref'ten al (güncel değer)
        const existingProduction = activeProductionsRef.current.find(p => p.id === productionId);
        
        // Status hesapla
        const calculatedStatus = (() => {
          if (inProgressStage) return 'active' as const;
          if (pausedStage) return 'paused' as const;
          // Tüm stage'ler done ise completed
          if (doneStages.length === stages.length && stages.length > 0) return 'completed' as const;
          // Hiç stage yoksa veya sadece planned stage'ler varsa paused
          return 'paused' as const;
        })();

        // Eğer mevcut production varsa ve kritik alanlar değişmediyse, mevcut production'ı kullan
        if (existingProduction) {
          const statusChanged = existingProduction.status !== calculatedStatus;
          const targetCountChanged = existingProduction.targetCount !== wo.qty;
          const cycleTimeChanged = existingProduction.cycleTime !== (product?.cycle_time_sec || 3);
          const productNameChanged = existingProduction.productName !== (product.name || wo.product_code);
          const issueChanged = existingProduction.issue !== issueDescription;
          const pausedAtChanged = existingProduction.pausedAt?.getTime() !== pausedAtDate?.getTime();
          
          // Kritik alanlar değişmediyse, mevcut production'ı kullan (aynı referans)
          // Bu sayede React gereksiz render yapmayacak
          // Ama status, issue veya pausedAt değiştiyse güncelle
          if (!statusChanged && !targetCountChanged && !cycleTimeChanged && !productNameChanged && !issueChanged && !pausedAtChanged) {
            productionRecords.push(existingProduction);
            continue; // Bir sonraki product'a geç
          }
        }

        // Her ürün için 1 production record oluştur (mold varsa mold bilgileriyle, yoksa sadece product bilgileriyle)
        productionRecords.push({
          id: productionId,
          machineId: machine.id.toString(),
          operatorId: user.id,
          operatorName: user.name,
          productName: product.name || wo.product_code,
          startTime: existingProduction?.startTime || new Date(startTime), // Mevcut startTime'ı koru
          partCount: (() => {
            // Eğer mevcut production varsa partCount'u koru
            if (existingProduction) {
              // Aktif production için client-side hesaplanan değeri koru
              if (existingProduction.status === 'active' && 
                  existingProduction.cycleTime && 
                  existingProduction.cycleTime > 0) {
                return existingProduction.partCount;
              }
              // Paused veya completed production için mevcut partCount'u koru
              if (existingProduction.status === 'paused' || existingProduction.status === 'completed') {
                return existingProduction.partCount;
              }
            }
            return wo.produced_qty || 0;
          })(),
          targetCount: wo.qty,  // Database'den gelen hedef ürün sayısı
          cycleTime: product?.cycle_time_sec || 3,
          status: calculatedStatus, // Her zaman backend'den gelen status'ü kullan
          stages: stages.map((s, idx) => ({
            id: `stage-${s.id}`,
            name: s.stage_name,
            order: idx + 1,
            status: s.status === 'done' ? 'completed' as const :
                   s.status === 'in_progress' ? 'in_progress' as const :
                   s.status === 'paused' ? 'paused' as const :
                   'pending' as const,
            startTime: s.actual_start ? new Date(s.actual_start) : undefined,
            endTime: s.actual_end ? new Date(s.actual_end) : undefined,
          })),
          // Mold bilgilerini ekle (database'den) - sadece temel bilgiler (Excel kolonları kaldırıldı)
          moldData: mold ? {
            id: mold.id,
            name: mold.name,
            code: mold.code,
            // Excel kolonları kaldırıldı - artık productData'da
          } : undefined,
          // Product bilgilerini ekle (Excel kolonları burada)
          productData: {
            id: product.id,
            code: product.code,
            name: product.name,
            // Molds'tan taşınan Excel kolonları
            cavity_count: product.cavity_count,
            cycle_time_sec: product.cycle_time_sec,
            injection_temp_c: product.injection_temp_c,
            mold_temp_c: product.mold_temp_c,
            material: product.material,
            part_weight_g: product.part_weight_g,
            hourly_production: product.hourly_production,
          },
          // Issue bilgilerini ekle (eğer paused stage varsa)
          issue: issueDescription,
          pausedAt: pausedAtDate,
        });
      }
      
      // Production records'ları ID'ye göre sırala (deterministik sıralama)
      productionRecords.sort((a, b) => a.id.localeCompare(b.id));

      // Backend'den gelen verileri hem state'e hem de productionStore'a kaydet
      // Sadece gerçekten değişiklik varsa state'i güncelle (gereksiz render'ları önlemek için)
      setActiveProductions(prevProductions => {
        // Production ID'lerini karşılaştır (sıralı)
        const prevIds = prevProductions.map(p => p.id).sort().join(',');
        const newIds = productionRecords.map(p => p.id).sort().join(',');
        
        // Debug: Production ID'lerini logla
        if (prevIds !== newIds) {
          console.log('🔄 Production listesi değişti:', { prevIds, newIds });
        }
        
        // Eğer production listesi değişmediyse, sadece backend'den gelen kritik alanları güncelle
        // Ama partCount gibi client-side hesaplanan değerleri koru
        if (prevIds === newIds && prevProductions.length > 0) {
          // Production listesi aynı, sadece backend'den gelen değerleri güncelle
          // Ama mevcut production'ların referanslarını mümkün olduğunca koru
          let hasRealChanges = false;
          const updated = prevProductions.map((prevProd, index) => {
            // Production records zaten sıralı, aynı index'teki production'ı al
            const newProd = productionRecords[index];
            
            // Eğer ID'ler eşleşmiyorsa, find ile bul
            if (!newProd || newProd.id !== prevProd.id) {
              const foundNewProd = productionRecords.find(p => p.id === prevProd.id);
              if (!foundNewProd) return prevProd;
              
              // Kritik alanları karşılaştır
              const shouldKeepPartCount = prevProd.status === 'active' && 
                                        prevProd.cycleTime && 
                                        prevProd.cycleTime > 0;
              
              const partCountChanged = !shouldKeepPartCount && prevProd.partCount !== foundNewProd.partCount;
              const statusChanged = prevProd.status !== foundNewProd.status;
              const targetCountChanged = prevProd.targetCount !== foundNewProd.targetCount;
              const startTimeChanged = prevProd.startTime.getTime() !== foundNewProd.startTime.getTime();
              const issueChanged = prevProd.issue !== foundNewProd.issue;
              const pausedAtChanged = prevProd.pausedAt?.getTime() !== foundNewProd.pausedAt?.getTime();
              
              // Eğer hiçbir kritik alan değişmediyse, aynı referansı döndür
              if (!partCountChanged && !statusChanged && !targetCountChanged && !startTimeChanged && !issueChanged && !pausedAtChanged) {
                return prevProd; // Aynı referans - React render yapmayacak
              }
              
              hasRealChanges = true;
              return {
                ...foundNewProd,
                partCount: shouldKeepPartCount ? prevProd.partCount : foundNewProd.partCount,
                // Status her zaman backend'den gelen değere göre güncellenmeli
                status: foundNewProd.status,
                startTime: prevProd.startTime,
              };
            }
            
            // Aynı index'te, aynı ID - direkt karşılaştır
            const shouldKeepPartCount = prevProd.status === 'active' && 
                                      prevProd.cycleTime && 
                                      prevProd.cycleTime > 0;
            
            const partCountChanged = !shouldKeepPartCount && prevProd.partCount !== newProd.partCount;
            const statusChanged = prevProd.status !== newProd.status;
            const targetCountChanged = prevProd.targetCount !== newProd.targetCount;
            const startTimeChanged = prevProd.startTime.getTime() !== newProd.startTime.getTime();
            const issueChanged = prevProd.issue !== newProd.issue;
            const pausedAtChanged = prevProd.pausedAt?.getTime() !== newProd.pausedAt?.getTime();
            
            // Eğer hiçbir kritik alan değişmediyse, aynı referansı döndür
            if (!partCountChanged && !statusChanged && !targetCountChanged && !startTimeChanged && !issueChanged && !pausedAtChanged) {
              return prevProd; // Aynı referans - React render yapmayacak
            }
            
            hasRealChanges = true;
            return {
              ...newProd,
              partCount: shouldKeepPartCount ? prevProd.partCount : newProd.partCount,
              // Status her zaman backend'den gelen değere göre güncellenmeli
              status: newProd.status,
              startTime: prevProd.startTime,
            };
          });
          
          // Sadece gerçekten değişiklik varsa state'i güncelle
          if (hasRealChanges) {
            productionStore.initialize(updated);
            return updated;
          } else {
            // Hiçbir değişiklik yok, aynı referansı döndür
            return prevProductions;
          }
        } else {
          // Production listesi değişti veya ilk yükleme - mevcut production'ları koruyarak güncelle
          const updated = productionRecords.map(newProd => {
            // Mevcut production'ı bul
            const existingProd = prevProductions.find(p => p.id === newProd.id);
            
            if (existingProd) {
              // Mevcut production varsa, mümkün olduğunca referansı koru
              // Sadece gerçekten değişen alanları güncelle
              const shouldKeepPartCount = existingProd.status === 'active' && 
                                        existingProd.cycleTime && 
                                        existingProd.cycleTime > 0;
              
              const partCountChanged = !shouldKeepPartCount && existingProd.partCount !== newProd.partCount;
              const statusChanged = existingProd.status !== newProd.status;
              const targetCountChanged = existingProd.targetCount !== newProd.targetCount;
              const startTimeChanged = existingProd.startTime.getTime() !== newProd.startTime.getTime();
              const issueChanged = existingProd.issue !== newProd.issue;
              const pausedAtChanged = existingProd.pausedAt?.getTime() !== newProd.pausedAt?.getTime();
              
              // Eğer hiçbir kritik alan değişmediyse, mevcut production'ı koru
              if (!partCountChanged && !statusChanged && !targetCountChanged && !startTimeChanged && !issueChanged && !pausedAtChanged) {
                return existingProd; // Aynı referans - React render yapmayacak
              }
              
              // Kritik alanlar değiştiyse, sadece değişen alanları güncelle
              return {
                ...newProd,
                partCount: shouldKeepPartCount ? existingProd.partCount : newProd.partCount,
                // Status her zaman backend'den gelen değere göre güncellenmeli
                status: newProd.status,
                startTime: existingProd.startTime,
              };
            }
            
            // Yeni production - direkt ekle
            return newProd;
          });
          
          productionStore.initialize(updated);
          return updated;
        }
      });
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
  }, []);

  // refreshTrigger değiştiğinde verileri yenile
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      // Veritabanı güncellemelerinin tamamlanması için bekleme
      const timeoutId = setTimeout(() => {
        loadBackendData();
        // Stage'lerin güncellenmesi için bir kez daha refresh yap
        setTimeout(() => {
          loadBackendData();
        }, 1500);
        // Son bir kez daha refresh yap (tüm güncellemelerin tamamlanması için)
        setTimeout(() => {
          loadBackendData();
        }, 3000);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [refreshTrigger]);

  // Her 1 saniyede bir yenile (aktif üretimler için - üretilen parça sayısını güncelle)
  // Aynı zamanda her 5 saniyede bir backend'den veri çek (loadBackendData ile senkronize)
  useEffect(() => {
    let backendDataCounter = 0; // Backend data çağrısı için sayaç
    
    const updateProductions = () => {
      // Sadece worker için bildirimler
      if (user.role === 'worker') {
        activeProductionsRef.current.forEach((production) => {
          const now = new Date();
          
          // Hedef ürün sayısına ulaşma kontrolü
          if (production.status === 'active' && production.targetCount) {
            const currentCount = calculatePartCount(production);
            if (currentCount >= production.targetCount && !targetReachedNotified.has(production.id)) {
              // Bildirim gönder
              Alert.alert(
                'Üretim Tamamlandı',
                `Makine ${production.machineId} için hedef ürün sayısına ulaşıldı.\nHedef: ${production.targetCount} adet\nÜretilen: ${currentCount} adet\n\nLütfen makineyi durdurun ve uygulamada "Durdur" butonuna basın.`,
                [{ text: 'Tamam' }]
              );
              // Bildirim gönderildi olarak işaretle
              setTargetReachedNotified(prev => new Set(prev).add(production.id));
            }
          }
          
          // 30 dakikalık hatalı ürün kontrol bildirimi
          if (production.status === 'active') {
            const lastCheck = lastQualityCheckTime.get(production.id);
            const notificationKey = `${production.id}-${Math.floor(now.getTime() / (30 * 60 * 1000))}`;
            
            if (lastCheck) {
              const timeDiff = (now.getTime() - lastCheck.getTime()) / 1000 / 60; // dakika
              
              if (timeDiff >= 30 && !qualityCheckNotified.has(notificationKey)) {
                Alert.alert(
                  'Kalite Kontrolü Gerekli',
                  `Makine ${production.machineId} için hatalı ürün kontrolü yapmanız gerekiyor.\n\nLütfen makineyi kontrol edin ve sonucu kaydedin.`,
                  [{ text: 'Tamam' }]
                );
                setQualityCheckNotified(prev => new Set(prev).add(notificationKey));
              }
            } else {
              // İlk kez kontrol zamanı ayarla
              setLastQualityCheckTime(prev => {
                const newMap = new Map(prev);
                newMap.set(production.id, now);
                return newMap;
              });
            }
          }
        });
      }

      // Her 5 saniyede bir (5 çağrıda bir) backend'den veri çek
      backendDataCounter++;
      if (backendDataCounter >= 5) {
        backendDataCounter = 0;
        // Backend'den veri çek (asenkron - state güncellemesini engellemez)
        loadBackendData().catch(err => {
          console.error('Error loading backend data in updateProductions:', err);
        });
      }
      
      // Mevcut state'i kullan (productionStore yerine)
      setActiveProductions(prevProductions => {
        let hasChanges = false;
        const updated = prevProductions.map(production => {
          if (production.status === 'active' && production.cycleTime && production.cycleTime > 0) {
            const now = new Date();
            const startTime = new Date(production.startTime);
            const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
            let calculatedPartCount = Math.floor(elapsedSeconds / production.cycleTime);
            
            // Hedef sayı varsa ve hedef sayıya ulaşıldıysa
            if (production.targetCount && calculatedPartCount >= production.targetCount) {
              calculatedPartCount = production.targetCount;
              
              // Üretimi tamamlanmış olarak işaretle (status zaten 'active' olduğu için her zaman değişecek)
              hasChanges = true;
              return {
                ...production,
                status: 'completed' as const,
                partCount: production.targetCount,
                endTime: now,
              };
            } else {
              // Sadece değiştiyse güncelle
              if (calculatedPartCount !== production.partCount) {
                hasChanges = true;
                return {
                  ...production,
                  partCount: calculatedPartCount
                };
              }
            }
          }
          return production;
        });
        
        // Sadece değişiklik varsa state'i güncelle (aynı referans döndürme - gereksiz render'ı önle)
        if (hasChanges) {
          // Store'u da güncelle (senkronizasyon için)
          productionStore.initialize(updated);
          return updated;
        }
        
        // Değişiklik yoksa aynı referansı döndür (React'in gereksiz render yapmasını önle)
        return prevProductions;
      });
    };

    updateProductions();
    // Veri çekme sıklığını azalt - her 5 saniyede bir güncelle (veri çakışmasını önlemek için)
    const interval = setInterval(updateProductions, 5000);
    return () => clearInterval(interval);
  }, [targetReachedNotified]); // targetReachedNotified dependency olarak ekle

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
    setSelectedStopReason(null);
    setIssueDescription('');
    setShowIssueModal(true);
  };

  const handleResumeProduction = async (productionId: string) => {
    const production = activeProductions.find(p => p.id === productionId);
    if (!production) return;

    try {
      // Production ID'den work order ID'sini çıkar
      const woIdMatch = production.id.match(/WO-(\d+)/);
      if (!woIdMatch) {
        throw new Error('Work order ID bulunamadı');
      }
      const workOrderId = parseInt(woIdMatch[1], 10);

      // Work order'ın stage'lerini al
      const stages = await workOrdersAPI.getWorkOrderStages(workOrderId);
      const pausedStage = Array.isArray(stages) 
        ? stages.find((s: any) => s.status === 'paused') 
        : null;

      if (!pausedStage) {
        // Eğer paused stage yoksa, ilk planned stage'i başlat
        const plannedStage = Array.isArray(stages) 
          ? stages.find((s: any) => s.status === 'planned') 
          : null;
        
        if (plannedStage) {
          await stagesAPI.startStage(plannedStage.id);
        } else {
          throw new Error('Devam ettirilecek stage bulunamadı');
        }
      } else {
        // Paused stage'i resume et (backend'de devam ettir)
        await stagesAPI.resumeStage(pausedStage.id);
      }

      // State'i hemen güncelle (UI'ın hızlı tepki vermesi için)
      const updatedProductions = activeProductions.map(p => 
        p.id === productionId 
          ? {
              ...p,
              status: 'active' as const,
              issue: undefined,
              pausedAt: undefined,
            }
          : p
      );
      
      setActiveProductions(updatedProductions);
      // Ref'i de hemen güncelle
      activeProductionsRef.current = updatedProductions;

      // Backend verilerini yeniden yükle (backend'in güncellenmesi için bekle)
      // Kısa bir gecikme ekle (backend'in güncellenmesi için) ve await ile bekle
      await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
      await loadBackendData();
      
      // Başarı mesajı kaldırıldı - kullanıcı deneyimi için
    } catch (error: any) {
      console.error('Error resuming production:', error);
      Alert.alert('Hata', error.message || 'Makine devam ettirilemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleSubmitStopReason = async () => {
    if (!selectedStopReason) {
      Alert.alert('Hata', 'Lütfen durdurma sebebini seçin!');
      return;
    }

    if (selectedProductionId) {
      const production = activeProductions.find(p => p.id === selectedProductionId);
      if (!production) return;

      try {
        // Production ID'den work order ID'sini çıkar (format: WO-{woId}-PRODUCT-{productId}-MOLD-{moldId})
        const woIdMatch = production.id.match(/WO-(\d+)/);
        if (!woIdMatch) {
          throw new Error('Work order ID bulunamadı');
        }
        const workOrderId = parseInt(woIdMatch[1], 10);

        // Work order'ın stage'lerini al
        const stages = await workOrdersAPI.getWorkOrderStages(workOrderId);
        if (!Array.isArray(stages) || stages.length === 0) {
          throw new Error('Work order için stage bulunamadı');
        }

        // Önce in_progress stage'i ara
        let targetStage = stages.find((s: any) => s.status === 'in_progress');
        
        // Eğer in_progress yoksa, paused stage'i ara
        if (!targetStage) {
          targetStage = stages.find((s: any) => s.status === 'paused');
        }
        
        // Eğer paused da yoksa, ilk planned stage'i başlat
        if (!targetStage) {
          const plannedStage = stages.find((s: any) => s.status === 'planned');
          if (plannedStage) {
            // Planned stage'i başlat
            await stagesAPI.startStage(plannedStage.id);
            // Başlatılan stage'i target olarak kullan
            const updatedStages = await workOrdersAPI.getWorkOrderStages(workOrderId);
            targetStage = Array.isArray(updatedStages) 
              ? updatedStages.find((s: any) => s.id === plannedStage.id) 
              : null;
          }
        }

        if (!targetStage) {
          throw new Error('Durdurulacak stage bulunamadı');
        }

        const now = new Date();
        
        // Durdurulduğunda o anki partCount'u hesapla ve kaydet
        let finalPartCount: number;
        if (production.cycleTime && production.cycleTime > 0) {
          // Durdurulma zamanına kadar geçen süre
          const elapsedSeconds = (now.getTime() - production.startTime.getTime()) / 1000;
          finalPartCount = Math.floor(elapsedSeconds / production.cycleTime);
          // Hedef sayı varsa ve hedef sayıya ulaşıldıysa, hedef sayıyı kullan
          if (production.targetCount && finalPartCount >= production.targetCount) {
            finalPartCount = production.targetCount;
          }
        } else {
          // Cycle time yoksa mevcut değeri kullan
          finalPartCount = production.partCount;
        }

        // Seçilen sebebe göre işlem yap
        if (selectedStopReason === 'production_completed') {
          // Üretim Tamamlandı - Stage'i done yap
          if (targetStage.status !== 'done') {
            await stagesAPI.doneStage(targetStage.id);
          }
          
          // Production'ı completed olarak işaretle ve aktif üretimlerden çıkar
          const updatedProductions = activeProductions
            .filter(p => p.id !== selectedProductionId)
            .map(p => {
              if (p.id === selectedProductionId) {
                return {
                  ...p,
                  status: 'completed' as const,
                  partCount: finalPartCount,
                  endTime: now,
                };
              }
              return p;
            });
          
          setActiveProductions(updatedProductions);
          activeProductionsRef.current = updatedProductions;
          
          // Local store'dan da kaldır
          const productionInStore = productionStore.getAll().find(p => p.id === selectedProductionId);
          if (productionInStore) {
            productionStore.remove(selectedProductionId);
          }
        } else {
          // Diğer sebepler (Arıza, Hatalı Ürün, Diğer) - Pause yap ve issue kaydet
          let issueText = '';
          if (selectedStopReason === 'machine_breakdown') {
            issueText = 'Arıza';
          } else if (selectedStopReason === 'defective_product') {
            issueText = 'Hatalı Ürün Tespit Edildi';
          } else if (selectedStopReason === 'other') {
            // Diğer seçeneği için açıklama zorunlu
            if (!issueDescription.trim()) {
              Alert.alert('Hata', 'Lütfen sorunu açıklayın!');
              return;
            }
            issueText = issueDescription.trim();
          } else {
            issueText = issueDescription.trim() || selectedStopReason;
          }

          // Eğer stage zaten paused değilse, issue gönder ve pause et
          if (targetStage.status !== 'paused') {
            // Backend'e issue gönder
            await stagesAPI.issueStage(targetStage.id, {
              type: selectedStopReason === 'machine_breakdown' ? 'machine_breakdown' : 'quality_issue',
              description: issueText,
            });

            // Stage'i pause et (backend'de durdur)
            await stagesAPI.pauseStage(targetStage.id);
          } else {
            // Stage zaten paused ise, sadece issue gönder (yeni issue ekle)
            await stagesAPI.issueStage(targetStage.id, {
              type: selectedStopReason === 'machine_breakdown' ? 'machine_breakdown' : 'quality_issue',
              description: issueText,
            });
          }

          // Local store'u güncelle (eğer kullanılıyorsa)
          const productionInStore = productionStore.getAll().find(p => p.id === selectedProductionId);
          if (productionInStore) {
            productionStore.update(selectedProductionId, {
              status: 'paused',
              issue: issueText,
              pausedAt: now,
              partCount: finalPartCount,
            });
          }

          // State'i hemen güncelle (UI'ın hızlı tepki vermesi için)
          const updatedProductions = activeProductions.map(p => 
            p.id === selectedProductionId 
              ? {
                  ...p,
                  status: 'paused' as const,
                  issue: issueText,
                  pausedAt: now,
                  partCount: finalPartCount,
                }
              : p
          );
          
          setActiveProductions(updatedProductions);
          // Ref'i de hemen güncelle
          activeProductionsRef.current = updatedProductions;
        }

        // Backend verilerini yeniden yükle (backend'in güncellenmesi için bekle)
        // Kısa bir gecikme ekle (backend'in güncellenmesi için) ve await ile bekle
        await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
        await loadBackendData();
        
        // Başarı mesajı kaldırıldı - kullanıcı deneyimi için
        setShowIssueModal(false);
        setIssueDescription('');
        setSelectedStopReason(null);
        setSelectedProductionId(null);
      } catch (error: any) {
        console.error('Error reporting issue:', error);
        Alert.alert('Hata', error.message || 'Sorun bildirilemedi. Lütfen tekrar deneyin.');
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header - Tüm roller için profil bilgili */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.profileSection}
          onPress={onNavigateToProfile}
          activeOpacity={0.7}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileRole}>{getRoleDisplayName(user.role)}</Text>
          </View>
        </TouchableOpacity>
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
        {/* Özet Kartları */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {activeProductions.filter(p => {
                if (p.status === 'active') return true;
                if (p.status === 'paused') {
                  // Paused üretimler sadece hedef ürün sayısına ulaşmadıysa sayılır
                  return p.targetCount === undefined || p.partCount < p.targetCount;
                }
                return false; // completed status'leri sayma
              }).length}
            </Text>
            <Text style={styles.summaryLabel}>Aktif Üretim</Text>
          </View>
        </View>

        {/* Aktif Üretimler - Makine Kartları - Aktif ve hedefe ulaşmamış duraklatılmış üretimler */}
        <View style={styles.sectionCard}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setShowActiveProductions(!showActiveProductions)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>Aktif Üretimler</Text>
            <Text style={styles.expandIcon}>
              {showActiveProductions ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          
          {showActiveProductions && (
            <>
              {(() => {
            // Aktif üretimleri ve hedef ürün sayısına ulaşmamış duraklatılmış üretimleri filtrele
            const activeAndPausedProductions = activeProductions.filter(p => {
              if (p.status === 'active') return true;
              if (p.status === 'paused') {
                // Paused üretimler sadece hedef ürün sayısına ulaşmadıysa gösterilir
                return p.targetCount === undefined || p.partCount < p.targetCount;
              }
              return false; // completed status'leri gösterme
            });
          
            return loading && activeProductions.length === 0 ? (
              <ActivityIndicator size="small" color="#3498db" style={{ marginVertical: 20 }} />
            ) : activeAndPausedProductions.length === 0 ? (
              <Text style={styles.emptyText}>
                Aktif üretim bulunmamaktadır.
              </Text>
            ) : (
              activeAndPausedProductions.map((production: ProductionRecord) => {
            const machine = backendMachines.find(m => m.id.toString() === production.machineId);
            // Database'den gelen mevcut üretilen ürün sayısını kullan (production.partCount)
            const calculatedPartCount = production.partCount || 0;
            
            // Mold ve Product verilerini kullan (database'den)
            const moldData = production.moldData;
            const productData = production.productData;
            
            // Mold verilerinden bilgileri al (sadece temel bilgiler)
            const moldName = moldData?.name || 'N/A'; // KP-01 -> molds.name
            const productName = production.productName; // priz -> products.name (zaten production.productName'de)
            // Excel kolonları artık productData'da
            const cycleTime = productData?.cycle_time_sec || production.cycleTime; // products.cycle_time_sec
            const hourlyOutput = productData?.hourly_production; // products.hourly_production
            const injectionTemp = productData?.injection_temp_c; // products.injection_temp_c
            const moldTemp = productData?.mold_temp_c; // products.mold_temp_c
            const material = productData?.material; // products.material
            const partWeight = productData?.part_weight_g; // products.part_weight_g
            
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
            const statusText = isRunning ? 'Çalışıyor' : 'Durduruldu';
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
                
                {/* Metrikler - 4 ayrı kutucuk */}
                <View style={styles.machineMetricsRow}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricIcon}>⏱</Text>
                    <Text style={styles.metricLabel}>Cycle Time</Text>
                    <Text style={styles.metricValue}>{cycleTime} sec</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricIcon}>📊</Text>
                    <Text style={styles.metricLabel}>Mevcut Ürün</Text>
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

                {/* Hatalı Ürün Kontrol Paneli - Sadece worker ve aktif üretimler için */}
                {user.role === 'worker' && isRunning && (
                  <View style={styles.qualityCheckPanel}>
                    <Text style={styles.qualityCheckTitle}>🔍 Hatalı Ürün Kontrolü</Text>
                    <Text style={styles.qualityCheckSubtitle}>
                      Son kontrol: {lastQualityCheckTime.get(production.id) 
                        ? new Date(lastQualityCheckTime.get(production.id)!).toLocaleString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Henüz yapılmadı'}
                    </Text>
                    <TouchableOpacity
                      style={styles.qualityCheckButton}
                      onPress={() => {
                        const now = new Date();
                        setLastQualityCheckTime(prev => {
                          const newMap = new Map(prev);
                          newMap.set(production.id, now);
                          return newMap;
                        });
                        // Bildirimi sıfırla
                        setQualityCheckNotified(prev => {
                          const newSet = new Set(prev);
                          const keys = Array.from(newSet).filter(key => !key.startsWith(production.id));
                          return new Set(keys);
                        });
                      }}
                    >
                      <Text style={styles.qualityCheckButtonText}>✓ Kontrol Yapıldı</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Durdur/Devam Et Butonları - Sadece worker için */}
                {user.role === 'worker' && (
                  <View style={styles.actionButtonsContainer}>
                    {isRunning ? (
                      <TouchableOpacity
                        style={styles.stopButton}
                        onPress={() => handleStopProduction(production.id)}
                      >
                        <Text style={styles.stopButtonText}>Durdur</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.resumeButton}
                        onPress={() => handleResumeProduction(production.id)}
                      >
                        <Text style={styles.resumeButtonText}>Devam Et</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Sorun Bildirimi - Eğer varsa göster (tüm roller için) */}
                {production.issue && (
                  <View style={styles.issueContainer}>
                    <Text style={styles.issueLabel}>
                      ⚠️ Makine Durduruldu - Sorun:
                    </Text>
                    <Text style={styles.issueText}>{production.issue}</Text>
                    {production.pausedAt && (
                      <Text style={styles.issueTime}>
                        Durdurulma Zamanı: {formatDateTime(production.pausedAt)}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
            })
          );
              })()}
            </>
          )}
        </View>

        {/* Makine Durumu */}
        <View style={styles.sectionCard}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setShowMachineStatus(!showMachineStatus)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>Makine Durumu</Text>
            <Text style={styles.expandIcon}>
              {showMachineStatus ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          
          {showMachineStatus && (
            <>
              {(() => {
            // Tüm makineleri göster
            if (backendMachines.length === 0) {
              return <Text style={styles.emptyText}>Makine bulunmamaktadır.</Text>;
            }
            
            // Aktif ve duraklatılmış üretimlerdeki makineleri bul
            const activeAndPausedProductions = activeProductions.filter(p => {
              if (p.status === 'active') return true;
              if (p.status === 'paused') {
                // Paused üretimler sadece hedef ürün sayısına ulaşmadıysa gösterilir
                return p.targetCount === undefined || p.partCount < p.targetCount;
              }
              return false; // completed status'leri gösterme
            });
            const machineIdToProduction = new Map<string, ProductionRecord>();
            activeAndPausedProductions.forEach(p => {
              machineIdToProduction.set(p.machineId, p);
            });
            
            // Tüm makineleri göster
            return backendMachines.map((machine) => {
              const production = machineIdToProduction.get(machine.id.toString());
              const isRunning = production?.status === 'active';
              const isPaused = production?.status === 'paused';
              
              // Makinenin kendi durumuna göre durum belirle
              let statusText = '';
              let statusColor = '#95a5a6'; // Varsayılan gri
              
              if (machine.status === 'maintenance') {
                // Makine arızalı
                statusText = 'Arızalı';
                statusColor = '#e74c3c'; // Kırmızı
              } else if (machine.status === 'inactive') {
                // Makine pasif
                statusText = 'Pasif';
                statusColor = '#95a5a6'; // Gri
              } else if (machine.status === 'active') {
                // Makine aktif - üretim durumuna göre
                if (isRunning) {
                  statusText = 'Çalışıyor';
                  statusColor = '#27ae60'; // Yeşil
                } else if (isPaused) {
                  statusText = 'Durduruldu';
                  statusColor = '#f39c12'; // Turuncu
                } else {
                  statusText = 'Boşta';
                  statusColor = '#3498db'; // Mavi
                }
              } else {
                statusText = 'Bilinmeyen';
                statusColor = '#95a5a6';
              }
              
              return (
                <View key={machine.id} style={styles.machineItem}>
                  <View style={styles.machineHeader}>
                    <View>
                      <Text style={styles.machineName}>{machine.name}</Text>
                      {machine.location && (
                        <Text style={styles.machineLocation}>{machine.location}</Text>
                      )}
                    </View>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: statusColor }
                    ]}>
                      <Text style={styles.statusBadgeText}>
                        {statusText}
                      </Text>
                    </View>
                  </View>
                  {production && (
                    <Text style={styles.machineProductionInfo}>
                      Ürün: {production.productName}
                    </Text>
                  )}
                </View>
              );
            });
              })()}
            </>
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

      {/* Sorun Bildirme Modal */}
      <Modal
        visible={showIssueModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowIssueModal(false);
          setIssueDescription('');
          setSelectedStopReason(null);
          setSelectedProductionId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sorun Bildir</Text>
            <Text style={styles.modalSubtitle}>
              Makineyi neden durdurdunuz? Lütfen sebebi seçin.
            </Text>
            
            {/* Durdurma Sebepleri */}
            <View style={styles.stopReasonContainer}>
              <TouchableOpacity
                style={[
                  styles.stopReasonButton,
                  selectedStopReason === 'machine_breakdown' && styles.stopReasonButtonSelected
                ]}
                onPress={() => setSelectedStopReason('machine_breakdown')}
              >
                <Text style={[
                  styles.stopReasonText,
                  selectedStopReason === 'machine_breakdown' && styles.stopReasonTextSelected
                ]}>
                  🔧 Arıza
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.stopReasonButton,
                  selectedStopReason === 'production_completed' && styles.stopReasonButtonSelected
                ]}
                onPress={() => setSelectedStopReason('production_completed')}
              >
                <Text style={[
                  styles.stopReasonText,
                  selectedStopReason === 'production_completed' && styles.stopReasonTextSelected
                ]}>
                  ✅ Üretim Tamamlandı
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.stopReasonButton,
                  selectedStopReason === 'defective_product' && styles.stopReasonButtonSelected
                ]}
                onPress={() => setSelectedStopReason('defective_product')}
              >
                <Text style={[
                  styles.stopReasonText,
                  selectedStopReason === 'defective_product' && styles.stopReasonTextSelected
                ]}>
                  ⚠️ Hatalı Ürün Tespit Edildi
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.stopReasonButton,
                  selectedStopReason === 'other' && styles.stopReasonButtonSelected
                ]}
                onPress={() => setSelectedStopReason('other')}
              >
                <Text style={[
                  styles.stopReasonText,
                  selectedStopReason === 'other' && styles.stopReasonTextSelected
                ]}>
                  📝 Diğer
                </Text>
              </TouchableOpacity>
            </View>

            {/* Açıklama alanı - Arıza, Hatalı Ürün veya Diğer için */}
            {(selectedStopReason === 'machine_breakdown' || selectedStopReason === 'defective_product' || selectedStopReason === 'other') && (
              <TextInput
                style={styles.issueInput}
                placeholder={selectedStopReason === 'other' ? 'Lütfen sorunu açıklayın...' : 'Ek açıklama (opsiyonel)...'}
                value={issueDescription}
                onChangeText={setIssueDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowIssueModal(false);
                  setIssueDescription('');
                  setSelectedStopReason(null);
                  setSelectedProductionId(null);
                }}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.sendButton, !selectedStopReason && styles.sendButtonDisabled]}
                onPress={handleSubmitStopReason}
                disabled={!selectedStopReason}
              >
                <Text style={styles.sendButtonText}>ONAYLA</Text>
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
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileAvatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  profileRole: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '500',
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
  machineLocation: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  machineProductionInfo: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 5,
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
  qualityCheckPanel: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 15,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  qualityCheckTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 5,
  },
  qualityCheckSubtitle: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 10,
  },
  qualityCheckButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  qualityCheckButtonText: {
    color: 'white',
    fontSize: 14,
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
  stopReasonContainer: {
    marginVertical: 20,
    gap: 12,
  },
  stopReasonButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  stopReasonButtonSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#3498db',
  },
  stopReasonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  stopReasonTextSelected: {
    color: '#3498db',
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
});

export default DashboardScreen;
