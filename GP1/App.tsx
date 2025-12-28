/**
 * Fabrika Üretim Takip Uygulaması
 * React Native ile geliştirilmiştir
 */

import React, { useState, useEffect } from 'react';
import { StatusBar, useColorScheme, ActivityIndicator, View } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import OperatorScreen from './src/screens/OperatorScreen';
import PlannerScreen from './src/screens/PlannerScreen';
import ManagerScreen from './src/screens/ManagerScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import MoldsScreen from './src/screens/MoldsScreen';
import { User } from './src/types';
import { authAPI } from './src/utils/api';
import { tokenStorage } from './src/utils/tokenStorage';

type Screen = 'dashboard' | 'role-specific' | 'signup' | 'products' | 'molds';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [user, setUser] = useState<User | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [dashboardRefreshTrigger, setDashboardRefreshTrigger] = useState(0);

  // Check if user is already authenticated on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Try to get user from storage first (for mock data or previous login)
      const storedUser = await tokenStorage.getUser();
      if (storedUser) {
        setUser(storedUser);
        setIsCheckingAuth(false);
        return;
      }

      // If no stored user, try API (only if backend is available)
      try {
        const isAuthenticated = await authAPI.isAuthenticated();
        if (isAuthenticated) {
          try {
            const currentUser = await authAPI.getCurrentUser();
            setUser(currentUser);
          } catch (error) {
            // API failed, clear tokens
            await authAPI.logout();
          }
        }
      } catch (apiError) {
        // API not available, that's okay - we'll use mock data
        console.log('Backend not available, using mock data');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentScreen('dashboard');
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // If logout fails (backend not available), just clear local state
      console.log('Logout error (backend not available):', error);
    }
    setUser(null);
    setCurrentScreen('dashboard');
  };

  const handleNavigateToRoleScreen = () => {
    setCurrentScreen('role-specific');
  };

  const handleBackToDashboard = () => {
    setCurrentScreen('dashboard');
    // Dashboard'a dönüldüğünde refresh tetikle
    setDashboardRefreshTrigger(prev => prev + 1);
  };

  const handleNavigateToProducts = () => {
    setCurrentScreen('products');
  };

  const handleNavigateToMolds = () => {
    setCurrentScreen('molds');
  };

  const renderRoleSpecificScreen = () => {
    if (!user) return null;

    switch (user.role) {
      case 'worker':
        return <OperatorScreen 
          user={user} 
          onBack={handleBackToDashboard}
          onProductionStarted={() => {
            // Üretim başlatıldığında Dashboard'ı yenile
            setDashboardRefreshTrigger(prev => prev + 1);
          }}
        />;
      case 'planner':
        return <PlannerScreen user={user} onBack={handleBackToDashboard} />;
      case 'admin':
        return <ManagerScreen user={user} onBack={handleBackToDashboard} />;
      default:
        return <DashboardScreen user={user} onLogout={handleLogout} onNavigateToRoleScreen={handleNavigateToRoleScreen} />;
    }
  };

  const handleSignup = () => {
    setCurrentScreen('signup');
  };

  const handleSignupSuccess = async (newUser: User) => {
    // Kullanıcı kayıt olduktan sonra otomatik giriş yap
    setUser(newUser);
    setCurrentScreen('dashboard');
  };

  const handleBackToLogin = () => {
    setCurrentScreen('dashboard');
  };

  // Show loading screen while checking authentication
  if (isCheckingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor="#3498db"
      />
      {!user ? (
        currentScreen === 'signup' ? (
          <SignupScreen onSignupSuccess={handleSignupSuccess} onBack={handleBackToLogin} />
        ) : (
          <LoginScreen onLogin={handleLogin} onSignup={handleSignup} />
        )
      ) : currentScreen === 'dashboard' ? (
        <DashboardScreen 
          user={user} 
          onLogout={handleLogout} 
          onNavigateToRoleScreen={handleNavigateToRoleScreen}
          onNavigateToProducts={handleNavigateToProducts}
          onNavigateToMolds={handleNavigateToMolds}
          refreshTrigger={dashboardRefreshTrigger}
        />
      ) : currentScreen === 'products' ? (
        <ProductsScreen 
          user={user} 
          onBack={handleBackToDashboard} 
        />
      ) : currentScreen === 'molds' ? (
        <MoldsScreen 
          user={user} 
          onBack={handleBackToDashboard} 
        />
      ) : (
        renderRoleSpecificScreen()
      )}
    </>
  );
}

export default App;
