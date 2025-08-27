import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {

    constructor(private readonly paymentService: PaymentService) {
    }

    @Post('createOrder')
    async createOrder(@Body() reqData: {
        transactionId: string;
        name: string;
        amount: number;
        phone: string;
    }) {
        return this.paymentService.createOrder(reqData);
    }

    @Post('createRazorpayOrder')
    async createRazorpayOrder(@Body() reqData: {
        amount: number;
        type: 'subscription' | 'maintenance';
        userDetails: {
            name: string;
            email: string;
            userId: string;
        };
    }) {
        console.log("createRazorpayOrder",reqData);
        return this.paymentService.createRazorpayOrder(reqData);
    }

    @Post('verifyRazorpayPayment')
    async verifyRazorpayPayment(@Body() reqData: {
        paymentId: string;
        orderId: string;
        signature: string;
        userId: string;
    }) {
        return this.paymentService.verifyRazorpayPayment(reqData);
    }

    @Get('paymentStatus')
    async paymentStatus(@Query() dto:{merchantTransactionId:string,userId:string}) {
        return this.paymentService.status(dto.merchantTransactionId,dto.userId);
    }
    
}
