import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { KiitsocialService } from './kiitsocial.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { AddComments, Upload } from './kiitsocial.dto';
import { StorageService } from 'src/storage/storage.service';
import * as fs from 'fs';
import { Readable } from 'stream';



@Controller('kiitsocial')
export class KiitsocialController {
  constructor(private readonly kiitSocialService: KiitsocialService,private readonly storageService:StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto:Upload
   
  ) { 
    if(file){
      await this.checkIfImage(file);
  
    }
    
    console.log("here",file,dto)
    return this.kiitSocialService.uploadPost(dto, file);
  }

  @Get("getAllPost")
  getAllPost(@Query() dto:{page:number,limit:number,id?:string|null}){
    console.log("here"); 
    console.log("dto is here:",dto);

    return this.kiitSocialService.getAllPost(dto.page,dto.limit,dto.id);
  }


  async checkIfImage(fileInfo: { mimetype: string,path:string }): Promise<void> {
    if (!fileInfo.mimetype.startsWith('image/')) {
       fs.unlinkSync(fileInfo.path);
      throw new BadRequestException('File is not an image.');
    }
  }
 
  // // async generateMediaId() { 
  // //   return await this.storageService.generateMediaId();
  // // }
  

  // @Post("uploadPost")
  // @UseInterceptors(
  //   FileInterceptor("image", {
  //     limits: {
  //       files: 1,
  //       fileSize: 1024 * 1024,
  //     },
  //   })
  // )
  // async uploadMedia(
  //   @UploadedFile() file: Express.Multer.File,
  // ) {

  //   // return this.kiitSocialService.uploadPost(file);
   
  // //   const mediaId = await this.generateMediaId();
  // //   const buffer = await this.streamToBuffer(fs.createReadStream(file.path));
  // //  const p = await this.storageService.save(
  // //     "media/" + mediaId, 
  // //     file.mimetype,
  // //     buffer,
  // //     [{ mediaId: mediaId }]
  // //   );

  // //   console.log(p);


  // }

  // // private async streamToBuffer(stream: Readable): Promise<Buffer> {
  // //   return new Promise((resolve, reject) => {
  // //     const chunks: Buffer[] = [];
  // //     stream.on('data', (chunk) => chunks.push(chunk));
  // //     stream.on('error', reject); 
  // //     stream.on('end', () => resolve(Buffer.concat(chunks)));
  // //   });  
  // // } 

  // @Get("sendWhatsApp")
  // async sendNotification() {
  //   return this.kiitSocialService.sendWhatsAppMessage();
  // }


  @Get("sendReq")
  async sendReq(){
    try {
      const res = await fetch("http://localhost:9000/sendMessage",{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          chatId:"ChatId",
          description:"Description",
          image:"ImageId",
          title:"Title",
          postId:"PostId",
          eventType:"PostType",
        
        })
      });

      console.log(res);
      return await res.json();
    } catch (error) {
      console.log(error);
      throw new BadRequestException("Something went wrong");
    }
  }


  @Post("likeDislike")
  async likeDislike(@Body() dto:{postId:string,userId:string}){
    console.log("here",dto);
    return this.kiitSocialService.likeAndDislikePost(dto.postId,dto.userId);
  }

  @Post("addComments")
  async addComments(@Body() dto:AddComments){
    console.log(dto);
    return this.kiitSocialService.addComment(dto);
  }

  @Post("deletePosts") 
  async deletePost(@Body() dto:{postId:string,userId:string}){
    console.log("hello",dto);
 
    // return "hello World";
    return this.kiitSocialService.deletePost(dto.postId,dto.userId);
  }

  @Post("deleteComment")
  async deleteComment(@Body() dto:{commentId:string,userId:string}){
    return this.kiitSocialService.deleteComments(dto.commentId,dto.userId);
  }

  // @Get("getcomment/:postId")
  // async getComment(@Param("postId") postId:string){
  //   return this.kiitSocialService.getCommentsByPostId(postId);
  // }

  @Get("getPostbyId")
  async getPostById(@Query() dto:{postId:string,id:string}){
    console.log(dto);
    return this.kiitSocialService.fetchPostById(dto.postId,dto.id);
  } 

}   
  