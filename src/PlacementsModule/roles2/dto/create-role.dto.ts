import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsNumber, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class EligibilityDto {
  @ApiProperty({ description: 'Minimum CGPA', required: false })
  @IsOptional()
  @IsNumber()
  minCGPA?: number;

  @ApiProperty({ description: 'Maximum backlogs', required: false })
  @IsOptional()
  @IsNumber()
  maxBacklogs?: number;

  @ApiProperty({ description: 'Eligible branches', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branches?: string[];
}

export class CreateRoleDto {
  @ApiProperty({ description: 'Title of the role' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'CTC range for the role' })
  @IsString()
  ctcRange: string;

  @ApiProperty({ description: 'Description of the role', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Location of the role', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ description: 'Application deadline' })
  @IsString()
  deadline: string;

  @ApiProperty({ description: 'Requirements for the role', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @ApiProperty({ description: 'Eligibility criteria', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => EligibilityDto)
  eligibility?: EligibilityDto;

  @ApiProperty({ description: 'Company ID this role belongs to' })
  @IsString()
  companyId: string;

  @ApiProperty({ description: 'Status of the role', required: false })
  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'INACTIVE';
} 