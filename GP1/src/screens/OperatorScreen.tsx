/**
 * Operatör Ekranı
 * Üretim başlangıç/bitiş zamanı ve parça sayısı girişi
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { User, ProductionRecord, ProductionStage } from '../types';
import { productionStore } from '../data/productionStore';

interface OperatorScreenProps {
  user: User;
  onBack: () => void;
}

const OperatorScreen: React.FC<OperatorScreenProps> = ({ user, onBack }) => {
  const [productName, setProductName] = useState('');
  const [targetCount, setTargetCount] = useState('');
  const [cycleTime, setCycleTime] = useState(''); // Cycle time (saniye)
  const [machineId, setMachineId] = useState(''); // Makine ID'si (kullanıcı girer)
  
  // Aşama yönetimi
  const [stageCount, setStageCount] = useState('');
  const [stageNames, setStageNames] = useState<string[]>([]);
  const [showStages, setShowStages] = useState(false);

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

  const handleStartProduction = () => {
    if (!productName.trim()) {
      Alert.alert('Hata', 'Lütfen ürün adı girin!');
      return;
    }

    if (!machineId.trim()) {
      Alert.alert('Hata', 'Lütfen makine ID\'si girin!');
      return;
    }

    if (!cycleTime.trim() || isNaN(parseFloat(cycleTime)) || parseFloat(cycleTime) <= 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir cycle time girin! (saniye cinsinden, örn: 5.5)');
      return;
    }

    // Aşama validasyonu
    const stages = createStages();
    if (stageCount && parseInt(stageCount) > 0) {
      if (stages.length !== parseInt(stageCount)) {
        Alert.alert('Hata', 'Lütfen tüm aşamaların isimlerini girin!');
        return;
      }
    }

    // Gerçek zamanı al (Türkiye saatine göre)
    const now = new Date();
    const cycleTimeValue = parseFloat(cycleTime);
    
    // Türkiye saatine göre formatla ve logla
    const turkeyTime = now.toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    console.log('Üretim başlatılıyor - Türkiye saati:', turkeyTime);
    
    const newProduction: ProductionRecord = {
      id: `PR${Date.now()}`,
      machineId: machineId.trim(),
      operatorId: user.id,
      operatorName: user.name,
      productName: productName.trim(),
      startTime: new Date(), // Gerçek zaman (Türkiye saatine göre)
      partCount: 0, // Otomatik hesaplanacak
      targetCount: targetCount ? parseInt(targetCount) : undefined,
      cycleTime: cycleTimeValue, // Cycle time (saniye)
      status: 'active',
      stages: stages.length > 0 ? stages : undefined
    };

    // Debug: Kaydedilen startTime'ı Türkiye saatine göre logla
    const savedTime = newProduction.startTime.toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    console.log('Kaydedilen startTime (Türkiye saati):', savedTime);

    // Production store'a ekle
    productionStore.add(newProduction);

    // Formu temizle
    setProductName('');
    setTargetCount('');
    setCycleTime('');
    setMachineId('');
    setStageCount('');
    setStageNames([]);
    setShowStages(false);

    Alert.alert(
      'Başarılı', 
      'Üretim başlatıldı!\nDashboard\'daki "Aktif Üretimler" bölümünden takip edebilirsiniz.',
      [{ text: 'Tamam' }]
    );
  };

  // Formu temizle
  const clearForm = () => {
    setProductName('');
    setTargetCount('');
    setCycleTime('');
    setMachineId('');
    setStageCount('');
    setStageNames([]);
    setShowStages(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ÜRETİM GİRİŞİ</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Operatör: {user.name}</Text>
        </View>

        {/* Üretim Başlatma Formu */}
        <View style={styles.formCard}>
            <Text style={styles.formTitle}>Yeni Üretim Başlat</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Ürün Adı *</Text>
              <TextInput
                style={styles.input}
                value={productName}
                onChangeText={setProductName}
                placeholder="Ürün adını girin"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Makine ID *</Text>
              <TextInput
                style={styles.input}
                value={machineId}
                onChangeText={setMachineId}
                placeholder="Örn: M001, M002, Makine1..."
                autoCapitalize="none"
              />
              <Text style={styles.hintText}>
                Kullanmak istediğiniz makinenin ID'sini girin
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Hedef Parça Sayısı (Opsiyonel)</Text>
              <TextInput
                style={styles.input}
                value={targetCount}
                onChangeText={setTargetCount}
                placeholder="Hedef miktarı girin"
                keyboardType="numeric"
              />
            </View>

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
  machineOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  machineOptionSelected: {
    borderColor: '#3498db',
    backgroundColor: '#ebf5fb',
  },
  machineOptionText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  machineOptionTextSelected: {
    color: '#3498db',
    fontWeight: '600',
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
  hintText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 5,
    fontStyle: 'italic',
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
  stagesInfo: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  stagesLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    marginBottom: 10,
  },
  stageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 10,
  },
  stageItemText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
    flex: 1,
  },
  stageStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stagePending: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  stageInProgress: {
    backgroundColor: '#f39c12',
  },
  stageCompleted: {
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  stageStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
});

export default OperatorScreen;

