import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  async create(@Body() createEventDto: CreateEventDto) {
    const event = await this.eventsService.create(createEventDto);
    return new ApiResponseDto(true, 'Event created successfully', event);
  }

  @Get()
  @ApiOperation({ summary: 'Get all events' })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by event type' })
  @ApiQuery({ name: 'mode', required: false, description: 'Filter by event mode' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('mode') mode?: string,
    @Query('isActive') isActive?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const isActiveBool = isActive ? isActive === 'true' : undefined;

    const events = await this.eventsService.findAll(
      pageNum,
      limitNum,
      search,
      type,
      mode,
      isActiveBool
    );
    return new ApiResponseDto(true, 'Events retrieved successfully', events);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming events' })
  @ApiResponse({ status: 200, description: 'Upcoming events retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of upcoming events to fetch' })
  async getUpcomingEvents(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 5;
    const events = await this.eventsService.getUpcomingEvents(limitNum);
    return new ApiResponseDto(true, 'Upcoming events retrieved successfully', events);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get event statistics' })
  @ApiResponse({ status: 200, description: 'Event statistics retrieved successfully' })
  async getEventStatistics() {
    const stats = await this.eventsService.getEventStatistics();
    return new ApiResponseDto(true, 'Event statistics retrieved successfully', stats);
  }

  @Get('company/:company')
  @ApiOperation({ summary: 'Get events by company' })
  @ApiResponse({ status: 200, description: 'Company events retrieved successfully' })
  async getEventsByCompany(@Param('company') company: string) {
    const events = await this.eventsService.getEventsByCompany(company);
    return new ApiResponseDto(true, 'Company events retrieved successfully', events);
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Get events by type' })
  @ApiResponse({ status: 200, description: 'Events by type retrieved successfully' })
  async getEventsByType(@Param('type') type: string) {
    const events = await this.eventsService.getEventsByType(type);
    return new ApiResponseDto(true, 'Events by type retrieved successfully', events);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string) {
    const event = await this.eventsService.findOne(id);
    return new ApiResponseDto(true, 'Event retrieved successfully', event);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an event' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    const event = await this.eventsService.update(id, updateEventDto);
    return new ApiResponseDto(true, 'Event updated successfully', event);
  }

  @Put(':id/toggle-status')
  @ApiOperation({ summary: 'Toggle event active status' })
  @ApiResponse({ status: 200, description: 'Event status toggled successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async toggleStatus(@Param('id') id: string) {
    const event = await this.eventsService.toggleEventStatus(id);
    return new ApiResponseDto(true, 'Event status toggled successfully', event);
  }

  @Post(':id/register')
  @ApiOperation({ summary: 'Register for an event' })
  @ApiResponse({ status: 200, description: 'Successfully registered for event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async registerForEvent(
    @Param('id') eventId: string,
    @Body() body: { userId: string }
  ) {
    const event = await this.eventsService.registerForEvent(eventId, body.userId);
    return new ApiResponseDto(true, 'Successfully registered for event', event);
  }

  @Post(':id/unregister')
  @ApiOperation({ summary: 'Unregister from an event' })
  @ApiResponse({ status: 200, description: 'Successfully unregistered from event' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async unregisterFromEvent(
    @Param('id') eventId: string,
    @Body() body: { userId: string }
  ) {
    const event = await this.eventsService.unregisterFromEvent(eventId, body.userId);
    return new ApiResponseDto(true, 'Successfully unregistered from event', event);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an event' })
  @ApiResponse({ status: 200, description: 'Event deleted successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async remove(@Param('id') id: string) {
    await this.eventsService.remove(id);
    return new ApiResponseDto(true, 'Event deleted successfully', null);
  }
}