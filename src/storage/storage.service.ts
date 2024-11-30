import { DownloadResponse, Storage } from '@google-cloud/storage';
import { Injectable } from '@nestjs/common';
import StorageConfig from 'src/storage-config';

import * as AWS from 'aws-sdk';


@Injectable()
export class StorageService {
  private readonly s3: AWS.S3;
  private bucket: string;

  constructor() {
    this.s3 =  new AWS.S3({
      accessKeyId: 'DO00DWQVENYR8L6KRDGR',
      // accessKeyId: 'DO00AKT9M2FJT4MEKC6R',
      // secretAccessKey: '6m5H/jAppq1xRRJPz2Eo0m7hIG+DzkdX6w3+g4JTbcI',
      secretAccessKey: 'kWMzeUCgF1aMs6opZgQbkxP7JTejZ1ZkwXAJHgOB5gw',
      endpoint: 'https://kiitconnect2.blr1.digitaloceanspaces.com',
      s3ForcePathStyle: true, // needed with Spaces
      signatureVersion: 'v4',
  });

  
    this.bucket = "kiitconnect2";
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
    Expires: 200, // URL expiration time in seconds
    ContentType: fileType,
    ACL: 'public-read',
  };

  return this.s3.getSignedUrlPromise('putObject', params);
}




}
