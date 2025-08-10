import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';

import axios from "axios";

import * as crypto from "crypto";
import { KiitUsersService } from 'src/kiit-users/kiit-users.service';
import { MyMailService } from 'src/mail.service';
import { PrismaService } from 'src/prisma.service';
import { MaintenanceService } from 'src/maintenance/maintenance.service';

@Injectable()
export class PaymentService {

    constructor(
        private readonly mailService: MyMailService, 
        private readonly prisma: PrismaService,
        private readonly maintenanceService: MaintenanceService
    ) { }

    // PhonePe Integration
    async createOrder(reqData: {
        transactionId: string;
        name: string;
        amount: number;
        phone: string;
    }) {
        try {
            let salt_key = "3b97ddb4-f59a-4d5f-ae6f-c6493d0d65ff";
            let merchant_id = "M22RQ5R6E7ME5";

            let merchantTransactionId = reqData.transactionId;

            const data = {
                merchantId: merchant_id,
                merchantTransactionId: merchantTransactionId,
                name: reqData.name,
                amount: reqData.amount * 100,
                redirectUrl: `https://kiitconnect.com/checking-payment-status?id=${merchantTransactionId}`,
                redirectMode: "POST",
                callbackUrl: `https://kiitconnect.com/api/checking-payment-status?id=${merchantTransactionId}`,
                mobileNumber: reqData.phone,
                paymentInstrument: {
                    type: "PAY_PAGE",
                },
            };

            const payload = JSON.stringify(data);
            const payloadMain = Buffer.from(payload).toString("base64");
            const keyIndex = 1;
            const string = payloadMain + "/pg/v1/pay" + salt_key;
            const sha256 = crypto.createHash("sha256").update(string).digest("hex");
            const checksum = sha256 + "###" + keyIndex;

            const prod_URL = "https://api.phonepe.com/apis/hermes/pg/v1/pay";

            const options = {
                method: "POST",
                url: prod_URL,
                headers: {
                    accept: "application/json",
                    "Content-Type": "application/json",
                    "X-VERIFY": checksum,
                },
                data: {
                    request: payloadMain,
                },
            };

            const response = await axios(options);
            console.log(response.data);

            return response.data;
        } catch (error) {
            console.log(error);
            return {
                status: 500,
                message: "Payment failed",
            };
        }
    }

    // RazorPay Integration
    async createRazorpayOrder(reqData: {
        amount: number;
        type: 'subscription' | 'maintenance';
        userDetails: {
            name: string;
            email: string;
            userId: string;
        };
    }) {
        try {
            const RAZORPAY_KEY = process.env.RAZORPAY_KEY;
            const RAZORPAY_SECRET = process.env.RAZORPAY_SECRET;

            if (!RAZORPAY_KEY || !RAZORPAY_SECRET) {
                throw new Error('RazorPay credentials not configured');
            }

            // Create order using RazorPay API
            const response = await axios.post('https://api.razorpay.com/v1/orders', {
                amount: reqData.amount * 100, // Convert to paise
                currency: 'INR',
                receipt: `receipt_${Date.now()}`,
                notes: {
                    type: reqData.type,
                    userId: reqData.userDetails.userId,
                    description: reqData.type === 'subscription' ? 'Premium Subscription' : 'Monthly Maintenance Fee'
                }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY}:${RAZORPAY_SECRET}`).toString('base64')}`
                }
            });

            console.log('RazorPay order created:', response.data);

            return {
                success: true,
                orderId: response.data.id,
                message: 'Order created successfully'
            };
        } catch (error) {
            console.error('Error creating RazorPay order:', error);
            throw new InternalServerErrorException('Failed to create RazorPay order');
        }
    }

    async verifyRazorpayPayment(reqData: {
        paymentId: string;
        orderId: string;
        signature: string;
        userId: string;
    }) {
        try {
            const RAZORPAY_SECRET = process.env.RAZORPAY_SECRET;

            if (!RAZORPAY_SECRET) {
                throw new Error('RazorPay secret not configured');
            }

            // Verify signature
            const text = reqData.orderId + '|' + reqData.paymentId;
            const signature = crypto
                .createHmac('sha256', RAZORPAY_SECRET)
                .update(text)
                .digest('hex');

            if (signature !== reqData.signature) {
                console.error('Signature verification failed');
                return { verified: false, message: 'Signature verification failed' };
            }

            // Verify payment with RazorPay API
            const response = await axios.get(`https://api.razorpay.com/v1/payments/${reqData.paymentId}`, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY}:${RAZORPAY_SECRET}`).toString('base64')}`
                }
            });

            const payment = response.data;

            if (payment.status === 'captured' && payment.order_id === reqData.orderId) {
                // Check if this is a maintenance fee payment or subscription payment
                const order = await this.prisma.paymentOrder.findFirst({
                    where: { razorpay_order_id: reqData.orderId }
                });

                if (order) {
                    // This is a subscription payment
                    await this.activatePremiumUser_by_razorpay(reqData.userId, reqData.paymentId, reqData.orderId);
                } else {
                    // This might be a maintenance fee payment - check the amount
                    const paymentAmount = payment.amount / 100; // Convert from paise to rupees
                    
                    if (paymentAmount === 10) {
                        // This is a maintenance fee payment
                        await this.maintenanceService.processMaintenancePayment(
                            reqData.userId,
                            reqData.paymentId,
                            reqData.orderId,
                            paymentAmount
                        );
                    } else {
                        // This is a subscription payment
                        await this.activatePremiumUser_by_razorpay(reqData.userId, reqData.paymentId, reqData.orderId);
                    }
                }
                
                return { verified: true, message: 'Payment verified successfully' };
            } else {
                return { verified: false, message: 'Payment verification failed' };
            }
        } catch (error) {
            console.error('Error verifying RazorPay payment:', error);
            return { verified: false, message: 'Payment verification failed' };
        }
    }

    async activatePremiumUser_by_razorpay(userId: string, paymentId: string, orderId: string) {
        try {
            console.log('Starting premium user activation for userId:', userId);
            
            // Check if user exists first
            const existingUser = await this.prisma.user.findUnique({
                where: { id: userId }
            });
            
            if (!existingUser) {
                console.error('User not found:', userId);
                throw new NotFoundException('User not found');
            }
            
            console.log('User found:', existingUser.name);

            // Create payment record
            console.log('Creating payment record...');
            await this.prisma.paymentOrder.create({
                data: {
                    userId: userId,
                    razorpay_payment_id: paymentId,
                    razorpay_order_id: orderId,
                    razorpay_signature: 'verified' // We've already verified the signature
                }
            });
            console.log('Payment record created successfully');

            // Update user premium status
            console.log('Updating user premium status...');
            const user = await this.prisma.user.update({
                where: {
                    id: userId,
                },
                data: {
                    isPremium: true,
                    plan: 'PREMIUM',
                    paymentDate: new Date(),
                    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
                },
            });
            console.log('User premium status updated');

            // Handle referral bonus if applicable
            if (user.referredBy) {
                console.log('Processing referral bonus...');
                const refUser = await this.prisma.user.findUnique({
                    where: {
                        id: user.referredBy,
                    },
                });
                
                if (refUser) {
                    await this.prisma.user.update({
                        where: {
                            id: refUser.id,
                        },
                        data: {
                            refralAmount: {
                                increment: 10,
                            },
                        },
                    });
                    console.log('Referral bonus processed');
                }
            }

            // Check if PremiumMember record exists, if not create one
            console.log('Checking PremiumMember record...');
            let premiumMember = await this.prisma.premiumMember.findUnique({
                where: { userId: userId }
            });
            
            if (!premiumMember) {
                console.log('Creating new PremiumMember record...');
                premiumMember = await this.prisma.premiumMember.create({
                    data: {
                        userId: userId,
                        whatsappNumber: '',
                        branch: 'Not specified',
                        year: 'Not specified',
                        isActive: true
                    },
                    include: { user: true }
                });
                console.log('PremiumMember record created');
            } else {
                console.log('Updating existing PremiumMember record...');
                await this.prisma.premiumMember.update({
                    where: {
                        userId: userId,
                    },
                    data: {
                        isActive: true,
                    },
                    include: {
                        user: true,
                    },
                });
                console.log('PremiumMember record updated');
            }

            // Send confirmation email (optional - can be skipped if email service is not configured)
            try {
                console.log('Attempting to send confirmation email...');
                const data = {
                    email: user.email,
                    name: user.name,
                    branch: premiumMember.branch,
                    year: premiumMember.year,
                };
                await this.mailService.sendAccountActivated(data);
                console.log('Confirmation email sent successfully');
            } catch (emailError) {
                console.warn('Failed to send confirmation email:', emailError);
                // Don't fail the entire process if email fails
            }

            console.log('Premium user activation completed successfully');
            return user;
        } catch (error) {
            console.error('Error in activatePremiumUser_by_razorpay:', error);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(`Internal Server Error: ${error.message}`);
        }
    }


    async status(merchantTransactionId: string, userId: string) {
        let salt_key = "3b97ddb4-f59a-4d5f-ae6f-c6493d0d65ff";
        let merchant_id = "M22RQ5R6E7ME5";
        const keyIndex = 1;

        try {


            const string =
                `/pg/v1/status/${merchant_id}/${merchantTransactionId}` + salt_key;
            const sha256 = crypto.createHash("sha256").update(string).digest("hex");
            const checksum = sha256 + "###" + keyIndex;

            const options = {
                method: "GET",
                url: `https://api.phonepe.com/apis/hermes/status/${merchant_id}/${merchantTransactionId}`,
                headers: {
                    accept: "application/json",
                    "Content-Type": "application/json",
                    "X-VERIFY": checksum,
                    "X-MERCHANT-ID": merchant_id,
                },
            };


            const response = await fetch(`https://api.phonepe.com/apis/hermes/status/${merchant_id}/${merchantTransactionId}`,{
                method:"GET",
                headers:{
                    accept: "application/json",
                    "Content-Type": "application/json",
                    "X-VERIFY": checksum,
                    "X-MERCHANT-ID": merchant_id,
            }});


console.dir(response)
            const res = await response.json();
            console.log("response",res)


            if (res.success === true) {

                const users = await this.prisma.user.findUnique({
                    where: {
                        id: userId
                    }
                });

                if (!users) throw new NotFoundException("User not found");

                await this.activatePremiumUser_by_razorpay(userId, merchantTransactionId, 'phonepe_order');

                return {
                    status: 200,
                    message: "Payment Success"
                }

            } else {

                return {
                    status: 203,
                    message: "Payment Failed"
                }

            }
        } catch (error) {

            if (error instanceof NotFoundException) throw error;
            console.error(error);
            // Return error response

            return {
                status: 500,
                message: "Payment check failed"


            }
        }

    }

}



// import crypto from "crypto";
// import axios from "axios";
// import { NextResponse } from "next/server";
// import { headers } from "next/headers";

// let saltKey = "96434309-7796-489d-8924-ab56988a6076";
// let merchantId = "PGTESTPAYUAT86";

// export async function POST(req) {
//   try {
//     const searchParams = req.nextUrl.searchParams;
//     const merchantTransactionId = searchParams.get("id");

//     const keyIndex = 1;

//     const string =
//       `/pg/v1/status/${merchantId}/${merchantTransactionId}` + saltKey;
//     const sha256 = crypto.createHash("sha256").update(string).digest("hex");
//     const checksum = sha256 + "###" + keyIndex;

//     const options = {
//       method: "GET",
//       url: `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${merchantId}/${merchantTransactionId}`,
//       headers: {
//         accept: "application/json",
//         "Content-Type": "application/json",
//         "X-VERIFY": checksum,
//         "X-MERCHANT-ID": merchantId,
//       },
//     };

//     const response = await axios(options);

//     if (response.data.success === true) {
//       return NextResponse.redirect("https://localhost:3000/success", {
//         status: 301,
//       });
//     } else {
//       return NextResponse.redirect("https://localhost:3000/failed", {
//         status: 301,
//       });
//     }
//   } catch (error) {
//     console.error(error);
//     // Return error response
//     return NextResponse.json(
//       { error: "Payment check failed", details: error.message },
//       { status: 500 }
//     );
//   }
// }