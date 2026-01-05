/**
 * Kayıt Ekranı - Optimized
 * Backend formatına uygun kayıt işlemi
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { User, UserRole } from '../types';
import { authAPI } from '../utils/api';
import { userStorage } from '../utils/userStorage';
import { validators, validationMessages } from '../utils/validation';

interface SignupScreenProps {
  onSignupSuccess: (user: User) => void;
  onBack: () => void;
}

interface FormData {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
}

const SignupScreen: React.FC<SignupScreenProps> = ({ onBack }) => {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!validators.required(formData.fullName)) {
      return validationMessages.required('ad soyad');
    }
    if (!validators.required(formData.phone)) {
      return validationMessages.required('telefon numarası');
    }
    if (!validators.phone(formData.phone)) {
      return validationMessages.phone;
    }
    if (!validators.required(formData.email)) {
      return validationMessages.required('e-posta adresi');
    }
    if (!validators.email(formData.email)) {
      return validationMessages.email;
    }
    if (!validators.required(formData.password)) {
      return validationMessages.required('şifre');
    }
    if (!validators.password(formData.password)) {
      return validationMessages.password;
    }
    if (formData.password !== formData.confirmPassword) {
      return validationMessages.passwordMismatch;
    }
    if (!validators.required(formData.role)) {
      return validationMessages.required('kullanıcı rolü');
    }
    
    const roleLower = formData.role.trim().toLowerCase();
    if (!['worker', 'planner', 'admin'].includes(roleLower)) {
      return 'Kullanıcı rolü worker, planner veya admin olmalıdır!';
    }
    
    return null;
  };

  const generateUsername = async (email: string, fullName: string): Promise<string> => {
    const emailParts = email.includes('@') ? email.split('@') : [email];
    const emailPart = emailParts[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const nameBased = fullName.toLowerCase().split(' ').join('').replace(/[^a-z0-9]/g, '');

    // Try email-based username
    if (emailPart && emailPart.length > 0) {
      const existsInStorage = await userStorage.usernameExists(emailPart);
      if (!existsInStorage) {
        return emailPart;
      }
    }

    // Try name-based username
    if (nameBased && nameBased.length > 0) {
      const existsInStorage = await userStorage.usernameExists(nameBased);
      if (!existsInStorage) {
        return nameBased;
      }
    }

    // Add counter if both exist
    let counter = 1;
    let baseUsername = nameBased || emailPart || 'user';
    let finalUsername = `${baseUsername}${counter}`;
    
    while (await userStorage.usernameExists(finalUsername)) {
      counter++;
      finalUsername = `${baseUsername}${counter}`;
    }
    
    return finalUsername;
  };

  const getDepartment = (role: string): string => {
    const roleLower = role.toLowerCase();
    const departmentMap: Record<string, string> = {
      worker: 'Üretim',
      planner: 'Planlama',
      admin: 'Yönetim',
    };
    return departmentMap[roleLower] || 'Genel';
  };

  const handleSignup = async () => {
    console.log('=== handleSignup FONKSIYONU ÇAĞRILDI ===');
    console.log('Form data:', { ...formData, password: '***', confirmPassword: '***' });
    
    const validationError = validateForm();
    if (validationError) {
      console.log('Validation error:', validationError);
      Alert.alert('Hata', validationError);
      return;
    }

    console.log('Validation passed, starting signup...');
    setIsLoading(true);

    try {
      console.log('Generating username...');
      const username = await generateUsername(formData.email, formData.fullName);
      console.log('Generated username:', username);
      
      const userRole = formData.role.trim().toLowerCase() as UserRole;
      const department = getDepartment(formData.role);

      // Create user object
      const newUser: User = {
        id: String(Date.now()),
        username,
        password: formData.password,
        role: userRole,
        name: formData.fullName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        department,
      };

      console.log('User object created:', { ...newUser, password: '***' });

      // Try API first (backend)
      let savedUser = newUser;
      try {
        console.log('Trying API registration...');
        const response = await authAPI.register(
          username,
          formData.password,
          formData.fullName.trim(),
          userRole,
          formData.phone.trim(),
          formData.email.trim(),
          department
        );

        console.log('API registration successful');
        savedUser = response.user;
        // API success - save to AsyncStorage as backup
        await userStorage.saveUser(response.user);
        console.log('User saved to AsyncStorage (from API)');
      } catch (apiError: any) {
        // API failed - save to AsyncStorage as fallback
        console.log('API registration failed, saving to AsyncStorage:', apiError.message);
        await userStorage.saveUser(newUser);
        console.log('User saved to AsyncStorage (fallback)');
      }

      // Formu temizle
      console.log('Clearing form...');
      setFormData({
        fullName: '',
        phone: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: '',
      });
      
      setIsLoading(false);
      console.log('Showing success alert...');
      
      // Başarı mesajı göster ve giriş ekranına yönlendir
      Alert.alert('Başarılı', 'Kayıt işlemi tamamlandı! Giriş yapabilirsiniz.', [
        { 
          text: 'Tamam', 
          onPress: () => {
            console.log('Alert OK pressed, navigating to login...');
            onBack();
          }
        }
      ]);
    } catch (error: any) {
      setIsLoading(false);
      console.error('Signup error:', error);
      Alert.alert('Hata', error.message || 'Kayıt işlemi sırasında bir hata oluştu!');
    }
  };

  const formFields = [
    { 
      key: 'fullName' as keyof FormData, 
      label: 'Ad Soyad', 
      placeholder: 'Adınızı ve soyadınızı girin', 
      autoCapitalize: 'words' as const 
    },
    { 
      key: 'phone' as keyof FormData, 
      label: 'Telefon Numarası', 
      placeholder: '05XX XXX XX XX', 
      keyboardType: 'phone-pad' as const 
    },
    { 
      key: 'email' as keyof FormData, 
      label: 'E-posta', 
      placeholder: 'ornek@email.com', 
      keyboardType: 'email-address' as const, 
      autoCapitalize: 'none' as const 
    },
    { 
      key: 'password' as keyof FormData, 
      label: 'Şifre', 
      placeholder: 'En az 6 karakter', 
      secureTextEntry: true 
    },
    { 
      key: 'confirmPassword' as keyof FormData, 
      label: 'Şifre Tekrar', 
      placeholder: 'Şifrenizi tekrar girin', 
      secureTextEntry: true 
    },
    { 
      key: 'role' as keyof FormData, 
      label: 'Kullanıcı Rolü', 
      placeholder: 'worker, planner veya admin', 
      autoCapitalize: 'none' as const 
    },
  ];

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>KAYIT OL</Text>
              <Text style={styles.subtitle}>Yeni hesap oluşturun</Text>
            </View>

            <View style={styles.form}>
              {formFields.map((field) => (
                <View key={field.key} style={styles.inputContainer}>
                  <Text style={styles.label}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={formData[field.key]}
                    onChangeText={(value) => updateField(field.key, value)}
                    placeholder={field.placeholder}
                    keyboardType={field.keyboardType}
                    autoCapitalize={field.autoCapitalize}
                    autoCorrect={false}
                    secureTextEntry={field.secureTextEntry}
                    editable={!isLoading}
                  />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
        
        <View style={styles.footer} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [
              styles.signupButton,
              isLoading && styles.signupButtonDisabled,
              pressed && styles.signupButtonPressed
            ]}
            onPress={() => {
              console.log('=== KAYIT OL BUTONUNA BASILDI ===');
              if (!isLoading) {
                handleSignup();
              }
            }}
            disabled={isLoading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.signupButtonText}>KAYIT OL</Text>
            )}
          </Pressable>

          <Pressable 
            style={styles.backButton} 
            onPress={() => {
              console.log('=== GERİ BUTONUNA BASILDI ===');
              onBack();
            }}
            disabled={isLoading}
          >
            <Text style={styles.backText}>Giriş ekranına dön</Text>
          </Pressable>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 0,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
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
  footer: {
    padding: 20,
    paddingTop: 10,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    zIndex: 1000,
    elevation: 10,
  },
  signupButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
    width: '100%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  signupButtonDisabled: {
    backgroundColor: '#95a5a6',
    opacity: 0.6,
  },
  signupButtonPressed: {
    backgroundColor: '#2980b9',
    opacity: 0.9,
  },
  signupButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backText: {
    color: '#3498db',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SignupScreen;
