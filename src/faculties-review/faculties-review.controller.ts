import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FacultiesReviewService } from './faculties-review.service';

@Controller('faculties-review')
export class FacultiesReviewController {
  constructor(
    private readonly facultiesReviewService: FacultiesReviewService,
  ) {}

  @Get('create-sections')
  async createSections() {
    return this.facultiesReviewService.createSections();
  }

  @Get('get-sections/:semesterId')
  async getSectionBySemeseterId(@Param('semesterId') semesterId: string) {
    console.log(semesterId);
    return this.facultiesReviewService.getSectionBySemeseterId(semesterId);
  }

  @Post('assignFacultyToSection')
  async assignFacultyToSection(
    @Body() data: { facultyId: string; sectionId: string },
  ) {
    return this.facultiesReviewService.assignFaculty(data);
  }

  @Get('get-semester-section/:sectionId')
  async getSemesterSection(@Param('sectionId') sectionId: string) {
    return this.facultiesReviewService.getSectionBySectionId(sectionId);
  }

  @Get('getFac')
  async getFac() {
    return this.facultiesReviewService.addReviewsToFacultiesDetails();
  }

  @Get('getFacDetails')
  async getFacDetails() {
    return this.facultiesReviewService.getFacDetails();
  }


  @Get("getFacultiesIdsAndName")
  async getFacultiesIdsAndName(){
    return this.facultiesReviewService.getFacultiesIdsAndName();
  }


  @Post("assignSubjectToFaculty")
  async assignSubjectToFaculty(@Body() data: {facultiesId: string[], subjectId: string}){
    console.log(data);
    return this.facultiesReviewService.assignSubjectToFaculty(data);
  }  
  
  @Post("assignSectionToFaculty")
  async assignSectionToFaculty(@Body() data: {facultiesId: string[], sectionId: string}){
    console.log(data);
    return this.facultiesReviewService.assignSectionToFaculty(data);
  }

  @Get("getSectionsBySemesterId")
  async getSectionsBySemesterId(@Query("semesterId") semesterId: string){
    console.log(semesterId)
    return this.facultiesReviewService.getSectionsBySemesterId(semesterId);
  }

  @Get("getAllBranchInfo")
  async getAllBranchInfo(){
    return this.facultiesReviewService.getAllBranchInfo();
  }

  
  @Get("facultiesdetails")
  async facultiesDetails(){
    return this.facultiesReviewService.getFacultiesDetails();
  }


  @Get("getFacultiesDetailsByBranchAndSemester")
  async getFacultiesDetailsByBranchAndSemester(@Query("branch") branch: string, @Query("semester") semester: string){
    return this.facultiesReviewService.getFacultiesDetailsByBranchAndSemester(branch, semester);
  }

  @Get(':facultiesId')

  async getFacultiesDetailsById(@Param('facultiesId') facultiesId: string){
    console.log(facultiesId)
    return this.facultiesReviewService.getFacultiesDetailsById(facultiesId);
  }
  

  @Post("likeDislike")
  async likeDislike(@Body() data: {facultyId: string, userId: string,event: string}){
    return this.facultiesReviewService.likeDislikeFaculties(data.facultyId, data.userId,data.event);
  }

  @Post("addReview")
  async addReview(@Body() data: {
    facultyId: string, 
    userId: string,
    comments: string,
    rating: number,
    internalScore:number
    
  }){
    return this.facultiesReviewService.addReviewToFaculty(data);
  }

  @Post('updateContact')
  async updateContact(@Body() data:{
    data:{
      email?:string;
      phone?:string
    },
    id:string
  }){
    return this.facultiesReviewService.udateContact(data);

  }
}

