// drive.service.ts
import { drive_v3, google } from 'googleapis';
import * as fs from 'fs';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'stream';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { KiitUsersService } from './kiit-users/kiit-users.service';

export class DriveService {
  private readonly drive;

  

  constructor() {
    const credentials = require('../kiit_crediential.json');
    

    const auth = new google.auth.GoogleAuth({
      credentials:{
        client_id: "117620180066157252139",
        client_email: "kiit-google-drive@elite-crossbar-374713.iam.gserviceaccount.com",
        project_id: "elite-crossbar-374713",
        private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDDr0lctD0PUOh5\nHSfOs+4GjWZnDuSItbIrNpVy55n46jBAgzY7owbpsYeHNskq816VL9BeIUydWSYS\nDsmeAPtbrjIGUTMSWtSDkg2YbvqlCn9xCzz87SwP2Ld06HnVwARHFBHlpm/edVlG\nKNiSCJsBPyj3h/62bwK2cYYUzwE4lix6ysT3/wJPDWkY13nthywxtjcIrRGUm9Dj\nVfP9xcUTHPWwj3qyQMmK0XRNLBrMnVisWZUXu21TMe8Hl7vzdmkh7cOPvSSsTDJO\nybEMaWosFbxZ2FvzGxjm1H4DTw4Hru1VIx0hgmuVVVbO6+cul20VOnPz2SF2Xknl\nJ07+hP2lAgMBAAECggEAGL153zpbaOsQBTX6MTA+9P2eF4QCwUUFimCbivw8k4Oa\nR6G/MtGE/3lGOwJicydzSxXROIFpxBAAF/LeKzeRD/GJWhKcjCLHMP4/cUkAr+qQ\nm7xxwMGEm1lJMoLs2mktMUZYj+oXxS6dc5kY7nefj0wKtCbxvWNyGppmOw3D6AEd\neCl8A4GnPRNAXLmq15uzncgyNVFp9oTBDo+UVRdvOnfXoCqUxOvsST+msuRi+77J\n3UUSmTAknchbl1FmyG4RO+7tqC5RTIZT/EsEEhLk7uVjwVzaoqPlCEtGb8BTcx8h\nz3dDZjakG0D3tu8NEh5bZUkvlIpieewcKfdEGYnVMQKBgQD/JK3qmb5MGE3hYXXU\nDCH9tRYCYvU7G/uAkkjhnRgSuPFfQDV86+GyL+Psv828778GUUO2BY/10j5mZLtv\nJx73ZwKwcxEImUfA1Q9zpVOtIb6B5Xzb1u5IqjnO8rDgV203xtKoyB5CiaAoiRcQ\n9894P/KgL43ZCeVq5a9MC83/EQKBgQDEV38q7k1bNYkpf5jXo2ppXkCwjpafiB8u\nCPcrZgHy9at1EgqixvHfqrRPmu30MWSEVDaCgUYJOp3M0bMil1fpDVZQNsnNPzfu\njFW3AB+p6BMJBySW/yuMj13Bt8Jn8gBxT3f7n0UdcI0lz2mkOd950IsN4jflFwh9\njFvPDFR9VQKBgQCwiY6UvuA/AqoQgkDnAaYbR8r8x7/qsEfrBEzNXscjXTgVsfXQ\ng93cTuqkC2qtii1gj6YMMfkUG+71JknSdP0mLe5cbKGik3xkXoecew5Uwv5wHnuw\nGR0yxiXNnXrpH1UAvN9RzXWykEtzALgnE3BIQeb9EypQvFozBs2uDpTwIQKBgA6X\nCeYgyzLJ6aVhy/PKOvAVhu0Xy22Tae270NIyxFZPlywd6RhrfDHIt5lqw9/vg66p\nq1tLS+8Hog5ETvF1GZ1B1nYjfB96YSei2gO9SJ0Rl8iF9VwbHhtV0/u/Mf0TaKEC\n7MGP9kzXvkVfAlSn0El3C74+XzTw3zqlIXVjTyv5AoGAYH9VsuKWxdop9v2sjWkJ\njJAKTppfpJx0vAm0xeOqt6rIE+lqx0mE7CYUQPF6j9TA+YEm4n5QljfgdGWSxG03\nekRfvkLX4G9HWAl1502ASDD6xPcwDTkX/Lu1PhRbqq39zwtAihwPTmh1qBrlhQEf\nGlJyTYn7QRAGXvw/duNITYQ=\n-----END PRIVATE KEY-----\n",
      },
      scopes: "https://www.googleapis.com/auth/drive",
    });

    this.drive = google.drive({ version: 'v3', auth });
  }

  async uploadSolution(
    fileBuffer: any,
    fileName: string,
    folderId: string,
    mimeType: string,
    path: string,
  ) {
    try {
      console.log(fileBuffer);
      if (!fileBuffer) {
        throw new NotFoundException('File Buffer Not Found');
      }
      const fileStream = Readable.from([fileBuffer]);
      const drive = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
        },
        media: {
          mimeType: mimeType,
          body: fileStream, // Pass the buffer directly as the body
        },
      });

      await fs.unlinkSync(path);

      console.log(drive.data);
      return drive.data.id;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Failed to upload Image');
    }
  }

  async uploadImage(
    fileBuffer: any,
    filename: string,
    folderId: string,
    mimeType: string,
    path: string,
  ) {
    // console.log(fileBuffer)

    if (!fileBuffer) {
      throw new Error('Please provide a valid file');
    }
    const res = await this.drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType: mimeType,
        body: fileBuffer, // Pass the buffer directly as the body
      },
    });

    fs.unlinkSync(path);

    console.log(res.data);
    return res.data.id;
  }

  async deleteFile(fileId: string) {
    try {
      await this.drive.files.delete({ fileId }, (err, res) => {
        if (err) {
          console.error('Error deleting file:', err);
          throw err;
        }
      });

      console.log('File deleted successfully');
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  async listFiles() {
    const response = await this.drive.files.list({
      q: 'parents in "1rAlFAE_g4Tg6HI3WgfPeTqM8kMcQys7e"',
      fields: 'files(id, name)',
      pageSize: 100
    });
    
    return response.data.files.map(file => ({
      name: file.name,
      id: file.id
    }));
  }

  async createFolder(folerName: string) { 
    try { 
      // const parentFolderId = '1GJfxt_jgK5fdZj-4eaXxizVZVgvhrpKK'; // Replace with the ID of your parent folder
      const parentFolderId = '1X6TlWuzQRc8xJRWpdL-lrum-0Mmz5hXY'; // Replace with the ID of your parent folder

      const folderMetadata: drive_v3.Schema$File = {
        name: folerName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (parentFolderId) {
        folderMetadata.parents = [parentFolderId];
      }

      const driveResponse = await this.drive.files.create({
        requestBody: folderMetadata,
      });

      if(!driveResponse.data.id) throw new Error("Failed to Create File");
      console.log("Created with",driveResponse.data.id);
      return driveResponse.data.id;

    } catch (error) {
      console.error('Error uploading file to Google Drive:');
      throw new Error("Failed to create file");
    }
  }


  async getDriveFile(fileId: string) {
    try {
      // Request the file from Google Drive as a stream
      const res = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );
      console.log("Successfully fetched file from Google Drive.");
      return res.data as Readable;  // Returning the stream
    } catch (error) {
      console.error('Error getting file from Google Drive:', error);
      throw new Error('Failed to get file from Google Drive');
    }
  }
  


  async setPermissions(fileId: string, permissions: any)  {
  try {
    for (const permission of permissions) {
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: permission,
        sendNotificationEmail: false,
      
      // transferOwnership: true,
        // transferOwnership: false,
      });
    }

    console.log('Permissions set successfully for file:', fileId);
  } catch (error) {
    // await this.drive.files.delete({
    //   fileId: fileId,
    // });

    console.log(error,fileId);

    throw new Error("Error in setting permissions");
  }
};

downloadPermissions = [
  {
    type: "user",
    role: "writer",
    // copyRequiresWriterPermission: true,
    emailAddress: "dranjitkumar16@gmail.com"

  },
  {
    type: "user",
    role: "writer",
    emailAddress: "technicalranjit@gmail.com"

  },
 
];


  //copy file from one folder to another
  async copyFile(fileId: string, folderId: string) {
    try {
      const res = await this.drive.files.copy({
        fileId,
        requestBody: {
          parents: [folderId],
          copyRequiresWriterPermission: true,
        },
      });
      console.log('File copied successfully');
      if (!res.data.id) {
        return null;
      }
      await this.setPermissions(res.data.id, this.downloadPermissions);
      return res.data.id;
    } catch (error) {
      console.error('Error copying file:', error);
      throw null;
    }

  }


  async restrictFileAccess(id:string){
  

    try {
      // Remove general access (make it restricted)
      await this.drive.permissions.delete({
          fileId: id,
          permissionId: "anyoneWithLink", // Permission ID for general access
      });

      console.log(`File ${id} is now restricted.`);
  } catch (error) {
      console.error("Error restricting file access:", error);
      throw new Error("Failed to restrict file access");
  }
  }


  async downloadFile(fileId: string): Promise<Buffer> {
    const res = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' },
    );
    const chunks = [];
    return new Promise((resolve, reject) => {
      res.data
        .on('data', (chunk) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', (err) => reject(err));
    });
  }

}
