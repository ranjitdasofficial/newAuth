import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { KiitUserRegister } from './dto/KiitUserRegister.dto';

@Injectable()
export class KiitUsersService {
    constructor(private readonly prisma:PrismaService){
    }

     async registerUser(dto:KiitUserRegister){
            try {
                const user = await this.prisma.user.findUnique({
                    where:{
                        email:dto.email
                    }
                });
                if(user) throw new ConflictException("User already exists");
                const newUser = await this.prisma.user.create({
                    data:dto
                });
                if(!newUser) throw new Error("Something went wrong!");
                return newUser;
            } catch (error) {
                if(error instanceof ConflictException){
                    throw error;
                }
                throw new InternalServerErrorException("Internal Server Error");
            }
    }

    async getUserByEmail(email:string){
        try {
            const user = await this.prisma.user.findUnique({
                where:{
                    email:email
                }
            });
            if(!user) throw new NotFoundException("User not found");
            return user;
        } catch (error) {
            if(error instanceof NotFoundException){
                throw error;
            }
            throw new InternalServerErrorException("Internal Server Error");
        }
    }


    
     
}
