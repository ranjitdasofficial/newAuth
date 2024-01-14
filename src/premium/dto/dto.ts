import { IsEmail, IsInt, IsNumber, IsString, isString } from "class-validator";

export class GetUserDto{
    @IsString()
    @IsEmail()
    email: string;
}


export class PremiumUserRegister{
    @IsString()
    @IsEmail()
    email: string;

    @IsString()
    name:string;

    @IsString()
    whatsappNumber:string

    @IsString()
    branch:string

    @IsString()
    year:string

}