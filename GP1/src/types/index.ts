/**
 * Kalıp Üretim Takip Sistemi - Type Definitions
 */

// Kullanıcı Rolleri: operator, planner, manager
export type UserRole = 'operator' | 'planner' | 'manager';

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  name: string;
  department?: string;
  phone?: string;
  email?: string;
}

// Makine bilgileri
export interface Machine {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'maintenance';
  currentProductionId?: string;
  lastMaintenanceDate?: Date;
}

// Üretim aşaması
export interface ProductionStage {
  id: string;
  name: string;
  order: number; // Aşama sırası (1, 2, 3...)
  startTime?: Date;
  endTime?: Date;
  status: 'pending' | 'in_progress' | 'completed';
}

// Üretim kaydı - Operatör tarafından oluşturulur
export interface ProductionRecord {
  id: string;
  machineId: string;
  operatorId: string;
  operatorName: string;
  productName: string;
  startTime: Date;
  endTime?: Date;
  partCount: number; // Üretilen parça sayısı
  targetCount?: number; // Hedef parça sayısı
  status: 'active' | 'completed' | 'paused';
  efficiency?: number; // Verimlilik yüzdesi (hesaplanır)
  duration?: number; // Süre (dakika) - endTime varsa hesaplanır
  cycleTime?: number; // Cycle time (saniye) - 1 ürünün kaç saniyede üretildiği
  stages?: ProductionStage[]; // Üretim aşamaları
  issue?: string; // Sorun bildirimi (makine durdurulduğunda)
  pausedAt?: Date; // Durdurulma zamanı
}

// Makine performans metrikleri - Planlayıcı için
export interface MachinePerformance {
  machineId: string;
  machineName: string;
  totalProductions: number;
  totalParts: number;
  averageEfficiency: number;
  averageDuration: number;
  uptime: number; // Makine çalışma süresi (saat)
  lastProductionDate: Date;
}

// Genel üretim analizi - Yönetici için
export interface ProductionAnalysis {
  totalProductions: number;
  totalParts: number;
  totalActiveMachines: number;
  averageEfficiency: number;
  operatorPerformance: OperatorPerformance[];
  machinePerformance: MachinePerformance[];
  dailyProduction: DailyProduction[];
}

// Operatör performansı
export interface OperatorPerformance {
  operatorId: string;
  operatorName: string;
  totalProductions: number;
  totalParts: number;
  averageEfficiency: number;
  averageDuration: number;
}

// Günlük üretim özeti
export interface DailyProduction {
  date: string; // YYYY-MM-DD formatında
  totalProductions: number;
  totalParts: number;
  efficiency: number;
}

// Dashboard verileri
export interface DashboardData {
  user: User;
  activeProductions: ProductionRecord[];
  machineStatus: Machine[];
  summary: {
    todayProductions: number;
    todayParts: number;
    activeMachines: number;
  };
}
