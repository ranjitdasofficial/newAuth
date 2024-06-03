// mail.service.ts
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as ejs from 'ejs';
import * as path from 'path';
import { MailerService } from '@nestjs-modules/mailer';



@Injectable()
export class MyMailService {
  constructor(private readonly mailService:MailerService){
    
  }

  async sendOtpVerificationEmail(to: string, otpCode: string,username:string,verifyLink:string) {
  
    const data = {
      username: username,
      otpCode: otpCode,
      verifyLink: verifyLink,
    };

    console.log(data);
    await this.mailService.sendMail({
      to: to,
      subject: 'Otp Verification',
      template: 'otp-verification', // Name of your template file without extension
      context: data,
    }).then((d)=>{
      console.log("Email Has been Sent",d);
    }).catch((err)=>{
      console.log(err);
    });



    



}

async sendPassReset(to: string, resetLink:string,username:string) {
 
  await this.mailService.sendMail({
    to: to,
    subject: 'Password Reset',
    template: 'reset-password', // Name of your template file without extension
    context: {
     username:username,
     resetLink:resetLink
    },
  }).then((d)=>{
    console.log("Eail Has been Sent",d);
  }).catch((err)=>{
    console.log(err);
  });
      
}

async sendAccountCreated(data:{email:string,name:string,branch:string,year:string,activateLink:string}) {
  await this.mailService.sendMail({
    to: data.email,
    subject: 'Account Created!',
    template: 'register-done', // Name of your template file without extension
    context:data,
  }).then(()=>{
    console.log("Email Has been Sent");
  }).catch((err)=>{
    console.log(err);
  });


}



async sendPaymentConfirmation(data:{email:string,name:string,branch:string,year:string,amount:string,paymentDate:string}) {
    await this.mailService.sendMail({
      to: data.email,
      subject: 'Payment Confirmation!',
      template: 'payment-confirmation', // Name of your template file without extension
      context:data,
    }).then(()=>{
      console.log("Email Has been Sent");
    }).catch((err)=>{
      console.log(err);
    });
  
  
  }


async sendAccountActivated(data:{email:string,name:string,branch:string,year:string}) {
    await this.mailService.sendMail({
      to: data.email,
      subject: 'Account Activated',
      template: 'account-activated', // Name of your template file without extension
      context:data,
    }).then(()=>{
      console.log("Email Has been Sent");
    }).catch((err)=>{
      console.log(err);
    });
  
  
  }


async passwordChanged(to: string,username:string) {
  await this.mailService.sendMail({
    to: to,
    subject: 'Password Changed!',
    template: 'password-changed', // Name of your template file without extension
    context: {
     username:username,
   
    },
  }).then(()=>{
    console.log("Eail Has been Sent");
  }).catch((err)=>{
    console.log(err);
  });
}


async sendPaymentReminder(data:{email:string,name:string,branch:string,year:string}) {
  await this.mailService.sendMail({
    to: data.email,
    subject: 'Important: Activate Your Premium Membership',
    template: 'payment-remainder', // Name of your template file without extension
    context:data,
  }).then(()=>{ 
    console.log("Email Has been Sent");
  }).catch((err)=>{
    console.log(err);
  }); 
}


async sendNotPremium(name:string,email:string,index:number){
  if(!email){
    return;
  }
  await this.mailService.sendMail({
    to: email,
    subject: 'Your Myperfectice assignment is pending!',
    // template: 'not-premium', // Name of your template file without extension
    template: 'non-registered', // Name of your template file without extension
    context:{
      name:name
    },
  }).then(()=>{
    console.log("Email Has been Sent",index,email,name);
  } 
  ).catch((err)=>{
    console.log(err);
  });

}



async sendNonRegistered(email:string,index:number){
  if(!email){
    return;
  }
  await this.mailService.sendMail({
    to: email,
    subject: 'Access Your Premium Membership Now!',
    // template: 'not-premium', // Name of your template file without extension
    template: 'non-registered', // Name of your template file without extension
    
  }).then(()=>{
    console.log("Email Has been Sent",index,email);
  } 
  ).catch((err)=>{
    console.log(err);
  });

}




async sendMailToNonKiitconnectUser(name:string,email:string,index:number){
  if(!email){
    return;
  }
  await this.mailService.sendMail({
    to: email,
    subject: 'KIIT-CONNECT - Registration is closing tonight!',
    template: 'non-registered', // Name of your template file without extension
    context:{
      name:name
    },
  }).then(()=>{
    console.log("Email Has been Sent",index);
  } 
  ).catch((err)=>{
    console.log(err);
  });

}
async sendMailToNonKiitconnectUserSem4(email:string,index:number){
  if(!email){
    return;
  }
  await this.mailService.sendMail({
    to: email,
    subject: 'Access well structured Pyqs/Solution and Notes.Are you still thinking?',
    template: '2nd-sem', // Name of your template file without extension
  }).then(()=>{
    console.log("Email Has been Sent",index);
  } 
  ).catch((err)=>{
    console.log(err);
  });

}



async sendResetDeviceLoginMail(email:string,name:string,link:string){
  if(!email || !name || !link){
    return;
  }
  
  await this.mailService.sendMail({
    to: email,
    subject: 'Reset Device Login Requested!',
    template: 'reset-device', // Name of your template file without extension
    context:{
      name:name,
      resetLink:link
    }
  }).then(()=>{
    console.log("Email Has been Sent",email);
  } 
  ).catch((err)=>{
    console.log(err);
  });

}



//swapping 

async sendMailToSwapFound(
  matchedUserName: string,
  matchedUserEmail: string,
  matchedUserContact: string,
  senderName: string,
  currentAlloted: number,
  currentLookingFor: number[],
  remoteAlloted: number,
  remoteLookingFor: number[]
) {
  const data = {
    matchedUserName: matchedUserName,
    matchedUserEmail: matchedUserEmail,
    matchedUserContact: matchedUserContact,
    senderName: senderName,
    currentAlloted: currentAlloted,
    currentLookingFor: currentLookingFor,
    remoteAlloted: remoteAlloted,
    remoteLookingFor: remoteLookingFor,
  };

  console.log(data);
  await this.mailService
    .sendMail({
      to: matchedUserEmail,
      subject: "Match Found For Section Swapping",
      template: "matchFound", // Name of your template file without extension
      context: data,
    })
    .then((d) => {
      console.log("Email Has been Sent", d);
    })
    .catch((err) => {
      console.log(err);
    });
}
async sendMailToRemoveProfileByUser(senderEmail: string, senderName: string) {
  const data = {
    senderName: senderName,
  };

  console.log(data);
  await this.mailService
    .sendMail({
      to: senderEmail,
      subject: "Match Removed",
      template: "match-removal", // Name of your template file without extension
      context: data,
    })
    .then((d) => {
      console.log("Email Has been Sent", d);
    })
    .catch((err) => {
      console.log(err);
    });
}
async sendMailToUnmatchedUser(senderEmail: string, senderName: string) {
  const data = {
    senderName: senderName,
  };

  console.log(data);
  await this.mailService
    .sendMail({
      to: senderEmail,
      subject: "Profile Removed",
      template: "profile-removed", // Name of your template file without extension
      context: data,
    })
    .then((d) => {
      console.log("Email Has been Sent", d);
    })
    .catch((err) => {
      console.log(err);
    });
}

async sendMailToAvoidBlockage(data:{email:string,name:string,branch:string,year:string}) {
  await this.mailService.sendMail({
    to: data.email,
    subject: 'Important: Activate Your Premium Membership-Avoid Blockage',
    template: 'block', // Name of your template file without extension
    context:data,
  }).then(()=>{ 
    console.log("Email Has been Sent");
  }).catch((err)=>{
    console.log(err);
  }); 
}



}