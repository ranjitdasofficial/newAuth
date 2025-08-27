import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  // Get user's maintenance fee details (main endpoint for frontend)
  @Get('user/:userId')
  async getUserMaintenanceDetails(@Param('userId') userId: string) {
    try {
      const details = await this.maintenanceService.getUserMaintenanceDetails(userId);
      
      // Transform data to match frontend expectations
      return {
        user: {
          id: details.user.id,
          name: details.user.name,
          email: details.user.email,
          isPremium: details.user.isPremium,
          maintenanceFeeDue: details.user.maintenanceFeeDue,
          lastMaintenancePayment: details.user.lastMaintenancePayment
        },
        currentMonthFee: details.monthsNeedingFees.find(fee => 
          fee.month === details.currentMonth
        ) || null,
        totalOverdue: details.feeSummary.totalOverdue,
        overdueFees: details.feeSummary.overdueAmount,
        feeHistory: details.detailedHistory,
        // Additional fields for enhanced functionality
        monthsNeedingFees: details.monthsNeedingFees,
        totalAmountDue: details.totalAmountDue,
        hasPendingFees: details.hasPendingFees,
        currentMonth: details.currentMonth,
        // Premium requirement info
        isPremiumRequired: details.isPremiumRequired || false,
        message: details.message || null
      };
    } catch (error) {
      throw error;
    }
  }

  // Process maintenance fee payment
  @Post('payment')
  async processMaintenancePayment(@Body() paymentData: {
    userId: string;
    paymentId: string;
    orderId: string;
    amount: number;
  }) {
    try {
      const result = await this.maintenanceService.processMaintenancePayment(
        paymentData.userId,
        paymentData.paymentId,
        paymentData.orderId,
        paymentData.amount
      );

      return {
        success: true,
        message: result.message,
        paidAmount: result.paidAmount,
        remainingAmount: result.remainingAmount,
        paidFees: result.paidFees,
        lastMaintenancePayment: result.lastMaintenancePayment,
        paidMonths: result.paidMonths
      };
    } catch (error) {
      throw error;
    }
  }

  // Get user payment history
  @Get('payment-history/:userId')
  async getUserPaymentHistory(@Param('userId') userId: string) {
    try {
      const history = await this.maintenanceService.getUserPaymentHistory(userId);
      
      // Transform to match frontend PaymentRecord interface
      const transformedPayments = history.payments.map(payment => ({
        id: payment.id,
        type: payment.type,
        amount: payment.amount,
        status: payment.status,
        date: payment.date,
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpayOrderId: payment.razorpayOrderId,
        // Add month and year for maintenance fees
        ...(payment.type === 'maintenance' && {
          month: payment.month,
          year: payment.year
        })
      }));

      return {
        success: true,
        payments: transformedPayments,
        totalPayments: transformedPayments.length,
        maintenancePayments: history.maintenancePayments,
        subscriptionPayments: history.subscriptionPayments
      };
    } catch (error) {
      throw error;
    }
  }

  // Quick check if user needs maintenance payment
  @Get('needs-payment/:userId')
  async doesUserNeedMaintenancePayment(@Param('userId') userId: string) {
    try {
      const needsPayment = await this.maintenanceService.doesUserNeedMaintenancePayment(userId);
      return {
        needsPayment,
        message: needsPayment ? 'User has pending maintenance fees' : 'No maintenance fees due'
      };
    } catch (error) {
      throw error;
    }
  }

  // Get current month maintenance status
  @Get('current-month/:userId')
  async getCurrentMonthMaintenanceStatus(@Param('userId') userId: string) {
    try {
      const status = await this.maintenanceService.getCurrentMonthMaintenanceStatus(userId);
      return status;
    } catch (error) {
      throw error;
    }
  }

  // Calculate maintenance fee status (detailed calculation)
  @Get('calculate-status/:userId')
  async calculateMaintenanceFeeStatus(@Param('userId') userId: string) {
    try {
      const status = await this.maintenanceService.calculateMaintenanceFeeStatus(userId);
      return status;
    } catch (error) {
      throw error;
    }
  }

  // Generate maintenance fee for a specific month (admin/manual use)
  @Post('generate-fee')
  async generateFeeForMonth(@Body() data: {
    userId: string;
    month: string;
    year: number;
  }) {
    try {
      const fee = await this.maintenanceService.generateFeeForMonth(
        data.userId,
        data.month,
        data.year
      );

      return {
        success: true,
        message: 'Maintenance fee generated successfully',
        fee: fee
      };
    } catch (error) {
      throw error;
    }
  }

  // Get maintenance fee summary for admin
  @Get('summary')
  async getMaintenanceFeeSummary() {
    try {
      const summary = await this.maintenanceService.getMaintenanceFeeSummary();
      return {
        success: true,
        summary: summary
      };
    } catch (error) {
      throw error;
    }
  }

  // Health check endpoint
  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'maintenance',
      timestamp: new Date().toISOString()
    };
  }

  // Get maintenance fee by ID
  @Get('fee/:feeId')
  async getMaintenanceFeeById(@Param('feeId') feeId: string) {
    try {
      // This would need to be implemented in the service
      // For now, return a placeholder
      return {
        success: false,
        message: 'Method not implemented yet'
      };
    } catch (error) {
      throw error;
    }
  }

  // Update maintenance fee status (admin use)
  @Post('update-fee-status')
  async updateFeeStatus(@Body() data: {
    feeId: string;
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    notes?: string;
  }) {
    try {
      // This would need to be implemented in the service
      // For now, return a placeholder
      return {
        success: false,
        message: 'Method not implemented yet'
      };
    } catch (error) {
      throw error;
    }
  }

  // Get overdue fees for a user
  @Get('overdue/:userId')
  async getOverdueFees(@Param('userId') userId: string) {
    try {
      const details = await this.maintenanceService.getUserMaintenanceDetails(userId);
      const overdueFees = details.detailedHistory.filter(fee => 
        fee.status === 'OVERDUE'
      );

      return {
        success: true,
        overdueFees: overdueFees,
        totalOverdueAmount: overdueFees.reduce((sum, fee) => sum + fee.amount, 0),
        overdueCount: overdueFees.length
      };
    } catch (error) {
      throw error;
    }
  }

  // Get pending fees for a user
  @Get('pending/:userId')
  async getPendingFees(@Param('userId') userId: string) {
    try {
      const details = await this.maintenanceService.getUserMaintenanceDetails(userId);
      const pendingFees = details.detailedHistory.filter(fee => 
        fee.status === 'PENDING'
      );

      return {
        success: true,
        pendingFees: pendingFees,
        totalPendingAmount: pendingFees.reduce((sum, fee) => sum + fee.amount, 0),
        pendingCount: pendingFees.length
      };
    } catch (error) {
      throw error;
    }
  }

  // Get paid fees for a user
  @Get('paid/:userId')
  async getPaidFees(@Param('userId') userId: string) {
    try {
      const details = await this.maintenanceService.getUserMaintenanceDetails(userId);
      const paidFees = details.detailedHistory.filter(fee => 
        fee.status === 'PAID'
      );

      return {
        success: true,
        paidFees: paidFees,
        totalPaidAmount: paidFees.reduce((sum, fee) => sum + fee.amount, 0),
        paidCount: paidFees.length
      };
    } catch (error) {
      throw error;
    }
  }
} 