import {
  IsArray,
  IsJSON,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, TransformFnParams, Type } from 'class-transformer';

export class NoteDTO {
  @IsString()
  mimeType: string;

  @IsString()
  name: string;

  @IsString()
  id: string;
}

export class AddNotesDTO {
  @IsString()
  subjectId: string;

  @IsArray()
  @Transform(({ value }: TransformFnParams) => {
    return value.map(({ mimeType, name, id }: any) => ({
      mimeType,
      name,
      Notes: id,
    }));
  })
  // @ValidateNested({ each: true, }) // Skip validation for properties not defined in NoteDTO
  @Type(() => NoteDTO) // Use Type decorator to ensure transformation is applied
  Notes: NoteDTO[];
}

export class AddPyqsDTO {
  @IsString()
  subjectId: string;

  @IsArray()
  @Transform(({ value }: TransformFnParams) => {
    return value.map(({ mimeType, year, type, name, id, solution }: any) => ({
      mimeType,
      year,
      type,
      name,
      Question: id,
      solution,
    }));
  })
  pyqs: {
    mimeType: string;
    year: string;
    type: string;
    name: string;
    Question: string;
    solution: string | null;
  }[];
}

// type PYQSVerify{
//   id       String // Unique identifier for PYQS
//   name     String
//   year     String
//   type     String
// }

// model VerifySolution{
//   id String @id @default(auto()) @map("_id") @db.ObjectId
//   solution String
//   status String @default("REVIEW")
//   maxAttempts Int? @default(2)
//   upiId String
//   pyqs  PYQSVerify
//   userId String @db.ObjectId
//   user User @relation(fields: [userId], references: [id])
//   subjectId String @db.ObjectId
//   createdAt DateTime @default(now())
//   updatedAt DateTime @updatedAt

// }

export class SolutionDto {
  @IsString()
  subjectId: string;

  @IsObject()
  pyqs:{
    id: string;
    name: string;
    year: string;
    type: string;
  }

  @IsString()
  fileId:string

  @IsString()
  upiId: string;


  @IsString()
  userId: string;
}
