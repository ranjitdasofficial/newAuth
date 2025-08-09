import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all system settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  async getSettings() {
    const settings = await this.settingsService.getSettings();
    return new ApiResponseDto(true, 'Settings retrieved successfully', settings);
  }

  @Put()
  @ApiOperation({ summary: 'Update system settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async updateSettings(@Body() updateSettingsDto: UpdateSettingsDto) {
    const settings = await this.settingsService.updateSettings(updateSettingsDto);
    return new ApiResponseDto(true, 'Settings updated successfully', settings);
  }

  @Get('general')
  @ApiOperation({ summary: 'Get general settings' })
  @ApiResponse({ status: 200, description: 'General settings retrieved successfully' })
  async getGeneralSettings() {
    const settings = await this.settingsService.getGeneralSettings();
    return new ApiResponseDto(true, 'General settings retrieved successfully', settings);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get notification settings' })
  @ApiResponse({ status: 200, description: 'Notification settings retrieved successfully' })
  async getNotificationSettings() {
    const settings = await this.settingsService.getNotificationSettings();
    return new ApiResponseDto(true, 'Notification settings retrieved successfully', settings);
  }

  @Get('integrations')
  @ApiOperation({ summary: 'Get integration settings' })
  @ApiResponse({ status: 200, description: 'Integration settings retrieved successfully' })
  async getIntegrationSettings() {
    const settings = await this.settingsService.getIntegrationSettings();
    return new ApiResponseDto(true, 'Integration settings retrieved successfully', settings);
  }

  @Get('appearance')
  @ApiOperation({ summary: 'Get appearance settings' })
  @ApiResponse({ status: 200, description: 'Appearance settings retrieved successfully' })
  async getAppearanceSettings() {
    const settings = await this.settingsService.getAppearanceSettings();
    return new ApiResponseDto(true, 'Appearance settings retrieved successfully', settings);
  }

  @Put('general')
  @ApiOperation({ summary: 'Update general settings' })
  @ApiResponse({ status: 200, description: 'General settings updated successfully' })
  async updateGeneralSettings(@Body() generalSettings: any) {
    const settings = await this.settingsService.updateGeneralSettings(generalSettings);
    return new ApiResponseDto(true, 'General settings updated successfully', settings);
  }

  @Put('notifications')
  @ApiOperation({ summary: 'Update notification settings' })
  @ApiResponse({ status: 200, description: 'Notification settings updated successfully' })
  async updateNotificationSettings(@Body() notificationSettings: any) {
    const settings = await this.settingsService.updateNotificationSettings(notificationSettings);
    return new ApiResponseDto(true, 'Notification settings updated successfully', settings);
  }

  @Put('integrations')
  @ApiOperation({ summary: 'Update integration settings' })
  @ApiResponse({ status: 200, description: 'Integration settings updated successfully' })
  async updateIntegrationSettings(@Body() integrationSettings: any) {
    const settings = await this.settingsService.updateIntegrationSettings(integrationSettings);
    return new ApiResponseDto(true, 'Integration settings updated successfully', settings);
  }

  @Put('appearance')
  @ApiOperation({ summary: 'Update appearance settings' })
  @ApiResponse({ status: 200, description: 'Appearance settings updated successfully' })
  async updateAppearanceSettings(@Body() appearanceSettings: any) {
    const settings = await this.settingsService.updateAppearanceSettings(appearanceSettings);
    return new ApiResponseDto(true, 'Appearance settings updated successfully', settings);
  }

  @Get('maintenance-status')
  @ApiOperation({ summary: 'Check if maintenance mode is enabled' })
  @ApiResponse({ status: 200, description: 'Maintenance status retrieved successfully' })
  async getMaintenanceStatus() {
    const isMaintenanceMode = await this.settingsService.isMaintenanceMode();
    return new ApiResponseDto(true, 'Maintenance status retrieved successfully', { 
      maintenanceMode: isMaintenanceMode 
    });
  }

  @Put('maintenance-mode')
  @ApiOperation({ summary: 'Toggle maintenance mode' })
  @ApiResponse({ status: 200, description: 'Maintenance mode updated successfully' })
  async toggleMaintenanceMode(@Body() body: { enabled: boolean }) {
    const settings = await this.settingsService.updateGeneralSettings({ 
      maintenanceMode: body.enabled 
    });
    return new ApiResponseDto(true, 'Maintenance mode updated successfully', settings);
  }
}