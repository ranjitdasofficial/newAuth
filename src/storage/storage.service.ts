import { DownloadResponse, Storage } from '@google-cloud/storage';
import { Injectable } from '@nestjs/common';
import StorageConfig from 'src/storage-config';

@Injectable()
export class StorageService {
  private storage: Storage;
  private bucket: string;

  constructor() {
    this.storage = new Storage({
      projectId: StorageConfig.projectId,
      credentials: {
        client_email: StorageConfig.client_email,
        private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDVopMd5hwkS6bL\nogL/IQfttjHEHJ3LJTCy6c47YK7knq0kerK0rn0kVDFJAQ3SEBLWGtqwo1Dfaqh1\nk9A+t6rqRebpWjpjzqL/ZqeJ0joQMI/GMlkpJYw0YC2CS5VJC4EpoBqsFu2s16LJ\nsHlSKF5bjF/Hs0H/2NNlbZMSeUVETRELJtc/qHlx/nL0FDiHqmqCRo99DGJjDOgC\nkocxNc38QXJpVaKfeDILhy0yjDdrwpegPMWCGEGOSRnOWReAnG0dft2cpHlScboR\nL1qMdr8tGLD/ifm9HrTr+hWfedav/96e1ON8GFbTRt5otCH5lD/+ybciFcX62nVb\nVrjjcqbdAgMBAAECggEAT4ldC2sh/BNcUIELa5ARIxvLcG+VAc5hUKMCgJHQ21YG\nMUgrI2C5P57G0J6/Vf9c+/B4jf3nvJ45hLjY9Zis3dbTjvpkNcd3YO4HnySxMFjc\nFlalYk/T4KYUG2fndw/88RHmDD7nEwwfU8bLjF5yLtRWzoM7JbVEkwUWFfEnbDM0\n7AI9tOES9+W2w8n8ICQw19d+3NY3nlpCP4CCwmT2tSG2BauJQmcvcVEeKXCTfNJ5\neMUYMjW59yyirUmaRqlO76SLeU1cVtcilj6qzy69L3Y0jXUa4qkfAv37reRqCcyH\nEqwRL8zbLuB+/nyya4EbEBbWJaoftCVg6kbtqQNfswKBgQDqKG/z+xGr34qwsuz3\ndKNMT6Ev96cJKViXgk89FgKbZw7f08vgnfIEvUDvEDW7/UzyU55rmz+ng6PJmiI1\n2w/wXPBwR8BnZCUk7vU5SlnuvOmJcmGpmBXJ1BMANEmXt3t+MFsj49H8ghDikvda\nGSHhQDDXQzbchd31meXmV8icdwKBgQDpkA/Ti1wrgz35mujxaDg8i7AtgeQGPkkQ\nYa5fnwJFsWlULcmEwRJ+XKB4E2EC+/M3YeFDroPohzYQD9M7mjt02NHAzW4gtkWk\nkZeI15+RL1rr+zOL4iic59lqf/IpAjy9EEAjYsPbxpqr9u/6QIbzEXF1cIX6TJCh\nRU+wdn2wSwKBgGNb701nDvOQcohSFC1Yp+Y8r9frzUwc6EO5/qecDFUm4O/nLk7M\nlqKeL8yBY1u2uwzkoIdmpBcPy9NC/Rs/Lj8/IKN0PtdgbkaCwzmhLBIaxToWeAx/\nxVcUD0/53/Rp3hQIrtPG2xa7ljCeTilEGtU66L6e/cuLXkjWGfCo9S43AoGAL0C5\nIvhf5mHACR7BIA4QypcMRrivtF+nkovgpnHaGNWC1MgKrDQPlMcSpBhvmRX2J+9C\njtng0AuC8Y7yEm3qt4IiNZqaPD4EKv5VpRbSrqHhCDsjO5q+0rfJcdV+3bMZLLr7\n7uzNaUpuAnqMJJonc0fFJ5hjUrdoz2fhbncaiK8CgYBKmGgEmpp60atvn3FO/gvB\nxDucsuBgH9f9WL42ZcZoejeiSwRyBFCBQS1DPLPJLIkAVUYB5amQfNaDilZOMlFK\nvm1ybOgjNY5HeuxQEnYgKajiR4C1o93Ydtucs81oa+AG5TMjcPFO+kHwFsqmjYVt\nz4mUYHCGAe6SnXRAeMAMpQ==\n-----END PRIVATE KEY-----\n",
      },
    });

    this.bucket = StorageConfig.mediaBucket;
  }

  async save(
    path: string,
    contentType: string,
    media: Buffer,
    metadata: { [key: string]: string }[]
  ): Promise<{ mediaId: string }> {
    try {
      const object = metadata.reduce((obj, item) => Object.assign(obj, item), {});
      const file = this.storage.bucket(this.bucket).file(path);
      const stream = file.createWriteStream({
        metadata: {
          contentType: contentType,
        },
      });

      return new Promise((resolve, reject) => {
        stream.on('finish', async () => {
          try {
            await file.setMetadata({
              metadata: object,
            });

            resolve({ mediaId: object['mediaId'] });
          } catch (error) {
            console.error('Error setting metadata:', error);
            reject(error);
          }
        });

        stream.on('error', (error) => {
          console.error('Error during upload:', error);
          // Handle errors, e.g., retry logic
          reject(error);
        });

        stream.end(media);
      });
    } catch (error) {
      console.error('Error during save:', error);
      // Handle errors
      throw error;
    }
  }

  async generateMediaId(): Promise<string> {
    const id = Math.random().toString(36).substring(2, 15);
    return id;
  }
}
