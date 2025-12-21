/**
 * Planlayıcı Ekranı
 * Makine performans raporları görüntüleme
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { User, MachinePerformance, Machine } from '../types';
import { productionStore } from '../data/productionStore';

interface PlannerScreenProps {
  user: User;
  onBack: () => void;
}

const PlannerScreen: React.FC<PlannerScreenProps> = ({ user, onBack }) => {
  const [machinePerformance, setMachinePerformance] = useState<MachinePerformance[]>([]);

  useEffect(() => {
    const calculateMachinePerformance = () => {
      const allProductions = productionStore.getAll();
      const active = productionStore.getActive();
      
      // Gerçek makine listesini üretimlerden oluştur
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
      const machines = Array.from(machineMap.values());
      
      const performance: MachinePerformance[] = machines.map(machine => {
        // Bu makineye ait tüm üretimleri filtrele
        const machineProductions = allProductions.filter(p => p.machineId === machine.id);
        
        // Toplam üretim sayısı
        const totalProductions = machineProductions.length;
        
        // Toplam parça sayısı
        const totalParts = machineProductions.reduce((sum, p) => {
          // Aktif veya paused üretimler için güncel partCount'u hesapla
          if (p.status === 'active' && p.cycleTime && p.cycleTime > 0) {
            const now = new Date();
            const startTime = new Date(p.startTime);
            const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
            return sum + Math.floor(elapsedSeconds / p.cycleTime);
          }
          return sum + p.partCount;
        }, 0);
        
        // Verimlilik hesaplaması kaldırıldı - AI destekli hesaplama için sembolik olarak 0
        const averageEfficiency = 0;
        
        // Tahmini bitiş süresi - Daha sonra aktif edilecek
        // Şimdilik boş bırakılıyor
        
        // Toplam çalışma süresi (saat cinsinden)
        const uptime = machineProductions.reduce((sum, p) => {
          const startTime = new Date(p.startTime);
          if (p.endTime) {
            // Tamamlanmış üretimler
            const endTime = new Date(p.endTime);
            return sum + (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          } else if (p.status === 'active') {
            // Aktif üretimler
            const now = new Date();
            return sum + (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          } else if (p.status === 'paused' && p.pausedAt) {
            // Durdurulmuş üretimler (durdurulma zamanına kadar)
            const pausedAt = new Date(p.pausedAt);
            return sum + (pausedAt.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          }
          return sum;
        }, 0);
        
        // Son üretim tarihi
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
          totalProductions,
          totalParts,
          averageEfficiency: averageEfficiency || 0,
          averageDuration: 0, // Tahmini bitiş süresi - Daha sonra aktif edilecek
          uptime: Math.round(uptime * 10) / 10, // 1 ondalık basamağa yuvarla
          lastProductionDate
        };
      });
      
      setMachinePerformance(performance);
    };
    
    calculateMachinePerformance();
    const interval = setInterval(calculateMachinePerformance, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('tr-TR', {
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
        <Text style={styles.headerTitle}>MAKİNE RAPORLARI</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Planlayıcı: {user.name}</Text>
          <Text style={styles.infoText}>Makine performans raporları ve analizleri</Text>
        </View>

        {/* Makine Performans Listesi */}
        {machinePerformance.map((machine) => (
          <View key={machine.machineId} style={styles.machineCard}>
            <View style={styles.machineHeader}>
              <Text style={styles.machineName}>{machine.machineName}</Text>
              <View style={styles.machineIdBadge}>
                <Text style={styles.machineIdText}>{machine.machineId}</Text>
              </View>
            </View>

            <View style={styles.performanceRow}>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceLabel}>Toplam Üretim</Text>
                <Text style={styles.performanceValue}>{machine.totalProductions}</Text>
              </View>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceLabel}>Toplam Parça</Text>
                <Text style={styles.performanceValue}>{machine.totalParts.toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Ort. Verimlilik</Text>
                <View style={styles.efficiencyContainer}>
                  <View style={[
                    styles.efficiencyBar,
                    { width: `${Math.min(machine.averageEfficiency, 100)}%` }
                  ]} />
                </View>
                <Text style={styles.metricValue}>%{machine.averageEfficiency.toFixed(1)}</Text>
              </View>
            </View>

            <View style={styles.performanceRow}>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceLabel}>Tahmini Bitiş Süresi</Text>
                <Text style={styles.performanceValue}>-</Text>
              </View>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceLabel}>Çalışma Süresi</Text>
                <Text style={styles.performanceValue}>{machine.uptime} saat</Text>
              </View>
            </View>

            <View style={styles.lastProduction}>
              <Text style={styles.lastProductionLabel}>Son Üretim:</Text>
              <Text style={styles.lastProductionDate}>
                {formatDate(machine.lastProductionDate)}
              </Text>
            </View>
          </View>
        ))}

        {/* Özet Bilgiler */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Genel Özet</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>
                {machinePerformance.length}
              </Text>
              <Text style={styles.summaryLabel}>Aktif Makine</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>
                {machinePerformance.reduce((sum, m) => sum + m.totalProductions, 0)}
              </Text>
              <Text style={styles.summaryLabel}>Toplam Üretim</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>0</Text>
              <Text style={styles.summaryLabel}>Ort. Verimlilik</Text>
            </View>
          </View>
        </View>
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
  machineCard: {
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
  machineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  machineName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  machineIdBadge: {
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  machineIdText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  performanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  performanceLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  performanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  metricRow: {
    marginBottom: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ecf0f1',
  },
  metricItem: {
    marginVertical: 5,
  },
  metricLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  efficiencyContainer: {
    width: '100%',
    height: 20,
    backgroundColor: '#ecf0f1',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 5,
  },
  efficiencyBar: {
    height: '100%',
    backgroundColor: '#27ae60',
    borderRadius: 10,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  lastProduction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  lastProductionLabel: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  lastProductionDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#9b59b6',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
  },
});

export default PlannerScreen;

