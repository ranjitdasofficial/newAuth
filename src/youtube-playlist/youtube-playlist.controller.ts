import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { YoutubePlaylistService } from './youtube-playlist.service';

@Controller('youtube-playlist')
export class YoutubePlaylistController {
    constructor(private readonly youtubePlaylistService:YoutubePlaylistService) {}

    @Post("create")
    async createPlaylist(@Body() data:{
        title:string;
        noOfVideos:number;
        playlistId:string;
        subjectId:string;
    }){
        return this.youtubePlaylistService.createPlaylist(data);
    }


    @Post("add-video") 
    async addVideosToPlaylist(@Body() data:{
        playlistId:string;
    }){
        return this.youtubePlaylistService.addVideosToPlaylist(data.playlistId);
    }

    @Get("playlistById/:id")
    async getPlaylistById(@Param("id") id:string){
        return this.youtubePlaylistService.getPlaylistById(id);
    }
}
