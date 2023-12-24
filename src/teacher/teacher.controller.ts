import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { NextAuth } from 'src/auth/guard/NextAuth.guard';
import { TeacherService } from './teacher.service';
import { ReviewDto, TeacherDto } from './dto/Teacher.dto';

@Controller('teacher')
export class TeacherController {
    constructor(private readonly teacherService:TeacherService){}
    @UseGuards(NextAuth)
    @Post("/")
    async addTeacher(@Body() dto:TeacherDto){
        console.log("here")
        return this.teacherService.addTeacher(dto);
    }

    // @UseGuards(NextAuth)
    @Get("/")
    async getAllTeacher(){
        return this.teacherService.getAllTeacher();
    }

    @UseGuards(NextAuth)
    @Post("addReview/:id")
    async addReview(@Param("id") id:string,@Body() review:ReviewDto){
        console.log("hello")
        return this.teacherService.addReview(id,review);
    }

    // @UseGuards(NextAuth)
    @Get(":id")
    async getTeacher(@Param("id") id:string){
        return this.teacherService.getTeacherById(id);
    }

    @UseGuards(NextAuth)
    @Post("likeDislike/:id")
    async likeDislike(@Param("id") id:string,@Body() likeDislike:{like:boolean,email:string}){
        return this.teacherService.likeAndDislike(id,likeDislike.like,likeDislike.email);
    }
}
