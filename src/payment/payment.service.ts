import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';

import axios from "axios";

import * as crypto from "crypto";
import { KiitUsersService } from 'src/kiit-users/kiit-users.service';
import { MyMailService } from 'src/mail.service';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class PaymentService {

    constructor(private readonly mailService: MyMailService, private readonly prisma: PrismaService) { }

    async createOrder(reqData: {

        transactionId: string;
        name: string;
        amount: number;
        phone: string;

    }) {




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

        const prod_URL =
            "https://api.phonepe.com/apis/hermes/pg/v1/pay";

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

        // Await axios response
        const response = await axios(options);
        console.log(response.data);

        // Return the response using NextResponse

        return response.data;


    } catch(error) {
        console.log(error);

        // Return error response
        return {
            status: 500,
            message: "Payment failed",
        }

    }




    async activatePremiumUser_by_phonepe(userId: string, merchantTransactionId: string) {
        try {

            await this.prisma.paymentOrder_phonepe.create({
                data: {
                    userId: userId,
                    merchantTransactionId: merchantTransactionId,
                }
            })



            const user = await this.prisma.user.update({
                where: {
                    id: userId,
                },

                data: {
                    isPremium: true,

                },
            });
            if (!user) throw new NotFoundException('User not found');

            if (user.referredBy) {
                const refUser = await this.prisma.user.findUnique({
                    where: {
                        id: user.referredBy,
                    },
                });
                console.log(refUser);
                if (refUser) {
                    const up = await this.prisma.user.update({
                        where: {
                            id: refUser.id,
                        },
                        data: {
                            refralAmount: {
                                increment: 10,
                            },
                        },
                    });
                    if (!up)
                        throw new InternalServerErrorException(
                            'Failed to Update Referral Amount',
                        );
                }
            }

            const p = await this.prisma.premiumMember.update({
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

            if (!p) throw new NotFoundException('User not found');

            const data = {
                email: p.user.email,
                name: p.user.name,
                branch: p.branch,
                year: p.year,
            };
            await this.mailService.sendAccountActivated(data);
            //       return complete;

            return user;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Internal Server Error');
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

                await this.activatePremiumUser_by_phonepe(userId, merchantTransactionId);

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