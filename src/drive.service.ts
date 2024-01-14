// drive.service.ts
import { google } from 'googleapis';
import * as fs from "fs"
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

  async uploadImage(fileBuffer: any, filename: string,folderId:string,mimeType:string,path:string) {
    // console.log(fileBuffer)

    if(!fileBuffer) {
        throw new Error('Please provide a valid file');
    }

    const res = await this.drive.files.create({
      requestBody: {
        name: filename,
        parents:[folderId]
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
}
