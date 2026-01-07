/**
 * Kalıplar Ekranı
 * Production_db'deki kalıpları listeler
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  FlatList,
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
  const [addingMold, setAddingMold] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [moldToDelete, setMoldToDelete] = useState<Mold | null>(null);
  const [deletingMold, setDeletingMold] = useState(false);

  // Sadece planner ve admin kalıp ekleyebilir
  const canAddMold = user.role === 'planner' || user.role === 'admin';

  const loadMolds = useCallback(async () => {
    try {
      setLoading(true);
      const data = await moldsAPI.getMolds();
      setMolds(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('❌ Error loading molds:', error);
      Alert.alert('Hata', 'Kalıplar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMolds();
  }, [loadMolds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMolds();
    setRefreshing(false);
  }, [loadMolds]);

  const handleAddMold = useCallback(() => {
    setMoldCode('');
    setShowAddModal(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false);
    setMoldCode('');
  }, []);

  const handleSaveMold = useCallback(async () => {
    const trimmedCode = moldCode.trim();
    
    if (!trimmedCode) {
      Alert.alert('Hata', 'Lütfen kalıp kodu girin!');
      return;
    }

    try {
      setAddingMold(true);
      await moldsAPI.createMold({
        code: trimmedCode,
        name: trimmedCode,
        product_id: null,
        status: 'active',
      });
      
      Alert.alert('Başarılı', 'Kalıp başarıyla eklendi!');
      handleCloseAddModal();
      await loadMolds();
    } catch (error: any) {
      console.error('Error adding mold:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Kalıp eklenirken bir hata oluştu!';
      Alert.alert('Hata', errorMessage);
    } finally {
      setAddingMold(false);
    }
  }, [moldCode, handleCloseAddModal, loadMolds]);

  const handleOpenDeleteModal = useCallback((mold: Mold) => {
    setMoldToDelete(mold);
    setShowDeleteModal(true);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
    setMoldToDelete(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!moldToDelete) return;

    try {
      setDeletingMold(true);
      await moldsAPI.deleteMold(moldToDelete.id);
      Alert.alert('Başarılı', 'Kalıp başarıyla silindi!');
      handleCloseDeleteModal();
      await loadMolds();
    } catch (error: any) {
      console.error('Error deleting mold:', error);
      Alert.alert('Hata', error.message || 'Kalıp silinirken bir hata oluştu!');
    } finally {
      setDeletingMold(false);
    }
  }, [moldToDelete, handleCloseDeleteModal, loadMolds]);

  const renderMoldItem = useCallback(({ item: mold }: { item: Mold }) => (
    <View style={styles.moldCard}>
      <View style={styles.moldHeader}>
        <Text style={styles.moldCode}>{mold.code}</Text>
        <View style={styles.moldHeaderRight}>
          {mold.product_id && (
            <Text style={styles.moldProduct}>
              Ürün ID: {mold.product_id}
            </Text>
          )}
          {canAddMold && (
            <TouchableOpacity
              onPress={() => handleOpenDeleteModal(mold)}
              style={styles.deleteIcon}
              activeOpacity={0.6}
            >
              <Text style={styles.deleteIconText}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  ), [canAddMold, handleOpenDeleteModal]);

  const keyExtractor = useCallback((item: Mold) => item.id.toString(), []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>KALIPLAR</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.welcomeText}>Kalıp Listesi</Text>
          {canAddMold && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddMold}
              activeOpacity={0.7}
            >
              <Text style={styles.addButtonText}>+ Kalıp Ekle</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading && molds.length === 0 ? (
          <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
        ) : molds.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Kalıp bulunmamaktadır.</Text>
          </View>
        ) : (
          <FlatList
            data={molds}
            keyExtractor={keyExtractor}
            renderItem={renderMoldItem}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={styles.flatListContent}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={10}
          />
        )}
      </View>

      {/* Kalıp Ekleme Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseAddModal}
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
              editable={!addingMold}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleCloseAddModal}
                disabled={addingMold}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveMold}
                disabled={addingMold}
                activeOpacity={0.7}
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
        animationType="fade"
        onRequestClose={handleCloseDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Kalıp Sil</Text>
            
            {moldToDelete && (
              <Text style={styles.modalMessage}>
                "{moldToDelete.code}" ({moldToDelete.name}) kalıbını silmek istediğinize emin misiniz?
              </Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleCloseDeleteModal}
                disabled={deletingMold}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={handleConfirmDelete}
                disabled={deletingMold}
                activeOpacity={0.7}
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
  flatListContent: {
    paddingBottom: 20,
  },
  loader: {
    marginTop: 40,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  addButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
  },
  moldCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3498db',
    flex: 1,
  },
  moldHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moldProduct: {
    fontSize: 14,
    color: '#3498db',
    fontWeight: '600',
    marginRight: 10,
  },
  deleteIcon: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fee',
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconText: {
    fontSize: 18,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  modalMessage: {
    fontSize: 14,
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
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
    justifyContent: 'center',
    minHeight: 44,
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
