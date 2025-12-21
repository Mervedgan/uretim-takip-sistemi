/**
 * Giriş Ekranı - Optimized
 * Backend formatına uygun giriş işlemi
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { User } from '../types';
import { authAPI } from '../utils/api';
import { userStorage } from '../utils/userStorage';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  onSignup: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onSignup }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    console.log('=== handleLogin CALLED ===');
    
    if (!username.trim() || !password.trim()) {
      Alert.alert('Hata', 'Lütfen kullanıcı adı ve şifre girin!');
      return;
    }

    console.log('Starting login...');
    setIsLoading(true);

    try {
      // Try API first (backend)
      try {
        const response = await authAPI.login(username.trim(), password);
        setIsLoading(false);
        onLogin(response.user);
        return;
      } catch (apiError: any) {
        // API failed, try local storage
        console.log('API login failed, trying local storage:', apiError.message);
      }

      // Try AsyncStorage (kayıt olan kullanıcılar)
      const storedUser = await userStorage.findUser(username.trim(), password);
      if (storedUser) {
        setIsLoading(false);
        onLogin(storedUser);
        return;
      }

      // All methods failed
      setIsLoading(false);
      Alert.alert('Hata', 'Kullanıcı adı veya şifre hatalı!\nLütfen önce kayıt olun.');
    } catch (error: any) {
      setIsLoading(false);
      console.error('Login error:', error);
      Alert.alert('Hata', error.message || 'Giriş işlemi sırasında bir hata oluştu!');
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>ÜRETİM TAKİP SİSTEMİ</Text>
            <Text style={styles.subtitle}>Makine Bazlı Üretim Yönetim Sistemi</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Kullanıcı Adı</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Kullanıcı adınızı girin"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Şifre</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Şifrenizi girin"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleLogin}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity 
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} 
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.loginButtonText}>GİRİŞ YAP</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.signupButton} 
              onPress={onSignup}
              disabled={isLoading}
            >
              <Text style={styles.signupText}>Kaydol</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  form: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 30,
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
  loginButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    minHeight: 50,
    justifyContent: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  signupButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  signupText: {
    color: '#3498db',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default LoginScreen;
