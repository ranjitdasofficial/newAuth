import { IsString } from "class-validator";

export class KiitUserRegister{
    @IsString()
    name:string;

    @IsString()
    email:string;

    @IsString()
    profileImage:string;


    
    
}