import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class CloudflareR3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('CLOUDFLARE_R3_BUCKET_NAME');
    
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: this.configService.get<string>('CLOUDFLARE_R3_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.get<string>('CLOUDFLARE_R3_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('CLOUDFLARE_R3_SECRET_ACCESS_KEY'),
      },
    });
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'resources'): Promise<string> {
    const key = `${folder}/${Date.now()}-${file.originalname}`;
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    });

    await this.s3Client.send(command);
    
    // Return the public URL
    return `${this.configService.get<string>('CLOUDFLARE_R3_PUBLIC_URL')}/${key}`;
  }

  async getSignedUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read',
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 }); // 1 hour
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 }); // 1 hour
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  generateFileKey(originalName: string, folder: string = 'resources'): string {
    const timestamp = Date.now();
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${folder}/${timestamp}-${sanitizedName}`;
  }
} 