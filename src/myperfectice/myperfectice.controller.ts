import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MyperfecticeService } from './myperfectice.service';

@Controller('myperfectice')
export class MyperfecticeController {

    constructor(private readonly myperfecticeService:MyperfecticeService){
    }

    @Get("createTopic")
    async createTopic(){
        return this.myperfecticeService.createTopic();
    }
    @Get('getCourses')
    async getCourses(){
        return this.myperfecticeService.getCourses();
    }

    @Get("getTopics")
    async getTopics(){
        return this.myperfecticeService.getTopics();
    }

    @Get("createCourse")
    async createCourse(){
        return this.myperfecticeService.createCourse();
    }

    @Post("createQuestion")
    async createQuestion(@Body() dto:{
        id:string;
        question:{
            question:string;
            answer:string;
        }[];
    }){
        return this.myperfecticeService.createQuestion(dto.question,dto.id);
    }


    @Get("getTopicsByCourseId/:id")
    async getTopicsByCourseId(@Body() dto:{
        id:string;
    }){
        return this.myperfecticeService.getTopicsByCourseId(dto.id);
    }


    @Get("getQuestionsByTopicId/:id")
    async getQuestionsByTopicId(@Param() dto:{
        id:string;
    }){
        return this.myperfecticeService.getQuestionsByTopicId(dto.id);
    }
}

