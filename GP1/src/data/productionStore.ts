/**
 * Üretim Kayıtları Store
 * Aktif üretim kayıtlarını geçici olarak tutar
 * (Gerçek uygulamada backend'den gelecek)
 */

import { ProductionRecord } from '../types';

// Global production records store
let productionRecords: ProductionRecord[] = [];
let isInitialized = false;

export const productionStore = {
  // Tüm kayıtları getir
  getAll(): ProductionRecord[] {
    return [...productionRecords]; // Copy döndür
  },

  // Aktif kayıtları getir (active ve paused durumundakiler)
  getActive(): ProductionRecord[] {
    return productionRecords.filter(p => p.status === 'active' || p.status === 'paused');
  },

  // Yeni kayıt ekle
  add(record: ProductionRecord): void {
    // Date objelerini doğru şekilde kopyala
    const recordWithDates: ProductionRecord = {
      ...record,
      startTime: new Date(record.startTime), // Yeni Date objesi oluştur
      endTime: record.endTime ? new Date(record.endTime) : undefined,
      pausedAt: record.pausedAt ? new Date(record.pausedAt) : undefined,
    };
    
    // Aynı ID'ye sahip kayıt varsa güncelle, yoksa ekle
    const index = productionRecords.findIndex(p => p.id === recordWithDates.id);
    if (index !== -1) {
      productionRecords[index] = recordWithDates;
    } else {
      productionRecords.push(recordWithDates);
    }
    
    console.log('Production added:', recordWithDates.id);
    console.log('StartTime:', recordWithDates.startTime.toLocaleString('tr-TR'));
    console.log('Total:', productionRecords.length, 'Active:', this.getActive().length);
  },

  // Kayıt güncelle
  update(id: string, updates: Partial<ProductionRecord>): void {
    const index = productionRecords.findIndex(p => p.id === id);
    if (index !== -1) {
      // Date objelerini doğru şekilde kopyala
      const updatedRecord = { ...productionRecords[index], ...updates };
      if (updates.startTime) {
        updatedRecord.startTime = new Date(updates.startTime);
      }
      if (updates.endTime) {
        updatedRecord.endTime = new Date(updates.endTime);
      }
      if (updates.pausedAt) {
        updatedRecord.pausedAt = new Date(updates.pausedAt);
      }
      productionRecords[index] = updatedRecord;
    }
  },

  // Kayıt sil
  remove(id: string): void {
    productionRecords = productionRecords.filter(p => p.id !== id);
  },

  // Store'u temizle
  clear(): void {
    productionRecords = [];
    isInitialized = false;
  },

  // Mock data ile başlat (sadece ilk kez veya boşsa)
  initialize(initialRecords: ProductionRecord[]): void {
    if (!isInitialized || productionRecords.length === 0) {
      productionRecords = [...initialRecords];
      isInitialized = true;
      console.log('ProductionStore initialized with', productionRecords.length, 'records');
    } else {
      // Zaten initialize edilmişse, sadece yeni kayıtları ekle (ID'ye göre)
      initialRecords.forEach(record => {
        const exists = productionRecords.find(p => p.id === record.id);
        if (!exists) {
          productionRecords.push(record);
        }
      });
      console.log('ProductionStore already initialized. Current records:', productionRecords.length);
    }
  },

  // Debug için
  getDebugInfo() {
    return {
      total: productionRecords.length,
      active: this.getActive().length,
      isInitialized
    };
  }
};

