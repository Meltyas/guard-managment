/**
 * Local Storage Manager for Guard Organizations
 * Handles local storage when user lacks permissions for game settings
 */

import type { GuardOrganization } from '../types/entities';

export class LocalStorageManager {
  private static readonly STORAGE_KEY = 'guard-management-organizations';
  private static readonly USER_PREFIX = 'user-';

  /**
   * Get the storage key for the current user
   */
  private static getUserStorageKey(): string {
    const userId = game?.user?.id || 'anonymous';
    return `${this.STORAGE_KEY}-${this.USER_PREFIX}${userId}`;
  }

  /**
   * Save organization to localStorage
   */
  public static saveOrganization(organization: GuardOrganization): void {
    try {
      const key = this.getUserStorageKey();
      const data = JSON.stringify(organization);
      localStorage.setItem(key, data);
      console.log(`LocalStorageManager | Saved organization to localStorage: ${organization.name}`);
    } catch (error) {
      console.error('LocalStorageManager | Error saving to localStorage:', error);
    }
  }

  /**
   * Load organization from localStorage
   */
  public static loadOrganization(): GuardOrganization | null {
    try {
      const key = this.getUserStorageKey();
      const data = localStorage.getItem(key);

      if (!data) {
        return null;
      }

      const organization = JSON.parse(data) as GuardOrganization;
      console.log(
        `LocalStorageManager | Loaded organization from localStorage: ${organization.name}`
      );
      return organization;
    } catch (error) {
      console.error('LocalStorageManager | Error loading from localStorage:', error);
      return null;
    }
  }

  /**
   * Delete organization from localStorage
   */
  public static deleteOrganization(): void {
    try {
      const key = this.getUserStorageKey();
      localStorage.removeItem(key);
      console.log('LocalStorageManager | Deleted organization from localStorage');
    } catch (error) {
      console.error('LocalStorageManager | Error deleting from localStorage:', error);
    }
  }

  /**
   * Check if localStorage is available
   */
  public static isAvailable(): boolean {
    try {
      const test = 'localStorage-test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all organizations for current user (returns array with single org for consistency)
   */
  public static getAllOrganizations(): GuardOrganization[] {
    const org = this.loadOrganization();
    return org ? [org] : [];
  }
}
