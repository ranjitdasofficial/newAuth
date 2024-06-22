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

    this.client.on("message", (msg) => {
        console.log("message received",msg);
        let button = new whatsappWeb.Buttons('Button body',[{body:'bt1'},{body:'bt2'},{body:'bt3'}],'title','footer');
        // client.sendMessage(message.from, button);
        this.client.sendMessage(msg.from, button);
    });


    this.client.on('authenticated', (session) => {
      console.log('Authenticated with session:', session);
      // Handle successful authentication (e.g., save session data for later use)
    });

    this.client.on('auth_failure', (msg) => {
      console.error('Authentication failed:', msg);
       
    }); 

    
    this.client.initialize();
  }

  async sendMessage(chatId: string, desc: string,image?:string,title?:string,postLink?:string,postType?:string): Promise<void> {
    try {
      const getChat = await  this.client.getChatById(chatId);
       if(image){
        const media = await this.sendMedia(image);

        // const media = await sendMedia("https://storage.googleapis.com/kiitconnect_bucket/media/4xg3kgqx0o2");

        const description = `${desc.slice(0,20)}.Readmore`;
        const link = `http://kiitconnect.com/kiitsocial/${postLink}`;
        
        // const m = MessageMedia.fromFilePath(imageFilePath);
        const caption = `*New Post-:* ${postType}\n\n${title?`*${title}*\n\n`:``}${description}\n\n*View Post:* ${link}`;
        await getChat.sendMessage(media, { caption: caption });
      }
    } catch (error) {
      // throw new Error(`Failed to send message: ${error.message}`);
      console.log("failed to send message",error);
    }
  }


  // async sendMessageWi

  async sendMedia(msg:string){
    let media;
    if (msg.includes("http")) {
      media = await whatsappWeb.MessageMedia.fromUrl(msg);
    } else {
      try {
        media = await whatsappWeb.MessageMedia.fromFilePath("./files/" + msg);
      } catch (e) {
        console.log("File Not Found!!", e);
        media = "file was not found";
      }
    }
  
    return media;
  };

  async getMessages(): Promise<any[]> {
    // Implement logic to retrieve messages 
    // For example, return a list of messages
    const messages = []; // Replace with actual implementation
    return messages;
  }
}
