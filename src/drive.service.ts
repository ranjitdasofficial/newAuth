// drive.service.ts
import { drive_v3, google } from 'googleapis';
import * as fs from 'fs';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'stream';
export class DriveService {
  private readonly drive;

  constructor() {
    const credentials = require('../kiit_crediential.json');
    const auth = new google.auth.GoogleAuth({
      credentials,

      scopes: ['https://www.googleapis.com/auth/drive'],
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

  async createFolder(folerName: string) { 
    try { 
      const parentFolderId = '1GJfxt_jgK5fdZj-4eaXxizVZVgvhrpKK'; // Replace with the ID of your parent folder

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


  
}
