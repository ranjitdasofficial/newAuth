import { IsOptional, IsString, IsBoolean, IsNumber, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GeneralSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  siteName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  university?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  publicRegistration?: boolean;
}

export class NotificationSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  resourceUploadNotifications?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  companyRegistrationAlerts?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adminEmail?: string;
}

export class GoogleDriveSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class EmailServiceSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  smtpPort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smtpPass?: string;
}

export class IntegrationSettingsDto {
  @ApiProperty({ required: false, type: GoogleDriveSettingsDto })
  @IsOptional()
  @IsObject()
  googleDrive?: GoogleDriveSettingsDto;

  @ApiProperty({ required: false, type: EmailServiceSettingsDto })
  @IsOptional()
  @IsObject()
  emailService?: EmailServiceSettingsDto;
}

export class AppearanceSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  darkMode?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class UpdateSettingsDto {
  @ApiProperty({ required: false, type: GeneralSettingsDto })
  @IsOptional()
  @IsObject()
  general?: GeneralSettingsDto;

  @ApiProperty({ required: false, type: NotificationSettingsDto })
  @IsOptional()
  @IsObject()
  notifications?: NotificationSettingsDto;

  @ApiProperty({ required: false, type: IntegrationSettingsDto })
  @IsOptional()
  @IsObject()
  integrations?: IntegrationSettingsDto;

  @ApiProperty({ required: false, type: AppearanceSettingsDto })
  @IsOptional()
  @IsObject()
  appearance?: AppearanceSettingsDto;
}