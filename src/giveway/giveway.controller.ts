import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GivewayService } from './giveway.service';

@Controller('giveway')
export class GivewayController {

    constructor(private readonly givewayService: GivewayService) { }

    @Get('getAllGiveways')
    async getAllGiveways() {
        return this.givewayService.getAllGiveways();
    }

    @Get('getPremiumAllotedGiveway')
    async getPremiumAllotedGiveway() {
        return this.givewayService.getPremiumAllotedGiveway();
    }

    @Post('createGiveway')
    async createGiveway(@Body() dto: { userId: string }) {
        return this.givewayService.createGiveway(dto.userId);
    }

    @Get('getGivewayById')
    async getGivewayById(@Query('userId') userId: string) {
        return this.givewayService.getGivewayById(userId);
    }
    
}
