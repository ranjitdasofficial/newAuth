import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { KiitUsersService } from './kiit-users.service';
import {
  KiitUserRegister,
  PremiumUserRegisterDto,
} from './dto/KiitUserRegister.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import axios from 'axios';
import jsPDF from 'jspdf';

import cheerio from 'cheerio';
import { createCanvas, loadImage } from 'canvas';

@Controller('kiitusers')
export class KiitUsersController {
  constructor(private readonly kiitUserService: KiitUsersService) {}

  @Post('registerUser')
  async registerUser(@Body() dto: KiitUserRegister) {
    return this.kiitUserService.registerUser(dto);
  }

  @Get('getUserByEmail/:email')
  async getUserById(@Param('email') email: string) {
    return this.kiitUserService.getUserByEmail(email);
  }

  @Post('registerPremiumUser')
  async registerPremiumUser(@Body() dto: PremiumUserRegisterDto) {
    console.log(dto);
    return this.kiitUserService.registerPremiumUser(dto);
  }

  @Get('getUsers')
  async getAllPremiumUser() {
    return this.kiitUserService.getAllPremiumUser();
  }

  @Get('getPremiumUserById/:userId')
  async getPremiumUserById(@Param('userId') userId: string) {
    return this.kiitUserService.getPremiumUserById(userId);
  }

  @Post('savePaymentScreenshot')
  @UseInterceptors(FileInterceptor('image'))
  async updatePayment(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: { userId: string },
  ) {
    console.log(file, dto);

    if (file) {
      await this.checkIfImage(file);
    }
    return this.kiitUserService.savePayemntScreenshot(dto.userId, file);
  }

  @Post('activateUser')
  async updatePremiumUser(@Body() dto: { userId: string }) {
    return this.kiitUserService.activatePremiumUser(dto.userId);
  }

  async checkIfImage(fileInfo: {
    mimetype: string;
    path: string;
  }): Promise<void> {
    if (!fileInfo.mimetype.startsWith('image/')) {
      fs.unlinkSync(fileInfo.path);
      throw new BadRequestException('File is not an image.');
    }
  }
}
