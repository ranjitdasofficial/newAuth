import { Injectable, UnauthorizedException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class AuthenticatorService {
  constructor(private prisma: PrismaService,   
     @Inject(CACHE_MANAGER) private readonly cacheService: Cache,) {}

  /**
   * Generate a new authenticator secret and QR code for a user
   */
  async setupAuthenticator(userId: string) {
    try {
      // Generate a new secret
      const secret = speakeasy.generateSecret({
        name: 'KiitConnect',
        issuer: 'KiitConnect',
        length: 20,
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      // Store the secret temporarily (not enabled yet)
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          authenticatorSecret: secret.base32,
          authenticatorEnabled: false,
        },
      });

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        backupCodes,
        message: 'Authenticator setup initiated. Scan QR code and verify with a code to enable.',
      };
    } catch (error) {
      throw new BadRequestException('Failed to setup authenticator');
    }
  }

  /**
   * Verify and enable authenticator for a user
   */
  async verifyAndEnableAuthenticator(userId: string, token: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { authenticatorSecret: true },
      });

      if (!user?.authenticatorSecret) {
        throw new BadRequestException('Authenticator not setup. Please setup first.');
      }

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: user.authenticatorSecret,
        encoding: 'base32',
        token: token,
        window: 2, // Allow 2 time steps (60 seconds) for clock skew
      });

      if (!verified) {
        throw new UnauthorizedException('Invalid authenticator code');
      }

      // Enable authenticator and store backup codes
      const backupCodes = this.generateBackupCodes();
      
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          authenticatorEnabled: true,
          authenticatorBackupCodes: backupCodes,
        },
      });

      return {
        message: 'Authenticator enabled successfully',
        backupCodes,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to verify authenticator');
    }
  }

  /**
   * Verify authenticator code for login/session reset
   */
  async verifyAuthenticatorCode(userId: string, token: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { 
          authenticatorSecret: true, 
          authenticatorEnabled: true,
          authenticatorBackupCodes: true 
        },
      });

      if (!user?.authenticatorEnabled) {
        throw new BadRequestException('Authenticator not enabled for this user');
      }

      // First check if it's a backup code
      if (user.authenticatorBackupCodes.includes(token)) {
        // Remove the used backup code
        const updatedBackupCodes = user.authenticatorBackupCodes.filter(code => code !== token);
        await this.prisma.user.update({
          where: { id: userId },
          data: { authenticatorBackupCodes: updatedBackupCodes },
        });
        return true;
      }

      // Verify TOTP token
      const verified = speakeasy.totp.verify({
        secret: user.authenticatorSecret!,
        encoding: 'base32',
        token: token,
        window: 2,
      });

      return verified;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify authenticator code for session reset (works with email)
   */
  async verifyAuthenticatorCodeForSessionReset(email: string, token: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { 
          id: true,
          authenticatorSecret: true, 
          authenticatorEnabled: true,
          authenticatorBackupCodes: true 
        },
      });

      if (!user?.authenticatorEnabled) {
        throw new Error('Two-factor authentication is not enabled for this user');
      }

      // First check if it's a backup code
      if (user.authenticatorBackupCodes && user.authenticatorBackupCodes.includes(token)) {
        // Remove the used backup code
        const updatedBackupCodes = user.authenticatorBackupCodes.filter(code => code !== token);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { authenticatorBackupCodes: updatedBackupCodes },
        });
        return {
          success: true,
          message: 'Backup code verified successfully',
          remainingCodes: updatedBackupCodes.length
        };
      }

      // Verify TOTP token
      const verified = speakeasy.totp.verify({
        secret: user.authenticatorSecret!,
        encoding: 'base32',
        token: token,
        window: 2,
      });

      if (!verified) {
        throw new Error('Invalid authenticator code');
      }

      return {
        success: true,
        message: 'Authenticator code verified successfully',
        remainingCodes: undefined
      };
    } catch (error) {
      if (error.message === 'Two-factor authentication is not enabled for this user' ||
          error.message === 'Invalid authenticator code') {
        throw error;
      }
      throw new Error('Verification failed');
    }
  }

  /**
   * Disable authenticator for a user
   */
  async disableAuthenticator(userId: string, token: string) {
    try {
      // Verify the token first
      const verified = await this.verifyAuthenticatorCode(userId, token);
      
      if (!verified) {
        throw new UnauthorizedException('Invalid authenticator code');
      }

      // Disable authenticator
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          authenticatorEnabled: false,
          authenticatorSecret: null,
          authenticatorBackupCodes: [],
        },
      });

      return { message: 'Authenticator disabled successfully' };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Failed to disable authenticator');
    }
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(userId: string, token: string) {
    try {
      // Verify the token first
      const verified = await this.verifyAuthenticatorCode(userId, token);
      
      if (!verified) {
        throw new UnauthorizedException('Invalid authenticator code');
      }

      // Generate new backup codes
      const backupCodes = this.generateBackupCodes();
      
      await this.prisma.user.update({
        where: { id: userId },
        data: { authenticatorBackupCodes: backupCodes },
      });

      return {
        message: 'Backup codes regenerated successfully',
        backupCodes,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Failed to regenerate backup codes');
    }
  }

  /**
   * Verify a backup code for a user
   */
  async verifyBackupCode(email: string, backupCode: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { 
          id: true,
          authenticatorBackupCodes: true,
          authenticatorEnabled: true
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.authenticatorEnabled) {
        throw new Error('Two-factor authentication is not enabled for this user');
      }

      if (!user.authenticatorBackupCodes || user.authenticatorBackupCodes.length === 0) {
        throw new Error('No backup codes available for this user');
      }

      // Check if the provided backup code exists
      const codeIndex = user.authenticatorBackupCodes.indexOf(backupCode);
      if (codeIndex === -1) {
        throw new Error('Invalid backup code');
      }

      // Remove the used backup code
      const updatedBackupCodes = user.authenticatorBackupCodes.filter((_, index) => index !== codeIndex);
      
      await this.prisma.user.update({
        where: { id: user.id },
        data: { authenticatorBackupCodes: updatedBackupCodes }
      });

      return {
        success: true,
        message: 'Backup code verified successfully',
        remainingCodes: updatedBackupCodes.length
      };
    } catch (error) {
      if (error.message === 'User not found' || 
          error.message === 'Two-factor authentication is not enabled for this user' ||
          error.message === 'No backup codes available for this user' ||
          error.message === 'Invalid backup code') {
        throw error;
      }
      throw new BadRequestException('Failed to verify backup code');
    }
  }

  /**
   * Reset user session using either authenticator code or backup code
   */
  async resetSessionWithAuthenticatorOrBackup(email: string, token: string, isBackupCode: boolean = false) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { 
          id: true,
          authenticatorSecret: true,
          authenticatorEnabled: true,
          authenticatorBackupCodes: true
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.authenticatorEnabled) {
        throw new Error('Two-factor authentication is not enabled for this user');
      }

      let verificationResult;

      if (isBackupCode) {
        // Verify backup code
        verificationResult = await this.verifyBackupCode(email, token);
      } else {
        // Verify authenticator code
        verificationResult = await this.verifyAuthenticatorCodeForSessionReset(email, token);
      }

      if (!verificationResult.success) {
        throw new Error('Verification failed');
      }

      // Generate a reset token
      const resetToken = `reset_${Date.now()}_${user.id}`;
      
      // Store reset token in cache for potential future use
      await this.cacheService.set(`reset_${user.id}`, resetToken, 300000); // 5 minutes

      // Clear user session from cache if exists
      if(await this.cacheService.get(email)) {
        await this.cacheService.del(email);
      }

      return {
        success: true,
        message: isBackupCode 
          ? 'Backup code verification successful. You can now reset your session.'
          : 'Authenticator verification successful. You can now reset your session.',
        userId: user.id,
        resetToken,
        usedBackupCode: isBackupCode,
        remainingBackupCodes: isBackupCode ? verificationResult.remainingCodes : undefined
      };
    } catch (error) {
      if (error.message === 'User not found' || 
          error.message === 'Two-factor authentication is not enabled for this user' ||
          error.message === 'Invalid authenticator code' ||
          error.message === 'Invalid backup code' ||
          error.message === 'No backup codes available for this user') {
        throw error;
      }
      console.log(error);
      throw new BadRequestException('Failed to reset session');
    }
  }

  /**
   * Check if a user exists and has 2FA enabled
   */
  async checkUserStatus(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { 
          id: true,
          email: true,
          authenticatorEnabled: true
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      if (error.message === 'User not found') {
        throw error;
      }
      throw new BadRequestException('Failed to check user status');
    }
  }

  /**
   * Generate 8-digit backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.floor(10000000 + Math.random() * 90000000).toString();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Get authenticator status for a user
   */
  async getAuthenticatorStatus(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { 
          authenticatorEnabled: true,
          authenticatorBackupCodes: true 
        },
      });

      return {
        enabled: user?.authenticatorEnabled || false,
        backupCodesCount: user?.authenticatorBackupCodes?.length || 0,
      };
    } catch (error) {
      throw new BadRequestException('Failed to get authenticator status');
    }
  }
} 