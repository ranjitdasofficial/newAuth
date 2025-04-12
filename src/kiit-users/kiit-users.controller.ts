import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
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
import { exit } from 'process';
import { JwtService } from '@nestjs/jwt';

const secure = 'Ranjit';

@Controller('kiitusers')
export class KiitUsersController {
  constructor(
    private readonly kiitUserService: KiitUsersService,
    private readonly jwtService: JwtService,
  ) { }

  @Post('registerUser')
  async registerUser(@Body() dto: KiitUserRegister) {
    console.log(dto);
    return this.kiitUserService.registerUser(dto);
  }



  

  @Get('getUserByEmail/:email')
  async getUserById(@Param('email') email: string) {
    console.log(email);
    return this.kiitUserService.getUserByEmail(email);
  }

  @Post('getUserByEmailByPassword')
  async getUserByIdByPassword(@Body('email') email: string, @Body('password') password: string) {
    return this.kiitUserService.getUserByEmailByPassword(email,password);
  }

  @Post('verifyTokenUser')
  async verifyTokenUser(@Body() dto: { token: string; email: string }) {
    try {
      console.log('Verification', dto);
      const verifyToken = await this.jwtService.verifyAsync(dto.token, {
        secret: 'Ranjit',
      });
      console.log(verifyToken);
      return verifyToken;
    } catch (error) {
      console.log(dto.email, error);
      throw new BadRequestException('Invalid Token');
    }
  }

  @Post('verifySession')
  async verifySession(@Body() dto: { email: string; token: string }) {
    return this.kiitUserService.verifyToken(dto.token, dto.email);
  }

  @Post('removeSiginToken')
  async removeSiginToken(@Body() dto: { email: string; token: string }) {
    console.log(dto);
    return this.kiitUserService.removeSiginToken(dto);
  }



  @Post('registerPremiumUser')
  async registerPremiumUser(@Body() dto: PremiumUserRegisterDto) {
    console.log(dto);
    return this.kiitUserService.registerPremiumUser(dto);
  }

  @Post("setPassword")
  async setPassword(@Body() dto: { email: string, password: string }) {
    return this.kiitUserService.setPassword(dto);
  }

  @Get('getUsers')
  async getAllPremiumUser() {
    return this.kiitUserService.getAllPremiumUser();
  }



  @Get('getNotPremiumUsers')
  async getNotPremiumUsers() {
    return this.kiitUserService.getNotPremiumUsers();
  }

  @Get('allUsers')
  async getAllUsers() {
    return this.kiitUserService.getAllUsers();
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
  async updatePremiumUser(@Body() dto: { userId: string,razorpay_payment_id:string,razorpay_order_id:string,razorpay_signature:string,plan:string }) {
    // console.log(dto)
    return this.kiitUserService.activatePremiumUser(dto.userId,dto.razorpay_payment_id,dto.razorpay_order_id,dto.razorpay_signature,dto.plan);
  }


  @Post('activateUserByEmail')
  async updatePremiumUserByEmail(@Body() dto: { email: string,razorpay_payment_id:string,razorpay_order_id:string,razorpay_signature:string }) {
    console.log(dto)
    return this.kiitUserService.activatePremiumUserByEmail(dto.email,dto.razorpay_payment_id,dto.razorpay_order_id,dto.razorpay_signature);
  }


  @Post('deactivateUser')
  async deactivateUser(@Body() dto: { userId: string }) {
    return this.kiitUserService.deactivateUser(dto.userId);
  }

  @Get('activateAll')
  async activateAll() {
    return this.kiitUserService.activateAll();
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

  @Get('getpremiumWithoutPaymentScreenshot')
  async getPremiumUserWithPaymentStatus() {
    return this.kiitUserService.getPremiumUserWithoutPaymentScreenshot();
  }

  @Get('sendPaymentReminder')
  async sendPaymentReminder() {
    return this.kiitUserService.sendRemainderMail();
  }

  @Get('getUserWithoutPremium')
  async getUserWithoutPremium() {
    return this.kiitUserService.getUserWithoutPremiumAccount();
  }

  @Get('sendMailToNonPremiumUser')
  async sendMailToNonPremiumUser() {
    return this.kiitUserService.sendMailToUserWithoutPremiumAccount();
  }

  @Get('addTotalEarnedToAllUsers')
  async addTotalEarnedToAllUsers() {
    return this.kiitUserService.addTotalEarnedToAllUsers();
  }

  @Get('sendTestMail')
  async sendTestMail() {
    return this.kiitUserService.sendTestMail();
  }

  @Get('filteruser')
  async filterUser() {
    return this.kiitUserService.filterUser();
  }

  @Get('sendMailToNonKiitconnectUser')
  async sendMailToNonKiitconnectUser() {
    return this.kiitUserService.sendMailToNonKiitConnectUser();
  }

  @Get('sendMailToNonKiitconnectUser4thsem')
  async sendMailToNonKiitconnectUser4thsem() {
    return this.kiitUserService.sendTo4thSem();
  }

  @Get('sendMailToNonRegisteredUser')
  async sendMailToNonRegisteredUser() {
    return this.kiitUserService.sendMailToNonregisteredUser();
  }

  @Get('sendMailToAvoidBlockage')
  async sendMailToAvoidBlockage() {
    return this.kiitUserService.sendMailAvoidBlockge();
  }

  @Get('testMails')
  async testMails() {
    return this.kiitUserService.testMails();
  }

  @Get('print200user')
  async print200thuser() {
    const users = [];

    for (var i = 0; i < users.length; i++) {
      if (i === 200) {
        console.log(users[i].email);
        exit;
      }
    }
  }

  @Get('getKeys')
  async getKeys() {
    return this.kiitUserService.testCacheService();
  }

  @Post('generateDeviceResetToken')
  async generateDeviceResetToken(@Body('email') email: string) {
    console.log(email);
    return this.kiitUserService.generateResetDeviceToken(email);
  }

  @Get('checkTokenAndReset')
  async checkTokenAndReset(@Query('token') token: string) {
    console.log(token);
    return this.kiitUserService.checkTokenAndResetDevice(token);
  }

  @Get('resetLoginAdmin')
  async resetLoginAdmin(@Query('email') email: string) {
    console.log(email);
    return this.kiitUserService.resetLoginAdmin(email);
  }

  @Get('updateUsers')
  async updateUsers() {
    return this.kiitUserService.updateUsers();
  }

  @Get('referral')
  async referral(@Query('userId') userId: string) {
    return this.kiitUserService.refralInfo(userId);
  }

  @Post('redeemRequest')
  async redeemRequest(
    @Body() dto: { userId: string; amount: number; upiId: string },
  ) {
    return this.kiitUserService.redeemRequest(dto);
  }

  @Get('getRedeemRequest')
  async getRedeemRequest(@Query('userId') userId: string) {
    return this.kiitUserService.getRedeemRequest(userId);
  }

  @Get('getUnknow')
  async getUnknow() {
    return this.kiitUserService.getUnknow();
  }

  @Get('getTotalRedeemRequest')
  async getTotalRedeemRequest() {
    return this.kiitUserService.getTotalRedeemRequest();
  }

  @Post('testUploadFiles')
  @UseInterceptors(FileInterceptor('image'))
  async TestUploadFiles(@UploadedFile() file: Express.Multer.File) {
    console.log(file);

    if (file) {
      await this.checkIfImage(file);
    }
    return this.kiitUserService.testUpload(file);
  }

  @Get('getPremiumWithoutPaid')
  async getPremiumWithoutPaid() {
    return this.kiitUserService.getPremiumWithoutPaid();
  }

  @Get('sendMailToPremiumButNotPayemnt')
  async sendMailToPremiumButNotPayemnt() {
    return this.kiitUserService.sendMailToPremiumButNotPaymentDone();
  }

  @Get('getPremiumUserAfter')
  async getPremiumUserAfter() {
    return this.kiitUserService.getPremiumUserAfter();
  }

  @Get('getPremiumUsers')
  async getPremiumUsers() {
    return this.kiitUserService.getPremiumUsers();
  }

  @Get('clearAllTokens')
  async clearAllTokens() {
    return this.kiitUserService.clearAllTokens();
  }

  @Get('getUserStatus')
  async getUserStatus(@Query('userId') userId: string) {
    return this.kiitUserService.getUserStatus(userId);
  }

  @Post('updateUserYear')
  async updateUserStatus(@Body() dto: { userId: string; year: string }) {
    return this.kiitUserService.updateUserStatus(dto);
  }

  @Get('enableDisabledUser')
  async enableDisabledUser() {
    return this.kiitUserService.enableDisabledUser();
  }

  @Get('/getUser/nonpremium')
  async getNonPremiumUser(@Query('roll') roll: string) {
    return this.kiitUserService.getNonPremiumUser(roll);
  }

  @Get('/getUser/premium')
  async getPremiumUser(@Query('roll') roll: string) {
    return this.kiitUserService.getPremiumUser(roll);
  }

  @Post('changeYear')
  async changeYear(@Body() dto: { userId: string; year: string }) {
    return this.kiitUserService.changeYear(dto);
  }

  @Get('getPremiumUserByYear')
  async getPremiumUserByYear(@Query('year') year: string) {
    return this.kiitUserService.getPremiumUserByYear(year);
  }

  @Get('removePremiumMembersByBatch')
  async removePremiumMembersByBatch(@Query() query: {
    dateBefore: string;
    batch: string;
  }) {
    return this.kiitUserService.removePremiumMembersByBatch(query.batch, query.dateBefore);
  }

  @Get('removePaymentScreenshot')
  async removePaymentScreenshot(@Query('email') email: string) {
    return this.kiitUserService.removePaymentScreenshot(email);
  }

  @Post("restorePremium")
  async restorePremium() {
    return this.kiitUserService.restorePremium();
  }

  @Post('getPremiumUserByYearN')
  async getPremiumUserByYearN(@Body() dto: { year: string }) {
    return this.kiitUserService.getPremiumUserByYearN(dto.year);
  }



  @Post('generateSignedUrlForUploadImage')
  async generateSignedUrlForUploadImage(@Body() dto: { filename: string, fileType: string }) {
    return this.kiitUserService.generateSignedUrlForUploadImage(dto);
  }

  @Post('saveScreenShotToDb')
  async saveScreenShotToDb(@Body() dto: { userId: string, fileId: string }) {
    return this.kiitUserService.saveScreenShotToDb(dto.userId, dto.fileId);
  }



  // ------------- Fetch all the orders of Razorpay -------------
  @Get('getAllOrders')
  async getAllOrders() {
    console.log("here getAllOrderCalled")
    return this.kiitUserService.getAllOrders();
  }


  // @Post("transferFile")
  // async transferFile() {
  //   return this.kiitUserService.transferFilesNotesFromGdriveToR2();
  // }

  @Post('securityViolated')
  async securityViolated(@Body() data: { userId: string }) {
    return this.kiitUserService.securityViolated(data);
  }

  @Get('getSecurityViolated')
  async getSecurityViolated() {
    return this.kiitUserService.getSecurityViolated();
  }
  
  

}
