import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { NextAuth } from 'src/auth/guard/NextAuth.guard';
import { TeacherService } from './teacher.service';
import { ReviewDto, TeacherDto } from './dto/Teacher.dto';

@Controller('teacher')
export class TeacherController {
    constructor(private readonly teacherService:TeacherService){}
    @Post("addTeacher")
    async addTeacher(){
        console.log("here")
        return this.teacherService.addTeacher();
    }

    // @UseGuards(NextAuth)
    @Get("getAllElective/")
    async getAllTeacher(){
        return this.teacherService.getAllElective();
    }

    @Get("getData")
    async getData(){
        return this.teacherService.getData();
    }

    @UseGuards(NextAuth)
    @Post("addReview/:id")
    async addReview(@Param("id") id:string,@Body() review:ReviewDto){
        console.log("hello")
        return this.teacherService.addReview(id,review);
    }

    @UseGuards(NextAuth)
    @Post("addElectiveReview/:id")
    async addElectiveReview(@Param("id") id:string,@Body() review:ReviewDto){
        console.log("hello")
        return this.teacherService.addReviewElective(id,review);
    }

    // @UseGuards(NextAuth)
    @Get(":id")
    async getTeacher(@Param("id") id:string){
        return this.teacherService.getTeacherById(id);
    }

    @Get("elective/:id")
    async getElective(@Param("id") id:string){
        return this.teacherService.getElectiveById(id);
    }


    @UseGuards(NextAuth)
    @Post("likeDislike/:id")
    async likeDislike(@Param("id") id:string,@Body() likeDislike:{like:boolean,email:string}){
        return this.teacherService.likeAndDislike(id,likeDislike.like,likeDislike.email);
    }


    @UseGuards(NextAuth)
    @Post("likeDislikeElective/:id")
    async likeDislikeElective(@Param("id") id:string,@Body() likeDislike:{like:boolean,email:string}){
        return this.teacherService.likeAndDislikeReview(id,likeDislike.like,likeDislike.email);
    }

   
}
