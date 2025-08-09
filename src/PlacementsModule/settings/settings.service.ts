import { Injectable } from '@nestjs/common';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { PrismaService } from 'src/prisma.service';

export interface SystemSettings {
  general: {
    siteName: string;
    university: string;
    description: string;
    maintenanceMode: boolean;
    publicRegistration: boolean;
  };
  notifications: {
    emailNotifications: boolean;
    resourceUploadNotifications: boolean;
    companyRegistrationAlerts: boolean;
    adminEmail: string;
  };
  integrations: {
    googleDrive: {
      enabled: boolean;
      apiKey: string;
    };
    emailService: {
      enabled: boolean;
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPass: string;
    };
  };
  appearance: {
    primaryColor: string;
    secondaryColor: string;
    darkMode: boolean;
    logoUrl: string;
  };
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  private defaultSettings: SystemSettings = {
    general: {
      siteName: 'EduVerse',
      university: 'KIIT University',
      description: 'Comprehensive placement management system for KIIT University students and administrators.',
      maintenanceMode: false,
      publicRegistration: true,
    },
    notifications: {
      emailNotifications: true,
      resourceUploadNotifications: true,
      companyRegistrationAlerts: true,
      adminEmail: 'admin@kiit.ac.in',
    },
    integrations: {
      googleDrive: {
        enabled: false,
        apiKey: '',
      },
      emailService: {
        enabled: false,
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPass: '',
      },
    },
    appearance: {
      primaryColor: '#3B82F6',
      secondaryColor: '#8B5CF6',
      darkMode: true,
      logoUrl: '',
    },
  };

  async getSettings(): Promise<SystemSettings> {
    try {
      // For now, we'll use a simple approach with a single settings document
      // In a real application, you might want to create a dedicated Settings collection
      const settingsDoc = await this.prisma.user.findFirst({
        where: { email: 'system@settings.internal' },
        select: { id: true }
      });

      if (!settingsDoc) {
        // Create default settings
        await this.createDefaultSettings();
      }

      // Return default settings with any overrides from database
      // In a real implementation, you'd fetch this from a dedicated settings collection
      return this.defaultSettings;
    } catch (error) {
      console.error('Error fetching settings:', error);
      return this.defaultSettings;
    }
  }

  async updateSettings(updateData: UpdateSettingsDto): Promise<SystemSettings> {
    try {
      // Here you would update the settings in the database
      // For this demo, we'll just merge with defaults
      const currentSettings = await this.getSettings();
      
      // Deep merge the settings
      const updatedSettings = this.mergeSettings(currentSettings, updateData);
      
      // In a real implementation, save to database here
      
      return updatedSettings;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  async getGeneralSettings() {
    const settings = await this.getSettings();
    return settings.general;
  }

  async getNotificationSettings() {
    const settings = await this.getSettings();
    return settings.notifications;
  }

  async getIntegrationSettings() {
    const settings = await this.getSettings();
    return settings.integrations;
  }

  async getAppearanceSettings() {
    const settings = await this.getSettings();
    return settings.appearance;
  }

  async updateGeneralSettings(generalSettings: any) {
    const currentSettings = await this.getSettings();
    currentSettings.general = { ...currentSettings.general, ...generalSettings };
    return await this.updateSettings(currentSettings);
  }

  async updateNotificationSettings(notificationSettings: any) {
    const currentSettings = await this.getSettings();
    currentSettings.notifications = { ...currentSettings.notifications, ...notificationSettings };
    return await this.updateSettings(currentSettings);
  }

  async updateIntegrationSettings(integrationSettings: any) {
    const currentSettings = await this.getSettings();
    currentSettings.integrations = { ...currentSettings.integrations, ...integrationSettings };
    return await this.updateSettings(currentSettings);
  }

  async updateAppearanceSettings(appearanceSettings: any) {
    const currentSettings = await this.getSettings();
    currentSettings.appearance = { ...currentSettings.appearance, ...appearanceSettings };
    return await this.updateSettings(currentSettings);
  }

  private async createDefaultSettings() {
    // In a real implementation, you'd create a settings document in the database
    // For now, we'll just log that default settings are being used
    console.log('Using default settings configuration');
  }

  private mergeSettings(current: SystemSettings, updates: any): SystemSettings {
    return {
      general: { ...current.general, ...updates.general },
      notifications: { ...current.notifications, ...updates.notifications },
      integrations: {
        googleDrive: { ...current.integrations.googleDrive, ...updates.integrations?.googleDrive },
        emailService: { ...current.integrations.emailService, ...updates.integrations?.emailService },
      },
      appearance: { ...current.appearance, ...updates.appearance },
    };
  }

  // Utility methods for specific settings
  async isMaintenanceMode(): Promise<boolean> {
    const settings = await this.getGeneralSettings();
    return settings.maintenanceMode;
  }

  async isPublicRegistrationEnabled(): Promise<boolean> {
    const settings = await this.getGeneralSettings();
    return settings.publicRegistration;
  }

  async getAdminEmail(): Promise<string> {
    const settings = await this.getNotificationSettings();
    return settings.adminEmail;
  }
}