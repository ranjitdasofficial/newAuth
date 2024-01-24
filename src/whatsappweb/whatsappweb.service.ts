// whatsapp.service.ts
import { Injectable } from '@nestjs/common';
import * as whatsappWeb from 'whatsapp-web.js';

import * as QRCode from 'qrcode-terminal';

@Injectable()
export class WhatsappService {
  private client: any; // Replace 'any' with the actual type from the library

  constructor() {
    // this.initializeWhatsApp();
  }

  private initializeWhatsApp() {
    this.client = new whatsappWeb.Client({
        puppeteer: {
            headless: true,
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-accelerated-2d-canvas",
              "--no-first-run",
              "--no-zygote",
              "--single-process", // <- this one doesn't works in Windows
              "--disable-gpu",
            ], 
          },
          authStrategy: new whatsappWeb.LocalAuth({
          clientId: 'whatsapp-web',
          }),
    }); 


    this.client.on('qr', (qr) => {
    //   console.log('Scan the QR code:', qrCode);

        QRCode.generate(qr, { small: true });
    

      // Handle the QR code display in your application (e.g., show it on a web page)
    });

    this.client.on('authenticated', (session) => {
      console.log('Authenticated with session:', session);
      // Handle successful authentication (e.g., save session data for later use)
    });

    this.client.on('auth_failure', (msg) => {
      console.error('Authentication failed:', msg);
       
    }); 

    
    // this.client.initialize();
  }

  async sendMessage(chatId: string, message: string): Promise<void> {
    try {
      const getChat = await  this.client.getChatById("120363225438657833@g.us");
            await getChat.sendMessage(message);
    } catch (error) {
      // throw new Error(`Failed to send message: ${error.message}`);
      console.log("failed to send message",error);
    }
  }

  async getMessages(): Promise<any[]> {
    // Implement logic to retrieve messages 
    // For example, return a list of messages
    const messages = []; // Replace with actual implementation
    return messages;
  }
}
