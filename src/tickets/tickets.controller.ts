import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
    constructor(private readonly ticketService: TicketsService) { }

    @Get()
    async  findAll() {
        return this.ticketService.findAll();
    }

    @Get('user/:id')
    async findTicketsByUserId(@Param('id') id: string) {
        return this.ticketService.findTicketsByUserId(id);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.ticketService.findByTicketId(id);
    }

    @Post()
    create(@Body() createTicketDto: any) {
        return this.ticketService.create(createTicketDto);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateTicketDto: any) {
        return this.ticketService.update(id, updateTicketDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.ticketService.remove(id);
    }

    // Nested: Get messages for a ticket
    @Get(':id/messages')
    findMessages(@Param('id') id: string) {
        return this.ticketService.findMessages(id);
    }

    // Nested: Add message to ticket
    @Post(':id/messages')
    addMessage(@Param('id') id: string, @Body() createMessageDto: any) {
        return this.ticketService.addMessage(id, createMessageDto);
    }

    // for messages

    // @Get()
    // findAll() {
    //     return this.messageService.findAll();
    // }

    // @Get(':id')
    // findOne(@Param('id') id: string) {
    //     return this.messageService.findOne(id);
    // }

    // @Patch(':id')
    // update(@Param('id') id: string, @Body() updateMessageDto: any) {
    //     return this.messageService.update(id, updateMessageDto);
    // }

    // @Delete(':id')
    // remove(@Param('id') id: string) {
    //     return this.messageService.remove(id);
    // }
}
