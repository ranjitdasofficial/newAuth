import { Controller, Get, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {

    constructor(private readonly adminService: AdminService){}
    
    @Get("users")
    getUsers(@Query() dto:{pageNo:number,pageSize:number}) {
        return this.adminService.getUsers(dto); 
    }

    @Get("getPremiumUsers")
    getPremiumUsers(@Query() dto:{pageNo:number,pageSize:number}) {
        return this.adminService.getPremiumUsers(dto); 
    }


    
}
