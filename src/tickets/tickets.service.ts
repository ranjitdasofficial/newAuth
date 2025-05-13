import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateMessageDto, CreateTicketDto, UpdateTicketDto } from './tickets.dto';

@Injectable()
export class TicketsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        // Fetch only necessary fields and include user and message counts for performance
        return this.prisma.ticket.findMany({
            select: {
                id: true,
                title: true,
                category: true,
                priority: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                user: { select: { id: true, name: true, email: true } },
                _count: { select: { messages: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findTicketsByUserId(userId: string) {
        // Fetch tickets for a specific user
        return this.prisma.ticket.findMany({
            where: { userId },
            select: {
                id: true,
                title: true,
                category: true,
                priority: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                user: { select: { id: true, name: true, email: true } },
                _count: { select: { messages: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

    }

    async findByTicketId(id: string) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, email: true } },
                messages: {
                    select: {
                        id: true, content: true, sender: true, isResolution: true, createdAt: true
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!ticket) throw new NotFoundException('Ticket not found');
        return ticket;
    }

    async create(dto: CreateTicketDto) {
        return this.prisma.ticket.create({
            data: {
                ...dto,
            }
        });
    }

    async update(id: string, dto: UpdateTicketDto) {
        try {
            return await this.prisma.ticket.update({
                where: { id },
                data: dto
            });
        } catch (e) {
            throw new NotFoundException('Ticket not found');
        }
    }

    async remove(id: string) {
        try {
            await this.prisma.ticket.delete({ where: { id } });
            return { message: 'Ticket deleted' };
        } catch (e) {
            throw new NotFoundException('Ticket not found');
        }
    }

    async findMessages(ticketId: string) {
        // Fetch messages for a ticket, sorted by creation date
        return this.prisma.message.findMany({
            where: { ticketId },
            select: {
                id: true, content: true, sender: true, isResolution: true, createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    async addMessage(ticketId: string, dto: CreateMessageDto) {
        // Add a message to a ticket
        try {

            const { status, ...messageData } = dto;
            await this.prisma.message.create({
                data: {
                    ...messageData,
                    ticketId: ticketId,
                },
                select: {
                    id: true, content: true, sender: true, isResolution: true, createdAt: true,
                },
            });
            if (status) {
                await this.prisma.ticket.update({
                    where: { id: ticketId },
                    data: {
                        status: status,
                    },
                });
            }
            return {
                status: "200",
            };

        } catch (error) {
            console.log(error);
            throw new InternalServerErrorException('Error in adding message');

        }


    }
}
