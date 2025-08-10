import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('user/:userId')
  async getUserMaintenanceDetails(@Param('userId') userId: string) {
    return this.maintenanceService.getUserMaintenanceDetails(userId);
  }

  @Post('payment')
  async processMaintenancePayment(@Body() paymentData: {
    userId: string;
    paymentId: string;
    orderId: string;
    amount: number;
  }) {
    return this.maintenanceService.processMaintenancePayment(
      paymentData.userId,
      paymentData.paymentId,
      paymentData.orderId,
      paymentData.amount
    );
  }

  @Post('generate-fee')
  async generateFeeForUser(@Body() data: {
    userId: string;
    month: string;
    year: number;
  }) {
    return this.maintenanceService.generateFeeForUser(
      data.userId,
      data.month,
      data.year
    );
  }

  @Get('payment-history/:userId')
  async getUserPaymentHistory(@Param('userId') userId: string) {
    return this.maintenanceService.getUserPaymentHistory(userId);
  }

  @Post('generate-monthly-fees')
  async generateMonthlyFees() {
    return this.maintenanceService.generateMonthlyMaintenanceFees();
  }

  @Post('update-overdue-fees')
  async updateOverdueFees() {
    return this.maintenanceService.updateOverdueFees();
  }

  @Post('generate-fees-for-month')
  async generateFeesForMonth(@Body() data: { month: string; year: number }) {
    return this.maintenanceService.generateFeesForMonth(data.month, data.year);
  }
} 