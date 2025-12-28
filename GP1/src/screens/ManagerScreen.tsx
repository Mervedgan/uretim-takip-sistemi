/**
 * Yönetici Ekranı
 * Tüm veriler ve genel üretim analizleri
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { User, ProductionRecord, Machine, ProductionAnalysis, OperatorPerformance, MachinePerformance, DailyProduction } from '../types';
import { workOrdersAPI, machinesAPI, issuesAPI } from '../utils/api';

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
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [workOrderStages, setWorkOrderStages] = useState<Map<number, WorkOrderStage[]>>(new Map());

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

        return {
          id: `WO-${wo.id}`,
          machineId: machine.id.toString(),
          operatorId: wo.created_by?.toString() || 'unknown',
          operatorName: wo.created_by_username || 'Bilinmeyen',
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

        return {
          id: `WO-${wo.id}`,
          machineId: machine.id.toString(),
          operatorId: wo.created_by?.toString() || 'unknown',
          operatorName: wo.created_by_username || 'Bilinmeyen',
          productName: wo.product_code || wo.lot_no,
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

  // Component mount olduğunda backend'den veri yükle
  useEffect(() => {
    loadBackendData();
    
    // Her 5 saniyede bir yenile
    const interval = setInterval(loadBackendData, 5000);
    return () => clearInterval(interval);
  }, []);

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

      <ScrollView style={styles.content}>
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
            <Text style={styles.sectionTitle}>⚠️ Sorun Bildirimleri</Text>
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
                    Bildirilme: {formatDateTime(issueDate)}
                  </Text>
                  {issue.type && (
                    <Text style={styles.issueType}>Tip: {issue.type}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Operatör Performansı */}
        {productionAnalysis && productionAnalysis.operatorPerformance.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Operatör Performansı</Text>
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
          </View>
        )}

        {/* Makine Performansı */}
        {productionAnalysis && productionAnalysis.machinePerformance.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Makine Performansı</Text>
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
          </View>
        )}

        {/* Günlük Üretim */}
        {productionAnalysis && productionAnalysis.dailyProduction.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Günlük Üretim Trendi</Text>
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
});

export default ManagerScreen;

