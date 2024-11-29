import { IsOptional, IsString } from 'class-validator';

export class KiitUserRegister {
  @IsString()
  name: string;

  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  profileImage: string;

  @IsOptional()
  @IsString()
  password: string;
}

export class PremiumUserRegisterDto {
  @IsString()
  whatsappNumber: string;

  @IsString()
  branch: string;

  @IsString()
  @IsOptional()
  refralCode: string;

  @IsString()
  year: string;
 
  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  paymentScreenshot?: string;

  @IsString()
  userId: string;
}
