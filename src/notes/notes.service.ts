import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { AddNotesDTO, AddNotesSingleDTO, SolutionDto } from './notes.dto';
import { Readable } from 'stream';

import * as fs from 'fs';
import { DriveService } from 'src/drive.service';
import { add } from 'cheerio/lib/api/traversing';

interface pyqs {
  id: string;
  name: string;
  year: string;
  type: string;
}

@Injectable()
export class NotesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly driveService: DriveService,
  ) {}

  async createBranches() {
    try {
      return await this.prismaService.branch.createMany({
        data: [
          {
            name: 'CSE',
          },

          {
            name: 'CSSE',
          },
          {
            name: 'CSCE',
          },
          {
            name: 'IT',
          },
        ],
      });
    } catch (error) {
      throw new InternalServerErrorException('Error while creating branches');
    }
  }

  async createSemestersForEachBranch() {
    try {
      const branches = await this.prismaService.branch.findMany();
      const semesters = [1, 2, 3, 4, 5, 6, 7, 8];
      branches.forEach(async (branch) => {
        await this.prismaService.semester.createMany({
          data: semesters.map((semester) => {
            return {
              number: semester,
              branchId: branch.id,
            };
          }),
        });
      });
    } catch (error) {
      throw new InternalServerErrorException('Error while creating semesters');
    }
  }

  async findSemesterByBranch() {
    try {
      const branch = await this.prismaService.branch.findMany({
        include: {
          semesters: {
            include: {
              subjects: {
                select: {
                  name: true,
                  // pyqs: true,
                  // notes: true,
                  id: true,
                },
              },
            },
          },
        },
      });
      return branch;
    } catch (error) {
      throw new InternalServerErrorException('Error while fetching semesters');
    }
  }

  async getSemestersByBranchId(branchId: string) {
    try {
      const branch = await this.prismaService.branch.findUnique({
        where: {
          id: branchId,
        },
        include: {
          semesters: true,
        },
      });
      return branch;
    } catch (error) {
      throw new InternalServerErrorException('Error while fetching semesters');
    }
  }

  async createSubject(
    d: {
      name: string;
      SUBCODE: string;
      Credit: string;
    }[],
  ) {
    const data = d;
    try {
      const sub = await this.prismaService.subject.createMany({
        data: data,
      });

      return sub;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while creating subject');
    }
  }
  async addExistingSubjectToSemester(subjectId: string, semesterId: string) {
    try {
      if(!subjectId || !semesterId) throw new BadRequestException('Please provide valid data');
      const existingSubject = await this.prismaService.subject.findUnique({
        where: { id: subjectId },
        include: { semester: true },
      });

      if (!existingSubject) {
        return null;
      }

      const isAlreadyAssociated = existingSubject.semester.some(
        (semester) => semester.id === semesterId,
      );

      if (!isAlreadyAssociated) {
        const updatedSubject = await this.prismaService.subject.update({
          where: { id: subjectId },
          data: {
            semester: {
              connect: { id: semesterId },
            },
          },
          include: { semester: true },
        });

        console.log(updatedSubject)
        return updatedSubject;
      }

      console.log(existingSubject)
      // Return the existing subject if already associated with the semester
      return existingSubject;
    } catch (error) {
      console.log(error);
      // Handle errors gracefully
      throw new InternalServerErrorException(
        'Error while adding subject to semester',
      );
    }
  }

  async removeSubjectFromSemester(subjectId: string, semesterId: string) {
    try {
      const existingSubject = await this.prismaService.subject.findUnique({
        where: { id: subjectId },
        include: { semester: true },
      });

      if (!existingSubject) {
        return null;
      }

      const isAlreadyAssociated = existingSubject.semester.some(
        (semester) => semester.id === semesterId,
      );

      if (isAlreadyAssociated) {
        const updatedSubject = await this.prismaService.subject.update({
          where: { id: subjectId },
          data: {
            semester: {
              disconnect: { id: semesterId },
            },
          },
          include: { semester: true },
        });

        return updatedSubject;
      }

      // Return the existing subject if already associated with the semester
      return existingSubject;
    } catch (error) {
      // Handle errors gracefully
      throw new InternalServerErrorException(
        'Error while adding subject to semester',
      );
    }
  }

  async addMultiPleSubjectsToSemester(
    subjectIds: string[],
    semesterId: string,
  ) {
    try {
      const sb = await this.prismaService.semester.findUnique({
        where: { id: semesterId },
      });
      if (!sb) {
        return null;
      }
      const filterSubjectIDs = subjectIds.filter(
        (id) => !sb.subjectId.includes(id),
      );
      console.log(filterSubjectIDs);
      return await Promise.all(
        filterSubjectIDs.map(async (subjectId) => {
          // if (!isAlreadyAssociated) {

          await this.prismaService.subject.update({
            where: { id: subjectId },
            data: {
              semester: {
                connect: { id: semesterId },
              },
            },
          });
          // }
        }),
      );
    } catch (error) {
      // Handle errors gracefully
      console.log(error);
      throw new InternalServerErrorException(
        'Error while adding subject to semester',
      );
    }
  }

  async getAllSubjects() {
    try {
      return await this.prismaService.subject.findMany({
        select: { 
          id: true,
          name: true,
          SUBCODE: true,
          Credit: true,  
          folderId: true,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }


  async getAllSemesterAndBranch(){
    try {
      const branch= await this.prismaService.branch.findMany({
        include:{
          semesters:{
            select:{
             number:true,
             id:true,
            },

            
          
          }
        }
      })

      const allSubjects = await this.prismaService.subject.findMany({
        select: {
          id: true,
          name: true,
        }
      });

      return{
        branch,
        allSubjects
      }
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }

  async getSubjectsByBranchNameAndSemesterNumber(dto: {
    branchName: string;
    semesterNumber: string;
  }) {
    try {
      const branch = await this.prismaService.branch.findUnique({
        where: {
          name: dto.branchName,
        },
        include: {
          semesters: {
            where: {
              number: Number(dto.semesterNumber),
            },
            include: {
              subjects: {
                select: {
                  name: true,
                  SUBCODE: true,
                  Credit: true,
                  id: true,
                },

              },
              branch:{
                select:{
                  name:true,
                  id:true
                }
              }
            },
          },
        },
      });

      return branch;
    } catch (error) {
      throw new InternalServerErrorException('Error while fetching subjects');
    }
  }

  async getSemesterByName(branchId: string) {
    try {
      const branch = await this.prismaService.branch.findUnique({
        where: {
          id: branchId,
        },
        include: {
          semesters: true,
        },
      });
      const getAllSubjects = await this.getAllSubjects();
      return {
        branch,
        getAllSubjects,
      };
    } catch (error) {
      throw new InternalServerErrorException('Error while fetching semesters');
    }
  }

  //adding pyqs to the subject using subjectId
  async addPyqsToSubject(
    subjectId: string,
    pyqs: {
      mimeType: string;
      year: string;
      type: string;
      name: string;
      Question: string;
      solution: string | null;
    }[],
  ) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: { id: subjectId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }

      const updateSubject = await this.prismaService.subject.update({
        where: { id: subjectId },
        data: {
          pyqs: pyqs.map((p) => {
            return {
              ...p,
              status: p.solution ? 'VERIFIED' : 'NO-SOLUTION',
            };
          }),
        },
      });

      if (!updateSubject)
        throw new InternalServerErrorException('Failed to update');
      return {
        message: 'Successfully Uploaded',
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while adding pyqs');
    }
  }

  async addPyqsToSubjectSingle(
    subjectId: string,
    pyqs: {
      mimeType: string;
      year: string;
      type: string;
      name: string;
      Question: string;
      solution: string | null;
    },
  ) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: { id: subjectId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }

      const updateSubject = await this.prismaService.subject.update({
        where: { id: subjectId },
        data: {
          pyqs: {
            push: {
              ...pyqs,
              status: pyqs.solution ? 'VERIFIED' : 'NO-SOLUTION',
            },
          },
        },
        select: {
          pyqs: true,
          notes: true,
          id: true,
          folderId: true,
          name: true,
        },
      });

      // return {
      //   ...p,
      //   status: p.solution ? 'VERIFIED' : 'NO-SOLUTION',
      // };

      if (!updateSubject)
        throw new InternalServerErrorException('Failed to update');
      return updateSubject;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while adding pyqs');
    }
  }

  async deletePYQS(dto: {
    pyqsId: string;
    subjectId: string;
    solutionId: string | null;
  }) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: { id: dto.subjectId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }

      if (dto.solutionId) {
        await this.driveService.deleteFile(dto.solutionId);
      }
      const pyqs = await this.prismaService.subject.update({
        where: { id: dto.subjectId },
        data: {
          pyqs: {
            deleteMany: {
              where: {
                id: dto.pyqsId,
              },
            },
          },
        },
      });
      if (!pyqs) throw new InternalServerErrorException('Failed to delete');
      return {
        message: 'Successfully Deleted',
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async deleteSolution(dto: {
    pyqsId: string;
    subjectId: string;
    solutionId: string;
  }) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: { id: dto.subjectId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }

      // await this.driveService.deleteFile(dto.solutionId);
      const pyqs = await this.prismaService.subject.update({
        where: { id: dto.subjectId },
        data: {
          pyqs: {
            updateMany: {
              where: {
                id: dto.pyqsId,
              },
              data: {
                solution: null,
                status: 'NO-SOLUTION',
              },
            },
          },
        },
      });
      if (!pyqs) throw new InternalServerErrorException('Failed to delete');
      return {
        message: 'Successfully Deleted',
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async addNotesToSubject(dto: AddNotesDTO) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: { id: dto.subjectId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }

      const updateSubject = await this.prismaService.subject.update({
        where: { id: dto.subjectId },
        data: {
          notes: dto.Notes,
        },
      });

      return updateSubject;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while adding pyqs');
    }
  }

  async addNotesToSubjectSingle(dto: AddNotesSingleDTO) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: { id: dto.subjectId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }

      const updateSubject = await this.prismaService.subject.update({
        where: { id: dto.subjectId },
        data: {
          notes: {
            push: dto.Note,
          },
        },
      });

      return updateSubject;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while adding pyqs');
    }
  }

  async deleteNote(dto: { noteId: string; subjectId: string }) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: { id: dto.subjectId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }

      const notes = await this.prismaService.subject.update({
        where: { id: dto.subjectId },
        data: {
          notes: {
            deleteMany: {
              where: {
                id: dto.noteId,
              },
            },
          },
        },
      });
      if (!notes) throw new InternalServerErrorException('Failed to delete');
      return {
        message: 'Successfully Deleted',
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getPYQSByBranchIdAndSemesterId(branchId: string, semesterId: string) {
    try {
      const branch = await this.prismaService.branch.findUnique({
        where: {
          id: branchId,
        },
        include: {
          semesters: {
            where: {
              id: semesterId,
            },
            include: {
              subjects: {
                select: {
                  name: true,
                  pyqs: true,
                },
              },
            },
          },
        },
      });

      return branch;
    } catch (error) {
      throw new InternalServerErrorException('Error while fetching pyqs');
    }
  }

  async getMaterialsByBranchIdAndSemesterId(dto: {
    branchId: string;
    semesterNumber: string;
    type: string;
  }) {
    try {
      let selectFields: any = {
        name: true,
        SUBCODE: true,
        id: true,
        folderId: true,
        syllabus:true,
      };

      // console.log(dto.type === 'pyqs', dto.type);

      if (dto.type === 'pyqs') {
        selectFields.pyqs = true;
      } else if (dto.type === 'notes') {
        selectFields.notes = true;
      } else {
        throw new Error('Invalid type provided');
      }

      const material = await this.prismaService.branch.findUnique({
        where: {
          id: dto.branchId,
        },
        include: {
          semesters: {
            where: {
              number: Number(dto.semesterNumber),
            },
            include: {
              subjects: {
                select: selectFields,
              },
            },
          },
        },
      });

      // console.log(material);

      return material;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while fetching materials');
    }
  } 
  
  
  async getMaterialsByBranchIdAndSemesterIdWithoutAuth(dto: {
    branchId: string;
    semesterNumber: string;
    type: string;
  }) {
    try {
      let selectFields: any = {
        name: true,
        SUBCODE: true,
        id: true,
        folderId: true,
        syllabus:true,
      };


      if (dto.type === 'pyqs') {
        selectFields.pyqs = {
          select:{
            id:true,
            name:true,
            year:true,
            type:true,
            status:true,
            solutionUploadedBy:true,
            QuestionUploadedBy:true,
            mimeType:true,
            // Question:true,
            solution:true,
          }
        };
      } else if (dto.type === 'notes') {
        selectFields.notes = {
          select:{
            id:true,
            name:true,
            mimeType:true,
            isDownloadable:true,
            status:true,
            // year:true,
          }
        };
      } else {
        throw new Error('Invalid type provided');
      }

      const material = await this.prismaService.branch.findUnique({
        where: {
          id: dto.branchId,
        },
        include: {
          semesters: {
            where: {
              number: Number(dto.semesterNumber),
            },
            include: {
              subjects: {
                select: selectFields,
              },
            },
          },
        },
      });


      if (material) {
        material.semesters.forEach((semester) => {
          semester.subjects.forEach((subject) => {
            if (dto.type === 'pyqs' && subject.pyqs) {
              subject.pyqs.forEach((pq) => {
                pq.solution=pq.solution?'A':'B'  // Set status based on whether Question has data
              });
            }
          });
        });
      }
  

      // console.log(material);

      return material;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while fetching materials');
    }
  }

  async updateDocuments() {
    try {
      const subjects = await this.prismaService.subject.findMany();
      subjects.forEach(async (s) => {
        const updatePyqs =
          s.pyqs.length < 1
            ? []
            : s.pyqs.map((p) => {
                return {
                  ...p,
                  status: p.solution ? 'VERIFIED' : 'NO-SOLUTION',
                };
              });
        const updateNotes =
          s.notes.length < 1
            ? []
            : s.notes.map((n) => {
                return {
                  ...n,
                  status: 'VERIFIED',
                };
              });

        // console.log(updateNotes,updateNotes);
        const updated = await this.prismaService.subject.update({
          where: { id: s.id },
          data: {
            pyqs: updatePyqs,
            notes: updateNotes,
          },
        });
        console.log(updated);
      });

      // console.log('Migration completed successfully.');
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }

  async addSolutionToPyqs(dto: SolutionDto) {
    try {
      // const pyqs: pyqs = JSON.parse(dto.pyqs);
      //
      // if (!file || !pyqs.id || !pyqs.name || !pyqs.type || !pyqs.year)
      //   throw new UnauthorizedException('Please provide valid data');

      console.log(dto);
      if (
        !dto.fileId ||
        !dto.pyqs.id ||
        !dto.pyqs.name ||
        !dto.pyqs.type ||
        !dto.pyqs.year
      )
        throw new BadRequestException('Please provide valid data');

      const subject = await this.prismaService.subject.findUnique({
        where: {
          id: dto.subjectId,
          pyqs: {
            some: {
              id: dto.pyqs.id,
              OR: [{ status: 'REVIEW' }, { status: 'VERIFIED' }],
            },
          },
        },
      });

      if (subject)
        throw new NotFoundException(
          'Already Updated or Uploaded by someone else',
        );

      const crateReview = await this.prismaService.verifySolution.create({
        data: {
          pyqs: dto.pyqs,
          solution: dto.fileId,
          status: 'REVIEW',
          // subjectName:dto.subjectName,
          subjectId: dto.subjectId,
          userId: dto.userId,
          upiId: dto.upiId,
        },
      });

      if (!crateReview)
        throw new InternalServerErrorException('Something went wrong!');

      const final = await this.prismaService.subject.update({
        where: {
          id: dto.subjectId,
        },
        data: {
          pyqs: {
            updateMany: {
              where: {
                id: dto.pyqs.id,
                status: 'NO-SOLUTION',
              },
              data: {
                status: 'REVIEW',
                solutionUploadedBy: crateReview.id,
              },
            },
          },
        },
      });
      if (!final)
        throw new InternalServerErrorException('Something went wrong!');
      return final;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }

  async adminAddSolution(dto: {
    subjectId: string;
    questionId: string;
    solution: string;
  }) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: {
          id: dto.subjectId,
        },
      });

      if (!subject) throw new NotFoundException('Subject not found');
      const pyqs = await this.prismaService.subject.update({
        where: {
          id: dto.subjectId,
        },
        data: {
          pyqs: {
            updateMany: {
              where: {
                id: dto.questionId,
              },
              data: {
                status: 'APPROVED',
                solution: dto.solution,
              },
            },
          },
        },
      });
      if (!pyqs) throw new InternalServerErrorException('Failed to update');
      return {
        success: true,
      };
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error');
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

  async actionOnSolutionReview(
    status: string,
    createdById: string,
    rejectedReason?: string,
  ) {
    // console.log(status, subjecId, pyqsId, createdById);
    try {
      const isReviewExist = await this.prismaService.verifySolution.findUnique({
        where: {
          id: createdById,
        },
      });

      if (!isReviewExist) throw new NotFoundException('Review Not Found');

      if (isReviewExist.status === 'REVIEW') {
        const ap = await this.prismaService.verifySolution.update({
          where: {
            id: createdById,
          },
          data: {
            status: status,
            paymentStatus: status === 'REJECTED' ? 'REJECTED' : 'INITIATED',
            rejectedReason: status === 'REJECTED' ? rejectedReason : null,
          },
        });

        if (!ap)
          throw new InternalServerErrorException('Failed to Update Review');
        if (ap.status === 'REJECTED' && ap.solution) {
          // try {
          //   await this.driveService.deleteFile(ap.solution);
          // } catch (error) {
          //   await this.prismaService.verifySolution.update({
          //     where: {
          //       id: createdById,
          //     },
          //     data: {
          //       status: 'REVIEW',
          //       paymentStatus: 'PENDING',
          //       rejectedReason: null,
          //     },
          //   });
          //   throw error;
          // }

          await this.prismaService.subject.update({
            where: {
              id: isReviewExist.subjectId,
            },
            data: {
              pyqs: {
                updateMany: {
                  where: {
                    id: isReviewExist.pyqs.id,
                    status: 'REVIEW',
                  },
                  data: {
                    status: 'NO-SOLUTION',
                    solutionUploadedBy: null,
                  },
                },
              },
            },
          });
          return {
            success: true,
          };
        }
        const updatedReview = await this.prismaService.subject.update({
          where: {
            id: isReviewExist.subjectId,
          },
          data: {
            pyqs: {
              updateMany: {
                where: {
                  id: isReviewExist.pyqs.id,
                  status: 'REVIEW',
                },
                data: {
                  status: 'APPROVED',
                  solution: ap.solution,
                },
              },
            },
          },
        });

        console.log(updatedReview);

        return updatedReview;
      }
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async paidToUser(reviewId: string) {
    try {
      const refId = await this.prismaService.verifySolution.update({
        where: {
          id: reviewId,
        },
        data: {
          paymentStatus: 'PAID',
        },
      });
      await this.prismaService.user.update({
        where: {
          id: refId.userId,
        },
        data: {
          totalEarned: {
            increment: 10,
          },
        },
      });
      return {
        success: true,
      };
    } catch (error) {
      throw new InternalServerErrorException('Something went Wrong!');
    }
  }

  async getSolutionReview() {
    try {
      return await this.prismaService.verifySolution.findMany({
        include: {
          user: true,
          subject: {
            select: {
              name: true,
              id: true,
            },
          },
        },
      });
    } catch (error) {
      console.log(error);

      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getMySubmission(userId: string) {
    try {
      const submission = await this.prismaService.verifySolution.findMany({
        where: {
          userId: userId,
        },
        include: {
          subject: {
            select: {
              name: true,
              id: true,
            },
          },
        },
      });

      const totalEarned = await this.prismaService.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          totalEarned: true,
        },
      });
      return {
        submission,
        totalEarned,
      };
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }

  async getAllSubmission() {
    try {
      return await this.prismaService.verifySolution.findMany({
        include: {
          user: {
            select: {
              name: true,
            },
          },
          subject: {
            select: {
              name: true,
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }

  async createfolder() {
    try {
      const allSubjects = await this.prismaService.subject.findMany({});
      for (const sub of allSubjects) {
        const createSUbjectFolder = await this.driveService.createFolder(
          sub.name,
        );
        if (!createSUbjectFolder) {
          throw new InternalServerErrorException('Failed to create folder');
        }

        await this.prismaService.subject.update({
          where: {
            id: sub.id,
          },
          data: {
            folderId: createSUbjectFolder,
          },
        });
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async updateQuestions(
    subjectId: string,
    PyqId: string,
    Question: string,
    Type: string,
  ) {
    try {
      console.log(
        !subjectId,
        !PyqId,
        !Question,
        !Type,
        subjectId,
        PyqId,
        Question,
        Type,
      );
      if (!subjectId || !PyqId || !Question || !Type)
        throw new BadRequestException('Please provide all the required fields');

      console.log(PyqId, subjectId, Question, Type);
      const subject = await this.prismaService.subject.findUnique({
        where: { id: subjectId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }
      const updateSUbject = await this.prismaService.subject.update({
        where: {
          id: subjectId,
        },
        data: {
          pyqs: {
            updateMany: {
              where: {
                id: PyqId,
              },
              data: {
                Question: Question,
                type: Type,
              },
            },
          },
        },
      });

      console.log(updateSUbject);
      // console.log(subject.pyqs);

      if (!updateSUbject)
        throw new InternalServerErrorException('Failed to update');

      return true;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while adding pyqs');
    }
  }

  async testC() {
    const subjectId = '65d2211d1bdc9aab41338806';
    const PyqId = '2bd33cf1-eca6-4fd0-a23c-2e6677da93bb';
    try {
      // const findUnique = await this.prismaService.subject.findMany({
      //   where:{
      //     id:subjectId,
      //     pyqs:{
      //       some:{
      //         id:PyqId
      //       }
      //     }
      //   }
      // })

      const updateSUbject = await this.prismaService.subject.update({
        where: {
          id: subjectId,
        },
        data: {
          pyqs: {
            updateMany: {
              where: {
                id: PyqId,
              },
              data: {
                Question: 'Hello',
                type: 'MCQ',
              },
            },
          },
        },
      });

      console.log(updateSUbject);
      return updateSUbject;
    } catch (error) {
      throw new InternalServerErrorException('Error while adding pyqs');
    }
  }

  async getNotesAndPyqsBySubjectId(subjectId: string) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: {
          id: subjectId,
        },
        select: {
          pyqs: true,
          notes: true,
          id: true,
          folderId: true,
          name: true,
        },
      });

      return subject;
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async deleteMutiplePYQSAndSolution(dto: {
    ids: string[];
    subjectId: string;
    type: string;
  }) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: { id: dto.subjectId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }
      //delete based on types either Question or solution
      const selectData =
        dto.type === 'PYQS'
          ? {
              pyqs: {
                deleteMany: {
                  where: {
                    id: {
                      in: dto.ids,
                    },
                  },
                },
              },
            }
          : {
              notes: {
                deleteMany: {
                  where: {
                    id: {
                      in: dto.ids,
                    },
                  },
                },
              },
            };

      const pyqs = await this.prismaService.subject.update({
        where: { id: dto.subjectId },
        data: selectData,
      });
      if (!pyqs) throw new InternalServerErrorException('Failed to delete');
      return {
        message: 'Successfully Deleted',
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async adminAddQuestion(dto: {
    subjectId: string;
    note: string;
    name: string;
  }) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: { id: dto.subjectId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }

      const updateSubject = await this.prismaService.subject.update({
        where: { id: dto.subjectId },
        data: {
          notes: {
            push: {
              Notes: dto.note,
              name: dto.name,
              status: 'APPROVED',
            },
          },
        },
      });

      return updateSubject;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while adding pyqs');
    }
  }
  async addSubject(dto: { name: string; folderId:string, code?: string; credit?: string, }) {
    try {

      const subject = await this.prismaService.subject.create({
        data: {
          name: dto.name,
          SUBCODE: dto.code,
          Credit: dto.credit,
          folderId:dto.folderId
        },
      });

      if (!subject)
        throw new InternalServerErrorException('Failed to add subject');

      return subject;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async deleteSubject(subjectId: string) {
    try {
      const subject = await this.prismaService.subject.delete({
        where: {
          id: subjectId,
        },
      });

      if (!subject)
        throw new InternalServerErrorException('Failed to delete subject');
      return {
        message: 'Successfully Deleted',
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async addSyllabus(dto: { subjectId: string; syllabus: string }) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: { id: dto.subjectId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }

      const updateSubject = await this.prismaService.subject.update({
        where: { id: dto.subjectId },
        data: {
          syllabus: dto.syllabus,
        },
      });

      return updateSubject;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while adding pyqs');
    }
  }

  async removeSyllabus(subjectId: string) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: { id: subjectId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }

      const updateSubject = await this.prismaService.subject.update({
        where: { id: subjectId },
        data: {
          syllabus: null,
        },
      });

      return updateSubject;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while adding pyqs');
    }
  }

  // -----------------  Submission Note for Subjects starts here -------------------


  async createSubjectsForSubmission(dto: { name: string }[]) {
    try {
      return await this.prismaService.subjectSubmission.createMany({
        data: dto,
      });
    } catch (error) {
      throw new InternalServerErrorException('Error while creating subjects');
    }
  }


  async addTopicToSubjectSubmission(dto: { names: string[]; subjectSubmissionId: string }){
    try {
      const subject = await this.prismaService.subjectSubmission.findUnique({
        where: { id: dto.subjectSubmissionId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }

      const addTopicToSubject =await this.prismaService.subjectTopics.createMany({
        data: dto.names.map((name) => {
          return {
            name: name,
            subjectSubmissionId: dto.subjectSubmissionId,
          };
        }),
      });
      return addTopicToSubject;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while adding pyqs');
    }
  }


  async addSubmissionToSubjectTopic(dto: { userId: string; upiId: string,submissionLink:string; subjectTopicsId: string }){
    try {
      const subject = await this.prismaService.subjectTopics.findUnique({
        where: { id: dto.subjectTopicsId },
        include: { subjectTopicSubmission: true },
      });
      if (!subject) {
        throw new NotFoundException('Topic not found');
      }

      if(subject.noOfSubmissions>=10){
        throw new BadRequestException('You can not submit more than 10 submissions');
      }

      if(subject.subjectTopicSubmission.some((s)=>s.userId===dto.userId)){
        throw new BadRequestException('You have already submitted');
      }


      const createTopicSubmission =await this.prismaService.subjectTopicsSubmission.create({
        data: {
          submissionLink: dto.submissionLink,
          subjectTopicsId: dto.subjectTopicsId,
          userId: dto.userId,
          upiId: dto.upiId,
        },
      })

      if(!createTopicSubmission) throw new InternalServerErrorException('Failed to add submission');
      await this.prismaService.subjectTopics.update({
        where: { id: dto.subjectTopicsId },
        data: {
        noOfSubmissions:{
          increment:1
        } 
        },
      });

      await this.prismaService.subjectSubmission.update({
        where: { id: subject.subjectSubmissionId },
        data: {
        totalSubmissions:{
          increment:1
        } 
        },
      });
      return createTopicSubmission;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while adding pyqs');
    }
  }


  async getAllSubjectSubmission(){
    try {
      return await this.prismaService.subjectSubmission.findMany({
        select:{
          id:true,
          name:true,
          totalSubmissions:true,
          subjectTopics:{
            select:{
              id:true,
              name:true,
              noOfSubmissions:true,
              subjectTopicSubmission:{
                select:{
                  userId:true,

                }
              }
            }
          }
        },
       
      });




    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }


  async getAllSubjectSubmissionByAdmin(){
    try {
      return await this.prismaService.subjectTopicsSubmission.findMany({
       
        include:{
          user:true,
          
          subjectTopics:{
            include:{
              subjectSubmission:true
            }
          }
        },
        orderBy:{
          createdAt:"desc"
        }
      });




    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }




  // -----------------  Submission Note for Subjects ends here -------------------
}
