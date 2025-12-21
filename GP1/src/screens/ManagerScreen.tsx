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
} from 'react-native';
import { User, ProductionRecord, Machine, ProductionAnalysis, OperatorPerformance, MachinePerformance, DailyProduction } from '../types';
import { productionStore } from '../data/productionStore';

interface ManagerScreenProps {
  user: User;
  onBack: () => void;
}

const ManagerScreen: React.FC<ManagerScreenProps> = ({ user, onBack }) => {
  const [activeProductions, setActiveProductions] = useState<ProductionRecord[]>([]);
  const [productionAnalysis, setProductionAnalysis] = useState<ProductionAnalysis | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);

  useEffect(() => {
    const calculateAnalysis = () => {
      const allProductions = productionStore.getAll();
      const active = productionStore.getActive();
      
      // Makine listesini oluştur
      const machineMap = new Map<string, Machine>();
      allProductions.forEach(production => {
        if (!machineMap.has(production.machineId)) {
          const activeProduction = active.find(p => p.machineId === production.machineId);
          let status: 'running' | 'stopped' | 'maintenance' = 'stopped';
          if (activeProduction) {
            status = activeProduction.status === 'active' ? 'running' : 'stopped';
          }
          machineMap.set(production.machineId, {
            id: production.machineId,
            name: `Makine ${production.machineId}`,
            status: status,
          });
        }
      });
      setMachines(Array.from(machineMap.values()));
      
      // Toplam üretim sayısı
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
    
    const updateProductions = () => {
      const active = productionStore.getActive();
      setActiveProductions([...active]);
      calculateAnalysis();
    };
    
    updateProductions();
    const interval = setInterval(updateProductions, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (date: string) => {
    const d = new Date(date);
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

        {/* Aktif Üretimler ve Sorun Bildirimleri */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Aktif Üretimler ve Makine Durumları</Text>
          {activeProductions.length === 0 ? (
            <Text style={styles.emptyText}>Aktif üretim bulunmamaktadır.</Text>
          ) : (
            activeProductions.map((production: ProductionRecord) => {
              const machine = machines.find(m => m.id === production.machineId);
              return (
                <View key={production.id} style={styles.productionCard}>
                  <View style={styles.productionHeader}>
                    <Text style={styles.productionProduct}>{production.productName}</Text>
                    <View style={[
                      styles.statusBadge,
                      production.status === 'active' ? styles.activeBadge : styles.pausedBadge
                    ]}>
                      <Text style={styles.statusBadgeText}>
                        {production.status === 'active' ? 'Aktif' : 'Durduruldu'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.productionDetail}>
                    Makine: {machine?.name || production.machineId}
                  </Text>
                  <Text style={styles.productionDetail}>
                    Operatör: {production.operatorName}
                  </Text>
                  <Text style={styles.productionDetail}>
                    Başlangıç: {formatDateTime(new Date(production.startTime))}
                  </Text>
                  
                  {/* Sorun Bildirimi - Geçmiş sorun bildirimleri (aktif olsa bile) */}
                  {production.issue && (
                    <View style={styles.issueContainer}>
                      <Text style={styles.issueLabel}>
                        {production.status === 'paused' ? '⚠️ Makine Durduruldu - Sorun:' : '⚠️ Geçmiş Sorun Bildirimi:'}
                      </Text>
                      <Text style={styles.issueText}>{production.issue}</Text>
                      {production.pausedAt && (
                        <Text style={styles.issueTime}>
                          Durdurulma Zamanı: {formatDateTime(new Date(production.pausedAt))}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
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
  emptyText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
});

export default ManagerScreen;

