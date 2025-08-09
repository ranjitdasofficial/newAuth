import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, IsArray, IsBoolean, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType, EventMode } from '@prisma/client';

class ContactInfoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  // Add index signature for Prisma Json compatibility
  [key: string]: any;
}

class DocumentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type: string;

  // Add index signature for Prisma Json compatibility
  [key: string]: any;
}

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  company: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  time: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ enum: EventType })
  @IsEnum(EventType)
  type: EventType;

  @ApiProperty({ enum: EventMode })
  @IsEnum(EventMode)
  mode: EventMode;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  eligibleBranches?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  registrationUrl?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  maxParticipants?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  registeredCount?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requirements?: string[];

  @ApiPropertyOptional({ type: ContactInfoDto })
  @ValidateNested()
  @Type(() => ContactInfoDto)
  @IsOptional()
  contactInfo?: ContactInfoDto;

  @ApiPropertyOptional({ type: [DocumentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  @IsOptional()
  documents?: DocumentDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  companyId?: string;
}