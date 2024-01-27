import { IsArray, IsBoolean, IsOptional, IsString, isArray } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class Upload {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  description: string;

  @IsOptional()
  image?: any;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @Transform(({ value }) => (value ==="Anonymous"?true:false))
  isAnonymous?: boolean;

  @IsString()
  userId : string;

  @IsOptional()
  @Transform(({ value }) => (value ? JSON.parse(value) : []))
  @Type(() => String)
  tags?: string[];


  @IsOptional()
  @Transform(({ value }) => (value==="true"?true:false))
  isApproved?: boolean;

  @IsOptional()
  @IsString()
  lostPlace?: string;

  @IsOptional()
  @IsString()
  foundPlace?: string;

  @IsOptional()
  @IsString()
  lostDate?: string;

  @IsOptional()
  @IsString()
  foundDate?: string;


  @IsOptional()
  @IsString()
  githubLink?: string;

  @IsOptional()
  @IsString()
  projectLink?: string;













}


// comment          String
//   commentedBy      String
//   commentedByEmail String
//   isAnonymous      Boolean  @default(true)
//   image            String?
//   createdAt        DateTime @default(now())
//   updatedAt        DateTime @updatedAt
//   kiitsocialId String     @db.ObjectId
//   kiitsocial   kiitsocial @relation(fields: [kiitsocialId], references: [id])

export class AddComments{
  @IsString()
  comment:string;

  @IsString()
  userId:string;

  @IsBoolean()
  isAnonymous:boolean;
  
  @IsString()
  kiitSocialId:string;

  
}