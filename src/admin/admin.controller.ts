import { Controller, Get, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getUsers(@Query() dto: { pageNo: number; pageSize: number }) {
    return this.adminService.getUsers(dto);
  }

  @Get('getPremiumUsers')
  async getPremiumUsers(@Query() dto: { pageNo: number; pageSize: number }) {
    return this.adminService.getPremiumUsers(dto);
  }


  //

  // @Get('getCompanies')
  // async getCompanies() {
  //   return this.adminService.getCompanies();
  // }
}
