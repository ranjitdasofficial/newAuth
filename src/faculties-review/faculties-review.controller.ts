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

  @Get('getAllPremiumMembers')
  async getAllPremiumMembers(){
    return this.facultiesReviewService.getAllPremiumMembers();
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

  @Get("disconnectAllSubjectsFromFaculty")
  async disconnectAllSubjectsFromFaculty(){
    return this.facultiesReviewService.disconnectAllSubjectsFromFaculties();
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
  async getFacultiesDetailsByBranchAndSemester(@Query("branch") branch: string, @Query("semester") semester: string, @Query('userId') userId: string){
    return this.facultiesReviewService.getFacultiesDetailsByBranchAndSemester(branch, semester,userId);
  } 


  
  
  @Get("getFacultiesDetailsByBranchAndSemesterTest")
  async getFacultiesDetailsByBranchAndSemesterTest(@Query("branch") branch: string, @Query("semester") semester: string){
    return this.facultiesReviewService.getFacultiesDetailsByBranchAndSemesterTest(branch, semester);
  }

  @Get(':facultiesId')

  async getFacultiesDetailsById(@Param('facultiesId') facultiesId: string){
    console.log(facultiesId)
    return this.facultiesReviewService.getFacultiesDetailsById(facultiesId);
  }
  

  @Post("likeDislike")
  async likeDislike(@Body() data: {facultyId: string, userId: string,event: string}){
    console.log(data)
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


  @Post('createFaculty')
  async createFaculty(@Body() data:{
    name:string,
   
  }){
    return this.facultiesReviewService.createFaculty(data);
  }
  
  @Get('/get/createManyFaculty')
  async createManyFaculty(){
    return this.facultiesReviewService.createManyFaculty();
  }

  @Post('disconnectFacultyFromSection')
  async disconnectFacultyFromSection(@Body() data:{
    facultyId:string,
    sectionId:string
  }){
    return this.facultiesReviewService.disconnectSectionsFromFaculty(data) ;
  }

  @Post('disconnectFacultyFromSections')
  async disconnectFacultyFromSections(@Body() data:{
    facultyId:string
  }){
    return this.facultiesReviewService.disconnectAllSectionsFromFaculties();
  }


  @Get('/get/updateElectiveFac')
  async updateElectiveFac(){
    return this.facultiesReviewService.enableElecFac();
  }


  @Get('/get/getElectiveFac')
  async getElectiveFac(){
    return this.facultiesReviewService.getElectiveFaculties();
  }

  @Post('generateReport')
  async generateReport(@Body() data:{
    branch:string,
    semester:number
  }){

console.log(data)
    return this.facultiesReviewService.generateReport(data);
  }

  


  @Post("increaseDecreaseLikes")
  async increaseDecreaseLikes(@Body() data:{
    facultyId:string,
    event:string
  }){
    return this.facultiesReviewService.increaseDecreaseLikes(data);
  }

  @Post('countNoOfPremiumUsers')
  async countNoOfPremiumUsers(){
    return this.facultiesReviewService.countNoOfPremiumUsers();
  }

 
}

