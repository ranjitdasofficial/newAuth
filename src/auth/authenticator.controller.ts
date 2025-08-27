import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException
} from '@nestjs/common';
import { AuthenticatorService } from './authenticator.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { 
  VerifyAuthenticatorDto, 
  ResetSessionDto, 
  AuthenticatorStatusResponse,
  SetupAuthenticatorResponse,
  ResetSessionResponse
} from './dto/authenticator.dto';

@ApiTags('Authenticator (2FA)')
@Controller('auth/authenticator')
export class AuthenticatorController {
  constructor(private readonly authenticatorService: AuthenticatorService) {}

  @Post('setup')
  @ApiOperation({ summary: 'Setup authenticator for 2FA' })
  @ApiResponse({ 
    status: 201, 
    description: 'Authenticator setup initiated',
    type: SetupAuthenticatorResponse
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async setupAuthenticator(@Body() body: { userId: string }) {
    const userId = body.userId;
    return this.authenticatorService.setupAuthenticator(userId);
  }

  @Post('verify-enable')
  @ApiOperation({ summary: 'Verify and enable authenticator' })
  @ApiResponse({ status: 200, description: 'Authenticator enabled successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async verifyAndEnableAuthenticator(@Body() body: VerifyAuthenticatorDto & { userId: string }) {
    const userId = body.userId;
    return this.authenticatorService.verifyAndEnableAuthenticator(userId, body.token);
  }

  @Post('disable')
  @ApiOperation({ summary: 'Disable authenticator' })
  @ApiResponse({ status: 200, description: 'Authenticator disabled successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async disableAuthenticator(@Body() body: VerifyAuthenticatorDto & { userId: string }) {
    const userId = body.userId;
    return this.authenticatorService.disableAuthenticator(userId, body.token);
  }

  @Post('regenerate-backup-codes')
  @ApiOperation({ summary: 'Regenerate backup codes' })
  @ApiResponse({ status: 200, description: 'Backup codes regenerated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async regenerateBackupCodes(@Body() body: VerifyAuthenticatorDto & { userId: string }) {
    const userId = body.userId;
    return this.authenticatorService.regenerateBackupCodes(userId, body.token);
  }

  @Get('status/:userId')
  @ApiOperation({ summary: 'Get authenticator status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Authenticator status retrieved',
    type: AuthenticatorStatusResponse
  })
  async getAuthenticatorStatus(@Param('userId') userId: string) {
    return this.authenticatorService.getAuthenticatorStatus(userId);
  }

  @Post('reset-session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user session using authenticator code or backup code' })
  @ApiResponse({ 
    status: 200, 
    description: 'Session reset successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        userId: { type: 'string' },
        resetToken: { type: 'string' },
        usedBackupCode: { type: 'boolean' },
        remainingBackupCodes: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async resetSession(
    @Body() body: { email: string; token: string; isBackupCode?: boolean }
  ) {
    const { email, token, isBackupCode = false } = body;
    
    if (!email || !token) {
      throw new Error('Email and token are required');
    }

    try {
      const result = await this.authenticatorService.resetSessionWithAuthenticatorOrBackup(
        email, 
        token, 
        isBackupCode
      );
      
      return result;
    } catch (error) {
      if (error.message === 'User not found') {
        throw new BadRequestException('User not found');
      }
      if (error.message === 'Two-factor authentication is not enabled for this user') {
        throw new BadRequestException('Two-factor authentication is not enabled for this user');
      }
      if (error.message === 'Invalid authenticator code') {
        throw new UnauthorizedException('Invalid authenticator code');
      }
      if (error.message === 'Invalid backup code') {
        throw new UnauthorizedException('Invalid backup code');
      }
      if (error.message === 'No backup codes available for this user') {
        throw new BadRequestException('No backup codes available for this user');
      }
      throw new BadRequestException(error.message || 'Failed to reset session');
    }
  }

  @Post('verify-backup-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a backup code for session reset' })
  @ApiResponse({ 
    status: 200, 
    description: 'Backup code verified successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        remainingCodes: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async verifyBackupCode(@Body() body: { email: string; backupCode: string }) {
    const { email, backupCode } = body;
    
    if (!email || !backupCode) {
      throw new Error('Email and backup code are required');
    }

    try {
      const result = await this.authenticatorService.verifyBackupCode(email, backupCode);
      return result;
    } catch (error) {
      if (error.message === 'User not found') {
        throw new BadRequestException('User not found');
      }
      if (error.message === 'Two-factor authentication is not enabled for this user') {
        throw new BadRequestException('Two-factor authentication is not enabled for this user');
      }
      if (error.message === 'No backup codes available for this user') {
        throw new BadRequestException('No backup codes available for this user');
      }
      if (error.message === 'Invalid backup code') {
        throw new UnauthorizedException('Invalid backup code');
      }
      throw new BadRequestException(error.message || 'Failed to verify backup code');
    }
  }

  @Post('verify-code')
  @ApiOperation({ summary: 'Verify authenticator code for any operation' })
  @ApiResponse({ status: 200, description: 'Code verified successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async verifyCode(@Body() body: VerifyAuthenticatorDto & { userId: string }) {
    const userId = body.userId;
    const verified = await this.authenticatorService.verifyAuthenticatorCode(userId, body.token);
    
    if (!verified) {
      throw new Error('Invalid authenticator code');
    }

    return { 
      success: true, 
      message: 'Authenticator code verified successfully' 
    };
  }

  @Post('check-user-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if user exists and has 2FA enabled' })
  @ApiResponse({ 
    status: 200, 
    description: 'User status checked successfully',
    schema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean' },
        hasAuthenticator: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async checkUserStatus(@Body() body: { email: string }) {
    const { email } = body;
    
    if (!email) {
      throw new Error('Email is required');
    }

    try {
      // Find user by email
      const user = await this.authenticatorService.checkUserStatus(email);
      
      return {
        exists: true,
        hasAuthenticator: user.authenticatorEnabled,
        message: user.authenticatorEnabled 
          ? 'User found with 2FA enabled' 
          : 'User found but 2FA not enabled'
      };
    } catch (error) {
      if (error.message === 'User not found') {
        return {
          exists: false,
          hasAuthenticator: false,
          message: 'No user found with this email address'
        };
      }
      throw error;
    }
  }
} 