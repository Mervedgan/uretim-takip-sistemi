/**
 * Kalıplar Ekranı
 * Production_db'deki kalıpları listeler
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { User } from '../types';
import { moldsAPI } from '../utils/api';

interface MoldsScreenProps {
  user: User;
  onBack: () => void;
}

interface Mold {
  id: number;
  code: string;
  name: string;
  description: string | null;
  product_id: number | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

const MoldsScreen: React.FC<MoldsScreenProps> = ({ user, onBack }) => {
  const [molds, setMolds] = useState<Mold[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadMolds = async () => {
    try {
      setLoading(true);
      const data = await moldsAPI.getMolds();
      setMolds(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error loading molds:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMolds();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMolds();
    setRefreshing(false);
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
      case 'active':
        return '#27ae60';
      case 'maintenance':
        return '#f39c12';
      case 'inactive':
        return '#95a5a6';
      default:
        return '#3498db';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Aktif';
      case 'maintenance':
        return 'Bakım';
      case 'inactive':
        return 'Pasif';
      default:
        return status;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>KALIPLAR</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Kalıp Listesi</Text>
          <Text style={styles.infoText}>
            Production_db'deki tüm aktif kalıplar
          </Text>
        </View>

        {loading && molds.length === 0 ? (
          <ActivityIndicator size="large" color="#3498db" style={{ marginVertical: 40 }} />
        ) : molds.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Kalıp bulunmamaktadır.</Text>
          </View>
        ) : (
          molds.map((mold) => (
            <View key={mold.id} style={styles.moldCard}>
              <View style={styles.moldHeader}>
                <Text style={styles.moldCode}>{mold.code}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(mold.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{getStatusText(mold.status)}</Text>
                </View>
              </View>
              <Text style={styles.moldName}>{mold.name}</Text>
              {mold.description && (
                <Text style={styles.moldDescription}>{mold.description}</Text>
              )}
              {mold.product_id && (
                <Text style={styles.moldProduct}>
                  Ürün ID: {mold.product_id}
                </Text>
              )}
              <View style={styles.moldFooter}>
                <Text style={styles.moldDate}>
                  Oluşturulma: {formatDate(mold.created_at)}
                </Text>
                {mold.updated_at && (
                  <Text style={styles.moldDate}>
                    Güncelleme: {formatDate(mold.updated_at)}
                  </Text>
                )}
              </View>
            </View>
          ))
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
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  moldCard: {
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
  moldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  moldCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3498db',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  moldName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  moldDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
    lineHeight: 20,
  },
  moldProduct: {
    fontSize: 14,
    color: '#3498db',
    marginBottom: 10,
    fontWeight: '600',
  },
  moldFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  moldDate: {
    fontSize: 12,
    color: '#95a5a6',
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
});

export default MoldsScreen;

