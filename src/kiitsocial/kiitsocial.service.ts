import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DriveService } from 'src/drive.service';
import { PrismaService } from 'src/prisma.service';
import { AddComments, Upload } from './kiitsocial.dto';
import * as fs from 'fs';
import { StorageService } from 'src/storage/storage.service';
import { Readable } from 'stream';
import { WhatsappService } from 'src/whatsappweb/whatsappweb.service';
import { CustomPostSelect } from './prisma-types';
import { kiitsocial } from '@prisma/client';
import * as sharp from 'sharp';




@Injectable()
export class KiitsocialService {
  constructor(
    private readonly driveService: DriveService,
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly whatsAppWebService: WhatsappService,
  ) {}

  async generateMediaId() {
    return await this.storageService.generateMediaId();
  }

  async uploadPost(dto: Upload, file?: Express.Multer.File) {
    const {
      title,
      description,
      eventType,
      isAnonymous,
      userId,
      foundDate,
      foundPlace,
      githubLink,
      image,
      isApproved,
      lostDate,
      lostPlace,
      projectLink,
      tags,
    } = dto;
   
    const data = {
      title,
      description,
      image,
      foundDate,
      foundPlace,
      githubLink,
      isApproved,
      lostDate,
      lostPlace,
      projectLink,
      tags,
      userId,
      eventType,
      isAnonymous,
      
    };

    try {
      console.log(file);
      if (file) {
        // const mediaId = await this.generateMediaId();
        const buffer = await this.streamToBuffer(
          fs.createReadStream(file.path),
        );
        // const p = await this.storageService.save(
        //   'media/' + mediaId,
        //   file.mimetype,
        //   buffer,
        //   [{ mediaId: mediaId }],
        // );

        const mediaId = await this.generateMediaId();
        const filebuffer = await sharp(buffer)
          .webp({ quality: 70 }) // Adjust quality as needed
          .toBuffer();

          console.log(buffer,"buffer");
  
        const p = await this.storageService.save(
          'media/' + mediaId,
          'image/webp', // Set the mimetype for WebP
          filebuffer,
          [{ mediaId: mediaId }],
        );
        // const fileId = await this.uploadImage(file, createdByEmail);
        data.image = p.mediaId;
        fs.unlink(file.path, (err) => {
          if (err) {
            console.error(err);
            return;
          }
        });
      }

      const p = await this.prisma.kiitsocial.create({
        data,
        include: {
          comments: {
            include:{
              user:{
                select:{
                  name:true,
                  email:true,
                  profileImage:true,
                  id:true,
                }
              }
            }
          
          },
          
          user:{
            select:{
              name:true,
              email:true,
              profileImage:true,
              id:true,
            }
          }
        },
      
        
      });

      if (!p) {
        throw new InternalServerErrorException('Something went wrong!!');
      }


      const truncatedDescription = p.description.slice(0, 40);


      const response = await fetch("https://botserver.rajmohandas.com.np/sendMessage",{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({ 
          chatId:"120363225438657833@g.us",
          description:truncatedDescription,
          image:p.image,
          title:p.title,
          postId:p.id,
          eventType:p.eventType,
        }),
      });

      console.log(response);
      // await this.whatsAppWebService.sendMessage("120363225438657833@g.us",p.description,p.image,p.title,p.id,p.eventType)

      const likeLength =0;
      const isLikedByYou =false;
      // console.log(post.likes,post.likes.includes(id),id);
      const commentsLength = 0;
      const lastComment = [];
      const { likes, ...rest } = p;
      return {
        ...rest,
        commentsLength,
        lastComment,
        likeLength:likeLength,
        isLikedByYou:isLikedByYou,
        
      };

      // await this.whatsAppWebService.sendMessage("ddssd","Someone has just uploaded a post on KIIT Social");
      // return p;


    } catch (error) {
      console.log(error);

      throw new InternalServerErrorException('Something went wrong!!');
    }
  }





  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

// //   async getAllPost() {

// //     //return all post with no of comments and include only one comments last one 
// // // Your file where you use Prisma queries

// // const postsWithComments = await this.prisma.kiitsocial.findMany({
// //   include: {
// //     comments:true,
// //   },
// //   orderBy:{
// //     createdAt:'desc',
// //   }
// // });

// // const postsWithCommentsDetails = postsWithComments.map((post) => {
// //   const commentsLength = post.comments.length;
// //   const lastComment = commentsLength > 0 ? post.comments[0] : null;

// // const {comments,...rest} = post;

// //   return {
// //     ...rest,
// //     commentsLength,
// //     lastComment,
// //   };
// // });

// // console.log(postsWithCommentsDetails);

// // // 
// //     // const {comments, ...rest} = postsWithComments[0];

// //     // const commentCount = comments

// //     return postsWithCommentsDetails;


    
// //     console.log(postsWithComments);
    




// //   }



async getAllPost(page: number = 1, pageSize: number = 5,id?:string|null) {
  const skipCount = (page - 1) * pageSize;

  const postCount = await this.prisma.kiitsocial.count();

  const postsWithComments = await this.prisma.kiitsocial.findMany({
    include: {
      comments: {
        include:{
          user:{
            select:{
              name:true,
              email:true,
              profileImage:true,
              id:true,
            }
          }
        }
      
      },
      
      user:{
        select:{
          name:true,
          email:true,
          profileImage:true,
          id:true,
        }
      }

    },
    orderBy: {
      createdAt: 'desc',
    },
    skip: skipCount,
    take: Number(pageSize),
  });

  // console.log("post",postsWithComments)
  

  const postsWithCommentsDetails = postsWithComments.map((post) => {
    const likeLength = post.likes.length;
    const isLikedByYou = !id?false:post.likes.includes(id)?true:false;
    console.log(post.likes,post.likes.includes(id),id);
    const commentsLength = post.comments.length;
    const lastComment = commentsLength ===1? 
      [
        post.comments[post.comments.length - 1],
       
      
    ]:commentsLength>1?[
        post.comments[post.comments.length - 1],
      post.comments[post.comments.length - 2],
    ] : [];

    const { likes, ...rest } = post;

    return {
      ...rest,
      commentsLength,
      lastComment,

      likeLength:likeLength,
      isLikedByYou:isLikedByYou,
      
    };
  });

  console.log(postsWithCommentsDetails,);

  return {
    posts: postsWithCommentsDetails,
    totalCount: postCount,
  };
}


//   async uploadImage(file: Express.Multer.File, email: string) {
//     try {
//       const fileBuffer = fs.createReadStream(file.path);

//       console.log('fileBuffer', fileBuffer);
//       const fileId = await this.driveService.uploadImage(
//         fileBuffer,
//         email,
//         '19TfG7QXBToAyBzY27s0Pev_kwJ2le_WK',
//         file.mimetype,
//         file.path,
//       );

//       if (!fileId) {
//         throw new InternalServerErrorException('Something went wrong!!');
//       }

//       return fileId;
//     } catch (error) {
//       console.log(error);
//       throw new InternalServerErrorException('Something went wrong!!');
//     }
//   }

  // async sendWhatsAppMessage() {
  //   this.whatsAppWebService.sendMessage('120363225438657833@g.us', 'Hey Babe',);
  // }

  async likeAndDislikePost(postId: string, userId: string) {
    try {
      const post = await this.prisma.kiitsocial.findUnique({
        where: {
          id: postId,
        },
      });

      if (!post) {
        throw new NotFoundException('Post Not Found.');
      }
      const likedBy = post.likes;

      if (likedBy.includes(userId)) {
        const index = likedBy.indexOf(userId);

        likedBy.splice(index, 1);
        const p = await this.prisma.kiitsocial.update({
          where: {
            id: postId,
          },
          data: {
            likes: likedBy,
          },
        });

        if (!p) {
          throw new InternalServerErrorException('Something went wrong');
        }

        return p;
      } else {
        const p = await this.prisma.kiitsocial.update({
          where: {
            id: postId,
          },
          data: {
            likes: [...likedBy, userId],
          },
        });

        if (!p) {
          throw new InternalServerErrorException('Something went wrong');
        }
        return p;
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  async addComment(dto: AddComments) {
    try {
      const post = await this.prisma.kiitsocial.findUnique({
        where: {
          id: dto.kiitSocialId,
        },
      });

      if (!post) {
        throw new NotFoundException('Post Not Found.');
      }

      const p = await this.prisma.comments.create({
        data: {
          comment: dto.comment,
         userId:dto.userId,
          isAnonymous:dto.isAnonymous,
          kiitsocialId: dto.kiitSocialId,
        },
        include:{
          user:true
        }
      });

      if (!p) {
        throw new InternalServerErrorException('Something went wrong');
      }
      return p;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  async deleteComments(commentId: string,userId:string) {
    try {
      const comment = await this.prisma.comments.findUnique({
        where: {
          id: commentId,
        },
      });

      if (!comment) {
        throw new NotFoundException('Comment Not Found.');
      }

      if(comment.userId !== userId){
        throw new NotFoundException('Comment Not Found.');
      }

      const p = await this.prisma.comments.delete({
        where: {
          id: commentId,
        },
      });

      if (!p) {
        throw new InternalServerErrorException('Something went wrong');
      }
      return p;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  async deletePost(postId: string,userId:string) {
    try {
      const post = await this.prisma.kiitsocial.findUnique({
        where: {
          id: postId,
        },
      });

      console.log(post);

      if (!post) {
        throw new NotFoundException('Post Not Found.');
      }

      // console.log(post.createdByEmail,createdByEmail,post.createdByEmail!=createdByEmail,post.createdByEmail.toString() != createdByEmail);
      if(post.userId !== userId){
        throw new NotFoundException('Post Not Found.');
      }

      const mediaId = post.image;
      if (mediaId) {
        await this.storageService.delete('media/' + mediaId);
      }

      

      //delete all comments
      const comments = await this.prisma.comments.findMany({
        where:{
          kiitsocialId:postId,
        }
      });

      if(comments.length > 0){

        
       const c = await this.prisma.comments.deleteMany({
          where:{
            kiitsocialId:postId,
          }
        });

        if(!c){
          throw new InternalServerErrorException('Something went wrong');
        }

       
      }
      const p = await this.prisma.kiitsocial.delete({
        where: {
          id: postId,
        },
      });
      if (!p) {
        throw new InternalServerErrorException('Something went wrong');
      }
      return p;
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Something went wrong');
    }
  }
    

  async fetchPostById(postId:string,id?:string){
    try {
      const posts = await this.prisma.kiitsocial.findUnique({
        where:{
          id:postId
        },
        include:{
          comments:{
            include:{
              user:{
                select:{
                  name:true,
                  email:true,
                  profileImage:true,
                  id:true,
                }
              }
            }
          },
          user:{
            select:{
              name:true,
              email:true,
              profileImage:true,
              id:true,
            }
          },
          
        }
      });
      if(!posts){
        throw new NotFoundException("Post Not Found");
      }

      console.log("posts",posts)

      const likeLength = posts.likes.length;

    
      const isLikedByYou = !id?false:posts.likes.includes(id)?true:false;

      const {likes,comments,...rest} = posts;

      return {
        ...rest,
        comments:comments.reverse(),
        likeLength:likeLength,
        isLikedByYou:isLikedByYou,
        
      }

    } catch (error) {
      console.log(error);
      if(error instanceof NotFoundException){
        throw error;
      }
      throw new InternalServerErrorException("Internal Error!");
    }
  }
}
