import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { KiitUsersService } from './kiit-users.service';
import { KiitUserRegister } from './dto/KiitUserRegister.dto';

@Controller('kiitusers')
export class KiitUsersController {
    constructor(private readonly kiitUserService:KiitUsersService){}

    @Post("registerUser")
    async registerUser(@Body() dto:KiitUserRegister){
        return this.kiitUserService.registerUser(dto);
    }

    @Get("getUserByEmail/:email")
    async getUserById(@Param("email") email:string){
        return this.kiitUserService.getUserByEmail(email);
    }
}
