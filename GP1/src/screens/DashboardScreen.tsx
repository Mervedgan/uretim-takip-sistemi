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
} from 'react-native';
import { User, ProductionRecord, Machine } from '../types';
import { productionStore } from '../data/productionStore';

interface DashboardScreenProps {
  user: User;
  onLogout: () => void;
  onNavigateToRoleScreen: () => void;
  refreshTrigger?: number;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ user, onLogout, onNavigateToRoleScreen }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeProductions, setActiveProductions] = useState<ProductionRecord[]>([]);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedProductionId, setSelectedProductionId] = useState<string | null>(null);
  const [issueDescription, setIssueDescription] = useState('');

  // Component mount olduğunda productionStore'u başlat (sadece boşsa)
  useEffect(() => {
    const existing = productionStore.getAll();
    if (existing.length === 0) {
      productionStore.initialize([]);
    }
    setActiveProductions(productionStore.getActive());
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
      case 'operator': return 'Operatör';
      case 'planner': return 'Planlayıcı';
      case 'manager': return 'Yönetici';
      default: return role;
    }
  };

  const getRoleScreenName = () => {
    switch (user.role) {
      case 'operator': return 'ÜRETİM GİRİŞİ';
      case 'planner': return 'MAKİNE RAPORLARI';
      case 'manager': return 'YÖNETİM PANELİ';
      default: return 'PANEL';
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

  // Gerçek makine listesini üretimlerden oluştur
  const [machines, setMachines] = useState<Machine[]>([]);

  useEffect(() => {
    const updateMachines = () => {
      const allProductions = productionStore.getAll();
      const machineMap = new Map<string, Machine>();
      
      // Tüm üretimlerden makine bilgilerini çıkar
      allProductions.forEach(production => {
        if (!machineMap.has(production.machineId)) {
          // Makine durumunu belirle
          const activeProduction = productionStore.getActive().find(p => p.machineId === production.machineId);
          let status: 'running' | 'stopped' | 'maintenance' = 'stopped';
          
          if (activeProduction) {
            if (activeProduction.status === 'active') {
              status = 'running';
            } else if (activeProduction.status === 'paused') {
              status = 'stopped';
            }
          }
          
          machineMap.set(production.machineId, {
            id: production.machineId,
            name: `Makine ${production.machineId}`,
            status: status,
          });
        }
      });
      
      setMachines(Array.from(machineMap.values()));
    };
    
    updateMachines();
    const interval = setInterval(updateMachines, 1000);
    return () => clearInterval(interval);
  }, []);

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

      <ScrollView style={styles.content}>
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

        {/* Aktif Üretimler */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Aktif Üretimler ({activeProductions.length})</Text>
          {activeProductions.length === 0 ? (
            <Text style={styles.emptyText}>Aktif üretim bulunmamaktadır.</Text>
          ) : (
            activeProductions.map((production: ProductionRecord) => {
              const machine = machines.find(m => m.id === production.machineId);
              const calculatedPartCount = calculatePartCount(production);
              const cycleTime = getCycleTime(production);
              
              return (
                <View key={production.id} style={styles.productionItem}>
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
                    Hedef: {production.targetCount || '-'} adet
                  </Text>
                  <Text style={styles.productionDetail}>
                    Üretilen: {calculatedPartCount} adet
                  </Text>
                  <Text style={styles.productionDetail}>
                    Başlangıç: {formatDateTime(new Date(production.startTime))}
                  </Text>
                  {cycleTime ? (
                    <Text style={styles.productionDetail}>
                      Cycle Time: {cycleTime} sn/ürün
                    </Text>
                  ) : (
                    <Text style={styles.productionDetail}>
                      Cycle Time: Belirtilmemiş
                    </Text>
                  )}
                  
                  {/* Aşamaları Göster */}
                  {production.stages && production.stages.length > 0 && (
                    <View style={styles.stagesContainer}>
                      <Text style={styles.stagesLabel}>Aşamalar:</Text>
                      {production.stages.map((stage: any) => (
                        <View key={stage.id} style={styles.stageRow}>
                          <Text style={styles.stageText}>
                            {stage.order}. {stage.name}
                          </Text>
                          <View style={[
                            styles.stageStatusBadge,
                            stage.status === 'completed' ? styles.stageCompleted :
                            stage.status === 'in_progress' ? styles.stageInProgress :
                            styles.stagePending
                          ]}>
                            <Text style={styles.stageStatusText}>
                              {stage.status === 'completed' ? '✓' :
                               stage.status === 'in_progress' ? '...' :
                               '○'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Sorun Bildirimi Göster - Geçmiş sorun bildirimleri (aktif olsa bile) */}
                  {production.issue && (
                    <View style={styles.issueContainer}>
                      <Text style={styles.issueLabel}>
                        {production.status === 'paused' ? '⚠️ Sorun Bildirimi:' : '⚠️ Geçmiş Sorun Bildirimi:'}
                      </Text>
                      <Text style={styles.issueText}>{production.issue}</Text>
                      {production.pausedAt && (
                        <Text style={styles.issueTime}>
                          Durdurulma Zamanı: {formatDateTime(new Date(production.pausedAt))}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Operatör için Durdur/Devam Et Butonları */}
                  {user.role === 'operator' && (
                    <View style={styles.actionButtonsContainer}>
                      <TouchableOpacity
                        style={[
                          styles.stopButton,
                          production.status === 'paused' && styles.buttonDisabled
                        ]}
                        onPress={() => handleStopProduction(production.id)}
                        disabled={production.status === 'paused'}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.stopButtonText,
                          production.status === 'paused' && styles.buttonTextDisabled
                        ]}>
                          DURDUR
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[
                          styles.resumeButton,
                          production.status === 'active' && styles.buttonDisabled
                        ]}
                        onPress={() => handleResumeProduction(production.id)}
                        disabled={production.status === 'active'}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.resumeButtonText,
                          production.status === 'active' && styles.buttonTextDisabled
                        ]}>
                          DEVAM ET
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Makine Durumu */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Makine Durumu</Text>
          {machines.map((machine) => (
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
          ))}
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
});

export default DashboardScreen;
