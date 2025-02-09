import { Module } from '@nestjs/common';
import { YoutubePlaylistService } from './youtube-playlist.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [YoutubePlaylistService,PrismaService]
})
export class YoutubePlaylistModule {}
