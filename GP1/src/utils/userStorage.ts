/**
 * User Storage Utility - Optimized
 * Handles user data storage using AsyncStorage with duplicate prevention
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

const USERS_KEY = '@registered_users';

export const userStorage = {
  /**
   * Save a new user to storage (prevents duplicates)
   */
  async saveUser(user: User): Promise<void> {
    try {
      const existingUsers = await this.getAllUsers();
      
      // Check if user already exists (by username)
      const userIndex = existingUsers.findIndex(
        u => u.username.trim().toLowerCase() === user.username.trim().toLowerCase()
      );
      
      if (userIndex >= 0) {
        // Update existing user
        existingUsers[userIndex] = user;
      } else {
        // Add new user
        existingUsers.push(user);
      }
      
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(existingUsers));
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  },

  /**
   * Get all registered users
   */
  async getAllUsers(): Promise<User[]> {
    try {
      const usersData = await AsyncStorage.getItem(USERS_KEY);
      return usersData ? JSON.parse(usersData) : [];
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  },

  /**
   * Find user by username and password
   */
  async findUser(username: string, password: string): Promise<User | null> {
    try {
      const users = await this.getAllUsers();
      return users.find(
        u => u.username.trim().toLowerCase() === username.trim().toLowerCase() && 
             u.password === password
      ) || null;
    } catch (error) {
      console.error('Error finding user:', error);
      return null;
    }
  },

  /**
   * Check if username already exists
   */
  async usernameExists(username: string): Promise<boolean> {
    try {
      const users = await this.getAllUsers();
      return users.some(
        u => u.username.trim().toLowerCase() === username.trim().toLowerCase()
      );
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    }
  },

  /**
   * Clear all users (for testing/debugging)
   */
  async clearAllUsers(): Promise<void> {
    try {
      await AsyncStorage.removeItem(USERS_KEY);
    } catch (error) {
      console.error('Error clearing users:', error);
      throw error;
    }
  },
};
