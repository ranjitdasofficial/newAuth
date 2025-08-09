import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ResourcesService } from './resources.service';
import { CloudflareR3Service } from './cloudflare-r3.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { Resource, ResourceType } from '@prisma/client';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('resources')
@Controller('resources')
export class ResourcesController {
  constructor(
    private readonly resourcesService: ResourcesService,
    private readonly cloudflareR3Service: CloudflareR3Service,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new resource' })
  @ApiResponse({ status: 201, description: 'Resource created successfully' })
  async create(@Body() createResourceDto: CreateResourceDto): Promise<ApiResponseDto<Resource>> {
    // Filter out any invalid fields that might be sent from frontend
    const { fileName, ...validData } = createResourceDto as any;
    console.log('Creating resource with data:', validData);
    const resource = await this.resourcesService.create(validData);
    return new ApiResponseDto(true, 'Resource created successfully', resource);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        title: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        type: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a resource file' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() createResourceDto: CreateResourceDto,
  ) {
    try {
      // Upload file to Cloudflare R3
      const fileUrl = await this.cloudflareR3Service.uploadFile(file);
      
      // Create resource with file URL
      const resourceData = {
        ...createResourceDto,
        url: fileUrl,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        type: this.getResourceTypeFromMimeType(file.mimetype),
        filePath: file.originalname, // Use filePath instead of fileName
      };
      
      const resource = await this.resourcesService.create(resourceData);
      return new ApiResponseDto(true, 'File uploaded successfully', resource);
    } catch (error) {
      console.error('File upload error:', error);
      return new ApiResponseDto(false, 'File upload failed', null);
    }
  }

  @Post('upload-url')
  @ApiOperation({ summary: 'Get signed upload URL for direct upload' })
  @ApiResponse({ status: 200, description: 'Upload URL generated successfully' })
  async getUploadUrl(@Body() body: { fileName: string; contentType: string }) {
    try {
      const key = this.cloudflareR3Service.generateFileKey(body.fileName);
      const uploadUrl = await this.cloudflareR3Service.getSignedUploadUrl(key, body.contentType);
      
      return new ApiResponseDto(true, 'Upload URL generated successfully', {
        uploadUrl,
        key,
        publicUrl: `${process.env.CLOUDFLARE_R3_PUBLIC_URL}/${key}`,
      });
    } catch (error) {
      console.error('Upload URL generation error:', error);
      return new ApiResponseDto(false, 'Failed to generate upload URL', null);
    }
  }

  @Post('upload-server')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        title: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        type: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a resource file through server' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  async uploadFileServer(
    @UploadedFile() file: Express.Multer.File,
    @Body() createResourceDto: CreateResourceDto,
  ) {
    try {
      // Upload file to Cloudflare R3 through server
      const fileUrl = await this.cloudflareR3Service.uploadFile(file);
      
      // Create resource with file URL
      const resourceData = {
        ...createResourceDto,
        url: fileUrl,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        type: this.getResourceTypeFromMimeType(file.mimetype),
        filePath: file.originalname, // Use filePath instead of fileName
      };
      
      const resource = await this.resourcesService.create(resourceData);
      return new ApiResponseDto(true, 'File uploaded successfully', resource);
    } catch (error) {
      console.error('Server upload error:', error);
      return new ApiResponseDto(false, 'File upload failed', null);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all resources with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Resources retrieved successfully' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('companyId') companyId?: string,
    @Query('isFeatured') isFeatured?: string,
  ): Promise<ApiResponseDto<{ resources: Resource[]; total: number }>> {
    const result = await this.resourcesService.findAll({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
      type,
      category,
      companyId,
      isFeatured: isFeatured === 'true',
    });
    return new ApiResponseDto(true, 'Resources retrieved successfully', result);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured resources' })
  @ApiResponse({ status: 200, description: 'Featured resources retrieved successfully' })
  async findFeatured(): Promise<ApiResponseDto<Resource[]>> {
    const resources = await this.resourcesService.findFeatured();
    return new ApiResponseDto(true, 'Featured resources retrieved successfully', resources);
  }

  @Get('company/:companyId')
  @ApiOperation({ summary: 'Get resources by company' })
  @ApiResponse({ status: 200, description: 'Resources by company retrieved successfully' })
  async findByCompany(@Param('companyId') companyId: string): Promise<ApiResponseDto<Resource[]>> {
    const resources = await this.resourcesService.findByCompany(companyId);
    return new ApiResponseDto(true, 'Resources by company retrieved successfully', resources);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get resource statistics' })
  @ApiResponse({ status: 200, description: 'Resource stats retrieved successfully' })
  async getStats(): Promise<ApiResponseDto<any>> {
    const stats = await this.resourcesService.getStats();
    return new ApiResponseDto(true, 'Resource stats retrieved successfully', stats);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a resource by ID' })
  @ApiResponse({ status: 200, description: 'Resource retrieved successfully' })
  async findOne(@Param('id') id: string): Promise<ApiResponseDto<Resource>> {
    const resource = await this.resourcesService.findOne(id);
    return new ApiResponseDto(true, 'Resource retrieved successfully', resource);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a resource' })
  @ApiResponse({ status: 200, description: 'Resource updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateResourceDto: UpdateResourceDto,
  ): Promise<ApiResponseDto<Resource>> {
    const resource = await this.resourcesService.update(id, updateResourceDto);
    return new ApiResponseDto(true, 'Resource updated successfully', resource);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a resource' })
  @ApiResponse({ status: 200, description: 'Resource deleted successfully' })
  async remove(@Param('id') id: string): Promise<ApiResponseDto<Resource>> {
    const resource = await this.resourcesService.remove(id);
    return new ApiResponseDto(true, 'Resource deleted successfully', resource);
  }

  @Post(':id/download')
  @ApiOperation({ summary: 'Increment download count for a resource' })
  @ApiResponse({ status: 200, description: 'Download count incremented successfully' })
  async incrementDownloadCount(@Param('id') id: string): Promise<ApiResponseDto<Resource>> {
    const resource = await this.resourcesService.incrementDownloadCount(id);
    return new ApiResponseDto(true, 'Download count incremented successfully', resource);
  }

  private getResourceTypeFromMimeType(mimeType: string): ResourceType {
    if (mimeType.startsWith('application/pdf')) return ResourceType.PDF;
    if (mimeType.startsWith('video/')) return ResourceType.VIDEO;
    if (mimeType.startsWith('image/')) return ResourceType.IMAGE;
    if (mimeType.includes('zip') || mimeType.includes('rar')) return ResourceType.ARCHIVE;
    if (mimeType.includes('document') || mimeType.includes('word')) return ResourceType.DOCUMENT;
    return ResourceType.OTHER;
  }
} 