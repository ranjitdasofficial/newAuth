import { DownloadResponse, Storage } from '@google-cloud/storage';
import { Injectable } from '@nestjs/common';
import StorageConfig from 'src/storage-config';

import * as AWS from 'aws-sdk';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';


@Injectable()
export class StorageService {
  private readonly s3: AWS.S3;
  private bucket: string;
  private s3Client: S3Client;


  constructor() {
  //   this.s3 =  new AWS.S3({
  //     accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
  //     // accessKeyId: 'DO00AKT9M2FJT4MEKC6R',
  //     // secretAccessKey: '6m5H/jAppq1xRRJPz2Eo0m7hIG+DzkdX6w3+g4JTbcI',
  //     secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  //     endpoint: process.env.CLOUDFLARE_PUBLIC_URL,
  //     s3ForcePathStyle: true, // needed with Spaces
  //     signatureVersion: 'v4',
  // });

  this.s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.CLOUDFLARE_PUBLIC_URL,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
    },
  });

  
    this.bucket = "kiitconnect";
  }

  // async save(
  //   path: string,
  //   contentType: string,
  //   media: Buffer,
  //   metadata: { [key: string]: string }[]
  // ): Promise<{ mediaId: string }> {
  //   try {
  //     const object = metadata.reduce((obj, item) => Object.assign(obj, item), {});
  //     const file = this.storage.bucket(this.bucket).file(path);
  //     const stream = file.createWriteStream({
  //       metadata: {
  //         contentType: contentType,
  //       },
  //     });

  //     return new Promise((resolve, reject) => {
  //       stream.on('finish', async () => {
  //         try {
  //           await file.setMetadata({
  //             metadata: object,
  //           });

  //           resolve({ mediaId: object['mediaId'] });
  //         } catch (error) {
  //           console.error('Error setting metadata:', error);
  //           reject(error);
  //         }
  //       });

  //       stream.on('error', (error) => {
  //         console.error('Error during upload:', error);
  //         // Handle errors, e.g., retry logic
  //         reject(error);
  //       });

  //       stream.end(media);
  //     });
  //   } catch (error) {
  //     console.error('Error during save:', error);
  //     // Handle errors
  //     throw error;
  //   }
  // }

  async uploadFile(fileBuffer: Buffer,  key: string): Promise<string|null> {
    const params: AWS.S3.PutObjectRequest = {
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ACL: 'public-read',
    };

    const result =await this.s3.upload(params,{
      
    }).promise();
    return result.Key;
}


  async generateMediaId(): Promise<string> {
    const id = Math.random().toString(36).substring(2, 15);
    return id;
  }



  async deleteFile(key: string): Promise<void> {
    const params: AWS.S3.DeleteObjectRequest = {
        Bucket: this.bucket,
        Key: key,
    };

    await this.s3.deleteObject(params).promise();
}


async getPresignedUrl(fileName: string, fileType: string): Promise<string> {
  const params = {
    Bucket: this.bucket,
    Key: fileName,
    Expires: 9000, // URL expiration time in seconds
    // ContentType: fileType,
    ACL: 'public-read',
  };

  return this.s3.getSignedUrlPromise('putObject', params);
}

async getSignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: 'inline',
  });
  return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });

  // const response = await fetch("https://pub-648631cbb5ae46719020dfd3212c4789.r2.dev/AI%20SPRING%20MID%20SEMESTER%20EXAMINATION%20Answer%20Scheme(1)%20-%20Mainak%20Bandyopadhyay.pdf");

}



async uploadFileToAmazonR2(key: string, fileContent: Buffer): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: this.bucket,
    Key: key,
    Body: fileContent,
  });

  await this.s3Client.send(command);
  console.log(`File uploaded successfully to ${this.bucket}/${key}`);
}



}
