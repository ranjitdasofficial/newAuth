import { IsArray, IsBoolean, IsOptional, IsString, isArray } from 'class-validator';

export class Upload {
  @IsString()
  title: string;
  @IsString()
  description: string;

  @IsOptional()
  image?: any;

  @IsOptional()
  @IsString()
  eventType?: string;


  @IsString()
  createdByEmail: string;
  @IsString()
  createdByName: string;

  @IsOptional()
  @IsString()
  createdByImage?: string;

  @IsString()
  isAnonymous: string;


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
  commentedByEmail:string;

  @IsString()
  commentedBy:string;


  @IsString()
  image:string;

  @IsBoolean()
  isAnonymous:boolean;
  
  @IsString()
  kiitSocialId:string;
}