import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { NextAuth } from 'src/auth/guard/NextAuth.guard';
import { TeacherService } from './teacher.service';
import { AddLinks, ReviewDto, TeacherDto } from './dto/Teacher.dto';
// import { SpreadsheetService } from 'src/google.service';

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

    @Get("/")
    async getAllTea(){
        return this.teacherService.getAllTeacher();
    }

    @Get("getData")
    async getData(){
        return this.teacherService.getData();
    } 
    
    @Get("getElectiveData")
    async getElectiveData(){
        return this.teacherService.getDataForElective();
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


    // @Post('convert')
    // async convertToGoogleSheet() {
    //   const filePath = 'sec-2.xlsx';
    //   const sheetTitle = 'ConvertedSheet';
  
    //   const spreadsheetId = await this.spreadSheetServie.convertFileToGoogleSheet(filePath, sheetTitle);
  
    //   return { spreadsheetId };
    // }

    // @Get('spread/:spreadsheetId')
    // async readData(@Param('spreadsheetId') spreadsheetId: string) {
    //   const range = 'Sheet1!A1:B10'; // Update with your actual sheet and range
    //   const data = await this.spreadSheetServie.readDataFromGoogleSheet(spreadsheetId, range);
      
    //   return { data };
    // }

    @Get("getNames")
    async getNames(){
        return this.getNames();
    }


    //get All Links
    @Get("links/getAllGroupLinks")
    async getAllGroupLinks(){
        return this.teacherService.GetAllGroupLinks();
    }

    @UseGuards(NextAuth)
    @Post("links/addGroupLinks")
    async addGroupLiks(@Body() dto:AddLinks ){
        return this.teacherService.addGroupLinks(dto)
    }

   
}
