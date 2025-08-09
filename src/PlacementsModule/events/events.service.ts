import { Injectable, NotFoundException } from '@nestjs/common';
import { Event } from './schemas/event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    return this.prisma.event.create({
      data: createEventDto,
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    type?: string,
    mode?: string,
    isActive?: boolean
  ): Promise<{
    data: Event[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const skip = (page - 1) * limit;
    
    // Build filter query
    const where: any = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (type) {
      where.type = type;
    }
    
    if (mode) {
      where.mode = mode;
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async findUpcoming(limit: number = 5): Promise<Event[]> {
    const today = new Date().toISOString().split('T')[0];
    
    return this.prisma.event.findMany({
      where: {
        isActive: true,
        date: { gte: today }
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: limit,
    });
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto): Promise<Event> {
    try {
      return await this.prisma.event.update({
        where: { id },
        data: updateEventDto,
      });
    } catch (error) {
      throw new NotFoundException('Event not found');
    }
  }

  async remove(id: string): Promise<Event> {
    try {
      return await this.prisma.event.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException('Event not found');
    }
  }

  async getEventsByCompany(companyId: string): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { 
        companyId,
        isActive: true 
      },
      orderBy: { date: 'asc' },
    });
  }



  async getEventStats(): Promise<{
    totalEvents: number;
    upcomingEvents: number;
    activeEvents: number;
    eventsByType: any[];
  }> {
    const today = new Date().toISOString().split('T')[0];

    const [
      totalEvents,
      upcomingEvents,
      activeEvents,
      eventsByType
    ] = await Promise.all([
      this.prisma.event.count(),
      this.prisma.event.count({ 
        where: {
          isActive: true,
          date: { gte: today }
        }
      }),
      this.prisma.event.count({ where: { isActive: true } }),
      this.prisma.event.groupBy({
        by: ['type'],
        _count: { type: true },
      })
    ]);

    return {
      totalEvents,
      upcomingEvents,
      activeEvents,
      eventsByType: eventsByType.map(item => ({
        _id: item.type,
        count: item._count.type
      }))
    };
  }

  // Additional methods needed by controller
  async getUpcomingEvents(limit: number = 5): Promise<Event[]> {
    return this.findUpcoming(limit);
  }

  async getEventStatistics() {
    return this.getEventStats();
  }

  async getEventsByType(type: string): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { 
        type: type as any,
        isActive: true 
      },
      orderBy: { date: 'asc' },
    });
  }

  async toggleEventStatus(id: string): Promise<Event> {
    const event = await this.findOne(id);
    
    return this.prisma.event.update({
      where: { id },
      data: { isActive: !event.isActive },
    });
  }

  async registerForEvent(eventId: string, userId: string): Promise<Event> {
    const event = await this.findOne(eventId);

    if (event.maxParticipants && event.registeredCount >= event.maxParticipants) {
      throw new Error('Event is full');
    }

    return this.prisma.event.update({
      where: { id: eventId },
      data: { 
        registeredCount: { increment: 1 } 
      },
    });
  }

  async unregisterFromEvent(eventId: string, userId: string): Promise<Event> {
    const event = await this.findOne(eventId);

    if (event.registeredCount <= 0) {
      throw new Error('No registrations to cancel');
    }

    return this.prisma.event.update({
      where: { id: eventId },
      data: { 
        registeredCount: { decrement: 1 } 
      },
    });
  }
}