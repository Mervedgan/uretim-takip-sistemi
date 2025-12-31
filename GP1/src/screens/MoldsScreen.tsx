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
  Alert,
  TextInput,
  Modal,
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [moldCode, setMoldCode] = useState('');
  const [productId, setProductId] = useState('');
  const [addingMold, setAddingMold] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [moldNameToDelete, setMoldNameToDelete] = useState('');
  const [deletingMold, setDeletingMold] = useState(false);

  // Sadece planner ve admin kalıp ekleyebilir
  const canAddMold = user.role === 'planner' || user.role === 'admin';

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

  const handleAddMold = () => {
    setMoldCode('');
    setProductId('');
    setShowAddModal(true);
  };

  const handleSaveMold = async () => {
    if (!moldCode.trim()) {
      Alert.alert('Hata', 'Lütfen kalıp kodu girin!');
      return;
    }

    if (!productId.trim()) {
      Alert.alert('Hata', 'Lütfen ürün ID girin!');
      return;
    }

    const parsedProductId = parseInt(productId, 10);
    if (isNaN(parsedProductId) || parsedProductId <= 0) {
      Alert.alert('Hata', 'Geçerli bir ürün ID girin!');
      return;
    }

    try {
      setAddingMold(true);
      await moldsAPI.createMold({
        code: moldCode.trim(),
        name: moldCode.trim(), // Kalıp kodu aynı zamanda isim olarak kullanılacak
        product_id: parsedProductId,
        status: 'active',
      });
      
      Alert.alert('Başarılı', 'Kalıp başarıyla eklendi!');
      setShowAddModal(false);
      setMoldCode('');
      setProductId('');
      await loadMolds(); // Listeyi yenile
    } catch (error: any) {
      console.error('Error adding mold:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Kalıp eklenirken bir hata oluştu!';
      Alert.alert('Hata', errorMessage);
    } finally {
      setAddingMold(false);
    }
  };

  const handleDeleteMold = () => {
    setMoldNameToDelete('');
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!moldNameToDelete.trim()) {
      Alert.alert('Hata', 'Lütfen kalıp adı girin!');
      return;
    }

    // Kalıp adına göre kalıbı bul
    const moldToDelete = molds.find(m => 
      m.name.toLowerCase() === moldNameToDelete.trim().toLowerCase() ||
      m.code.toLowerCase() === moldNameToDelete.trim().toLowerCase()
    );

    if (!moldToDelete) {
      Alert.alert('Hata', 'Bu isimde bir kalıp bulunamadı!');
      return;
    }

    Alert.alert(
      'Kalıp Sil',
      `"${moldToDelete.code}" (${moldToDelete.name}) kalıbı silinecek. Emin misiniz?`,
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingMold(true);
              await moldsAPI.deleteMold(moldToDelete.id);
              Alert.alert('Başarılı', 'Kalıp başarıyla silindi!');
              setShowDeleteModal(false);
              setMoldNameToDelete('');
              await loadMolds(); // Listeyi yenile
            } catch (error: any) {
              console.error('Error deleting mold:', error);
              Alert.alert('Hata', error.message || 'Kalıp silinirken bir hata oluştu!');
            } finally {
              setDeletingMold(false);
            }
          },
        },
      ]
    );
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
          <View style={styles.titleRow}>
            <Text style={styles.welcomeText}>Kalıp Listesi</Text>
            {canAddMold && (
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddMold}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addButtonText}>+ Kalıp Ekle</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDeleteMold}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteButtonText}>🗑️ Kalıp Sil</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
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
                {mold.product_id && (
                  <Text style={styles.moldProduct}>
                    Ürün ID: {mold.product_id}
                  </Text>
                )}
              </View>
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

      {/* Kalıp Ekleme Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni Kalıp Ekle</Text>
            
            <Text style={styles.modalLabel}>Kalıp Kodu *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Örn: KP-01"
              placeholderTextColor="#95a5a6"
              value={moldCode}
              onChangeText={setMoldCode}
              autoCapitalize="characters"
            />

            <Text style={styles.modalLabel}>Ürün ID *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Örn: 1"
              placeholderTextColor="#95a5a6"
              value={productId}
              onChangeText={setProductId}
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowAddModal(false);
                  setMoldCode('');
                  setProductId('');
                }}
                disabled={addingMold}
              >
                <Text style={styles.modalButtonCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveMold}
                disabled={addingMold}
              >
                {addingMold ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalButtonSaveText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Kalıp Silme Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Kalıp Sil</Text>
            
            <Text style={styles.modalLabel}>Kalıp Adı veya Kodu *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Örn: KP-01"
              placeholderTextColor="#95a5a6"
              value={moldNameToDelete}
              onChangeText={setMoldNameToDelete}
              autoCapitalize="characters"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setMoldNameToDelete('');
                }}
                disabled={deletingMold}
              >
                <Text style={styles.modalButtonCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={handleConfirmDelete}
                disabled={deletingMold}
              >
                {deletingMold ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalButtonDeleteText}>Sil</Text>
                )}
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  addButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
  moldProduct: {
    fontSize: 14,
    color: '#3498db',
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
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#2c3e50',
    backgroundColor: '#f8f9fa',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#ecf0f1',
    marginRight: 10,
  },
  modalButtonCancelText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonSave: {
    backgroundColor: '#3498db',
    marginLeft: 10,
  },
  modalButtonSaveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonDelete: {
    backgroundColor: '#e74c3c',
    marginLeft: 10,
  },
  modalButtonDeleteText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MoldsScreen;

