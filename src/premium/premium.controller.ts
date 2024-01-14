import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { PremiumService } from './premium.service';
import { GetUserDto, PremiumUserRegister } from './dto/dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { DriveService } from 'src/drive.service';

import * as fs from 'fs';
import { SuperAdmin } from 'src/auth/guard/superAdmin.guard';

@Controller('premium')
export class PremiumController {
    constructor(private readonly premiumService:PremiumService,private readonly driveService:DriveService) { }

    @Get('getUser')
    getPremium(@Query("email") email:string){
        return this.premiumService.getUserPremium(email);
    }

    @Post('createUser')
    createPremium(@Body() dto: PremiumUserRegister){
        console.log("hello")
        return this.premiumService.createPremiumMember(dto);
    }

    
  @Post('upload')
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(@UploadedFile() file: Express.Multer.File,@Query("email") email:string) {
   return this.premiumService.uploadPaymentScreentShot(file,email);
  }

  @UseGuards(SuperAdmin)
  @Get('activateUser')
    activateUser(@Query("email") email:string){
        return this.premiumService.activatePremium(email);
    }

    // @UseGuards(SuperAdmin)
    @Get("getPremiumUserWithPayment")
    getPremiumUserWithPayment(){
      return this.premiumService.getPremiumUserWithPaymentScreenshot();
    }
}
 