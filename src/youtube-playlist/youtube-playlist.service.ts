import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { fetchAllPlaylistItems } from './youtue-util';

@Injectable()
export class YoutubePlaylistService {
    constructor(private readonly prismaSerivice: PrismaService) { }

    async createPlaylist(data: {
        title: string;
        noOfVideos: number;
        playlistId: string;
        subjectId: string;
    }) {
        try {
            if (!data.title || !data.noOfVideos || !data.playlistId || !data.subjectId) {
                throw new BadRequestException('All fields are required');
            }

            const subject = await this.prismaSerivice.subject.findUnique({
                where: {
                    id: data.subjectId
                },
                select: {
                    id: true
                }
            });

            if (!subject) {
                throw new NotFoundException('Subject not found');
            }

            const createPlaylist = await this.prismaSerivice.youtubePlaylist.create({
                data: {
                    title: data.title,
                    noOfVideos: data.noOfVideos,
                    playlistId: data.playlistId,
                    subject: {
                        connect: {
                            id: data.subjectId
                        }
                    }
                }
            });

            return createPlaylist;
        } catch (error) {
            console.log(error);
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Internal Server Error');
        }
    }


    async addVideosToPlaylist( playlistId: string) {

        try {

          

            

            const playlist = await this.prismaSerivice.youtubePlaylist.findUnique({
                where: {
                    id: playlistId
                }
            });

            if (!playlist) {
                throw new NotFoundException('Playlist not found');
            }


            if(!playlist.id){
                throw new BadRequestException('Please provide a valid playlist id');
            }

            const  data: {
                videoId: string;
                title: string;
                thumbnail: string;
                duration: string;
            }[] = await fetchAllPlaylistItems(playlist.playlistId, process.env.YOUTUBE_API_KEY);

            if (data.length === 0) {
                throw new BadRequestException('Please provide atleast one video');
            }

            // const videos = data.map(video => {
            //     return {
            //         title: video.title,
            //         videoId: video.videoId,
            //         thumbnail: video.thumbnail,
            //         duration: video.duration,
                  
            //     }
            // });

            const UpdatedPlaylist = await this.prismaSerivice.youtubePlaylist.update({
                where: {
                    id: playlistId
                },
                data: {
                    items:{
                        push: data.map(video => {
                            return {
                                title: video.title,
                                videoId: video.videoId,
                                thumbnail: video.thumbnail,
                                duration: video.duration,
                            }
                        })
                    }
                }
            });

            return UpdatedPlaylist;
            
        } catch (error) {
            
            console.log(error);
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Internal Server Error');
        }

    }

    async getPlaylistById(id: string) {
        try {
            const playlist = await this.prismaSerivice.youtubePlaylist.findUnique({
                where: {
                    id: id
                }
            });

            if (!playlist) {
                throw new NotFoundException('Playlist not found');
            }

            return playlist;
        } catch (error) {
            console.log(error);
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Internal Server Error');
        }
    }

}
