import { IsString, IsEmail, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetupAuthenticatorDto {
  @ApiProperty({ description: 'User ID for setting up authenticator' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class VerifyAuthenticatorDto {
  @ApiProperty({ description: '6-digit authenticator code from TOTP app' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Authenticator code must be exactly 6 digits' })
  token: string;
}

export class ResetSessionDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: '6-digit authenticator code or 8-digit backup code' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 8, { message: 'Code must be 6-8 digits' })
  token: string;
}

export class AuthenticatorStatusResponse {
  @ApiProperty({ description: 'Whether authenticator is enabled' })
  enabled: boolean;

  @ApiProperty({ description: 'Number of available backup codes' })
  backupCodesCount: number;
}

export class SetupAuthenticatorResponse {
  @ApiProperty({ description: 'Base32 secret for manual entry' })
  secret: string;

  @ApiProperty({ description: 'QR code data URL for scanning' })
  qrCode: string;

  @ApiProperty({ description: 'Array of backup codes for account recovery' })
  backupCodes: string[];

  @ApiProperty({ description: 'Success message' })
  message: string;
}

export class ResetSessionResponse {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Reset token for session invalidation' })
  resetToken: string;
} 