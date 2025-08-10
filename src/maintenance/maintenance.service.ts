import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  // Generate monthly maintenance fees for all premium users on 13th of every month
  @Cron('0 0 13 * *') // Run at midnight on the 13th of every month
  async generateMonthlyMaintenanceFees() {
    try {
      console.log('Generating monthly maintenance fees for all users...');
      
      const currentDate = new Date();
      const month = currentDate.toISOString().slice(0, 7); // YYYY-MM format
      const year = currentDate.getFullYear();
      
      // Get all users (not just premium users - maintenance fee applies to all)
      const allUsers = await this.prisma.user.findMany({
        where: {
          // Include all users, not just premium
        }
      });

      console.log(`Processing ${allUsers.length} users for maintenance fees`);

      for (const user of allUsers) {
        try {
          // Check if maintenance fee already exists for this month
          const existingFee = await this.prisma.maintenanceFee.findFirst({
            where: {
              userId: user.id,
              month: month,
              year: year
            }
          });

          if (!existingFee) {
            // Set due date to 15th of the same month
            const dueDate = new Date(year, currentDate.getMonth(), 15);
            
            // Create maintenance fee record
            await this.prisma.maintenanceFee.create({
              data: {
                userId: user.id,
                amount: 10, // ₹10 maintenance fee
                dueDate: dueDate,
                month: month,
                year: year,
                status: 'PENDING',
                isOverdue: false
              }
            });

            // Update user's maintenance fee due amount
            await this.prisma.user.update({
              where: { id: user.id },
              data: {
                maintenanceFeeDue: {
                  increment: 10
                }
              }
            });

            console.log(`Generated maintenance fee for user ${user.email} (${user.id})`);
          } else {
            console.log(`Maintenance fee already exists for user ${user.email} for ${month}`);
          }
        } catch (userError) {
          console.error(`Error processing user ${user.email}:`, userError);
          // Continue with other users even if one fails
        }
      }

      console.log('Monthly maintenance fee generation completed');
    } catch (error) {
      console.error('Error generating monthly maintenance fees:', error);
    }
  }

  // Update overdue fees daily
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateOverdueFees() {
    try {
      console.log('Updating overdue maintenance fees...');
      
      const currentDate = new Date();
      
      // Find all pending fees that are overdue
      const overdueFees = await this.prisma.maintenanceFee.findMany({
        where: {
          status: 'PENDING',
          dueDate: {
            lt: currentDate
          }
        }
      });

      for (const fee of overdueFees) {
        const overdueDays = Math.floor((currentDate.getTime() - fee.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        await this.prisma.maintenanceFee.update({
          where: { id: fee.id },
          data: {
            status: 'OVERDUE',
            isOverdue: true,
            overdueDays: overdueDays
          }
        });

        console.log(`Updated overdue fee for user ${fee.userId}, overdue by ${overdueDays} days`);
      }

      console.log(`Updated ${overdueFees.length} overdue fees`);
    } catch (error) {
      console.error('Error updating overdue fees:', error);
    }
  }

  // Get user's maintenance fee details
  async getUserMaintenanceDetails(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          maintenanceFeeHistory: {
            orderBy: { createdAt: 'desc' },
            take: 12
          }
        }
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const currentDate = new Date();
      const currentMonth = currentDate.toISOString().slice(0, 7);
      const currentYear = currentDate.getFullYear();

      // Find current month fee
      const currentMonthFee = user.maintenanceFeeHistory.find(
        fee => fee.month === currentMonth && fee.year === currentYear
      );

      // Calculate pending fees (PENDING and OVERDUE status)
      const pendingFees = user.maintenanceFeeHistory.filter(
        fee => fee.status === 'PENDING' || fee.status === 'OVERDUE'
      );

      // Calculate total due from pending fees
      const maintenanceFeeDue = pendingFees.reduce((sum, fee) => sum + fee.amount, 0);

      // Update user's maintenanceFeeDue field to match actual pending fees
      if (user.maintenanceFeeDue !== maintenanceFeeDue) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { maintenanceFeeDue: maintenanceFeeDue }
        });
      }

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isPremium: user.isPremium,
          maintenanceFeeDue: maintenanceFeeDue,
          lastMaintenancePayment: user.lastMaintenancePayment
        },
        currentMonthFee: currentMonthFee || null,
        totalOverdue: pendingFees.filter(fee => fee.status === 'OVERDUE').length,
        overdueFees: pendingFees.filter(fee => fee.status === 'OVERDUE').reduce((sum, fee) => sum + fee.amount, 0),
        feeHistory: user.maintenanceFeeHistory
      };
    } catch (error) {
      console.error('Error getting user maintenance details:', error);
      throw new InternalServerErrorException('Failed to get maintenance details');
    }
  }

  // Process maintenance fee payment
  async processMaintenancePayment(userId: string, paymentId: string, orderId: string, amount: number) {
    try {
      const pendingFees = await this.prisma.maintenanceFee.findMany({
        where: {
          userId: userId,
          status: {
            in: ['PENDING', 'OVERDUE']
          }
        },
        orderBy: { dueDate: 'asc' }
      });

      if (pendingFees.length === 0) {
        throw new NotFoundException('No pending maintenance fees found');
      }

      let remainingAmount = amount;
      const paidFees = [];

      for (const fee of pendingFees) {
        if (remainingAmount >= fee.amount) {
          await this.prisma.maintenanceFee.update({
            where: { id: fee.id },
            data: {
              status: 'PAID',
              paidDate: new Date(),
              paymentId: paymentId,
              orderId: orderId,
              isOverdue: false,
              overdueDays: 0
            }
          });

          paidFees.push(fee);
          remainingAmount -= fee.amount;
        } else {
          break;
        }
      }

      const totalPaid = paidFees.reduce((sum, fee) => sum + fee.amount, 0);
      
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          maintenanceFeeDue: {
            decrement: totalPaid
          },
          lastMaintenancePayment: new Date()
        }
      });

      return {
        success: true,
        paidAmount: totalPaid,
        remainingAmount,
        paidFees: paidFees.length,
        message: `Successfully paid ${paidFees.length} maintenance fee(s)`
      };
    } catch (error) {
      console.error('Error processing maintenance payment:', error);
      throw new InternalServerErrorException('Failed to process maintenance payment');
    }
  }

  // Manual fee generation for testing
  async generateFeeForUser(userId: string, month: string, year: number) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.isPremium) {
        throw new Error('User is not premium');
      }

      const dueDate = new Date(year, parseInt(month.split('-')[1]) - 1, 15);
      
      const fee = await this.prisma.maintenanceFee.create({
        data: {
          userId: userId,
          amount: 10,
          dueDate: dueDate,
          month: month,
          year: year,
          status: 'PENDING'
        }
      });

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
      console.error('Error generating fee for user:', error);
      throw new InternalServerErrorException('Failed to generate fee for user');
    }
  }

  // Manual method to generate fees for a specific month (for testing)
  async generateFeesForMonth(month: string, year: number) {
    try {
      console.log(`Manually generating maintenance fees for ${month}-${year}...`);
      
      // Get all users
      const allUsers = await this.prisma.user.findMany();
      
      console.log(`Processing ${allUsers.length} users for maintenance fees`);

      const results = {
        totalUsers: allUsers.length,
        feesGenerated: 0,
        feesSkipped: 0,
        errors: 0
      };

      for (const user of allUsers) {
        try {
          // Check if maintenance fee already exists for this month
          const existingFee = await this.prisma.maintenanceFee.findFirst({
            where: {
              userId: user.id,
              month: month,
              year: year
            }
          });

          if (!existingFee) {
            // Set due date to 15th of the specified month
            const dueDate = new Date(year, parseInt(month.split('-')[1]) - 1, 15);
            
            // Create maintenance fee record
            await this.prisma.maintenanceFee.create({
              data: {
                userId: user.id,
                amount: 10, // ₹10 maintenance fee
                dueDate: dueDate,
                month: month,
                year: year,
                status: 'PENDING',
                isOverdue: false
              }
            });

            // Update user's maintenance fee due amount
            await this.prisma.user.update({
              where: { id: user.id },
              data: {
                maintenanceFeeDue: {
                  increment: 10
                }
              }
            });

            results.feesGenerated++;
            console.log(`Generated maintenance fee for user ${user.email} (${user.id})`);
          } else {
            results.feesSkipped++;
            console.log(`Maintenance fee already exists for user ${user.email} for ${month}`);
          }
        } catch (userError) {
          results.errors++;
          console.error(`Error processing user ${user.email}:`, userError);
        }
      }

      console.log(`Manual fee generation completed:`, results);
      return results;
    } catch (error) {
      console.error('Error generating fees for specific month:', error);
      throw new InternalServerErrorException('Failed to generate fees for specific month');
    }
  }

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
          },
          // Include subscription payment history from PremiumMember
          PremiumMember: {
            select: {
              createdAt: true,
              updatedAt: true
            }
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
        razorpayOrderId: fee.orderId
      }));

      // Get subscription payment history from user's premium status and payment info
      const subscriptionPayments = [];
      
      if (user.isPremium && user.paymentDate) {
        subscriptionPayments.push({
          id: `sub_${user.id}_${user.paymentDate.getTime()}`,
          type: 'subscription' as const,
          amount: 99, // Assuming ₹99 subscription fee
          status: 'success' as const,
          date: user.paymentDate,
          razorpayPaymentId: null, // We don't store this in user table
          razorpayOrderId: null
        });
      }

      // Combine and sort all payments by date (newest first)
      const allPayments = [...maintenancePayments, ...subscriptionPayments]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 20); // Limit to 20 most recent payments

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
} 