/**
 * Profil Ekranı
 * Kullanıcı profil bilgilerini düzenleme ve şifre değiştirme
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
  ActivityIndicator,
  Image,
} from 'react-native';
import { User } from '../types';
import { authAPI } from '../utils/api';

interface ProfileScreenProps {
  user: User;
  onBack: () => void;
  onUpdateUser: (updatedUser: User) => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, onBack, onUpdateUser }) => {
  // Profil bilgileri
  const [fullName, setFullName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  
  // Şifre değiştirme
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Loading states
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Aktif sekme
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'worker': return 'Operatör';
      case 'planner': return 'Planlayıcı';
      case 'admin': return 'Yönetici';
      default: return role;
    }
  };

  const handleUpdateProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Hata', 'Lütfen adınızı ve soyadınızı girin!');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Hata', 'Lütfen e-posta adresinizi girin!');
      return;
    }

    try {
      setIsUpdatingProfile(true);
      
      // Backend'e profil güncelleme isteği gönder
      const response = await authAPI.updateProfile({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });

      // Kullanıcı bilgilerini güncelle
      const updatedUser: User = {
        ...user,
        name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      };
      
      onUpdateUser(updatedUser);
      
      Alert.alert('Başarılı', 'Profil bilgileriniz güncellendi.');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Hata', error.message || 'Profil güncellenirken bir hata oluştu.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Hata', 'Lütfen mevcut şifrenizi girin!');
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert('Hata', 'Lütfen yeni şifrenizi girin!');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Hata', 'Yeni şifre en az 6 karakter olmalıdır!');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Hata', 'Yeni şifre ve şifre tekrarı eşleşmiyor!');
      return;
    }

    try {
      setIsChangingPassword(true);
      
      // Backend'e şifre değiştirme isteği gönder
      await authAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      // Şifre alanlarını temizle
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      Alert.alert('Başarılı', 'Şifreniz başarıyla değiştirildi.');
    } catch (error: any) {
      console.error('Error changing password:', error);
      Alert.alert('Hata', error.message || 'Şifre değiştirilirken bir hata oluştu.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PROFİL</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Profil Fotoğrafı */}
        <View style={styles.profilePhotoContainer}>
          <View style={styles.profilePhotoPlaceholder}>
            <Text style={styles.profilePhotoInitial}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.changePhotoButton}
            onPress={() => Alert.alert('Bilgi', 'Profil fotoğrafı özelliği yakında eklenecek.')}
          >
            <Text style={styles.changePhotoButtonText}>Fotoğraf Değiştir</Text>
          </TouchableOpacity>
        </View>

        {/* Kullanıcı Bilgileri */}
        <View style={styles.userInfoCard}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userRole}>{getRoleDisplayName(user.role)}</Text>
          <Text style={styles.userUsername}>@{user.username}</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
            onPress={() => setActiveTab('profile')}
          >
            <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>
              Profil Bilgileri
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'password' && styles.tabActive]}
            onPress={() => setActiveTab('password')}
          >
            <Text style={[styles.tabText, activeTab === 'password' && styles.tabTextActive]}>
              Şifre Değiştir
            </Text>
          </TouchableOpacity>
        </View>

        {/* Profil Bilgileri Sekmesi */}
        {activeTab === 'profile' && (
          <View style={styles.formCard}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Ad Soyad *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Adınızı ve soyadınızı girin"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>E-posta *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="ornek@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Telefon</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="05XX XXX XX XX"
                keyboardType="phone-pad"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isUpdatingProfile && styles.submitButtonDisabled]}
              onPress={handleUpdateProfile}
              disabled={isUpdatingProfile}
            >
              {isUpdatingProfile ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitButtonText}>BİLGİLERİ GÜNCELLE</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Şifre Değiştir Sekmesi */}
        {activeTab === 'password' && (
          <View style={styles.formCard}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mevcut Şifre *</Text>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Mevcut şifrenizi girin"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Yeni Şifre *</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Yeni şifrenizi girin (en az 6 karakter)"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Yeni Şifre Tekrar *</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Yeni şifrenizi tekrar girin"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isChangingPassword && styles.submitButtonDisabled]}
              onPress={handleChangePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitButtonText}>ŞİFREYİ DEĞİŞTİR</Text>
              )}
            </TouchableOpacity>
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 50,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profilePhotoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profilePhotoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  profilePhotoInitial: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
  },
  changePhotoButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ecf0f1',
    borderWidth: 1,
    borderColor: '#3498db',
  },
  changePhotoButtonText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
  },
  userInfoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  userRole: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  userUsername: {
    fontSize: 14,
    color: '#95a5a6',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  tabActive: {
    backgroundColor: '#3498db',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  tabTextActive: {
    color: 'white',
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
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
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
  submitButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;

