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
import { workOrdersAPI, machinesAPI, stagesAPI, metricsAPI, productsAPI, moldsAPI, receteAPI } from '../utils/api';

interface OperatorScreenProps {
  user: User;
  onBack: () => void;
  onProductionStarted?: () => void; // Üretim başlatıldığında çağrılacak callback
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

const OperatorScreen: React.FC<OperatorScreenProps> = ({ user, onBack, onProductionStarted }) => {
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
  const [productId, setProductId] = useState<number | null>(null);
  const [lotNo, setLotNo] = useState('');
  const [targetCount, setTargetCount] = useState('');
  const [cycleTime, setCycleTime] = useState('');
  const [machineId, setMachineId] = useState('');
  const [stageCount, setStageCount] = useState('');
  const [stageNames, setStageNames] = useState<string[]>([]);
  const [showStages, setShowStages] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  
  // Dashboard accordion states
  const [showActiveWorkOrders, setShowActiveWorkOrders] = useState<boolean>(false);
  const [workOrderSearchQuery, setWorkOrderSearchQuery] = useState<string>(''); // İş emri arama sorgusu
  const [showWorkOrderStages, setShowWorkOrderStages] = useState<boolean>(false);
  const [showMachines, setShowMachines] = useState<boolean>(false);
  const [showMachineReadings, setShowMachineReadings] = useState<boolean>(false);
  const [showProductsList, setShowProductsList] = useState<boolean>(false);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  
  // Mold state
  const [molds, setMolds] = useState<any[]>([]);
  const [selectedMoldId, setSelectedMoldId] = useState<number | null>(null);
  const [selectedMold, setSelectedMold] = useState<any | null>(null);
  
  // Mold bilgileri (database'den otomatik doldurulacak, kullanıcı değiştirebilir)
  const [injectionTemp, setInjectionTemp] = useState('');
  const [moldTemp, setMoldTemp] = useState('');
  const [material, setMaterial] = useState('');
  const [partWeight, setPartWeight] = useState('');
  const [hourlyProduction, setHourlyProduction] = useState('');
  const [cavityCount, setCavityCount] = useState('');
  
  // Reçete state'leri
  const [recete, setRecete] = useState<any>(null);
  const [receteLoading, setReceteLoading] = useState(false);
  const [urunKayitli, setUrunKayitli] = useState<boolean | null>(null);
  const [malzemeler, setMalzemeler] = useState<string[]>([]);
  const [selectedMalzeme, setSelectedMalzeme] = useState('');
  const [tahminAgirlik, setTahminAgirlik] = useState('');
  const [tahminGozAdedi, setTahminGozAdedi] = useState('');

  // Load products and machines when new production tab is active
  useEffect(() => {
    if (activeTab === 'new') {
      loadProducts();
      loadMachines(); // Makineleri de yükle
    }
  }, [activeTab]);

  // Ürün kodu değiştiğinde, eğer products listesinde varsa mold'ları yükle
  useEffect(() => {
    const loadMoldsIfProductFound = async () => {
      if (productCode && products.length > 0) {
        const product = products.find((p: any) => p.code === productCode);
        if (product && product.id) {
          setProductId(product.id);
          setProductName(product.name);
          await loadMoldsForProduct(product.id);
        } else {
          // Ürün bulunamadıysa temizle
          setProductId(null);
          setMolds([]);
          setSelectedMoldId(null);
          setSelectedMold(null);
        }
      }
    };
    loadMoldsIfProductFound();
  }, [productCode, products]);

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

  // Makineleri yükle (üretim formu için)
  const loadMachines = async () => {
    try {
      const machinesResponse = await machinesAPI.getMachines();
      const machinesData = machinesResponse.data || machinesResponse;
      const machinesList = Array.isArray(machinesData) ? machinesData : [];
      setMachines(machinesList);
      
      // İlk aktif makineyi seç
      const activeMachine = machinesList.find((m: Machine) => m.status === 'active') || machinesList[0];
      if (activeMachine && !machineId) {
        setMachineId(activeMachine.id.toString());
      }
    } catch (error: any) {
      console.error('Error loading machines:', error);
    }
  };

  // Ürün seçildiğinde o ürüne ait mold'ları yükle
  const loadMoldsForProduct = async (productId: number) => {
    try {
      const allMolds = await moldsAPI.getMolds();
      const productMolds = Array.isArray(allMolds) 
        ? allMolds.filter((mold: any) => mold.product_id === productId)
        : [];
      setMolds(productMolds);
      
      // Eğer sadece bir mold varsa otomatik seç
      if (productMolds.length === 1) {
        handleMoldSelect(productMolds[0]);
      }
    } catch (error: any) {
      console.error('Error loading molds:', error);
      setMolds([]);
    }
  };

  // Ürün adına göre reçete bilgilerini yükle
  const loadRecete = async (urunAdi: string) => {
    if (!urunAdi.trim()) {
      setRecete(null);
      setUrunKayitli(null);
      return;
    }

    try {
      setReceteLoading(true);
      const response = await receteAPI.getRecete(urunAdi);
      
      if (response.success && response.kaynak === 'veritabani') {
        // Kayıtlı ürün - gerçek değerleri göster
        setRecete(response);
        setUrunKayitli(true);
        
        // Form alanlarını otomatik doldur
        if (response.degerler) {
          setCycleTime(response.degerler.cevrim_suresi?.toString() || '');
          setInjectionTemp(response.degerler.enjeksiyon_sicakligi?.toString() || '');
          setMoldTemp(response.degerler.kalip_sicakligi?.toString() || '');
        }
        if (response.malzeme) {
          setMaterial(response.malzeme);
        }
      } else {
        // Kayıtlı değil - malzeme formu göster
        setRecete(response);
        setUrunKayitli(false);
        // Malzemeleri yükle
        loadMalzemeler();
      }
    } catch (error: any) {
      console.error('Error loading recete:', error);
      setRecete(null);
      setUrunKayitli(false);
      loadMalzemeler();
    } finally {
      setReceteLoading(false);
    }
  };

  // Malzemeleri yükle
  const loadMalzemeler = async () => {
    try {
      const response = await receteAPI.getMalzemeler();
      if (response.success && response.malzemeler) {
        setMalzemeler(response.malzemeler);
      }
    } catch (error: any) {
      console.error('Error loading malzemeler:', error);
    }
  };

  // Malzeme bazlı AI tahmini yap
  const handleAITahmin = async () => {
    if (!selectedMalzeme || !tahminAgirlik || !tahminGozAdedi) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun!');
      return;
    }

    try {
      setReceteLoading(true);
      const response = await receteAPI.getMalzemeTahmin(
        selectedMalzeme,
        parseFloat(tahminAgirlik),
        parseInt(tahminGozAdedi)
      );

      if (response.success) {
        setRecete({
          ...response,
          kaynak: 'ai_tahmin',
        });
        
        // Form alanlarını doldur
        if (response.degerler) {
          setCycleTime(response.degerler.cevrim_suresi?.toString() || '');
          setInjectionTemp(response.degerler.enjeksiyon_sicakligi?.toString() || '');
          setMoldTemp(response.degerler.kalip_sicakligi?.toString() || '');
        }
        setMaterial(selectedMalzeme);
        setPartWeight(tahminAgirlik);
        setCavityCount(tahminGozAdedi);
      } else {
        Alert.alert('Hata', response.message || 'Tahmin yapılamadı');
      }
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Tahmin yapılamadı');
    } finally {
      setReceteLoading(false);
    }
  };

  // Mold seçildiğinde bilgileri doldur
  const handleMoldSelect = (mold: any) => {
    setSelectedMoldId(mold.id);
    setSelectedMold(mold);
    
    // Excel kolonları artık products tablosunda - mold'un product_id'sine göre product'ı bul
    if (mold.product_id) {
      const product = products.find((p: any) => p.id === mold.product_id);
      if (product) {
        // Product bilgilerini form alanlarına doldur
        if (product.cycle_time_sec) setCycleTime(product.cycle_time_sec.toString());
        if (product.injection_temp_c) setInjectionTemp(product.injection_temp_c.toString());
        if (product.mold_temp_c) setMoldTemp(product.mold_temp_c.toString());
        if (product.material) setMaterial(product.material);
        if (product.part_weight_g) setPartWeight(product.part_weight_g.toString());
        if (product.hourly_production) setHourlyProduction(product.hourly_production.toString());
        if (product.cavity_count) setCavityCount(product.cavity_count.toString());
      }
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load work orders
      const woResponse = await workOrdersAPI.getWorkOrders();
      // Backend returns { total, data, requested_by } or just array
      const woData = woResponse.data || woResponse;
      const allWorkOrders = Array.isArray(woData) ? woData : [];
      
      // Tüm work orders'ları set et (filtreleme renderDashboard'da yapılacak)
      setWorkOrders(allWorkOrders);

      // Load machines
      const machinesResponse = await machinesAPI.getMachines();
      // Backend returns { total, data } or just array
      const machinesData = machinesResponse.data || machinesResponse;
      const machinesList = Array.isArray(machinesData) ? machinesData : [];
      setMachines(machinesList);

      // Select first active machine if available (for dashboard)
      const activeMachine = machinesList.find((m: Machine) => m.status === 'active') || machinesList[0];
      if (activeMachine && !selectedMachine) {
        setSelectedMachine(activeMachine.id);
        loadMachineReadings(activeMachine.id);
      }
      
      // Üretim formu için ilk aktif makineyi seç
      if (activeMachine && !machineId) {
        setMachineId(activeMachine.id.toString());
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
      // DashboardScreen'i de yenile (aktif üretimler bölümü için)
      if (onProductionStarted) {
        onProductionStarted();
      }
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
      // DashboardScreen'i de yenile (aktif üretimler bölümü için)
      if (onProductionStarted) {
        onProductionStarted();
      }
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
    if (!targetCount.trim() || isNaN(parseInt(targetCount)) || parseInt(targetCount) <= 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir hedef miktar girin!');
      return;
    }

    // Makine seçimi kontrolü
    if (!machineId.trim()) {
      Alert.alert('Hata', 'Lütfen bir makine seçin!');
      return;
    }

    try {
      setLoading(true);

      const now = new Date();
      let finalProductCode = productCode.trim();
      const autoLotNo = `LOT-${now.toISOString().slice(0,10)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      // Eğer kullanıcı ürün seçmediyse, uyarı ver
      if (!finalProductCode) {
        Alert.alert(
          'Ürün Seçilmedi',
          'Üretim başlatmak için bir ürün seçmelisiniz. Lütfen arama kutusundan bir ürün seçin veya adını yazıp sorgulayın.',
          [{ text: 'Tamam' }]
        );
        setLoading(false);
        return;
      }

      // Tarih hesaplamaları - şimdi başla, 4 saat sonra bitir (varsayılan)
      const endTime = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 saat sonra

      // Backend'e work order oluştur
      const parsedMachineId = parseInt(machineId, 10);
      if (isNaN(parsedMachineId) || parsedMachineId <= 0) {
        Alert.alert('Hata', 'Geçersiz makine seçimi! Lütfen bir makine seçin.');
        return;
      }

      const workOrderData = {
        product_code: finalProductCode,
        lot_no: autoLotNo,
        qty: parseInt(targetCount),
        planned_start: now.toISOString(),
        planned_end: endTime.toISOString(),
        machine_id: parsedMachineId,  // Seçilen makine ID'si
      };

      console.log('📤 OperatorScreen - Work order oluşturuluyor:', workOrderData);
      console.log('📤 Selected machineId:', machineId, 'Parsed:', parsedMachineId);
      const result = await workOrdersAPI.createWorkOrder(workOrderData);
      
      // Work order oluşturulduktan sonra ilk stage'i başlat
      let stageStarted = false;
      if (result.work_order_id && result.stages && result.stages.length > 0) {
        const firstStageId = result.stages[0].id;
        if (firstStageId && typeof firstStageId === 'number') {
          try {
            await stagesAPI.startStage(firstStageId);
            console.log('✅ İlk stage başlatıldı:', firstStageId);
            stageStarted = true;
            // Stage başlatıldıktan sonra veritabanı güncellemesi için bekleme ekle
            await new Promise(resolve => setTimeout(resolve, 1500));
          } catch (stageError: any) {
            const errorMessage = stageError.response?.data?.detail || stageError.message || 'Bilinmeyen hata';
            console.error('⚠️ Stage başlatılamadı (work order oluşturuldu):', errorMessage);
            // Stage başlatılamasa bile devam et - work order zaten oluşturuldu
            // Ama kullanıcıya bilgi ver
            Alert.alert(
              'Uyarı',
              `İş emri oluşturuldu (ID: ${result.work_order_id}) ancak aşama başlatılamadı.\n\nHata: ${errorMessage}\n\nLütfen Dashboard'dan manuel olarak aşamayı başlatın.`
            );
          }
        } else {
          console.warn('⚠️ Stage ID geçersiz:', firstStageId);
        }
      }

      // Formu temizle
      setProductCode('');
      setProductName('');
      setProductId(null);
      setTargetCount('');
      setCycleTime('');
      setMachineId('');
      setStageCount('');
      setStageNames([]);
      setShowStages(false);
      
      // Mold bilgilerini temizle
      setMolds([]);
      setSelectedMoldId(null);
      setSelectedMold(null);
      setInjectionTemp('');
      setMoldTemp('');
      setMaterial('');
      setPartWeight('');
      setHourlyProduction('');
      setCavityCount('');

      const successMessage = stageStarted 
        ? `Üretim başlatıldı!\nWork Order ID: ${result.work_order_id}\nDashboard'daki "Aktif Üretimler" bölümünden takip edebilirsiniz.`
        : `İş emri oluşturuldu!\nWork Order ID: ${result.work_order_id}\nNot: Aşama başlatılamadı, lütfen Dashboard'dan manuel olarak başlatın.`;
      
      Alert.alert(
        'Başarılı', 
        successMessage,
        [{ text: 'Tamam', onPress: async () => {
          // Veritabanı güncellemesinin tamamlanması için bekleme
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Ana Dashboard'ı yenile (eğer callback varsa)
          if (onProductionStarted) {
            onProductionStarted();
          }
          
          // OperatorScreen'in kendi dashboard'ına geç ve yenile
          setActiveTab('dashboard');
          await loadDashboardData();
          
          // Ek refresh'ler (stage'lerin güncellenmesi için)
          setTimeout(() => {
            loadDashboardData();
          }, 1500);
          setTimeout(() => {
            loadDashboardData();
          }, 3000);
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

  // Makine status'leri için ayrı fonksiyonlar
  const getMachineStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#27ae60'; // Yeşil - çalışıyor
      case 'maintenance':
        return '#f39c12'; // Turuncu - bakımda
      case 'inactive':
        return '#e74c3c'; // Kırmızı - çalışmıyor
      default:
        return '#95a5a6'; // Gri - bilinmeyen
    }
  };

  const getMachineStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Aktif';
      case 'maintenance':
        return 'Bakım';
      case 'inactive':
        return 'Çalışmıyor';
      default:
        return 'Çalışmıyor';
    }
  };

  const renderDashboard = () => {
    // Aktif iş emirleri: Sadece bitiş tarihi geçmemiş olanları göster
    // Başlatılmış/bitmemiş/tamamlanmış fark etmez, sadece tarih kontrolü yap
    // Planner'ın oluşturduğu iş emirleri de dahil (henüz başlatılmamış olabilir)
    const now = new Date();
    const activeWorkOrders = workOrders.filter(wo => {
      if (!wo.planned_end) {
        // Bitiş tarihi yoksa göster (henüz planlanmamış olabilir)
        return true;
      }
      
      try {
        const endDate = new Date(wo.planned_end);
        // Bitiş tarihi gelecekte veya bugün ise göster
        // Bitiş tarihi geçmişte ise gösterme
        return endDate >= now;
      } catch (error) {
        console.error('Error parsing planned_end date:', wo.planned_end, error);
        // Tarih parse edilemezse göster (güvenli tarafta kal)
        return true;
      }
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
                  <ActivityIndicator size="small" color="#3498db" style={{ marginVertical: 20 }} />
                ) : filteredWorkOrders.length === 0 ? (
                  <Text style={styles.emptyText}>
                    {workOrderSearchQuery.trim() ? 'Arama sonucu bulunamadı' : 'Aktif iş emri bulunmuyor'}
                  </Text>
                ) : (
                  filteredWorkOrders.slice(0, 5).map((wo) => (
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
                );
              })()}
            </>
          )}
        </View>

        {/* İş Emri Aşamaları */}
        {selectedWorkOrder && stages.length > 0 && (
          <View style={styles.dashboardCard}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => setShowWorkOrderStages(!showWorkOrderStages)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle}>🔄 İş Emri Aşamaları (WO #{selectedWorkOrder})</Text>
              <Text style={styles.expandIcon}>
                {showWorkOrderStages ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
            
            {showWorkOrderStages && (
              <>
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
                      { backgroundColor: getMachineStatusColor(machine.status) }
                    ]}
                  >
                    <Text style={styles.statusText}>{getMachineStatusText(machine.status)}</Text>
                  </View>
                </View>
                <Text style={styles.machineDetail}>Tip: {machine.machine_type}</Text>
                {machine.location && (
                  <Text style={styles.machineDetail}>Konum: {machine.location}</Text>
                )}
              </TouchableOpacity>
            ))
              )}
            </>
          )}
        </View>

        {/* Makine Okumaları */}
        {selectedMachine && machineReadings.length > 0 && (
          <View style={styles.dashboardCard}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => setShowMachineReadings(!showMachineReadings)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle}>
                📊 Makine Okumaları ({machines.find(m => m.id === selectedMachine)?.name || 'Makine'})
              </Text>
              <Text style={styles.expandIcon}>
                {showMachineReadings ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
            
            {showMachineReadings && (
              <>
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
              </>
            )}
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

          {/* Mevcut Ürünler - Açılır Liste */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Ürün Ara / Seç</Text>
            <View style={styles.productsListContainer}>
              {/* Arama Çubuğu - Sorgula Butonu ile */}
              <View style={styles.productSearchContainer}>
                <TextInput
                  style={styles.productSearchInputWithButton}
                  placeholder="Ürün adı girin..."
                  placeholderTextColor="#95a5a6"
                  value={productSearchQuery}
                  onChangeText={(text) => {
                    setProductSearchQuery(text);
                    // Eğer metin değişirse önceki reçete sonuçlarını temizle
                    if (text.trim() === '') {
                      setRecete(null);
                      setUrunKayitli(null);
                    }
                  }}
                  onFocus={() => setShowProductsList(true)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.sorgulaButton}
                  onPress={async () => {
                    const query = productSearchQuery.trim();
                    if (!query) {
                      Alert.alert('Uyarı', 'Lütfen ürün adı girin!');
                      return;
                    }
                    
                    // Önce listede ara
                    const foundProduct = products.find(
                      (p: any) => 
                        p.name.toLowerCase() === query.toLowerCase() ||
                        p.code.toLowerCase() === query.toLowerCase()
                    );
                    
                    if (foundProduct) {
                      // Listede bulundu - seç ve reçete yükle
                      setProductCode(foundProduct.code);
                      setProductName(foundProduct.name);
                      setProductId(foundProduct.id);
                      await loadMoldsForProduct(foundProduct.id);
                      await loadRecete(foundProduct.name);
                      setShowProductsList(false);
                    } else {
                      // Listede yok - API'den reçete sorgula
                      setProductCode('');
                      setProductName(query);
                      setProductId(null);
                      await loadRecete(query);
                      setShowProductsList(false);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sorgulaButtonText}>SORGULA</Text>
                </TouchableOpacity>
              </View>
              
              {/* Liste Aç/Kapat Butonu */}
              <TouchableOpacity
                style={styles.listToggleButton}
                onPress={() => setShowProductsList(!showProductsList)}
                activeOpacity={0.7}
              >
                <Text style={styles.listToggleText}>
                  {showProductsList ? '▲ Listeyi Kapat' : '▼ Kayıtlı Ürünleri Göster'}
                </Text>
              </TouchableOpacity>
            
              {showProductsList && (
                <ScrollView style={styles.productsListScroll} nestedScrollEnabled={true}>
                  {(() => {
                    // Arama sorgusuna göre filtrele
                    const filteredProducts = productSearchQuery.trim() === '' 
                      ? products 
                      : products.filter(product => 
                          product.code.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                          product.name.toLowerCase().includes(productSearchQuery.toLowerCase())
                        );
                    
                    if (filteredProducts.length === 0) {
                      return (
                        <Text style={styles.hintText}>
                          {productSearchQuery.trim() ? 'Arama sonucu bulunamadı' : 'Ürün bulunamadı. Lütfen backend\'den ürün ekleyin.'}
                        </Text>
                      );
                    }
                    
                    return filteredProducts.map((product) => (
                      <TouchableOpacity
                        key={product.id}
                        style={styles.productItem}
                        onPress={async () => {
                          setProductCode(product.code);
                          setProductName(product.name);
                          setProductId(product.id);
                          // Ürüne ait mold'ları yükle
                          await loadMoldsForProduct(product.id);
                          // Reçete bilgilerini yükle
                          await loadRecete(product.name);
                          // Arama sorgusunu temizle ve listeyi kapat
                          setProductSearchQuery('');
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
            <Text style={styles.hintText}>
              Ürün adı yazıp SORGULA butonuna basın. Kayıtlıysa bilgileri, değilse tahmin formu gösterilir.
            </Text>
          </View>

          {/* Reçete Bilgileri - Ürün seçildiğinde göster */}
          {receteLoading && (
            <View style={styles.receteCard}>
              <ActivityIndicator size="small" color="#3498db" />
              <Text style={styles.receteLoadingText}>Reçete yükleniyor...</Text>
            </View>
          )}

          {!receteLoading && recete && urunKayitli && recete.degerler && (
            <View style={styles.receteCard}>
              <Text style={styles.receteTitle}>📋 REÇETE BİLGİLERİ</Text>
              <View style={styles.receteRow}>
                <Text style={styles.receteLabel}>Enjeksiyon Sıcaklığı:</Text>
                <Text style={styles.receteValue}>{recete.degerler.enjeksiyon_sicakligi}°C</Text>
              </View>
              <View style={styles.receteRow}>
                <Text style={styles.receteLabel}>Kalıp Sıcaklığı:</Text>
                <Text style={styles.receteValue}>{recete.degerler.kalip_sicakligi}°C</Text>
              </View>
              <View style={styles.receteRow}>
                <Text style={styles.receteLabel}>Çevrim Süresi:</Text>
                <Text style={styles.receteValue}>{recete.degerler.cevrim_suresi} sn</Text>
              </View>
              {recete.malzeme && recete.malzeme !== 'string' && (
                <View style={styles.receteRow}>
                  <Text style={styles.receteLabel}>Malzeme:</Text>
                  <Text style={styles.receteValue}>{recete.malzeme}</Text>
                </View>
              )}
            </View>
          )}

          {!receteLoading && urunKayitli === false && (
            <View style={styles.tahminCard}>
              <Text style={styles.tahminTitle}>⚠️ Bu ürün kayıtlı değil</Text>
              <Text style={styles.tahminSubtitle}>Tahmin için bilgi girin:</Text>
              
              {/* Malzeme Seçimi */}
              <View style={styles.tahminInputContainer}>
                <Text style={styles.tahminLabel}>Malzeme *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.malzemeScroll}>
                  {malzemeler.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.malzemeChip,
                        selectedMalzeme === m && styles.malzemeChipSelected
                      ]}
                      onPress={() => setSelectedMalzeme(m)}
                    >
                      <Text style={[
                        styles.malzemeChipText,
                        selectedMalzeme === m && styles.malzemeChipTextSelected
                      ]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Ağırlık */}
              <View style={styles.tahminInputContainer}>
                <Text style={styles.tahminLabel}>Parça Ağırlığı (g) *</Text>
                <TextInput
                  style={styles.tahminInput}
                  value={tahminAgirlik}
                  onChangeText={setTahminAgirlik}
                  placeholder="Örn: 10"
                  keyboardType="numeric"
                />
              </View>

              {/* Göz Adedi */}
              <View style={styles.tahminInputContainer}>
                <Text style={styles.tahminLabel}>Göz Adedi *</Text>
                <TextInput
                  style={styles.tahminInput}
                  value={tahminGozAdedi}
                  onChangeText={setTahminGozAdedi}
                  placeholder="Örn: 4"
                  keyboardType="numeric"
                />
              </View>

              <TouchableOpacity
                style={styles.tahminButton}
                onPress={handleAITahmin}
                disabled={receteLoading}
              >
                <Text style={styles.tahminButtonText}>🎯 TAHMİN YAP</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* AI Tahmin Sonucu */}
          {!receteLoading && recete && recete.kaynak === 'ai_tahmin' && recete.degerler && (
            <View style={styles.receteCard}>
              <Text style={styles.receteTitle}>🎯 TAHMİNİ DEĞERLER</Text>
              <View style={styles.receteRow}>
                <Text style={styles.receteLabel}>Enjeksiyon Sıcaklığı:</Text>
                <Text style={styles.receteValue}>~{recete.degerler.enjeksiyon_sicakligi}°C</Text>
              </View>
              <View style={styles.receteRow}>
                <Text style={styles.receteLabel}>Kalıp Sıcaklığı:</Text>
                <Text style={styles.receteValue}>~{recete.degerler.kalip_sicakligi}°C</Text>
              </View>
              <View style={styles.receteRow}>
                <Text style={styles.receteLabel}>Çevrim Süresi:</Text>
                <Text style={styles.receteValue}>~{recete.degerler.cevrim_suresi} sn</Text>
              </View>
            </View>
          )}

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

          {/* Mold Seçimi - Sadece ürün seçildiyse göster */}
          {productId && molds.length > 0 && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Kalıp Seçimi *</Text>
              <ScrollView style={styles.moldsList} nestedScrollEnabled={true}>
                {molds.map((mold) => (
                  <TouchableOpacity
                    key={mold.id}
                    style={[
                      styles.moldItem,
                      selectedMoldId === mold.id && styles.moldItemSelected
                    ]}
                    onPress={() => handleMoldSelect(mold)}
                  >
                    <Text style={styles.moldItemText}>
                      {mold.code} - {mold.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.hintText}>
                Bu ürün için kullanılacak kalıbı seçin (kalıp bilgileri otomatik doldurulacak)
              </Text>
            </View>
          )}

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

          {/* Mold Bilgileri - Her zaman görünür */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Enjeksiyon Sıcaklığı (°C)</Text>
            <TextInput
              style={styles.input}
              value={injectionTemp}
              onChangeText={setInjectionTemp}
              placeholder="Örn: 220"
              keyboardType="numeric"
            />
            <Text style={styles.hintText}>
              Enjeksiyon sıcaklığı (santigrat derece)
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Kalıp Sıcaklığı (°C)</Text>
            <TextInput
              style={styles.input}
              value={moldTemp}
              onChangeText={setMoldTemp}
              placeholder="Örn: 60"
              keyboardType="numeric"
            />
            <Text style={styles.hintText}>
              Kalıp sıcaklığı (santigrat derece)
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Malzeme</Text>
            <TextInput
              style={styles.input}
              value={material}
              onChangeText={setMaterial}
              placeholder="Örn: PP, ABS, PC..."
            />
            <Text style={styles.hintText}>
              Kullanılacak malzeme tipi
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Parça Ağırlığı (g)</Text>
            <TextInput
              style={styles.input}
              value={partWeight}
              onChangeText={setPartWeight}
              placeholder="Örn: 15"
              keyboardType="numeric"
            />
            <Text style={styles.hintText}>
              Üretilecek parçanın ağırlığı (gram)
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Saatlik Üretim (adet)</Text>
            <TextInput
              style={styles.input}
              value={hourlyProduction}
              onChangeText={setHourlyProduction}
              placeholder="Örn: 720"
              keyboardType="numeric"
            />
            <Text style={styles.hintText}>
              Saatte üretilecek parça sayısı
            </Text>
          </View>

          {/* Göz Adedi - Sadece mold seçildiyse göster (opsiyonel) */}
          {selectedMold && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Göz Adedi</Text>
              <TextInput
                style={styles.input}
                value={cavityCount}
                onChangeText={setCavityCount}
                placeholder="Örn: 4"
                keyboardType="numeric"
              />
              <Text style={styles.hintText}>
                Kalıptaki göz (cavity) sayısı
              </Text>
            </View>
          )}

          {/* Makine Seçimi */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Makine Seçimi *</Text>
            {machines.length > 0 ? (
              <ScrollView style={styles.machinesList} nestedScrollEnabled={true}>
                {machines
                  .filter((m: Machine) => m.status === 'active')
                  .map((machine: Machine) => (
                    <TouchableOpacity
                      key={machine.id}
                      style={[
                        styles.machineItem,
                        machineId === machine.id.toString() && styles.machineItemSelected
                      ]}
                      onPress={() => {
                        setMachineId(machine.id.toString());
                      }}
                    >
                      <Text style={styles.machineItemText}>
                        {machine.name} {machine.location ? `- ${machine.location}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            ) : (
              <Text style={styles.hintText}>
                Makine bulunamadı. Lütfen backend'den makine ekleyin.
              </Text>
            )}
            <Text style={styles.hintText}>
              Bu üretim için kullanılacak makineyi seçin
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
                    autoCapitalize="sentences"
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
  productsListContainer: {
    marginTop: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  productSearchContainer: {
    padding: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  productSearchInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    paddingRight: 40,
    fontSize: 14,
    color: '#2c3e50',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  productSearchInputWithButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    padding: 10,
    fontSize: 14,
    color: '#2c3e50',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRightWidth: 0,
  },
  sorgulaButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sorgulaButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  listToggleButton: {
    padding: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  listToggleText: {
    color: '#7f8c8d',
    fontSize: 13,
  },
  productSearchIcon: {
    position: 'absolute',
    right: 20,
    padding: 10,
  },
  productsListScroll: {
    maxHeight: 200,
    paddingHorizontal: 10,
    paddingBottom: 10,
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
  moldsList: {
    maxHeight: 150,
    marginTop: 10,
    marginBottom: 5,
  },
  machinesList: {
    maxHeight: 150,
    marginTop: 10,
    marginBottom: 5,
  },
  machineItemText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  moldItem: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  moldItemSelected: {
    borderColor: '#3498db',
    backgroundColor: '#ebf5fb',
    borderWidth: 2,
  },
  moldItemText: {
    fontSize: 14,
    color: '#2c3e50',
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
  machinesList: {
    maxHeight: 150,
    marginTop: 10,
    marginBottom: 5,
  },
  machineItemText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  // Reçete stilleri
  receteCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#27ae60',
  },
  receteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 12,
  },
  receteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#c8e6c9',
  },
  receteLabel: {
    fontSize: 14,
    color: '#2c3e50',
  },
  receteValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  receteLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  // Tahmin formu stilleri
  tahminCard: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  tahminTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e67e22',
    marginBottom: 4,
  },
  tahminSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 15,
  },
  tahminInputContainer: {
    marginBottom: 12,
  },
  tahminLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 6,
  },
  tahminInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  malzemeScroll: {
    flexDirection: 'row',
    marginTop: 4,
  },
  malzemeChip: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  malzemeChipSelected: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  malzemeChipText: {
    fontSize: 13,
    color: '#2c3e50',
  },
  malzemeChipTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  tahminButton: {
    backgroundColor: '#f39c12',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  tahminButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OperatorScreen;
