import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { AddNotesDTO, AddNotesSingleDTO, AddPyqsDTO, AddPyqsSingleDTO, SolutionDto } from './notes.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get('createBranches')
  async createBranches() {
    return this.notesService.createBranches();
  }

  @Get('createSemestersForEachBranch')
  async createSemestersForEachBranch() {
    return this.notesService.createSemestersForEachBranch();
  }

  @Get('findSemesterByBranch')
  async findSemesterByBranch() {
    return this.notesService.findSemesterByBranch();
  }

  @Get('getSemestersByBranchId/:branchId')
  async getSemestersByBranchId(@Param('branchId') branchId: string) {
    return this.notesService.getSemestersByBranchId(branchId);
  }

  @Get('getSemesterByName/:semesterName')
  async getSemesterByName(@Param('semesterName') semesterName: string) {
    return this.notesService.getSemesterByName(semesterName);
  }

  @Post('createSubject')
  async createSubject(@Body() dto: { data: [] }) {
    return this.notesService.createSubject(dto.data);
  }

  @Patch('addSubjectToSemester')
  async addSubjectToSemester(
    @Query() dto: { semesterId: string; subjectId: string },
  ) {
    return this.notesService.addExistingSubjectToSemester(
      dto.subjectId,
      dto.semesterId,
    );
  }

  @Get('getAllSubjects')
  async getAllSubjects() {
    return this.notesService.getAllSubjects();
  }

  @Post('addmultiSubjectToSemester')
  async addMultiSubjectToSemester(
    @Body() dto: { semesterId: string; subjectId: string[] },
  ) {
    console.log(dto);
    return this.notesService.addMultiPleSubjectsToSemester(
      dto.subjectId,
      dto.semesterId,
    );
  }

  @Post('addPYQSToSubject')
  async addPYQSToSubject(@Body() dto: AddPyqsDTO) {
    console.log(dto);
    return this.notesService.addPyqsToSubject(dto.subjectId, dto.pyqs);
  }

  @Post("deletePYQS")
  async deletePYQS(@Body() dto: {pyqsId: string,subjectId: string,solutionId: string|null}){
    return this.notesService.deletePYQS(dto);
  } 
  
  @Post("deleteSolution")
  async deleteSolution(@Body() dto: {pyqsId: string,subjectId: string,solutionId: string}){
    return this.notesService.deleteSolution(dto);
  }

  @Post('addPYQSToSubjectSingle')
  async addPYQSToSubjectSingle(@Body() dto: AddPyqsSingleDTO) {
    console.log(dto);
    return this.notesService.addPyqsToSubjectSingle(dto.subjectId, dto.pyqs);
  }

  @Post('addNotesToSubject')
  async addNotesToSubject(@Body() dto: AddNotesDTO) {
    console.log(dto);
    return this.notesService.addNotesToSubject(dto);  
  }

  @Post('addNotesToSubjectSingle')
  async addNotesToSubjectSingle(@Body() dto: AddNotesSingleDTO) {
    console.log(dto);
    return this.notesService.addNotesToSubjectSingle(dto);
  }

  @Post('deleteNotes')
  async deleteNotes(@Body() dto: { noteId: string, subjectId: string }) {
    return this.notesService.deleteNote(dto);
  }

  @Get('getPYQSByBranchIdAndSemesterId') 
  async getPYQSByBranchIdAndSemesterId(
    @Query() dto: { branchId: string; semesterId: string },
  ) {
    return this.notesService.getPYQSByBranchIdAndSemesterId(
      dto.branchId,
      dto.semesterId,
    );
  }

  @Get('getPYQSByBranchIdAndSemesterNumber')
  async getNotesByBranchIdAndSemesterId(
    @Query() dto: { branchId: string; semesterNumber: string; type: string },
  ) {
    console.log(dto);
    return this.notesService.getMaterialsByBranchIdAndSemesterId(dto);
  }

  @Get('UpdateDocument')
  async UpdateDocument() {
    return this.notesService.updateDocuments();
  }


  @Post('addSolutionsToPyqs')
  async addSolutionsToPyqs(

    @Body() dto: SolutionDto,
  ) {
    console.log(dto);
    return this.notesService.addSolutionToPyqs(dto);
  } 

  @Post('ActionOnSolutionReview')
  async actionOnSolutionReview(
    @Body()
    dto: {
      status: string;
      createdById: string;
      rejectedReason?: string;
    },
  ) {
    return this.notesService.actionOnSolutionReview(
      dto.status,
      dto.createdById,
      dto.rejectedReason,
    );
  }


  @Get('getAllReviewSolution')
  async getAllReviewSolution(){
    return this.notesService.getSolutionReview();
  }

  @Get("mysubmission")
  async getMySubmission(@Query() dto: {userId: string}){
    return this.notesService.getMySubmission(dto.userId);
  }


  @Get("payToUser/:refId")
  async payToUser(@Param("refId") refId:string){
    return this.notesService.paidToUser(refId);
  }

  @Get("getAllSubmission")
  async getAllSubmission(){
    return this.notesService.getAllSubmission();
  }



}