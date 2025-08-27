import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  // Calculate maintenance fee status for a user based on current date and user details
  async calculateMaintenanceFeeStatus(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          maintenanceFeeHistory: {
            orderBy: { month: 'desc' },
            take: 24 // Last 2 years
          }
        }
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user is premium - only premium users need to pay maintenance fees
      if (!user.isPremium) {
        // Non-premium users don't have maintenance fees
        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            isPremium: user.isPremium,
            maintenanceFeeDue: 0,
            lastMaintenancePayment: user.lastMaintenancePayment,
            premiumPurchasedThisMonth: false
          },
          currentMonth: new Date().toISOString().slice(0, 7),
          monthsNeedingFees: [],
          totalAmountDue: 0,
          hasPendingFees: false,
          feeHistory: user.maintenanceFeeHistory,
          isPremiumRequired: true,
          message: 'Premium subscription required for maintenance fees'
        };
      }

      const currentDate = new Date();
      const currentMonth = currentDate.toISOString().slice(0, 7); // YYYY-MM format
      const currentYear = currentDate.getFullYear();
      const currentMonthNumber = currentDate.getMonth(); // 0-11

      // Check if user purchased premium this month
      const premiumPurchasedThisMonth = user.paymentDate && 
        user.paymentDate.getMonth() === currentMonthNumber &&
        user.paymentDate.getFullYear() === currentYear;

      // Find the last maintenance payment
      const lastMaintenancePayment = user.lastMaintenancePayment;
      
      // Check if last maintenance payment was for this month
      const lastPaymentThisMonth = lastMaintenancePayment &&
        lastMaintenancePayment.getMonth() === currentMonthNumber &&
        lastMaintenancePayment.getFullYear() === currentYear;

      // Calculate which months need maintenance fees
      const monthsNeedingFees = [];
      let totalAmountDue = 0;

      // Start from the month after the last maintenance payment, or current month if no payment
      let startMonth = lastMaintenancePayment ? 
        new Date(lastMaintenancePayment.getFullYear(), lastMaintenancePayment.getMonth() + 1, 1) :
        new Date(currentYear, currentMonthNumber, 1);

      // If user purchased premium this month, they still need to pay maintenance for this month
      if (premiumPurchasedThisMonth) {
        startMonth = new Date(currentYear, currentMonthNumber, 1);
      }

      // Generate fees for all months from start month to current month
      let currentMonthIterator = new Date(startMonth);
      
      while (currentMonthIterator <= currentDate) {
        const monthKey = currentMonthIterator.toISOString().slice(0, 7);
        const monthNumber = currentMonthIterator.getMonth();
        const yearNumber = currentMonthIterator.getFullYear();

        // Check if fee already exists for this month
        const existingFee = user.maintenanceFeeHistory.find(
          fee => fee.month === monthKey && fee.year === yearNumber
        );

        if (!existingFee) {
          // Calculate due date (15th of the month)
          const dueDate = new Date(yearNumber, monthNumber, 15);
          const isOverdue = dueDate < currentDate;
          
          monthsNeedingFees.push({
            month: monthKey,
            year: yearNumber,
            monthName: currentMonthIterator.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            dueDate: dueDate,
            amount: 10,
            isOverdue: isOverdue,
            overdueDays: isOverdue ? Math.floor((currentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
          });
          
          totalAmountDue += 10;
        }

        // Move to next month
        currentMonthIterator.setMonth(currentMonthIterator.getMonth() + 1);
      }

      // Update user's maintenance fee due amount
      if (user.maintenanceFeeDue !== totalAmountDue) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { maintenanceFeeDue: totalAmountDue }
        });
      }

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isPremium: user.isPremium,
          maintenanceFeeDue: totalAmountDue,
          lastMaintenancePayment: user.lastMaintenancePayment,
          premiumPurchasedThisMonth: premiumPurchasedThisMonth
        },
        currentMonth: currentMonth,
        monthsNeedingFees: monthsNeedingFees,
        totalAmountDue: totalAmountDue,
        hasPendingFees: totalAmountDue > 0,
        feeHistory: user.maintenanceFeeHistory
      };
    } catch (error) {
      console.error('Error calculating maintenance fee status:', error);
      throw new InternalServerErrorException('Failed to calculate maintenance fee status');
    }
  }

  // Get user's maintenance fee details (enhanced version)
  async getUserMaintenanceDetails(userId: string) {
    try {
      const feeStatus = await this.calculateMaintenanceFeeStatus(userId);
      
      // Get detailed fee history
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          maintenanceFeeHistory: {
            orderBy: { month: 'desc' },
            take: 24
          }
        }
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Categorize fees by status
      const pendingFees = user.maintenanceFeeHistory.filter(
        fee => fee.status === 'PENDING' || fee.status === 'OVERDUE'
      );

      const paidFees = user.maintenanceFeeHistory.filter(
        fee => fee.status === 'PAID'
      );

      const overdueFees = user.maintenanceFeeHistory.filter(
        fee => fee.status === 'OVERDUE'
      );

      return {
        ...feeStatus,
        feeSummary: {
          totalPending: pendingFees.length,
          totalPaid: paidFees.length,
          totalOverdue: overdueFees.length,
          overdueAmount: overdueFees.reduce((sum, fee) => sum + fee.amount, 0)
        },
        detailedHistory: user.maintenanceFeeHistory
      };
    } catch (error) {
      console.error('Error getting user maintenance details:', error);
      throw new InternalServerErrorException('Failed to get maintenance details');
    }
  }

  // Process maintenance fee payment
  async processMaintenancePayment(userId: string, paymentId: string, orderId: string, amount: number) {
    try {
      // Get current fee status
      const feeStatus = await this.calculateMaintenanceFeeStatus(userId);
      
      // Check if user is premium
      if (feeStatus.isPremiumRequired) {
        throw new Error('Premium subscription required to pay maintenance fees');
      }
      
      if (feeStatus.totalAmountDue === 0) {
        throw new NotFoundException('No pending maintenance fees found');
      }

      if (amount < feeStatus.totalAmountDue) {
        throw new Error(`Insufficient payment amount. Required: ${feeStatus.totalAmountDue}, Provided: ${amount}`);
      }

      // Process payment for all pending months
      const paidFees = [];
      let remainingAmount = amount;

             for (const monthFee of feeStatus.monthsNeedingFees) {
         // Check if fee record already exists
         const existingFee = await this.prisma.maintenanceFee.findFirst({
           where: {
             userId: userId,
             month: monthFee.month,
             year: monthFee.year
           }
         });

         let feeRecord;
         if (existingFee) {
           // Update existing fee record
           feeRecord = await this.prisma.maintenanceFee.update({
             where: { id: existingFee.id },
             data: {
               status: 'PAID',
               paidDate: new Date(),
               paymentId: paymentId,
               orderId: orderId,
               isOverdue: false,
               overdueDays: 0
             }
           });
         } else {
           // Create new fee record
           feeRecord = await this.prisma.maintenanceFee.create({
             data: {
               userId: userId,
               amount: monthFee.amount,
               dueDate: monthFee.dueDate,
               month: monthFee.month,
               year: monthFee.year,
               status: 'PAID',
               paidDate: new Date(),
               paymentId: paymentId,
               orderId: orderId,
               isOverdue: false,
               overdueDays: 0
             }
           });
         }

        paidFees.push(feeRecord);
        remainingAmount -= monthFee.amount;
      }

      // Update user's maintenance fee details
      const lastPaymentDate = new Date();
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          maintenanceFeeDue: 0,
          lastMaintenancePayment: lastPaymentDate
        }
      });

      return {
        success: true,
        paidAmount: amount - remainingAmount,
        remainingAmount: remainingAmount,
        paidFees: paidFees.length,
        lastMaintenancePayment: lastPaymentDate,
        message: `Successfully paid maintenance fees for ${paidFees.length} month(s)`,
        paidMonths: paidFees.map(fee => fee.month)
      };
    } catch (error) {
      console.error('Error processing maintenance payment:', error);
      throw new InternalServerErrorException('Failed to process maintenance payment');
    }
  }

  // Generate maintenance fee for a specific month (for manual operations)
  async generateFeeForMonth(userId: string, month: string, year: number) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if fee already exists
      const existingFee = await this.prisma.maintenanceFee.findFirst({
        where: {
          userId: userId,
          month: month,
          year: year
        }
      });

      if (existingFee) {
        throw new Error('Maintenance fee already exists for this month');
      }

      // Set due date to 15th of the month
      const dueDate = new Date(year, parseInt(month.split('-')[1]) - 1, 15);
      
      const fee = await this.prisma.maintenanceFee.create({
        data: {
          userId: userId,
          amount: 10,
          dueDate: dueDate,
          month: month,
          year: year,
          status: 'PENDING',
          isOverdue: false
        }
      });

      // Update user's maintenance fee due amount
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          maintenanceFeeDue: {
            increment: 10
          }
        }
      });

      return fee;
    } catch (error) {
      console.error('Error generating fee for month:', error);
      throw new InternalServerErrorException('Failed to generate fee for month');
    }
  }

  // Get user payment history
  async getUserPaymentHistory(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          maintenanceFeeHistory: {
            where: {
              status: 'PAID'
            },
            orderBy: { paidDate: 'desc' },
            take: 20
          }
        }
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Convert maintenance fees to payment records
      const maintenancePayments = user.maintenanceFeeHistory.map(fee => ({
        id: fee.id,
        type: 'maintenance' as const,
        amount: fee.amount,
        status: 'success' as const,
        date: fee.paidDate || fee.createdAt,
        razorpayPaymentId: fee.paymentId,
        razorpayOrderId: fee.orderId,
        month: fee.month,
        year: fee.year
      }));

      // Get subscription payment history
      const subscriptionPayments = [];
      
      if (user.isPremium && user.paymentDate) {
        subscriptionPayments.push({
          id: `sub_${user.id}_${user.paymentDate.getTime()}`,
          type: 'subscription' as const,
          amount: 99, // Assuming ₹99 subscription fee
          status: 'success' as const,
          date: user.paymentDate,
          razorpayPaymentId: null,
          razorpayOrderId: null
        });
      }

      // Combine and sort all payments by date (newest first)
      const allPayments = [...maintenancePayments, ...subscriptionPayments]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 20);

      return {
        success: true,
        payments: allPayments,
        totalPayments: allPayments.length,
        maintenancePayments: maintenancePayments.length,
        subscriptionPayments: subscriptionPayments.length
      };
    } catch (error) {
      console.error('Error fetching user payment history:', error);
      throw new InternalServerErrorException('Failed to fetch payment history');
    }
  }

  // Get maintenance fee summary for admin
  async getMaintenanceFeeSummary() {
    try {
      const users = await this.prisma.user.findMany({
        include: {
          maintenanceFeeHistory: {
            where: {
              status: {
                in: ['PENDING', 'OVERDUE']
              }
            }
          }
        }
      });

      const summary = {
        totalUsers: users.length,
        usersWithPendingFees: 0,
        totalPendingAmount: 0,
        usersWithOverdueFees: 0,
        totalOverdueAmount: 0
      };

      for (const user of users) {
        const feeStatus = await this.calculateMaintenanceFeeStatus(user.id);
        
        if (feeStatus.totalAmountDue > 0) {
          summary.usersWithPendingFees++;
          summary.totalPendingAmount += feeStatus.totalAmountDue;
        }

        const overdueFees = user.maintenanceFeeHistory.filter(fee => fee.status === 'OVERDUE');
        if (overdueFees.length > 0) {
          summary.usersWithOverdueFees++;
          summary.totalOverdueAmount += overdueFees.reduce((sum, fee) => sum + fee.amount, 0);
        }
      }

      return summary;
    } catch (error) {
      console.error('Error getting maintenance fee summary:', error);
      throw new InternalServerErrorException('Failed to get maintenance fee summary');
    }
  }

  // Quick check if user needs to pay maintenance fees
  async doesUserNeedMaintenancePayment(userId: string): Promise<boolean> {
    try {
      const feeStatus = await this.calculateMaintenanceFeeStatus(userId);
      
      // Only premium users need to pay maintenance fees
      if (feeStatus.isPremiumRequired) {
        return false;
      }
      
      return feeStatus.hasPendingFees;
    } catch (error) {
      console.error('Error checking if user needs maintenance payment:', error);
      return false;
    }
  }

  // Get current month maintenance fee status
  async getCurrentMonthMaintenanceStatus(userId: string) {
    try {
      const feeStatus = await this.calculateMaintenanceFeeStatus(userId);
      const currentDate = new Date();
      const currentMonth = currentDate.toISOString().slice(0, 7);
      
      // Check if premium is required
      if (feeStatus.isPremiumRequired) {
        return {
          currentMonth: currentMonth,
          needsPayment: false,
          feeDetails: null,
          totalPending: 0,
          lastPayment: feeStatus.user.lastMaintenancePayment,
          isPremiumRequired: true,
          message: 'Premium subscription required for maintenance fees'
        };
      }
      
      const currentMonthFee = feeStatus.monthsNeedingFees.find(
        fee => fee.month === currentMonth
      );

      return {
        currentMonth: currentMonth,
        needsPayment: !!currentMonthFee,
        feeDetails: currentMonthFee || null,
        totalPending: feeStatus.totalAmountDue,
        lastPayment: feeStatus.user.lastMaintenancePayment,
        isPremiumRequired: false
      };
    } catch (error) {
      console.error('Error getting current month maintenance status:', error);
      throw new InternalServerErrorException('Failed to get current month maintenance status');
    }
  }
} 