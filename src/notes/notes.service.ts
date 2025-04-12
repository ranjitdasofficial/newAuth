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
import { StorageService } from 'src/storage/storage.service';
import { compress } from 'compress-pdf';

import { PDFDocument } from 'pdf-lib'; // For structural optimization
import * as path from 'path';

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
    private readonly storageService: StorageService,
  ) { }

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
      if (!subjectId || !semesterId) throw new BadRequestException('Please provide valid data');
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
          // pyqs:true,
          notes: true,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }


  async getAllSemesterAndBranch() {
    try {
      const branch = await this.prismaService.branch.findMany({
        include: {
          semesters: {
            select: {
              number: true,
              id: true,
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

      return {
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
              branch: {
                select: {
                  name: true,
                  id: true
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
                nSolution: null,
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
        syllabus: true,
        youtubePlaylist: {
          select: {
            id: true,
            title: true,
            noOfVideos: true,
          }
        }
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
        syllabus: true,
        youtubePlaylist: {
          select: {
            id: true,
            title: true,
            noOfVideos: true,
          }
        }
      };


      if (dto.type === 'pyqs') {
        selectFields.pyqs = {
          select: {
            id: true,
            name: true,
            year: true,
            type: true,
            status: true,
            solutionUploadedBy: true,
            QuestionUploadedBy: true,
            mimeType: true,
            // Question:true,
            nSolution: true,
          }
        };
      } else if (dto.type === 'notes') {
        selectFields.notes = {
          select: {
            id: true,
            name: true,
            mimeType: true,
            isDownloadable: true,
            status: true,
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
                pq.nSolution = pq.nSolution ? 'A' : 'B'  // Set status based on whether Question has data
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
                nSolution: dto.solution,
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
                  nSolution: ap.solution,
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

  async optimizeAndCompressPdf(fileContent: Buffer): Promise<Buffer> {
    try {
      // Step 1: Optimize the PDF structure using pdf-lib
      const pdfDoc = await PDFDocument.load(fileContent);
      pdfDoc.setCreator('NestJS Compression Service');
      pdfDoc.setProducer('PDF-lib');

      // Save optimized PDF to buffer
      const optimizedBuffer = await pdfDoc.save({ useObjectStreams: false });

      // Step 2: Compress using Ghostscript via compress-pdf
      const tempDir = path.resolve(__dirname, 'temp');
      await fs.promises.mkdir(tempDir, { recursive: true });

      const originalFilePath = path.join(tempDir, 'original.pdf');
      const compressedFilePath = path.join(tempDir, 'compressed.pdf');

      // Write optimized buffer to temporary file
      await fs.promises.writeFile(originalFilePath, optimizedBuffer);

      console.log('Compressing PDF...');
      const compressedBuffer = await compress(originalFilePath);

      // Clean up temporary files
      await fs.promises.unlink(originalFilePath);

      return compressedBuffer;
    } catch (error) {
      console.error('Error during PDF optimization/compression:', error.message);
      throw error;
    }
  }

  async transferFile(fileId: string, key: string): Promise<void> {
    // Step 1: Download file from Google Drive
    const fileContent = await this.driveService.downloadFile(fileId);

    // Step 2: Upload file to Amazon R2

    const compressedContent = await this.optimizeAndCompressPdf(fileContent);

    await this.storageService.uploadFileToAmazonR2(
      key,
      compressedContent,
    )
    const tempDir = path.resolve(__dirname, 'temp');
    const compressedFilePath = path.join(tempDir, 'compressed.pdf');
    await fs.promises.unlink(compressedFilePath);
    console.log('File transferred successfully');

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

      const subjectSlug = subject.name.replace(/ /g, '-').toLowerCase();

      await this.transferFile(Question, `${subjectSlug}/questions/${Question}.pdf`);



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
                nQuestion: Question,
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
  async addSubject(dto: { name: string; folderId: string, code?: string; credit?: string, }) {
    try {

      const subject = await this.prismaService.subject.create({
        data: {
          name: dto.name,
          SUBCODE: dto.code,
          Credit: dto.credit,
          folderId: dto.folderId
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


  async addTopicToSubjectSubmission(dto: { names: string[]; subjectSubmissionId: string }) {
    try {
      const subject = await this.prismaService.subjectSubmission.findUnique({
        where: { id: dto.subjectSubmissionId },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }

      const addTopicToSubject = await this.prismaService.subjectTopics.createMany({
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


  async addSubmissionToSubjectTopic(dto: { userId: string; upiId: string, submissionLink: string; subjectTopicsId: string }) {
    try {
      const subject = await this.prismaService.subjectTopics.findUnique({
        where: { id: dto.subjectTopicsId },
        include: { subjectTopicSubmission: true },
      });
      if (!subject) {
        throw new NotFoundException('Topic not found');
      }

      if (subject.noOfSubmissions >= 10) {
        throw new BadRequestException('You can not submit more than 10 submissions');
      }

      if (subject.subjectTopicSubmission.some((s) => s.userId === dto.userId)) {
        throw new BadRequestException('You have already submitted');
      }


      const createTopicSubmission = await this.prismaService.subjectTopicsSubmission.create({
        data: {
          submissionLink: dto.submissionLink,
          subjectTopicsId: dto.subjectTopicsId,
          userId: dto.userId,
          upiId: dto.upiId,
        },
      })

      if (!createTopicSubmission) throw new InternalServerErrorException('Failed to add submission');
      await this.prismaService.subjectTopics.update({
        where: { id: dto.subjectTopicsId },
        data: {
          noOfSubmissions: {
            increment: 1
          }
        },
      });

      await this.prismaService.subjectSubmission.update({
        where: { id: subject.subjectSubmissionId },
        data: {
          totalSubmissions: {
            increment: 1
          }
        },
      });
      return createTopicSubmission;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while adding pyqs');
    }
  }


  async getAllSubjectSubmission() {
    try {
      return await this.prismaService.subjectSubmission.findMany({
        select: {
          id: true,
          name: true,
          totalSubmissions: true,
          subjectTopics: {
            select: {
              id: true,
              name: true,
              noOfSubmissions: true,
              subjectTopicSubmission: {
                select: {
                  userId: true,

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


  async getAllSubjectSubmissionByAdmin() {
    try {
      return await this.prismaService.subjectTopicsSubmission.findMany({

        include: {
          user: true,

          subjectTopics: {
            include: {
              subjectSubmission: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });




    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }




  // -----------------  Submission Note for Subjects ends here -------------------


  //get the pyqs 
  async getAllPyqsBySubjectId() {
    try {
      const allSubjects = []

      const pyqsAndSol = [];

      for (const subject of allSubjects) {
        const pyqs = subject.pyqs;
        if (pyqs.length === 0) {
          continue;
        }

        for (const pyq of pyqs) {
          if (pyq.type.toUpperCase() !== pyq.type) {
            pyqsAndSol.push({
              subject: subject.name,
              pyqsName: pyq.name,
              year: pyq.year,
              type: pyq.type,
              pyqs: pyq.Question,
            });
          }
        }
      }

      return pyqsAndSol;
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getAllSolutions() {
    try {
      const allSubjects = [
        {
          "id": "65d212841bdc9aab413387ec",
          "name": "PHYSICS",
          "SUBCODE": "PH10001",
          "Credit": "3",
          "folderId": "1NBj0CZ5uc-ThiSApU58PpX9xKR_vhrv0",
          "pyqs": [
            {
              "id": "b76aebf7-f644-47d8-a336-5b64b062909e",
              "name": "Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1P4VRrvfw0nBtGY6kKFqIBlBSR0SiEq6W",
              "solution": null,
              "nQuestion": "1z3pA-bjuGhnP7vLuVkBl-X-DUWwTcOyP",
              "nSolution": null
            },
            {
              "id": "325fc8d4-8d65-4a26-8594-42b550a54f0e",
              "name": "Mid Sem Exam",
              "year": "2014",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15aG2bPXuy3dUUeMuREovcGQUiSkHbqUj",
              "solution": null,
              "nQuestion": "1_Xj6wLAcOaWGDVKoSAOyDkWapOs0iEs2",
              "nSolution": null
            },
            {
              "id": "035b97ab-e49a-4b80-aa51-1ed72c2613d7",
              "name": "Autumn End Sem Exam",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1VV2o-BDtEXEnIt44DDUmsikr4O4Mj5kA",
              "solution": null,
              "nQuestion": "10Pdrf7dHgAadYNDiBb6ZsL3-G10vcpaQ",
              "nSolution": null
            },
            {
              "id": "713afbd8-7aea-40cd-958a-413690a76f52",
              "name": "Spring End Sem Exam",
              "year": "2017",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1gLTihFO0hNJW1-1BvetSWdw20PJ8-jY8",
              "solution": null,
              "nQuestion": "1gLTihFO0hNJW1-1BvetSWdw20PJ8-jY8",
              "nSolution": null
            },
            {
              "id": "9a138710-e9a2-464b-915d-a9a8c31bfcd2",
              "name": "Set 1 Spring End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1V-FgbpdDw6ehOHmG7rGVi9r3qxpi5PCR",
              "solution": null,
              "nQuestion": "1hd1iR6_sQuj2QiRZcn-Ka15IIRpXVwU8",
              "nSolution": null
            },
            {
              "id": "fce0fb15-5fe5-41a2-8440-681bb6f595f4",
              "name": "Set 2 Spring End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1R8uF7UBUOHD7aM9m2jYzahh2eMVq1OLO",
              "solution": null,
              "nQuestion": "1KrhbU71Etevd-WDeIrOcgZpx13TJhoux",
              "nSolution": null
            },
            {
              "id": "bb02e2ab-dcb9-4a0c-b2ab-9d16a32ab38d",
              "name": "Autumn End Sem Exam",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "160FDiAf2k_xJ3yxe1xNy69ZI9v5U85Wk",
              "solution": null,
              "nQuestion": "10WJkJiJgKmT2J2TOplCLopQDZDbhCzH_",
              "nSolution": null
            },
            {
              "id": "d37689a8-0148-4860-b4ed-a4bfd4a1b5a2",
              "name": "Set 1 Spring End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1bN-pf--FQ5NWm5de5pSJ1SSLs8qrWO7x",
              "solution": null,
              "nQuestion": "1MwziotITO0T1oRosMPBiiahPqXxQAWwW",
              "nSolution": null
            },
            {
              "id": "b67e35c7-ef90-470e-a0f7-2858145df8bf",
              "name": "Set 2 Spring End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hrOc5NC2MHg3l7SrcoeSpqRxRTrWf8nR",
              "solution": null,
              "nQuestion": "1CRm5svqqqVahx6lnUuvv7vfi2N3qwkLT",
              "nSolution": null
            },
            {
              "id": "c4f2996e-1fef-413f-8ef6-74b2e851b544",
              "name": "Set 3 Spring End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1X0A21znqnH2uFIsp7w0TjIv_EvMlGpOh",
              "solution": null,
              "nQuestion": "13tuCi0Jypjv8RmUxVHVkLFSrjNQYgY6G",
              "nSolution": null
            },
            {
              "id": "2afefb39-b9bf-4c55-895c-d8438d7d7cf0",
              "name": "Set 1 Autumn End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1uTa4XzAieVVO95jsizVSQ4PBnzQsn7-B",
              "solution": null,
              "nQuestion": "1aATWgIdbZ1z5AHBuXeESTtAxuSVQOEZx",
              "nSolution": null
            },
            {
              "id": "f73ee01b-15a7-406b-8cfc-e642e1af14d1",
              "name": "Set 2 Autumn End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tAt3r4MKblHHZku8gvJ2xtwr53jJmYe8",
              "solution": null,
              "nQuestion": "1g0U0Q83BNBq27BrVVlhTEYVLznrHiCHb",
              "nSolution": null
            },
            {
              "id": "97458fd3-8f1c-4717-b602-ff33c287fdad",
              "name": "Supplementary Autumn End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10HV1RX_IoD8b1VINYRho9GHvaXnR1kqG",
              "solution": null,
              "nQuestion": "1W5q0onYrHosNJA9PILIQlHPqdfCTJrOi",
              "nSolution": null
            },
            {
              "id": "5f07bd0b-13f0-4ac7-a3ca-79769cd60cbb",
              "name": "Mid Sem",
              "year": "2011",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "18AOwA3Zqp1hh7HNSkoPrDLGFo60Kq1XC",
              "solution": null,
              "nQuestion": "1GY4u5f1MAbgjtN2SfxW4BOz7Xv6_isKl",
              "nSolution": null
            },
            {
              "id": "8a723a5c-05df-428a-9aa6-03ae99c04cfe",
              "name": "MakeUp Mid Sem",
              "year": "2011",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1nX0y1FugzbJQiNiN64egc0So1FtMbjvQ",
              "solution": null,
              "nQuestion": "1yIZHnzopv5wH3DZsk-lySK9T25CS1fJq",
              "nSolution": null
            },
            {
              "id": "7fb10451-9f72-49fc-bb6d-aefc35eb102e",
              "name": "Spring End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12XFQf92Z-pUpqsz-_zyFQY3CTv3DSx09",
              "solution": null,
              "nQuestion": "1W7wPgPb-D0EApEat3wia_DTVmKBoTuca",
              "nSolution": null
            },
            {
              "id": "a0a96571-bb8a-4543-9ff6-4a5f06f98e75",
              "name": "Spring End Sem-2",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1R4z4chY0WxuNxFUNolqFGqSlr0doL-FW",
              "solution": null,
              "nQuestion": "1_CmoGdj-BKClWv2MjmpNb39kwmVyiuPY",
              "nSolution": null
            },
            {
              "id": "91ea8ad3-a695-42e4-9027-e69c17a0de2d",
              "name": "Supplementary",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13NDmrGwuHkYA0fF0WpoT5brBHe_nMBDA",
              "solution": null,
              "nQuestion": "143EUDOQvCLBlNsDVv28d8y2NTnjZ7qUW",
              "nSolution": null
            },
            {
              "id": "a83e63a5-dbb8-4a8f-bf17-c5ead1adaa0e",
              "name": "Autumn End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xzOGk4mk6XKBuv4T2jJWnEMp8sBRHSZ9",
              "solution": null,
              "nQuestion": "19gZY5t9ZAFv0ZVtuxIHUKoT3Zs0uJeBZ",
              "nSolution": null
            },
            {
              "id": "9c69a561-c275-4e89-a192-866864beac64",
              "name": "Mid Sem",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1CZ7anLA-V4f0FY4HU2EIgBcAUobJ2lO-",
              "solution": null,
              "nQuestion": "1gkc0BYKFiNxftfeMk72uSGTfGRLWUy1K",
              "nSolution": null
            },
            {
              "id": "2469328c-46cd-4108-9f43-588834b18bc7",
              "name": "End Sem",
              "year": "2008",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hJs9G1k3gDfZgiJsoYtPXCOn6V-SO1WH",
              "solution": null,
              "nQuestion": "1ugmHrwmt5WPI6ocJwEDnlk79CVLON3rq",
              "nSolution": null
            },
            {
              "id": "fd8cf905-7a0c-43ed-b5d7-6111953461f5",
              "name": "Autumn End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1uqW81nyq1SwWXJQTyeQ8lV1EyjyQy74J",
              "solution": null,
              "nQuestion": "10LI_j88doQMedI9cXccwRW-thQSV9clt",
              "nSolution": null
            },
            {
              "id": "28d4b7c0-ee8b-48a0-8933-a8af8ceff483",
              "name": "End Sem",
              "year": "2012",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ULABXAcRD8G1kXnf6-6ylpoEj-lLy6zz",
              "solution": null,
              "nQuestion": "18dHiIhpWrbnHU7MUij9aOncjUaoEsPT7",
              "nSolution": null
            },
            {
              "id": "09b8f7a3-9c61-4e23-83b8-719d56174a44",
              "name": "Spring End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1KQcN18ddh7bZJ6UFv2JZex7AFAUksC2f",
              "solution": null,
              "nQuestion": "1qwo57lG7XhZQdADR2lzt0w3YiQBc9CjU",
              "nSolution": null
            },
            {
              "id": "b075fbec-5a92-4267-adcb-3b61a88273b5",
              "name": "Autumn End Sem-3",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1SINhol0uLmRRKtluBbo24eZB2ivxfAby",
              "solution": null,
              "nQuestion": "1NqVVvwxV2l2VWai1vdWgecchNnXaFjyS",
              "nSolution": null
            },
            {
              "id": "cdce55f7-e31b-4ce6-9052-20bec7809d9a",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1AvQvCdqDxeVPvTs57sqMKjwJljfRLpXR",
              "solution": null,
              "nQuestion": "1f-NA0PFISk2E8fdXZTzMSidfGpN9Jcd8",
              "nSolution": null
            },
            {
              "id": "05f611e9-401f-4707-b55e-edd0b9690fab",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1lBwzs3uyRB6piSKft74wi6lyf5CACSAY",
              "solution": null,
              "nQuestion": "14ii-9_Wx7Pb6ykxSd27dzv0kpxXBuTX0",
              "nSolution": null
            },
            {
              "id": "d3d82e73-05a5-4182-a51f-e8de3dd80dd8",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1OhGKbI0YMpd0WX3g3ncMeTGNBjLsRbBs",
              "solution": null,
              "nQuestion": "1lBliwOq48boqlIp9FpPyb6DX_jZdJXY6",
              "nSolution": null
            },
            {
              "id": "d79e122d-964d-4f16-961e-db0d1c07e130",
              "name": "Autumn End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10NhSnSvnEANloPFGG4mXimZeEqVyavRD",
              "solution": null,
              "nQuestion": "1D5I1nWCCbLj59BC9JIa5MfGbVjEHVVKM",
              "nSolution": null
            },
            {
              "id": "70e72cd9-e02e-4153-acea-ce277ba6ce8f",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1CzjsoPFt8lYXnj93NKkbiobRGt3-ihWW",
              "solution": null,
              "nQuestion": "1irJGqX2UJMMxPDKeKEXEtGsx4FpUQr3k",
              "nSolution": null
            },
            {
              "id": "1453ac90-4a55-4dbc-b98f-4688cffe4104",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RbDhzEXn-UCVB4uYWJjKJ3-4QxIktAiX",
              "solution": null,
              "nQuestion": "13A9iGsmCD5nKpS81rIH-fZS7dMLeQPae",
              "nSolution": null
            },
            {
              "id": "c558cabf-8b12-496e-a7b4-196ea8c19481",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1KKoXPx4JfDdSpJOYyZC5JZdPEYro9abx",
              "solution": null,
              "nQuestion": "1Hp24A8ml6CgLjHXuMQslF--B1Njo_aHk",
              "nSolution": null
            },
            {
              "id": "fb0c10b2-aae1-49d5-95e8-8081426f1276",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1MuXMBoduIvNv3x_J48SgeU6vK8ck2TSz",
              "solution": null,
              "nQuestion": "1wjAmVS3JohUjyuxo4Z4OXh_389fhc5Ye",
              "nSolution": null
            },
            {
              "id": "d892b75c-3d79-4616-814b-7d042919030f",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Fbl-5fgHCTJ8Uh7vCfcut3Wix3SXmDaq",
              "solution": null,
              "nQuestion": "1YGOFlK7L8iY_ldUH37T-mO-O_u8z_XSS",
              "nSolution": null
            },
            {
              "id": "eaf697e0-edcb-4cd9-9924-d5bfd8839f2d",
              "name": "Autumn End Sem-2",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ZYgRqUaIdGKCEjM72TsJWGeg8gYAW4nk",
              "solution": null,
              "nQuestion": "148xonJw5zgaDRfmjd-j1ogyRl63PduUm",
              "nSolution": null
            },
            {
              "id": "bb6a84c5-4448-4d41-b407-eebf2070947d",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1TLr3sHDWQ6dA7zh_NKaDKzzqnDuH86oa",
              "solution": null,
              "nQuestion": "1f2_IRegFVFfl8A_1v3w_igCJrYqxWCeS",
              "nSolution": null
            },
            {
              "id": "e5f27643-7568-4f65-96ac-0619ccdfaf86",
              "name": "Spring Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1eYDy0emrUho89odZU_gSDZReiFhj-UEk",
              "solution": null,
              "nQuestion": "16cSIYZhieefqRDQ0Q508tzDOvRYvyXLI",
              "nSolution": null
            },
            {
              "id": "7a5a0b3f-3068-4eea-9a79-5320e5892034",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RjBqVInXns2hiTCESH_kxlj7kT_dAMwl",
              "solution": null,
              "nQuestion": "1RXCZkLn3gJ28OFYKPI0a5me4DoIJMvZA",
              "nSolution": null
            },
            {
              "id": "df3835b5-64ea-4ab6-b065-4020fe2160f4",
              "name": "Autumn Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hLunBcU8uO1h7p9B9jXc1scjXfZFWHfV",
              "solution": null,
              "nQuestion": "1y_Pjd2JR8NSpyeVtQ0VMvEX4GH9aOm5U",
              "nSolution": null
            },
            {
              "id": "1ce89763-aabc-4f97-860f-1d70ab9c290b",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1GkPrBoD7PYXNCcZdOlUAuVvYji92SCzg",
              "solution": null,
              "nQuestion": "1BmDl-mdf_yHKiX7JYXwWJNyVByZ0xFZ-",
              "nSolution": null
            },
            {
              "id": "d8cc4187-b588-4994-85b5-a1f9ee37681c",
              "name": "Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PxcqSdp3jM28igdWkuOhZhnTX-iLI6Ln",
              "solution": null,
              "nQuestion": "1UfWamj5u5eQjFqw_emGAq__-ScFf-5mM",
              "nSolution": null
            },
            {
              "id": "96b25b33-4196-4c4e-9d60-9af057075210",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1wynHoQwCGrFxtT0_ywmpzsA9riusOMEP",
              "solution": null,
              "nQuestion": "1-K97nutQqH7lMtmwU0AP8D__9PF0Paz6",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d212841bdc9aab413387ed",
          "name": "Differential Equations and Linear Algebra",
          "SUBCODE": "MA11001",
          "Credit": "4",
          "folderId": "11LQiw6O_sktrg5dl9EUqjppPXfA38F1S",
          "pyqs": [
            {
              "id": "9d83bb27-d2d4-4e9b-8768-6be68e9267ee",
              "name": "Mid Sem Exam",
              "year": "2015",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xROCx4n462LWPiZY8NredaYB7sSmtanD",
              "solution": null,
              "nQuestion": "1xROCx4n462LWPiZY8NredaYB7sSmtanD",
              "nSolution": null
            },
            {
              "id": "7ab03e84-d2e5-45e9-818a-362b1ae49c1c",
              "name": "Autumn End Sem Exam",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10bUmkKq7KBuDzJqtB4dLUl8sTcAmug5x",
              "solution": null,
              "nQuestion": "1fQXz66Qxrbf0TKExvb39Gm7KuwzROcGe",
              "nSolution": null
            },
            {
              "id": "a10721ec-6bbf-4182-b340-977a176a87ba",
              "name": "Autumn End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HVF3e4XO_AoCZaXc2oA-Flu6FFoCOPsf",
              "solution": null,
              "nQuestion": "1RXtv9BAMRdrvLuIhcy7gxvj1Z88CSjQM",
              "nSolution": null
            },
            {
              "id": "b603d389-7182-48ab-844e-54c34e375147",
              "name": "Supplementary Autumn End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1W1Vd0LIchdwZZoQld0k5ifcjvuEMy42a",
              "solution": null,
              "nQuestion": "1iAEyrTRoT6hfBVhtGr5aOBJcO5s_kzbT",
              "nSolution": null
            },
            {
              "id": "eecbf239-c0c6-4557-b14b-d7e87639d0ac",
              "name": "Autumn End Sem Exam",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17AtXzt_kOcZJu5Qf5bgsYvta4eD_leuF",
              "solution": null,
              "nQuestion": "1cc8TNCbsh-Wq92zYJNno5HLY9M7rx0xI",
              "nSolution": null
            },
            {
              "id": "a2a74d6f-56fd-412f-bbfb-76259adc3393",
              "name": "End Sem Exam",
              "year": "2008",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1mmKefgABmPPCXytO-PmnIsqUAOSuth4k",
              "solution": null,
              "nQuestion": "1OtTyFrdFNRgkf_qwvk2jflLYuQuqqJpL",
              "nSolution": null
            },
            {
              "id": "fdc12905-32cd-4d35-8530-781733d160a3",
              "name": "Autumn Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1v8VPa3SBJ0pCBYtQKUdaoFKgQ3EkD3jE",
              "solution": null,
              "nQuestion": "1Y6EsWWMIbk7noWKrRG7s96WN_p0o8V0_",
              "nSolution": null
            },
            {
              "id": "b51c89ed-9b09-4215-b8a3-87650121c88a",
              "name": "Autumn End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1jaV4uuZRorPSVoz_g2I2ZKY29Pf-mj-n",
              "solution": null,
              "nQuestion": "1c5SELjGPB3geFOabDlYLet0yzOwQ3Tgw",
              "nSolution": null
            },
            {
              "id": "9d8326e0-d29c-4db7-bb49-eb626100e3a4",
              "name": "Autumn End Sem-2",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "14yrJ8oUBQY_OFzC5CGg9ToJxUVphB9k_",
              "solution": null,
              "nQuestion": "1RaDXNlt-GBGd-GIwUq_THxYRcm2TsinL",
              "nSolution": null
            },
            {
              "id": "5d16d8e9-6dd2-44cb-aba7-1ed9b615cda1",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66254780ad6e7bd16c843fca",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1g6fLjaapptiCaAjH2VAJJtJM15emQBoL",
              "solution": "15bcR8I1bj-egq3MKThGBO173LaiBq09y",
              "nQuestion": "1-7SSb_gjTSnNZFcHvOa2oibHzbzrRSLb",
              "nSolution": "1zrlT4ZNFlEMzvZykufkQlnN7r_6D3TgM"
            },
            {
              "id": "9610347d-9abf-45f5-8140-d48c8d55b07e",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NITjrctlEMRwB9tZpoI2prVTBM1ikGCt",
              "solution": null,
              "nQuestion": "1AcXWtPXikdrtG2pNvhuRqbV8OTC2dWPa",
              "nSolution": null
            },
            {
              "id": "2bf0ed98-e0af-4fc2-804e-d1f1ab17a28b",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Efb-rzQYkmXXoc011nq77V8xiL6GX982",
              "solution": null,
              "nQuestion": "1j2Q8ZG7L8KHBc_gnorYIfuC3njukhBXP",
              "nSolution": null
            },
            {
              "id": "acb322b7-9b08-48ae-befe-d132d0c355e5",
              "name": "Autumn End Sem-2",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1m54vArx2v9PvXaTls6BoY52mlM8ybn1i",
              "solution": null,
              "nQuestion": "1qaoWafoku-Qf6B4n2gINyBH9LYisXWIT",
              "nSolution": null
            },
            {
              "id": "10017d62-af7e-4df7-aa6d-f5b761214883",
              "name": "Autumn End Sem-3",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15JjzY7VS_tb4502Ucby5BO_UYq4fhade",
              "solution": null,
              "nQuestion": "1OXxAuOiJ9vtxYpjeENPoLDMMuXTTIK15",
              "nSolution": null
            },
            {
              "id": "0f68c642-d1bf-43ad-98bb-7f2a696f4723",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1i3IMQpCYAswHzGeV71AXdnx2_NgwUXVG",
              "solution": null,
              "nQuestion": "1vHrtvybEHqZ96_G17CqkcHjebG0MpI_c",
              "nSolution": null
            },
            {
              "id": "51b2bb4f-2f77-40a2-a594-1da50558a7fc",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1OwOJVs0GVAmDovcYhX8uEKly67AcJEse",
              "solution": null,
              "nQuestion": "1ixVJSxaP0Mxk7IKJWG2irHFJC82cyveb",
              "nSolution": null
            },
            {
              "id": "92c40371-d008-4fa7-91cf-5df1c0ea38e6",
              "name": "Autumn Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12IASUl9pJJ1bab34wTZTNChOCTt7jCuP",
              "solution": null,
              "nQuestion": "1YmEUsZRW04I5stfjiQ_U1onRx_XpEU17",
              "nSolution": null
            },
            {
              "id": "64e42430-04dd-4e66-99af-5a5cd3420440",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1LONrwIiqDHdaVvwPypc-OJixOq4R0Iw3",
              "solution": null,
              "nQuestion": "1N3rr-uU74xSbuJx4F6xtT_5Q8Ubpr48a",
              "nSolution": null
            },
            {
              "id": "ee28ce3b-1113-46d4-b26d-f405f73865ed",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "14sEnpr5z97KVo_3zljJl2E327cMP3GB8",
              "solution": null,
              "nQuestion": "1jmz6grKNuyA8H8Dyf-E3sYQLmX-3IUG0",
              "nSolution": null
            },
            {
              "id": "a6cd5669-1f73-482f-a6e6-dafd51483e45",
              "name": "Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1cOAxrRbiVs215obpD7JjiZZfGTiPaewd",
              "solution": null,
              "nQuestion": "1ZIibLw3-04Ml0VhRCQzZtVx9c0rn-VH2",
              "nSolution": null
            },
            {
              "id": "a85c500e-41a9-42a8-8d26-fa401839303a",
              "name": "Autumn End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1vsq_Gf5g48QqQ8Uo2wfqudMJLmarCox5",
              "solution": null,
              "nQuestion": "1jhXO0QQRMS8d2eZj4tT90CRPMAZg_bu9",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d212841bdc9aab413387ee",
          "name": "SCIENCE OF LIVING SYSTEMS",
          "SUBCODE": "LS10001",
          "Credit": "2",
          "folderId": "1mJrGszv-7G22-3UZVGNyY-IDF29_9Yhs",
          "pyqs": [
            {
              "id": "b63a5048-0c9d-4d87-8c01-1a5212b97d87",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1QOIdo23IIJDPmToKsXdb9X29BWDiH7C0",
              "solution": null,
              "nQuestion": "1kC33pR-8UiDGgKW530hK1OdoqX1fBGKS",
              "nSolution": null
            },
            {
              "id": "6a9191d1-81ae-4bb4-9fc9-990077c81593",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13IzQ3y7jG-PzyHbFpvspcflQCi1--pps",
              "solution": null,
              "nQuestion": "1-rh874uzgFZQY5CGm1y1nuyg9Tw4WcuG",
              "nSolution": null
            },
            {
              "id": "4d157ca0-cd57-403f-aaa4-eaf047d999d7",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1gjlZMZlZ-3ycA0JdkJS9EeJWgRlLLkhf",
              "solution": null,
              "nQuestion": "1DI18AaWz5ftutBAb_vBXeJt_9ybwuaek",
              "nSolution": null
            },
            {
              "id": "ea6f4e7a-8256-4fa2-a2c9-19462897f1bb",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tvUtRvn0lTu-MwcrZN2CM4pmnS7TSXvP",
              "solution": null,
              "nQuestion": "1PtE3tflnrZhUWvIebN4W8VUlVlLbWv7M",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d212841bdc9aab413387ef",
          "name": "ENVIROMENTAL SCIENCE",
          "SUBCODE": "CH10003",
          "Credit": "2",
          "folderId": "1yRnAfw0Z1C1RHZPbO2sm2tO4ETG-T-SK",
          "pyqs": [
            {
              "id": "c41c0a6c-3a30-4b1a-9e8c-273afe4770ae",
              "name": "Autumn Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fHNJ9lGjE5ZCl9pSlWSD5KCebEru-vd9",
              "solution": null,
              "nQuestion": "1dmYzXnCBFO3JLyZqS8I0uDXDqQdczMhY",
              "nSolution": null
            },
            {
              "id": "c86e4eec-70b5-4515-bafc-0db2c52912a3",
              "name": "Autumn Mid Sem Exam",
              "year": "2015",
              "type": "Mid Semester",
              "status": "APPROVED",
              "solutionUploadedBy": "66203d24ad6e7bd16c843f45",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11tIG2snbOCe3tmilTYsxVabo2vPJhOoe",
              "solution": "1-XyZYdTLKBGmUlG0zzwefitizo4nKgGu",
              "nQuestion": "11tIG2snbOCe3tmilTYsxVabo2vPJhOoe",
              "nSolution": "1-2ILaqN1zpUjSAl3McefaEp7aGl47iUn"
            },
            {
              "id": "e1d7a131-7456-4e34-9869-ee812966aa03",
              "name": "Spring End Sem Exam",
              "year": "2016",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1V87XY_dak-JQ6MNdf6GiGrG_lGqDnwN5",
              "solution": null,
              "nQuestion": "1V87XY_dak-JQ6MNdf6GiGrG_lGqDnwN5",
              "nSolution": null
            },
            {
              "id": "655abfd7-edf7-4eb3-beda-0f3da533459e",
              "name": "Autumn End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1TWRE8aEvPoo2NN0dqlL3CHOaJGfUjqcx",
              "solution": null,
              "nQuestion": "1zV2_brMBj-Je3Rcbgm4VmDWRISBT47lT",
              "nSolution": null
            },
            {
              "id": "f13f59e9-03f2-458c-ae71-1899be63ba70",
              "name": "Autumn End Sem Exam",
              "year": "2015",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1t2t7F2XIWyCb28ahTsJN9YL2kPZ9MpgF",
              "solution": null,
              "nQuestion": "1t2t7F2XIWyCb28ahTsJN9YL2kPZ9MpgF",
              "nSolution": null
            },
            {
              "id": "042e7bb7-6cf9-4f24-97a6-fc44351a4a7d",
              "name": "Autumn Mid Sem",
              "year": "2014",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66fe42b4f740b2b3e5002dde",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1YLkhbRkR8Gt4Q12r0OTv4drvtniwatZO",
              "solution": "1wuQKjhcqN7cA8pMvVCuMsFgRlF9vXJUU",
              "nQuestion": "16RZcZcsrKiLWdbksjD1W0ltToHsfny98",
              "nSolution": "1zIXqSe3igh_jXK3MKER-eaDGtvOJ68PW"
            },
            {
              "id": "acce4c1a-5b2d-4c8e-86ee-3f8c818ca1c1",
              "name": "Autumn End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1wLXfqdh0zGIcYrPk2MAEV4kCaTZ7JNIQ",
              "solution": null,
              "nQuestion": "1iVWcGNWmqi3ymyQj9GnkgVlmX4oNHa59",
              "nSolution": null
            },
            {
              "id": "28df80b3-457a-4820-92ec-16f08fa510f1",
              "name": "Mid Sem",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66fe4821f740b2b3e5002ddf",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xMMUvNAgO3UBO_86hb1D7FLesTUx4vS_",
              "solution": "1dImCCPtpVAlaNCNle5Ek_8w0XO5Aveoi",
              "nQuestion": "1gf3QbJHPdn_DwZ4aC5Az1IKRkFCEVd_y",
              "nSolution": "11b0px-0t_3F64JJ1-0Kqgt9YwfCT4Tfh"
            },
            {
              "id": "de40284e-7d72-4f54-804f-f1cea07bccd2",
              "name": "Spring End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1gn0TWWoD18PMETSKfvaDSCOV08IFYvps",
              "solution": null,
              "nQuestion": "12lhBO6Uy70WF6AYA3mRLdkaG9kya7JTb",
              "nSolution": null
            },
            {
              "id": "727ca344-f96e-4331-9583-94f664c79d91",
              "name": "Spring End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DQPjWsc3w_D77bmgKYl7516-Xgm27RPm",
              "solution": null,
              "nQuestion": "1hPSdsJqRA8FAOB2OMRQyj1tWrjvIKrVW",
              "nSolution": null
            },
            {
              "id": "cf2ffc8f-4aaa-4ef5-b2f5-8b598f568389",
              "name": "Spring End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1vq-BHkF2Uq8p0x52MkK-zqfOASIHL-ek",
              "solution": null,
              "nQuestion": "16wb4QluWTzGVreOvpYFOnDT66I5eZUag",
              "nSolution": null
            },
            {
              "id": "214923c7-e4b7-4a2c-ab5e-a7279d23294d",
              "name": "Spring Mid Sem",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1OVmStLcfsYvWIBou0RdBc3XG4QXHjrVB",
              "solution": null,
              "nQuestion": "1KJbldM_UAYYibcH93Av40Q3l3tweVY_W",
              "nSolution": null
            },
            {
              "id": "5d4f1396-d2ba-481e-bc35-b2535d6f9161",
              "name": "Spring End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "139njXA_7jCANfF3Q-5vT2u8uc9aEaTak",
              "solution": null,
              "nQuestion": "1gm77lwSZdCRpwhiX2NtFFi0R_-xjSk85",
              "nSolution": null
            },
            {
              "id": "27dc4c4d-68d3-488c-b98f-82a8b574074b",
              "name": "Autumn Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1w-JpZeV38Y1cEPsQIGfNyWJL7A0KgN9H",
              "solution": null,
              "nQuestion": "1dbu_NxW9Zo46iVdaK-ygM-WkIXqtiYSf",
              "nSolution": null
            },
            {
              "id": "91010b7e-e32f-4de2-9748-ef8ff3fc888f",
              "name": "Autumn End Sem-2",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10pGErclKv4y5BA2XIi9tuveTnSM7PZrI",
              "solution": null,
              "nQuestion": "1xHo8aADXKAz7-0PS_Z_sQTnQQPo8yWMU",
              "nSolution": null
            },
            {
              "id": "2bf5b8d5-a41e-4388-a93b-292b94386b6d",
              "name": "Spring End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1h0xlZUTivANlt8UPG7u5bu0iwJsQP0Gt",
              "solution": null,
              "nQuestion": "161G1lkvccvLAgHt8xS5IyZAd0XoKzsr0",
              "nSolution": null
            },
            {
              "id": "bba3aad8-7631-4117-aa0c-1eaff7d47f7c",
              "name": "Spring End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1jN_eMplmytpzRBDZCNRJ_P5dPIvOkSRS",
              "solution": null,
              "nQuestion": "1OSpsrEXe8F_mbZ3R2UBvvZvLs-asiN2n",
              "nSolution": null
            },
            {
              "id": "c39898af-566f-4d02-ab4a-71562fe2f07d",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13MFM4wD6xrSM1Xq7SYOw_cCve2KvAmfp",
              "solution": null,
              "nQuestion": "1DBGDoT50eNbyFkCxY8PxtTCo5DdNGl9V",
              "nSolution": null
            },
            {
              "id": "d61a9808-8731-4635-9445-96c7f581958f",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ptcTs-ATjF3v43ORF0dVzHbjXu5zJR8v",
              "solution": null,
              "nQuestion": "1quFZXcPiNoBeAbv1jAcVzqSGL28UwNog",
              "nSolution": null
            },
            {
              "id": "6392c073-2ffd-4390-b19d-390c1f71b7ef",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1UyRlD2e0jTAHVzCPAdzv9YeTEJj2PWUC",
              "solution": null,
              "nQuestion": "1Rejy3YT4p8Ny-2Mk0Ym9nOY1xLKowomd",
              "nSolution": null
            },
            {
              "id": "e2c45864-a82d-4212-9e28-906abc977da2",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1VfgueJ8I3petGYT4eOdfHdc2BRhJrVrd",
              "solution": null,
              "nQuestion": "1jVEz0-ca_V1DmKv7z8GlIr0MDOKdIyU5",
              "nSolution": null
            },
            {
              "id": "8b6b70a5-e773-4cd7-b2b9-5dc129e91667",
              "name": "Spring Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1IvhjgYvQ_eB8aeuXwBR9vcmu3MolEuEJ",
              "solution": null,
              "nQuestion": "1v4u3rq2r7GPQ7ty0JBnxGZMjjYDY1Drh",
              "nSolution": null
            },
            {
              "id": "66d189cb-01b9-4542-ab7b-4e0d12201aba",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17rkR074i0S6Dp75OsOJgN3o7ukqQd-5Y",
              "solution": null,
              "nQuestion": "1P1-83OnkSJqgjlXFOLyZziidNQCo323W",
              "nSolution": null
            },
            {
              "id": "2708e468-f046-4da5-b6c3-0fc8504a7d27",
              "name": "Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1F_C1FoiYKALeLjUMjMZai13TaFoAs2L0",
              "solution": null,
              "nQuestion": "1qkMzMd6FlYcN8UsRFLqf9rCKGOGMjX3Z",
              "nSolution": null
            },
            {
              "id": "68830a5d-eda5-423f-af32-4c8fcd9168de",
              "name": "Redmid",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1wWfBt6NnCLjV4SvzhatEWLVwcwoL5ZCh",
              "solution": null,
              "nQuestion": "1IXcQOB35qPYku2ht2doKkgVdI4DkaTO-",
              "nSolution": null
            },
            {
              "id": "db6c7590-a567-4bb3-8e9e-6fc249a4f53f",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66f2dc45f740b2b3e5002daf",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fTWc5IeZkzt4kujYJMWHiaEEOg0skirM",
              "solution": "1LBevnso89SEO-FyZV26GQb6I2xczT3jd",
              "nQuestion": "1OBAjmuKNsWnEDlnGKWWqHUnDKc2Qp1yb",
              "nSolution": "10Um7zLqn-Lgy2gYatjNNYUi7mNSIfYPs"
            }
          ]
        },
        {
          "id": "65d212841bdc9aab413387f0",
          "name": "PHYSICS LAB",
          "SUBCODE": "PH19001",
          "Credit": "1",
          "folderId": "1-BQdGsjwGgUgmD2xeOcvE_O1Py4l7NqT",
          "pyqs": []
        },
        {
          "id": "65d212841bdc9aab413387f1",
          "name": "PROGRAMMING LAB",
          "SUBCODE": "CS19001",
          "Credit": "4",
          "folderId": "1vBGBj8J1J13ZGire6k7KTVi9bM1JSqyE",
          "pyqs": []
        },
        {
          "id": "65d212841bdc9aab413387f2",
          "name": "ENGINEERING DRAWING & GRAPHICS",
          "SUBCODE": "CE18001",
          "Credit": "1",
          "folderId": "1teBnTJZmXgHxipPQMMp5w9W2Sm0UVKV_",
          "pyqs": []
        },
        {
          "id": "65d212841bdc9aab413387f3",
          "name": "ENGINEERING ELECTIVE-II",
          "SUBCODE": null,
          "Credit": "2",
          "folderId": "1czq0HuYngIIAQ9c-5LasVMpkdlxba8_P",
          "pyqs": []
        },
        {
          "id": "65d212841bdc9aab413387f4",
          "name": "SCIENCE ELECTIVE",
          "SUBCODE": null,
          "Credit": "2",
          "folderId": "1VM7DUEcLv9Cba_E9AoRmg-qOxQnrTU6l",
          "pyqs": []
        },
        {
          "id": "65d213b11bdc9aab413387fd",
          "name": "COMMUNICATION LAB",
          "SUBCODE": "HS18001",
          "Credit": "1",
          "folderId": "1nCkNUx-iMeXMmWDrRVEn2d2hkttI-ss6",
          "pyqs": []
        },
        {
          "id": "65d213b11bdc9aab413387f7",
          "name": "ENGLISH",
          "SUBCODE": "HS10001",
          "Credit": "2",
          "folderId": "160pnTWAGgB2IOPSTl_17I4ofjY257obo",
          "pyqs": [
            {
              "id": "cebd515c-6cb4-48f1-9fe8-c667f607f593",
              "name": "Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1e2Cdq8y2TzDEbO3JF_TCu8_ZyZBLLFww",
              "solution": null,
              "nQuestion": "1NyAR8NvJhhyeA46Hmew9C6PFCy8JTFNY",
              "nSolution": null
            },
            {
              "id": "1123346d-b133-48c8-8b90-dd98d335728d",
              "name": "Mid Sem Exam",
              "year": "2014",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1rslUTzDqQeabHGQzw5cEII11ey8JQ48h",
              "solution": null,
              "nQuestion": "1ZoOp4cFAoGWp1RplTLZk4oZ8yDlKKPZV",
              "nSolution": null
            },
            {
              "id": "7e0382a7-e162-4e5b-acc3-544588d4ee90",
              "name": "Spring End Sem Exam",
              "year": "2016",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1p841V67HwaG3u3SXGk5DPghmFpB4M221",
              "solution": null,
              "nQuestion": "1p841V67HwaG3u3SXGk5DPghmFpB4M221",
              "nSolution": null
            },
            {
              "id": "3621220e-dfa7-4299-8474-69f5063e56aa",
              "name": "Autumn End Sem Exam",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12pgN20nbH-faE_9ICKFMGbw181wt67d9",
              "solution": null,
              "nQuestion": "12WYL75ldu0APmjyZTE1cGAWcHH4iUZIt",
              "nSolution": null
            },
            {
              "id": "4140aee8-3751-4450-a192-8cdeb4c9e071",
              "name": "Spring End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1jwb-5BB9EW2CQYILAtGmSWpBu0mLbUAq",
              "solution": null,
              "nQuestion": "1ckcGCb3Ecm3VuBnEHYQi9WaGJfdMWPCM",
              "nSolution": null
            },
            {
              "id": "b408254b-ed0b-4f94-9704-0ef1593f2468",
              "name": "Autumn End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xAHtTA7O1hIEqxvwLQxy2XiyBRrCJ_Ib",
              "solution": null,
              "nQuestion": "1uVyLce-9XxWbxsafzE_Tyc_w_1_W_7b_",
              "nSolution": null
            },
            {
              "id": "2f3d87c1-91c2-418f-8619-86417ad56bdc",
              "name": "Spring End Sem Exam",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xF1n5i052N2yuM2oPtgQXVcjY-GmzyYR",
              "solution": null,
              "nQuestion": "1ukSAf8gFib69V9qkuAHZ9tA34DSWItfY",
              "nSolution": null
            },
            {
              "id": "fe0589b8-2eca-490a-8edd-87e025de8fed",
              "name": "Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1alSypaO2tpeWj_qXPO3xWScx5hkJmHeD",
              "solution": null,
              "nQuestion": "1fXBXlgS59qCCmcxJJq7I3AKT2sMAL-nN",
              "nSolution": null
            },
            {
              "id": "51e99d8a-fe60-4f26-a6cd-697d621497a7",
              "name": "Spring End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ILrO3OpZGeDZQ6rO88Yp5zxpKqc6NjOe",
              "solution": null,
              "nQuestion": "10_21wiN4KPVT1KECLL3o6bgo4IvcuuWt",
              "nSolution": null
            },
            {
              "id": "71c384d5-fda7-48bf-9e46-d2a174c30200",
              "name": "Spring End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-7rYTFTJ0ta0lwerMgCAzgm_QdT7Kl3r",
              "solution": null,
              "nQuestion": "1uPCBgTVOPxc8zWk6fewBUnlUdmXPCD66",
              "nSolution": null
            },
            {
              "id": "9aa34734-b3fb-4363-9187-360059bc74e0",
              "name": "Autumn End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pFvR6aJYbhCrFwk1QV95W5jZrleEBKCr",
              "solution": null,
              "nQuestion": "14Wd3gp3SM3siz24UrHetnjTCsl2kFL5C",
              "nSolution": null
            },
            {
              "id": "78e436b3-962c-4fee-b597-44e18c118cb1",
              "name": "Mid Sem",
              "year": "2014",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1dx7gL8el8fTdJu3tazJB7lUOBNlopnI5",
              "solution": null,
              "nQuestion": "1AIcGP9U1P92dtcIdSbOqep7E6FecijYz",
              "nSolution": null
            },
            {
              "id": "698cdbb0-5d10-4246-a58c-c576808f3d0d",
              "name": "Spring Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1AbMV6DG5KfDkILmY6EZm7fegNENAGt69",
              "solution": null,
              "nQuestion": "1HkRXEnctI3j3VHpNrGhY3mDnuGGqUjED",
              "nSolution": null
            },
            {
              "id": "e78a6e08-01bd-42e7-8d94-7287965e6002",
              "name": "Autumn End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1WY9ePx7X2mRQIJXXG8I36pX2tvkgQYal",
              "solution": null,
              "nQuestion": "1sRgNrKxBVK3Ep__HQlcoeXohI779rBXO",
              "nSolution": null
            },
            {
              "id": "08fa7ad8-519c-414a-9126-993bd76af8c0",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-54kjpwOaBiRkEdID5x8LukSy0bHwTNg",
              "solution": null,
              "nQuestion": "1973HyPpiueqTxff2Ycii7WS3J88PsYRY",
              "nSolution": null
            },
            {
              "id": "64917c3e-fcc3-4d7f-ad39-47b610518d9c",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1VrOR9_6OGh3u_9GoRVoH_MzpAwpfKvHV",
              "solution": null,
              "nQuestion": "1BzQl7gV9Jprbw5J6VZI-1onA4MeZOvIO",
              "nSolution": null
            },
            {
              "id": "f7e6b06c-f671-487b-8326-079befc6a1e0",
              "name": "Autumn End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1YVG5sZSQLbJ-Z28JfGDN7LEy99HJea98",
              "solution": null,
              "nQuestion": "1PUheZvTcntzjuCJWWDAvS8kCNQgXcByo",
              "nSolution": null
            },
            {
              "id": "b3fdf434-706e-421a-82c7-524f780697a6",
              "name": "Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1OwMDJZ948AxipIVp1qhTxQjj-t9sS0G2",
              "solution": null,
              "nQuestion": "1EY6WixWBxqX6hsJ5yHVX_v80vBCSTwsS",
              "nSolution": null
            },
            {
              "id": "26622c1c-2ce5-402e-97e6-ec24a1e534cd",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PNaST47a_mqUzCt5NAZ6He4UM62d5FNF",
              "solution": null,
              "nQuestion": "1n5CCi3SPRqeYEZM3j6zMYQlxrVe3J9q7",
              "nSolution": null
            },
            {
              "id": "3d2a7723-2298-40df-8026-96f132903834",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HgZxElGqK5zIHxYLBnEbN4OzlIJG86vQ",
              "solution": null,
              "nQuestion": "1A0o6xF7l1rb1pw81FH2nXgmfxjdkYuJT",
              "nSolution": null
            },
            {
              "id": "93f6bb7a-98e7-410c-b9a6-ce87784bb225",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1M5VtdftEzo4B3Zn8U1c-nmLWHZShBU4I",
              "solution": null,
              "nQuestion": "1dqOUUGzRlKiT_pD9iLiZpA32ULmRqMDC",
              "nSolution": null
            },
            {
              "id": "7030fcc4-1599-443b-8c33-2e04047faadd",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1g1NLowPFxQe0bd7AJyf6mqr7qwxgtTrW",
              "solution": null,
              "nQuestion": "1wXbirICmStVlYhMb4LH7avBpcY_GoAid",
              "nSolution": null
            },
            {
              "id": "f2a3cb56-4ad0-40e2-b9cb-3fd4a41db745",
              "name": "Spring Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1EsUOxn6S9A8vtThGDQnQPbuAJNv7FP5n",
              "solution": null,
              "nQuestion": "1XIOBgX5UGRJyYYtg7j09xnaHqbjpnKHh",
              "nSolution": null
            },
            {
              "id": "a3149178-48e1-45a0-8f12-c98ecb4bcb85",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RCq76Sb_7wispbHtglnhd-QWUREbRaJm",
              "solution": null,
              "nQuestion": "1gcTLjmyPsXSDsv9YwVFQz_6nks9ouss0",
              "nSolution": null
            },
            {
              "id": "2cb8d573-e3fe-4db0-b52a-83964ba626b6",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xgyRbfLDo-8mW9BZCsN51j0U-MQdxdyh",
              "solution": null,
              "nQuestion": "1uoE5pel4xlPHHvFFiRpbBKre9zVrLZkl",
              "nSolution": null
            },
            {
              "id": "202cf96a-cdc8-4b8a-a258-16ff8fefbd7e",
              "name": "Autumn Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19AEgCH5U5eQW_m2VKyABGn8Hch8qkp2C",
              "solution": null,
              "nQuestion": "10TBziKqvnfxG6xA1k-lK3nZMVjzQTHKS",
              "nSolution": null
            },
            {
              "id": "9bf2d59c-e361-4774-afd8-cc409df75025",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1UhREEh2ytvH79nfFNtsSYPudX-qC26Cn",
              "solution": null,
              "nQuestion": "1iF3Ng5eoMmf8lLxvStA9dpsizkhGSOmF",
              "nSolution": null
            },
            {
              "id": "b1ca789e-9840-426d-ae14-b4270d2f298d",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1--uAqSayyD9FZHqrhfBQVCk0cEEEvwcq",
              "solution": null,
              "nQuestion": "1EWKyLwfCzCW8zrKtnD6NscU0tOhurarb",
              "nSolution": null
            },
            {
              "id": "437c1577-fd17-407e-ac3f-36c10882fed3",
              "name": "Spring End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1p37Dn2k0hLzJ9rdAfUkBpetGgGnnxbiY",
              "solution": null,
              "nQuestion": "1lUBWHpwXgomtLiTFPjdvJfBNujALlB0p",
              "nSolution": null
            },
            {
              "id": "29fa29f4-b7d8-43e8-bee0-fe431d614e8e",
              "name": "Spring End Sem-2",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12h87ea1xz48g3UsKE4TEBB4UvLjacyuk",
              "solution": null,
              "nQuestion": "14Nz_KUJS8Sk42qFxkhWUrppDmNqdgozg",
              "nSolution": null
            },
            {
              "id": "f18ed2ff-9981-4fb2-970e-90d57cc4658a",
              "name": "Autumn End Sem-2",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1yAfQniOrVxhGVw_NfPFUkCN9jAp_J3cZ",
              "solution": null,
              "nQuestion": "1px951OfscwSqmuPU-SQsCYHGsEH0PbPU",
              "nSolution": null
            },
            {
              "id": "fec38bdc-2949-4f53-80e5-25732128c61e",
              "name": "Autumn End Sem-3",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1iMmzqizrlvlefj9YZAdXSXR6g8K0TNxc",
              "solution": null,
              "nQuestion": "19vQWor1b3FPUshuL70RyTgXXavZckKe8",
              "nSolution": null
            },
            {
              "id": "dcfb00c9-e0ee-430a-bc67-43af70adc0ea",
              "name": "Redmid",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HbpaN40ZND40VN_XhLFWCtSI8kMTngjO",
              "solution": null,
              "nQuestion": "1Rplo-DKwuB16UIud2o8ba9ICO4G5UIti",
              "nSolution": null
            },
            {
              "id": "b9c49b05-3b14-4630-8397-99560cd248b5",
              "name": "Spring End Sem-3",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kJWZupJ2LvH-hnaoXZDFcpUQ6Vp8j8Wn",
              "solution": null,
              "nQuestion": "1YIb1TJ4I-A4CdjIv1MfmsT07C25AUdSi",
              "nSolution": null
            },
            {
              "id": "11600c15-744d-4927-b8af-6a6ed3a731f2",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66f2dd2ef740b2b3e5002db0",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hHXMZCk4HCYvrGVdbSUeiEhQGdsL3tZt",
              "solution": "1HqsjZkhu4Ntrek-2zwcVE-krlLl54AYU",
              "nQuestion": "1SSl_g3rkgqsknq6Tci_5MI-uRyY9xZLP",
              "nSolution": "1xm1SIX3ivJhJ4yip5RS0m736Ze4R9Pbt"
            },
            {
              "id": "e2a639d9-7284-4adf-9087-82a82d1f59cd",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RdCS1EhjPx1l88qAWtVcalHBcoBKJkpm",
              "solution": null,
              "nQuestion": "1oMBMtaXFN_iRy-EtdVMN_tfK58-Fxy3y",
              "nSolution": null
            },
            {
              "id": "7905915c-f6cb-483b-89bc-657b2ad42b33",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "REVIEW",
              "solutionUploadedBy": "676c3f38afff4821c3ae221d",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_NGz_4cYdUoQy5y2r-AQAjP7YNzCQQKN",
              "solution": null,
              "nQuestion": "1HAHVwhnegAAHJjCBZrzWgE4XwrW5y8e8",
              "nSolution": null
            },
            {
              "id": "5439746f-ace9-4141-b603-a6f4e39b9880",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1slkXeiFXSfQOSzOqpxblhYuAAiS345La",
              "solution": null,
              "nQuestion": "1pl1mi51mAVYp-WWUhidwQhAcJYGufxgM",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d213b11bdc9aab413387fe",
          "name": "ENGINEERING ELECTIVE-I",
          "SUBCODE": null,
          "Credit": "2",
          "folderId": "1vGH4arUhDIYoDbPCX-NNu4RXsXcUhwla",
          "pyqs": []
        },
        {
          "id": "65d213b11bdc9aab413387fb",
          "name": "ENGINEERING LAB",
          "SUBCODE": "EX19001",
          "Credit": "1",
          "folderId": "1zTvaumOdlZSq8BpuNlM6W2qIhhB0p9X-",
          "pyqs": []
        },
        {
          "id": "65d213b11bdc9aab413387f8",
          "name": "BASIC ELECTRICAL ENGINEERING",
          "SUBCODE": "EC10001",
          "Credit": "2",
          "folderId": "1CMCRpagYf-Nrow_izVQAjfENbiDVoS0p",
          "pyqs": [
            {
              "id": "80cf38f8-db60-4071-a554-62dfae97b6af",
              "name": "Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_bGwwFREO7GcRtURmwPvAQB3792ErVex",
              "solution": null,
              "nQuestion": "11UN0VgV3xg4rvpi0cp6N2e_9iC8Aq5Ls",
              "nSolution": null
            },
            {
              "id": "a2311b16-b7b7-45ca-b5d6-ead03b914960",
              "name": "Set 1 Mid Sem Exam",
              "year": "2015",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1r45xo7_xUFsvd1fSYhZbXclTxQVL6VCK",
              "solution": null,
              "nQuestion": "1r45xo7_xUFsvd1fSYhZbXclTxQVL6VCK",
              "nSolution": null
            },
            {
              "id": "38727558-6908-420a-813e-ed8d9e7ed7db",
              "name": "Set 2 Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kMIDs3epxhKKgXwU89WObwpDVuQlTyPV",
              "solution": null,
              "nQuestion": "1CBYYRulj3rf8Jxx7extcD4O-eurtM3SS",
              "nSolution": null
            },
            {
              "id": "dcbaf4dd-788c-4580-97bb-af64b1b7b010",
              "name": "Autumn End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "14JmtPPtHmUQ3anxfFqtJY47duVH3Z6rR",
              "solution": null,
              "nQuestion": "1vXmXdHdAoGULs34-10529kEuNaBm9tm6",
              "nSolution": null
            },
            {
              "id": "851964d7-82a5-4cf2-89ae-2d1b3b93206b",
              "name": "Autumn End Sem Exam",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tBBtL3oDofcWzB3gxmMiSiIFew3TOmGV",
              "solution": null,
              "nQuestion": "1Xafk5o6vxBKm5qT_LN3rZnf521XwQ2I4",
              "nSolution": null
            },
            {
              "id": "36cc0da0-e2bc-4509-af35-a77a7bb35f6a",
              "name": "Autumn End Sem Exam",
              "year": "2014",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1451r2Lq840BBbTrTFJ-0yi1aRJw-ydj1",
              "solution": null,
              "nQuestion": "1451r2Lq840BBbTrTFJ-0yi1aRJw-ydj1",
              "nSolution": null
            },
            {
              "id": "6f9412ba-e0fa-4de9-bbab-9c5bbcc6ae91",
              "name": "Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1UDxJJ8qQD7zmeSLYgSN8lmWxf-c9QuZl",
              "solution": null,
              "nQuestion": "17Y4tx7UJUdbsCSnyINBeKoqyyAsxAT5R",
              "nSolution": null
            },
            {
              "id": "ec427a24-7f4a-47f4-8153-6940230fab0d",
              "name": "Spring End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1a2XwO-S3iDUWwnUVsyG25VpomdMsMcZ6",
              "solution": null,
              "nQuestion": "1KJ62VsoScsxVQ6UHBGpG59smWhBSWsyD",
              "nSolution": null
            },
            {
              "id": "b4262931-648f-474b-97c6-4797f6c5cfb5",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66e299e942841c454a166f0f",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kKcDrSByp7G5auRjgJ9mDuMKEEgwpwNe",
              "solution": "1I0iQC00l6bQQ-htlfNzJl7dEI3Ve10Wu",
              "nQuestion": "1eFz91UdBAmbleJV7OYelqAl5BdHkBxFj",
              "nSolution": "14UpCvHPmmKu7pte5nQy8N2m6OTmhNaGk"
            },
            {
              "id": "8c93d950-d9b1-43b7-8463-3b7f485c533e",
              "name": "Autumn End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1YSIGQt-Rn25JF66MEBjqcKQwFJDzTY7B",
              "solution": null,
              "nQuestion": "1oqyO1j-tMJwKmtRPuHfRt1BZT-1NdvUE",
              "nSolution": null
            },
            {
              "id": "1d616782-686b-4bca-81c3-24453886289f",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_ESTgU-RnEJKjwSfeO2ZLJohZViv9czt",
              "solution": null,
              "nQuestion": "1vMti9-aN2ElANqvctHeDpdi2uMLZjWlv",
              "nSolution": null
            },
            {
              "id": "f1752d1c-2863-4cf9-80ae-f0bc7c568cec",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1lISjcSKCQr5caCsOnpgA6v5WfwhavsQy",
              "solution": null,
              "nQuestion": "1RaV-s7Crs5uYaqXvxQYWUSC5Iw91TdTk",
              "nSolution": null
            },
            {
              "id": "100c8f62-143a-41cc-b89c-126e8e9769e4",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1eiwJWD64hzsmikXB_FJodbBxLrfJh8Lq",
              "solution": null,
              "nQuestion": "1BtT6v9F9CfHxuQKOMSVpFsEoJafRGeB-",
              "nSolution": null
            },
            {
              "id": "d3290a9c-a49a-43c1-9a2c-d62b642de34a",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1CR1BWP8p73i4fCL9aYYOdXph6jGctote",
              "solution": null,
              "nQuestion": "1Pquhegqxco5Z4_cG9NfJaxHrMJiyhHmu",
              "nSolution": null
            },
            {
              "id": "e2d528bb-5f13-4891-8234-101024c3eb5a",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pfZl-0dOCZUDshWeFl6uD8CIlC_8cDqa",
              "solution": null,
              "nQuestion": "1dPWhSWhoXSSPwg1pjcOZVS09MIP_Npsj",
              "nSolution": null
            },
            {
              "id": "f881544b-64c0-4a82-857b-142bcf9d0d9f",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1EcV6QZi2go3jaBuhB9ufzRkjNQlPSOoz",
              "solution": null,
              "nQuestion": "1RBpf0TCQ5i1894fuDh_pG1DS_dk4Bb98",
              "nSolution": null
            },
            {
              "id": "b4e2491d-94bc-4207-a6df-1b505b876934",
              "name": "Autumn Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RifwW3BWSxQ8r8ehjxn3bkuG9R5ZEpbN",
              "solution": null,
              "nQuestion": "1HC_uH6nbtZZD-dO5bjgqpz2cphjMhmtl",
              "nSolution": null
            },
            {
              "id": "29c742c1-4f65-492d-9d25-8dba05239309",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1InPG_hbDKMCAXeUadq7wIUB7SdaZbn55",
              "solution": null,
              "nQuestion": "1-RE11d-Ln1478-_KBkWVTsfjVIFBS2Ar",
              "nSolution": null
            },
            {
              "id": "c5b7237b-1d71-447e-9276-b8a469dba148",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1AL8kU0cdeHyJQXspnmd2M3pA1U_UPkIC",
              "solution": null,
              "nQuestion": "1uTF7RApXyOnfs3DggjtwpJru4SE35qF5",
              "nSolution": null
            },
            {
              "id": "95bfd579-8136-4d94-bf41-a106f64ca036",
              "name": "Spring Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Y62kIZxrpIHA2lApkZ__hwXNYU5ZxInR",
              "solution": null,
              "nQuestion": "1BJt4IEhDgcNcnx_7rRnA87UTEPlT-URN",
              "nSolution": null
            },
            {
              "id": "06d9e975-aaa7-486a-9fa4-08503e85c75d",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10U9WjjfpZfwN2Zt5Q_sONFWXdMPzNVax",
              "solution": null,
              "nQuestion": "1aG0pD1lP883aouEJ6kYlLlKT6dR-uaQD",
              "nSolution": null
            },
            {
              "id": "460bed9c-2e90-45c2-bf8f-73e26eb70e2e",
              "name": "Spring Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1itf9RnD_aMitZu-kmrvdCY9c470xmy1Q",
              "solution": null,
              "nQuestion": "1orEQ6zniOyztpFWixpSfNFf7Nzs3sDIr",
              "nSolution": null
            },
            {
              "id": "cca7b1e7-20a7-4386-aae3-6d7a03d77c43",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66efc1c5f740b2b3e5002d87",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BO9mkQSawtaEliwgARz-TUhK6U5cZwc8",
              "solution": "1qRRgFh8BvBpCHld8v_4sITiWYdJzGaQS",
              "nQuestion": "1xzBHPP8D3qpthYQ5sHqM2FcPCyccJyRv",
              "nSolution": "1HU_-q8FucCE7nSfGBI6jEJ2hH3xoV2TK"
            },
            {
              "id": "e248f04e-80e4-4b92-96a8-f51f31355123",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66e2998c42841c454a166f0e",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_Nc3kS_eYkjKct5xdN0t_lSkZXeo8_PA",
              "solution": "146glKYj3BhgAGfAkf0ej0bNiKKAPjMnz",
              "nQuestion": "1hzLzEOWJEHqM3fwsMbYhsaMJafV_mKpY",
              "nSolution": "1NgtF_ECkPz9RT22FFJCRkj8yIwcW3h3H"
            },
            {
              "id": "80a7b034-ac33-4d54-9e3b-fe6ec38ca3c6",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1XHHDb4au2AmKxbauPoYErr3l_l9N5jOY",
              "solution": null,
              "nQuestion": "1ep11A6xET_uDAa-tH3exObNkHkCQDf7Z",
              "nSolution": null
            },
            {
              "id": "6c9e0b9b-0426-4566-a0ef-d45505ad48ac",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HCa0K4vtgWSnIpHpjAhStaf7a3tzEHq3",
              "solution": null,
              "nQuestion": "18aEOjpuPvqcmFmD-lhmJJFYLO5B_w9eU",
              "nSolution": null
            },
            {
              "id": "7027fd32-0594-43c1-9bbb-df34e2c1dbf5",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1V4F7kmDj35-gMNN82LWO1km9Sx13zAgW",
              "solution": null,
              "nQuestion": "1aTgbzXnbPgVNDKnes_ycA1UvvnDvtxCX",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d213b11bdc9aab413387f6",
          "name": "Transform Calculus and Numerical Analysis",
          "SUBCODE": "MA11002",
          "Credit": "4",
          "folderId": "1HqtbjSjn7SCXMiLs1K_RVcTOh-_EAdEn",
          "pyqs": [
            {
              "id": "d22059c3-11c5-41de-bc1b-e164a61318e0",
              "name": "Spring Mid Sem Exam",
              "year": "2018",
              "type": "Mid Semester",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ulayRk51TokVeIRNorCId4alK8SeHUrTx",
              "solution": "19PrrDyKxCe4wxxztnDBAnFJFKi9EVGgX",
              "nQuestion": "1ulayRk51TokVeIRNorCId4alK8SeHUrTx",
              "nSolution": "19PrrDyKxCe4wxxztnDBAnFJFKi9EVGgX"
            },
            {
              "id": "2e3df402-2836-4619-976e-a8b00a2633c7",
              "name": "Mid Sem Exam",
              "year": "2014",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11OYpLQxStGy2ZK6EG1meL7EREw311Xac",
              "solution": null,
              "nQuestion": "1rEDaRumGfi3pNMVZ2P_jgcpBcJu7H-aV",
              "nSolution": null
            },
            {
              "id": "9ed246e0-c198-45d2-9634-ca0d1b90f372",
              "name": "Spring End Sem Exam",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JeDecpku_qQ_SpHAlNzsu2l01frVy5oJ",
              "solution": null,
              "nQuestion": "1cxSXhjrOfIYfoxMQ_rBE3nTQElARtGTd",
              "nSolution": null
            },
            {
              "id": "aff629b9-78a7-40d0-a7f9-443c8c527662",
              "name": "Spring End Sem Exam",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1m67xP1s00huzsWIPeX2xoKYvsUzxQyID",
              "solution": null,
              "nQuestion": "1p2aeAijhaiO-Gx0DmFH-mWgDUy44mWSv",
              "nSolution": null
            },
            {
              "id": "f62f229e-c993-4940-b0b2-14f2537a2730",
              "name": "Spring End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ShiYu3J-Cp1JDXoOd8-ngCO5uS_qRGF1",
              "solution": null,
              "nQuestion": "11Mun2s2AyQBKHVoTi1GzBXizAc7ngmuu",
              "nSolution": null
            },
            {
              "id": "c06dd429-f0ae-420b-8f46-4046c4d747d9",
              "name": "Spring End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1efOa124cR8eOlULp9vTlSE4dOn2oHaHH",
              "solution": null,
              "nQuestion": "1StgCuNumcgA8c-_96eZj-2icG8kMnVRG",
              "nSolution": null
            },
            {
              "id": "aa7a7fd5-ed86-4235-adf7-ce2ad6aef3e1",
              "name": "Spring End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1TzQa_xjbsUo-JtVTjnhy7Dsn_avMxSou",
              "solution": null,
              "nQuestion": "1FoLD8cXQPNrrsxxlvumZ0xV736aK27kQ",
              "nSolution": null
            },
            {
              "id": "787bc05c-7892-44f4-8704-9b2921e24d9d",
              "name": "Supplementary",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kI48CXGb3ds7ZhqrWHLCOK7gl3MCrF6o",
              "solution": null,
              "nQuestion": "1xe6vQIAuduT65limRqrZq7SwUobtmCaQ",
              "nSolution": null
            },
            {
              "id": "535d11e0-404c-4221-bf77-ad91fee35981",
              "name": "End Sem",
              "year": "2012",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1U_piA23mXpufZJFEPKBzjEmJjnDJOeVr",
              "solution": null,
              "nQuestion": "1CAkkU1L_AwFrlN7X2HO6SlGxo8WRBHSK",
              "nSolution": null
            },
            {
              "id": "1a9efa0d-3ab0-4eee-a94f-05e71a1f6087",
              "name": "Spring End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1bSIVgqAEcy5lerWVBWyaecU4WrduP5j-",
              "solution": null,
              "nQuestion": "10WJBzuAkFX2n4e1Zig9yJ7c0LaS4wv7e",
              "nSolution": null
            },
            {
              "id": "34b17797-a82e-4fe5-8b7c-4d57e220c43b",
              "name": "Spring End Sem-2",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Aby3653zf051PaJNdrHt0Iiz23zeKlng",
              "solution": null,
              "nQuestion": "1AMHxy07dfod1KS6dDsKMMZuiyanDKjsu",
              "nSolution": null
            },
            {
              "id": "84ee6777-e696-4b55-9e42-422a524834c8",
              "name": "Spring End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "16qPoPN6C4oSKuKdFvLXBatSW4Y6X-w-J",
              "solution": null,
              "nQuestion": "1qCMfiUamzBVC82d4x898fLcvNNYjEtE1",
              "nSolution": null
            },
            {
              "id": "e8a717ea-b8c2-466f-a1b4-68f8bab253b6",
              "name": "Spring End Sem-2",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1I-woacv_U9ZMLLOFPNfnZz2054tJp9fK",
              "solution": null,
              "nQuestion": "1FM1C4EdNWNskVbQSq062_naxJEbrl7qC",
              "nSolution": null
            },
            {
              "id": "f821a9d3-0735-484a-a856-fcb4bf1b6209",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1lpjnHtHl-r6lvqKZAtfObow_t1WSs5y8",
              "solution": null,
              "nQuestion": "1tgCBMHQWjiMOLW2UsRvBA63Sxt3l7HDV",
              "nSolution": null
            },
            {
              "id": "19cd4a8b-0c74-459d-bb5c-96f3f94892e9",
              "name": "Spring Mid Sem-2",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1V3UzNBZXpsCf-MO6krfKGPNgRlRVcBvX",
              "solution": null,
              "nQuestion": "1v_tF60bCxkaK3mYf23EhAtBQOvyKjXj-",
              "nSolution": null
            },
            {
              "id": "5d201222-28ff-4244-8d9c-e4112ed1763c",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-L9nDxatsEE3DBv22_9jVYY9wQfuzZJx",
              "solution": null,
              "nQuestion": "1vP7STpqGcx6NEEc3ErYtxS76nClthzcd",
              "nSolution": null
            },
            {
              "id": "55f89606-4c62-4ad3-9584-d9a6d3f7eee5",
              "name": "Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Hrn9--du7ROI8oE7fu2P6mwullKToSbI",
              "solution": null,
              "nQuestion": "1U1pLnZm495CkLNEGCMRG1mYPLY2X2j44",
              "nSolution": null
            },
            {
              "id": "785ac4ec-b3d2-4480-a05b-d955bf1115ec",
              "name": "Redmid",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1q8_ZUWhmjxFCRtT8S-Lqsgs7RuAXBDGH",
              "solution": null,
              "nQuestion": "1yH9eI5PZfON0b8HpfuMtmxg6QIvkA_Vm",
              "nSolution": null
            },
            {
              "id": "0defe0d1-95e6-4f33-ae93-bf300c27624b",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1donjJ9mtMEG7Pq1RZ9le-l-BkadWt5yd",
              "solution": null,
              "nQuestion": "1V1JRgKpY43lqrS9ws73njRacnAF9JTAv",
              "nSolution": null
            },
            {
              "id": "91cc4491-9b99-47a3-b9f1-ee2d533c4ed7",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "REVIEW",
              "solutionUploadedBy": "66efc073f740b2b3e5002d86",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JrmJ8kFm5m9jFEPnH5vdvtIMIRuxRmkA",
              "solution": null,
              "nQuestion": "14xPiK_doXtBlST_tXGT60vDcAdFKTjqH",
              "nSolution": null
            },
            {
              "id": "990af882-4efe-4293-a285-ee2995b8cd2e",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1vQ__QH_xyJbL2fS5VuQsLOZVnf2S7Kzz",
              "solution": null,
              "nQuestion": "1Qwc9T9tnYHGewLFcaCkUZ7Vk1mZneFy2",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d213b11bdc9aab413387f9",
          "name": "CHEMISTRY LAB",
          "SUBCODE": "CH19001",
          "Credit": "1",
          "folderId": "1Sm5xgD1Mlp_NQ-YxjRM675-QQv2yTuOp",
          "pyqs": []
        },
        {
          "id": "65d213b11bdc9aab413387fa",
          "name": "YOGA",
          "SUBCODE": "YG18001",
          "Credit": "1",
          "folderId": "1g-UmLq9QRmE5pUP-XcVvzsZyb0JvLZiY",
          "pyqs": []
        },
        {
          "id": "65d213b11bdc9aab413387fc",
          "name": "WORKSHOP",
          "SUBCODE": "ME18001",
          "Credit": "1",
          "folderId": "1uAo2YA57kx4pEjdu7r4yqFBZTsCi--YW",
          "pyqs": []
        },
        {
          "id": "65d213b11bdc9aab413387f5",
          "name": "CHEMISTRY",
          "SUBCODE": "CH10001",
          "Credit": "3",
          "folderId": "169Oi8YbSco-OJmkZE6LKnnty62IekBOM",
          "pyqs": [
            {
              "id": "b459ef55-145b-4dc1-b450-8273f879eece",
              "name": "Autumn Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Az7NeFmz_jHoGctZiGL94s6VSTHYWzoD",
              "solution": null,
              "nQuestion": "1__bnWCsr8RRdZvnfH0LezCEKNbTjeo8_",
              "nSolution": null
            },
            {
              "id": "e4233b06-31e3-4f22-9bfe-b7ae3bc5d263",
              "name": "Spring Mid Sem Exam",
              "year": "2014",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ECd2F5yiMWJh-cER1VK9X_sbTjH-h9Ay",
              "solution": null,
              "nQuestion": "186WXXykk-M7htnNfkrbP4Gnk8eOMEvwf",
              "nSolution": null
            },
            {
              "id": "195fc947-be12-4e95-92c8-dc14f370a8ca",
              "name": "Spring End Sem Exam",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "14Ng4RV1qk365j5j9IYRWdOZAWQ279YNu",
              "solution": null,
              "nQuestion": "1x6ZQzKFjrVXAtzo2MRwSmUeqq2jV0HK5",
              "nSolution": null
            },
            {
              "id": "ae7db469-8db9-44ca-83d0-3f41eaf2ec00",
              "name": "Autumn End Sem Exam",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1spM0dVDHzPj8R-DRfhpo9Sb_X7tr_By5",
              "solution": null,
              "nQuestion": "1Py7hnvF8bEEn544YAT8dL8MXpWOfGqwh",
              "nSolution": null
            },
            {
              "id": "dc8c3f94-7be3-4364-bfe6-dc8b2d79db99",
              "name": "Spring End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15U4jFFz5GcW9I3lOhv4ghV3Y8qQO-RyI",
              "solution": null,
              "nQuestion": "1q6Au2a3U55L6FHx1OQbfaNEwPtAWu9o4",
              "nSolution": null
            },
            {
              "id": "c08d1f12-a1cc-4e8d-9899-a5ef01fe94a2",
              "name": "Autumn End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1EsvVrWAvDV5h_Oj8lUtKF6rqEkQuSKnL",
              "solution": null,
              "nQuestion": "1kcxF2inuh5mScaIxBEE0ZOAf63Aa31mU",
              "nSolution": null
            },
            {
              "id": "e543192f-8c1e-4759-9aec-62976dd00868",
              "name": "Spring End Sem Exam",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1TB-suqBQ9QJycYHZjvJS1iJIYn6XbgUe",
              "solution": null,
              "nQuestion": "19EWtR78TcgyLbVaFrpud3qSxvWfbKwRQ",
              "nSolution": null
            },
            {
              "id": "207ce548-0b89-43fd-b4d5-f4c44221b93c",
              "name": "Autumn Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1TtXFOEUecYj2slrvPQt5kT27QZzFTZiW",
              "solution": null,
              "nQuestion": "1HVhf1t1BPcgOs4PJUH90FzPEEbNRK6J9",
              "nSolution": null
            },
            {
              "id": "3bb371f1-7e11-42b4-a69d-97e9bf91de44",
              "name": "Autumn End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1MmDTv4G31i5rwOpp0jNiFkEFGf3kgcLR",
              "solution": null,
              "nQuestion": "1IxTWa6_ckh3pCVSKC_6i2VhFR2aOIzEn",
              "nSolution": null
            },
            {
              "id": "49a9feb5-037b-42f2-9953-f151829d7c43",
              "name": "Spring End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BGeuINYRTffDFiZC8bw0Wi9SN9NegX_z",
              "solution": null,
              "nQuestion": "178appfjFvw82ZWIKxTfuuR_iuJY7_vgj",
              "nSolution": null
            },
            {
              "id": "fe233d12-3565-4d0d-9659-debe6996ea16",
              "name": "Spring End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tvuisnGxfLTD0h3k4myQVOIpxHTNyzpP",
              "solution": null,
              "nQuestion": "1h9g01sf09g4iMTO9R8jSnXWaVwTBf_je",
              "nSolution": null
            },
            {
              "id": "7b588ffb-e9af-44ce-b14f-ad2d0606bc90",
              "name": "Spring End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1onLubZtsy2NT2hf56yNYIz3rv5-FDRD0",
              "solution": null,
              "nQuestion": "18vFLAedqItrailgS4mHYZxsCtk1K0Xuh",
              "nSolution": null
            },
            {
              "id": "e002acde-c06b-4aff-bfee-923a48eb3fa7",
              "name": "Autumn End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1MPecTUx2N6Pn6GtF42rLr2Z_uNuF0Q77",
              "solution": null,
              "nQuestion": "1VAzkksdEsZ77T_U_wqXmP1oCAF7vdfOT",
              "nSolution": null
            },
            {
              "id": "711dd448-7b7b-47d8-9ca9-b3c375419779",
              "name": "Autumn End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1f8TL3D15lsuO9OvOlL7YNuHHmnd1NJfH",
              "solution": null,
              "nQuestion": "1AcPsXkVGxGggMJoLZ_OpRz_DC3cnEn7p",
              "nSolution": null
            },
            {
              "id": "1fc8eae3-1a6e-44cd-bc1d-e4217d17a9ef",
              "name": "End Sem",
              "year": "2010",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_mCPCUP0Ap2mkJ145j0XJMa-nSiLMUaX",
              "solution": null,
              "nQuestion": "17gD1ZfJinBPwEG6EHDzhc0iIdl_NirRb",
              "nSolution": null
            },
            {
              "id": "723aac93-c7be-4e1a-8675-d1eb529059bd",
              "name": "End Sem",
              "year": "2011",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Qaug-GkqL9XcZ-QJ_mfvEzYLZjgwdahX",
              "solution": null,
              "nQuestion": "1BlVNmaKpM4_sjutuhQD-pwD43ZGer6fp",
              "nSolution": null
            },
            {
              "id": "18f5c731-6275-4f47-93c8-40c9dc2fb1f9",
              "name": "End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66f2dda6f740b2b3e5002db1",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1OZ6CLmY3eYTs6lIaF3v46vUsQRzLboNw",
              "solution": "1Vx28RCJAZUVCvnAJjUyHsQ0XJm0AlR6g",
              "nQuestion": "1ovcqrJ12KkxslpYvr6o1elSEHfFx59eW",
              "nSolution": "1SdnZf25C33_sJItUYWMZt61YJUaVk3yH"
            },
            {
              "id": "939a65a9-f99e-4793-9346-fcf9a0b4dbd6",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HRLw8Wb8gC7sTaKiOy2BrGAEAvtUzxoT",
              "solution": null,
              "nQuestion": "1JQS4uDEGBSWpRDaXegQvm0Bwy-5IShze",
              "nSolution": null
            },
            {
              "id": "a2fd75c8-894f-473f-a361-42189bab5f7a",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NFdmgnZ_Z-8UWYEfJRYplV5U4nfPYVeP",
              "solution": null,
              "nQuestion": "1qspnQcBZEq3bjRi1QhIulXRVZrc4DsmK",
              "nSolution": null
            },
            {
              "id": "e0740327-d715-42b1-b164-b9e3305e34db",
              "name": "Autumn End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1O9pWT260wiOqgadmbDGbYFkj-iu1EX9E",
              "solution": null,
              "nQuestion": "1cP1Sn88boqZiZaXljUXgNn5QbNM_4uF3",
              "nSolution": null
            },
            {
              "id": "7edeedc9-fa5e-4cd1-bacc-8ea334dbb8ee",
              "name": "Autumn Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1qnoPlEXy-xNcX3RfW4ur2sM04k5eDhuP",
              "solution": null,
              "nQuestion": "1-NqYqmxLckDAJUR_ZMssAnNE7ix7NRCq",
              "nSolution": null
            },
            {
              "id": "0d8c5509-9070-4c4f-86cd-ab12e5d9a9e8",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Y2LtFGY6TdC4DRxxAi_N6r8r-IviHJie",
              "solution": null,
              "nQuestion": "1Dug7hYHZsrOq5ow_bclPc0dIeq7fnE6u",
              "nSolution": null
            },
            {
              "id": "54578a8e-9ffd-4ebc-998f-4673d9c4663a",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1L3lzAoMVFWKl8rGwg0MiwAmy0jpMmXsG",
              "solution": null,
              "nQuestion": "1TlxEnC6uen-daIuy8y2rl2Md3im0aP88",
              "nSolution": null
            },
            {
              "id": "9a62f656-ae55-4698-94a0-694116cee5b5",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pQp2NK2G_-JR-isz8dhbgx2ATI_iztF8",
              "solution": null,
              "nQuestion": "1wV95kMrEMFohOdRBAf-NIXRYaILddnXK",
              "nSolution": null
            },
            {
              "id": "b4000091-588e-4284-b806-13562ec6f8c1",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1l1_6-TQi2XOL5TfIOoYe1hdxljNL_2Md",
              "solution": null,
              "nQuestion": "1CZwhNw-kS6rsVgxpiP9X85TqcqVubas-",
              "nSolution": null
            },
            {
              "id": "6dffec64-8062-4723-be1b-6c2b4dd04e19",
              "name": "Autumn End Sem-2",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1y48m98G4vhawYkZiaTwXtNk6ubXvMsOS",
              "solution": null,
              "nQuestion": "1_-P3ZqqJZkfjU5eCckEdH7YCgP7-0iac",
              "nSolution": null
            },
            {
              "id": "b06c7609-0cb2-4c7e-8c46-2b0351e11739",
              "name": "Spring Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xa7Y61aNDVoObLv_PFFCjkZ39OLG6wpk",
              "solution": null,
              "nQuestion": "1ZB5VWREAFVPSMYj8tPOarCb7L_AOEKLD",
              "nSolution": null
            },
            {
              "id": "619d8287-1aae-492b-a7dc-ad8823f0a107",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1jQhqb0ZoyOu3RoS9R-RJZQxqohkCKbXX",
              "solution": null,
              "nQuestion": "1JK32gq5Lsw3wVkol5v4ibhkgK_caNpBG",
              "nSolution": null
            },
            {
              "id": "47a5868f-ff5b-4c81-a100-7d0e971cf0b3",
              "name": "Autumn Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Yya6aRpPG3lKxLZjGlrZECW_x6EkxOop",
              "solution": null,
              "nQuestion": "1iOVjFmoL2apsMG0-jZy5b7V64wz9zcxL",
              "nSolution": null
            },
            {
              "id": "7f3cc5ee-e7f0-4e48-b326-0dd29d7f588c",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fIFVZMzJIjgcMO_HPB7vqLC9o8J4x_Iz",
              "solution": null,
              "nQuestion": "1wjDiLaQKLkWUdb-35x6cr5x43HZdVPuN",
              "nSolution": null
            },
            {
              "id": "e4f73427-e21b-44f9-b0b9-8f228f789c3a",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1zSJlq5XqsX0NgAwkSYWGbBpR0fo7uCFc",
              "solution": null,
              "nQuestion": "1k0h_Kae-vdYcdNtF-8RLz1OKAfZEppD9",
              "nSolution": null
            },
            {
              "id": "3cd976ea-b010-4355-9384-01f1cb4accae",
              "name": "Spring Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1A0U4DRh5PCAas-qz79mOtDP4ZoBx57cA",
              "solution": null,
              "nQuestion": "1vSaD9TWbKVkYSb46dnnMcZucGyQ_qq5n",
              "nSolution": null
            },
            {
              "id": "04259ed7-246d-4be7-bc01-dfc1f1d5ec2a",
              "name": "Autumn End Sem-2",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1456hNMADB-NTbOcHfzRQ4gy9CHU4xvGW",
              "solution": null,
              "nQuestion": "1a-63k8lr47olKKJYOhGxcBDbEBLzFF3l",
              "nSolution": null
            },
            {
              "id": "7fcaef17-a051-4dcf-aa85-c773ff6c138b",
              "name": "Spring End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1yUmYNiu3Mj2inWXgQfJ3zyE1SPv900ho",
              "solution": null,
              "nQuestion": "1QXH0SieXNULkoo1kthA5uOA7EcPYO6Y-",
              "nSolution": null
            },
            {
              "id": "f550724b-244c-4b35-896d-503506a009d3",
              "name": "Spring End Sem-2",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ejN_cQRTpAiMEqXFW11iCF3EdBS75HcD",
              "solution": null,
              "nQuestion": "16OWxTF6dN6UCsGiDEnV5JFzVwjEcWjdM",
              "nSolution": null
            },
            {
              "id": "2dabed8f-d047-487a-a504-a8e5798e04fb",
              "name": "Redmid",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "14GWvGssZhcwVmyvvumGTbktfCYtGdKBQ",
              "solution": null,
              "nQuestion": "1-DBJS5e3pwXAhX0D6MoHicX-JGYtTBCP",
              "nSolution": null
            },
            {
              "id": "5f3a242b-dffd-43c2-b2de-4b2836cfc1a0",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1s26xlZ8i3ptO3IwjYpWU3lt4hM1Xq7ZL",
              "solution": null,
              "nQuestion": "189JPK2pcyxgiupQOWdbBElGZo5XhANOd",
              "nSolution": null
            },
            {
              "id": "16ee62f3-a555-49cb-b7c4-d547a729cb80",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11h_pAI5ExK_cPTMY5-Sy1C7cQG22Bkow",
              "solution": null,
              "nQuestion": "1zNrxbY6qLetOZZrteDQPwTwtk94UGTad",
              "nSolution": null
            },
            {
              "id": "1b445184-57cd-4876-9414-041ff55ee032",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10zxzrW7228x7jJ5H9kpGU9U5_FRlWGka",
              "solution": null,
              "nQuestion": "10k_p3de7vD7XZcie15NjC3DuCQY0_BTq",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d214db1bdc9aab41338803",
          "name": "Industry 4.0 Technologies",
          "SUBCODE": "EX20001",
          "Credit": "2",
          "folderId": "1aO_AsMZIEOCe9karKTjW85gHzZMSOQkd",
          "pyqs": [
            {
              "id": "07008c90-5fa4-496b-937b-9b3aaae3666a",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6623bab4ad6e7bd16c843fad",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1WehTewj244YSnUQiLk3lkUuQufAsSs9R",
              "solution": "1blkxc0kNllCBSTsJKfx1VBk5uYoSBEuX",
              "nQuestion": "1lAsuc7nNQSB9FVhnChfkITtcHnqdbW7A",
              "nSolution": "1QbYX2KSlbr-DZkqqa9Ktos5e6phy1rl5"
            },
            {
              "id": "b78f80a7-b793-4cc3-be21-5f988a6d8a28",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66ddd9e742841c454a166ed3",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1bjMCg56RVluCI7X0DJFZ97_sB-YMYcMS",
              "solution": "1Cf7GNPhA97f-uNhEw7u-zc2i-p3Wwofs",
              "nQuestion": "1yEi7FxGbjm1NiOK1-SVCfidvUwzEQFsG",
              "nSolution": "1pS0WZgUEsqpOCVX5Lw6MD53_8sQlQ6yW"
            },
            {
              "id": "5976e41d-c16c-4141-bc02-905c37e01deb",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1FE-RbPZcQ8invUW8b11HS7YwpJPC1uc9",
              "solution": null,
              "nQuestion": "1mC24h8YrqFo0jP6J8u09-IKOXLCifYYF",
              "nSolution": null
            },
            {
              "id": "7ebb498b-ecef-48d3-b8a2-ce6f7f4a8087",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "673e3ae15a965de869c4369d",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1zWwcSe61OP6kHs-cWWxpOIhfiuxmUDCR",
              "solution": "13nLDOrMrt_hTtW4_1tJdyou6QOVWucmP",
              "nQuestion": "17asZz7Sr_GBa7ND4B1t3sGwpwFRLQ_xl",
              "nSolution": "138qP6yKum7qLnCrkNDUmn3KTxVmiGDQ0"
            },
            {
              "id": "decb9c54-5e30-4836-83c2-be24d6f4bc9a",
              "name": "MakeUp Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1V2graeyo-G4_L6tlqu8njTqTDZWuD5vi",
              "solution": null,
              "nQuestion": "1kzoxRlQ3YAy8ny4hMfu4VCEpIeuBI-rZ",
              "nSolution": null
            },
            {
              "id": "05c1f475-2cba-4043-bc4f-8c785f74299c",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721ca165a965de869c4338a",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PAKxYaIt_JDvbZRzgKgRzT4k94JUSNB8",
              "solution": "1elPDrE3mtqWZ9QQFu7Rd2V_EfTGhwN9Z",
              "nQuestion": "1PEKXN32uiXxlMvDHfu6pCxfKA8xuaq3x",
              "nSolution": "1K5fAhL_6bjkt36QtuL8PID2FV2YCRXMn"
            },
            {
              "id": "1d6c3a5e-650e-4dd4-823e-a6bb9d42033b",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1dJ3rp7rkH3tMa3hNfsv0aP448lYgYAua",
              "solution": "16jz1dl6vF11t9W4-KXkY6rRhD4nhOO7w",
              "nQuestion": "1ywS4bJMe4UX5GDDROCoQCozXcD-Hps2I",
              "nSolution": "1u_QqQGwP9D1izP9SFKBAOVM7v7S-I-ou"
            }
          ]
        },
        {
          "id": "65d214db1bdc9aab41338801",
          "name": "Scientific and Technical Writing",
          "SUBCODE": "EX20003",
          "Credit": "2",
          "folderId": "1Je_r3OrZOKTMNiCFO_tLQUncxV9HVY9F",
          "pyqs": [
            {
              "id": "09646e78-46a2-4dd9-bd2c-73e52fce4284",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6625464cad6e7bd16c843fc9",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1OF4VqtzAB0-GVToTrSSZtSD5KsZ4Y17c",
              "solution": "1srvLdtSJiP4_7f8cYV3FNn4fZ3Lu_gPQ",
              "nQuestion": "1cKEBdknu2TyNGgZzw1jhsMau1-kI5BVG",
              "nSolution": "1MNDoH4h9BvWS7odFyukK0y1B0t_lbfzn"
            }
          ]
        },
        {
          "id": "65d214db1bdc9aab413387ff",
          "name": "Data Structure",
          "SUBCODE": "CS2001",
          "Credit": "4",
          "folderId": "1wylGvLGZXWnApRkc2noJUostT8FuGE6K",
          "pyqs": [
            {
              "id": "2a0460b3-6143-48cc-bd47-d80a1979246d",
              "name": "Autumn Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d7006aa226064c68a248da",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1UcXgIurxnjNuvEAQULoNI0o7RO1vr9lW",
              "solution": "1g8YsutFpbd3p2-KmgKqXEswrWj0U2YUf",
              "nQuestion": "1RpWK50bM3krK7N66njMG-zMEreIVS-HJ",
              "nSolution": "1g0NWUp6fnbBM083K7cC2JGWqIMMtNkAE"
            },
            {
              "id": "5286e02e-4f03-40cc-a4d5-fc8a0bdee146",
              "name": "Supplementary Mid Sem Exam",
              "year": "2018",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Am4kyNWQ40RPr1AQB3JYqECm0YTmvr32",
              "solution": null,
              "nQuestion": "1Am4kyNWQ40RPr1AQB3JYqECm0YTmvr32",
              "nSolution": null
            },
            {
              "id": "f18ba544-7d2a-40a4-a493-e279928757b2",
              "name": "Supplementary Mid Sem Exam",
              "year": "2017",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1CeioW_oiGqjQokROUU-cGVqJt6Gymehv",
              "solution": null,
              "nQuestion": "1CeioW_oiGqjQokROUU-cGVqJt6Gymehv",
              "nSolution": null
            },
            {
              "id": "a2b8ede0-bff1-46e1-a114-97374cb9940c",
              "name": "Set 2 Autumn Mid Sem Exam",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d6ff86a226064c68a248d8",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1A1Mr-3cgrAuRZAM8ZSaKk7TcIZuVTS1o",
              "solution": "1wxn35f3T94s4xMPprp5KB7RJn1J16mPC",
              "nQuestion": "1gRU2NIxSoP5c9ji6uOHHdOyya3UVKXgn",
              "nSolution": "1azxzCeLoGx57zbtn5EOi45HOe5csHbaC"
            },
            {
              "id": "9192274d-6cdc-4a89-a73c-d6f052549642",
              "name": "Supplementary Spring Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "18I33Cs9UH2-wCzFU725PVznZBBxZMVaI",
              "solution": null,
              "nQuestion": "1zdZHtU5WBrvDLJi_92YMcMtphWYEz766",
              "nSolution": null
            },
            {
              "id": "71388cf4-14a2-4b67-a832-531855759aba",
              "name": "Set 2 Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11E1EslU7_iYExz8GkBRojIZtnVmgYgD3",
              "solution": "1fTUcLASI6bNg8FpmabDmcncKj_fTmHcv",
              "nQuestion": "1ufbuGQ1Cmofm3NtLTRRzgvdwu6LiQ1a0",
              "nSolution": "1uz4bC0-VNurKQVER1Dl8xhwTi5VTsuTP"
            },
            {
              "id": "11d80adf-4564-4c9b-bfee-805a27341b67",
              "name": "Mid Sem Exam",
              "year": "2014",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1mCSyYEN1077K3mtzyhEwujyRej79bf8C",
              "solution": "1JA-xmHe_d9qmul6RTRMfe35kWCosohGE",
              "nQuestion": "10uq82sZnfzHOC809kd8xOkZLveSNQt-e",
              "nSolution": "18PWiRdpkBJsT0cd1YIqJ8K-E52c_5L9P"
            },
            {
              "id": "db7b30dd-f5c1-40a3-ba42-2faf424870ef",
              "name": "Supplementary Autumn End Sem Exam",
              "year": "2018",
              "type": "End Semester",
              "status": "APPROVED",
              "solutionUploadedBy": "674219455a965de869c436fd",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ljy02IKa8BkfBKUuuXE7GrvlPcRHrCQO",
              "solution": "14cuWduOuMtSAl4Ua_jOLhQDAYTo8mYjp",
              "nQuestion": "1ljy02IKa8BkfBKUuuXE7GrvlPcRHrCQO",
              "nSolution": "1Bfsdm9yEQP4h6cDMWguIykRicJA-fve5"
            },
            {
              "id": "6c14a50b-c953-49b3-b361-03b25dda5122",
              "name": "Autumn End Sem Exam",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "674218b85a965de869c436fc",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1QJz7pjF1zGiamkm28O5GQSny12vMn3lN",
              "solution": "1ed2kdStf2g0Xhr55mn0HdcC506qXVjbf",
              "nQuestion": "1ksXsInXIWScbkvfwqXY08eaI-4Mxedc5",
              "nSolution": "1TOOyLHKOkO2ckpLiK3SBszHliAXgGSXB"
            },
            {
              "id": "1cb668e4-43da-4168-9fcd-0fedd36cd1a4",
              "name": "Supplementary End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ejiQwvUD-ek5v0pVJNZxKC4xSpveNNgW",
              "solution": null,
              "nQuestion": "1RD0rVcE3sSEdwAt16uhMjy379RsQng5g",
              "nSolution": null
            },
            {
              "id": "fd2ad68d-39eb-4045-b46a-2e00405cf797",
              "name": "Autumn End Sem Exam",
              "year": "2016",
              "type": "End Semester",
              "status": "APPROVED",
              "solutionUploadedBy": "65d4c95baa980c579a71dacf",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1XlBdW2CqzSAbN7CMSbOqBcJR26gNsI6z",
              "solution": "11lzrwGKLUlLDmAl14tcKv3gJYyjlRnYL",
              "nQuestion": "1XlBdW2CqzSAbN7CMSbOqBcJR26gNsI6z",
              "nSolution": "13dG8dWaDoqS5CBLpwaMM75dk5MlS0ovA"
            },
            {
              "id": "f981e584-b53d-468e-9217-491dd35d58a5",
              "name": "Autumn End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "18QyAmBY0XTrBcFrhgFCZhXC-cwecFWeW",
              "solution": null,
              "nQuestion": "1B9sH8HySxFVTuiGVcBcPJHW_JSrfUO1G",
              "nSolution": null
            },
            {
              "id": "68a5b6c7-ea3e-453b-8b86-90da88c83ecf",
              "name": "Autumn End Sem Exam",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15q_jkxTBJov5fosEKUIo6J5mUlmHv0QZ",
              "solution": null,
              "nQuestion": "1RjTgCb1aHc8LOzslX7ZHT3AaNKLcxoq8",
              "nSolution": null
            },
            {
              "id": "4e46d30c-feeb-44fe-a729-94e8b7bf69e5",
              "name": "End Sem Exam",
              "year": "2012",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1lYCgn0HXtDkeoTjg9KQ_HmAHgaqLy8cK",
              "solution": null,
              "nQuestion": "1Q3z1SBiaUyshyEUTemusMSgEULWJkAR_",
              "nSolution": null
            },
            {
              "id": "1008e464-83e3-4679-ac2c-7d8bb1a8a2db",
              "name": "Autumn Mid Sem",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "660c5fa530641ad00aae8ad6",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11kRX_ZKVF-SoMIwDon459oiLfTJWvz36",
              "solution": "1bHwBxTfdkQG4jbJ_llZ73-fup6xd4cro",
              "nQuestion": "1kNwqj31-IGHzgjbHtp7qytqiAM0X22Lq",
              "nSolution": "1oux4B_HIflrvRnYxsTzxpyGCtoiua7lq"
            },
            {
              "id": "e1276cfb-75e9-4f21-ad28-f4f8d8d8ffa0",
              "name": "Spring Mid Sem",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d70af6a226064c68a248df",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Kvad7U4_IsaTXIoU0PoqIeF3Yj67b7K5",
              "solution": "1IWvIvtbvjSfTaJEUe0CyFI2T0KpOvmu9",
              "nQuestion": "1BjIJA3z4EinXJRr3Cj0H-aJGpZ4weGNa",
              "nSolution": "13zbIYtYNk-YSBobuVuFfmyluXal8ioBC"
            },
            {
              "id": "ffca36b4-33bc-485b-99cd-ca739b2afac4",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PAzJWRenx71HKISLI0QOgS6JsmueTNH_",
              "solution": "1TkM888cNnqze7bEr2s9qVR29iATyoqSV",
              "nQuestion": "1HMA1_ExPC-__2urWa1XqmFzlM9ITnHe1",
              "nSolution": "15ZaUSg11A7CDRcl_WmJhAKZDuzMkTbXw"
            },
            {
              "id": "20552fd0-7800-4c56-a7b6-de5465ef09bb",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "67423b1f5a965de869c43702",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1na32Zz87lOx5iPO8JIoEp3jUD2ivn11R",
              "solution": "1CUavmS5s32xs-EeClLLudRpBXW8SOxu0",
              "nQuestion": "1TxZxiasMPXBg50Hh6GybP2sC3gNEDuaj",
              "nSolution": "1mPRuwaYTxOD50nwUKwaUwfk6blo-C6tu"
            },
            {
              "id": "7944532c-5868-48d2-9cc0-63eeaa22bf96",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66dddaa042841c454a166ed5",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PWqx6MvxGTT8_Rdb-W1Q0PDjC_0INQuc",
              "solution": "1aTEddY12ANvnlpQED5LOeNiQHjwj9b14",
              "nQuestion": "1PRqG3-sfWAeCqNWGtFyiI3fWTevRVY__",
              "nSolution": "1MKqZB0bLYvTTBx1ftk3PwV-5YuHC2cSj"
            },
            {
              "id": "5e175652-f78c-4c7a-b3e7-09844bd39116",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "REVIEW",
              "solutionUploadedBy": "674384da5a965de869c43721",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hKytcFt0oHMrsMWlFEeW54gckVJVq5Al",
              "solution": null,
              "nQuestion": "1gbEXsXpg1KHV_wnbUiOYPt3nmSnLT8JM",
              "nSolution": null
            },
            {
              "id": "3b6ef17d-7b55-4bf4-af1c-16a0270a5294",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6623bc78ad6e7bd16c843fae",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17sk-Vkv2yDjnMPZtQk7MLjw8Ry3Ulek7",
              "solution": "18GprrfjGhCN7JRhh23eYX6ZnPCh5u-Uj",
              "nQuestion": "1onE3Wy25_UMdgjc8PTQ_uRhK8UEI_s_8",
              "nSolution": "1ICHDHkGqYhNIvkUfHgIEHlf89luByVUA"
            },
            {
              "id": "e3887bc7-cc56-4e70-82ef-111c49b03d6c",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "660a4e1b30641ad00aae8aab",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NXPJUGCaGP_2MFOadEPmOTpfRJFDsxM7",
              "solution": "1Y03YTeZAwFjGa2OPBh9Lr_W2e5i1afI9",
              "nQuestion": "15tRW7Q1Sg4TIPj_oC9p584NDnXeiDEkf",
              "nSolution": "1E9SUoSBjOR9zGCzdF92ebUxtonI8stWK"
            },
            {
              "id": "7b0ed91d-4eca-4ecd-8031-c4b0750a4cf1",
              "name": "Autumn Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BZbq1K7OdEO5Z0hA7fW4W-1tO27_QJt1",
              "solution": "1l0LUFLNtfU2WuDWtMDxwssSK-Hz6y1d1",
              "nQuestion": "1L9X_Ed5GJHihg0I30vMWgL98JtW0OcqI",
              "nSolution": "1QRA2vcG891zUBrKuvcqDE4HNcmX7qkfy"
            },
            {
              "id": "6212df10-0620-4565-9786-c961717615ad",
              "name": "Autumn End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1llpwm_Jwgv37MXUVapADWv5QvrlOQ7Bt",
              "solution": null,
              "nQuestion": "1nrkav4eI3uNnp52xRiVo27Qs5JPKMdhW",
              "nSolution": null
            },
            {
              "id": "e2c44e4a-9a62-4f2d-bba6-d94d8e45fffb",
              "name": "Autumn Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1mJYewdw2CFXjFj4TyFhpesmqSzwKZf3Z",
              "solution": "19816theXU556H9KVU7-ikt4aV9MmHSPH",
              "nQuestion": "1nMT2IxZGbdOzehOU5axNjDRXLjhnnPa5",
              "nSolution": "1zM51QxKP6zHP8L8dgGyCbsq0LfNDsOmf"
            },
            {
              "id": "e681a3c0-4403-471f-8ee8-31b5f2a4dbb8",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1y4zKDfYJ9UrOtsiwKxRtR7-BnMm9j7RD",
              "solution": null,
              "nQuestion": "1rM1pfT_377tyNp_2hYtVM4kB8ocf7xxE",
              "nSolution": null
            },
            {
              "id": "229f48f8-bf8b-49ea-8e8b-73ce7adf2b51",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1lYtLY4ICGuzmReS1xaEs6bBVNY4UzU0J",
              "solution": null,
              "nQuestion": "1F56YJbHW2J9h5T6ojKKyVc7w_4rboqzu",
              "nSolution": null
            },
            {
              "id": "3ae06ccd-1256-4c71-805a-8568817614ec",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tMPNmWEC0jX0zQMMaftn3kSEqBFx9u1u",
              "solution": null,
              "nQuestion": "1FqKkEa46MVqmnUQswTcWf3BzRdCgbr5b",
              "nSolution": null
            },
            {
              "id": "d58c1657-36a9-4e69-a99c-6252b74e8242",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1TG3MX0WPLMyjtUj7xlPTTSDy3rpHemei",
              "solution": null,
              "nQuestion": "1EtqZmE1oQRp70GEiZ5fE1eh0NDqDOgVN",
              "nSolution": null
            },
            {
              "id": "30548b50-3667-4f31-9e03-9d87d68408db",
              "name": "Autumn End Sem-2",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1yHTjQp8MliZFUns0aHjid9a3n3Y6dj3d",
              "solution": "1l5qM8tChbfvdl_KM0M_gWPBNpvPz9j9O",
              "nQuestion": "17Vy_mU5R7cTWgGfYamhr5DG6PpGfgKAP",
              "nSolution": "1VwF6O_Fw8JtoA7JIJOCAGVsf-ZBZQGro"
            },
            {
              "id": "265499db-b55c-4e9a-8130-6c066b1b9787",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721c9b75a965de869c43388",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xjrk-E29lm9o4l3KL5FZU_uIz-inZKuC",
              "solution": "1wZ5dtHa2sqlqg_4kND90LNdXwYMU-LOR",
              "nQuestion": "1yrKT-rCk0EmEPknHhO9ZZf6LrWLXF277",
              "nSolution": "1_9AYkHFgVr4KtHpeN3Ihu-wA0n7AstK2"
            },
            {
              "id": "0e8cf2f4-5417-4197-b412-c1452c1aacb7",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ROoVMj50WZonI34dmc3oDCLorh8angb4",
              "solution": "1eolkrFJqFQDM9GXUvRFxwRhoHPP011_N",
              "nQuestion": "1JsXGAEoEvnKYPNRbJarzuEH6qeVUoxdW",
              "nSolution": "1zyKI9-V2-WfO9lFftg2dTEHeAzZZEYy5"
            }
          ]
        },
        {
          "id": "65d214db1bdc9aab41338800",
          "name": "Digital Systems Design",
          "SUBCODE": "EC20005",
          "Credit": "3",
          "folderId": "1PMBLip9V7jVPNy_MpOhgNtHEPwIC_tsu",
          "pyqs": [
            {
              "id": "4eeaa480-cb8f-4b28-86ac-7c5d43959d02",
              "name": "Spring Mid Sem Exam",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1mgoPTeBgEoCluvHA__550_lvLsNw4unN",
              "solution": null,
              "nQuestion": "1CGrANRQ9-dVphQBpxcZ522-gtHkfpx0n",
              "nSolution": null
            },
            {
              "id": "f64f63d8-5f0c-4b8f-8710-4b3b005807b3",
              "name": "Autumn Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19QI7Q0eTYQPbF0Tr6u1QdDLodGyS6N4k",
              "solution": null,
              "nQuestion": "1XH3DwnuVgLYJzXiwSb7KbepHOpK_YlEi",
              "nSolution": null
            },
            {
              "id": "9701639f-58bf-4c63-a024-26c75f3af42e",
              "name": "Autumn Mid Sem Exam",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "14gMXoOy7mPQRCbmMxHIIQFHMfB0SPfPh",
              "solution": null,
              "nQuestion": "1Jn-iAceRXcTcDNDjvvH7cQSW5_1aJFiU",
              "nSolution": null
            },
            {
              "id": "3068e0a0-f8cd-4ff8-b8d2-6a6c9dc669bf",
              "name": "Autumn Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NzakyXLFSE9qX-P03cOlQ3nUo4fDasx_",
              "solution": null,
              "nQuestion": "1vdkYXVx-x8qCQ3DTvTJE4zc8ZwYdCd9P",
              "nSolution": null
            },
            {
              "id": "02038d1c-538c-4468-bf74-34e221541b49",
              "name": "Autumn Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "673b0d8a5a965de869c435f3",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pwQpNVUMGpv1aq1X5NmDr7X0u5WTG4se",
              "solution": "1P1BVt8UlqHpFNZ05qNqhElUtU1Fd_U1i",
              "nQuestion": "1TeK2RkOaxdDiufG7m0nzbE-AkjggDAlz",
              "nSolution": "1cZbu1ABxYEc9EZyjYQTrg_pKjU1JqHZ4"
            },
            {
              "id": "5eb8f739-9e02-4f50-8164-2315cb9d0d06",
              "name": "Autumn Mid Sem Exam",
              "year": "2014",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Mf7U3RNnU3kPcROqzJqpDXyoWOIvKCh-",
              "solution": null,
              "nQuestion": "15zkQ_Wq-UQYZRFtjvLXat6c3DbR_NyFT",
              "nSolution": null
            },
            {
              "id": "3b74b34f-3b1c-43f9-ae2e-e7517f0f6e23",
              "name": "Autumn End Sem Exam",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1jGjo1CRK68-Q152OJUI13SdQGo7tbozu",
              "solution": null,
              "nQuestion": "1bDOvHnGl5lhNrHr1KVfhLo5ULYZd8Osd",
              "nSolution": null
            },
            {
              "id": "a547d9da-3c42-4fa8-bd6d-86cb8742afda",
              "name": "Autumn End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1thCCdnnzVg0PFCOuOKOGU7OgmHjlZ7kE",
              "solution": null,
              "nQuestion": "1f17_nVk1P-VSGJ6GrTuXKgNdl1WrJ3cO",
              "nSolution": null
            },
            {
              "id": "833c9c85-894a-4200-adf6-e4a4199f2add",
              "name": "Autumn End Sem Exam",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "673aff0e5a965de869c435ef",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1r9Ie6E6PW1PrklT-fv7X-koWpqrpqVOR",
              "solution": "1HAeBBgwpwxLj5BjiQtQaOR1kQRugf8AR",
              "nQuestion": "1mR03XFBMpthMtwNZugx5dfaSmR9t5Znq",
              "nSolution": "1IlBdmMIrOIqlwqp5-z79JDuboNEPtKxy"
            },
            {
              "id": "5483bc66-31db-40b0-9de4-b5f901784913",
              "name": "Autumn End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1FoXW1MVi4QLMmy3IM7BvWb-B_2js7JOx",
              "solution": null,
              "nQuestion": "1Zvt6RKLytAKAvb_AvOm2dCQPa-eLHmpU",
              "nSolution": null
            },
            {
              "id": "48c6401b-4d96-489a-85f0-eb4d0ab19c61",
              "name": "Autumn Mid Sem",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Ua5A-PjKnU9kWCMl1IOncUc-Hx79VWs9",
              "solution": null,
              "nQuestion": "1j2Hu8dSMohSyTilUUMeJo7aEuIxx5ArH",
              "nSolution": null
            },
            {
              "id": "1ad8e28a-b244-4f3e-8a35-a875cbd5aa47",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1XxRKa84WJ-HHs-yZAgaivWILOC6git05",
              "solution": null,
              "nQuestion": "1KK8ZZHPluEzstDew1sobg2xkqXI4Jviy",
              "nSolution": null
            },
            {
              "id": "04f5a56e-66fa-49b2-8c86-244773721d5b",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "673a66555a965de869c435ca",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1UFI3clV6YcGZOgFNMHNkVCOTaDH_29t9",
              "solution": "1Q6neaAsko32nYuL6vnVHxrp_72N-iWs7",
              "nQuestion": "1GAX-stw2DiVa3NQG1Do9LsffDWXLo9e-",
              "nSolution": "1R7TmTBe5_nbncQODMafpNYohdvOAE39G"
            },
            {
              "id": "ca096a68-b19e-46e0-8134-2e77180a4426",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10K6IBwhYz_g43BKEvG7PKpONo44RKNQe",
              "solution": null,
              "nQuestion": "1NlZs2-hyeLWJuKGwc5zZ2c4BRQqyZ1s1",
              "nSolution": null
            },
            {
              "id": "bff0b45e-e39f-47e3-acd1-c2c6de00dc28",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1W5eLfjhKnMgn8R9bn-_0BJ3_te3y9ngY",
              "solution": null,
              "nQuestion": "18oT2D50LBcXMBZ-bX-6mCWXbA6ejXItR",
              "nSolution": null
            },
            {
              "id": "8c745353-20a1-4594-977c-d5d831e732e2",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11fHk_txyj0MSxfKijkch3V03ImVSynRA",
              "solution": null,
              "nQuestion": "1Hssifxh0Ivjjxx4Kuo9d_t6uTEKwq47f",
              "nSolution": null
            },
            {
              "id": "59eef541-d75a-417f-afb1-f34702cfc6a7",
              "name": "Spring End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17kBNnqj9Ef1UKqvX3B5_VrHiqWQgtVH7",
              "solution": null,
              "nQuestion": "1BvDSRN4TSr6F5MgybFSsLfOu9zxCXfss",
              "nSolution": null
            },
            {
              "id": "95480ae7-fdba-4f8b-990e-b929e321e6d3",
              "name": "End Sem",
              "year": "2012",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1eT_jZyuNxROvkEQOjDJtt5WF5aAGas8J",
              "solution": null,
              "nQuestion": "1p_FWNW5u75swCYRObtBcrBiYAahQEWTh",
              "nSolution": null
            },
            {
              "id": "0644ce55-88d2-4262-aeb7-229391a26315",
              "name": "Spring Mid Sem",
              "year": "2013",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Q0kGrZYGkrJTsXl9s4mq4gnKGDzfcQre",
              "solution": null,
              "nQuestion": "1awKoYbW3SAvhzzda2TiwSXsq72BNM0nx",
              "nSolution": null
            },
            {
              "id": "a55b940c-2680-4d95-a6e9-019ea4f6383d",
              "name": "Spring Mid Sem",
              "year": "2014",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1g5FFWK5tAXbFzZDUnf59cHHzOHzNKSLM",
              "solution": "1cljyJcJwMBsTN6t7yb-rkqGCi4FXcTHn",
              "nQuestion": "1fzTiM0aLXOR23Q0dVDoKvQ0IREyp5BNP",
              "nSolution": "1Xd2rJ45RER59zPCctwprOaXl52LaHV49"
            },
            {
              "id": "200d441b-7926-4cb0-9fb9-b78eb7e65ed2",
              "name": "Spring Mid Sem",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "673b0cab5a965de869c435f1",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1R9XGr-yHLs01rJEpt9emURyhTiUzKMjf",
              "solution": "1kGgaUBB_TvPfcwyghbY1N2Ukpa9HC9gg",
              "nQuestion": "15vBconP3I-Q3ekxWXu49VaPFSBbCxF04",
              "nSolution": "1u6FsZNm6gYC_XewXEFz4ZXnmbeRCHd-R"
            },
            {
              "id": "8a921499-e01c-43c2-9033-ebf11d4660ec",
              "name": "Spring End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_9I8Jz_uLVsjd5gPWFfOt9RuIfnxCuIa",
              "solution": null,
              "nQuestion": "1ra7N4_GQAj5h6uoqWA7rgKuBGmkFpG6J",
              "nSolution": null
            },
            {
              "id": "f6e90a57-3751-41e5-b339-883962c9b1a0",
              "name": "Autumn End Sem-2",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BPmv5d9Wno42CdJUpv4n-_sQ_r9ygZbj",
              "solution": null,
              "nQuestion": "1hj5_nfBGB3iZVPvOEm5wpdqVZH3qfjcw",
              "nSolution": null
            },
            {
              "id": "8b4f6787-52b5-4ff3-a393-1d6f51632ddd",
              "name": "Supplementary",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1f2BKaSgszpUabHKzw2_CuOJ_Hant3-zC",
              "solution": null,
              "nQuestion": "1rFYT_2vZAUOSdTaBnRln-e0Y0vEZNYEo",
              "nSolution": null
            },
            {
              "id": "2c7e322c-1470-4541-a4b6-3686057dffdd",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ZzJPY_hhbszZPBhicM4gJw8zE8U0-Vpp",
              "solution": null,
              "nQuestion": "1CENiupn2IVUbkvigxSs6rEI-UgkwoWDL",
              "nSolution": null
            },
            {
              "id": "2882a00f-51a6-4c50-9b48-e969aa35e7c7",
              "name": "Spring End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Xr55eZBELnrIFCrkVT39QfU22vT2a29n",
              "solution": null,
              "nQuestion": "1VENMqUpA7cIvnsTf9ZkcwptrlH2Sv53C",
              "nSolution": null
            },
            {
              "id": "3f8d4829-e66d-4651-9ef0-8385096cb89e",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1LdKqVezIQdSQF9mECSkwNGYh-dJNMIim",
              "solution": null,
              "nQuestion": "1-Pn8lcSXFmbz7qRpwxD19kmkXjgmh5nH",
              "nSolution": null
            },
            {
              "id": "64c9dc59-970b-4b37-a87b-a0efe2c315b2",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1EKCsYpYHuhTNcl37YFi_9RlTGWSy3RuI",
              "solution": null,
              "nQuestion": "1YBCRhP6DgFnyQ9_prnNg1p7_3Fepuj5r",
              "nSolution": null
            },
            {
              "id": "b9f41b68-8098-4116-bc93-52aa6e36ec3c",
              "name": "Autumn End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pVt9C4G05fQhYrM7pxqpREzsrTVdF_m1",
              "solution": null,
              "nQuestion": "19Cuup2SW0MC0V6jsIQQnXJVom5D7I0nN",
              "nSolution": null
            },
            {
              "id": "d6d5cf6d-d932-4f0e-9877-3bdfbe6613eb",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fDY9HeJ3FCzfehlD1p9g-EdJ6HNgCRyK",
              "solution": null,
              "nQuestion": "11RSJb2Z71XdiJNrl628IpGpxeGjyTfqv",
              "nSolution": null
            },
            {
              "id": "949c1b51-9901-4c86-bc16-7cf89a70a257",
              "name": "Spring End Sem-2",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1UsraDpnLZo_-BdHe2IN3q_k-MhT2bvtt",
              "solution": null,
              "nQuestion": "1RUIYs9e95EXjf8NQZ21_zf4Nhc7_MMDY",
              "nSolution": null
            },
            {
              "id": "bf1926cd-e42a-448b-8765-f9b82fe3944d",
              "name": "Spring End Sem-3",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xdvNszcFX-uFlX6kSyNbXEZ5rhffHe-_",
              "solution": null,
              "nQuestion": "1rjuIZPVIXNcVXVuH6T4kfeGacCEMFA7_",
              "nSolution": null
            },
            {
              "id": "65bc46e6-4417-40b2-9dac-54243cc7c71a",
              "name": "Supplementary",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1iJteL2-xV_DBwt-U4KSqNBNXR-jTlrgT",
              "solution": null,
              "nQuestion": "1C_uT10Gt_c48mK8seGjn3NGR-urA-LFv",
              "nSolution": null
            },
            {
              "id": "361a8f1a-7862-48cb-84db-1821c6829661",
              "name": "Spring Mid Sem",
              "year": "2021",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1v26dyyco3_R_l4TYAmwn4Rpc--eT4mPr",
              "solution": null,
              "nQuestion": "1zNAgaeE9Q9kIetBPxfdcT9ggjoYlLBB1",
              "nSolution": null
            },
            {
              "id": "b05ac8c0-618b-4b77-a920-e3fd1968e8a0",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721c98b5a965de869c43387",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12vZB3nrYh059b9edmVje--l7dDuaQiUF",
              "solution": "1dSBUPStYxZzZR_lhh0wx7SluOA7ATzgS",
              "nQuestion": "17LSLp_6euq6dHdMMbKNOQhNQcNyAFNCL",
              "nSolution": "1D-qDHpO12yyv7VjZpwfAqhQjj3JHyVqJ"
            },
            {
              "id": "93f5bbf0-73bb-4110-aebc-093b49a651ef",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1SGPTjrfBP5iDk-7U7zg5Do9UFTjx_shF",
              "solution": "1VTbk9802RntdHvyIMIvUoHl4IEv-nk7H",
              "nQuestion": "1qOKfY22--07xsmXNwOPVWLbuI9Z5rQf4",
              "nSolution": "1bKCn8Ju-FJ74M6HR9bSfXR7uRenzbNn6"
            }
          ]
        },
        {
          "id": "65d214db1bdc9aab41338802",
          "name": "HASS Elective - II",
          "SUBCODE": "EX20003",
          "Credit": "3",
          "folderId": "1v06pGXIZpo-vobhDai-n_oWYLBr560Qv",
          "pyqs": []
        },
        {
          "id": "65d214db1bdc9aab41338804",
          "name": "Automata Theory and Formal Languages",
          "SUBCODE": "CS21003",
          "Credit": "4",
          "folderId": "1P-30fTnkY033P2rTaOZmq1p-EUg7ahom",
          "pyqs": [
            {
              "id": "5a157d27-ff45-4a27-aa07-8c18d77459e3",
              "name": "Spring Mid Sem Exam",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1EWpl1dkW62Zld5AF9yYj5vZcV_npSvS7",
              "solution": "1ewPqDZk81GXXW5b79iLfJbApzqGg9C3L",
              "nQuestion": "1fBqUsdRolQNmTSjByhF-ySYvkeupLddX",
              "nSolution": "1ewPqDZk81GXXW5b79iLfJbApzqGg9C3L"
            },
            {
              "id": "ebf85db4-57cc-4dcc-9a14-d4ac1eaa9a06",
              "name": "Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "673b98a65a965de869c43625",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ORuyk0A4-4flfdnUhlpwSJqi2vyQmTP8",
              "solution": "1XtIieoGZ7D5tzszM9zEPmmWa6IUb--bV",
              "nQuestion": "1xpW2KKUnEOgYbMQo2V-va313nCEgao0k",
              "nSolution": "1R3z-UJT3NN5AJgU09A6ZWb9WCYpIUV7n"
            },
            {
              "id": "90634ddc-ddab-49c7-9d53-47f96a77ca93",
              "name": "Autumn Mid Sem Exam",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "673b98555a965de869c43623",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DNfKLll7gEZRtfl124xwQpOjXPtytWck",
              "solution": "127ntwf_6ii33PH1ZgS482Y0MLmNnBB3n",
              "nQuestion": "1Za9TCoZvhC2FxMxYZ8AscmKXjCILfT9Z",
              "nSolution": "1bd5p5Hgr0kGH7wJLpPuLlaxFsVeOIG-h"
            },
            {
              "id": "3d5a6e5f-9a5e-4115-8fb4-84a81ebae508",
              "name": "Mid Sem Exam",
              "year": "2017",
              "type": "Mid Semester",
              "status": "APPROVED",
              "solutionUploadedBy": "673b981f5a965de869c43622",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Sfi6eGvoflLSbmMtbdmpGT6p5u9nMMTy",
              "solution": "10qK4zzZG2MHhS_cTzK0RmtCX2ApI_ZsF",
              "nQuestion": "1Sfi6eGvoflLSbmMtbdmpGT6p5u9nMMTy",
              "nSolution": "16jxPcdJ_0s0uj-44BuJEGtE2-zRX92Sv"
            },
            {
              "id": "12495cc1-04e3-4910-bf41-99fa7c4a106b",
              "name": "Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1iVTSdUHLuFG3FxWgEq4nNEvL-W6lTD96",
              "solution": null,
              "nQuestion": "1KCBvgwn67DIAFGHIXtFXgRYrbJwhAa7M",
              "nSolution": null
            },
            {
              "id": "c02e8c29-c1e8-4be0-9a28-8a6cb94f3545",
              "name": "Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Ay9mn4dgXcvT-6A93Q0Yxuf5NY2PYOFG",
              "solution": null,
              "nQuestion": "17gHlYK6NZ-boRs-Apf4aBAtAvLCVgYZZ",
              "nSolution": null
            },
            {
              "id": "77476842-62ab-4691-ac3b-58b54eb5ef04",
              "name": "Spring End Sem Exam",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "660a549430641ad00aae8ab4",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1GQAjBdlohnc4bnY7qOFdGmlyoQA4FJ-n",
              "solution": "13ESG3Jj1EptJwoSCq5EkS7icIjjYueuu",
              "nQuestion": "16CdzuGVb6p8Mj1gn18atPpPz4sNs00x-",
              "nSolution": "1PUYogDfsfLKJtvrXMmbbq8RZ6mwoFFPO"
            },
            {
              "id": "5dac9588-30a0-40a2-bc95-70ba170cbb1e",
              "name": "Autumn End Sem Exam",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d5b28ccbccf4670b3ca0ee",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11JwIbNG2DKo--MekjiMZRPZqhA7C1Psf",
              "solution": "1BY4qPLl7HWIm7cH6HNbeORYJ6iv6ByPf",
              "nQuestion": "1-lKQnJnuZaMb2M7NrX0LsKCTe3Yw4Sb-",
              "nSolution": "1qzkTGCbzWldoU0n7h9BnwPLa3q1Zzfnf"
            },
            {
              "id": "e05750fe-4eeb-41a4-a952-ba2fbd967eb3",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6623bcb4ad6e7bd16c843faf",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Ux2o1_3gxJNRQ6PMilE9QG1i7fhiO3Jk",
              "solution": "1ulL_ljj-G3-FIA6IlhO_ClNqhrp92jqf",
              "nQuestion": "1ifyOQLqRwNKl787__-hewV0ujPxfseB5",
              "nSolution": "1f09isjYiBlNFcEvldKt0GLcdy-E_THwR"
            },
            {
              "id": "6c5a5dc4-faa0-40c9-a4d3-b360b485ca58",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "673e191d5a965de869c4369a",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1a6OjOH-qtNaioAwiBYpcccGQovJt9iE3",
              "solution": "1cSYm_553572BxisShlkrCftwI7oXrKBZ",
              "nQuestion": "1EMHkDzHK7-kyuPX08_YEdEEHJi2256tt",
              "nSolution": "19QJ3JSiDkhy8MHSUB7_jA3Ja26t6t_PY"
            },
            {
              "id": "6893df22-360f-4d34-b2f0-233d2f4a64ee",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661aacd4a909c6db59a4203d",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kObbTNtL-5z5ekQXlVZCSEJmnCzLe3BT",
              "solution": "1gF8N55d6h54SaVx3O_x6CvzNMlsQ-DcU",
              "nQuestion": "1j9mbEk8Xa_criWSIMN8I7TLb7et08H7P",
              "nSolution": "1tbffZL1N3O7L6eFfIPQUumJW6y430lNV"
            },
            {
              "id": "c17ee082-24ce-4a19-b274-f9a225ce35af",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "660a523b30641ad00aae8ab1",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1XuH3IxxSz1LLwjwPacUF5-sXw-QATiCk",
              "solution": "14GR4d8nnFwvuDH7OHnuMnNisV-QHrfk2",
              "nQuestion": "1XS_0Xv5OIgf9dUYzHqgiIfiXm2PtM5z7",
              "nSolution": "1shOWyhylQDTmKaGIS3-0qkJMqt0UnIPY"
            },
            {
              "id": "eb5443e7-2699-44f6-aec2-de78035e5605",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "660a522230641ad00aae8ab0",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1UxP8Zv8WNl6n5VQElqcdNo5wxZO0ftPx",
              "solution": "1H5OavitdnJJ68PiYv72bVrUmaxUfu8Ih",
              "nQuestion": "1wnSP7HjcBEqUpJ-knxX2Gmw5ptU3uUGe",
              "nSolution": "1bHI0GtMgYsI-Jf0woBvbgyQd1k0qr9pQ"
            },
            {
              "id": "37e85a38-ef77-4f1a-9a6a-28ad62f10cb5",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "660a525c30641ad00aae8ab2",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1vAJ06SYkOo8TxS8tkdOF-AypXuMNOc_7",
              "solution": "1YdxNfTSxTfQZBxuKDBxnUb7-I4qEzNaZ",
              "nQuestion": "1HXJSStpg6Zleq5IIF81XsRFKYx1jmnp1",
              "nSolution": "10D3CBMCbKVXr8zcLqvcjbl0kh2ptEq4T"
            },
            {
              "id": "b04eb98c-9e10-40aa-86c0-269fc9b802b7",
              "name": "Mid Sem",
              "year": "2014",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1c8LGPpvJGjonKAc9v9a9Idvg-NqCdf1B",
              "solution": null,
              "nQuestion": "1zmkvWtLyUbRXJrkdUc1U17kGsIX4mhAU",
              "nSolution": null
            },
            {
              "id": "f1060093-0077-41df-8985-f0b6273f5117",
              "name": "Autumn End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10CavpmlZv443l-yHOXAjac0XiO-YI6jY",
              "solution": null,
              "nQuestion": "1AHMZfwjtoehPhMewThLvwyZXsqM0xns_",
              "nSolution": null
            },
            {
              "id": "c8a339ce-65e6-4d35-a840-2f9f0faab8ef",
              "name": "Autumn End Sem-2",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1UirX38nnAMEhy71m8hVjrl864wMxFw2_",
              "solution": null,
              "nQuestion": "1zGx7n3OH3HTw9w8ZQqXHhliCxOcIObsh",
              "nSolution": null
            },
            {
              "id": "49b943f4-a30e-4739-86ac-0a23564ddb6d",
              "name": "Autumn End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1jb44o6KPX1opveiTt5LkYCTOj512cHqK",
              "solution": null,
              "nQuestion": "1XQC7ICOdi-ma6WufxtW3IPmt9kySI_xa",
              "nSolution": null
            },
            {
              "id": "85675039-338b-4161-b909-190178421eda",
              "name": "Autumn End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1TAjzhynrWZbzaDXj4XKbkH26ie2KgxiL",
              "solution": null,
              "nQuestion": "13aegwNfRrXW5QkKqICuNWmDf9zlbJPB-",
              "nSolution": null
            },
            {
              "id": "6b9583b5-f0df-4773-8d5b-7125a531c0fa",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12SsWe-FGWnP_jKkHhYWnDjxvW7HDrpgW",
              "solution": null,
              "nQuestion": "1bn7ZG8ddTwULEaj5vTM3UUThcM4B-dYH",
              "nSolution": null
            },
            {
              "id": "01226c3b-16e1-46da-b22a-290b3ffabdcb",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "672243535a965de869c43397",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1jmo3oq46Mvaiuv0RXA1_jHRZ9OLl3y74",
              "solution": "1BHXhgC2AueOMlep-GycmiQ3hvHsiBXGf",
              "nQuestion": "1EDQ0jhZvVc5A53Tp6kAPBhBHzuWnXWPm",
              "nSolution": "1hlzlPdYwc8J7yvlNU92SzoT9rqmVIj6y"
            },
            {
              "id": "d9161ba7-4888-4d64-95ad-0f0c7bfba957",
              "name": "Redmid",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19areL_RBJTW3rn-v198vjcOoVMmnES1g",
              "solution": null,
              "nQuestion": "1q17Y32olkdLPpF8n5CdBoYEOLQGnxh3t",
              "nSolution": null
            },
            {
              "id": "5bfa69a1-7b75-4c63-8541-d21bc00d2602",
              "name": "Redmid",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DJ_RyhGRGomKLYY2KF3XZC6O_HhT4kP-",
              "solution": null,
              "nQuestion": "1QBpCisw1vEj9doZ8xM5_UqNh7pNT6E2M",
              "nSolution": null
            },
            {
              "id": "b8978224-aae8-48a0-9340-eea51381da4e",
              "name": "Supplementary",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1O19Foh8SSqAALaCpuENxr8j12IHy2i3l",
              "solution": null,
              "nQuestion": "1sZv7RdZ_bLD_7sSW7OerDVMKpssqFf2Z",
              "nSolution": null
            },
            {
              "id": "9bc11327-6e77-4fbb-aaa5-36ca820a859a",
              "name": "Spring Mid Sem",
              "year": "2021",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1uk7rnUGhHgvK_IwzXF8wiTMKAVVw10ez",
              "solution": null,
              "nQuestion": "1DkXDE2YYmOhfxCqW7aqYldymcQeTnLLj",
              "nSolution": null
            },
            {
              "id": "18a97114-654d-4171-b39b-f62c8855933f",
              "name": "MakeUp End Sem",
              "year": "2021",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15Mhf_Kadesnq50F2AuWllZ0RPcbZMG6H",
              "solution": null,
              "nQuestion": "18soMaQ0pV6ERCGqzdZlrsYhfb7tCVDv3",
              "nSolution": null
            },
            {
              "id": "0f8af6f8-e02b-48e2-8484-8a7a4c3c6e97",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "108Jf29kNBXHtZty4yVJK1KhHGtdOVBza",
              "solution": "1dOUWR6G88G06KTm3JhimXv9NLMKtLHjj",
              "nQuestion": "1UnCoc8h18rwtGhm9jk6OgBgQjJn4CxHI",
              "nSolution": "1YbjzRKkmkIyywOzyyXwnITFvJUnOscmH"
            }
          ]
        },
        {
          "id": "65d214db1bdc9aab41338805",
          "name": "Probability and Statistics",
          "SUBCODE": "MA2011",
          "Credit": "4",
          "folderId": "1h2GkDhwd5NHhEo7TjUccF9KQu3bFIwCg",
          "pyqs": [
            {
              "id": "a6213475-5a33-44c3-b18a-f879f37b03d6",
              "name": "Spring Mid Sem Exam",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1yuo-JWwrKlxzfe0PnFKBzbowY5ZtzJ1x",
              "solution": null,
              "nQuestion": "1ZYkFfdBUZoh_oq_BKcvsuIDOH-Oopbvx",
              "nSolution": null
            },
            {
              "id": "892662d2-8f81-49ef-82c1-a51321033754",
              "name": "Autumn Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1REb8IRWU7LZFd-ad8Iq8722RJcuP00mh",
              "solution": null,
              "nQuestion": "1Gd1qDtZhlnt7Nu2Ro86ox4V6FsgFgHFT",
              "nSolution": null
            },
            {
              "id": "41294576-61c5-4f06-a293-038d7159c7b9",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1h_rZwoW7n1YQazXBalrFYpvUBpL-cQtx",
              "solution": null,
              "nQuestion": "1kXODWK2AN9u4-qZMMPD5Ki0Vd0cmSOQ9",
              "nSolution": null
            },
            {
              "id": "b1a43a96-15dd-4860-ba92-7d725833eee9",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1qs0poupKhFI2wrZ2babp5H1T3S2BMHs3",
              "solution": null,
              "nQuestion": "1fvIT0gRVAhB8Nwoch4OyMc76NoISxfhO",
              "nSolution": null
            },
            {
              "id": "bc070827-a730-4c44-82c7-00108e442a08",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "660a38a130641ad00aae8aa4",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1rNUktWe3DAUEdgG3_CEocFYIWIRpGucZ",
              "solution": "1T2KuHMrsVLUymU2ZK2QLpG2RljYmchYS",
              "nQuestion": "1ez6xKuPd_mA8neBYaudROUMZBoAK0kqp",
              "nSolution": "1d0py3OdxlP1eYRyeK4KuQUX_dHf4i_Z6"
            },
            {
              "id": "0e99ebb9-4414-44a0-be51-da891bb77f44",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "673516fa5a965de869c434cc",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1qSYlq6L98hvAe_AJ8XwdrjZMzL3W-SIf",
              "solution": "1lwsMoEPUd9IJevTQQlWusqxotpmAugth",
              "nQuestion": "1q4XfJzLS5pbJz_5H9Wl7sq86aKByVuFV",
              "nSolution": "1cPdxBH1xwAhgZxNbtWP4qp5BD-S2_RQO"
            },
            {
              "id": "209eb595-09c9-4120-aa14-bf989c843c43",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6623bd63ad6e7bd16c843fb0",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JsdcyOy8y4vQYeM7N2Fr6AKG0B0zavuo",
              "solution": "1PZsGyNxrcQxQnZKNEpYY085YZ9N3q2sC",
              "nQuestion": "13VzoH9b0WTij814txaiwGpd_cJ8GA8ZG",
              "nSolution": "1rxzwB7N_NU_0xo0BGImhQhO8wW9COXxj"
            },
            {
              "id": "a4c7d3f3-9ce8-48d0-bdaf-e316121809a1",
              "name": "Autumn Mid Sem",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1GFRGW6OCMKI14KhXxyFObIY3YmiJEyGd",
              "solution": null,
              "nQuestion": "1GDfsSQdpLBLtg4nCL-EYAvicp2jOw22A",
              "nSolution": null
            },
            {
              "id": "70cca8f6-8c26-47cb-bafa-8e5e86c3c6e3",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6684333cf6aabfe19cf4fd16",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1qpQjHiNNGwjcDOvp5cyXBgKDUJoq9yfi",
              "solution": "1iTHHWkxIbKrmSOizYR9zWc8N5ll9O984",
              "nQuestion": "169WQPjYmzaG40VkRmMdD_409LvdcrRC3",
              "nSolution": "1JULR11vGwioBDKqnz3bN0jUdiM1xesiz"
            },
            {
              "id": "b4595c66-394b-47be-93cc-fea490219a1a",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sB9M8zy0TgYBpygM6tpHvBtX6MYLEvAh",
              "solution": null,
              "nQuestion": "1_KjbdsaC6uZxrOdpJk6htHYbB4zcrZul",
              "nSolution": null
            },
            {
              "id": "6c1de6fa-9ba5-46d1-89f4-e1d2b57a414b",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721c2095a965de869c43386",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1MdHIDVWHmEJ61Cy3iJsZ6IPri5PQW3OP",
              "solution": "1mO1vYdy1bdHNVkJndtja18lImHvr1Shn",
              "nQuestion": "1kI8kSHaTPNyQKpGY6ZhrgwNNoiJGFGQz",
              "nSolution": "1T2KmsjpZsVA7OXiEh_iiAQInFjTCdiQp"
            },
            {
              "id": "947169b1-5724-4781-8a60-e6378d753b21",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "16gbi15ItyYV6OyXxbzPbyGNGifup3oUR",
              "solution": "1nQ4pyE6a7EZKoRoReZGrO7Fqz1JvZcAN",
              "nQuestion": "1LgyRJjSpCl61tVpoPpbkT_t1SqP1nUBh",
              "nSolution": "182odmCqlYVInYDiv4bAsNzfZS3Z1k-uq"
            }
          ]
        },
        {
          "id": "65d2211d1bdc9aab41338806",
          "name": "COMPUTER NETWORKS",
          "SUBCODE": "IT3009",
          "Credit": "3",
          "folderId": "1XJcx1-Ly2drudYy0vqr_cK20dJVJYpzX",
          "pyqs": [
            {
              "id": "9c7332a5-3567-4ad3-9f5e-072575135aed",
              "name": "Question Bank",
              "year": "2018",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12rxgy5sXTs5uua8HzQZ84FdogTADxohw",
              "solution": null,
              "nQuestion": "12rxgy5sXTs5uua8HzQZ84FdogTADxohw",
              "nSolution": null
            },
            {
              "id": "f3355af4-ecc2-4b44-a638-a96816894b26",
              "name": "Autumn Mid Sem Exam",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "667d01ff3c448e32cdf1a308",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1v-wf5H_OQMscUEm56Gi_s21EjimcUWea",
              "solution": "1ih-IdzLBLzUWQCMWCBVVvZ7YYs98qgnQ",
              "nQuestion": "1dPJGCXg_JQIyRl_oXenVzwdDXcJ0pzzR",
              "nSolution": "1hwumPfQEVxmK-aqkKx-UsCPWgm9jkgCn"
            },
            {
              "id": "88341672-4924-4c96-b235-0c4832cfc9ac",
              "name": "Mid Sem Exam",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pN0GlO7r-Lz5dgV_g4qCp35V7wYFHSpH",
              "solution": null,
              "nQuestion": "1Ma0xSeODUuiDnPlFaEg_PrHE2SkynFL2",
              "nSolution": null
            },
            {
              "id": "d5e25739-d6fe-4692-af31-edbc384465a5",
              "name": "Autumn Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66dbed8a42841c454a166ebc",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1OOqnEB8wt4-G0jvHznrLrfafjAlqUgDr",
              "solution": "1uBZ8Me8jXvovDrfs0w9gcrYGGazU-7hz",
              "nQuestion": "14qu7khQLtkpAA3wAZiTBzmXYZNpuzE9I",
              "nSolution": "1KR9vWbsE5TfeeHnHjbgB_m0ETADLxvBG"
            },
            {
              "id": "ffa9fd16-efd1-44c7-8c25-97792a6734a0",
              "name": "Spring Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ByLjZh7pUcTZtCsndiPkpnBh7V8Vh9As",
              "solution": null,
              "nQuestion": "1hdhphdaItZjdKO96Q7GFgU5I0l_XX4k3",
              "nSolution": null
            },
            {
              "id": "e77c7bef-78ea-451d-ae84-d005dfea74e7",
              "name": "Set 1 Supplementary Mid Sem Exam",
              "year": "2019",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1dKjoKlSViVVhJT-K-jBYFPWbM397mFXi",
              "solution": null,
              "nQuestion": "1dKjoKlSViVVhJT-K-jBYFPWbM397mFXi",
              "nSolution": null
            },
            {
              "id": "2ad78b13-d9f6-4359-b72e-6d31235c2639",
              "name": "Set 2 Supplementary Mid Sem Exam",
              "year": "2019",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Qttr7gvVJ6cZ2_2IxdGpgue4PdWyFtiO",
              "solution": null,
              "nQuestion": "1Qttr7gvVJ6cZ2_2IxdGpgue4PdWyFtiO",
              "nSolution": null
            },
            {
              "id": "000c04a9-8149-40ff-a562-ef6a134cbc6b",
              "name": "Spring Re-Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-56IEFwR-4RpAReZwjI5oUdscDKWr1he",
              "solution": null,
              "nQuestion": "1vH1tzz3EsPedKn5QuKsF7ru_dE6Rq29X",
              "nSolution": null
            },
            {
              "id": "83abd55f-c307-4192-9895-fdc271a6edbd",
              "name": "Set 1 Autumn Mid Sem Exam",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RoNj9nMkzfjlKiuMHZ67IG6AJdF61Oqx",
              "solution": "1qO2wT3Ccya2nLWfPWyQ6EKDb2Hime5Wb",
              "nQuestion": "1oQF6ib_RCieQcnjDi976JbQ639sPjKyn",
              "nSolution": "1wOMm1Wty6RT221qbm9dJXu3QhpgyPtBv"
            },
            {
              "id": "2281b9d5-6f4a-418e-8b4b-9921c91b77c5",
              "name": "Set 2 Autumn Mid Sem Exam",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1dZgTARD3jVet3xNPkluevgHWkf-6NLSk",
              "solution": null,
              "nQuestion": "1ValpITdE_QbOm1QScD40lBhG67YAWSYO",
              "nSolution": null
            },
            {
              "id": "df83c2e2-5c7a-4baf-8907-094df3a0941e",
              "name": "Autumn Mid Sem Exam",
              "year": "2017",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sBUKW4Cd2lhyYszsbYaliLahT0x1B2Zp",
              "solution": null,
              "nQuestion": "1sBUKW4Cd2lhyYszsbYaliLahT0x1B2Zp",
              "nSolution": null
            },
            {
              "id": "255ec93c-cbaf-46d6-bc86-8855753da903",
              "name": "Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fOxAkUzYNjbzIisyS7JlHtCTLKurOp8R",
              "solution": null,
              "nQuestion": "1SzzQeLTczkyctLqQFPqD2NqOC800LkI2",
              "nSolution": null
            },
            {
              "id": "036f751d-5d3b-43a9-944b-0cb0af9bfe51",
              "name": "Autumn End Sem Exam",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17lXftQ2uNeHvLcYrQyBVdO1FfI-6Q8H2",
              "solution": "1HeiYPmvt_RQYOYIrUrhldqTHeATsoiVo",
              "nQuestion": "1KBwaGcHb_hNqOseJl3xx6spsZ3TGjRTa",
              "nSolution": "1HeiYPmvt_RQYOYIrUrhldqTHeATsoiVo"
            },
            {
              "id": "47027101-ff86-4b15-a93f-17f0ff5ba8a8",
              "name": "Autumn End Sem Exam",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19Tk_p7L8s9QroisC3DT-jMqFDjmmTdFF",
              "solution": null,
              "nQuestion": "11y89I29UUc7yJS0VKKtrshRivlkn8XhO",
              "nSolution": null
            },
            {
              "id": "59ad52e0-4d7f-4b77-b11a-216972206957",
              "name": "Spring End Sem Exam",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Znc4wuxg3hLiv7pq5oNo5H3cHqT3hEDb",
              "solution": null,
              "nQuestion": "1-gOEgn7fBvlgnDbpjAUyCnYKDo2GK56E",
              "nSolution": null
            },
            {
              "id": "5d4ead40-4f37-45eb-9d3f-cc1f9658c16d",
              "name": "Supplementary End Sem Exam",
              "year": "2019",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1rE8a-RbonH4LGmItjHiDxv6aLO4ylfNH",
              "solution": null,
              "nQuestion": "1rE8a-RbonH4LGmItjHiDxv6aLO4ylfNH",
              "nSolution": null
            },
            {
              "id": "1024ed25-eeeb-44bb-96af-3766b55bfc66",
              "name": "Autumn End Sem Exam",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1yu_e7RFvPu5ZV_eFU7-G_xq5WBvybfbf",
              "solution": null,
              "nQuestion": "1nbjU0ef7YsUuU0sqLSvBQzUXsIk_06Gt",
              "nSolution": null
            },
            {
              "id": "c7166562-a38e-4c6d-9509-f18682c3c593",
              "name": "Supplementary Autumn End Sem Exam",
              "year": "2018",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1uxyAMXOiTAUtjeCXXUr65GEkUjyQb6Ky",
              "solution": null,
              "nQuestion": "1uxyAMXOiTAUtjeCXXUr65GEkUjyQb6Ky",
              "nSolution": null
            },
            {
              "id": "caef2346-db21-4074-96a8-d6ed1bf0f084",
              "name": "Autumn End Sem Exam",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ULnCfcovmNEJFbng9tAhbDwB-Hn9Nivh",
              "solution": null,
              "nQuestion": "1tZLeFOxq7TA3nxATm7NNxXALEvupKGH9",
              "nSolution": null
            },
            {
              "id": "a2f30b2e-bd38-42e0-94c6-92496c2ac5b6",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66d6c29942841c454a166e91",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1rEwIdnPrIU954sjP8L146dRx-yeuRcgw",
              "solution": "1CtcKizIFEMSQR8m-sDLSd68NfzJwaV_u",
              "nQuestion": "1Z2f71HwbZ85gVuNict54BSr8QL4cITcO",
              "nSolution": "1kI-qvr6nPT_TYzwVQgs1SC79fKFGYcn3"
            },
            {
              "id": "5b2f677e-7695-4c72-91ec-ce110d38118c",
              "name": "MakeUp Mid Sem",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ctZbQQA7amXtF28RxdYbNELCIvrqXL1p",
              "solution": "1mzlFo7GWZb3nQgTMjd_aX0JV7w-6hAJS",
              "nQuestion": "1vKIV67h7xX56uYbV6rNf-WRrwI8W0pwI",
              "nSolution": "1xh8vQItCRPv9ywRz7fe_W5AgMafS8JB9"
            },
            {
              "id": "788a60bc-05eb-4fdc-94bf-6edad8b8b1be",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661aa9f9a909c6db59a42033",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Rm_9LQez9ZxeH1KK4aLJNRaCIlJXeWYY",
              "solution": "17f3VR9PVmlCmtsFjo0RPZqWPUJZfwyQl",
              "nQuestion": "1PllOgreTlNothQgIx2KjREjyYrIebM7N",
              "nSolution": "1qX6lcdGzbgdL432WZE7LeJ_xlKZw6P2Q"
            },
            {
              "id": "50875e94-be07-451d-90a0-2889d81560f5",
              "name": "Autumn End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1wjN6ZOs47Y0HPRA4Q8Bvh4ZFt-yvovIc",
              "solution": null,
              "nQuestion": "1fQ3nRssSaV2-40saI0cqQoGWS4Prxkwk",
              "nSolution": null
            },
            {
              "id": "8092e19a-ca6d-4f31-9165-e9b4ef312c24",
              "name": "Autumn End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kfTQyHBNZxGpNYjyvKurhoVOGmVl7tQ0",
              "solution": null,
              "nQuestion": "1Mwjymp52cpBgT8njb_pSS1jnSorJoA0e",
              "nSolution": null
            },
            {
              "id": "dcc4c45e-bce5-43e3-806f-84cc714877c2",
              "name": "Mid Sem",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sAcvczrgkZCRxhQ4HUt7XRdZXpmnXAux",
              "solution": null,
              "nQuestion": "1dpCaE_EH8iGEfqnXb4MDU8Rsr7oni-44",
              "nSolution": null
            },
            {
              "id": "9a3b3609-ae84-44ea-b73d-bc1977e51fb5",
              "name": "Spring End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_H0MxRJF-TT3CS1IadcX0eH4wmmz9w1l",
              "solution": null,
              "nQuestion": "1kn_z_9sBiRL9uAWIeuV_lgZ-7oxGXo3Q",
              "nSolution": null
            },
            {
              "id": "d72b3d47-bf8b-4deb-b599-e729caf58967",
              "name": "Supplementary",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PYTboqca0s_c4jm9hti_UH0sEdO0C8gq",
              "solution": null,
              "nQuestion": "1YyJIJh1ZCMiInkKk6xB0FAxzrNVexh38",
              "nSolution": null
            },
            {
              "id": "b4ca3963-82c7-43b8-aeb1-7d010bbc83b4",
              "name": "Spring End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ClAW9rprmT-jh6PjEUeyzCDOSgslp_Wh",
              "solution": null,
              "nQuestion": "1bRTwugoTUftaDowm3BC9QZwFUyCGPV97",
              "nSolution": null
            },
            {
              "id": "fa95f16a-ad2d-4f4f-b8b7-8c30c73927bf",
              "name": "Spring Mid Sem-2",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1CIvDfLHJmqfY0wC_idGX9O0f45Aq6gzQ",
              "solution": null,
              "nQuestion": "1NsofM53ZYcjwCRjXm8W53cBDxPeJbbHx",
              "nSolution": null
            },
            {
              "id": "4e04b4fd-1bf2-4b36-a0ab-7f78cca16a92",
              "name": "Spring End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1iyTh4T91NoqVwwVNm7YngtRi2vn1AZAS",
              "solution": null,
              "nQuestion": "1QBKaf_Bia-ACMBRnXl_IFKKrm9RfIk89",
              "nSolution": null
            },
            {
              "id": "a4531da8-3e4f-4a8e-bddb-dd7b6abc4396",
              "name": "Spring End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1iUSNp2VgHKB-N4OD7kJVrk9RQW9OT1-J",
              "solution": null,
              "nQuestion": "1ZAW_z12PKOtH6EjOOx9W4w7xPBmWS-Aa",
              "nSolution": null
            },
            {
              "id": "dffb742c-6b2d-43b0-a121-f1147f6689b9",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ssZYyN8fEBYas7G_7PUAyls5Jp5FBRJJ",
              "solution": null,
              "nQuestion": "1lvhcn3X5kGRKzN_ex0um5uMkLb8xh8aG",
              "nSolution": null
            },
            {
              "id": "308b7b6d-e3dd-4d67-9858-017f78fa361c",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DdwJ8KnlMcJiMauqo0Tvh6LKRNChoomS",
              "solution": "1IUfvR3Vepinv3T4_gf4dsZOl9Q61j0Tz",
              "nQuestion": "1HLbnsr7Qz_ln1_1KVfZECBOdhBxnWihI",
              "nSolution": "1qcIrupK0K92IN_oAem6BKalubXsI06qg"
            },
            {
              "id": "47d8d7dd-72e5-409b-a6ea-cc292b37fc44",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721b1935a965de869c4337a",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xeHxvzXHRdkKSU0KePfPo9KkexJTElbz",
              "solution": "1CwKJyqhDPN6cDjsW5LjfbnWzBRP--8Gx",
              "nQuestion": "1YWuXnwzHbWWc6j2wkBeLR39gV6Xct7_h",
              "nSolution": "1ypw0R0PjBV293R-fOnynsP1SoLiocX66"
            },
            {
              "id": "87d81479-3e33-4059-99c1-94e7ad63daff",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12tb645Aw_q_jTaHdWqNWOiHhJ5ozFfpK",
              "solution": "1vfeQJD5TYlXL7xPM_S0AFV4GzeHDLycK",
              "nQuestion": "1Y-OUuDTZpriYjgVKQH2x2MCWgQR9hQqt",
              "nSolution": "1UdCzENgzezbRQiZEjspxT6v3oW5EYzki"
            }
          ]
        },
        {
          "id": "65d2211d1bdc9aab41338809",
          "name": "SOFTWARE ENGINEERING",
          "SUBCODE": "IT3003",
          "Credit": "4",
          "folderId": "1LjbtjshmDlZVSN9scqnoMiXlNnTl9FB1",
          "pyqs": [
            {
              "id": "f05d2f7c-a7b2-4f09-a6d8-586bf74e2129",
              "name": "Autumn Mid Sem Exam",
              "year": "2022",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1EpKGZOyCN5SfNmAiOQoZHDeZAgHibLir",
              "solution": null,
              "nQuestion": "1EpKGZOyCN5SfNmAiOQoZHDeZAgHibLir",
              "nSolution": null
            },
            {
              "id": "a72a919a-b564-4e80-a724-ff9243924297",
              "name": "Autumn Mid Sem Exam",
              "year": "2020",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1yRcIfZE-HgyofZTGWTBqWxD_NF7SsRD_",
              "solution": null,
              "nQuestion": "1yRcIfZE-HgyofZTGWTBqWxD_NF7SsRD_",
              "nSolution": null
            },
            {
              "id": "b68b4d1c-ddf2-44de-8fe9-c3e496a9f044",
              "name": "Set 1 Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DpF-qYvS-RhpHUhoIiSlSybYRs8XAtPh",
              "solution": "1KEWsjjKvSoVAAHEIwBVpWLLFcd4Sm3nY",
              "nQuestion": "1izGGPaukxpLC4iImTx_bW4x6sZvbte-L",
              "nSolution": "1IHuFp26B3hVVWyhmVp0Ubpne6udcslx8"
            },
            {
              "id": "5404ba26-dac2-437c-951c-8e9174294e6d",
              "name": "Set 2 Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_YZPD4OszZKRkeeBZmHCp3m8qxc1Db1G",
              "solution": null,
              "nQuestion": "1bByjjbwJFklEAVJXonkiig2JYgggqHMa",
              "nSolution": null
            },
            {
              "id": "10b9ed22-82db-4128-8b45-3c554e01a420",
              "name": "Autumn Mid Sem Exam",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Ca1LmCUllIt62jaayv6rOVkoNOHsXUle",
              "solution": "1w63Mpi3aBlxtnE6RPhqEV07L7pySTFat",
              "nQuestion": "18LxDlyGzYt72KlA4sI-5weu4FwMwk_7l",
              "nSolution": "15pk7mDf7HVi41kT2lJGXSo950b_Vt1eW"
            },
            {
              "id": "86728eee-0ba5-4e2c-acdc-5b304da8eae0",
              "name": "Autumn Re-Mid Sem Exam",
              "year": "2018",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1InQZ1J5h-RA5GaTnc4AmN46ZPXbKLC7H",
              "solution": null,
              "nQuestion": "1InQZ1J5h-RA5GaTnc4AmN46ZPXbKLC7H",
              "nSolution": null
            },
            {
              "id": "d4dd3be7-5c30-4e23-bbb4-4d5b4d99d26e",
              "name": "Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66eda058f740b2b3e5002d56",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1LUG7zW6YbL4p2kojm8yhlSo6OYgnF8m5",
              "solution": "1ZM4P-vmHwuq9DHIrYB83dsb1aFWxXbb3",
              "nQuestion": "1hX9wLusGS2NS7uI7omqXH4QVv3T4lgtN",
              "nSolution": "10uY_G69QY7c34FDubKCqW3t2QgKE3cPa"
            },
            {
              "id": "ba6145ea-4471-4e44-8563-4b1102c2602b",
              "name": "Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NzPHnlDw0LDlloVI4hr9JGVkMnmKlqXz",
              "solution": null,
              "nQuestion": "1KG8SUKYCJ83lB1Ehe7E5Qc9P6adr34yy",
              "nSolution": null
            },
            {
              "id": "ba2ac1be-1cbd-49d3-acfd-8004748c1aba",
              "name": "Autumn End Sem Exam",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1x3YSthZ6NqAspksZsxgH8ouWMgvemgPI",
              "solution": "1OAVK-Ds_rSGsnBGoTLPw1Ghpu1QHAwpD",
              "nQuestion": "1ONrYZ_bfcTTH-zD8sjSnt1Ta0rKQBukC",
              "nSolution": "1OAVK-Ds_rSGsnBGoTLPw1Ghpu1QHAwpD"
            },
            {
              "id": "b03db306-3f26-407b-9e91-0dab0760d14f",
              "name": "Autumn End Sem Exam",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1m2pO6j_K5BbEWcwMHQuLkXZQfCsrtj1v",
              "solution": "1q0Veo6VF7SwPmDf1pVq0D28a_kmKwxYc",
              "nQuestion": "1nq-SSDL_q9k2W3c9QVTT3_sBbBpEmbGZ",
              "nSolution": "1NO5iWBV0nbndFgN-LCbSJiS7TiLyLfjc"
            },
            {
              "id": "ef27c410-d6a1-4910-865b-3fd28902b774",
              "name": "Set 1 Autumn End Sem Exam",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1F5ObPo8fLYqiK4rVwl3anSlvM-_6cHTI",
              "solution": "1aNddlJyFfOPiakPK7Wz5FgaqE8Gx8z7S",
              "nQuestion": "1r59NplYLekPmQhGXCzFiHkkXP8YggHfF",
              "nSolution": "1aNddlJyFfOPiakPK7Wz5FgaqE8Gx8z7S"
            },
            {
              "id": "c25bedde-c17c-4879-9942-f3ea9492a6e6",
              "name": "Set 2 Autumn End Sem Exam",
              "year": "2018",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1d-MQ9cL-5MiDprgKlmrn9xTilKsK--H7",
              "solution": null,
              "nQuestion": "1d-MQ9cL-5MiDprgKlmrn9xTilKsK--H7",
              "nSolution": null
            },
            {
              "id": "ff19ece6-b0fc-4f02-9b4c-62ad3c9af3b8",
              "name": "Autumn End Sem Exam",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "177Qk9ooFuu0karfJB1JPZn5CrbFyvbRF",
              "solution": "1PMXOMyHh9FTLO-xRZ8uWu_asmOay0SQK",
              "nQuestion": "1mlJqayHU-Rs9GLG5gnK0VLqAtjzpdC4e",
              "nSolution": "1PMXOMyHh9FTLO-xRZ8uWu_asmOay0SQK"
            },
            {
              "id": "9e4cfde5-c2ba-408c-b1b0-bc71b747a90f",
              "name": "Autumn End Sem Exam",
              "year": "2016",
              "type": "End Semester",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HAoRFv68fyDu3c1tEytzmWd2mKNSY997",
              "solution": "1Id5s88VVaZfczTDE6QD9fXNXId6Xp1nK",
              "nQuestion": "1HAoRFv68fyDu3c1tEytzmWd2mKNSY997",
              "nSolution": "1Id5s88VVaZfczTDE6QD9fXNXId6Xp1nK"
            },
            {
              "id": "8c78c92f-a788-4fe9-bc02-6d5844261263",
              "name": "Spring End Sem Exam",
              "year": "2016",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1R-2fA2yub4tQ6v6_3ITx5OZtWZ7l63f4",
              "solution": null,
              "nQuestion": "1R-2fA2yub4tQ6v6_3ITx5OZtWZ7l63f4",
              "nSolution": null
            },
            {
              "id": "b727084d-52b1-40da-b0d3-c7e23ec1bbee",
              "name": "Spring End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kwWSHO9KO9Pbsb4lL5RVGkbOkgNVGaUO",
              "solution": "1HAEOEJ7_i7egGu8FYMfsbmOA30KzzD6O",
              "nQuestion": "1RiUjcUT1ojQbWcdZcDIt8eo8r1Rdnyej",
              "nSolution": "1HAEOEJ7_i7egGu8FYMfsbmOA30KzzD6O"
            },
            {
              "id": "c3dc69f2-aa67-40d0-83b3-f3121cbbc26c",
              "name": "Set 1 Spring End Sem Exam",
              "year": "2013",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1U8EpawfvDKOGKPqcdiJpsWcXF9224Yxz",
              "solution": null,
              "nQuestion": "1U8EpawfvDKOGKPqcdiJpsWcXF9224Yxz",
              "nSolution": null
            },
            {
              "id": "e32b6eb7-ff85-430b-beea-3a3fdc0eac79",
              "name": "Set 2 Spring End Sem Exam",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Z8xfBhq6zV2XAy3fF2g_vmwdFu18Hlqs",
              "solution": "135tZF6SUURq9nFpZh5cO-3PMGVprpCKj",
              "nQuestion": "1nWjnKmAJ7bggFKcwrebCehNBIOSpUtyj",
              "nSolution": "135tZF6SUURq9nFpZh5cO-3PMGVprpCKj"
            },
            {
              "id": "96b70247-7044-4d9e-bd7e-74d3ecb3f04b",
              "name": "End Sem Exam",
              "year": "2010",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13alkPmrgtXgKK5JVNn6w22VH1atQ5VQd",
              "solution": null,
              "nQuestion": "1GHXSmnrxEAwRWS7jXwjJ93Uaew-VfLxr",
              "nSolution": null
            },
            {
              "id": "57713620-f335-469b-a65e-17274864cb0d",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1adt_nRqOArmkAu0bLGCcEYFL5AD3bufI",
              "solution": "1MpMfUx1qTsmhZsOncqjXwXfLnExcgyL4",
              "nQuestion": "18Bw_GDLGuGGrukNUrGCY7u6PART2MyBV",
              "nSolution": "1y279s2-UGaOk7eLoeZniw9tyFJjqx5bI"
            },
            {
              "id": "c33b8899-1a1d-4528-ab6c-101c7b35bca2",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1aebRCRFADxXq-bGFLhLNVqdhC5TJLuVy",
              "solution": null,
              "nQuestion": "1WhaWYUrn7TTyiZzkpHuybDD4WxzJMI2E",
              "nSolution": null
            },
            {
              "id": "a438747a-7e57-4ec0-9ebe-c568cc0ad3d4",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11bosXtmT15HhXH4MjD9XRqPZ5r7OntUj",
              "solution": "1LHqIlE1N90OXodGa2GQv_F68tYoDJd0x",
              "nQuestion": "1smEEprrdo8T5b42H3A2kW2sSqFGQc1Zg",
              "nSolution": "1Yh0d6vPyJER3hfy-TDBRMU8o7lGCYVHJ"
            },
            {
              "id": "a4de010b-18e5-4d5e-a281-d53fd27172b2",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1r3gsFj_mPGH2w7qm6CRlK8VHYfyNaOpA",
              "solution": null,
              "nQuestion": "1p1wiF09D5ckcLPylIX-Zg24CI_QJVNJU",
              "nSolution": null
            },
            {
              "id": "da7f7d6e-a422-41cc-a500-dc7ebacd53a7",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1FFwbyctxUP0KrHXQk_m9XPa_eGLDeJ7h",
              "solution": null,
              "nQuestion": "1yG_NqVCm-gNiZvtjXjyz0FLf_6Hy0SOC",
              "nSolution": null
            },
            {
              "id": "6ecf9296-4e3c-4981-9dc8-d7153ffac937",
              "name": "Spring End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "REVIEW",
              "solutionUploadedBy": "66eda0a8f740b2b3e5002d58",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1cb4_ny2kcxlUlMMFa-Ou5GafCZRt6sxM",
              "solution": null,
              "nQuestion": "1bJfXa2zH9D0PLq3LiIJFM00_IqffFEGz",
              "nSolution": null
            },
            {
              "id": "577dcad9-45b1-4f51-8bed-8d36cd5c5678",
              "name": "Spring Mid Sem",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1zlNb1zgJBLr5S0-EPDKMbYwttOBxOkcb",
              "solution": null,
              "nQuestion": "1-cx_mVu3bbHuRNvHfYKfFh4wFUV6k-Fb",
              "nSolution": null
            },
            {
              "id": "3b7d7250-435a-4339-88da-b39c55b0af7e",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1AYtsg1ddT7uRB41H2w-3Z543pGRn9RVe",
              "solution": null,
              "nQuestion": "1v0rFKZ5NoPP4yF9JcXiz4bz1SS5XdS-x",
              "nSolution": null
            },
            {
              "id": "af9e3d3d-e017-4b8f-bbf0-dd46f811fb00",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HtYAIWjjvwwGK-y5B9cbBtLp03jihWp3",
              "solution": null,
              "nQuestion": "12D7D63LueFV7Z0imdZp9XaP3zVcAW0NR",
              "nSolution": null
            },
            {
              "id": "e8be69ab-b938-47ca-8891-de3011565968",
              "name": "Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1eQNEFSdS3fRVqUykrxo8URRUv2cJU79W",
              "solution": null,
              "nQuestion": "1XuG82BVPVtdvaS3edUnySDyEhw14whDN",
              "nSolution": null
            },
            {
              "id": "815c5dd3-c7ba-4b8c-9016-8374fecf2722",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HbFPKBcki4vKAHJQHh7d5H17-vDkLh2q",
              "solution": null,
              "nQuestion": "1Sve9fQ5U6-qa4nhmP8bSCp3uc5GLF6R3",
              "nSolution": null
            },
            {
              "id": "22a88cb0-70a5-4c03-8c28-6f4d612ce387",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721b2a55a965de869c4337c",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1AyZp5ArvSJqPpybN4R73LBEkD5FWYq0i",
              "solution": "1bcYid3xN-kXw7FKMj1_Kx72U0R5r7FJA",
              "nQuestion": "1NXJQfs7bKi29f9fLHlwrBGAXWCqFaCUV",
              "nSolution": "1sHGw-xQYdUYpA37Sh_xlyYeh7UvPIM9U"
            },
            {
              "id": "18ecf894-fc39-4020-891a-6ba5d7ce6e17",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1w9YnCje6ADscPkJAy_rnCE9l9TQVBWzD",
              "solution": null,
              "nQuestion": "1cAGAV0i7t9Fhu37UNzvgB6D_3_RMtl4q",
              "nSolution": null
            },
            {
              "id": "0bb53921-b2be-4c63-9eba-14bdacdfadb2",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13UC150D6RpGliRgYSzeyRvGYWzoq_AFk",
              "solution": "1FSeeaHUMWNzxszE-iCppwcLIPXYPmFg-",
              "nQuestion": "1HSI_q4OA_uXCSibBewWcm0DzCcINZEK0",
              "nSolution": "1WeS-FCgJ7GVAzR2FqCp5plniry0vsK3n"
            }
          ]
        },
        {
          "id": "65d2211d1bdc9aab41338808",
          "name": "HIGH PERFORMANCE COMPUT",
          "SUBCODE": "CS3010",
          "Credit": "4",
          "folderId": "1PGH1kRoS1BYOZbd3dIi8tzSjH7ruA3js",
          "pyqs": [
            {
              "id": "93c12e1f-8f24-4698-af6f-f9a0290aa089",
              "name": "Question Bank",
              "year": "2022",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sXo28m--8k6cJAzIYy8UJbrqaInOucay",
              "solution": null,
              "nQuestion": "1sXo28m--8k6cJAzIYy8UJbrqaInOucay",
              "nSolution": null
            },
            {
              "id": "f34eed64-e5d7-4b0d-9d8e-1d47603e4b66",
              "name": "Autumn Mid Sem Exam",
              "year": "2022",
              "type": "Mid Semester",
              "status": "APPROVED",
              "solutionUploadedBy": "66c2370742841c454a166dff",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xESjZgelAv6hK79FW80zgQfGoRsPrJWZ",
              "solution": "1-J02GppP9h3OVKutOgqlVj-aP5HbttVn",
              "nQuestion": "1xESjZgelAv6hK79FW80zgQfGoRsPrJWZ",
              "nSolution": "1yJH5CDuKtbFqgPOyli9eisO268wvxGtX"
            },
            {
              "id": "26c22303-b012-449d-9d2a-f030db7e1c35",
              "name": "Autumn Mid Sem Exam",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1l80oOfInKXtNR7idDhC2RMveMIUKm_wG",
              "solution": null,
              "nQuestion": "1ZDej4axyWvooSWmfeCqE5ww9OnQfqn3o",
              "nSolution": null
            },
            {
              "id": "a84d87ac-3ad2-4817-b69a-a3bc49068654",
              "name": "Spring Mid Sem Exam",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RuJAMw0sixlZ5fNdiNxVHt1Q5rmlTfUA",
              "solution": null,
              "nQuestion": "1NzDQ_v3t_2YDaRA-wLjgNM2lMSgDFpbf",
              "nSolution": null
            },
            {
              "id": "ca95a425-417e-4b6a-b1b4-4ed349a9fb3c",
              "name": "Autumn Mid Sem Exam",
              "year": "2017",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1mkXUGWW2gAxX6Nhnrl74TXQjJKiC9Vgi",
              "solution": null,
              "nQuestion": "1mkXUGWW2gAxX6Nhnrl74TXQjJKiC9Vgi",
              "nSolution": null
            },
            {
              "id": "93a92a5e-3468-46f4-85b5-fb4cea3fdb53",
              "name": "Special Mid Sem Exam",
              "year": "2017",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1lDbNoZZnjMRNVYJ7HeIVY1dtRAcqmlpi",
              "solution": null,
              "nQuestion": "1lDbNoZZnjMRNVYJ7HeIVY1dtRAcqmlpi",
              "nSolution": null
            },
            {
              "id": "c4fa188b-aa98-4a93-89f8-8b9dcc13a722",
              "name": "Repeat Spring Mid Sem Exam",
              "year": "2017",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Wvl1RKMRQErTotu3xNWa7dW6S69A3xc7",
              "solution": null,
              "nQuestion": "1Wvl1RKMRQErTotu3xNWa7dW6S69A3xc7",
              "nSolution": null
            },
            {
              "id": "e888dc13-eda7-4b1f-a722-ee2fc0d71341",
              "name": "Set 1 Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sOxEMGNQG0cAB0s4MnL1mjENWnebaddj",
              "solution": null,
              "nQuestion": "1hu5iOzbwGa2rm4l-98nPR6poddDJKnvv",
              "nSolution": null
            },
            {
              "id": "4862949c-97d5-495d-9134-0b21d29a4089",
              "name": "Set 2 Mid Sem Exam",
              "year": "2016",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1f3UqZ9t5wx9KJ2YPU7IvUp8Fr_6DQky1",
              "solution": null,
              "nQuestion": "1f3UqZ9t5wx9KJ2YPU7IvUp8Fr_6DQky1",
              "nSolution": null
            },
            {
              "id": "c7645a36-de72-4155-8aac-dcfd328fe452",
              "name": "Set 1 Mid Sem Exam",
              "year": "2015",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12I7iQdJnXF7mE_btq4kIWLCnTm-LCH27",
              "solution": null,
              "nQuestion": "12I7iQdJnXF7mE_btq4kIWLCnTm-LCH27",
              "nSolution": null
            },
            {
              "id": "f14c860b-e100-4a24-a1d0-a134670286b0",
              "name": "Set 2 Mid Sem Exam",
              "year": "2015",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1m3ODrb-O46M5Lm1TVY9vltYexfu7V5YY",
              "solution": null,
              "nQuestion": "1m3ODrb-O46M5Lm1TVY9vltYexfu7V5YY",
              "nSolution": null
            },
            {
              "id": "0c1288b5-343b-4a5d-a323-c90f6aa320d6",
              "name": "Autumn End Sem Exam",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1w54fm-35ATvWrpI4wE-cRZ9v9ookZg6J",
              "solution": "1UYkli36XLSUEHNYSE6IemKXAcGXKa1GZ",
              "nQuestion": "1gJsThL2VI5Gd_Dl-4GJLZ2Up2B5bwXPh",
              "nSolution": "1UYkli36XLSUEHNYSE6IemKXAcGXKa1GZ"
            },
            {
              "id": "b1a7f9d6-f42c-4ae7-9b3c-cc512dc4b032",
              "name": "Autumn End Sem Exam",
              "year": "2021",
              "type": "End Semester",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HKXki49sDOb05FU9K8k-9jmLNz3x1Uhb",
              "solution": "1HKXki49sDOb05FU9K8k-9jmLNz3x1Uhb",
              "nQuestion": "1HKXki49sDOb05FU9K8k-9jmLNz3x1Uhb",
              "nSolution": "1HKXki49sDOb05FU9K8k-9jmLNz3x1Uhb"
            },
            {
              "id": "ca3d184f-3077-48c9-b0b1-f11a3aa98fac",
              "name": "Autumn End Sem Exam",
              "year": "2020",
              "type": "End Semester",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pA0joh85PhA9_Q1zmkJcqvlSRrVggOHl",
              "solution": "1pA0joh85PhA9_Q1zmkJcqvlSRrVggOHl",
              "nQuestion": "1pA0joh85PhA9_Q1zmkJcqvlSRrVggOHl",
              "nSolution": "1pA0joh85PhA9_Q1zmkJcqvlSRrVggOHl"
            },
            {
              "id": "535395ac-d308-4a9d-83eb-748be563c19e",
              "name": "Spring End Sem Exam",
              "year": "2015",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pqf3Lpg3M3gdoJbv2NXvRcsLKYzO83vH",
              "solution": null,
              "nQuestion": "1pqf3Lpg3M3gdoJbv2NXvRcsLKYzO83vH",
              "nSolution": null
            },
            {
              "id": "6850b638-a081-4d93-b755-66cf9704e0c4",
              "name": "Autumn End Sem Exam",
              "year": "2015",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1WBcH6lwLmdjW1XMM8UpP9vyK5rjMQ4_3",
              "solution": null,
              "nQuestion": "1WBcH6lwLmdjW1XMM8UpP9vyK5rjMQ4_3",
              "nSolution": null
            },
            {
              "id": "f8cfc912-c47e-4483-8777-cc37a6c796cd",
              "name": "Autumn Set 1 End Sem Exam",
              "year": "2013",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19AJXg6-Ncyek_ENXNO_aDBqJXzaETD8V",
              "solution": null,
              "nQuestion": "19AJXg6-Ncyek_ENXNO_aDBqJXzaETD8V",
              "nSolution": null
            },
            {
              "id": "ee5c9966-5cdd-4489-b4e4-5e0b3d161cf4",
              "name": "Autumn Set 2 End Sem Exam",
              "year": "2013",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1--0wUX9erE8z9QeiyNnujCrUwpw5lZrc",
              "solution": null,
              "nQuestion": "1--0wUX9erE8z9QeiyNnujCrUwpw5lZrc",
              "nSolution": null
            },
            {
              "id": "a714dbdf-bebc-4c65-8e29-e085be4c6860",
              "name": "End Sem Exam",
              "year": "2009",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_doJM0fzfrWkV9a78Hom38nhuu03Nka4",
              "solution": null,
              "nQuestion": "1_doJM0fzfrWkV9a78Hom38nhuu03Nka4",
              "nSolution": null
            },
            {
              "id": "5bf6ce71-2d44-4bb9-8938-36cc76747a38",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661aaa9ba909c6db59a42038",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HtLzvGNPddK4jQylxJZEMoxk0JYKM3en",
              "solution": "1UjOGZJUAcdn2IywfMbd4EZFYM9y3iAoa",
              "nQuestion": "1Icw1QdmXqB16Ud1vN9kQBPIGqN3Se1mY",
              "nSolution": "14cY-SannG8r6fN1ssNScqANoo7R1o6P3"
            },
            {
              "id": "f4001a00-a778-47c7-ba5c-8a18ca40bec9",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15hnfGUVlYxITTW6hP2kFtTHkHuBPlqn-",
              "solution": null,
              "nQuestion": "1pkY2BuvSFNZBjWnfN8yL_z4dQ5M6Kxd3",
              "nSolution": null
            },
            {
              "id": "31ef95d8-0288-4c23-9e1d-95bd66451a38",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12Kmmr6jEe_izAGEfXgXBgqdmeYbAp1Ig",
              "solution": "1RHBYvbKVtmXjCAVRMVbkA96rCK6GFDbE",
              "nQuestion": "1jhiqs0poqiiR5s1WvI6sAuT9UBbi0Mss",
              "nSolution": "1Nu9v3qPagHivPqmCovV9mJA3ROUO74A-"
            },
            {
              "id": "3fc085b0-d8f3-45af-9b60-782fd10192ff",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1j2G-QNFUdxjIEKnX42qRhrOPlxcZj2zH",
              "solution": null,
              "nQuestion": "1WNHJH1e4XofuDb0yZunMHkfekk-FMfK5",
              "nSolution": null
            },
            {
              "id": "8bf0a484-6816-4ef2-8c9f-607247324337",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1gX4fqUfHKz9FB1lpq24HT6LKqY8UAB3s",
              "solution": null,
              "nQuestion": "1xMfOr3S4CsR3v5bMTHVSAoM-uZOcNW0q",
              "nSolution": null
            },
            {
              "id": "3f160892-4cf6-49a7-af39-dd440f51fb45",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1veEu10H1_tuCJ2syw5CxcM7SDpsS3v-z",
              "solution": null,
              "nQuestion": "1njQi9EyvkkSuQaJhGG6ip5nkoUfAUfVL",
              "nSolution": null
            },
            {
              "id": "d8475ab7-7208-48df-bcd0-d49fb7b9253a",
              "name": "Spring End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "168DRRBKBmP2nNwoTF9URRbFx3_0V_szx",
              "solution": null,
              "nQuestion": "1NHvmUtCe_P7af6qqn4Kc9e6OWQL1Yn8C",
              "nSolution": null
            },
            {
              "id": "9798264d-0ae6-41c2-8c05-40bb208b339c",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721b51c5a965de869c4337d",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_VdooTExKbCTPfq5BJfmyQ0B4I6fXOY4",
              "solution": "1ti67S868c8RfG7FjAhdp_dgwYcLj8HTv",
              "nQuestion": "1eQd9mAfJezIbOZ1F2ROkEotHkwxeuYMh",
              "nSolution": "12HXOhTe66B12tziy0WJgSU7ex85u4nky"
            },
            {
              "id": "0ee844c3-294d-4ae7-9d5c-2ee170562bdb",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ipxlz4UTLUAb-fvdZSmIY9BD9711CFah",
              "solution": "10uYQahvyF9OXt5mXN1u1fF6Wv1X-uNCH",
              "nQuestion": "1pre7OQ-ntceXDbusunTMo_w-KS2OE5HN",
              "nSolution": "1CcsdzPFdQCXViSdRw1koLz9amt_NjE0c"
            }
          ]
        },
        {
          "id": "65d2211d1bdc9aab4133880b",
          "name": "D_ELECTIVE-2",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1P1-jy1ERCB-6Ovv9i4QnJHUYGRI2z9zt",
          "pyqs": []
        },
        {
          "id": "65d2211d1bdc9aab4133880a",
          "name": "D_ELECTIVE-1",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1-1zTdUh3wfRIEJq8OVma164yP6ox_--6",
          "pyqs": []
        },
        {
          "id": "65d2211d1bdc9aab41338807",
          "name": "DESIGN & ANALYSIS OF ALGO",
          "SUBCODE": "CS2012",
          "Credit": "3",
          "folderId": "1jPMKCPq5VvpdisqvnlRDw7ORQ4sVBccV",
          "pyqs": [
            {
              "id": "ce87c9e4-5d87-4b23-ad10-5e25f3851d30",
              "name": "Spring Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1bkIk54i7op9Egkr_Rdb-gVxITPOUGCsJ",
              "solution": "1L54A5BsmzdiO4v9jw8weX3vh_I6_8GuP",
              "nQuestion": "1W0YVgN29RKePEDIK-eTIpFcXtg1ulkcL",
              "nSolution": "1L54A5BsmzdiO4v9jw8weX3vh_I6_8GuP"
            },
            {
              "id": "45199561-c4f2-474e-bdd6-32f16616232e",
              "name": "Spring Mid Sem Exam",
              "year": "2018",
              "type": "Mid Semester",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "16auJmPKG3I3VE2o51D-3cyjHzFZYdOCx",
              "solution": "12E2zYg9lcl8tXEIVpcghK_MOXrEO-6bi",
              "nQuestion": "16auJmPKG3I3VE2o51D-3cyjHzFZYdOCx",
              "nSolution": "12E2zYg9lcl8tXEIVpcghK_MOXrEO-6bi"
            },
            {
              "id": "40836ce0-fa46-4460-ae6b-21a1b09da6e3",
              "name": "Spring Mid Sem Exam",
              "year": "2017",
              "type": "Mid Semester",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Q8D78rj_GgfhxgILUOHGDbUPByvVpJS0",
              "solution": "1FiBY8qOcmgNP9WFN1XSfTGDQmRULGKak",
              "nQuestion": "1Q8D78rj_GgfhxgILUOHGDbUPByvVpJS0",
              "nSolution": "1FiBY8qOcmgNP9WFN1XSfTGDQmRULGKak"
            },
            {
              "id": "b0d30d20-6614-40eb-8b7d-1f8b1b6ba8e7",
              "name": "Spring Mid Sem Exam",
              "year": "2016",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1qecBGAdmQ4LQ_xQ73A0MaFL4hI57o3vS",
              "solution": null,
              "nQuestion": "1qecBGAdmQ4LQ_xQ73A0MaFL4hI57o3vS",
              "nSolution": null
            },
            {
              "id": "dab72b5a-c31e-42f4-b9bc-4b207eb13f69",
              "name": "Autumn Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Vmt3wc9354c63nvpiAGQclKUSn68BD46",
              "solution": "1FQglimRA3Zsr-HFXOPSpLNrejnoEk3-z",
              "nQuestion": "12zyv69G__sVsUfEa0d9guelDUs4rWRfR",
              "nSolution": "1FQglimRA3Zsr-HFXOPSpLNrejnoEk3-z"
            },
            {
              "id": "b0f2c154-a44e-4037-8d22-cee22e7a8ea0",
              "name": "Autumn Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JxRMQLz1Rcpev5ORM7AuWxUMf8vYfmF_",
              "solution": "1AI99a_4yQeDaT2lJer_jXYICRS01vk6k",
              "nQuestion": "1DYAj7aBDqtTPg9a8IjKvg1AKsnMCjRhL",
              "nSolution": "1DsL3TPZZalmUkLk1xuNN9KpfZ8hvmqSN"
            },
            {
              "id": "d6acebb2-1bab-4c6d-879c-728d85dcdf8c",
              "name": "Autumn End Sem Exam",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DWkY7s5V2JEkBt-3jgghN5JB8h0wpGzs",
              "solution": "1QqK6GFFFMa82nWrVtOZYJmGUkeP4P2XN",
              "nQuestion": "1mZqRx5SVCNizLKtqjfME9wQ5OLqbAUHj",
              "nSolution": "1QqK6GFFFMa82nWrVtOZYJmGUkeP4P2XN"
            },
            {
              "id": "49c1d413-1107-450e-8447-de652851f8cc",
              "name": "Spring End Sem Exam",
              "year": "2020",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1F345eLqpv_5InPo1ZyQWDD90LSN7bscI",
              "solution": null,
              "nQuestion": "1F345eLqpv_5InPo1ZyQWDD90LSN7bscI",
              "nSolution": null
            },
            {
              "id": "2012b5f1-7740-46f7-8f82-4fa285935155",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "End Semester",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1N8ZRC0OvDHgXAogXK5FPMfyb-08U5n3b",
              "solution": "1IV1uGL0btRgIkL5uqJ9W3BuBRqzHt7YX",
              "nQuestion": "1N8ZRC0OvDHgXAogXK5FPMfyb-08U5n3b",
              "nSolution": "1m4SWLgFdv1ayCUqNkNo8692tllUVB26S"
            },
            {
              "id": "36176fdf-67cb-48a1-aac8-b50e663f8c79",
              "name": "Spring End Sem Exam",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PuNoQRLdGmADvzmXUcMVbUQ6raOXrUyN",
              "solution": "1yACW6UOsNu7ffvKOZ52xWdxiuRhmJRE8",
              "nQuestion": "16R4CzMLr0JXg5KtqQHa74dXSuN2cxTwz",
              "nSolution": "1dACciJIwAYyVNMg92hI6haGKAAmMR_bO"
            },
            {
              "id": "b65bf876-0005-4547-8497-ba65dcb3e29c",
              "name": "Spring End Sem Exam",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kgcfaEfhsYyiomPQsWCXDhbkmQ--tgUr",
              "solution": "1zodp7GBJdBEBetwu_hilQfbeV2vvNSji",
              "nQuestion": "1nW9qbOKnVQMhGf68O_Uap9MR9jJf2mec",
              "nSolution": "1ZffUvMHCwK_yFqSOQtWjh-4hZhBHfN4X"
            },
            {
              "id": "1e29ccd8-89b7-4d2b-8e8b-053d4bb8532f",
              "name": "Autumn End Sem Exam",
              "year": "2018",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1yLJnDQa097H7-RCxQmH1hJGliv8wn1zH",
              "solution": null,
              "nQuestion": "1yLJnDQa097H7-RCxQmH1hJGliv8wn1zH",
              "nSolution": null
            },
            {
              "id": "24961016-2c12-4743-ab44-5df39df480d0",
              "name": "Supplementary End Sem Exam",
              "year": "2016",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1wGOAkJIN5z2E57tB7ppwPAM1Z4doyBHb",
              "solution": null,
              "nQuestion": "1wGOAkJIN5z2E57tB7ppwPAM1Z4doyBHb",
              "nSolution": null
            },
            {
              "id": "67517b96-7dfe-4c82-9fe6-f487dbd014ce",
              "name": "Autumn End Sem Exam",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1gQACYUHOYkZZ_gbScXbbwH05Mo6OgNH-",
              "solution": "1SNPQiBWHUx3ro2ub5DDjffRY_4M20qI_",
              "nQuestion": "1SjGT8szOhCrhw80zheq_U-iaqcjr3EmG",
              "nSolution": "1xj-mImXGLU3_5p-9GYo5OH2fL7vqze11"
            },
            {
              "id": "84fd6d91-315f-4b71-879e-dc605ebfcd55",
              "name": "Spring End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DK2nzIDDBuH54EnfslNw3QST0vE1ncBz",
              "solution": null,
              "nQuestion": "1XY7b7UgTI_g0j_GWULok1BdkiNlxxqpw",
              "nSolution": null
            },
            {
              "id": "6c162057-9925-4d02-8c70-c67511483b32",
              "name": "Autumn End Sem Exam",
              "year": "2013",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17mSrtPzqAkI-faeQKaKyxAfRsMR3Y5lr",
              "solution": null,
              "nQuestion": "17mSrtPzqAkI-faeQKaKyxAfRsMR3Y5lr",
              "nSolution": null
            },
            {
              "id": "fdef8490-3b21-4815-9056-826c422b7481",
              "name": "End Sem Exam",
              "year": "2012",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1lY2puXhDY6k3o7k_EE-X4TQo5gUhEDVs",
              "solution": null,
              "nQuestion": "1lY2puXhDY6k3o7k_EE-X4TQo5gUhEDVs",
              "nSolution": null
            },
            {
              "id": "fdc25313-eaa5-4cad-84ae-8879a2d53edb",
              "name": "Supplementary End Sem Exam",
              "year": "2012",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kMaF7wqtnF65cpO-EORVo4PyUE0ZRP77",
              "solution": null,
              "nQuestion": "1kMaF7wqtnF65cpO-EORVo4PyUE0ZRP77",
              "nSolution": null
            },
            {
              "id": "3c33e640-c3f3-456f-99af-e800bca13cc9",
              "name": "End Sem Exam",
              "year": "2011",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1At30ReE4bH-1S_J-VxgSKEDihumveKEW",
              "solution": null,
              "nQuestion": "1At30ReE4bH-1S_J-VxgSKEDihumveKEW",
              "nSolution": null
            },
            {
              "id": "fc860194-e4c4-4e03-b200-3da1f6ba8d0c",
              "name": "End Sem Exam",
              "year": "2010",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1zMSMnYTwTpsZF12IHCkom6JjipWktCKJ",
              "solution": null,
              "nQuestion": "1zMSMnYTwTpsZF12IHCkom6JjipWktCKJ",
              "nSolution": null
            },
            {
              "id": "4349ec34-066e-48b5-8efd-19975cb577b5",
              "name": "Supplementary End Sem Exam",
              "year": "2010",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1iS32XHYfgL_WqXzRJbevShbWQYWXJ2Nl",
              "solution": null,
              "nQuestion": "1iS32XHYfgL_WqXzRJbevShbWQYWXJ2Nl",
              "nSolution": null
            },
            {
              "id": "fdec84a9-07e2-426d-b78c-3dcfc239f4f0",
              "name": "End Sem Exam",
              "year": "2009",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NHu0zW5bjYwW-qmYDxBfT2mINcWo3G2_",
              "solution": null,
              "nQuestion": "1NHu0zW5bjYwW-qmYDxBfT2mINcWo3G2_",
              "nSolution": null
            },
            {
              "id": "ea19f3c4-83d9-4f7f-b2a7-70d24896fabc",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "669bf81442841c454a166c93",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NphnIqrlaNdHdWGDNpRGoOXcyTMn0RbV",
              "solution": "1UrA0IWFE7FmxX_EyB92cLQXLGnOf7npA",
              "nQuestion": "1sZF6dqiJJMfcClblbST0TVao_RpIcy2I",
              "nSolution": "11CraI4nyU6Bu3Xi7z0oDYtc1W7bj_W_y"
            },
            {
              "id": "47045ab9-5305-4c10-b875-fb03ff582813",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1zBzZxbIvNak66hddw5R-5cy6gBBFTw9S",
              "solution": null,
              "nQuestion": "1ixMrxHw24PZiyNWwal652aCfGXiRs3F5",
              "nSolution": null
            },
            {
              "id": "d2cf5094-0bf6-4130-a6a3-9c9182d55ff2",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1TBVqsdNT_a0jO0SotyjJtvkWEMeP9U9f",
              "solution": null,
              "nQuestion": "1Dv-BrybpN3-YpZFAq11_tsZ5KXS7LJav",
              "nSolution": null
            },
            {
              "id": "af4a2caa-2375-46c2-bcf1-632d13781e30",
              "name": "Spring Mid Sem",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1YQfAfY90dxT4NS1pIvlGR77znxD_Jece",
              "solution": null,
              "nQuestion": "1Tqv9V_dSc7dlAgytSF8vdPW8ngvnEbVu",
              "nSolution": null
            },
            {
              "id": "473bc414-a141-4b78-b0a7-136bd710c0d6",
              "name": "End Sem",
              "year": "2012",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10ZvdfYUy5OCtfkt__JBhyKb3VlRcYKnB",
              "solution": null,
              "nQuestion": "1SRDVlaCrS-i7fkop60oJNHwKkPnhP3X3",
              "nSolution": null
            },
            {
              "id": "766f7415-2627-4957-9828-ab8eac94bb36",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661aaa2fa909c6db59a42034",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1UZFt6ZqJtxaY3cK_VGw5lnM7DhUTNYpY",
              "solution": "1vltrKOvzDh5x3pQUDqNzIhkjYAWW2BDM",
              "nQuestion": "1v9sAYz7_HadeQFsj_iKxy_bLwddSfFDo",
              "nSolution": "1haPSRUNKJiVdBYXzSy3phH3rLpgR9JoI"
            },
            {
              "id": "8ca02aa1-ee73-4c9a-8033-eca0f6bf982c",
              "name": "Autumn Mid Sem",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66bdb30a42841c454a166de7",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Q-hSb5VJWvyMDB3UhS5a_g2L-JpD4HPM",
              "solution": "1aA7EqxXuu36KyciL22eXLbK05Tk6GklW",
              "nQuestion": "14IP1qnkwpMlaE0hegRaSt25DCrfietK6",
              "nSolution": "1SpUaqgPGyUZm4aXpwDJZ-F3x5KXHCvsF"
            },
            {
              "id": "04b3688f-aa25-4654-bb26-0b0058c869a3",
              "name": "Autumn End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ptaaSzTZAPZoNLQEE_NfgU-M2Tgj_hkx",
              "solution": null,
              "nQuestion": "1kkTjPV-lXZqgocZg6h5aQSTT9F51hGUq",
              "nSolution": null
            },
            {
              "id": "42a9dcbf-78ca-4899-84a8-ceb7a68709fc",
              "name": "Supplementary",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1I7_r6B74z2RPhlBQOXM9PFz_DKL2QCYr",
              "solution": "1-9DkVj2-_EBer8eMUutd-Ck6ubvursbN",
              "nQuestion": "1UHPY7V-K8Lszl7NORw2NPo0FRtR18Nva",
              "nSolution": "1wiI3IZsp0ksBIrojgU3IhZsH9AA72jlo"
            },
            {
              "id": "a59c0aad-e7bc-4621-b3cf-231ebe2ff11f",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721b2265a965de869c4337b",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1IrGSPMWu_OlwUiNJ4k0xRxx1sNElhpHy",
              "solution": "1lBiOwRHDuwyAqtkr9rUyKsjD9p2Yc5P1",
              "nQuestion": "1_E8f1wbkjIOmxe-Y11hXm_JNQOw0QjLN",
              "nSolution": "1PysjdKSABHFz83ImAWeyhEpySVzryNJd"
            }
          ]
        },
        {
          "id": "65d221b01bdc9aab4133880c",
          "name": "COMPILER DESIGN",
          "SUBCODE": "CS3008",
          "Credit": "3",
          "folderId": "1XWuvoNDWq-n6W0azKIAcRNSUcPiL-jjV",
          "pyqs": [
            {
              "id": "fbbde820-ab08-4556-9829-3cad80877078",
              "name": "Spring Mid Sem Exam",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15buhQafPLr7yCP16J9PM6kQSXfdPzhZp",
              "solution": "1RpHTux4RBXpBLCbM9ikTZKLqfxUZ2o3Z",
              "nQuestion": "1ju3Dt6roGpHMO60wKk5JC4OjEqd3EiX0",
              "nSolution": "1RpHTux4RBXpBLCbM9ikTZKLqfxUZ2o3Z"
            },
            {
              "id": "4f3952fa-7e69-4746-aaf4-02ff8ab4c182",
              "name": "Supplementary Mid Sem Exam",
              "year": "2019",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10u_JAzhDj4Bh9LiHSkCBw_5fEXsQFhV4",
              "solution": null,
              "nQuestion": "10u_JAzhDj4Bh9LiHSkCBw_5fEXsQFhV4",
              "nSolution": null
            },
            {
              "id": "0967b9ea-c3e5-4655-a7e6-3407c6f8feab",
              "name": "Spring Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1j0dSxr7oLBWuulxtQSKbeNzsiOwUNz5l",
              "solution": "1ywjBNbF9cZdluqmG8oruAGmNDrySRJXb",
              "nQuestion": "1MfPD_37jVSc8uORz_iEpIPC4l00-Q_YI",
              "nSolution": "1ywjBNbF9cZdluqmG8oruAGmNDrySRJXb"
            },
            {
              "id": "de991d73-bd43-4e19-b611-18da1427bea3",
              "name": "Makeup Spring Mid Sem Exam",
              "year": "2019",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1CYg7H-NC0FV_qwtcA2rVDE98aZF9Nqzb",
              "solution": null,
              "nQuestion": "1CYg7H-NC0FV_qwtcA2rVDE98aZF9Nqzb",
              "nSolution": null
            },
            {
              "id": "d2291c06-9d9a-472c-aea5-adc7eb8e17fd",
              "name": "Spring Mid Sem Exam",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1H6vn4z8m1QsJctOlMIHkR1o7U6eMo6mw",
              "solution": null,
              "nQuestion": "1j07LLPTwppJch6X7fWS4GkA_LfU7AEKj",
              "nSolution": null
            },
            {
              "id": "38185833-cfc1-4a69-867f-2ec037e4a2a2",
              "name": "Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17iPwGyGT6JV1Pi6i6CyrYC6AE80G-I0T",
              "solution": null,
              "nQuestion": "1OK_peFWo37H6IPD1xzgybC31s96Tazi5",
              "nSolution": null
            },
            {
              "id": "18462c84-6a3a-4989-ae38-c1526f3455bb",
              "name": "Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tXkvdXgsmcVsm4yaEoEP5JYprF2RvCZL",
              "solution": null,
              "nQuestion": "10bLjG5oL-I7EF171Q_rMcyy-AV0MQm-O",
              "nSolution": "153pB9Q57DPtCrIw_debJXWPZh-YvTF5K"
            },
            {
              "id": "12c5918e-0c89-4152-95a5-99b5495071c1",
              "name": "Spring End Sem Exam",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "660b93fe30641ad00aae8ac6",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ETKBYlqkZ3m19CryGVP17Pd7Me8FmX9g",
              "solution": "1xDoXZfY1rkqnNfaf9wQ6Cr8DD40gp7iC",
              "nQuestion": "1DLw8utYany6BqRwpJ4MuIMiq9X7iMIl-",
              "nSolution": "1QNpmlJMQFfV5wiui3NJFpIQo-kfy21nc"
            },
            {
              "id": "107f8000-4e2c-430e-bcae-7e150be81595",
              "name": "Autumn End Sem Exam",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1UAoR2087SQUPoczgFmfOEdY6kP72NbK8",
              "solution": null,
              "nQuestion": "1RSIaXqYXqA3_kpLwFOu3Ak6HzXlC7oWu",
              "nSolution": null
            },
            {
              "id": "bbbcc113-6153-4fa4-bd3d-3b76bb2cb610",
              "name": "Autumn End Sem Exam",
              "year": "2021",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1wlcwL7_gQc3Wz5EMugY_3KqbpfgvZQvV",
              "solution": null,
              "nQuestion": "1wlcwL7_gQc3Wz5EMugY_3KqbpfgvZQvV",
              "nSolution": null
            },
            {
              "id": "bdc3f369-2bc7-434f-b104-de587fc110da",
              "name": "Autumn End Sem Exam",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1qSuZWGjjHQhbFzhKk9lxKO2k1Z-IEht4",
              "solution": null,
              "nQuestion": "1YyrTicn800aL4vKxdWCkNFTnq_eymMiy",
              "nSolution": null
            },
            {
              "id": "b0df3131-33e4-4a79-958d-f04717a0e907",
              "name": "Set 1 Spring End Sem Exam",
              "year": "2019",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1AupZRlgWEagBESIctchsEtqGp7oNl0Rr",
              "solution": null,
              "nQuestion": "1AupZRlgWEagBESIctchsEtqGp7oNl0Rr",
              "nSolution": null
            },
            {
              "id": "19d581f1-5bef-4562-accb-c9969303c4eb",
              "name": "Set 2 Spring End Sem Exam",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BDLTSUC32KtAWFqlzivp2eAegxttxLpz",
              "solution": "1sdEfnF8Ugs0jIQwZImusyG0YvC_70FnC",
              "nQuestion": "1yiZ9xA4HeXXihJgvVXxvekQUbBfXU6yc",
              "nSolution": "1sdEfnF8Ugs0jIQwZImusyG0YvC_70FnC"
            },
            {
              "id": "d78cc888-839d-44b3-8d13-a087f101ff87",
              "name": "Supplementary End Sem Exam",
              "year": "2019",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1bXR6ZpqhpW8VmPligmTzmmjLo6fy9vkw",
              "solution": null,
              "nQuestion": "1bXR6ZpqhpW8VmPligmTzmmjLo6fy9vkw",
              "nSolution": null
            },
            {
              "id": "f029399d-2a9c-4cbf-a210-87ebd2f00d46",
              "name": "Spring End Sem Exam",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661943e8a909c6db59a41fcd",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_lC2uB9giFOPePgJLnhsHr_ZEJNzCCrw",
              "solution": "1wQwS3BJdDfhf7u4Uc3EZRheLWq5veBfa",
              "nQuestion": "1mI4yUCU6DSZpkTh2DgZxy7bcpjs7TkGq",
              "nSolution": "1pCLbAVNPWbBRQiVFAb9iN95tOpX2C5_P"
            },
            {
              "id": "247ab962-ef99-4ad2-8d75-57737617d0ae",
              "name": "Spring End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Gec_7nz_ecEdSrv5Moma-vIIuxyNFZfS",
              "solution": null,
              "nQuestion": "1lFbvVHITdPUynr-f9-T9GfDZSP2qyjrq",
              "nSolution": null
            },
            {
              "id": "dc303d69-5716-4f92-8293-fc1e917c033b",
              "name": "Spring End Sem Exam",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Jk8SgyuRkItLC3tcDC9JGrphi2DeapDY",
              "solution": null,
              "nQuestion": "1_w2kDHxgM3ocSJqgkQxsDZ6u7HBSiriv",
              "nSolution": null
            },
            {
              "id": "feb04562-4186-447f-a813-fd8d783f6943",
              "name": "Spring End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tKkU02efCqMVMlVEypQnQhG0xxYW2awS",
              "solution": null,
              "nQuestion": "1Ww9lbHL_2QsU68uWs14t1F3QM6sBmuDH",
              "nSolution": null
            },
            {
              "id": "4d47046d-e5bd-4ca3-b900-c9d014c0b6bc",
              "name": "Spring End Sem Exam",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12OeveKUPdMHuGHGFooTt8FO1RVhtbY8J",
              "solution": null,
              "nQuestion": "19ItoRFf-gSR4MzvvvsAc_whoB4gPsV_S",
              "nSolution": null
            },
            {
              "id": "4115931c-9072-4050-9b8d-b579f7774966",
              "name": "Autumn End Sem Exam",
              "year": "2012",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1VgpGZx38FrKc1tsOab8LC1lksMNdvnTi",
              "solution": null,
              "nQuestion": "1VgpGZx38FrKc1tsOab8LC1lksMNdvnTi",
              "nSolution": null
            },
            {
              "id": "26baaa0f-a05e-4dbf-86c5-ef9dee66d014",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661941ada909c6db59a41fc8",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1KmGsOAeG_OdQT9VrCuDs-dSWrFHPmP3a",
              "solution": "11aRo2m6QGF3qlwK3qZoRwlzGA7bAcgx2",
              "nQuestion": "1F2gBSA77grsXt12YbXooCknIq5y3O-RQ",
              "nSolution": "1wQTY22M4BwIS1u63ghIrxxfssfDp-nOj"
            },
            {
              "id": "0deda869-5685-41c5-b305-d586c449af12",
              "name": "Spring Mid Sem",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65df31470fb947f5b25481c9",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sl68WdnQzU4uFyc6RvedpnULh0s598HV",
              "solution": "1NIdYntZ103Z4wKr2auY6kCVNFhWKC8vN",
              "nQuestion": "1_n8qQ0Rmn6vIZYo4A-8-J6lrIl1pk-N8",
              "nSolution": "1dzkv3yGL-NskZgmdOirL0AFHPeDUB_rA"
            },
            {
              "id": "14de72f8-4d8f-4483-a5cc-29d50f8ab0ad",
              "name": "Spring Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Edw1JINw8D2iUCyOJ4bOZYvgXfA_5T3M",
              "solution": null,
              "nQuestion": "1ETUBSalttXIL7Xn_fPiO0vhMl7T9Tdos",
              "nSolution": null
            },
            {
              "id": "742609a2-88ac-4ce9-927e-bce09a8dd553",
              "name": "Supplementary",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "18lUuFt06fqArfryJ6JO6a12wzzFBljUY",
              "solution": null,
              "nQuestion": "1jRbHGdg1SxZAjTy54tOywiFDBUdLnibx",
              "nSolution": null
            },
            {
              "id": "ae1e3dbc-5135-4969-8fae-b86dc8c949a5",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tPBA-RVpHXHqA7pLzP9_etbpzqx8Z6Px",
              "solution": "1b0axP8JwVywn-PPTjMMpvszb3VtTxbQr",
              "nQuestion": "1fKa9JiXZCQhB1J6BOaNnyhH_l24XNagi",
              "nSolution": "1QjpMqrIZYlZyVJj56D7Ts8a5oPMqTnc5"
            },
            {
              "id": "a214c5c6-45c8-4a63-8f8a-6506cd01d259",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "127KLR3IZJOqUtWM6W9v3FY67KnGOpAke",
              "solution": null,
              "nQuestion": "1IS40He7l4O2tzYy827XcNqyYtbzMaVm9",
              "nSolution": null
            },
            {
              "id": "06570dae-de14-4ad0-b397-36b94ee25436",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "668cebc397969283509b07cd",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hqd76BRbvxpmW4-KY1UGK4KUZR50T_ZT",
              "solution": "1LhH1ulQaWoOaoxoHYdL2pio9F063QX_j",
              "nQuestion": "1KE3b5rJhsfSIYVqVj2oLkFlp03OuSpUF",
              "nSolution": "1vzwf-YpKDikE1GtnXDq6uTlg_J6b36HT"
            },
            {
              "id": "2dc8ca6d-c9e6-4c67-b44c-9956fc6b1da4",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1FFu1wbMe-z_2Y6s-gpsWBP3N6fCUWBvc",
              "solution": null,
              "nQuestion": "1M7g8DCbaWNk40YUqLr0mtpecpz7_awjW",
              "nSolution": null
            },
            {
              "id": "dbb7f3bf-e8cd-4a8e-b742-8a60a7444dcc",
              "name": "Spring Mid Sem",
              "year": "2025",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1dEWg1VQonTg3JY1pqGFD3wBj_XJksCX1",
              "solution": null,
              "nQuestion": null,
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d221b01bdc9aab4133880d",
          "name": "CLOUD COMPUTING",
          "SUBCODE": "IT3022",
          "Credit": "3",
          "folderId": "1YDWvKY3RVtDZG_Cs8_bBNf8FxEbeQK7b",
          "pyqs": [
            {
              "id": "c4a41d9e-e620-44be-8016-642d9bdafe96",
              "name": "Question Bank",
              "year": "-",
              "type": "QUESTION BANK",
              "status": "APPROVED",
              "solutionUploadedBy": "65d4bbafaa980c579a71dab8",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ix7SmrWSWPN5KDTmEteRr17ZEnryrUZw",
              "solution": "13rgArNdERkWlZJtIgCfspoehbg99zCqE",
              "nQuestion": "1YLnzOajPiuSK4dif--lrssM0Z6jMyrsZ",
              "nSolution": "1oFMG6SrqBm0pOiVFUIvuTeBJVWfl7Ur3"
            },
            {
              "id": "511b4d16-b7a4-4dce-8766-675e3f7172e9",
              "name": "Question Bank",
              "year": "-",
              "type": "QUESTION BANK",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1EbpEoOuVpDPZzCMWrzX2Tl2g-zKpw6iU",
              "solution": null,
              "nQuestion": "1faJR9TmkfsMNJY4ygDvM35EV-_ES4RCE",
              "nSolution": null
            },
            {
              "id": "1bfb0437-6eb7-4f1d-910a-8123249c3d51",
              "name": "Question Bank",
              "year": "-",
              "type": "QUESTION BANK",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Ui0hss0RN2z8ljxGJuNu6KWH-fXWY3KL",
              "solution": null,
              "nQuestion": "1HD5bBolASuqkXO2PBh1ORMLV74hQhxNc",
              "nSolution": null
            },
            {
              "id": "32e6919b-f5f1-4f1e-a2f4-8e47ecdacab7",
              "name": "Question Bank",
              "year": "-",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1uldJHO_wN6dThS0yaeKTIC2Czsls7FWv",
              "solution": null,
              "nQuestion": "1uldJHO_wN6dThS0yaeKTIC2Czsls7FWv",
              "nSolution": null
            },
            {
              "id": "e1234123-abdc-4bf6-b821-272e26686a1b",
              "name": "Question Bank",
              "year": "-",
              "type": "Question Bank",
              "status": "REVIEW",
              "solutionUploadedBy": "66fefad1f740b2b3e5002df8",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1VLm9a6MIMJCX8Y8AWCFbiJgFoAFfeuxL",
              "solution": null,
              "nQuestion": "1VLm9a6MIMJCX8Y8AWCFbiJgFoAFfeuxL",
              "nSolution": null
            },
            {
              "id": "3c6d843c-886a-4fd5-a4dd-efa0510d13d0",
              "name": "Question Bank",
              "year": "-",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1cmtL3ViNb-o3CFVQw95Nuwr3cOdg_z3p",
              "solution": null,
              "nQuestion": "1cmtL3ViNb-o3CFVQw95Nuwr3cOdg_z3p",
              "nSolution": null
            },
            {
              "id": "4b9e53a1-4367-49de-bb68-1e9887e36ecc",
              "name": "Spring Mid Sem Exam",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66ff00d2f740b2b3e5002dfb",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1N3vsAm2TB4eAeEq2-QADDDwNY7eLiTw7",
              "solution": "1dA5S_75LhBZ6aRCpaFbgzS8hTZ3szxF0",
              "nQuestion": "1FCDHfUTg1suOkyIwN6V2XuDelmGdN0-R",
              "nSolution": "1BdiAuxQRp19x5yCCOOT9oRiC0pybZR5t"
            },
            {
              "id": "63bb158a-c00e-4a4d-9030-7bfe2690319f",
              "name": "Spring Mid Sem Exam",
              "year": "2021",
              "type": "Mid Semester",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1f23TXUR72M__DHr3g1FbqPKgNpcPmtl0",
              "solution": "1f23TXUR72M__DHr3g1FbqPKgNpcPmtl0",
              "nQuestion": "1f23TXUR72M__DHr3g1FbqPKgNpcPmtl0",
              "nSolution": "1f23TXUR72M__DHr3g1FbqPKgNpcPmtl0"
            },
            {
              "id": "8510d16c-7b90-44e2-b5ae-644dd868c900",
              "name": "Set 1 Autumn Mid Sem Exam",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66feff59f740b2b3e5002df9",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hp9q-qQGxPrt1X6Xbs68jVGs6GZp4e4f",
              "solution": "1UHK2JvLI1Kx4jY6IYrIhdgnBCF-NO2PI",
              "nQuestion": "1kKL9RokmgUqzllno_boF7EsFeiDcXiBd",
              "nSolution": "1yKHfnK4m8phOibxOYEeWF1HY_4JouQuU"
            },
            {
              "id": "53b2973c-9f90-4149-a5ac-28ba666f6ef9",
              "name": "Set 2 Autumn Mid Sem Exam",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66feff7ff740b2b3e5002dfa",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "18mk2_QekWq4a9N5-L_58kc_3z3kmVdIu",
              "solution": "1ZN_mhuPVLhC_iY46pRMmnQuiOP_c4le6",
              "nQuestion": "15sw2WHTQwuazcEqg9Mn4wi2NMlWz62ZT",
              "nSolution": "1cXY_EiMz57Ix8fMYzVYgFz7NA-7JQtwl"
            },
            {
              "id": "5c124253-cf05-4b87-b5dc-0a9ec7258add",
              "name": "Set 1 Autumn Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13_LsCWu5x2r06MNI5bzoHsYUaH-vZAc3",
              "solution": null,
              "nQuestion": "1lKFnLJ_qZA7JDXHR1ENFtH-tGyNO9pWd",
              "nSolution": null
            },
            {
              "id": "82189349-a2aa-4217-b764-fe62db161d00",
              "name": "Set 2 Autumn Mid Sem Exam",
              "year": "2016",
              "type": "Mid Semester",
              "status": "APPROVED",
              "solutionUploadedBy": "66fec295f740b2b3e5002df6",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11bABpJkeMUbdrpRdr5pgJzyA0x0CUhon",
              "solution": "1j8JkJ_VqwTNNTbaZruS89-8lQqioj3Et",
              "nQuestion": "11bABpJkeMUbdrpRdr5pgJzyA0x0CUhon",
              "nSolution": "1PHidH4YxYKP2f6EGFgCzRRFzTDqRQf6o"
            },
            {
              "id": "fcce1a1a-9f85-4f5a-a563-f6f3a9ad0e83",
              "name": "Spring End Sem Exam",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_pfC23Tdh-c6RxrLrApFJ_eI18MZp6pH",
              "solution": null,
              "nQuestion": "1grsWK9HsQrdiseZnIxPIDX5FtM-t3_gt",
              "nSolution": null
            },
            {
              "id": "af75a2ce-e21a-422a-98a2-2cdb538025cd",
              "name": "Spring End Sem Exam",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661a6140a909c6db59a4201b",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DZUMA6rsnX52ti5dBf6olyC79bUuIyYe",
              "solution": "1GUCPkvDzJ-HOYrnmZrbN1Y93svhHbZ87",
              "nQuestion": "1OHRsbSHAeOdxHiHS-CizMIffLRfbjMkl",
              "nSolution": "16vD59svhgewlsNXWyFDniZylhVDOkE-O"
            },
            {
              "id": "901b8905-61b4-4af8-bc09-afcfa2d93451",
              "name": "End Sem Exam",
              "year": "2020",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1IolcA3C7yymJ2hB56ALlbCO1NnxUTOPc",
              "solution": null,
              "nQuestion": "1IolcA3C7yymJ2hB56ALlbCO1NnxUTOPc",
              "nSolution": null
            },
            {
              "id": "5a6f20bb-6898-480f-a503-b6e09a841c9a",
              "name": "Autumn End Sem Exam",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PUCTJOyhgR71lT4ROKScEik2fe2hNFKn",
              "solution": null,
              "nQuestion": "1i_Pp-e56MUXguwXv3pqR8eKKLw2JcSmL",
              "nSolution": null
            },
            {
              "id": "fb2615e6-527e-43b1-87a5-08f144facbd2",
              "name": "Autumn End Sem Exam",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BECcAQQjUPHyLjgFa2Wh-dRzTZJ_jvRX",
              "solution": null,
              "nQuestion": "1hp3WyvBp-20J663R9MSVxTiwR6VpPXqz",
              "nSolution": null
            },
            {
              "id": "d8be294b-08d4-4054-ae3c-531691d27463",
              "name": "Autumn End Sem Exam",
              "year": "2016",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11k5KdibzGLrvjZ7ZtJ138Md8mgfqHHyN",
              "solution": null,
              "nQuestion": "11k5KdibzGLrvjZ7ZtJ138Md8mgfqHHyN",
              "nSolution": null
            },
            {
              "id": "13832c39-525f-4f84-b5b6-865015f47f04",
              "name": "Autumn Mid Sem",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d77b290fb947f5b2547ea3",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HNHk9-rzECGpOWXQKTqaULD9zB1YuP8P",
              "solution": "1J6r3jXuieVD0wKIiSNwwt82tXTSAsBeO",
              "nQuestion": "1tca6A2mLRPem7rqR43d64dTJ78E1FQOZ",
              "nSolution": "14yb37NnhsmCUIjP3EjE4LXtvilyaFxbE"
            },
            {
              "id": "1c2e1ee1-d531-4d5d-9f3d-a6cc9e403ea7",
              "name": "MakeUp Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66ff029ff740b2b3e5002dfc",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-WaieIS8dH_CBMfJnuULVYk_QWqfgMq4",
              "solution": "1TfCCLPxaK7XcqPtERAI-Gg6aCml5m1UK",
              "nQuestion": "1IIFzz6UnaMhOyEVcVZo4cEQa9AvlRvKD",
              "nSolution": "1NrxPBYPELuiSw8EOLkmuFM6hR9kPaKoO"
            },
            {
              "id": "dcc066bb-2780-4777-9e33-655bb9e07db7",
              "name": "Spring Mid Sem-2",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66ff0300f740b2b3e5002dfd",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1r62gTJ-zkMNaqqfQPkOA_8OIXKVFCUbM",
              "solution": "1LGYjc2_iUTpgffW02VOI7jrFgqC-JxXJ",
              "nQuestion": "1PO5MuITw9fkXGNAb2ZfbcxpZSehhOimC",
              "nSolution": "12tvLpCBwZ-fwUE2E4Uhfvs_i5dDnvedb"
            },
            {
              "id": "038abe43-eaaf-4df5-ade6-c873711956b0",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661cab6fa909c6db59a42087",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1MK60nBHgjocpMsWmaLw1jlycbsmB7hjp",
              "solution": "1dSV2m0yjGZngvSyRUb6tjkzYyJchB4L_",
              "nQuestion": "1t3b5_iboS-8ndVSwGdEG8EzCHMuS5MVH",
              "nSolution": "1ps-QRA5QfQ2nDutY2SEHqQ8noprLtpww"
            },
            {
              "id": "7ea69ecd-dcc9-4278-93ad-1ce6ed1f2865",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661aef6aa909c6db59a42051",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11Z62gz3WsHFD-S5oXTKXSROUuwLp2Knk",
              "solution": "1fVR6mVOeaH7PZB7mOfhpd1PvqBqgCmEC",
              "nQuestion": "1dwffg11FT2Pa0S92LlOhRQJX1Llp9Qwi",
              "nSolution": "14j9CsJZHW-414NvrHZ96B9JXWt17ugOW"
            },
            {
              "id": "62b0e6c7-3979-495c-98b3-cb9705a7edfd",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1AIklsgKS1fpg-WRVGGzC_IGAp_o8WO-Q",
              "solution": "1SB4mrxBGAux7uyRYcFWngJz7NlRbPwu9",
              "nQuestion": "1CntgE6AG89eXUz5ktQRzLB6MUktbKGqN",
              "nSolution": "1CwX5-8bYjsjg6tuq6GXyXNsLJiyYJ-Cj"
            },
            {
              "id": "f22a6ba0-12af-43b1-a959-cd97c062b904",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "668cec0397969283509b07ce",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1z3oGCrZDvUFUA5aJz5p83hOk3DxM8dbr",
              "solution": "12Hca42iiLknksGgtb3t4-eNbgBrXsNMW",
              "nQuestion": "1rqwRMgLHpq7RDSyH8Ns9WMCqZl0R5Qwk",
              "nSolution": "1hU-zeE-ywJr7leFzkhfCOjmufF7RlZcY"
            },
            {
              "id": "1c0fe771-c8ff-4a6d-9cb5-33606e9007f4",
              "name": "Spring Mid Sem",
              "year": "2025",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1KV7H8_ElYItLkj7oOTQ-RpPBHgEb1Wby",
              "solution": null,
              "nQuestion": null,
              "nSolution": "1z7Po6ObpQ4nVWoFcBVgro3uhbhSk2NhU"
            }
          ]
        },
        {
          "id": "65d221b01bdc9aab4133880e",
          "name": "Software Project Management",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1WB2RqjXJJtMDRlaiVORwUMefP7af0bs_",
          "pyqs": [
            {
              "id": "b4a15f72-6e2f-43a7-a4f1-1f403b0c2ba8",
              "name": "Question Bank",
              "year": "-",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "136Qr1YBlTD0CK6oWcwrDFD7JIHmCFS_O",
              "solution": null,
              "nQuestion": "136Qr1YBlTD0CK6oWcwrDFD7JIHmCFS_O",
              "nSolution": null
            },
            {
              "id": "8a511314-4350-4787-b0ad-75c1980c16d1",
              "name": "Question Bank",
              "year": "-",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tjJqG3X88ne0LICknKxfLYOSwIwkpdSh",
              "solution": null,
              "nQuestion": "1tjJqG3X88ne0LICknKxfLYOSwIwkpdSh",
              "nSolution": null
            },
            {
              "id": "9906737f-f278-4859-be8f-0873f6984e49",
              "name": "Spring Mid Sem Exam",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65e0b688cc176893883e4891",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1cAvhzV0dVXzj8tzBGa7YUXf-14n2uYWP",
              "solution": "1pjkEDX_62S3p7kqya9qIiE6DFHnVjsx6",
              "nQuestion": "1qGpOx5_C_CQGC9vet5UPDomGkpULaw7p",
              "nSolution": "123uMNFbAlJm5Nhljh80ZijrMxrTRDUEP"
            },
            {
              "id": "710a82c1-6a47-441b-9ea3-aa47a4bc9fd7",
              "name": "Autumn Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66ffa49cf740b2b3e5002e05",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1S4QdCl2ab7JEmGBje7emynlX0Lw1JONJ",
              "solution": "1IguZQSZ90uf-V9cjR2Hk6lkGJuk71mN6",
              "nQuestion": "1Y10CYtip6WYy2wLKWqlcdpU0qlQ7Mt65",
              "nSolution": "1PPA6wJIJslR424oEX-WJW0xR0Ud1tQz3"
            },
            {
              "id": "409416da-873c-4e66-aa46-097b189d12da",
              "name": "Mid Sem Exam",
              "year": "2019",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1WtJVzTdnhNIBz_yP_A-K9-wiv-09l-_9",
              "solution": null,
              "nQuestion": "1WtJVzTdnhNIBz_yP_A-K9-wiv-09l-_9",
              "nSolution": null
            },
            {
              "id": "c9cff2fd-dc52-40a0-9e14-ef1a9f188808",
              "name": "Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66ffa1eef740b2b3e5002e04",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1XY6-0VVcS_uZ065MY5Iapx46iQ5-fEIQ",
              "solution": "15FB4ta4XQ_Fqvwnrf-uaoCVP0q-sHMH2",
              "nQuestion": "10bLoY1C4-0Dm86j2lMCFtTJKpThlVIF7",
              "nSolution": "1oIxDaQAwT8CK-W-mdh1Tjkj_0HaDC2xx"
            },
            {
              "id": "1294964a-f2f9-4258-9d3b-0b4953205415",
              "name": "Spring End Sem Exam",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1GoHs_uLYrngavYRCnKbgYtRQCaDjpD7g",
              "solution": null,
              "nQuestion": "1EN8k2UXgHaTAlpHqkfxbrIUFST9NsMXu",
              "nSolution": null
            },
            {
              "id": "88761a4b-e299-4831-962d-71f60f60e0e9",
              "name": "Autumn End Sem Exam",
              "year": "2019",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1G0QOhnp4mpG3GOwB4qbyydwYNsSbsc0W",
              "solution": null,
              "nQuestion": "1G0QOhnp4mpG3GOwB4qbyydwYNsSbsc0W",
              "nSolution": null
            },
            {
              "id": "faf4eb62-b246-4b28-9bb4-afbf863b3327",
              "name": "Spring End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BXnRzPAT6aWp7x9g0oa08_h0B1spCux0",
              "solution": null,
              "nQuestion": "1ZCOkIDzwkR3crsfKLPqsPRCMBsqeD5o_",
              "nSolution": null
            },
            {
              "id": "9eac113b-11ee-4f6e-b828-32ec7c711d30",
              "name": "Spring End Sem Exam",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1UtVBdTZNbyvkmh7zo_lvhCHQ6ddk5Zhv",
              "solution": null,
              "nQuestion": "1Dm101lnZFs6XaBey1kZw7tbV-bAGU3fr",
              "nSolution": null
            },
            {
              "id": "1a3ee580-ed9d-439a-a78b-516dac3cff5d",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kCsDcRtFwbgRpCU-xZtr_FpcXN21zDGH",
              "solution": null,
              "nQuestion": "1QeRJDL03TzIOiyyRhzeQ5qJ2a2xftN1H",
              "nSolution": null
            },
            {
              "id": "a2184aee-9003-41f7-8bf2-bc85b0432c4f",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1zXlcO6NCwDyjDi41qE-kpIRGyPq_Yd7l",
              "solution": null,
              "nQuestion": "15tyRwtqStngEk50ZveKUo2F4xEknL10-",
              "nSolution": null
            },
            {
              "id": "f00337ad-5e0d-4bff-aef9-20a3157ef404",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ZNlTw4gihugx7tAw2aY77Lo7o0FovSDd",
              "solution": null,
              "nQuestion": "1LsMg-FlU13EOBFX388KVy_oC2WY8R4Vc",
              "nSolution": null
            },
            {
              "id": "819ed65e-f229-4134-a672-a5bbc5d6a880",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_aQxBAyj0LhLFEM3oIW9TeGfjwlNqBx0",
              "solution": null,
              "nQuestion": "1rjFEnH0Co1LtzsoJbNJmo1Zh0OLycQ0r",
              "nSolution": null
            },
            {
              "id": "7e3a2fd9-3221-49aa-8c30-b5688aa7f9d6",
              "name": "MakeUp Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1dsoeBDw91tA-nvTifZ8xz0icJXRpbtiq",
              "solution": null,
              "nQuestion": "15kCAxXZnc7F2aQ9BAWBAROLuv_QD_tKE",
              "nSolution": null
            },
            {
              "id": "ea725a22-0f26-4416-9c9a-ba132cbb7afc",
              "name": "Spring Mid Sem",
              "year": "2021",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1mAY3NZ-INJYQ1VW8lGdn_1heGCGAVH9F",
              "solution": null,
              "nQuestion": "1eBev7uRjWw996F-IqySPlKm0dViIuVXV",
              "nSolution": null
            },
            {
              "id": "84b37b31-3a08-4d33-834f-45e458181b68",
              "name": "Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1AzQCu2BEy9L_SaqOLk_GFHiRXBeIEizi",
              "solution": null,
              "nQuestion": "1FO5XGnHrRBcrMWokGdPnH22-d6lrHyOl",
              "nSolution": null
            },
            {
              "id": "b0653262-4144-4a94-b40c-08d2e0f530d0",
              "name": "Mid Sem",
              "year": "2021",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1a3PmrpDbSmlf8ZBe4huFkTlNU3s3J9T-",
              "solution": null,
              "nQuestion": "1fcSpC_0rKWl4A-2yiYkazLjo-_lDh9jL",
              "nSolution": null
            },
            {
              "id": "51150496-7f9d-47a1-b8f6-06bea6728837",
              "name": "Spring End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1qw9gYMZWXyOBOdHbJBQmDnPXh8F4IlTo",
              "solution": null,
              "nQuestion": "1TrFq3wQRXs-Gb8pwFwO191xJ1z-m8mOY",
              "nSolution": null
            },
            {
              "id": "c1fdd1e2-bcd2-4004-a4f9-f096220c3b76",
              "name": "Spring End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1t1mAyX1ESxSS6RkObz6ehlLxVi73l-IB",
              "solution": null,
              "nQuestion": "1TI_OiRbUVZwzCgoXxC6a7JmW5wJHlVuj",
              "nSolution": null
            },
            {
              "id": "7b9d6281-9a55-433d-8e56-92053d95c791",
              "name": "Supplementary",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "182E7eOAXeF7nFDv7yBnMDo8qsH12t6KP",
              "solution": null,
              "nQuestion": "1TiAuw1ny3lnh1qUCJ1lVrJ0HufGo0el5",
              "nSolution": null
            },
            {
              "id": "d9aa5fd2-217c-4f2d-9d9f-46c09c2c9249",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1CXmOV0sgweQmscVRMCbxcC9ZJ8E9UnkR",
              "solution": "1_yvYLug_06PxMAyqY9_9lIuSq_A9QuVX",
              "nQuestion": "1p9Agzs_lRjP22Uee0Yatq4yPma0a4wzP",
              "nSolution": "1iyZdRbhcwsUEQvbULzM_MPScBuzKJLYC"
            },
            {
              "id": "6402767d-0c7b-48bb-8fda-e0b57f6bdc7c",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "668cec2b97969283509b07cf",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1INXwpx_-VfPz7lB7IjimIbjuJlSfmH3X",
              "solution": "1pgxNpQMgJJz6zQQgxay89AHb1HQqJKp7",
              "nQuestion": "19RwPaZI5ty9uqKquicO5362P-WyWlf3_",
              "nSolution": "1Q3SWPn1ly4NmAuADm969Q7dZ60rWoWP3"
            },
            {
              "id": "cde9d9c5-9e7a-4224-8574-fd9b269729b2",
              "name": "Spring Mid Sem",
              "year": "2025",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xwLg-t70ViXbBxEn9lOtId9XLWJWegzU",
              "solution": null,
              "nQuestion": null,
              "nSolution": "1Tj34qrloFBTnWp18pn_D90abEWtB0ng3"
            }
          ]
        },
        {
          "id": "65d222721bdc9aab41338810",
          "name": "Data Analytics",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1aa7g6m9e7IHOS98ZA9T4S1z1mJ0eW_Pf",
          "pyqs": [
            {
              "id": "c5e02e80-8edd-4671-a25b-e8c73152d787",
              "name": "Question Bank",
              "year": "-",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1v-al-sgiy2jzdd_h6S9csYQLMjkVdROl",
              "solution": null,
              "nQuestion": "1v-al-sgiy2jzdd_h6S9csYQLMjkVdROl",
              "nSolution": null
            },
            {
              "id": "9d8eded8-34f7-497b-b6d7-6c1e45b89e4d",
              "name": "Spring Mid Sem Exam",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d90b360fb947f5b2547fa3",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Wbh1G78VK9_UOjTGvyFMQusYk4cbwkEh",
              "solution": "1p5w_64lyN6bNL5tvyWCl8HSQHchJvYqz",
              "nQuestion": "1HUXlV2Xl5yX2qjbsK09LzJ3SB9KuJeiN",
              "nSolution": "1v9BS_qf51lm7NhHoHsUPsMX1chY9ctBZ"
            },
            {
              "id": "2c66fead-e70b-49e8-876b-fbffc10b4fd8",
              "name": "Spring Mid Sem Exam",
              "year": "2021",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "160mQtdLtydNbqLoieta4TtD91Y2GgSAI",
              "solution": null,
              "nQuestion": "160mQtdLtydNbqLoieta4TtD91Y2GgSAI",
              "nSolution": null
            },
            {
              "id": "7eba08d7-4e64-4e32-9d3b-2a9fe804620c",
              "name": "Mid Sem Exam",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66ff9a76f740b2b3e5002e03",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PadA-7mfCEnJvDhsCheD6zM1rnB8SPN9",
              "solution": "1pjDyQZBWY5abWDr7MVmjHIwIbtGmrPfa",
              "nQuestion": "1Ee0nEwYthOpFRD1oUaKdHmYsyknmCABX",
              "nSolution": "16L7fZuSnnIVGvo4JUMA0RkwD2RNMPOkR"
            },
            {
              "id": "24dcea0a-d8aa-41ee-9e81-c9de698eae91",
              "name": "Autumn Mid Sem Exam",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1N5LSnbMFkbOTCb70n_qQrTT00LCESktx",
              "solution": null,
              "nQuestion": "1-lVLjXe7kgh6uVEx9UE2xt1hNCmhLm6W",
              "nSolution": null
            },
            {
              "id": "e1ff4bab-4af8-4a65-b327-189a1e2ee1b4",
              "name": "Spring Mid Sem Exam",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66ff833bf740b2b3e5002e01",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NP7KLg-7mO4KDDClx-ybgajmY2x0MhSL",
              "solution": "1HtSlnS_d8A0jW9uH1d_MoKnwgA2h6rWc",
              "nQuestion": "1uuiq0e8ggZg6nbVdCgoLwYymHGcxeblW",
              "nSolution": "1Oe_HfDR-URu42Ub6QonCwC3zelumiIkV"
            },
            {
              "id": "58b2e1b4-b46a-413d-9507-dd2bd08fc3ba",
              "name": "Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66ff043ff740b2b3e5002dfe",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1001gnAgUwBDghzcfg9fwX07hY6RotoVL",
              "solution": "1LN9PK-oxBKrVEv_4xnbSNgMnkMzBq6_z",
              "nQuestion": "1-DWpoouSyWM65tVUsVyz7CCtSmebJfuJ",
              "nSolution": "1G70t6_jaECi1UzSZlsrfG_fYrPqFZ2y0"
            },
            {
              "id": "7682d0a1-e052-462a-abac-62d48b99a14c",
              "name": "Autumn End Sem Exam",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1f7dFm60GGT98rN-CfrR3tRc9H5VzLxAE",
              "solution": null,
              "nQuestion": "1fn_AvO5etByUOGNJ6yrRLflswsrrtPf-",
              "nSolution": null
            },
            {
              "id": "24e78625-52ab-42e5-9491-254e390f2e95",
              "name": "Spring End Sem Exam",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Xy2xrLa8xN8QKqt9tn9KI8U-GQDANnOl",
              "solution": null,
              "nQuestion": "1EE-T1Omq9hqTWBklBaevJM0Unpabyrja",
              "nSolution": null
            },
            {
              "id": "74a1d8a1-070a-42b4-a2e3-714c3affc52b",
              "name": "Spring End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1LjuWigmVMFVCs5nezTcQQ-FqsAipktsu",
              "solution": null,
              "nQuestion": "1A_hghz7ig35na4F-aBmom2k_o0j_AYSc",
              "nSolution": null
            },
            {
              "id": "a7d18ec9-9e08-4457-86fe-f702b904e962",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65fc7e38ece362a62c15d4c8",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kHk-rUMQ5wPrt2pEHJOF9-JgrLbnMT6U",
              "solution": "1NlYauTFxZ_kmTsTP9CDsfx2rgc67AVKf",
              "nQuestion": "1ZYob7HkreSMlXZiHQHQV9pjjFSOzKKCs",
              "nSolution": "1bTStFbLkpWxqL7PPrlOOyqRqHYtt-5ub"
            },
            {
              "id": "2d5700a8-840f-4038-80f9-03578c8c740b",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PFo-8OYj_nNjdowErUA4yWHFJDAz49wy",
              "solution": null,
              "nQuestion": "1Iin1T_o06esQ9YRFDgfm3Ud8HrNvaevF",
              "nSolution": null
            },
            {
              "id": "8c80e029-7264-4040-8968-3b6b0f9e0e22",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Z1wILQ0ceCBFQFUmhsS2Q-40FzEK4dEN",
              "solution": null,
              "nQuestion": "1Aoc2brYI8UDz7oKRkJI2FjKtmKBc3wis",
              "nSolution": null
            },
            {
              "id": "36ec7580-9a3b-4028-b377-7ae061f6cebf",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65fc8f99ece362a62c15d4ca",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-MLuT4w80qKiKXTbbx73tb8J8Mu6Rckd",
              "solution": "1W7ENeGEzdwmcFDeoYPVcfByisfjenHiw",
              "nQuestion": "1zRwXDnZe9u8zN6L4rKkzCGTL3Eo2bCCh",
              "nSolution": "1lt-PWx8JHE6mN9Ir-oOXzU2ytxsitYsn"
            },
            {
              "id": "cd35f253-a220-4f56-89d5-b88d33f7f6d5",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65fc85d4ece362a62c15d4c9",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1T-h_G3iO1t8GMHBkqyjyphTAUXgb84vu",
              "solution": "1xVFd6HJXWQtbL47zypFzFWz0YGGM0ZGE",
              "nQuestion": "1Vn7Id6ac1eMQwbqSWUmjTrWw7vS0DbMn",
              "nSolution": "1VGw_66Xa5xA1lpxfcaa3ZP4byyVU2dFl"
            },
            {
              "id": "3d054ba2-fccb-4bb0-8573-88f17b3b4b7b",
              "name": "Question Bank-2",
              "year": "-",
              "type": "QUESTION BANK",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1WccKG4kl03ItNgKLE89IrwyfYkd1vIGD",
              "solution": null,
              "nQuestion": "1T6v4EHKqRdkk8aXVAQswOM4Ln94KbYQu",
              "nSolution": null
            },
            {
              "id": "7cea234a-32fc-49a3-8519-74d5f6671c24",
              "name": "Question Bank-3",
              "year": "-",
              "type": "QUESTION BANK",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1gnWRGV4XS1h9BQRHCg0Xj1BphEq1WP_E",
              "solution": null,
              "nQuestion": "1UC0NxVw-Rvpt1OS0H-mT-DN69rmuheKq",
              "nSolution": null
            },
            {
              "id": "92aa6385-5e7f-41c3-82c6-aa7374812260",
              "name": "Question Bank-4",
              "year": "-",
              "type": "QUESTION BANK",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1O-rBwFLf5-Xbm7ytrNBgsByqEZxcMa6A",
              "solution": null,
              "nQuestion": "1VjRpeucvhqj9hSmIiXNJb0-Goj39-Bnq",
              "nSolution": null
            },
            {
              "id": "e3f7965a-4870-49c6-8d8f-c0cab8478b25",
              "name": "MakeUp Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66ff80f8f740b2b3e5002dff",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1mYH7XIRY-tDFOhfEzqHLx82CacrVI1eB",
              "solution": "1p110tDc_UHv-x29H2i2bi5s3ZLtd80zb",
              "nQuestion": "1VhGX9J6YTI-wIyjeUhHnzU3PSU3Hw01U",
              "nSolution": "1kT0EJn_vLMNE8M9o5pyVmWKqEiZPRKca"
            },
            {
              "id": "a5a99443-0652-4de6-8545-dfbc601f79aa",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65e1fd11cc176893883e48be",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1vIwTf_Ctd6rI_L-9jkB75n0KpuK8crZ0",
              "solution": "125YX5YebUJB_JZzXwPp2HTM1gyIewGxC",
              "nQuestion": "1KJwzRMwFNL7QIomwjW4kcHPcMICKCsLi",
              "nSolution": "17OdRqkut9jB343u2-uB8l6kd0k-GZLzB"
            },
            {
              "id": "60b5e6c3-eeb6-492a-9bf0-f21f6cf1b45c",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66ff84b9f740b2b3e5002e02",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1LMZf_Iw9f6A0LB7ZwEejWM-LqZOpthsT",
              "solution": "1cl_Tsdb2ef2VqUYPxbpOkCSma2bJnyyz",
              "nQuestion": "1ZJsR8hLUGwtEn-HkqVl3DcXfjvh9ZvMh",
              "nSolution": "1wfYALIObaqEgRj8j6oGtdInkq6rEIAc9"
            },
            {
              "id": "16e94dde-80ce-40c7-931a-8db72895fb0d",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11S1WWriZPSU-u9Qz-rKpP2SSckLpxh2E",
              "solution": null,
              "nQuestion": "17ojVAK86adFIANikUpElCt7KvJXPLUIs",
              "nSolution": null
            },
            {
              "id": "86f753d2-6bf1-4d42-b570-b9993bd39e01",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10kFR6g6wLHCAobx9nwb5L9K3C82rq_sI",
              "solution": "1pL-O7sjWhzwLzK7oCkZmGTPvgp1ncihY",
              "nQuestion": "1gCbBxsI2yyqoSZALY-MzUI2G6jY3z49z",
              "nSolution": "160knXhhLZa8KT5B16hosR4cIkj_ceLhz"
            },
            {
              "id": "c15427bf-5931-4862-b136-ee579c7f369c",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1vz_csyX_mKRtmMnl72EWHm7HURZdB52F",
              "solution": null,
              "nQuestion": "19_U422IpbOC26jvS5R8Cju26Xa2A_Lho",
              "nSolution": null
            },
            {
              "id": "ee23e7a9-13c8-414a-8312-c2aef69e547e",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BwrtlejpId3eMSUwhl1W6uT9zWp4FKwY",
              "solution": null,
              "nQuestion": "13UNzRSH8fYI_vGhENtGmqPowdMhCyVzn",
              "nSolution": null
            },
            {
              "id": "5a195f59-cccd-4d71-a575-5be628f2f24e",
              "name": "Spring Mid Sem",
              "year": "2025",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fw8GCnZJezEF0hW9fZciDT5fVK5BpYUE",
              "solution": null,
              "nQuestion": null,
              "nSolution": "1joObdrw3ijPUebr4oFXMoYL36Ub_p0jx"
            }
          ]
        },
        {
          "id": "65d222721bdc9aab41338812",
          "name": "Internet Of Things",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1tXWyqCsnf4whXjOVbvWfvB-ERkWecKCI",
          "pyqs": [
            {
              "id": "3e070583-98a7-4ccb-9912-12b2c91887f3",
              "name": "Autumn Mid Sem Exam",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66feb52ef740b2b3e5002df0",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1reUxAD0LdTt9cEPBZnLGIoFlqzRuVrJX",
              "solution": "1DQiIwxw28c6lH6IVouHhfY_PD4jTsAUl",
              "nQuestion": "1eIJXv13wzQNR1TAYmCgzgk-b3gNBBquw",
              "nSolution": "17b-gu8FugeqKu26uZKt_U4htBC8zIJVk"
            },
            {
              "id": "c509e127-82fb-4158-b8b2-d639741bc419",
              "name": "Spring Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66fe93d6f740b2b3e5002dec",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1w11musragehXRtJm_5KAoYllgM9kHGY3",
              "solution": "1O53nevh8zYzYwySruP3Bu-Fvq0jAmF_T",
              "nQuestion": "13tWlPIiWIOYFdJt57r1x1lTWk43RXl6A",
              "nSolution": "1PDAh73PbeBv1u07D45VM-OB-FUKxsm6J"
            },
            {
              "id": "f12129bd-e129-4030-8d7e-303f42aa6a1d",
              "name": "Spring Mid Sem Exam",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66fe90d5f740b2b3e5002dea",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1f0EocupwgbBt1EOsb9N3Ku8U6lnS3qQ6",
              "solution": "1R_z9ciTsJ-YJODL_J8vdSp1LcKsq7zsa",
              "nQuestion": "1t2JuBHshWglEUJW8ok_0fT2BFKi1Q3k9",
              "nSolution": "1PA1ANgAEJJG-kCHSzCl0SkaDCks5DKMK"
            },
            {
              "id": "9a0b43e7-50e3-49b3-b657-d78c4f9bec81",
              "name": "Spring End Sem Exam",
              "year": "2022",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1EKt3QcNbKDGONrV4_y4-64RuS2g6kjmL",
              "solution": null,
              "nQuestion": "1EKt3QcNbKDGONrV4_y4-64RuS2g6kjmL",
              "nSolution": null
            },
            {
              "id": "0b823d4d-4548-4274-af96-b90f199ac68e",
              "name": "Spring End Sem Exam",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1FutC3cMGIw5ALkpHtoMEBvh9Y-EzV6e9",
              "solution": null,
              "nQuestion": "1EtngmYsmzRKJqzmeR9IhdBJhCI0SVsr0",
              "nSolution": null
            },
            {
              "id": "b5f0e669-6efc-478d-bbe6-c2d0e33243d8",
              "name": "Autumn End Sem Exam",
              "year": "2021",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ZUG-sMiPDI3RveFF7vIgD6OxMLOCk3Pu",
              "solution": null,
              "nQuestion": "1ZUG-sMiPDI3RveFF7vIgD6OxMLOCk3Pu",
              "nSolution": null
            },
            {
              "id": "7b50568a-cc0b-48fc-9e18-577dfaac2427",
              "name": "Autumn End Sem Exam",
              "year": "2020",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1oNgyq0eRYZ3wZlfAqdVmvr-ppjst8zmN",
              "solution": null,
              "nQuestion": "1oNgyq0eRYZ3wZlfAqdVmvr-ppjst8zmN",
              "nSolution": null
            },
            {
              "id": "8efbea62-a827-4926-83ee-2beca35710c6",
              "name": "Spring End Sem Exam",
              "year": "2019",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1abQr-otcopehEr6S5H7JOhPyL2Rp4eq5",
              "solution": null,
              "nQuestion": "1abQr-otcopehEr6S5H7JOhPyL2Rp4eq5",
              "nSolution": null
            },
            {
              "id": "cfea272e-5c7e-471a-b1aa-c3c386ae59ec",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66fe94d7f740b2b3e5002ded",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13-WkqehcfNMrLAaJgaTVr1VWsS1rqbli",
              "solution": "1n3OfNdj4-OQP9rss33PxNmT7RxPfMQI3",
              "nQuestion": "1SVP4S_XjSmxuVFfFMAtvb9tDcPxk7mwB",
              "nSolution": "1OH3ohITai3gGwIwWYlKPhi7LcmICd6jr"
            },
            {
              "id": "e824ad17-b3da-4606-b8b6-6781852d8547",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66fe96d4f740b2b3e5002def",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1rZhULgrFqDfrMNVuoRWIEwF2ixR-ebWG",
              "solution": "1tcRRuu1BW6KKjVZDGu34wllPxrsnu4IC",
              "nQuestion": "1kBveTLZNtLtIiwMivoxPKjpbp_Wx836e",
              "nSolution": "1su_pH25Bi-RbwnaCdd4ee8vKM2Wcj2TM"
            },
            {
              "id": "73db2b5b-3e16-40b1-833b-77d9138f2cd4",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ds1lHtzlBw-4fPMKxGValY0fBf8-JZ0Y",
              "solution": null,
              "nQuestion": "1rcT5diYqpClgzOS5R7YxKsW-ANKK7zao",
              "nSolution": null
            },
            {
              "id": "ff6a1c60-18b3-44ab-ba92-86db7fc9950c",
              "name": "Autumn Mid Sem",
              "year": "2021",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1uKlyvEjJgR3keasU5nL748a-EG2iEzNj",
              "solution": null,
              "nQuestion": "1J4tA_ZgB-Umfyo7YIaWz_K-NmLqBAJ87",
              "nSolution": null
            },
            {
              "id": "b472a781-d935-4932-b376-016a440d0d30",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d7159aa226064c68a248e4",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1qXjwYhnEoEBSJdJ5NAX44u_dCDTt_jMb",
              "solution": "1GVn3bxl2_0wroPqbEa-sAz4aBRFXyj6j",
              "nQuestion": "1IpywHJ8cfiWLgFyHIbRRlycimPJ0ULkY",
              "nSolution": "1QXLxfa1m-1pyej1qO7O0TfiyxFGWjr9z"
            },
            {
              "id": "d8694142-bf54-4f04-9f98-a0b2d87865d0",
              "name": "Spring Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66fe9286f740b2b3e5002deb",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "139XpHrWc43gLPMORMZbskM8TEHn7dGKN",
              "solution": "1iNFQ0u98XblQ2_RrMR57v_fex1QqeGuG",
              "nQuestion": "1-ADIQn8Gy58EqNIIYWgPZJg0XF7GYt2z",
              "nSolution": "1K2dNODqC0u9bzipVerDgt5XMdc2rhJ9J"
            },
            {
              "id": "e1f938c7-bb0b-497d-870e-88e8f82a1612",
              "name": "Spring Mid Sem",
              "year": "2021",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hqPaOFDHzJfCD3Z52sdJ3RMMk9uttgHr",
              "solution": null,
              "nQuestion": "16e8C-lvhRRU8oDGf34-1N0klrLxk_c6d",
              "nSolution": null
            },
            {
              "id": "217d481e-cc42-4fdf-b637-f65502c6f332",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66feb6c4f740b2b3e5002df1",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DQhFXZ1f-a_zoVIjyRTc2miBDX2GREVy",
              "solution": "1E1vpVp6hyJbbmYK4I-x81X1jJmEYgWGU",
              "nQuestion": "12REEXOTnVC7gRV5JKKvZhc-fddiqBHHD",
              "nSolution": "1VtJNh3TmmSpLbsZnk7jvIi5oe-I53Fbx"
            },
            {
              "id": "93c44745-ae98-4f78-bc51-5394429c1c82",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kHCoPAUK65JttroW-0jT7QmlFUs4K6jU",
              "solution": null,
              "nQuestion": "1wDlAj5XFPAXZqtacB3CugFy9oD-ojy0b",
              "nSolution": null
            },
            {
              "id": "d5002996-cbd7-4f57-b159-9d2a519d209c",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NhHFyDxN6dj6EZuEofu4e0sZ5UsRePWo",
              "solution": null,
              "nQuestion": "18pKpIVOzCGuNM2jY8H1xsk71zCoskT2C",
              "nSolution": null
            },
            {
              "id": "c499e366-4f60-4b2a-916b-b7d1f6b0ec72",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1QudoDmQxXdHDMkFro2EnPVKN8u4rg4p9",
              "solution": null,
              "nQuestion": "1GPFjAMNHvr28738JZjWoDeyBuTlUZSUZ",
              "nSolution": null
            },
            {
              "id": "a187c786-5679-41c0-901e-ca62bc87e6d0",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PgT9KepLbi4a1VXQkr3ZHf7xEsno5x8J",
              "solution": null,
              "nQuestion": "1WLgoVKzpVsp38uOf0Es3HxnF9RklVVt-",
              "nSolution": null
            },
            {
              "id": "9fe15f1f-95da-45e9-a042-9e2ac38fa509",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DIty6TAVuOiYVq5YhRSJ-oWCy91pUUyb",
              "solution": null,
              "nQuestion": "1Lb3pooIHckGkJ2E17tOmnkDbDdBZiPTF",
              "nSolution": null
            },
            {
              "id": "3989bf19-84cc-4304-8d95-dd2d3c576af7",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "171M5jeYjjSkMLW378YhjELvIR08gkgLp",
              "solution": null,
              "nQuestion": "1OY07nZal3OMJRxiNKGu0TcDT_7nVVvy3",
              "nSolution": null
            },
            {
              "id": "6b36a792-facc-49d0-9fca-6733c91bb860",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1caeWFa4MNvWYkCVTCEMVDY--RJ_D_wP3",
              "solution": null,
              "nQuestion": "1kmmhC1PByLXVYRjgksO8aoMyjbCQrNEF",
              "nSolution": null
            },
            {
              "id": "f62d53f1-65fa-4c0d-8c7c-398ff60ac7c6",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1GUweMmGvt9J_KBzpUZHMuQKV7jlvZlq_",
              "solution": null,
              "nQuestion": "1XWdcPCrLRRuHYXtZ-ek_wZWHFocEfwvi",
              "nSolution": null
            },
            {
              "id": "aefc8bb5-2b22-4f84-86e4-6a57f26e8b61",
              "name": "Question Bank-1",
              "year": "-",
              "type": "QUESTION BANK",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xJfjqnbtbS2Tt2Aj59m10lxFdyFpiwfm",
              "solution": null,
              "nQuestion": "1MEeZzHlGSSgOr_pH94sjSRkYlvtKd36H",
              "nSolution": null
            },
            {
              "id": "0a7c05e7-c482-484c-81a5-5797247f0b85",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HPLxUaMTkxqvP_wDpG4R7O7KzDpKgf8Y",
              "solution": "1j_Dtcxlh6d2A-WHmWi6fDlUYkirwv1Fg",
              "nQuestion": "100R89OljeqXUkwaXp7_Ia_phqKlmKFtF",
              "nSolution": "1h17nBKd1ipDS8xRjKx7SmI1ebLNQn0PL"
            },
            {
              "id": "b4180192-9628-41b6-9ba3-2385a3c212b3",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1B9igl9s69Pkb6GRrHBwvkv73V_avU_iE",
              "solution": null,
              "nQuestion": "1mplJRm5cWdeB99MkwhT832oArAo6OHDZ",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d222721bdc9aab4133880f",
          "name": "Machine Learning",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1gB0JzDFuYETCKwZ7A-xhAgXvTbaiFYVf",
          "pyqs": [
            {
              "id": "0865a927-8b60-455f-8f20-f420e43548c6",
              "name": "Question Bank",
              "year": "-",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ncprZKfBQ8MjM5all776PWskasRLQbng",
              "solution": null,
              "nQuestion": "1ncprZKfBQ8MjM5all776PWskasRLQbng",
              "nSolution": null
            },
            {
              "id": "40a92a02-34a8-443a-b8de-a4d4b193a5a2",
              "name": "Question Bank",
              "year": "-",
              "type": "Question Bank",
              "status": "APPROVED",
              "solutionUploadedBy": "65d71798a226064c68a248e5",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "16XdQ16JKOBmgMUm4sToI-7oQybAAMv73",
              "solution": "1WhasoCFsX3hvuP3uaIgHV7v5pyC-ekO0",
              "nQuestion": "16XdQ16JKOBmgMUm4sToI-7oQybAAMv73",
              "nSolution": "1qm5U2HGAkkgQiraUsIDxJUuwha62uSXZ"
            },
            {
              "id": "95ef8e15-d320-40ba-ab37-f75f0c4393b6",
              "name": "Spring Mid Sem Exam",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1FD2M2pc40Xu8JXKfMawkyajKmaT-C9PW",
              "solution": "1OvlqWgQ-4AG1V6qix1f3ogQTDU6j5508",
              "nQuestion": "1CCOh-Pr1xnv3tzciqjhobj8YBuOvUWLC",
              "nSolution": "1OvlqWgQ-4AG1V6qix1f3ogQTDU6j5508"
            },
            {
              "id": "ee6161d9-173e-4ac1-886a-3264627b57ee",
              "name": "Autumn Mid Sem Exam",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d4db911d4b0e2de0baf5c4",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1I2ST7krzY6u6HJNbRBnbFw2pLrAfzln1",
              "solution": "1M7Xj1-9qh_84Imo0C0e09TUp159FLA6k",
              "nQuestion": "1nY11vOiDxyi8Bgy-dlP30ox-UVnisZaB",
              "nSolution": "1uweBJA2eLSI3U8xxDtpsg5i9RfygOM9D"
            },
            {
              "id": "d1d3395f-c89a-4d5f-a389-8c004f67df51",
              "name": "Spring Mid Sem Exam",
              "year": "2021",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1AvGymEfK6mOqGTX3G2piqDjoKttzaQ8_",
              "solution": null,
              "nQuestion": "1AvGymEfK6mOqGTX3G2piqDjoKttzaQ8_",
              "nSolution": null
            },
            {
              "id": "abbb883f-b222-447a-8394-36dd2804ae5d",
              "name": "Mid Sem Exam",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13E7dcaB9vqIcKt9syQKMr7xzzo3yaAOB",
              "solution": null,
              "nQuestion": "1ac7eFDnhkJ9ZSS7D7fWRD3Vehi-IM5tk",
              "nSolution": null
            },
            {
              "id": "186d2a3a-fb3a-4276-953d-533e12bdbc4b",
              "name": "Set 1 Autumn Mid Sem Exam",
              "year": "2020",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1XH75ylBj85un9oSND_BLBX0xg3zlDjnD",
              "solution": null,
              "nQuestion": "1XH75ylBj85un9oSND_BLBX0xg3zlDjnD",
              "nSolution": null
            },
            {
              "id": "566409c1-4010-47da-b3fc-557af09c760a",
              "name": "Set 2 Autumn Mid Sem Exam",
              "year": "2020",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1moYosQlDgZiTioAJbWc7I9EWQAlWshqB",
              "solution": null,
              "nQuestion": "1moYosQlDgZiTioAJbWc7I9EWQAlWshqB",
              "nSolution": null
            },
            {
              "id": "d8edb718-735e-4ce6-a5bf-8f68c0c3d7ac",
              "name": "Spring End Sem Exam",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15h8cdFOFBsvxSMKSvoGyhRwW1y09Zy1O",
              "solution": null,
              "nQuestion": "1QAQUBwBNw7fd7czVfd520aLKYG6w2CmX",
              "nSolution": null
            },
            {
              "id": "8d5aac9a-1cfe-41b9-97f3-a47af2c9ba36",
              "name": "Autumn End Sem Exam",
              "year": "2021",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10SmjbHDr1mnmKshkscTdVnTkZ6Yutzt7",
              "solution": null,
              "nQuestion": "10SmjbHDr1mnmKshkscTdVnTkZ6Yutzt7",
              "nSolution": null
            },
            {
              "id": "00fbc488-6f12-412f-b902-be9c1865fcfd",
              "name": "End Sem Exam",
              "year": "2018",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19EBy8VB76nTIqYUBfmPK_ohb_pUExnAV",
              "solution": null,
              "nQuestion": "19EBy8VB76nTIqYUBfmPK_ohb_pUExnAV",
              "nSolution": null
            },
            {
              "id": "46bdf756-ca4c-4db3-b0a6-0ec8b7c5d000",
              "name": "End Sem Exam",
              "year": "2017",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1c-X9DTz3fQ9O5269aWYE5l2WRLN0NMC2",
              "solution": null,
              "nQuestion": "1c-X9DTz3fQ9O5269aWYE5l2WRLN0NMC2",
              "nSolution": null
            },
            {
              "id": "139812e8-f672-44a9-8ec3-b2405bf67f58",
              "name": "End Sem Exam",
              "year": "2012",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Y1ZHzGU6eEg8o_0UWKzJ9pUxplPiPWVL",
              "solution": null,
              "nQuestion": "1Y1ZHzGU6eEg8o_0UWKzJ9pUxplPiPWVL",
              "nSolution": null
            },
            {
              "id": "847e4596-0b88-4d19-a157-2d508f468997",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1CqWNeUbpIes3jtoubCfCy469vVqPDH7r",
              "solution": null,
              "nQuestion": "1FgxVpH7PnEISrOuT0xRSS-H8ELqk5tJG",
              "nSolution": null
            },
            {
              "id": "e7656e53-2090-46d7-97fc-00f931d5320c",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fyl8kyLoFM8jqT6a6n3hWz22PqGu2NSu",
              "solution": null,
              "nQuestion": "1E0eVrgHQH9PLTIZXgNfmnPQStIgiEKdb",
              "nSolution": null
            },
            {
              "id": "494deaab-2e6e-4e73-ae35-8a540a3c0012",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "67a6f4940671dc925d51deb3",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1svZs6B2TylSLoNzK4VfcfZjtXmZ_5nVJ",
              "solution": "1MS0mZSfSVZRsuG_js0fQu86unjmZgH2x",
              "nQuestion": "1LU57f6WgdBzbgurWJXwpCJd0ODv4-JEW",
              "nSolution": "1Y_hkVuOAzlGv4Zq7YKfDEij0wXiDF4LZ"
            },
            {
              "id": "2ac350c0-ed34-4b6b-b0f7-f56c0a4c7b0c",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1daL7ScO2cBNLsQhNezX1DhZPf6PuVFS2",
              "solution": null,
              "nQuestion": "1TPLVRjf6sGaMDgg2spwLBUmkFJrPurAq",
              "nSolution": null
            },
            {
              "id": "c264a2bf-fe0e-4fb0-becc-92e0a05232ba",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1h0kWO-J96JM5N9RMme6J24NUTcsiTOGT",
              "solution": null,
              "nQuestion": "1NCunCILvMPACYuoGnmLh19SbsTNFeNL3",
              "nSolution": null
            },
            {
              "id": "05b55ae0-9b42-4025-8c23-5c6f59ffb666",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66174ec03eef911854bf0f97",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1QgOQUWufb2LDSGzZTXpw1Ft2mWa3YLqM",
              "solution": "1e87ymQtzCXPRUVdW74GhO_xCW13FRxNr",
              "nQuestion": "1xdPRuSkiSVLzHgM3zvfcP65mkSDMR1BG",
              "nSolution": "1yo6OprlQzdZKtpCdfpGCM8EH8CxotsHY"
            },
            {
              "id": "f25d2505-e5a2-4e83-8b27-464bdda83f5d",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pnihgAlxXRsRMekq_gi-Ybq-Mgfdcbcc",
              "solution": null,
              "nQuestion": "1tl0eclt5dOLhBNbrlL-PhKvTjDYGMm4T",
              "nSolution": null
            },
            {
              "id": "822b90db-423f-406f-b2f2-9f08c365011b",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Unz0X_r0VonizXv23d14KDt0VrFx-DVW",
              "solution": "13fueki9X5s6hCFehS_HttaDSmpuaZbS3",
              "nQuestion": "1dHH_ujAynUQMpGiWBvSnoNfcEk9xCMJY",
              "nSolution": "1PLbCAby_G1otjqQmmfzTu24IjN5Lxt23"
            },
            {
              "id": "cd2181c8-4a37-41ea-b7d2-45fa13abe8d3",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "668cec4b97969283509b07d0",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10khR5zx2Ki_92gxK707gV-csityQW4mt",
              "solution": "1CTzhJplsWQHkPFTVqN834LHCwfksfvWw",
              "nQuestion": "1CwjiIRpyJ2q7Hl7nPQ6LV7HBQVBB-ds-",
              "nSolution": "1k6bDF69qp5dyMpc9HWiYVo-4T64S56hz"
            },
            {
              "id": "bed60327-dfe5-47a9-a697-b61b357db7a7",
              "name": "Spring Mid Sem",
              "year": "2025",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1m_IXoULVuMERkmibCu5IO_T5229q4vjl",
              "solution": null,
              "nQuestion": null,
              "nSolution": "15d0gHqAT1Kj0VQnv9JkAB4fIU7kIYuw0"
            }
          ]
        },
        {
          "id": "65d222721bdc9aab41338811",
          "name": "Natural Language Prcessing",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1sqfTf3qrO56n2y3jEcJEB7KOVAPjBEAA",
          "pyqs": [
            {
              "id": "c0bab093-5c9c-4cf2-bddb-c65f87693bf6",
              "name": "Spring Mid Sem Exam",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DNA_jKP4_k4pmneOCajhRFydG-M-eYLj",
              "solution": "11zF8HmgRaYkpJslZMGTBHOqWAGYBMpaJ",
              "nQuestion": "1EMmcgeyiSUQJfPGsFTjd_wHRI__kBPqU",
              "nSolution": "11zF8HmgRaYkpJslZMGTBHOqWAGYBMpaJ"
            },
            {
              "id": "4064670d-74b3-4c59-a695-b2841f3294a9",
              "name": "Autumn Mid Sem Exam",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1zhMRUcb_KDCBMlya7yVtH0XxmUArG6Gu",
              "solution": null,
              "nQuestion": "1a4SSIYp3pi3WiEacfiK-seXFkiRoZZNp",
              "nSolution": null
            },
            {
              "id": "7b12d335-5b67-4e01-a920-10311478894d",
              "name": "Set 1 Spring Mid Sem Exam",
              "year": "2021",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": "65d64941cbccf4670b3ca15d",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1bwa0OzhIMjW67T5j9uJ27NwrxPtRgiIL",
              "solution": null,
              "nQuestion": "1B8fgZdhha_mpxSKDc_kewE51R3sqcNui",
              "nSolution": null
            },
            {
              "id": "3f2f56a3-c591-489e-baf3-bad3b7d738f3",
              "name": "Spring End Sem Exam",
              "year": "2022",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1gfoP5FH2HmYxALs-j0HiSDGEEjUhy1_D",
              "solution": null,
              "nQuestion": "1gfoP5FH2HmYxALs-j0HiSDGEEjUhy1_D",
              "nSolution": null
            },
            {
              "id": "89d7fe72-28d9-457c-81bc-ac7669552351",
              "name": "Autumn End Sem Exam",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1t1vrea7YTtavjmNkY5eOr_3d3yiISs_P",
              "solution": null,
              "nQuestion": "1PjZ5h-x3IhP59Pbr7Bx9jrOLW4cPj5l9",
              "nSolution": null
            },
            {
              "id": "b72391be-c73e-44b0-a9bd-967b7e3e2140",
              "name": "Spring End Sem Exam",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1iMRP-FuveWAT4F5gh1WmovWFFOHSz9On",
              "solution": null,
              "nQuestion": "19G_REN7wT49DJoq8UG7ebjVf6zG5uN7x",
              "nSolution": null
            },
            {
              "id": "f5a8d5d1-989c-4795-828e-aea109b16aa3",
              "name": "Autumn End Sem Exam",
              "year": "2021",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ZPHzVEiZgmwiPVplU99as1yhLKsoUbIj",
              "solution": null,
              "nQuestion": "1ZPHzVEiZgmwiPVplU99as1yhLKsoUbIj",
              "nSolution": null
            },
            {
              "id": "b0d3b386-ea97-4dcd-928d-1e16f7393356",
              "name": "Spring End Sem Exam",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1U7Byv19zWhtg1NSQKNdnLIN3f4KoM6cx",
              "solution": null,
              "nQuestion": "1dXllpW-PgiWQIT_Lp5EZxqHMVvVhyLto",
              "nSolution": null
            },
            {
              "id": "896ee8c5-9572-42ff-9e3a-86ed5d5a7ae3",
              "name": "Autumn Mid Sem",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d77a600fb947f5b2547ea2",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17SipMKTLQ-EUvwTZvF1PWQYkOcM--FrC",
              "solution": "10CZMh-aMOUuIwYkGxXs_tMnvtVeNmWEQ",
              "nQuestion": "1bOmrrEupRYJCE86N96-wO78WgS-S5nC8",
              "nSolution": "1W1fUvuAefS-YuZEfJBjnCmeGO90LJXZm"
            },
            {
              "id": "8001239f-8e1a-4f52-bb2d-eaf21119223e",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1K8ktQKC9Y0w6kCdIfunAf-WKvrmC4Co3",
              "solution": null,
              "nQuestion": "1Obbf2_xNeK_PSWAnqX9K2napZQQtMzBe",
              "nSolution": null
            },
            {
              "id": "f0f8b05c-00ff-4b02-8179-61161106cd69",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1C-LD5v-37mVgUVAEJC8xEDzoOdzmQPJY",
              "solution": null,
              "nQuestion": "1yP8WSbamhGQEHLXYPwwti1Ezx2xmcQmp",
              "nSolution": null
            },
            {
              "id": "69820e3c-06bc-403a-9bc9-eae16320c005",
              "name": "Spring Mid Sem",
              "year": "2021",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15q9GKxWM13wReskkuEV8H7ZpLvqQwvpd",
              "solution": null,
              "nQuestion": "1hX4525souMn0b30iuQ3KEdnLk1WhRF-Z",
              "nSolution": null
            },
            {
              "id": "95d6aa54-b12d-4236-944f-9dcb9147a810",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66179556a909c6db59a41f77",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12B4vbghlxtqkz4CsFtpfbslqgXl-br_p",
              "solution": "19AIrRZME-QdgrggMYcc6JzGcqxcAlAIQ",
              "nQuestion": "1NF8V3pmUzRqNArIjhCl2tMGpMpATZXpn",
              "nSolution": "1hYQxBV5BlQt2NG64Nnfpm2ebYJ7fc9kS"
            },
            {
              "id": "cac2874d-27f4-48f0-b7d7-729ebe8b6ffd",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pLj_5uZa0lbLb_lltSncm2tRXO2ap8XW",
              "solution": null,
              "nQuestion": "1MWCqKmyVmpX50023zVG_XRLbpYZDcw00",
              "nSolution": null
            },
            {
              "id": "ebb577e5-846f-4432-89c1-4593020927b9",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1FXUfRZz02y8r829SF-1paNjSoDl75nBc",
              "solution": "1msCWARcRJPalZx_IdMDuzQqmDkTglmVF",
              "nQuestion": "1KR0reY-aQaKX_8qu0NVb99BOtxCgZ4_7",
              "nSolution": "1mnmMU-uPWHgr2T-Z2f5tv6LZcNWAo0dS"
            },
            {
              "id": "2618c509-fcdd-4663-8706-916faf4ff640",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1LkL07JqwT-JJoqbOldxRamv7ND3udeWY",
              "solution": "17tJA8uYFvkBYZusV51PV5eQwwNARopk4",
              "nQuestion": "1R1JnMYyvabzCACaV0TaaIZ1sL5bcbxLk",
              "nSolution": "1pJBdLblR1kq0amITHm8nO9A72yl9kLYi"
            }
          ]
        },
        {
          "id": "65d243b8567cea6553c6b517",
          "name": "Scientific and Technical Writing",
          "SUBCODE": "EX20003",
          "Credit": "2",
          "folderId": "1NRpAp4LabgaRdtfMUMJJFxvH7Qw8ubLm",
          "pyqs": [
            {
              "id": "020361cd-9455-4cc7-a66a-d60961f9ad1a",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66226509ad6e7bd16c843f8b",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xnacYEfcxz96YYhn5Q6vsOhMZII-xqmF",
              "solution": "1WMVkJJHr9HcvSYGsb5nn_ZGmohpLZz9_",
              "nQuestion": "1ehORR_6xPmh7sc3HkTokLgMgT36Py4KT",
              "nSolution": "1K2TR3whx_UUYK8bDNbrkuddQOiH0gD_L"
            },
            {
              "id": "cc7ae7ef-bc41-4236-befd-5d458d86528e",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65df67560fb947f5b25481da",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ym3DUHFticDPuzfaM99_lPES0MI_A5nd",
              "solution": "1uO2Sc4X2IXCIEOTNJahpa7azhNtlw2rD",
              "nQuestion": "1hkHYCyf8nwhSULYr_ASLQx3hk38Kemzz",
              "nSolution": "16qPLvFY6trV9zxND46JqGrnDye44oCfX"
            },
            {
              "id": "2fe085ab-ea8e-4bc9-9dad-07bfbd17e399",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65df4a710fb947f5b25481d3",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JuZX6V_8PqVR2W80tC5qSs8Edy_DM8ad",
              "solution": "16u29FqV3RbSAkGtL0kC22Dj_9jrRroE4",
              "nQuestion": "1JoROy6iBB_3PBZ5xWLa9MgGrwnjn9Npc",
              "nSolution": "17029tjznegvLj-gxw4RGDI50Ywd_TQZI"
            },
            {
              "id": "cd290c47-3b33-4c46-8444-8811e2671717",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661ebf91a909c6db59a420d3",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tySi-nShYZ9aTx-Bho3zqfO7iDelJ6AF",
              "solution": "1nKPRyYcJZTGi5U4CVwPLnAOsUiCinGrI",
              "nQuestion": "1MHMIo4xf0MzVDAY5-DlsEaxvbtP-SPBl",
              "nSolution": "11tODJxMwhqYtipHMzB4f1oid5ob7m_8e"
            },
            {
              "id": "f032fc85-0012-4664-8da4-6ae58db951a3",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "670e7691f740b2b3e5002e2b",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1GALEbNcx4kI3uQV3Ph83OoD4-kHqe9cg",
              "solution": "1bsNJz_1t_SUT2OcOqba_ot7TJlQmWqwt",
              "nQuestion": "1MSqRytmlLLAWU2KCcoWw2OnpR4cpHaHA",
              "nSolution": "1gMd4xMtSzHrGsfekffHk6CpzZihd5TyV"
            },
            {
              "id": "7336352b-7aea-44e5-8b6b-2ed50fefd551",
              "name": "MakeUp Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1UHx9KrblHIjXg7XaVVliaCcEs_Qxq8nd",
              "solution": null,
              "nQuestion": "1yVFlIOOI27eKlTY_qDOoppZ9oeNp3Ai0",
              "nSolution": null
            },
            {
              "id": "576178f3-4917-4431-b069-dde62f5286de",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721c9e25a965de869c43389",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-U8ygosJ5VtSXUQtsWGPDH1gmHcHYmt4",
              "solution": "17Ip_2MpEchPb3EpI2UpCP5aNPIEr8ck4",
              "nQuestion": "1q3PB_ia1HTGUH2y2Ft2TdUc0wSdlV5eR",
              "nSolution": "1CQJygVcRMYX70H31oSp_xBMP_gy5XzEW"
            }
          ]
        },
        {
          "id": "65d243b8567cea6553c6b51a",
          "name": "OS",
          "SUBCODE": "CS2002",
          "Credit": "3",
          "folderId": "1TbLCaB8-2PSReL8IZ-CXdnkrivRkmr5d",
          "pyqs": [
            {
              "id": "8fe83206-3a7d-4ef1-8794-0abeb93158cc",
              "name": "Spring Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65dd568b0fb947f5b254813a",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13kfWnHJHlZx3fOwa51S6OQq3JZLnWR4z",
              "solution": "1wNbbDIvF56w0xpOSHtVG53jKZ73wv3Hq",
              "nQuestion": "1nwHShe3Zy3Uc2bMXWYsDkyk86dnOm2pi",
              "nSolution": "1J08cwupeDO0gHBfV2qkzm_yfNg3qzK-L"
            },
            {
              "id": "3fdd60e9-311c-4f17-a94c-dbcfe32b214e",
              "name": "Autumn Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d710d3a226064c68a248e2",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1D8En75jBzA3tv_w0U-nfO-62DJ5j_jbe",
              "solution": "1s0gFvUg1mgCDJJLbY65hwnRNv97Iyhrt",
              "nQuestion": "1lvPRqm8j3n5fxAUfGidCVCZBo4uqGTsj",
              "nSolution": "1vuJnqXMK8A34umbgjj2yyIG7efrqScv8"
            },
            {
              "id": "565eb8fa-73be-47ff-9c19-12970fee1b3f",
              "name": "Autumn Mid Sem Exam",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1D8tFV1-XSmG7rcDTNtpT5zFsRlUFPQK7",
              "solution": "16yI5lesobPzCteZoXjZ_2D0cVJIP8usu",
              "nQuestion": "12jskvKVSN7z_8JxtDIKfTvVgqG1mjv7P",
              "nSolution": "16yI5lesobPzCteZoXjZ_2D0cVJIP8usu"
            },
            {
              "id": "9af94602-36a8-44ec-8eca-a38235dcf8bb",
              "name": "Mid Sem Exam",
              "year": "2017",
              "type": "Mid Semester",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12ziti9XH6eYsqPnGt2rWyBIb_q3EZanr",
              "solution": "12ziti9XH6eYsqPnGt2rWyBIb_q3EZanr",
              "nQuestion": "12ziti9XH6eYsqPnGt2rWyBIb_q3EZanr",
              "nSolution": "12ziti9XH6eYsqPnGt2rWyBIb_q3EZanr"
            },
            {
              "id": "ef3abc2f-3c4c-4be6-ba95-6171e16121a4",
              "name": "Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15mErqlGQnukVhvUzEk4VVQRkeUsRsof5",
              "solution": null,
              "nQuestion": "1WKGTjsicTOV5zWAiRkpisZ95BZMA7e7T",
              "nSolution": null
            },
            {
              "id": "1b6beca2-1a15-490b-92ce-dfa3d0db8315",
              "name": "Spring End Sem Exam",
              "year": "2022",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1FcnbzSEDMB3hf_H16wLohpbjMM38tzXs",
              "solution": null,
              "nQuestion": "1FcnbzSEDMB3hf_H16wLohpbjMM38tzXs",
              "nSolution": null
            },
            {
              "id": "b80c89a2-59cc-4c1d-b846-1c48bf371b46",
              "name": "Autumn End Sem Exam",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1IeEQIc5jXWzATugNLbndTMpWI6RyF8hS",
              "solution": null,
              "nQuestion": "1hHKKKLOUJbYmz3faB0Rvv3OssgbMYcvO",
              "nSolution": null
            },
            {
              "id": "574b6027-0350-41a0-b56d-2d75b3ade267",
              "name": "Autumn End Sem Exam",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1uYgKptmXgo3JZaxL1gIdfFT4QOsTTGxF",
              "solution": "1UdyGwQEXoUtXrUml8Z5zBjdEZNxSLRGb",
              "nQuestion": "1dqfqqzSpp8iDBeZ_B25KnCuMYSFbbquz",
              "nSolution": "1UdyGwQEXoUtXrUml8Z5zBjdEZNxSLRGb"
            },
            {
              "id": "3b5b16f3-ec74-4925-9228-86a8af9d6069",
              "name": "Spring End Sem Exam",
              "year": "2018",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1zlbIPBzUOF7lccvVfmJxdBljfT10BB3B",
              "solution": null,
              "nQuestion": "1zlbIPBzUOF7lccvVfmJxdBljfT10BB3B",
              "nSolution": null
            },
            {
              "id": "9ca62a82-55b6-4e03-995a-93735d69b97e",
              "name": "Autumn End Sem Exam",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1wtQtl2mMswy4AYpA374_27fyh6rzsd2D",
              "solution": "1S1zWt4Y-_38kGppxf0e-kkJ_WdmP7-Xa",
              "nQuestion": "1WCvJJDUS28XxR-ToHpfO9suz-6McKP5y",
              "nSolution": "1S1zWt4Y-_38kGppxf0e-kkJ_WdmP7-Xa"
            },
            {
              "id": "352a7f53-aaf3-41b3-a1c8-ca5a40174bcd",
              "name": "Spring End Sem Exam",
              "year": "2017",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1wIqLgYUNItTvQ_nfL-8VtgZIrKLGqZv_",
              "solution": null,
              "nQuestion": "1wIqLgYUNItTvQ_nfL-8VtgZIrKLGqZv_",
              "nSolution": null
            },
            {
              "id": "c88b1c2a-0839-42ea-8ebc-974f3b127ae5",
              "name": "Spring End Sem Exam",
              "year": "2016",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1__TPBYfF_dIP0hrCnygfpdQZ_v8VGlSW",
              "solution": null,
              "nQuestion": "1__TPBYfF_dIP0hrCnygfpdQZ_v8VGlSW",
              "nSolution": null
            },
            {
              "id": "a1d01bf3-515a-4162-816c-85146ca9d055",
              "name": "Spring End Sem Exam",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6624adacad6e7bd16c843fb8",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pto1snyW7yEl38aJP3-TluZWshHTzlCO",
              "solution": "1hyh2ojRukTIOQ4HC2tcrDkXt69jtrFxg",
              "nQuestion": "1yVhTqs9PmaDlGRfcxPO_VGwEeOCcWqfg",
              "nSolution": "1BYOXGORWQF0SzidckycdltfovKztnQYV"
            },
            {
              "id": "5859ef68-54f3-4385-81c6-16772717a5e2",
              "name": "Set 1 Spring End Sem Exam",
              "year": "2014",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1wKsenuI8SLHt-oNNjE2hZI5AZFZA8XUC",
              "solution": null,
              "nQuestion": "1wKsenuI8SLHt-oNNjE2hZI5AZFZA8XUC",
              "nSolution": null
            },
            {
              "id": "d9cdce7b-c5eb-48fb-ac39-2c2c1a00a1a8",
              "name": "Set 2 Spring End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1epj3HRQNIz9YMezOPdld9v4KH8NoVAx4",
              "solution": null,
              "nQuestion": "1-_W8FzISc6WFqJB5ARTIzcXViWTkl2q-",
              "nSolution": null
            },
            {
              "id": "bb84ce64-67f4-4115-a856-b7ee27a070e3",
              "name": "Spring End Sem Exam",
              "year": "2013",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1q2VTxqhpVg7MS-frR_M8NK2HvEd5bamF",
              "solution": null,
              "nQuestion": "1q2VTxqhpVg7MS-frR_M8NK2HvEd5bamF",
              "nSolution": null
            },
            {
              "id": "7619b868-7db5-4020-966e-0102535fa623",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661aa8f2a909c6db59a4202f",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1x_idrccDxnb3uMhzb1ub1BsktXShBpHz",
              "solution": "1K5jBAkucRr3KD93gVucgYIvQ21qu25QW",
              "nQuestion": "1mwqHSgith00uSkZh0d1Bzj7t_sBNkRau",
              "nSolution": "1v_fuZ5hkPeEyhdvIiVnhniJxqACDcLvB"
            },
            {
              "id": "17df7716-f8fa-4151-a3e3-ff1aeef7f5fe",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d759670fb947f5b2547e85",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1whZ43154keDa95LiFuCPUHnQTYMJGXX9",
              "solution": "1rDbcY3dN6sMrYqq8j08tfRRuKpYDAcQU",
              "nQuestion": "1Khay_mcZjYj6IhknDJnPAWmdrFnh2I11",
              "nSolution": "1Xxqboon1UhV5vAnrDV_3kbcPbZWPtb_B"
            },
            {
              "id": "0580f8d7-a722-4d45-9ad0-fc0123e8d0f2",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1eEg4eGoA2Ywr1ms-8xW23DRqy70-9M6f",
              "solution": null,
              "nQuestion": "124ox9A_tnBrbT9S8q7yRMASV2Kb9Y0Qn",
              "nSolution": null
            },
            {
              "id": "08a8ec33-d924-4550-9d53-2aba5a6078fa",
              "name": "Spring Mid Sem",
              "year": "2014",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pw343oUQy5s6bRHOxyb7GRFstakCAbpf",
              "solution": null,
              "nQuestion": "1ONMI7XMiYCsFiKnELa5pXDidU0exZfa9",
              "nSolution": null
            },
            {
              "id": "b9c6a63f-a484-479a-95aa-7eb980ee2e61",
              "name": "Spring Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1aEKfOMoG3AmvQE-Odfy8_gY4E4OVNVSb",
              "solution": null,
              "nQuestion": "1M5sLjLd5YP0ZmO_3CTfg3q9VYpiyXz2L",
              "nSolution": null
            },
            {
              "id": "9ec54ba3-568b-4e97-8290-f7e170d0ba4b",
              "name": "End Sem",
              "year": "2012",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1prByV3sVTNzr85nNk6iGJzenwqYo_P6T",
              "solution": null,
              "nQuestion": "13rhfVMKy-UnHJetd05nq4roX8YjTROyg",
              "nSolution": null
            },
            {
              "id": "82b15c6f-5693-40cb-9878-154b19799384",
              "name": "Autumn End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1jNhTj9grq3KSfo4uo5-IfIFe9fY99u3k",
              "solution": null,
              "nQuestion": "1-tLlhg5M_Jc5wOz3QruXPog6zq02J01_",
              "nSolution": null
            },
            {
              "id": "6a0a5d9d-205c-4c48-833b-d1ef64a3054d",
              "name": "Autumn End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "169dDhLrfbHhBbwNrUZySB_UU_sMDxpDa",
              "solution": null,
              "nQuestion": "11AMdvJ2NoK-81Tvp5VDVvwewfnawrjtG",
              "nSolution": null
            },
            {
              "id": "1a1c5a6b-7f08-45b8-8c96-0bb1f37ef7b6",
              "name": "Autumn End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1aymO6TOr6MSrZ8Ce0IouFFx4k56IsOxr",
              "solution": null,
              "nQuestion": "1Tw6aOL53a9WZUM3LOuXGPYA9l95BBIvv",
              "nSolution": null
            },
            {
              "id": "65938e0f-0882-4157-962d-f4c6c95c54cb",
              "name": "Spring End Sem-2",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1eIAjNkzSFAF3_XNFK031pD0IHQ-ujOyN",
              "solution": null,
              "nQuestion": "1P9gd187JIm_k0NOPFrAT8oLGFMA5RMwM",
              "nSolution": null
            },
            {
              "id": "062072a3-c53a-4e94-9892-3d5c72d96f31",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1IaD_zVy1O9SX9MaFteAOt4eamxmklkMv",
              "solution": null,
              "nQuestion": "1ENn5NsQrYx3XWJsauMBh5TbqFjMITBHk",
              "nSolution": null
            },
            {
              "id": "7a83d907-cc0e-48dc-839f-6d53bf2a05e9",
              "name": "Mid Sem",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JNp_VTmbDUg8i-u27smp8x4hgqoeQclR",
              "solution": null,
              "nQuestion": "1VUXF_qv7wwQ8B9EYHO8SsQOTYWMGo3RC",
              "nSolution": null
            },
            {
              "id": "ef8464de-95ef-4567-a72c-6cd3a3f9c22e",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-u9mXFfQw9BZAb_JelOX0xiegXEnJ86P",
              "solution": null,
              "nQuestion": "1qRqKweMgUvV8Niovg_Hm0KCVuKYNX8wj",
              "nSolution": null
            },
            {
              "id": "ca6de580-2e53-4b3a-a8fd-510480b2eb8c",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1bKsBZk_fDrFHiq_9tiPdUWEqgvWjI2j8",
              "solution": null,
              "nQuestion": "1e8qR2jZVAAmhGr3l7BhyOTCvL-lOHIRB",
              "nSolution": null
            },
            {
              "id": "6780da66-cae0-469a-8169-ad6ce119d973",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1KGnVLQPrv5pJCN1qTv7zttEbcePQpgQ6",
              "solution": null,
              "nQuestion": "1M7COWJZf4WocRDHa2Ar2gfWDpYdEeuP5",
              "nSolution": null
            },
            {
              "id": "fc0796cf-0376-4e0d-880d-d01f18ae2fd8",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661ebc30a909c6db59a420d0",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1L7yKGx1gYlOIPHfyLReXw4MOJz_k8ZCx",
              "solution": "1ZK6cpI-aPC1VmzbkK_HZiaAki_irT1g2",
              "nQuestion": "1S36N6SpNzFBNsX24_K5pGOMVjNit4Nbh",
              "nSolution": "1C4Tz_saEFqB6ipry11H9_Fds3yuI_nmp"
            },
            {
              "id": "a8498eb3-5091-4dda-ba89-0200c1c8e972",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66d2037242841c454a166e55",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1IKt45Ps9Hgre9nFlVAoDyCzGZlK_qjuB",
              "solution": "1bL7T9bx-pldWC6fIbmWsCOkaSL97Fsxh",
              "nQuestion": "1K4zBx1denkp-Id8BIFydQW3IXnItg3ys",
              "nSolution": "1i6WrZ8h9HD1sqpVuc38tx_fAH_hGJ6TY"
            }
          ]
        },
        {
          "id": "65d243b8567cea6553c6b518",
          "name": "HASS Elective - II",
          "SUBCODE": "EX20003",
          "Credit": "3",
          "folderId": "1wbZDXbeS6dLjA0nc4gxcPQSCEPztSZKi",
          "pyqs": []
        },
        {
          "id": "65d243b8567cea6553c6b51c",
          "name": "COA",
          "SUBCODE": "CS21002",
          "Credit": "4",
          "folderId": "1k8RbQS6fc_w9khO6goAEe95alrb_awN6",
          "pyqs": [
            {
              "id": "c512edfc-bdda-43ea-b9da-9e52dacbc982",
              "name": "Question Bank",
              "year": "2019",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1N7wLA-lBtNQVppDhVd6Rcc2SAUPMSWFG",
              "solution": null,
              "nQuestion": "1N7wLA-lBtNQVppDhVd6Rcc2SAUPMSWFG",
              "nSolution": null
            },
            {
              "id": "5656cdef-3ec1-46c5-bfd3-e22a7fe77cd1",
              "name": "Question Bank",
              "year": "2018",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1weIpvtqYBpsx6fFOGl3RD6fOotTJMR16",
              "solution": null,
              "nQuestion": "1weIpvtqYBpsx6fFOGl3RD6fOotTJMR16",
              "nSolution": null
            },
            {
              "id": "ef0be191-bf1c-4453-ba3a-eacee9d783d3",
              "name": "Question Bank",
              "year": "2013",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RFavGIYJIqssUQbcmPMuztpqfJIxEom_",
              "solution": null,
              "nQuestion": "1RFavGIYJIqssUQbcmPMuztpqfJIxEom_",
              "nSolution": null
            },
            {
              "id": "5b37bb6d-5e08-4704-8e6e-9b88e59dd15e",
              "name": "Spring Mid Sem Exam",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pp4wOVrmmzyRbpKeMX5IhfSYP3rNMARE",
              "solution": "1LRK00P_4n25k7AyZVkePGIxGQit5M6G7",
              "nQuestion": "1JuUovLxn8tnqaBDzhAkvrjQ-yDOCn9br",
              "nSolution": "1LRK00P_4n25k7AyZVkePGIxGQit5M6G7"
            },
            {
              "id": "5bf632ab-63a9-45b0-a7ca-ee2de414a024",
              "name": "Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d72ee60fb947f5b2547e57",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1dbvrJ9iJ7hLpgMfCyMHMnwvPu7cHmeOa",
              "solution": "1t19fp97opiZ-2m4D37SrGGJAAICQxmBZ",
              "nQuestion": "1VEDrAbou8w4lBMvLg_am1Sc8xDzUkFt7",
              "nSolution": "1QCfRJbO0cQU63dNEZm8WX3QYo7xz7org"
            },
            {
              "id": "f2ae118b-fcb1-4e35-bd6d-1e16fcecbae3",
              "name": "Spring Mid Sem Exam",
              "year": "2018",
              "type": "Mid Semester",
              "status": "APPROVED",
              "solutionUploadedBy": "65d72e2c0fb947f5b2547e56",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15k5pjH9WKiH4QH8JWhWpIEiSNkFDlEiE",
              "solution": "12kNgJ5tD3F-MEjY4FsIuYnJKVNKF2tz2",
              "nQuestion": "15k5pjH9WKiH4QH8JWhWpIEiSNkFDlEiE",
              "nSolution": "1NXG78yseWAV5nsGh4mEjVKn5G9Yy5oH6"
            },
            {
              "id": "391c456a-8122-4969-bbee-6cf895921d08",
              "name": "Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d72cd20fb947f5b2547e54",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BuolHlpMEmuXIllOgSrMGqoLUuW2Oqy1",
              "solution": "1PkCdnc1YaBZv72oBcQsxi4Ln_KqfM_tY",
              "nQuestion": "1v1_Iua0Y_WEy1fBMgzKFW5Mv59frNDO_",
              "nSolution": "114JarEXzS0csl9D88TeWt2BT-Zps0gbn"
            },
            {
              "id": "d7a2700e-f864-4888-baf0-725a59ba069b",
              "name": "Set 1 Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1CDRwOqkNwS4cMU5RwKooZidhq-7dNBKT",
              "solution": null,
              "nQuestion": "13usWDvUh328ys6SU5oOz7J1vnO7cLXZd",
              "nSolution": null
            },
            {
              "id": "debfb4ab-1113-4793-a2df-669a37d8c34c",
              "name": "Set 2 Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hu_EvVHkiuq15gQcrnpwQl2l9kfJTc67",
              "solution": null,
              "nQuestion": "1jBXKurVBhoqVlg6yIDRSWpbeJZRnlXXf",
              "nSolution": null
            },
            {
              "id": "d20c1c5d-5768-498f-8e44-f0dd2b618847",
              "name": "Mid Sem Exam",
              "year": "2014",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JkEpRoL4eeXG1NUCU8JmkusIfWqbWCLI",
              "solution": null,
              "nQuestion": "1rXPxR7B7pDumBmvqhonYFljd0kVPyWW9",
              "nSolution": null
            },
            {
              "id": "7a9e8b6e-7258-4023-87dc-4a09a61c85b6",
              "name": "Spring End Sem Exam",
              "year": "2022",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11-p726f1tBZdRNkNa4voKxbr1wb_X6sZ/",
              "solution": null,
              "nQuestion": "11-p726f1tBZdRNkNa4voKxbr1wb_X6sZ/",
              "nSolution": null
            },
            {
              "id": "7a62a43e-e41e-4b7e-ac09-208562e00405",
              "name": "Spring End Sem Exam",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1CgyzuGuLjB5YKQthMO59-f1_tAVqOSgp",
              "solution": null,
              "nQuestion": "1ssmHKf47Ut-ZHgmoscLpnVRBFBzeQxWp",
              "nSolution": null
            },
            {
              "id": "fd25b041-734f-4c12-b624-0b20311a6565",
              "name": "Spring End Sem Exam",
              "year": "2020",
              "type": "End Semester",
              "status": "APPROVED",
              "solutionUploadedBy": "65e196afcc176893883e48a3",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1bHwaEXTZkXYnVP8S3EESQiD_8qmLmgpP",
              "solution": "1Y3fGt3kb_TU3G5pgfvrc_DB80MgBRc0L",
              "nQuestion": "1bHwaEXTZkXYnVP8S3EESQiD_8qmLmgpP",
              "nSolution": "1Ar1MBrsytarU53IEA-D7TtrB8bdNZrUz"
            },
            {
              "id": "44f8dff7-9c5b-4048-afe7-2d5e41b6fe3a",
              "name": "Autumn End Sem Exam",
              "year": "2015",
              "type": "End Semester",
              "status": "APPROVED",
              "solutionUploadedBy": "674251685a965de869c43704",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1KaAP653ge2r2ft1iEqe8_cMQkIHUsa0k",
              "solution": "1RaIyX3_Pw1YD6Rj3kA8LFBc7AsYPAMD6",
              "nQuestion": "1KaAP653ge2r2ft1iEqe8_cMQkIHUsa0k",
              "nSolution": "16fIL5hg3UWne3f3ClBBeYf7FTKs27_A7"
            },
            {
              "id": "8d2cd8c0-8ade-4243-a6d3-9de9cf411df6",
              "name": "Spring End Sem Exam",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fy1yf095VBwxtaxvQqhKTleMZP38t0uw",
              "solution": null,
              "nQuestion": "1zCtF9mE7brEycMuM58QLNos7lyrQuPrx",
              "nSolution": null
            },
            {
              "id": "105ec83b-a0af-4d0f-8c90-bb401d2cfe6e",
              "name": "Autumn End Sem Exam",
              "year": "2014",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1EKw_A6wFT4z4vmmRznoN_aH_G-MWsAgL",
              "solution": null,
              "nQuestion": "1EKw_A6wFT4z4vmmRznoN_aH_G-MWsAgL",
              "nSolution": null
            },
            {
              "id": "963a72c2-24e7-414f-a2d7-6a8e60f20945",
              "name": "Supplementary End Sem Exam",
              "year": "2012",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ZGR7dTdgIAa7Ef1SkFg1popZtjw_r5pR",
              "solution": null,
              "nQuestion": "1rBFNDR7wb9e_AGbWbUr_frI60RLBYEjq",
              "nSolution": null
            },
            {
              "id": "3ff71f83-3b30-44f0-9f01-d20c2165ff46",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d9cd310fb947f5b2547fd9",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1joUYLIxUBckUvp_l1jAZ6NprsPkhlimF",
              "solution": "1RJoFw2Nw5FrYAuEM-_EvZWOHeGXPnkNV",
              "nQuestion": "1ZLXxvKrOaxJIc0GXkQvYg1WuJ8NSMdLU",
              "nSolution": "1QO3LgMmC1C2-pZPx87RugSKheiBjDbgq"
            },
            {
              "id": "089b6730-7f07-425e-ab99-4cbe366d6d7c",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65e1ea14cc176893883e48b5",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1VnphqFD0msdfUqvXsWDrIeEua-UG5lBW",
              "solution": "1mwFvOWunFntLzVUl9ybzmM7Ad9BZvT5z",
              "nQuestion": "1cNDPk4UXEwaU04EVrhYND-ImTHxkHp8E",
              "nSolution": "1M53lXz24sj8bIfWTJDMU6W5EeXZYvoSB"
            },
            {
              "id": "489ec597-31e5-46ef-9e4f-483a3f5555d3",
              "name": "Spring Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d72d900fb947f5b2547e55",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_Zmg_nZta4fouEg0WmWvRP3xDt3KRN7y",
              "solution": "1DENPvrqUJlc-LFT5N8TWIHq-ztSuDGYu",
              "nQuestion": "174ZiPt6FxEx6IAPag_ly3rBbUgn5cIQu",
              "nSolution": "1atBxLXCkvImIAUCLM2rTzmfUuSu3HFY8"
            },
            {
              "id": "6cbb5c31-7a2a-423b-b28f-4bca11e9dedc",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "660a364530641ad00aae8aa3",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1q7vWSxncUYHcbOzgU5Yeyi23rlYNPHGI",
              "solution": "1lRrtyLfWKgbxNEJk3Ih06vKCXAO3Yb9l",
              "nQuestion": "1GGw2GBm_JTgPdMNDaeoYuZp8TcXTZUdt",
              "nSolution": "1_JlmlGV6DcXX3TdgtfmVgwnprwJE90f4"
            },
            {
              "id": "2f52f581-f1ad-4e55-82a7-9c24dee22ce7",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "660a3a3730641ad00aae8aa5",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ltPZUVwBo7StOwstYhU_2mbZvIM0xjDr",
              "solution": "1WOGI-EtqDPa_1rhYMUURW5JUDREr6fF-",
              "nQuestion": "1scvjoap6-4lyWAyfe8tB_curNSarOLpD",
              "nSolution": "11YpXmY9oylzS9IKN5rE4NMnH4nzIaknE"
            },
            {
              "id": "aafe88fd-55de-44e2-97cf-7bbee2f8d727",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6623b7f2ad6e7bd16c843fac",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1yTefMPEM5F2SsHJ5fMdqLNI8wjPnyRzk",
              "solution": "1t1xIcUwen0-X71Am4gCunQGPHf1XZTll",
              "nQuestion": "1nan0uiuq-q9J7V5uLmqyQSaepd0eR-PQ",
              "nSolution": "1d5ev_1qdKJXYu_dg0Qwp12EMGixaP5Z6"
            },
            {
              "id": "3a9cedaa-59e8-48eb-b124-fde0f517b27a",
              "name": "Supplementary",
              "year": "2012",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1XVn2I237iuXxESXJ6suF9Vb2r5WX5IYt",
              "solution": null,
              "nQuestion": "1HMamW727elLFRSqpYxMp7V8taLE_FArg",
              "nSolution": null
            },
            {
              "id": "b1d2f16d-d583-47b9-9e56-b9a0f8550be7",
              "name": "Autumn End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Iz0R5wRnAjBT_vYqLVRCIE_cF2M3m6LD",
              "solution": null,
              "nQuestion": "1vhGxB787iEVpK7mtpyru7stDszFNMoQL",
              "nSolution": null
            },
            {
              "id": "23be4f14-1c82-4173-9db9-ff02841c63b4",
              "name": "Autumn End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15cAwLlBeWGTci_ChmW_Im0b04_7FtlcE",
              "solution": null,
              "nQuestion": "1IY6S79yn9TlwRFdvmTg7FRyYFSM2wfGF",
              "nSolution": null
            },
            {
              "id": "e445b9ad-fa6b-406f-81d6-12494410ba17",
              "name": "Autumn End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11Az5DWAxBKb6CnPmE2bK_MoSiKZOzF7G",
              "solution": null,
              "nQuestion": "1ABHN75vlc7DMstRvICrgUwUxzZ10H2gF",
              "nSolution": null
            },
            {
              "id": "0caac852-d70c-4b05-895d-ddab3f67ccd2",
              "name": "Autumn End Sem-2",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6623b798ad6e7bd16c843fab",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1dWwJQ4ZCzJ0OB1iod59eC_bYgeTCs68J",
              "solution": "1LMA-Y8nJr3Q2NkEcj6rrWfIqc3K5V1Zo",
              "nQuestion": "1fZdIBCJf9gZOcess42kpDoX0Sq5_2kDO",
              "nSolution": "1NFwTsK7FLssCF9Vs8YWLFrUxb4avN89E"
            },
            {
              "id": "0b78aca2-eac4-4be5-98c9-b8d38683a018",
              "name": "Spring End Sem-2",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ywwxTmNddWci-x8pxZfbBfarrfxgKMjm",
              "solution": null,
              "nQuestion": "1NsKc-HhhnoI9mIidPMDh2pb3jT0DBGLA",
              "nSolution": null
            },
            {
              "id": "fe6a0fe8-c8ee-47a2-9a7f-8c2bc3e1d420",
              "name": "Spring End Sem-2",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1oqcDNITV08lzL9tI18ATWq2UfQPkP7Or",
              "solution": null,
              "nQuestion": "17mZ0cxs23KHiOBvwAACRQQG-WCu2msJp",
              "nSolution": null
            },
            {
              "id": "a8f341bd-6a2a-4b32-acf6-eff3a735b7eb",
              "name": "Spring End Sem-2",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1MC6WVFT5YD8xi_28WoAPoEjloDcgqILM",
              "solution": "1_lxFpNl7fQ-_ac730oBjB63g5t6agGb7",
              "nQuestion": "1mVhxO4dEdoMUm1KIzAMBsNvBI8eDN7CF",
              "nSolution": "1XB-o7EbfB4hli0kYaqOTDSiDmOtd7Ydn"
            },
            {
              "id": "2844a1e9-f5a0-42ff-b337-35919acffed7",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661ebcf4a909c6db59a420d1",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1w08-TThLDrDZ-JcR2-v83FbGgCWuacXz",
              "solution": "1tJ0xm0RDNQj6xi-XbuBqS2ZsUOtSJqBT",
              "nQuestion": "1xdqybEJv4L6hn1XTGg_zVQD9gJFsBLoP",
              "nSolution": "1JpT8pV2wXOEk47RGD5cn4SCg01L7sSS6"
            },
            {
              "id": "0295bc70-12b8-4fd9-9aa9-27735b7d3e74",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66d2041542841c454a166e56",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13nrZRgtgwy_f_-qtd1AniOGpDf1jv2-T",
              "solution": "1ZyKLnmlBBRcosd_PEcebvQlodRnHnjEX",
              "nQuestion": "1mUM3pX4NkU7FnwcHqp1-yutFJNNGmsVt",
              "nSolution": "11sd6BHKz_7I8ab5T8J_hWfIphzbRtd6O"
            },
            {
              "id": "b695c5d3-3a41-48a8-8c3b-eb63ff835a43",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6722493c5a965de869c43399",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1MKYq-fjyJ7zOkOtELaP-lFjdrcNbptXT",
              "solution": "1JEAIcCIK2zhQOfUQrgb2ppd9RtE0w1O7",
              "nQuestion": "1P6oyFh-6RawbC6e5UtoLDosU5-_yNDnu",
              "nSolution": "1BaeozXNlNjQkdvpzi7wan4M886wZuIld"
            }
          ]
        },
        {
          "id": "65d243b8567cea6553c6b519",
          "name": "OOP JAVA",
          "SUBCODE": "CS20004",
          "Credit": "3",
          "folderId": "19WSxWiqmXvSCIQNuTEAycnhhHX1I3nQm",
          "pyqs": [
            {
              "id": "f97fedf6-4f33-449e-a2ff-04a4e80cea42",
              "name": "Spring Mid Sem Exam",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65e19761cc176893883e48a4",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-IrwHiA8-8Es7N41j4nMBZlscEyY9YfF",
              "solution": "1TfZYFkzm52_UQFX0WRmevlLwmQCCNz3r",
              "nQuestion": "1zcSAAUlVzvwurFV7kRsTjJE5YLPwHIt6",
              "nSolution": "1nCJUE85xhlKs3h9_chdobkIgkSMLSgee"
            },
            {
              "id": "b2494b78-9693-454f-9f08-0aa51403be04",
              "name": "Autumn Mid Sem Exam",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17kveHSXxqY26N88WW-GiwKlpmy4Z690U",
              "solution": null,
              "nQuestion": "1dpoxRWT5GU6NpiyGDSJ_JBYs7il695bj",
              "nSolution": null
            },
            {
              "id": "72bcfb0a-9bd4-4570-9602-fc06a019a514",
              "name": "Set 1 Spring End Sem Exam",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Zjmj3mip9J3QWz8WjE4PYqZ5hfxPyVjk",
              "solution": null,
              "nQuestion": "1TCwZCLXye6QmkU59NJSL0q_t_Qqof03V",
              "nSolution": null
            },
            {
              "id": "91de0d78-4906-44bd-9aa1-50824e6a1d99",
              "name": "Set 2 Spring End Sem Exam",
              "year": "2021",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1zfz9C7wLYkmnJqftbCFxQC6i0Z1gODA1",
              "solution": null,
              "nQuestion": "1zfz9C7wLYkmnJqftbCFxQC6i0Z1gODA1",
              "nSolution": null
            },
            {
              "id": "9cd155f0-7fe4-4f78-a81c-5bea3915db25",
              "name": "Autumn End Sem Exam",
              "year": "2020",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1GRLRbxYesjNsrJcZIv8YEMn5gbFXX8yZ",
              "solution": null,
              "nQuestion": "1GRLRbxYesjNsrJcZIv8YEMn5gbFXX8yZ",
              "nSolution": null
            },
            {
              "id": "ea99bdb3-8350-4d10-9d1d-ff866021235b",
              "name": "Autumn End Sem Exam",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15V35GtxDJ_CHfBUEJrsw8TLG0nGHeWAt",
              "solution": null,
              "nQuestion": "1ZHLsjA5XsFOfJg1o30mhulSpg910Obfz",
              "nSolution": null
            },
            {
              "id": "9df03a1b-9adc-49d7-becf-29fee33b95d7",
              "name": "Autumn End Sem Exam",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1olFRz65n7V-Uzngbv0oSzPeN5YmMrRP8",
              "solution": null,
              "nQuestion": "1lgVfO304O3-IH5ywmTwrROVmn2uXbwkr",
              "nSolution": null
            },
            {
              "id": "36384647-8c26-4165-877d-6600a0033ab4",
              "name": "Autumn End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xAEXqDZewxtVX1Ah9X0ams_bbWKNrAWl",
              "solution": null,
              "nQuestion": "12fP8lm612G2HpibNMm-NWl4m1GPH0Wnp",
              "nSolution": null
            },
            {
              "id": "fb57890e-151a-4096-9e50-a180da48d990",
              "name": "Spring End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hWWYfaBQ7ub1BjzVCWhkLb6Vx2GiW8S8",
              "solution": null,
              "nQuestion": "1iV6egaDQNf0lg5GSXQYamNbDnik2-21S",
              "nSolution": null
            },
            {
              "id": "4003f559-e175-4c7c-8a92-b0831b7d0ab5",
              "name": "Spring End Sem Exam",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "14TunpSwqI55lOIHg2CFq93MLTBKbM9hu",
              "solution": null,
              "nQuestion": "1TYtxVCNDIEoZoGfzR1k3c20x5Trbj777",
              "nSolution": null
            },
            {
              "id": "2138e8cf-6c46-425a-813f-94bb2de03992",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661ae49ca909c6db59a4204f",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1eHCokhrTrzKZJFX9xSXE0RxvEoqDcWEW",
              "solution": "11VIMrlnr3Ox4VwPaFHiCUuVufZz_U4By",
              "nQuestion": "1oO7aTlzQFWW9LxF2CNS270E_0ooMu8HD",
              "nSolution": "1SbUmMACk19W9Epu1fCUNEDkNMi4c9Dae"
            },
            {
              "id": "0b8f4690-1dfc-4c93-905a-877c2e50910d",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65e197b4cc176893883e48a5",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1T0Ka_atfr57Omdg_O3bfENVewT70vk3D",
              "solution": "1Y9RZFhnMF27xd0SvE5AK0vaT3RRbvS_H",
              "nQuestion": "1nuSzAwPJkxCUKJGuU3TZw4u8PZU6UYGW",
              "nSolution": "19WRpHvlgP0X5N22ebkdYQ66kFPvglqoZ"
            },
            {
              "id": "616bf9f4-2a0a-4428-bac2-a6d9071ca817",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1k0KmHjWhLnIVrSr7X_mGiZBWfzG7r5Q7",
              "solution": null,
              "nQuestion": "1JRigax0IuMrHgBSXftfiCVGZ6Rtz4d2_",
              "nSolution": null
            },
            {
              "id": "2183fcd4-0e40-4016-b748-12b8f96e934e",
              "name": "Autumn Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1s6brz_b-CwC61dcpvVi95n53AV43rtfQ",
              "solution": null,
              "nQuestion": "10RuKn8NEBiFYv3hMOG7KtFVsr5vrYTOy",
              "nSolution": null
            },
            {
              "id": "ef5ea0e5-0248-41d7-bc1c-4b294c0db694",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1yLm6oQ1SbvWRPM5qp1Sl-W4GbtOV9IWs",
              "solution": null,
              "nQuestion": "18Ia7EXPtN4DFDqWqIfodPqLjLAiZe7_M",
              "nSolution": null
            },
            {
              "id": "c5728e1e-9502-4c9d-82f0-bbb8f48ec9e3",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1gnu_QAy-lq4qYmsojqGF7X-PD1UXhYFU",
              "solution": null,
              "nQuestion": "1rGjnd_CVE4i7mJLpwW42mZOsTEmqMe_w",
              "nSolution": null
            },
            {
              "id": "57a96a68-d317-4200-934e-40e4b5ff00f7",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1cKVfBt3rUmpLbkp4uUJyZEwsTMBUtvEE",
              "solution": null,
              "nQuestion": "1-INxQZyW6UZZuK9qkSDvp9gakWpEkiP_",
              "nSolution": null
            },
            {
              "id": "89bd9014-f4fd-483b-bca8-f69ad8b27567",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1uqQ0Kua8bC8Jkkn1g95VBBIXX7O8yA0x",
              "solution": null,
              "nQuestion": "1mQK928oJzvHDCIkJOPSMT8EVGmCAQax8",
              "nSolution": null
            },
            {
              "id": "0007ab83-1c49-43bb-85f9-1d6856dbd699",
              "name": "Spring Mid Sem",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15WyBfxHomwiQuvnHwdLtzFVaQhCZTYLT",
              "solution": null,
              "nQuestion": "19Wf_X52H67efDl8YixfKwyBoRqbF8npi",
              "nSolution": null
            },
            {
              "id": "edcf8272-8ef5-48bc-9f1f-bbad1cadefab",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1m5WL7TLubPeDIrVHK9YAky8MPfITaSOP",
              "solution": null,
              "nQuestion": "1k9cohFP_QtNoIVt1WrF0XLmR_kFdO7fw",
              "nSolution": null
            },
            {
              "id": "88c43894-3d22-47e4-9af5-526b4df23dbe",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1eMTwvlnBdE3sHzDFa2pB0jiotwEV9x70",
              "solution": null,
              "nQuestion": "1ykX5VMLzGCJVgUz_8R8c1XnC2jQkOgmb",
              "nSolution": null
            },
            {
              "id": "ea0ee614-98c7-4a43-bd61-0244921d5e2d",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66226263ad6e7bd16c843f8a",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Pv93MlHK98cv27zfA8N3BKg-KxV6RkHN",
              "solution": "1dBkxtYhfJscjdMMhRh0-4nmKZsOB50mo",
              "nQuestion": "1EqvDAAnR-PcGlpYm3RhPHb9au5aGBhFc",
              "nSolution": "1vQNsqlZbNOvobp_Wh0R_sIQN-ABCW9hw"
            },
            {
              "id": "29af2b39-485f-4ef2-84d6-26e0e3627827",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1CxaMHxhbq-rMH780jGKuehPv1-1B6PWV",
              "solution": null,
              "nQuestion": "1D_x3cd98FjiXQeooRbIkc-rBy4TtVONQ",
              "nSolution": null
            },
            {
              "id": "2cbf2e9f-253d-4820-97d3-d8648432fdfb",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66d2044142841c454a166e57",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1wVA5COxfv8xh-lHmb4_9IAI0liS7pbmT",
              "solution": "1_NcKdddo8w2TvCuRAZqrS2_u9hsZT_86",
              "nQuestion": "1SQgvUMHgZiM3BkPsCROrgCRAa3j_QeEx",
              "nSolution": "1PM53s8NgazK32t4ZzNWh7vU1ss4AzPek"
            },
            {
              "id": "cd796f29-3759-4e94-9163-6b2fdbf7a5bd",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6722497f5a965de869c4339a",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13QEmuS4B65hSg8CtItzNL9ZrsqHeKdQ_",
              "solution": "1QGNRptHaNsnFMxA9rEOfnBNyU5DylMm2",
              "nQuestion": "1yFZBzILVeTk2VjUoUc_l-iNlTbY1KBXG",
              "nSolution": "1mfTMu9sCB-NXA791rHW0YWon3r3RQfSC"
            },
            {
              "id": "7a9a3c82-c646-43d8-83ef-ce77a0a38d2b",
              "name": "Autumn Mid Sem",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1qWrr3IVfnQbXFfmluowkTNYKl3pK50Lj",
              "solution": null,
              "nQuestion": "1oSyGsi9Ug3xZY4oMVHvQsjMx5fqTIbej",
              "nSolution": null
            },
            {
              "id": "753b7b3d-a473-45ee-8c70-dea1b474a8d9",
              "name": "Spring Mid Sem",
              "year": "2025",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "18GeUG68Ms5TyrpZqUgxElUPtsLHR7iYf",
              "solution": null,
              "nQuestion": null,
              "nSolution": "1VIpy-jPnu356n22X4Ge3K7eAvrGA9JR_"
            }
          ]
        },
        {
          "id": "65d243b8567cea6553c6b51b",
          "name": "Discrete Structures",
          "SUBCODE": "MA21002",
          "Credit": "4",
          "folderId": "1GVMm-AtPcO7GtRBEZ-a18fOvqRuHCbkw",
          "pyqs": [
            {
              "id": "73970b6f-53be-450a-9546-ff45bc863ab5",
              "name": "Spring Mid Sem Exam",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ze6MSBus3lwMT8IwUoScgFG8Jf08gPxu",
              "solution": null,
              "nQuestion": "1DHTNo3_sGbRbq0HOlw-Wx8Owjb5bhBoy",
              "nSolution": null
            },
            {
              "id": "fc06fa04-48f0-4833-b523-5b8433bfbfd9",
              "name": "Autumn Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JEfFJVgtGafrFmLMv34JMv5e_HE_ePIk",
              "solution": null,
              "nQuestion": "1NsnOfsR0m_-7X5vKWFVKJVvAVw7s5-fr",
              "nSolution": null
            },
            {
              "id": "93f14619-6fa7-433b-9322-9ce80191cb0d",
              "name": "Mid Sem Exam",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1G0S-28HXH7d_QQQE1pZEwzZplewY0Rsn",
              "solution": null,
              "nQuestion": "1Aufvr5unxNw9XShm6J_DY2k7X7iIz9js",
              "nSolution": null
            },
            {
              "id": "702e4079-cd02-4fff-bd61-b5262e93bd5b",
              "name": "Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1koGyDkD7uzONW6v2e5tcrAne33DPAr1D",
              "solution": null,
              "nQuestion": "1ClhzW0rr2UWmXu2uJPDt4ZAA5Fx-E3o_",
              "nSolution": null
            },
            {
              "id": "023130b0-ea16-44b2-b8ea-144c048dc25c",
              "name": "Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NsbPEw8HkCD1Wu1NskJl083463SGI70l",
              "solution": null,
              "nQuestion": "1ZBEkEizOIcEqOrxJZcCaJiNmhNV2Msql",
              "nSolution": null
            },
            {
              "id": "a9bee17e-eed8-408c-9317-b695d363352a",
              "name": "Mid Sem Exam",
              "year": "2014",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1m1vkzZoUq8oztjZJdxvVYlbM4LLHWX9h",
              "solution": null,
              "nQuestion": "1m1vkzZoUq8oztjZJdxvVYlbM4LLHWX9h",
              "nSolution": null
            },
            {
              "id": "184e4c02-4455-4070-a3f4-8c9eccc13ef0",
              "name": "Autumn End Sem Exam",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1LxSRv0QyqR_4ubdbC5Nr9RjcemZ19xke",
              "solution": null,
              "nQuestion": "1PP6H5Uv1u0D2DIUvRzfhgR0sk5N1uAdQ",
              "nSolution": null
            },
            {
              "id": "46cbeb29-849a-46ca-8cc2-7205f87ebb30",
              "name": "Autumn End Sem Exam",
              "year": "2016",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-mw3hZ52qezQd2aaNie62rJo3yyZUsMc",
              "solution": null,
              "nQuestion": "1-mw3hZ52qezQd2aaNie62rJo3yyZUsMc",
              "nSolution": null
            },
            {
              "id": "770e7e7a-c8a9-4eee-ba8d-58f264dbe507",
              "name": "Autumn End Sem Exam",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1is_M8GuhtVFqXlDQJFIsZ91CGoTFFNo6",
              "solution": null,
              "nQuestion": "1ICBZD_nkrUAzhdYGhb_x9huV0GRvknzb",
              "nSolution": null
            },
            {
              "id": "1cb4919d-3dc7-4082-a7a7-3463e026dc60",
              "name": "Autumn End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1jP0KJmS7kkXbwgUJoX8-HaIZev4gyflY",
              "solution": null,
              "nQuestion": "1Qz2b_ErMrGzp-UhSOeB8lDNlPcwwQa1Q",
              "nSolution": null
            },
            {
              "id": "99492cbf-e859-485e-b797-468f05337aff",
              "name": "Autumn End Sem Exam",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pgouTh8LdZnQEfBrrD9GwvXcKOXiLCiP",
              "solution": null,
              "nQuestion": "1aySR8JAGyD3_-4iz5xo6YLuVNjKy2OaS",
              "nSolution": null
            },
            {
              "id": "0b28236d-023e-4863-bb1f-88df6deb7c2d",
              "name": "Autumn Mid Sem",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65da00cf0fb947f5b2547ff9",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1X1uhrwG4aw-GO0diXuLcAfFAlXtme4HQ",
              "solution": "1CHhfckIA6RwSZzUs8vSzPx0CRaZ-Ua2O",
              "nQuestion": "1EQ6vM6aq5_3P5CXlNzZh3IB4O-0te_CF",
              "nSolution": "1NLGCatvsHZThp-fIe_Y2HTourr2Pbq0G"
            },
            {
              "id": "ee37720c-ccf5-450f-9139-0ee14d5ad379",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17ukJpzIdZVLz9G4fIR5o01R2wDWtmj3M",
              "solution": null,
              "nQuestion": "1zq1mdqGxNSD80ixN7kkZ0LcmSAc5siKr",
              "nSolution": null
            },
            {
              "id": "39d9328c-579c-4716-afef-6a3cef2a7845",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pGdWCtYhHxdzBEuAGUF9E4DzgTS6E75m",
              "solution": null,
              "nQuestion": "1WCh8nZMLoJVqquC-SexNAFCzGL-7fg77",
              "nSolution": null
            },
            {
              "id": "569cc320-026e-46fd-b475-092098e445b3",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fbTf8CS5CzQh3KdFxLxf-mZS8JfqC7Mt",
              "solution": null,
              "nQuestion": "1E-pN7LO-Ifq5HH3JYUEHB-d1zC1EBNLu",
              "nSolution": null
            },
            {
              "id": "69253f39-5c08-4d11-932c-2b4e11c4a896",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661e4878a909c6db59a420be",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11KRDDapzhAlAbyb0nOb-BzFjpc8yCkwW",
              "solution": "1DSLm6_bcc0djOWD_rMVfbuFgPgtFKR54",
              "nQuestion": "1xIwesAs5KgkaatskXVbs4Uk7FkCwoDyj",
              "nSolution": "1eoV1DGzg81QbIMJUjlDuy8beOVHji3XW"
            },
            {
              "id": "4e95f640-9c46-4a2c-afa9-b06c55603a68",
              "name": "Spring Mid Sem",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6617f789a909c6db59a41f84",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RXOYT1LNR3tQLEKVa_gkND6xLiJ9g1AN",
              "solution": "1KXURR0fDMFhui7xmcpWpEY7GRnJnu412",
              "nQuestion": "10hohrQYsAMtBaxi0n1L3bOOPogHncQv3",
              "nSolution": "1kYpgcfgK-2WhDEkZIQapmOxttoBB9iFW"
            },
            {
              "id": "3ee099a6-a7f3-4908-970f-d3ea2c59f4e6",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661ebe8da909c6db59a420d2",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19RFPtA2k-mu2hlPm-Mxae2rrTcalBqyD",
              "solution": "1lBYxJ-xWs5j2sHK1mFDMDv6nU5cBQZAQ",
              "nQuestion": "1_IMBai9V91s4oP3GkBNrc_pwQfArZBAo",
              "nSolution": "12Ym6PJpp8uM6cBdtq6X8e0AEO_j3dmrn"
            },
            {
              "id": "c70237d2-aea1-4b5c-be32-7bdfc90e7bef",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66ddd7f642841c454a166ed2",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1eOTZo8_3Fst103MHt_4BrVXOaDowSnVZ",
              "solution": "1ONXSJc92hWFByxcYr-aDFNVgO2qJ9oVg",
              "nQuestion": "1Zkqdh3d6S38Ljq0TV2Jwz7ls1WcJKD4V",
              "nSolution": "1J5Aini_S3PwgNj8C7PQ8LpC_9mkrFdRq"
            },
            {
              "id": "947f438b-138b-4968-92c7-544c489c7089",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xmw-a0VPSgaAiLbBpGmVBwh7tkW4EXpZ",
              "solution": null,
              "nQuestion": "1W-G3MTYC6Q4neR27IDhgBeQp9D6kKKzC",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d243b8567cea6553c6b51d",
          "name": "DBMS",
          "SUBCODE": "CS20006",
          "Credit": "3",
          "folderId": "1KZx4AV-MF0m6qnvwIAyZxDoG7gnTCe9W",
          "pyqs": [
            {
              "id": "2343c31e-c7ad-48b4-adc3-8a0cccac9f3e",
              "name": "Spring Mid Sem Exam",
              "year": "2021",
              "type": "Mid Semester",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RRQPkcaCFzkJsTGVIJMT24VJjWYsOuEv",
              "solution": "1RRQPkcaCFzkJsTGVIJMT24VJjWYsOuEv",
              "nQuestion": "1RRQPkcaCFzkJsTGVIJMT24VJjWYsOuEv",
              "nSolution": "1RRQPkcaCFzkJsTGVIJMT24VJjWYsOuEv"
            },
            {
              "id": "6c2fab5c-421f-4a15-9ee6-fc76408e2b57",
              "name": "Autumn Mid Sem Exam",
              "year": "2020",
              "type": "Mid Semester",
              "status": "APPROVED",
              "solutionUploadedBy": "65de4cf60fb947f5b25481a5",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19HCK7wqDng_kKSuuC8o9pH3fdeZJLv8o",
              "solution": "1SD_C_gSs_Hh_27OfQUorN9SbVZT9sKP6",
              "nQuestion": "19HCK7wqDng_kKSuuC8o9pH3fdeZJLv8o",
              "nSolution": "14zGk1fiXQltIgt4rEjJw5sDJd4RYfggt"
            },
            {
              "id": "24780095-4263-4e78-b92f-1d8bd013db70",
              "name": "Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1u53oxTOEZSUiKcTUiy9EJHNhnDiuSkBa",
              "solution": "1aIG4Kqbq4B7SQewhdgjJseh3wpORxdRR",
              "nQuestion": "1w9BF1L2JPFNFS1nOYVgJZJE6XnCiposS",
              "nSolution": "1aIG4Kqbq4B7SQewhdgjJseh3wpORxdRR"
            },
            {
              "id": "bbfc7059-0ac0-45da-ac33-d30c6191304a",
              "name": "Mid Sem Exam",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17NIbGkHLdz7SEplt1UwMn0pg2JDXzjQw",
              "solution": "1Kq-dHChM6QAs3t_7tPnQtJODvAsjT9S1",
              "nQuestion": "1Z-ImwKzePmQfN0vlrn-XvqvXpy-BrPxg",
              "nSolution": "1Kq-dHChM6QAs3t_7tPnQtJODvAsjT9S1"
            },
            {
              "id": "8d45bb37-317b-4a87-aa2f-0c5c80c243a2",
              "name": "Mid Sem Exam",
              "year": "2017",
              "type": "Mid Semester",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1i8NbmZSAtS3nkQkLi-pKPA2kC7ngJI4_",
              "solution": "1QnLyP8AiWLJqYl2rMNvA8aJatSjWvt6j",
              "nQuestion": "1i8NbmZSAtS3nkQkLi-pKPA2kC7ngJI4_",
              "nSolution": "1QnLyP8AiWLJqYl2rMNvA8aJatSjWvt6j"
            },
            {
              "id": "6eb2bfe2-72b3-4e33-8216-69f67a182b1d",
              "name": "Mid Sem Exam",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1GtJok2w0Z8VMOp3OCPJnh-KHOalE64Mi",
              "solution": null,
              "nQuestion": "1v24PABMaYnhH3B7p4Wx8xUby3lD0-VpT",
              "nSolution": null
            },
            {
              "id": "9136dea1-ad39-4593-a890-91a37a03d324",
              "name": "Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1XhLMXxC8vTH7LDJzJPMilcJv4acMG709",
              "solution": null,
              "nQuestion": "1EhziUlfCnmX8nYafk4e_0ax3W_PEQ4-O",
              "nSolution": null
            },
            {
              "id": "2e051db5-3c6e-405e-a17a-ab95e1e2404c",
              "name": "Mid Sem Exam",
              "year": "2014",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1YX3BDNA_52y_6Sid0Aj2rMx-YNt66Zd1",
              "solution": null,
              "nQuestion": "1YX3BDNA_52y_6Sid0Aj2rMx-YNt66Zd1",
              "nSolution": null
            },
            {
              "id": "eb5d3489-90f6-41a9-9bc7-66afad372371",
              "name": "Mid Sem Exam",
              "year": "2013",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1TRaymrMS74AH-O9HsEu75_bQKH-GV093",
              "solution": null,
              "nQuestion": "1TRaymrMS74AH-O9HsEu75_bQKH-GV093",
              "nSolution": null
            },
            {
              "id": "c39892f3-d449-44d9-b1bd-066a6df82cd1",
              "name": "Spring End Sem Exam",
              "year": "2022",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NRL_vVaO3Xi__vNodcKMLPcc4_WmhQqn",
              "solution": null,
              "nQuestion": "1NRL_vVaO3Xi__vNodcKMLPcc4_WmhQqn",
              "nSolution": null
            },
            {
              "id": "7b3c47f4-f7fe-413a-8f45-edd9e4537cb6",
              "name": "Spring End Sem Exam",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DxS7jocb4I4djw7WxsuegR6XpJhcFXAT",
              "solution": "19NEWa-zY6qvmGl20Oiy-UbI7YRRC-Zus",
              "nQuestion": "1Oq9FoZtpdLb02NqscIBEfSjjShBZRYbT",
              "nSolution": "19NEWa-zY6qvmGl20Oiy-UbI7YRRC-Zus"
            },
            {
              "id": "c7f54840-62bf-45c7-b199-ca18a13034b0",
              "name": "Autumn End Sem Exam",
              "year": "2021",
              "type": "End Semester",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xy1sWmyx7HGqiAyf4Q0JV5uAoSJzi3xZ",
              "solution": "1qpQ_wV0JuvoqEPpxyB9SxYbsZ-qCw4Qv",
              "nQuestion": "1xy1sWmyx7HGqiAyf4Q0JV5uAoSJzi3xZ",
              "nSolution": "1qpQ_wV0JuvoqEPpxyB9SxYbsZ-qCw4Qv"
            },
            {
              "id": "d011a819-967f-4924-9bfa-04c98570a2f6",
              "name": "Spring End Sem Exam",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1A3NjD1-jAzZJMUtf2HDXlvdo_O6Disf-",
              "solution": "1IuADjnImLJQcPLFsW48kEd_Ldn5ahVgQ",
              "nQuestion": "1VHsY_JZ4ntXaX9ISlozOqVpZ8i8VtBc-",
              "nSolution": "1IuADjnImLJQcPLFsW48kEd_Ldn5ahVgQ"
            },
            {
              "id": "e7efb46c-a2b3-4872-a7f8-c1aee0daa984",
              "name": "Spring End Sem Exam",
              "year": "2018",
              "type": "End Semester",
              "status": "APPROVED",
              "solutionUploadedBy": "6622aea0ad6e7bd16c843f9f",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1yxwDaEajmSzXDjU-AGMvi0GDJN4RlMCL",
              "solution": "1w4O0fbs20cmFVCgGrThSHqL8itG7pAVW",
              "nQuestion": "1yxwDaEajmSzXDjU-AGMvi0GDJN4RlMCL",
              "nSolution": "1yDAMhen0dTPj3riyo0syvI00-5QA-oVK"
            },
            {
              "id": "00dfb522-7179-40c5-9979-bf7ebba649fa",
              "name": "Spring End Sem Exam",
              "year": "2017",
              "type": "End Semester",
              "status": "APPROVED",
              "solutionUploadedBy": "660a545c30641ad00aae8ab3",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1nNiT3EXpoScjYOuGa_Dly9QnjBw7E845",
              "solution": "1PTPcCOERi0V5y1kqCXk9CXdI-9G52Tyu",
              "nQuestion": "1nNiT3EXpoScjYOuGa_Dly9QnjBw7E845",
              "nSolution": "1dh2Y6pa60mRu18xXYPKbPeCHMxvQsm9b"
            },
            {
              "id": "a5cd1ae0-b334-427a-810e-627a86dbc82c",
              "name": "Spring End Sem Exam",
              "year": "2016",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10k6rxPUqJksaoTCCy3UAb3uak8zg0cMA",
              "solution": null,
              "nQuestion": "10k6rxPUqJksaoTCCy3UAb3uak8zg0cMA",
              "nSolution": null
            },
            {
              "id": "8cbac1f6-d17e-4e20-9cdb-4b977ed0baee",
              "name": "Spring End Sem Exam",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1K6XYNcElETkyvV2VfArpiuXgIsEaPW5b",
              "solution": null,
              "nQuestion": "15he78drY5DRRGZ0gyDpKWDTXGi5YlQN2",
              "nSolution": null
            },
            {
              "id": "958c98ed-8390-4c89-a841-f0cf71796828",
              "name": "Spring End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1wnWX1BZXdVNuUSy0oZyl--55COI2vdx9",
              "solution": null,
              "nQuestion": "1IVpo6FJa3oc5n9g3I1AwMuHmgb8sjDoH",
              "nSolution": null
            },
            {
              "id": "79db4e50-623d-41cd-9ba8-432c68a074fa",
              "name": "Spring End Sem Exam",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1MV63R46tJlv9LfB2lUjDsOR60OYzhmCD",
              "solution": null,
              "nQuestion": "1ODahIx_qnv8n-jidqAV5JJ-jKJAH1frB",
              "nSolution": null
            },
            {
              "id": "88e15955-a8a8-4ee4-8f66-2fab3d6faad7",
              "name": "End Sem Exam",
              "year": "2012",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1REtZ8JbCbZu3ZLfH139nT7NUwa0W57y_",
              "solution": null,
              "nQuestion": "1REtZ8JbCbZu3ZLfH139nT7NUwa0W57y_",
              "nSolution": null
            },
            {
              "id": "9a4b9223-c8bc-4fab-9c65-d0506ada3f10",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d773b40fb947f5b2547e99",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Dz9ctK-5MEo85eVRUmgGkYIly8QJ3tT-",
              "solution": "1Nw_cFxxmE3qwrIWOAAuGo9hXnXv4kaCC",
              "nQuestion": "1LgE2efF7ZFZ1iXihymRSv3ByggiP9Rgq",
              "nSolution": "1qdzcUAl2VjYHArvlhiw6i_oF9rmxXpCv"
            },
            {
              "id": "ba1c908b-799f-47ee-bc30-07e353d62564",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d773590fb947f5b2547e98",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sGe87yCFV03S31LJNi5A_HbmIhhmOBZC",
              "solution": "1u0lWT1edTdM5-NrkqRK5fhLFTvvpcEIU",
              "nQuestion": "1aMvCc2LFurcfig_igwUbAvEUMIbsXYdg",
              "nSolution": "1gKpdBCOt_s3_fu695NdhS3kusa2DMzlQ"
            },
            {
              "id": "d380051f-738f-4847-802a-d37c61394c51",
              "name": "End Sem",
              "year": "2008",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1TkstoZ2JVuX_m5sKq1YXFZte3Z_tuc8I",
              "solution": null,
              "nQuestion": "1m2t-JtjiAZWE8LnmyKByTR59LhIZQiRn",
              "nSolution": null
            },
            {
              "id": "bd707190-ecdf-418f-b1ea-354225eefbfb",
              "name": "Supplementary",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1nzeB_K6dfe9zPhl5sj-3OvSf6LoCxeF9",
              "solution": null,
              "nQuestion": "19ojfKzO-C5-aHE0TiqMg7wYA6UCIbFhF",
              "nSolution": null
            },
            {
              "id": "340a5eb9-3d15-4dad-a656-790a8d0dc6a3",
              "name": "End Sem",
              "year": "2011",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1r9HJvGRuhz7pPJ1jatO0FJbwi6jE4G7q",
              "solution": null,
              "nQuestion": "1Wfo3JrQufv-Aj5t_HYyMU1qh_3gwoMoo",
              "nSolution": null
            },
            {
              "id": "78f1ace7-d6b3-499c-90c9-3d18d29ef150",
              "name": "End Sem",
              "year": "2009",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1D4mLCRPEqGchaZ6zlbYTlLo5nOedY5Po",
              "solution": null,
              "nQuestion": "1tgga-7MeWLdFkoOUVaieBFMoT3w7Qkxr",
              "nSolution": null
            },
            {
              "id": "fa1850d6-2617-46f9-af79-2fa8ff491410",
              "name": "End Sem",
              "year": "2010",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1LO-M3geLmtTlZLqxhw5k9pNi6-Cvx3u_",
              "solution": null,
              "nQuestion": "1EAIZvpyqPrRdVT1idgz4k8W2hBD272Nk",
              "nSolution": null
            },
            {
              "id": "5d11dcdc-6dc5-4eb8-bdcc-b5b8a431f56d",
              "name": "Mid Sem",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "660e79d030641ad00aae8aed",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Oyn_znldo6ynLygWlFnrij8yoaSYlKhj",
              "solution": "123148Xjgkv-6DU6QpWWJIkJbUoPDSoOG",
              "nQuestion": "1d3SH578MikCGh2wEuyHLVltf8huH6U4p",
              "nSolution": "12_QFv8dqs_0NE-zKpF34OBcPsD9LNnvi"
            },
            {
              "id": "c16a709d-5757-4910-9c9d-0e8800281a12",
              "name": "Spring End Sem-2",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1mlTrggQvJ3LsI_O5HMsSixgwhdbYOn9-",
              "solution": null,
              "nQuestion": "1wwsBldHt0pPYzeqjCwdaBZt3CgFrTn2T",
              "nSolution": null
            },
            {
              "id": "a3614561-63d7-4d22-b632-0451317767a1",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Km_HBWxuB4IgW7YaaOn5Hcyy8crPew0k",
              "solution": null,
              "nQuestion": "1fmQGWMY1rh_n7IqXG73T2y2vVON0tk4T",
              "nSolution": null
            },
            {
              "id": "458db8d3-8474-4b5b-a644-56f42068517f",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PrUiPgsQU14s-T28gWmJqXhQl9E1waMz",
              "solution": null,
              "nQuestion": "1tonPP0fDc-c58tnw0ndArJtcJIMEbOPm",
              "nSolution": null
            },
            {
              "id": "52353771-ddd5-41fc-8b5d-cbf6f5f56997",
              "name": "Spring End Sem-2",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BvxjHnAdzdO1gpxEZ33LhjIC6PRoEPWa",
              "solution": null,
              "nQuestion": "16C6qxsUAmwlWmjMh7FI9i_GAhj277gfo",
              "nSolution": null
            },
            {
              "id": "b9192116-a735-4ee2-9a90-b3ea3c27183b",
              "name": "Spring End Sem-2",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1x8YbR5QXZyh6lTwy7ugxJalV5G69fanz",
              "solution": null,
              "nQuestion": "1DCjRjtz8cjf9uthlexbPSWiSONcPy3oc",
              "nSolution": null
            },
            {
              "id": "0027cdd2-6873-4760-b287-66d794acdc80",
              "name": "Spring Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1gXAR1hpSBXLY8cyuxkibOvmh5-5kFK4B",
              "solution": null,
              "nQuestion": "1X3m2Rvbb24uIPvPq5BpnVgUdb36AfBiN",
              "nSolution": null
            },
            {
              "id": "9989f278-59f0-4afd-bfd5-dbf1b62a8b4a",
              "name": "Spring Mid Sem-2",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ZScBvkwHDOcnUUVQU3BsUlikviS100iN",
              "solution": null,
              "nQuestion": "1bL8BPhp9MGiYy_t5rhf-bqLXGX2vtTSW",
              "nSolution": null
            },
            {
              "id": "790d5bb0-399a-42a3-a11c-ad8ae35984de",
              "name": "Supplementary",
              "year": "2006",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17lxTaqL2E4ZrOZbDe6EV4WMMIjmHpTfI",
              "solution": null,
              "nQuestion": "1DnX8uW8yFahCMK3dfUw4J1SZmf7Br-Np",
              "nSolution": null
            },
            {
              "id": "440d76c8-8a5a-4255-943c-ab1a9edfea0f",
              "name": "Spring End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1g6GpvOqwHQLRDgU1KvFxbLfAPjhwCp4F",
              "solution": null,
              "nQuestion": "1yJQ7TYv2-8PiAGtmTXSlApDyE9M6spna",
              "nSolution": null
            },
            {
              "id": "329b35da-a462-464b-930b-8198b26aa327",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661ebbc4a909c6db59a420cf",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1zUKfS6WuIrbCFHx3V_Sax_4kteeP-MDN",
              "solution": "10TmaxNFrwRm3JJh4y1_IRESbroocO4Vs",
              "nQuestion": "1wWVpFUOSK5qhMya2-KciwKJ_b-V9Lt17",
              "nSolution": "12mrJXSASeqfFJ9AV7YgyUdrf55nzJ7Ep"
            },
            {
              "id": "ea20f34f-ad56-4006-83e4-629d547e4b4f",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_6XlHsk4Sa2sqKoYgbiqwmbhY81roFfX",
              "solution": null,
              "nQuestion": "1myAriEVqjFETm4M0MyyO6CwcZgOGkIqA",
              "nSolution": null
            },
            {
              "id": "c13544a4-9604-4d1e-a4e4-4c5a0aa16df4",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17_MoK2WcvB3VjLKEODytLLlI4MqBeK2S",
              "solution": null,
              "nQuestion": "1mPgR5ZKiwDnSjbwrhkHe2ohjpmFM2Aer",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388706",
          "name": "Mathematics Part One",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1fK3Y0G6B7CAPbn4mx7lBWAkHCqIkgype",
          "pyqs": [
            {
              "id": "851defab-6d3c-4b85-b441-dbfae96d109f",
              "name": "Question Bank-1",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JYx2xGtlnwd-qLdHHlKL_ooh2AKEV0IW",
              "solution": null,
              "nQuestion": "1TF0BXBJACF5KXngadfKlvuade0rKl5ug",
              "nSolution": null
            },
            {
              "id": "7432ff99-2c68-4fc0-a135-3f20ff540bca",
              "name": "Question Bank-1",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "16EA7r2gdVNeAJf3rd5xs7hhytOdfCc1w",
              "solution": null,
              "nQuestion": "1YIw1b3z5n007o_1nZVU7loThRH13dRL8",
              "nSolution": null
            },
            {
              "id": "9507685c-7d42-400b-ba41-1b1fc1cc3469",
              "name": "Question Bank-3",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Oiu_a3n87I1RgmCwtIsRKbsD3VbpSCKz",
              "solution": null,
              "nQuestion": "1fd8y1TXM7wWkAJ3YL4V6v6rk67eAUPuV",
              "nSolution": null
            },
            {
              "id": "15bbfaba-6662-4956-8f02-e5493e0ed656",
              "name": "Supplementary",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1WsJEokXfn99RryRpZJtwt92NYjwRIMnC",
              "solution": null,
              "nQuestion": "1oniNtQwqNWemc_exGDOC4nOB9wF2UBHe",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388702",
          "name": "PDC",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1_g2wUxttNOi6xwTlywnmQb-3IBadfi9v",
          "pyqs": [
            {
              "id": "2c61db15-64c3-4118-b197-92ce4bff6db8",
              "name": "Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1KzFjcRu3ZQCU0WHSU6lMfj5pBPx9V1Mk",
              "solution": null,
              "nQuestion": "11qjVPNHBMzj-MRr3wPluaCZca0z8cpvp",
              "nSolution": null
            },
            {
              "id": "5cd30cf7-40b4-4cad-b0fe-b45ab42e4581",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1aC79LXDkyYlAW2CYDx6vYmD7Ozcd9bwa",
              "solution": null,
              "nQuestion": "1_biB_pr8UruGJXLU-ZAtrTvx-E77xqmK",
              "nSolution": null
            },
            {
              "id": "eb8aa09d-0124-4c4d-87ba-79dc49933fe9",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1lOvBhfSHinVx10KzIjJysxZYSi3_f_Ow",
              "solution": null,
              "nQuestion": "1gEhKaLZ6NmnsWcfFNx88xT5ot3YjcLbk",
              "nSolution": null
            },
            {
              "id": "9f11fba6-c24d-42fb-8f92-63c1b3138ce3",
              "name": "Autumn Mid Sem",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19VSi7COc2EFWVmNbKj6xnPELygTh_LsQ",
              "solution": null,
              "nQuestion": "145dNy_lfwoTRpeadmpeThXln1ZrpNcKE",
              "nSolution": null
            },
            {
              "id": "3a523b8c-7612-4415-b473-e80366190bbd",
              "name": "Mid Sem",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Ppd8rCdPAKdun3a6I_w4F0CDYS5_z_dV",
              "solution": null,
              "nQuestion": "1SfzvzPE5i-SqnZPXuEtjGZ0elqWRtKG3",
              "nSolution": null
            },
            {
              "id": "ac0651fa-1f8e-46f5-a5d2-17eed5f55e91",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "18STtCQ6aHO5DMUpjmHiWk9I-7_7l3ZYH",
              "solution": null,
              "nQuestion": "1DY3jjjbEpJLmvrqo3dep_P2lJ0LQKAbh",
              "nSolution": null
            },
            {
              "id": "de8c836e-a25c-40da-a8b4-cd2b2e322841",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1QVsJDC7ORttTZkZ8GpA5NPSclxC0ajSg",
              "solution": null,
              "nQuestion": "1FwiIzddtPqlfuU6xZLjB6NYSAsDQo0ZF",
              "nSolution": null
            },
            {
              "id": "d27e39b7-1796-45f5-a5c0-9cfca18f187e",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1y_o9GlSn4jrmQXRz8gZcZA7AAyzN0fg6",
              "solution": null,
              "nQuestion": "14QY966aHVmWIsr2oINZTGs3sEEooU-iP",
              "nSolution": null
            },
            {
              "id": "ad18f46a-6a0b-42c5-87fc-b39f7f6e6c5f",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1mAnAX8gkjEv2ZCw4j3CX1s5pONne7RQQ",
              "solution": null,
              "nQuestion": "1nUkzJQv5VDxBDbTdntacFUqJj5X2gFF5",
              "nSolution": null
            },
            {
              "id": "0f1678bd-c54c-4590-af2a-89b8c0e90397",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DyxoczkDm44DTQXuM6Bta17Jhy5GMAq5",
              "solution": null,
              "nQuestion": "1g7gSr0O7-vBzcYi38ZWOlKIyibwwgKHh",
              "nSolution": null
            },
            {
              "id": "8662733f-1ee9-41db-a10e-73329ee98c5e",
              "name": "Mid Sem",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1oBr6RCVKVXc-QsTzfcRxlS4F-6A4eE4M",
              "solution": null,
              "nQuestion": "1BRplDKQGWY20UbQ2pzAn7ze6O-z8xMAY",
              "nSolution": null
            },
            {
              "id": "912f5ffb-3d51-4c96-b359-0efe89a25bca",
              "name": "Spring End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12xU_quv6aMRg2ReqXnTyHoyQjV681m6c",
              "solution": null,
              "nQuestion": "1WBnBE0Weua6edwFFenTgw7l5TuK_guo6",
              "nSolution": null
            },
            {
              "id": "7fa64683-2b63-4655-9c81-b137e4900f1f",
              "name": "Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1WRGNQ1NsbAXT09X5QUtz0Lbue-sNydET",
              "solution": null,
              "nQuestion": "1CsuG4RB7jWdUIjnvnwBa-TEnRfFSf0B4",
              "nSolution": null
            },
            {
              "id": "0dbe2f06-1eb2-4230-9fe3-4970632bba78",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Zwe9N7sYvVcdaN6ur_gq44CyFgPZOEsQ",
              "solution": null,
              "nQuestion": "10O6ubqEeZvnkhoGxBXfttv0XsSV-7_og",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388703",
          "name": "Engineering Economics",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1Oa9LozaddgRGjuv8trM0qyZJmBGfrd9h",
          "pyqs": [
            {
              "id": "1b86051c-5db7-4cea-8003-337db1dafe27",
              "name": "Spring Mid Sem Exam",
              "year": "2019",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hFIQ6TC4Ew1yQT4lbn2iqsAfR3bCx1YX",
              "solution": null,
              "nQuestion": "1hFIQ6TC4Ew1yQT4lbn2iqsAfR3bCx1YX",
              "nSolution": null
            },
            {
              "id": "64fee409-875e-4a04-b653-cf5f8495927a",
              "name": "Autumn Mid Sem Exam",
              "year": "2019",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "177PdKYg7x4C_xuC17ZfwMx7-TVHn031l",
              "solution": null,
              "nQuestion": "177PdKYg7x4C_xuC17ZfwMx7-TVHn031l",
              "nSolution": null
            },
            {
              "id": "675b7ee2-7a41-4ef3-b7f8-e68ed6cf7d60",
              "name": "Mid Sem Exam",
              "year": "2019",
              "type": "Mid Semester",
              "status": "APPROVED",
              "solutionUploadedBy": "66eaf475f740b2b3e5002cb4",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1LeS1clos_Fs7OSD2LcBlsHTJ-qgMsxlr",
              "solution": "1G9UjV2ryBWbzwhnUDAcHoBiRCPmaEv5Q",
              "nQuestion": "1LeS1clos_Fs7OSD2LcBlsHTJ-qgMsxlr",
              "nSolution": "1NctOcIZSRkPuD8Ny7MJX8D-NGQTszhuC"
            },
            {
              "id": "fc4e8e88-f905-4f01-b05e-c78abb55252c",
              "name": "Mid Sem Exam",
              "year": "2018",
              "type": "Mid Semester",
              "status": "REVIEW",
              "solutionUploadedBy": "66eb1f2af740b2b3e5002cc7",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JofUj7qRdiluC1SS1_jTTAHkMX6aF4D6",
              "solution": null,
              "nQuestion": "1JofUj7qRdiluC1SS1_jTTAHkMX6aF4D6",
              "nSolution": null
            },
            {
              "id": "1064c97d-0e02-4f69-80b5-50130f260691",
              "name": "Mid Sem Exam",
              "year": "2017",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1icZUixC42opxXdTHDnZZv2PIys8hqmNv",
              "solution": null,
              "nQuestion": "1icZUixC42opxXdTHDnZZv2PIys8hqmNv",
              "nSolution": null
            },
            {
              "id": "55efc7e9-83a9-4716-965a-23846791082a",
              "name": "Mid Sem Exam",
              "year": "2014",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1oqPNCYF6s_dTg12inaHj_JQoCLPB86fv",
              "solution": null,
              "nQuestion": "1oqPNCYF6s_dTg12inaHj_JQoCLPB86fv",
              "nSolution": null
            },
            {
              "id": "cbb3a14a-7336-47d5-b47d-6f53dfd260b4",
              "name": "Spring End Sem Exam",
              "year": "2019",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Rb3ygo1yA1hYyMVFB1CBEWOb5qbOMzrU",
              "solution": null,
              "nQuestion": "1Rb3ygo1yA1hYyMVFB1CBEWOb5qbOMzrU",
              "nSolution": null
            },
            {
              "id": "084d30c2-1535-409e-ba1e-e48e769e3ecf",
              "name": "Spring End Sem Exam",
              "year": "2018",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Ac65hf5WMutExsX94KHxymE7Y8YcdCTA",
              "solution": null,
              "nQuestion": "1Ac65hf5WMutExsX94KHxymE7Y8YcdCTA",
              "nSolution": null
            },
            {
              "id": "ba75bbb5-93b2-449e-9114-fa5fb6ff4c53",
              "name": "End Sem Exam",
              "year": "2012",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1qj99kUnpdy0L7ZnfmY-XJLX56zwQ9fXO",
              "solution": null,
              "nQuestion": "1qj99kUnpdy0L7ZnfmY-XJLX56zwQ9fXO",
              "nSolution": null
            },
            {
              "id": "8c229edb-dd33-4302-97d5-ef84f55c9aa3",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661aa954a909c6db59a42032",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1q7FemfyQx8ynjgC6eEyHReAq66UCuUvf",
              "solution": "1sY9AHtdR6vYWiEsqURr1IpFiyUz0UYtk",
              "nQuestion": "1FK1hMEKetqYKmboj_9uw6hmoxUp3m4gX",
              "nSolution": "1-17j_7p_vfyv4tKttZ2FB2AopYARXEpA"
            },
            {
              "id": "cc6cb8c2-e0a2-48c0-89e4-f05d88f3330c",
              "name": "Spring Mid Sem",
              "year": "2021",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "65d70189a226064c68a248db",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1KexCzwSFjWbnzBVCOY5tvHPXprgLWTyj",
              "solution": "1Z7ZH-RxXahmnAy6ZSV-Q9drpxzoZf_0P",
              "nQuestion": "1duwH7xFcxGdwK9N6kljQEzXVzb_Q9Q68",
              "nSolution": "1dhslv3xvbjG3oSrJeUNcp4RxB7NFOdIe"
            },
            {
              "id": "489a14e0-7d60-410b-8b9d-28f8e488a272",
              "name": "Spring Mid Sem",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "REVIEW",
              "solutionUploadedBy": "67c73de355b9f267bcab9fe7",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1IGKz77KMxdTHyzdBIjUhO2g1Oi0sPHkc",
              "solution": null,
              "nQuestion": "1Rk2admKHY-wBFmCaYotpDEg1dQqNXDmx",
              "nSolution": null
            },
            {
              "id": "98864e04-897c-428e-97d5-3089a865c3c2",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15CtyhY1GRQNL9fxQCfD_iptXYZ48PUBz",
              "solution": null,
              "nQuestion": "16e33qPjSezu8wsyv6cCoPt6KBsAjfo8t",
              "nSolution": null
            },
            {
              "id": "495f1df2-1bb9-49dd-befd-4b97f0bbf129",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1T-JrbpdATi5NxjSD0dey_5-UzW6OeJQ9",
              "solution": null,
              "nQuestion": "1038LATgLdl6XVgUnpJ3nQGmK3IfIQLLO",
              "nSolution": null
            },
            {
              "id": "878303e5-5197-4e7f-b5d4-de4da0d1cb1a",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721bace5a965de869c43382",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1rX0q3MpSNAV0aNBG6wEOBM5T22Bvdc78",
              "solution": "1rJwPrqwusfCdv3M-xyk1dGuLhqX_89gy",
              "nQuestion": "1dOBt2l2ZKhkbmvvcpoZ22SNHpZFGsrcf",
              "nSolution": "1FtJcJGS2Y-Qsa2Jay4zZYI9fcs51spAF"
            },
            {
              "id": "2ee34786-d579-4f96-ac7e-ac7abc4d40cf",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tzk28EUo50sfCW5RW3JPwxE9bRHhjO8y",
              "solution": "1xHuTOkZHMFhZDIIUodkQrftP3n6j0CFr",
              "nQuestion": "1qph2CGS6s9L_wd53A6mOsCkCceGzyeag",
              "nSolution": "1JbiIhpg9RgDcAZjHz8jKLUFnOXGh4301"
            },
            {
              "id": "438097a1-7a2d-4f5c-8968-7618d0843c32",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1z4C4sR82aHWld1nRCU3BBGilLdzYush8",
              "solution": null,
              "nQuestion": "1gF-vdd9DEaDNosRKwSC1043NX5iG6O_r",
              "nSolution": null
            },
            {
              "id": "183980f1-2479-49f7-8556-434d6b2e83ab",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15gbQd5J3dJVAvFRmL_JtC5oQDHMa1Aos",
              "solution": null,
              "nQuestion": "1mYq0b3hDnkjPzFHralvCXqT-eApT2jPk",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388704",
          "name": "Mobile Computing",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1ZjCacSY5rPV65uI0bs61VwqOKeKjfXcj",
          "pyqs": [
            {
              "id": "a98bf354-b688-4129-9a4c-a4d59ad6afbd",
              "name": "Mid Sem",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1j4q4nVicbmtCG2FGMw2iCkaIGWLDwbBq",
              "solution": null,
              "nQuestion": "1vax2z5eaTilq3pA-IQIofP-vT1URrWYt",
              "nSolution": null
            },
            {
              "id": "e188c83e-d0b8-499a-b433-6991e84030af",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BsLDkwygdck6G63T_mYbRsM3aKdn-qEb",
              "solution": null,
              "nQuestion": "11LyHE_gnfjBH6Sr-JL1MnD0ui2fJNGdP",
              "nSolution": null
            },
            {
              "id": "fe6cfdbf-260b-40bc-840a-42995ca99f91",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1S5yPp47gsFxwkju1YbpRQLJ3e-RQ7HnR",
              "solution": null,
              "nQuestion": "1Qh0Me8Bnd0mM7Cmh10l3eNUb2QHYRt9P",
              "nSolution": null
            },
            {
              "id": "a5c54705-b9eb-4647-8fc1-7a592c8929cb",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1uMc6BBhEfQ9-6YkjKeuLtXMR3AFQXvNE",
              "solution": null,
              "nQuestion": "1IfS6e7L1Kv7lVsG1IjUMU-UlazaUm0AI",
              "nSolution": null
            },
            {
              "id": "fe2d233f-53f6-4a56-a695-3bebf050e73f",
              "name": "Spring Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HBQSJZAHMiaE_xifjb1-MevDKP2vzpz8",
              "solution": null,
              "nQuestion": "1WTOacIXFbYszIf9wB2n_jG0kWNMsH0Wh",
              "nSolution": null
            },
            {
              "id": "ab277429-9d8e-4660-aaa1-1899efd34566",
              "name": "Spring Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1arkJzjVT3_1_MX8Ke2Y_wG3iknHYhXfc",
              "solution": null,
              "nQuestion": "1-pL0YCXZTo2xo-g86ewpvbz_6v4kAVes",
              "nSolution": null
            },
            {
              "id": "5229043e-b8b4-481f-b454-62e5e736e3e6",
              "name": "Spring End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BbfBAlLaPWJe9ezdbYwFkTD8nLGLFPeJ",
              "solution": null,
              "nQuestion": "142sdKNvNQZbd7Yx0ukh2k5DdnR7pxHYa",
              "nSolution": null
            },
            {
              "id": "12cdfa20-3589-4ef8-a6d4-4994487e0421",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RDrSscw2YkBm_YMZJFCLhO1PGhX6yngI",
              "solution": null,
              "nQuestion": "12W8YXc1uKqkya2JYmv9hoyuqN5gxFGYb",
              "nSolution": null
            },
            {
              "id": "80f49a41-4d73-4cd2-99aa-59c107440000",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Y16bUQmQ4pbamUVpwXLG4uJvPvFQTm5y",
              "solution": null,
              "nQuestion": "1PjqHgMV6CYVfW9-RAgkh47gVGr07LHG8",
              "nSolution": null
            },
            {
              "id": "cb0f1045-76f7-440b-9f59-dbe2c3b4dd8e",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-nwqNETeehW0vgHiP74_q-QSlRiNqXWF",
              "solution": null,
              "nQuestion": "1OlPCV8c1vXKr7IN1T3hIAeOxnmC75zcR",
              "nSolution": null
            },
            {
              "id": "ce114b0d-8b4f-493f-b892-04b7fc9f73d9",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ixoYw-GfzXmXpmadk0es6AfZjeyee22v",
              "solution": null,
              "nQuestion": "1NU77ll5IvomJjesQiAypaop89EoqCt1_",
              "nSolution": null
            },
            {
              "id": "df3e9cd1-1281-49d8-b7d9-95a0c0ea2fe0",
              "name": "Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "193fZru0CvpjMluNqZr08RKYk-ICX81El",
              "solution": null,
              "nQuestion": "1C-DDdYPJb9mV9g7ifiBx_640jsCv5SAy",
              "nSolution": null
            },
            {
              "id": "013afe05-9a76-49b6-868c-22887564e04b",
              "name": "Autumn End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17583RMBMY01wd4muw_a648p8ypD-fGOx",
              "solution": null,
              "nQuestion": "1ejNpKJjVW8J7eiDAwTlQuFTDPJ0Y-n0q",
              "nSolution": null
            },
            {
              "id": "27ddbcf6-d055-428b-934f-41b5cadb97d1",
              "name": "Autumn End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Si6S7guksMAxX46PC7jtNmvHNqmrhch_",
              "solution": null,
              "nQuestion": "1OrY1m51DHGpAvFSc82dK5Rosy3d1iiml",
              "nSolution": null
            },
            {
              "id": "979c9be0-c3c1-4175-8862-9acf3f7a6819",
              "name": "Autumn End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1KGFp-0YeZ7YO2oIRUyJSi-NNJJAbiPqK",
              "solution": null,
              "nQuestion": "1ay1KR3MzKmX9h5JxD7tRWQWelnmsqLJY",
              "nSolution": null
            },
            {
              "id": "6906d138-3e6d-4c95-a1fc-ee9da9380c27",
              "name": "Spring End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ZGLOcGnonyp97jh-a7Iipyp17uQIRZIV",
              "solution": null,
              "nQuestion": "1NXK2YidmlPywjFaDBS1Rqvt3f_uiv0lA",
              "nSolution": null
            },
            {
              "id": "17ef2614-800c-4090-9629-eadfeee1cc40",
              "name": "Spring End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1IE0L43qSZqqWfQHiG2E_-84r4uU5yObM",
              "solution": null,
              "nQuestion": "1yiU9lAORCDkEghFVgjG9oxmlAyY9HxsE",
              "nSolution": null
            },
            {
              "id": "43446d4c-770e-46b5-a691-67b136303795",
              "name": "Autumn End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fgoVyi_6J_sc3-QDX19FIWorWEf01ZDW",
              "solution": null,
              "nQuestion": "10ksM0KzSHk58c35JfUG7HLkBlsQSsOjT",
              "nSolution": null
            },
            {
              "id": "75a7d951-50d7-48e8-bc03-6ff59b7deec1",
              "name": "Autumn End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_QlrU1EAGS6fJNgV4Ge2UOSSu7mExI3k",
              "solution": null,
              "nQuestion": "1btcJedTb5id4PeawGhzGNrzJ75C4vlt6",
              "nSolution": null
            },
            {
              "id": "8b5522c0-1507-47d4-9dd5-3b0335177a42",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "14hv9RrRDzbYf3j2Z6b85DyMiAOIu7BmC",
              "solution": null,
              "nQuestion": "1j5e0os2IWp58Ed5DqLq9IQePeojy9M-o",
              "nSolution": null
            },
            {
              "id": "d92319fa-ec63-4e2a-bbd5-497d0ba107e9",
              "name": "Question Bank-1",
              "year": "2012",
              "type": "QUESTION BANK",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1aTN7lu4JpvwopT6YhOtBZrxJ6Klpbggo",
              "solution": null,
              "nQuestion": "1g0DZJtfspvRhmiXnOMOv6HW2d5H1cc-O",
              "nSolution": null
            },
            {
              "id": "55756034-2796-4c00-ab4b-6a193a97b12b",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13q1-EtqtqWgkrrYkau0pAX1Jl2RFcJ7N",
              "solution": null,
              "nQuestion": "17hWUybJ2806SNH4EO9cFfwG2CYpGV4Lt",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d2d560883f3cc80638870c",
          "name": "Cryptography",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1BNytYhnQL7tzP3GsW4PGbL-nIaLGs8To",
          "pyqs": [
            {
              "id": "ec3802f5-bdbd-449f-91d5-b384ea1d88e0",
              "name": "Mid Sem Exam",
              "year": "2019",
              "type": "Mid Sem",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pzARbmVxfsufVCUYR7M-ZfOZGTIX6WGN",
              "solution": null,
              "nQuestion": "1pzARbmVxfsufVCUYR7M-ZfOZGTIX6WGN",
              "nSolution": null
            },
            {
              "id": "3d511507-6d6c-4437-a3b5-01b6afbdc201",
              "name": "Makeup Mid Sem Exam",
              "year": "2019",
              "type": "Mid Sem",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15I9XBwulzDJHGvfznmYRmRaEB_mciIdo",
              "solution": null,
              "nQuestion": "15I9XBwulzDJHGvfznmYRmRaEB_mciIdo",
              "nSolution": null
            },
            {
              "id": "f0c71007-a49a-446d-8658-417daf498e77",
              "name": "Mid Sem Exam",
              "year": "2015",
              "type": "Mid Sem",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1QQCb0ub7-2p7qoUbAu0iwB5L3cd2Wl1y",
              "solution": null,
              "nQuestion": "1QQCb0ub7-2p7qoUbAu0iwB5L3cd2Wl1y",
              "nSolution": null
            },
            {
              "id": "3a43c41e-6117-40cf-abad-0772e78ecde3",
              "name": "Mid Sem Exam",
              "year": "2013",
              "type": "Mid Sem",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1G1ZBdW3UD4x7VfDY8452tHXgEKZY3SsI",
              "solution": null,
              "nQuestion": "1G1ZBdW3UD4x7VfDY8452tHXgEKZY3SsI",
              "nSolution": null
            },
            {
              "id": "8311d416-fdf2-426d-8748-4132b6527530",
              "name": "Mid Sem Exam",
              "year": "2012",
              "type": "Mid Sem",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13RC-tBo8dswJ-C7TlfOm9rYmohnE7zih",
              "solution": null,
              "nQuestion": "13RC-tBo8dswJ-C7TlfOm9rYmohnE7zih",
              "nSolution": null
            },
            {
              "id": "a350ff00-6cc5-47dd-aa2b-9932753b99eb",
              "name": "Autumn End Sem Exam",
              "year": "2014",
              "type": "END SEM",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1j8CWHPtDufFeWUAPr5BBmsBqAMsSNTMC",
              "solution": null,
              "nQuestion": "1p-pVvG3EgU6ZH7xsB4_xI8Uh0sBQZ-WX",
              "nSolution": null
            },
            {
              "id": "901fe5df-c706-4fca-9057-c6c63cb3c8f8",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15wdrPqqXSHzENMudB9CKEA-Agd7I7Kd3",
              "solution": null,
              "nQuestion": "1atzBmsUeSG-MHigTCV-pqhKuK6fMveXR",
              "nSolution": null
            },
            {
              "id": "057cd077-3e09-43ff-a2ad-1025874d4276",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1qTdO4oOieNnp3bktJdfEKVDSOzEKH0Bh",
              "solution": null,
              "nQuestion": "1faXGO0rOkfUpbvtRczOjuI3agqpgV1WF",
              "nSolution": null
            },
            {
              "id": "9a659084-62d2-4109-879b-66906d882d0b",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11_7Pol3pY24fdjFqb8dTWeQZZYC9geZ3",
              "solution": null,
              "nQuestion": "1i_nUWMopT5J_n09MPA3t3_mDbK5sHxF7",
              "nSolution": null
            },
            {
              "id": "a0b07e2f-78a5-48e2-993b-bb5021ee90ae",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1SLJL-H6ukFnR31lCjxeL_doEy9NlgZiS",
              "solution": null,
              "nQuestion": "1rcjcYGuNgcalSRsAsNg8O2eFwsoIlPl_",
              "nSolution": null
            },
            {
              "id": "4bb69e19-c583-4c94-9558-1b5b4330e5c3",
              "name": "Autumn End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NQMIyyJlGYrPT98PXKnIXg2TgRF1ORS-",
              "solution": null,
              "nQuestion": "1OPyjFq1KoQ_8A8yH67oGyjA4dbHzLjQu",
              "nSolution": null
            },
            {
              "id": "794a30d8-48b1-458d-8d8c-5b45503ae88e",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ALg38fqAi4cwY72octksG_YnKpwR2wB-",
              "solution": null,
              "nQuestion": "1-jQdqFmTC925VxxiUdQf6Npr34utdhtq",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388707",
          "name": "Mathematics Part Two",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1ijtbnk99agF-HeZICyzKZWLMf-5gMgNa",
          "pyqs": []
        },
        {
          "id": "65d2d560883f3cc80638870a",
          "name": "Computational Intelligence",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1Rxofy0k6CWIMtI66E9bca_IhIWURwsGd",
          "pyqs": [
            {
              "id": "01e2d2c4-98a3-4e6b-923e-0a4fa21522ab",
              "name": "Question Bank",
              "year": "2020",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Ln3SsVCBWTfYxUQTbLhvkyzZnKU1cirT",
              "solution": null,
              "nQuestion": "1Ln3SsVCBWTfYxUQTbLhvkyzZnKU1cirT",
              "nSolution": null
            },
            {
              "id": "286ebedd-81dd-43fb-acc8-994cf26a0967",
              "name": "Autumn End Sem Exam",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1vZVOoPUG5Sl76_ZKznuYR3dzlO9Bt78n",
              "solution": "1KCHRSFeNgxxoupfD3P7GY-GXhl0RXQix",
              "nQuestion": "1B4gJRfamtlLgQ4lhAvdVEN3f1uZIbet8",
              "nSolution": "1KCHRSFeNgxxoupfD3P7GY-GXhl0RXQix"
            },
            {
              "id": "0e839f17-fdd1-42ba-95b2-736f6c61dc29",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10LbI3SLVBwybieaPwB7ZnW33dWBZchQm",
              "solution": "1jhcrrktlcp9EbdnjRila80-ZmWieYyhh",
              "nQuestion": "1kn2csRya8d-J63EX3DPNeO9uUuLTUAPt",
              "nSolution": "1R3gErROqI7fqueYXnnk-cOW4uO8-TRJp"
            },
            {
              "id": "69c409f5-fdc9-4d12-a9a7-b89133392cdb",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Myc_H3LABKgHI43NyaF42KCmbLTi-s1I",
              "solution": "1_UxJfA9VGYvrn6gSqclewix68vmSyFtQ",
              "nQuestion": "15ko67JqjR-IA7WMYAM0WJeHfTqpwnKu0",
              "nSolution": "1rb-G0pJXs0W9_tt15TCrsLAyUOCeFgG7"
            },
            {
              "id": "0581be94-59b0-4182-ae9a-da4f432c97bb",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1TuFvEVH3xFRgVVty9etTVKiV53Tup1_D",
              "solution": null,
              "nQuestion": "1OEm2pqdAg8XKqHuAseMUXMWTsnsBFW97",
              "nSolution": null
            },
            {
              "id": "6534a7b2-cea3-41de-9637-88328fde82ad",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "14BcwLbKd7CUMLn57EhE00LftqwRLla6p",
              "solution": null,
              "nQuestion": "1bujNMKAwQoBUnMnn965-IUSDRiyVtcpM",
              "nSolution": null
            },
            {
              "id": "6411c11d-9e4a-4e98-b999-8e39a87be5fd",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JkypPUOQVZCJINDm0e8PL1C6FFBaEOSf",
              "solution": null,
              "nQuestion": "12x3-Gp0s8UQrj0HTq5UT313R-CIFPIME",
              "nSolution": null
            },
            {
              "id": "7fab7824-a328-441d-8ffc-5349e1214f35",
              "name": "Spring Mid Sem",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1oZ_GCsJ2Znne-I5YXqzpBi859F4BDfZX",
              "solution": null,
              "nQuestion": "1T4T-OYyP2ur9LfPvBvKKVdPyEhWmFoEd",
              "nSolution": null
            },
            {
              "id": "c9daa2b6-e404-4278-8a12-9b3cbc35eece",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1gcRV1li4Sc1NAhfvSv-_oj8PI-DunehJ",
              "solution": null,
              "nQuestion": "1QVF0-LjOX_xtqZSRgQKJbbMgudwSTFqx",
              "nSolution": null
            },
            {
              "id": "25e8ba94-a9e3-4dfa-848e-1d94ce0a01b8",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1GuOVVeHWOCio59u_j8ppucmnIyRWxcPa",
              "solution": null,
              "nQuestion": "1SlZF-sMvegQEwN7CcTEPZ0iv59v06KYr",
              "nSolution": null
            },
            {
              "id": "bd8c5f3d-9046-44eb-adcb-5dfbcbdec456",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1qGrySWDUak9Tq7cbpxJdCogWNMG7V35t",
              "solution": null,
              "nQuestion": "1QWIOartuT3eT_dtrkCEqPeMdOhPa_AFw",
              "nSolution": null
            },
            {
              "id": "b9ca50df-5110-49cd-8d27-dd6f0a9039f7",
              "name": "Autumn End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1mfKMbxEbzZMI2rgH2UrSfz_iy1tzZ3fI",
              "solution": null,
              "nQuestion": "1LXife_oAcFl7A9YoPz9fVPos0e7Pmw-a",
              "nSolution": null
            },
            {
              "id": "257c7ea6-f390-4bb8-8053-68c9bbe3b10d",
              "name": "Autumn End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "10RGmatZJXn0EEG3rrecuBTI2noBA4Wqj",
              "solution": null,
              "nQuestion": "13h9IMAXYxR56_OWMVgCCrviI0m1Okq8M",
              "nSolution": null
            },
            {
              "id": "ce1b4825-32bb-4985-b04c-8710a60a858d",
              "name": "Autumn End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1m1WzgA-B5vnQq6ceGNUM4N500eEwiBST",
              "solution": null,
              "nQuestion": "1zPNDjsiVT-WHaRcK4tKCF51_CCx9gftq",
              "nSolution": null
            },
            {
              "id": "525a8252-f0de-4537-9719-b8077b0d692f",
              "name": "Spring End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1jRrpcbLWlatHfEi4t7Hutq94qffRp5Hi",
              "solution": null,
              "nQuestion": "1vKyGGIcu7H2YJ3kg-jCuni-Pk8u8Nzid",
              "nSolution": null
            },
            {
              "id": "746df26e-c536-4291-aee0-2160924ba792",
              "name": "Spring End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1vKn_SjPN3FDiAZEW_B9OSNGeJcZGSCly",
              "solution": null,
              "nQuestion": "1kBa6QAGpx8FcgrJZi2zIKg61MND9qymA",
              "nSolution": null
            },
            {
              "id": "513bd2a0-bb0f-4450-ad46-cda4f7c58b46",
              "name": "Spring End Sem-2",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Ld5_LFeExVjAv6wwDDb8lEN4Opndcbug",
              "solution": null,
              "nQuestion": "1w0EP5QX4x1_67KP2iqG-Ri0RCSOWsbAH",
              "nSolution": null
            },
            {
              "id": "5fa83ef7-db1e-4c9e-8872-04a9795d6d86",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721b69c5a965de869c4337e",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tY-FYxAAbaLQOjEVZtY6e0RvVpnXLZMG",
              "solution": "1pg7b-Bdg2kUDsC9mNcpbtsyXhjo5_AL_",
              "nQuestion": "12ssptRIwiXuE3c1WgC-Hj-JdxfayDowq",
              "nSolution": "1zfpLt8rGy9LHdnY0Ev-sSovYivc6g6bm"
            },
            {
              "id": "46d276cb-d227-4177-9979-3893fbc4f783",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1O5a6chZj3iWt36am2kCVwxfZgRSpo8t4",
              "solution": "131kMkhMfXPmIsZbrz7ZeXDJB9F5cQsnK",
              "nQuestion": "16jPoMld2HFUVm1aQXjuj2XTMlP0LkrSI",
              "nSolution": "1TGhA-yM2uQ6hxcIBV90WhmnQhW_7eizQ"
            }
          ]
        },
        {
          "id": "65d2d560883f3cc80638870e",
          "name": "Object Oriented System Design",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1mVLvby58htZvt7YqnG0esDQyzqU6HLRx",
          "pyqs": [
            {
              "id": "aeb95938-9b94-4c9b-8da9-698acb13750d",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1T698q4TsXfjX0CcBDZ34unH_zkVLEzTf",
              "solution": null,
              "nQuestion": "1Vv7RCAlTXR0YC82wjqZyZ-_4Mv9SP4sc",
              "nSolution": null
            },
            {
              "id": "979a9e11-908b-4ab9-a1cc-64d7fe6988f5",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13Up0dEKejLmD1kJ_JvSaJHOdMFqL4Pg3",
              "solution": null,
              "nQuestion": "1tPSksyMQplgNAni-ogoShcgxhUZu3rvg",
              "nSolution": null
            },
            {
              "id": "7a241340-364d-4fc5-afc0-cd7b9622af21",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tlfktJwMJ83c1Zt12KtuwBPaUMn3cj4n",
              "solution": null,
              "nQuestion": "1jOsyW3jrMmq6BSLU9t6-p3k5xT8ibVOI",
              "nSolution": null
            },
            {
              "id": "a9a65106-40c2-4769-84b3-a15e3eefca68",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Sykz163-Dv93Zx09ihNMAIJIndoWYIiQ",
              "solution": null,
              "nQuestion": "1PRIu-zdPRqkWDXv_fo8eCuxCsxDWCuAU",
              "nSolution": null
            },
            {
              "id": "c0b2eb1d-e2fc-4a1b-ae33-a3dd4497646a",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1swByU7lvV6gW8gJGltJ5m3NSfKg8a1ra",
              "solution": null,
              "nQuestion": "1bekAAWvZtx9pdMOCKE4RCSb36HjgYO5b",
              "nSolution": null
            },
            {
              "id": "cf9e0f95-92db-4aa1-af9c-d85bb6e3b81d",
              "name": "Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19pE2Roun2NnI_3hrOpstOjq_t4IzuhiS",
              "solution": null,
              "nQuestion": "1vJ2J80RuttWg0UpIfZ7irwfXjX_DlVAk",
              "nSolution": null
            },
            {
              "id": "1f32307f-ea4d-4f96-9191-0dec2958df1e",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1CEbBHFjtPeT7mlyntCAN7romDnCNfKAQ",
              "solution": null,
              "nQuestion": "1VODNOE981h3Csq4jZz3le5Cus0oliPrD",
              "nSolution": null
            },
            {
              "id": "559b26f5-9a28-4109-ac7f-4bbbd1b09225",
              "name": "Spring Mid Sem",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1XqanUHKknVMTw6IJatFCa2KBn9ZYXERE",
              "solution": null,
              "nQuestion": "1xMEbK5yGovxq-cQdvH48QoNBxUwPcyIx",
              "nSolution": null
            },
            {
              "id": "6a0ad6b8-7a0c-4348-98be-5a19b82429b4",
              "name": "Spring Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sT8PkFK7siqvzofsL6r3-WCVGkPiKUfc",
              "solution": null,
              "nQuestion": "14p4ucEpkaS0tmUsacFo27zC9yahoDivh",
              "nSolution": null
            },
            {
              "id": "bc5a3ca4-7594-46bb-a674-d1de0c564d53",
              "name": "Spring End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1qsWwAfhkzu-XcnMoMbGwHmIzzVt-IXdF",
              "solution": null,
              "nQuestion": "1JBQtkLbR4nc01wyoeFQLgPdjWPNbEVy-",
              "nSolution": null
            },
            {
              "id": "e81e01ba-3338-4ead-8079-9c7291189c0d",
              "name": "Autumn End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1jcLxif9-o3uk1bI0vyTV6oD4zNj_hdJj",
              "solution": null,
              "nQuestion": "1CLfUo3HOqtW0LdGPm3GnnnyA36-ziZ4b",
              "nSolution": null
            },
            {
              "id": "35e5f9fa-7bee-4ec6-a907-e04096f16ad1",
              "name": "Autumn End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1WwYAQv9DR7C1f2YAkzmavYzCGWm9Fwf8",
              "solution": null,
              "nQuestion": "1DQ3dc2KAXMVZo9jvzBdGa3Q7uMm1V7na",
              "nSolution": null
            },
            {
              "id": "7d660402-da85-481b-a834-8b7e138d512d",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1o41o7nX-_9vQvcfIHNN9ZztclNoHSzhM",
              "solution": null,
              "nQuestion": "1I6LJycnxD5ewjTNtt25C8HuT0sGVhAwZ",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388709",
          "name": "Artificial Intelligence",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1N4NfPNlHGIiNtuoMoI8BKhJjf8ftHzaA",
          "pyqs": [
            {
              "id": "343874fe-bc2a-484f-bd54-2d5ecb01a581",
              "name": "Question Bank",
              "year": "2022",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Lo3UW5ID3_YANd_zgzjFDFfBUWu-s52c",
              "solution": null,
              "nQuestion": "1Lo3UW5ID3_YANd_zgzjFDFfBUWu-s52c",
              "nSolution": null
            },
            {
              "id": "aa96a1a9-af11-4b0a-a8a6-0b727228ad83",
              "name": "Question Bank",
              "year": "-",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1MMKJOFeBj0KReq4HwDs_OpO2do-CZeQZ",
              "solution": null,
              "nQuestion": "1MMKJOFeBj0KReq4HwDs_OpO2do-CZeQZ",
              "nSolution": null
            },
            {
              "id": "049dc852-7a27-4c5c-84df-1ca23e4ada71",
              "name": "Autumn Mid Sem Exam",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "67425caf5a965de869c43705",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1g4EP4J7WTaS6LvkJbJva3nupGRM5_R6E",
              "solution": "12gRxj2ioqT0s5fX3QsPVYTgqvw17hl3D",
              "nQuestion": "1UCEmBAar5ITj119hhe3Tz5D2ftNqtDsY",
              "nSolution": "1_gL8VjmKnlT1lMaAos3sywo_QEldSEAt"
            },
            {
              "id": "51a9e1de-bc2b-4720-b07c-b38efdd97b28",
              "name": "Autumn End Sem Exam",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1IUhvHM9UlCUXhMAYa41c-lLue78m8C2c",
              "solution": "1wk6MnQou6uonQ9PbLfxEnKyDVJr5HAjW",
              "nQuestion": "1bbtRRS2aftLnuFVhBm-EqcPD8KAr9TW3",
              "nSolution": "1wk6MnQou6uonQ9PbLfxEnKyDVJr5HAjW"
            },
            {
              "id": "2192405c-4811-40e6-8e33-4aea2a2488c9",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1u0JUAdkTJ7x91dw0Opm2-Zdw1rVetumU",
              "solution": "1Ovyi-pAF4Fof1gXcfN4I4EH3e0hocsxd",
              "nQuestion": "1wW-68sb6ROxSnlRqVpMtA8K6jgIK8fMA",
              "nSolution": "1_Vqc7yy177XRmkjDtz4Hicrvx_W36Pd-"
            },
            {
              "id": "bf7888e6-115f-48c8-9f5f-c7165fb07c9b",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1B2Pk725mWEsGml6eeZ5hAI_fO6vNwCBy",
              "solution": null,
              "nQuestion": "1BxiAp6E1cvgqf1ixI9-LDlKLSq6asScE",
              "nSolution": null
            },
            {
              "id": "cea0c007-0dd4-426d-a7ff-27d4a782200b",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pr_hG2zul8JffGCNEmeiJaIHcpl6R-s0",
              "solution": null,
              "nQuestion": "1wDZ0w6glFfaY2p7AqegqOl5OMJsCd-yk",
              "nSolution": null
            },
            {
              "id": "237a63bb-b633-45fd-9cd5-e4137a048231",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1WBGBXxxNcEwWedA0bLgfgCsftRXueVIx",
              "solution": null,
              "nQuestion": "1LqZRfjrHbxDMPhloPTHyN_-z_PboNtA6",
              "nSolution": null
            },
            {
              "id": "7791a080-52dc-44f6-82ae-39ae636e072b",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NMPiTSVvzp9_5N7kc3w-AeMTv7eLWVkH",
              "solution": null,
              "nQuestion": "1vKx4cID5TfWH0PHOUnGt_f4Wm6xA9L_r",
              "nSolution": null
            },
            {
              "id": "e6181b01-5fd8-4764-97c4-c31dcb39ca21",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1I2I__kl_PJfhKqBy71GAVmZHkP2JrNYD",
              "solution": null,
              "nQuestion": "1X5lKQAeZ5NcWOHgc0S3qPt3l3xit8jkG",
              "nSolution": null
            },
            {
              "id": "c8b897fa-f7de-4b00-a2b3-de87761ef4f0",
              "name": "Autumn End Sem-2",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1veXldnvFTa-BLLqM0Eihm4YtZz6d5hmU",
              "solution": null,
              "nQuestion": "1Rrq4aqKIKXcWAmPFXhoP9PcFW9nVbsY2",
              "nSolution": null
            },
            {
              "id": "c2959e9e-6e54-4fe4-810e-70f08086e0ec",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1saVljWwsL_kPr-s6YYNg9PdJ7m2mkOLW",
              "solution": null,
              "nQuestion": "1P5bArtAE0A1XEJstQv7VDOayehzVG0Le",
              "nSolution": null
            },
            {
              "id": "252a5156-9447-4f74-84c3-aad1084d4080",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1W8tPQIPne3jceeTWeDVCNv90tuKoEMMH",
              "solution": null,
              "nQuestion": "1aCLmRydS-JHixA35Gjgrr3ZsEDRmO9VH",
              "nSolution": null
            },
            {
              "id": "c5bea2c8-e454-4de5-9d68-9f94b2063146",
              "name": "Autumn End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1SCVyl7zIEwRuuIv2OMmMqiLNlBJP9Xbw",
              "solution": null,
              "nQuestion": "1M0V8OeFzYuAYDhaJ5MMpWy19-DFnkGB3",
              "nSolution": null
            },
            {
              "id": "b5c2afd8-3b6f-46f5-8faa-9bd53480c1f1",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-yRYpKMu5DEHlgfRw-_HYCFz9yF9dCwx",
              "solution": null,
              "nQuestion": "15rQUhKg8ZuLqfTFqyRIfWqs1m8r15qRQ",
              "nSolution": null
            },
            {
              "id": "c750519e-4322-404d-8497-31c96eae80ea",
              "name": "Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11oSwb3FRS0WI4MJxlsJJPOUA3Bl8a3Ye",
              "solution": null,
              "nQuestion": "1oK4XqGdvFMPUkUzH58dKO1Nlyo9F7smx",
              "nSolution": null
            },
            {
              "id": "15db7bbe-d6ab-47b1-99d8-f7ef1cea8a86",
              "name": "Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1jnMJlNuh2w0te6hdlOrR2ZHag8QaKxb9",
              "solution": null,
              "nQuestion": "1jmQtRc3D_Hs41z_9OEwg_BMO4_AR23OH",
              "nSolution": null
            },
            {
              "id": "fc72073e-b20e-4fef-8b7d-e2cc3203417e",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12I7d-QkxKpD0Abh126j3sFiRSvH8Uhil",
              "solution": null,
              "nQuestion": "1qop2nF-xoWPvsHOD2wWfmqpul7m6uoqz",
              "nSolution": null
            },
            {
              "id": "826f7a42-ed9e-428e-9f44-7a19b647d5b4",
              "name": "Autumn End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sPitFlI1gthiSoBdqMr9-JXfHo1yvuo3",
              "solution": null,
              "nQuestion": "1kaUZQY6IqTkfbgboHISYZQof84DxwTRJ",
              "nSolution": null
            },
            {
              "id": "108c5ef8-c8d2-44d6-9420-cd58bd5fdee0",
              "name": "Autumn End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1quPWNT_wdDMe7gXgYQXEGKxWPAhpSZQj",
              "solution": null,
              "nQuestion": "11DBxevG9bhH6KDx2lYw_A17Enf6ZiQuK",
              "nSolution": null
            },
            {
              "id": "5bc58221-1e33-4b06-9f38-046c38df6180",
              "name": "Autumn End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ZmKGqh4AkIAL7_F4gMIHf83JzIXdryGL",
              "solution": null,
              "nQuestion": "12e95CxRZmYzi2lOjgD1sRNZW78JlO6z9",
              "nSolution": null
            },
            {
              "id": "0503d24e-11bf-4a8e-922c-40a8eb85002d",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ubFInomCTs1dY_cN0Ar1AP2yGI6giHK5",
              "solution": null,
              "nQuestion": "1ywAej1U_1pv_l8TBDLDqEmQyBvdlKdl5",
              "nSolution": null
            },
            {
              "id": "8f9cfe0b-51f6-4ef8-9e62-936e5d4842b6",
              "name": "Autumn End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1gsbOhDfl3_6J0hrAtmq8-y2ytuea12_T",
              "solution": null,
              "nQuestion": "1luDFGG7QD1GPZIUOfofAstRf3W02KCHO",
              "nSolution": null
            },
            {
              "id": "2a768b80-0478-47d5-a0f3-dc9f0c68bf88",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Lu_SgChKBZZmvQ-j6StQZ7MsWskeNhCV",
              "solution": null,
              "nQuestion": "1CcBhpsTVdz_yHROwtujXibXPhLiYztpn",
              "nSolution": "15zSDrG-TKf3dNSuXNTlvsp8sbPImhSES"
            },
            {
              "id": "f62990b6-fb6b-43b9-9d18-b2c7fa9a5d88",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1lJ_yH7ubFpna503wUld9hFYtLMak6ApK",
              "solution": null,
              "nQuestion": "1SWzx71SGuEbY6xtAh0djdkLz9HdrOKFh",
              "nSolution": null
            },
            {
              "id": "97cfbbcc-e095-46ca-85f3-a3a03c2ed4e3",
              "name": "Spring Mid Sem",
              "year": "2025",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fOurXOZlJy69YXEFHo-jA-cw49Um8prq",
              "solution": null,
              "nQuestion": null,
              "nSolution": "1VfqX7pAfA2KIXaSBcL9N904rlUxzV1m9"
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388711",
          "name": "Information Security",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1hcXdDMYj4GfVLx5JkKrMFAs7IBCMHant",
          "pyqs": [
            {
              "id": "a249c14f-cd72-4e35-8977-9450214b6220",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kNpvJi0ljcGlVn5v0GAmPxPSet_g1zVQ",
              "solution": null,
              "nQuestion": "11ne7ZLOICSXjod5iA_M67cUEegylL7z-",
              "nSolution": null
            },
            {
              "id": "69ae8f0f-e80f-4e2e-8d89-26eab224e930",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1iI5wlOWSgdUS6uru9AWu_VYhNHZ8gOY1",
              "solution": null,
              "nQuestion": "1P-Dk8MHYnh6qO1R3oP4pGz0QfYlCr2C7",
              "nSolution": null
            },
            {
              "id": "a37de03b-673e-425f-bf7d-141e55ab6619",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19BoCX6mYf7kRAzE0VwmgjoCZgIYxgDr3",
              "solution": null,
              "nQuestion": "1Sz7nRGDi9VeFtBr3dqEIfrHVO1rC8Pq7",
              "nSolution": null
            },
            {
              "id": "f456a3e5-59c0-4102-888e-ec070656ff8d",
              "name": "Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xA41k9OyD5ca3Dmy86jlyWEEc5ufDeYp",
              "solution": null,
              "nQuestion": "1-uBUDBtj2WCVyrWi6hkIjAhyhJZaZ2cR",
              "nSolution": null
            },
            {
              "id": "2132856c-e859-4181-a8c5-43cc5eaa469f",
              "name": "Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1UfmC5s4mVEKBMaUk2LX_iwFbZIzKnwdP",
              "solution": null,
              "nQuestion": "1jJP3G-XWVXKNUsU3ESpQLamwqMzwnnNp",
              "nSolution": null
            },
            {
              "id": "44444703-6220-4aac-8471-e0a5d8073197",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1SvJ9BVhvdaIOAm3ELYzjrMZgOoUIczQH",
              "solution": null,
              "nQuestion": "1QZlRfrQJVnGuCr9tMkjTpapqM53UX6Eo",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d2d560883f3cc80638870b",
          "name": "Big Data",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1lKozSt66GymMKwb_rBNYjq7BkvfZUalm",
          "pyqs": [
            {
              "id": "811840ad-2679-47e6-9e0a-938397468b59",
              "name": "Midsem Question Bank",
              "year": "-",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15TdRbQbxo-_qcoZ4fyqNgoSGRZWroFOI",
              "solution": null,
              "nQuestion": "15TdRbQbxo-_qcoZ4fyqNgoSGRZWroFOI",
              "nSolution": null
            },
            {
              "id": "e5549a1b-b2d5-4f23-bab9-a738f480630c",
              "name": "Autumn Mid Sem Exam",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1VBZF2r_qdAcC3pKVRZRM7cKNkEBsJeDf",
              "solution": null,
              "nQuestion": "1gng2SuZhbW-3rZn9ejl8FinkIxJXPgXp",
              "nSolution": null
            },
            {
              "id": "cad96831-6fb3-487b-9c3a-e85d0b2bd044",
              "name": "Autumn End Sem Exam",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1uNJnu2AQShveb0UqftPbZsMP5lXDcCJ7",
              "solution": "10z7GWm5Aq1VQbvjskAvcTyZD029QE-Sh",
              "nQuestion": "1WBFg7efDQlF2-izPxNTQu1fkNGV3zelP",
              "nSolution": "10z7GWm5Aq1VQbvjskAvcTyZD029QE-Sh"
            },
            {
              "id": "d38623b2-a6eb-49ba-8757-e6dbf9863225",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sC0rzuyj8821f1DUEPEnCW9DJP0xZRbl",
              "solution": null,
              "nQuestion": "1bp01bH4LiGem55NmHt7sVml6blW4sWLa",
              "nSolution": null
            },
            {
              "id": "e2ff021e-bfee-4f34-a0c9-f68aa22f5a89",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "661aab15a909c6db59a42039",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_8N8o-yg5ACePcOQqWxZQZWKtU6v5ybw",
              "solution": "1u_mytFVxJQahpTvKEQFTaa7MEOi4N_59",
              "nQuestion": "1BqkoM7WXcu0wkofkusQ4ToCL3biK3om0",
              "nSolution": "1H_wR-tTf2SM6lE3AnxJcWPqVMvyX6F-7"
            },
            {
              "id": "63cfb3ea-1c28-4fdc-b0be-d8e8fd7d7873",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Xx_5cxsCWvYonAyLNckK-3DmyGxaTht4",
              "solution": null,
              "nQuestion": "1ZpKMrFX3iE_5eaGJzsbTytWGsLdj2q5H",
              "nSolution": null
            },
            {
              "id": "99911c8c-85e1-44a8-9f6e-44479e25cacc",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "16Houty3LW0D8IiLetcjrK6J08VfQU40V",
              "solution": null,
              "nQuestion": "1wwKZYi61W-Efj6ITVFreCaOtv2Fylt_5",
              "nSolution": null
            },
            {
              "id": "2edb95c3-e153-4324-8ee1-087d2b2072d4",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1r8KRsqWVhtAkR20Q5pgTQGYOhDykzvie",
              "solution": null,
              "nQuestion": "1lLZSZMTKVG_HgZeJjFyXxWnm6NtZXXQT",
              "nSolution": null
            },
            {
              "id": "be6f6392-548b-44d3-b634-feb116189706",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1n6jdUYNWSjnny41wtwX0_UVEFqqk_Wid",
              "solution": null,
              "nQuestion": "1Lb57WeP2R0OFfcsYcV4vdGKH_Z2Mrt3Z",
              "nSolution": null
            },
            {
              "id": "224d7c07-5612-4646-992a-860b2e690ee9",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PFgAymgXMcM_z7UGQnbcieOgaWl4BJ4T",
              "solution": null,
              "nQuestion": "1Demt1k4WF45Mix3vEjmHfD4rQSedJlYc",
              "nSolution": null
            },
            {
              "id": "df378b7c-f1ca-4635-b673-4e58174f4725",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1L23BZvnq_1LTwhQt0YyNNH5MBU8prhYQ",
              "solution": null,
              "nQuestion": "1KXHYcc4eet-Euu5gOLFsYV6Qn2V8jDEE",
              "nSolution": null
            },
            {
              "id": "28ed49a5-019f-482e-bf8e-77df522b2f78",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fG2D2bMF_8mlyAJrmuJl0rfhO4qx0g2h",
              "solution": null,
              "nQuestion": "1AasCKDdECA1SE9VdklXER2_DcgAOCVGp",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388712",
          "name": "Object Oriented Programming",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "15pDYCocO2-z-dqnEnbEcH4uAea6VtH-V",
          "pyqs": []
        },
        {
          "id": "65d2d560883f3cc806388705",
          "name": "Communication Engineering",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1OMm3igXYbV13ul-zLmSLUc94xwhS2Pff",
          "pyqs": [
            {
              "id": "e886a2e9-2e28-451c-8a78-5e8df86c21f4",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1nA21hOi9698qjJs2Ht-OUVYOR9FHFVd8",
              "solution": null,
              "nQuestion": "1x6XQw2afvLwBmPqxzxss2HtK-hx14ZxY",
              "nSolution": null
            },
            {
              "id": "ba373af4-6f3a-43ad-b8d2-614359f7197a",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1OvLWVjDl1BjlMIIB6Rc88FHwYY0wQgU3",
              "solution": null,
              "nQuestion": "1nTz8Pdna0mB7eOPtQsDg6GKpWhX6m19w",
              "nSolution": null
            },
            {
              "id": "4c7eff7e-4244-4316-a96a-4f5159432995",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "14hMLOXrU_DY5KNOLIiH40xJkozCMsdwN",
              "solution": null,
              "nQuestion": "1RWIONoRE_CmwuM65DSfti5BiPkQbwSOO",
              "nSolution": null
            },
            {
              "id": "beb39c74-ee1a-42d4-bf49-1e004d24daf6",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-_tWVcOFspvRDnYFYnkJJ12Dq-CcKF7X",
              "solution": null,
              "nQuestion": "1dWrvax2C3ocgfhcaIfFSMCVCwk1tcart",
              "nSolution": null
            },
            {
              "id": "299a21eb-8d87-4023-a4aa-962f14287cd5",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1M0UmveGBaVp8nCix4sTbaByhWpVH_E4I",
              "solution": null,
              "nQuestion": "17pUNYJ7aV944zlKtSdVb3yW8ur4j0GKl",
              "nSolution": null
            },
            {
              "id": "37e20c38-56b2-41b6-b749-5dc75cb66df3",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1SzIe9-H2PL9PoIWyJB5mDW_ljz2cMeHs",
              "solution": null,
              "nQuestion": "1VVzINVwoYvPvFbiW1e7qntgR1Tcpu9hZ",
              "nSolution": null
            },
            {
              "id": "f691cd84-9b87-459c-a560-9307a3e5d868",
              "name": "Spring Mid Sem",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hoMF4GrSWJ4pCwgzFUHXNoaSwK2f8Or3",
              "solution": null,
              "nQuestion": "11XodFcteaT1V95yU0nzPHya7xfNXpU3A",
              "nSolution": null
            },
            {
              "id": "d3845c44-2ff1-4a8e-bbb0-4675d1d9de71",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Qv8sQ9C_sjrVZ2osCzEG554-7My3XwWM",
              "solution": null,
              "nQuestion": "1cR14lETINmcwTEDBFUnLzm-3k7BsMPKG",
              "nSolution": null
            },
            {
              "id": "e3031c8c-923d-49e3-9f6b-c834e33629b6",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fZWQwnIZhuxCsL-cvzUQMva5dw9Yp9d8",
              "solution": null,
              "nQuestion": "1NOkweDQh8EyRKGx3P5XkiCWV3wIfVmVE",
              "nSolution": null
            },
            {
              "id": "ac2b502a-0663-4dc5-b1d2-32eea065a994",
              "name": "Spring Mid Sem-2",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1p9d2YG0OvQiT-JkmRyvxvis0afCrKeui",
              "solution": null,
              "nQuestion": "1MF-Rx5aPkMq85oZU9ler0wt-uuHvOb8O",
              "nSolution": null
            },
            {
              "id": "01fecc11-1b6b-4148-bd43-5db678c84761",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1OJhCQepJk13eQ9Ua69BgNovBwMLZEBiL",
              "solution": null,
              "nQuestion": "1VKYojgLwrwnOijomGsGeYKdcXFErAgNv",
              "nSolution": null
            },
            {
              "id": "0fc86de7-50ae-4382-ba50-63f72c73d0e3",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "672249a35a965de869c4339b",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DOI41lWTruOObbJcrO0zFEmzKqqHoLvm",
              "solution": "15H4JhyhfXSN6V2yix88Trzpu7WJHsoKe",
              "nQuestion": "1NdQlZimLZzdZn16DDMS_NCAvH5N-Nq_w",
              "nSolution": "1O4Y2AXTzuY0aBfOusPliL4MCY02hSewx"
            }
          ]
        },
        {
          "id": "65d2d560883f3cc80638870f",
          "name": "Data Mining and Data Warehousing",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1nOYMihlN8Er2_13Xd0FQdmdwH889lCuu",
          "pyqs": [
            {
              "id": "2a9e77ef-364f-4e5f-82fe-11fd17620cd5",
              "name": "Question Bank",
              "year": "-",
              "type": "Question Bank",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1amWkcoly5gog98NMctjSVSkNwjTmLJCv",
              "solution": null,
              "nQuestion": "1amWkcoly5gog98NMctjSVSkNwjTmLJCv",
              "nSolution": null
            },
            {
              "id": "e22ecbde-794e-4558-a7db-9343d3192f5a",
              "name": "Spring Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1A-UJrR-uSQtGCOu5Pjweh2rKJeCAufdR",
              "solution": null,
              "nQuestion": "18F2-Z7z23m56HWz5wEcLlaJ7AYSIaTkF",
              "nSolution": null
            },
            {
              "id": "2705707d-2c94-4760-8fe8-4481a4268cd2",
              "name": "Autumn Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hty3HiV2n45F2O9kLfRPdnZM5KeW2eTE",
              "solution": null,
              "nQuestion": "1M0mgBZ6MEBn2mpbSG343BskUml_S9hn5",
              "nSolution": null
            },
            {
              "id": "ee0c5c04-cfba-4314-9336-93dc15cd41cb",
              "name": "Autumn Mid Sem Exam",
              "year": "2018",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1YszFSAvrGjlIMJb0Lh2BfihYOKXt13q-",
              "solution": null,
              "nQuestion": "1YszFSAvrGjlIMJb0Lh2BfihYOKXt13q-",
              "nSolution": null
            },
            {
              "id": "fb613a4f-d521-49aa-a213-306b043c1327",
              "name": "Spring Mid Sem Exam",
              "year": "2016",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1A2JNJo2iaiM1TQmINYIoz7I-4WBQcocg",
              "solution": null,
              "nQuestion": "1A2JNJo2iaiM1TQmINYIoz7I-4WBQcocg",
              "nSolution": null
            },
            {
              "id": "c97a38c2-467c-42c9-b068-9afc3c004976",
              "name": "Set 1 Mid Sem Exam",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1WQqeaUwQhsxxLV1YMbN0sY1z94M4y9AW",
              "solution": null,
              "nQuestion": "1EGIveLG1grXFRiP8q-nIH5XUkLxiuAmQ",
              "nSolution": null
            },
            {
              "id": "763140c2-d88f-465e-b64b-092e09fe3feb",
              "name": "Set 2 Mid Sem Exam",
              "year": "2015",
              "type": "Mid Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17sGbSPpGcUqVT5WCjToPJeuGUF_gLBiv",
              "solution": null,
              "nQuestion": "17sGbSPpGcUqVT5WCjToPJeuGUF_gLBiv",
              "nSolution": null
            },
            {
              "id": "9eea3f72-debc-4904-8472-6508d928a170",
              "name": "Spring End Sem Exam",
              "year": "2018",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1SFXV1c8wxZ8YVZbBFhbCFfr-85FVOH9O",
              "solution": null,
              "nQuestion": "1SFXV1c8wxZ8YVZbBFhbCFfr-85FVOH9O",
              "nSolution": null
            },
            {
              "id": "831cb180-5656-4a68-ad75-5c808e1c5b1a",
              "name": "Autumn End Sem Exam",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1gxvVVFfrFeLry9KQOF41o6hQ5yLBceoh",
              "solution": null,
              "nQuestion": "1jVDffrjHhaLgcGIDcU9pGXggnHNLggri",
              "nSolution": null
            },
            {
              "id": "7f96dba3-eb21-4f10-9d54-655bccd541ed",
              "name": "Autumn End Sem Exam",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1k0skgOk60VgfmcbxZvOmzrtPZuNuMFGV",
              "solution": null,
              "nQuestion": "1bRctRBuQDHoGNdWWDKmS3NJ8vbKEVlq2",
              "nSolution": null
            },
            {
              "id": "e7f19bf6-5b44-408d-aa66-eb8c61e3be09",
              "name": "Spring End Sem Exam",
              "year": "2016",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1zukHA6AZ9CIo5vLNmJJf1NNBEvifrfmx",
              "solution": null,
              "nQuestion": "1zukHA6AZ9CIo5vLNmJJf1NNBEvifrfmx",
              "nSolution": null
            },
            {
              "id": "4b84332a-b373-456d-a1dc-53eeeafb8f45",
              "name": "Autumn End Sem Exam",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NTezMnoEuVUBp9GJQ4SyDrsEYVxJm1Tu",
              "solution": null,
              "nQuestion": "1VgM4hPLicCXgbojvK8t_dXCEy_FZtkak",
              "nSolution": null
            },
            {
              "id": "5e13137a-e4ae-4c7b-9987-627f7f44814f",
              "name": "Set 1 Spring End Sem Exam",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1vx4ro_wSNmjvmaO5F_crIN76_-ulCum7",
              "solution": null,
              "nQuestion": "1aYvxwlaTJr2RE2oCrR4Gsp4EH63otc7Q",
              "nSolution": null
            },
            {
              "id": "7a0fef5d-c467-4ba1-bc14-6a34cdf693f7",
              "name": "Set 2 Spring End Sem Exam",
              "year": "2015",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fsvKbru20N5WeAtuOMJNJsbG8C1UunUH",
              "solution": null,
              "nQuestion": "1fsvKbru20N5WeAtuOMJNJsbG8C1UunUH",
              "nSolution": null
            },
            {
              "id": "d5848347-e1f2-4566-8647-8794f928d58c",
              "name": "Autumn End Sem Exam",
              "year": "2015",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1d1EPVCl-xtHZNA3992m0UiNbV32FPHjL",
              "solution": null,
              "nQuestion": "1d1EPVCl-xtHZNA3992m0UiNbV32FPHjL",
              "nSolution": null
            },
            {
              "id": "db8b8b96-8ea8-473f-a311-df9c9bdf0956",
              "name": "Spring End Sem Exam",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1VbScQALTIrVnr_l-4obLd8gmIlfrAYRi",
              "solution": null,
              "nQuestion": "1PZsM9Yrukdarz956mwOfxvEbvzPTU4nG",
              "nSolution": null
            },
            {
              "id": "d9de10c6-65a1-498f-87f2-a8f9c95e4134",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "104F8wnsO5jvUqhOS7OnZhXOKO4xvez7I",
              "solution": null,
              "nQuestion": "1eEI8WdayQPdUlR2h-dyABc9bmzPrqGW1",
              "nSolution": null
            },
            {
              "id": "8dcd958d-43e8-4567-a98f-5097dd6b6854",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15Tn8sz4uUHd8WCR0IIQWMfq1rpgsL-FI",
              "solution": null,
              "nQuestion": "1sSIpQoAZlAoLZmrWTx5LMcXMS9239X86",
              "nSolution": null
            },
            {
              "id": "b0459a6d-2239-4aba-b88e-e67a72467e8f",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1nqluwcCTMkl6niGqoWO52DZYH0OGIf-h",
              "solution": null,
              "nQuestion": "1NBZ2nOvUIJe-dW705uVmZ99Y5CAjBdvY",
              "nSolution": null
            },
            {
              "id": "d76754e6-f296-4448-8c30-6cbf6efbcbb5",
              "name": "Autumn Mid Sem",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1KQBGG_NG89CV8qJNdZ62PJr1F7iMukKV",
              "solution": null,
              "nQuestion": "1eQYl9oFd23gPWsTX2-FxWA9gqeM3KeCY",
              "nSolution": null
            },
            {
              "id": "fb7a48e8-5d0f-42c9-8695-460bfda76069",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NSCRK7o3h4DsOW_F2Y_uuaCylPF2u3DY",
              "solution": null,
              "nQuestion": "1599Lv9KDodQHC-_RtYqC4Zvk3UhdZRTH",
              "nSolution": null
            },
            {
              "id": "880ad0dc-aec1-4f51-a8fd-e26407170648",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Q-yV5NSKNT0SXwDxO2QMNMW7TjxkKGP4",
              "solution": null,
              "nQuestion": "10P3s-XjjMYrH4TZwJj9u7VjmXbqYehcH",
              "nSolution": null
            },
            {
              "id": "3de12b12-d0be-43aa-9976-54c82cf34845",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1iNMj03hJ9auLlmzcVVaWOilhvU7uW1rh",
              "solution": null,
              "nQuestion": "1yr63lW3ijjyVcbcKwr04mGcPC2S1Tvaa",
              "nSolution": null
            },
            {
              "id": "d67d029c-27ab-4160-85af-18755eaceede",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Dsaw2KSyucZNieb7MsqhBDBHTBSX_n-T",
              "solution": null,
              "nQuestion": "1MHE0T4lNiKwRXqbBPtqtCIERSSjihXvU",
              "nSolution": null
            },
            {
              "id": "8be21080-55cb-42f7-b2e7-d24a870d7bb5",
              "name": "Spring End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_SsVmCM8YfHrKv3Ybhx6NojWbsGPk-0q",
              "solution": null,
              "nQuestion": "10Cxw1WleZvkxCtkEtEPlPGKl6BIzXrt_",
              "nSolution": null
            },
            {
              "id": "d67de221-42f0-4bb0-a6b8-b88f7b61cc0f",
              "name": "Autumn End Sem-2",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1QbZXQMUBBkw7O13MMc5SpGYtn3LyEEu4",
              "solution": null,
              "nQuestion": "1PmCO6QoUZMH_cjDs7IM280VyLjwZ0KHr",
              "nSolution": null
            },
            {
              "id": "abf267a1-d701-4d24-8799-3a95de3c0763",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1EU5VY9OfZktstZwP6LoLHY8hlFAsO3PX",
              "solution": null,
              "nQuestion": "1OafdEO8Ii0LjRNXzzgAWZb-mLTnrwqlV",
              "nSolution": null
            },
            {
              "id": "44201b7d-b600-4fac-8350-3159ceb2e7e6",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1lGMyZ8LJhew46KVm0DuEK9yevUyiavvx",
              "solution": null,
              "nQuestion": "1u_uURLAlPCjGvSs4gX6eMjlgQWgUiUkP",
              "nSolution": null
            },
            {
              "id": "cf4ede8d-9def-44ea-9e72-fba2d9050f99",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1F2zceeDsKXXm13zX_r3j8PJZWABpYPfT",
              "solution": null,
              "nQuestion": "1BR_mtBmoLsbvavqf8D6aZ0UTaFvY9uDK",
              "nSolution": null
            },
            {
              "id": "7819317f-e164-4b8c-972b-1a7b4b7fab24",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721ba965a965de869c43381",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ysk5dbCHuq8w72culn3i45IJFebyNx-n",
              "solution": "1dvMl28_b005aAgPIAoqcYwaArjRdq7hK",
              "nQuestion": "1yUa4BWb2eoCIQOiurx8RzmPE-WKhoK3B",
              "nSolution": "1DWfOtH2Q9uFDQ3oeXxb51JEcZveqCFmP"
            },
            {
              "id": "cba6788f-48a0-448f-a506-211b163910fc",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JNtSt-Ls0_ue_kf2-y2peNrFToubGCyS",
              "solution": null,
              "nQuestion": "1g2gc7pXONDbGZtdZ5EVVxHMe4Xl07q4u",
              "nSolution": null
            },
            {
              "id": "7608f249-d067-4035-8aa3-c3969a97aaf2",
              "name": "Spring Mid Sem",
              "year": "2025",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1E7abEiGJJ1eDTlBzALpfbgjPh2G2YuqB",
              "solution": null,
              "nQuestion": null,
              "nSolution": "1tRJ9dXedZbJ5XNBdHyzdSxyhJaPZtRTe"
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388710",
          "name": "Principle of Digital Communication",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1WfgSZxZD0H32jiHJjptB9S8Lw8GcepRp",
          "pyqs": [
            {
              "id": "76a132d3-73d1-41da-a089-7c4c70fac531",
              "name": "Spring End Sem Exam",
              "year": "2019",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1cqa7lv24njTQx-OV1wQ8FWOhyAcyxgW2",
              "solution": null,
              "nQuestion": "1cqa7lv24njTQx-OV1wQ8FWOhyAcyxgW2",
              "nSolution": null
            },
            {
              "id": "e640e160-b2cc-4e8f-a72b-56469152514f",
              "name": "Spring End Sem Exam",
              "year": "2018",
              "type": "End Semester",
              "status": "VERIFIED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19p7RfUgmz-zF8kAWraieo289uyfnPi2M",
              "solution": "1djqaBA3hHR6TTgKpFjyFAWLqPFK2WUoI",
              "nQuestion": "19p7RfUgmz-zF8kAWraieo289uyfnPi2M",
              "nSolution": "1djqaBA3hHR6TTgKpFjyFAWLqPFK2WUoI"
            },
            {
              "id": "77baa831-6d8f-4c49-8bff-96ebea81f29d",
              "name": "Autumn End Sem Exam",
              "year": "2015",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1KeJxco8O36n6-RHVr5S-0odAccoM1FHW",
              "solution": null,
              "nQuestion": "1KeJxco8O36n6-RHVr5S-0odAccoM1FHW",
              "nSolution": null
            },
            {
              "id": "4fcef6c3-91b4-4772-837c-37cfeadd1ef7",
              "name": "Set 1 Spring End Sem Exam",
              "year": "2015",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NxzWQKSl3MfpoOmmbfwIpHcx8WYOYXx8",
              "solution": null,
              "nQuestion": "1NxzWQKSl3MfpoOmmbfwIpHcx8WYOYXx8",
              "nSolution": null
            },
            {
              "id": "8ceec27c-cb04-42f3-adf5-c79d85e3f99a",
              "name": "Set 2 Spring End Sem Exam",
              "year": "2015",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1dYyNX2yKbQ8QRLhJIw-A2Rl0N6q-rD2Y",
              "solution": null,
              "nQuestion": "1dYyNX2yKbQ8QRLhJIw-A2Rl0N6q-rD2Y",
              "nSolution": null
            },
            {
              "id": "bb086ddc-8386-498c-bf8e-eef8ec4c90f7",
              "name": "Autumn End Sem Exam",
              "year": "2014",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1mbz6vex7dIT5eSpTNPYWXNVxl0YQOiMC",
              "solution": null,
              "nQuestion": "1mbz6vex7dIT5eSpTNPYWXNVxl0YQOiMC",
              "nSolution": null
            },
            {
              "id": "f6539493-ac73-4803-ba5d-c89887e11eec",
              "name": "Spring End Sem Exam",
              "year": "2014",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_DF3ldug5pTaSRJcf3SOV1SFQeDF8ToI",
              "solution": null,
              "nQuestion": "1_DF3ldug5pTaSRJcf3SOV1SFQeDF8ToI",
              "nSolution": null
            },
            {
              "id": "8b6b3fb0-5bc2-4f99-ae8d-8fcb39100039",
              "name": "Spring End Sem Exam",
              "year": "2013",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sgVXpopXElRbX97e2u7c7w7CetTBRXl9",
              "solution": null,
              "nQuestion": "1sgVXpopXElRbX97e2u7c7w7CetTBRXl9",
              "nSolution": null
            },
            {
              "id": "b1421ec3-3285-4985-b0b1-8c37d31b4126",
              "name": "End Sem Exam",
              "year": "2012",
              "type": "End Semester",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "16JL-xFKtQBDODV6JjPBNsjCJ8FR-rSEX",
              "solution": null,
              "nQuestion": "16JL-xFKtQBDODV6JjPBNsjCJ8FR-rSEX",
              "nSolution": null
            },
            {
              "id": "719b0124-232f-4999-af6e-644c10e69c26",
              "name": "Spring Mid Sem",
              "year": "2022",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1GwpExDIYECueH_3PLLK3xnjlcg1kXRFM",
              "solution": null,
              "nQuestion": "17meIo9lQWWS9FTSUEeFpwx48CYvs4AeA",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d2d560883f3cc80638870d",
          "name": "Cellular Communication",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "17QOluqcLPUSE_pvMwResarF4NjEhEiC7",
          "pyqs": [
            {
              "id": "878a4b10-2bcb-47e8-ad72-841c23a529b5",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Da7u8VZkaP_g9rtCricMZBnNLqSGxxoi",
              "solution": null,
              "nQuestion": "1m9SskYaLeK92cn_KaDNFPhOEhsVP2_46",
              "nSolution": null
            },
            {
              "id": "c57e9162-647c-49cb-a70a-42e27d7749f5",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "185qhlSGXJqOpXKD4smWkEoDA44i62Avf",
              "solution": null,
              "nQuestion": "1Vpqir8tULNhF0atILj78ttHu-MbdxB_B",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d2d82c883f3cc806388713",
          "name": "Biology",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1L59qxEbQDon2qIhCp_HFEzODVztGLCSo",
          "pyqs": [
            {
              "id": "3c0f7fea-13aa-403f-9489-d2bd0feb2075",
              "name": "Mid Sem Exam",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": "65d5da77cbccf4670b3ca0ff",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DIGffPaVUXQuOmp8RVpDio9uu6WiBTfH",
              "solution": null,
              "nQuestion": "1DVQzKB3zNYNgvd3RPIL5Gi-AaV-4MkDd",
              "nSolution": null
            },
            {
              "id": "5f777887-5c78-4b8d-a39d-fa3fad88a33a",
              "name": "Spring End Sem Exam",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12O6MkLyVJ0of9Py_qTIrnWVy3wPObqku",
              "solution": null,
              "nQuestion": "1p2ivx3Kk9nWF5VJAjRnqhFc-1aJ9Wz2g",
              "nSolution": null
            },
            {
              "id": "e6d3d467-8212-44e7-b4a9-5a7a6cbda9c6",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ThpLrAlpFOuzCegKXesDqDPGheq8zznY",
              "solution": null,
              "nQuestion": "12Se3q37f2YW5oiPVYw-xrqVvxtNdolNO",
              "nSolution": null
            },
            {
              "id": "8f61bddb-07e5-4523-87c0-d6bafa6ddb6d",
              "name": "Autumn End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "136l0BRoyPwlY9KWykofaubYCTgyd7OLC",
              "solution": null,
              "nQuestion": "1a2sE1442pYN6VUCj2ostmuL-3p7OXSNF",
              "nSolution": null
            },
            {
              "id": "deaa47a6-49a4-480b-86e0-84a07b8b27ba",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Usfd341Or0_sauQyKtg0rfVGrQWUnrdc",
              "solution": null,
              "nQuestion": "1p-K_neQZIg3igL9p_oaEYhk7O3vWjwfJ",
              "nSolution": null
            },
            {
              "id": "20250ee2-d969-4eee-93d7-7e02beede7af",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "18LMr6K_gJDoo-jCq2dk3AGycI07S72bt",
              "solution": null,
              "nQuestion": "1f1wpNzzfCzLB8JLWwTgTfjgKxL8A-mdy",
              "nSolution": null
            },
            {
              "id": "ebf9ee9d-9a2e-4129-8bc5-80cb83f8d916",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1q_onjILAyAwkVBj_361a1dPpnDBVNBHO",
              "solution": null,
              "nQuestion": "1SKdFvyorV2GvHgYOyi_1CexRcOjOeAJL",
              "nSolution": null
            },
            {
              "id": "0b4b4976-4517-4179-b3ef-af83ee764fe3",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1uq8PEDQWYyB4XE0XlT4EN5vqBIjDXzi-",
              "solution": null,
              "nQuestion": "1nVoK5ID8so1COFiiHKucn456MtgkTr61",
              "nSolution": null
            },
            {
              "id": "f1541314-2db9-4667-8a17-53c452760f27",
              "name": "Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1W4J4o9E-9JbwsklvQx74gzn7s-rLxn58",
              "solution": null,
              "nQuestion": "1uX0npePEcs-h9YNkfYeukwYHXQJBOkkP",
              "nSolution": null
            },
            {
              "id": "a4e895e5-2167-41fe-ba07-fec328f200ee",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1gLa4eVJLl8zG3LLg9rwBEVJABnvvsUtL",
              "solution": null,
              "nQuestion": "1spv0P3h9SoXgHP0wnDyHkYxL6IMhbBH8",
              "nSolution": null
            },
            {
              "id": "94212578-f33d-420a-b38c-1c0a62d4fb02",
              "name": "Question Bank-1",
              "year": "-",
              "type": "QUESTION BANK",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JJko3Y7_mXdVjFCNJZnndpY-48kxyoGu",
              "solution": null,
              "nQuestion": "1KaS4M9napFLuMguKN7agZYfhUP26HseK",
              "nSolution": null
            },
            {
              "id": "a91dfb49-b6c9-41fc-93ca-a85f152401d9",
              "name": "Question Bank-2",
              "year": "-",
              "type": "QUESTION BANK",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1MdOhj4jDFyKeVvRUdIAdlOsFonj8-x79",
              "solution": null,
              "nQuestion": "1soKWGT3PZq3owj8uPwZELY8NZyRwY5D_",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d2df4517082e98c7f1c1b5",
          "name": "Embedded Systems Design and Application",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1e2gKXhWfwDC5A_u9YGGMANZsDHhGImnE",
          "pyqs": [
            {
              "id": "141b7868-54ec-42a9-a34b-7fb3b3b67f09",
              "name": "Spring End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1QPDibBU9rLs4GenA6MU7YQ7_v7LGMqGf",
              "solution": null,
              "nQuestion": "1RITgxPiP26cRH3trzLRqCy_AqXSUYoRP",
              "nSolution": null
            },
            {
              "id": "35515913-3d42-41c0-9bce-47738db38053",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1iKoE1Yrhe_9T6EAkhGgXB79TXmLhQyYD",
              "solution": null,
              "nQuestion": "1bbMWjc7NLW0wA7hdSZ_sTYv0QxyCIHky",
              "nSolution": null
            },
            {
              "id": "6990f918-8129-47ad-a7a8-883d05a0b359",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12uBfuv6XACqWBVTPa0-rksYONtBqF64L",
              "solution": null,
              "nQuestion": "1nGESAyo9NgfnMXe4GWr9-dLzzs9VnzHU",
              "nSolution": null
            },
            {
              "id": "8c834dab-e1d6-46bf-b2c6-d6cf85ba0f2c",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BZxVP_lGT-vsL4tk8FCNKgc-oh9AhaED",
              "solution": null,
              "nQuestion": "1D33IWFdV7JtvakApNN_eBMbqAdof3Fke",
              "nSolution": null
            },
            {
              "id": "497a4029-58ad-42b2-a65f-d60b05b47dde",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1AlL_opbiQXjAjQeyVGMhXhHg8eNd9NR9",
              "solution": null,
              "nQuestion": "1WD7z29CxK-lZxJQum2QAnM_OKqzmtKoJ",
              "nSolution": null
            },
            {
              "id": "da45b6b1-88f1-4cab-9aca-879e92715d1e",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xFQ8JS-IVamKwygjkVwYLQfOckWRpbwz",
              "solution": null,
              "nQuestion": "1DTrxclKYawXeYTyOTewne9aVzcfwissg",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d4704a0beae99ad05aeb92",
          "name": "OT",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1GqTjzDGncDrnnL8EjL6HG_fgKgVOae1n",
          "pyqs": [
            {
              "id": "68cea7bb-e93f-47cb-adf3-b562740977b7",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sunkD569LDtjuNtam34njG6Uz1qQkWnH",
              "solution": null,
              "nQuestion": "17bvI32tQZQbJlPePENo8rrQcsBU2-1ha",
              "nSolution": null
            },
            {
              "id": "4583901e-4d85-4e00-b6e9-e82deed28f21",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JSqVtrlC73vbU2HGNQf6A0D2aS3tONTL",
              "solution": null,
              "nQuestion": "1jkuFxZdKUiTb_tV-eLHEHvW8n3fl6Toc",
              "nSolution": null
            },
            {
              "id": "241bcd55-d10f-4d85-9eec-56c13160a3be",
              "name": "Spring End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1A5ELmANnizB2FqkSz-Qa_fbwxdZRcVbd",
              "solution": null,
              "nQuestion": "1t7jBssd3iZs-staGAg0xNUbuTn9i4f-S",
              "nSolution": null
            },
            {
              "id": "db52ee69-98f8-452c-a697-127e7bd61d3f",
              "name": "Autumn Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1t2s0RmpL-TPW0MYaw7NT98M2gkTJRPui",
              "solution": null,
              "nQuestion": "1l0pBD7RmARjeaF_bL6ylc1kEJ-i5Ariw",
              "nSolution": null
            },
            {
              "id": "7ed447e1-751e-4238-a088-4626fdae5dbf",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12FFoqnXLjn4mOHNVnSJ7CVryEDVbVvUb",
              "solution": null,
              "nQuestion": "1VRsfXq09gXIfWka2AcGJUIiaXsnr74xQ",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d470ba0beae99ad05aeb95",
          "name": "CEC",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1xp1hRYag-FpKTInIcz0w24QZj45TEfTU",
          "pyqs": []
        },
        {
          "id": "65d470ba0beae99ad05aeb93",
          "name": "WSN",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1Zf8H9S5yo1NC8D3pVHK6DreNaCgvmZKZ",
          "pyqs": [
            {
              "id": "fb733543-2c76-4918-a90b-fa820908a7a3",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1N3C9fTYmgHjUSEQVsuGnXKbgq_s5pI7L",
              "solution": null,
              "nQuestion": "1XZhaxh9jdv763qfvCEvLuMJ3do1XN-p_",
              "nSolution": null
            },
            {
              "id": "765cc436-5ac0-4dd8-8ef8-5fbcd5b8e486",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pDt3Ql2AP85ccHRuOnWhVp6l2tv8RL0X",
              "solution": null,
              "nQuestion": "1km-vBAa9LyprtX66p6qA_nsg-caGAwWD",
              "nSolution": null
            },
            {
              "id": "cea1e470-5bbf-4963-a6b1-202959888bbb",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12z04ByCo6BpAwhCgkpwLmxIn1MkxX2h4",
              "solution": null,
              "nQuestion": "12Nu5ny_H7CMR1n6_Sn_o96wlBxmmjUJ3",
              "nSolution": null
            }
          ]
        },
        {
          "id": "65d470ba0beae99ad05aeb94",
          "name": "SCS",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1Tn8fDEf7hFf_-8WslLdQOw6QAeDSMTCR",
          "pyqs": [
            {
              "id": "636ecefe-914b-48a6-884a-691282d8e78e",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1SgdgIu4ZpjesILwZQFRRQlc9oJI5J88F",
              "solution": null,
              "nQuestion": "174V0xYesQER_uTma2SHudNI-4NxPdcCR",
              "nSolution": null
            }
          ]
        },
        {
          "id": "66051a2a69e3a3fbd8923b84",
          "name": "Basic Electronics",
          "SUBCODE": "EC-10001",
          "Credit": "2",
          "folderId": "1jZw0qA0V_mcTOM41todltrlMJ-YEVUEh",
          "pyqs": [
            {
              "id": "f36b9fcb-a2fe-4d8f-b627-2f48da5262c0",
              "name": "Autumn End Sem",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HYrqkVTxa0yLW46YEA0LsPV-ntAhfR6d",
              "solution": null,
              "nQuestion": "1SqyGF8uJGL-C6q4GVP0-gALk5zgwPHlE",
              "nSolution": null
            },
            {
              "id": "39ec5c32-c856-47c9-8bc7-c99b3959dccf",
              "name": "Autumn End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1yxC9Lz12HWtiTRsqxjpqQgguee5yRx1v",
              "solution": null,
              "nQuestion": "1u21bJQMJtiaJlpnzu2IV8Y5MWs0zxW0g",
              "nSolution": null
            },
            {
              "id": "ff915913-cc25-4634-97aa-268ee94d3718",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sxyaoUVRkgtFyjFLr1tWROtY5gdBcFNO",
              "solution": null,
              "nQuestion": "1jw7c8ypJ3n8ZEsPujuz5qplEoCm1rFrv",
              "nSolution": null
            },
            {
              "id": "733d98de-81ab-4108-b3da-837ec8cc993e",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15G6I-InWWyXpjjhA1WWdFvewzrHUg7eQ",
              "solution": null,
              "nQuestion": "1wTnd1FTxbN9H1_aGZPuG3O9EETC8p7XH",
              "nSolution": null
            },
            {
              "id": "e5535c9f-0f85-4f0d-b28a-4217767d5766",
              "name": "Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17TwoiqdjPQAi1xEL5kLpQNaEiG567bpZ",
              "solution": null,
              "nQuestion": "1pp9o4xQK6qYHjvtOOzMWOxO9RR0HiAgr",
              "nSolution": null
            },
            {
              "id": "3215f533-d492-4c07-a2ed-8a1c8ae5d670",
              "name": "Autumn End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1wIDnESFFCI9SH-Gk2lXPkSIrGTluYcdv",
              "solution": null,
              "nQuestion": "1AhCbMI1Lf94VNxlSShG-M5-vtLDGaRtv",
              "nSolution": null
            },
            {
              "id": "73e93e41-d45c-474b-ad2f-62cbc0899c1f",
              "name": "Spring End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1P9VFLBVouZmDfx34nX1aQmWuqUmiafzC",
              "solution": null,
              "nQuestion": "1m3Tu-Ec8j1cMAC5cXqbVyEutKyb-ikzr",
              "nSolution": null
            },
            {
              "id": "66981fdf-6e76-4443-8e5e-fafa80b59b58",
              "name": "Spring End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Op3UY1qjvVjTzDfV6-luEr_r4wtrI57q",
              "solution": null,
              "nQuestion": "1_FF6zmym-5VPyUatrQfH-ctCMVZ8_g9I",
              "nSolution": null
            },
            {
              "id": "033a53b4-4847-4370-b254-bec0419060f5",
              "name": "Spring End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1dWzsb27bPHSgGnGv6Q-Lg6ktvw9A712T",
              "solution": null,
              "nQuestion": "1gkKuCaGpozbcgxOByd-KYA3aMRNSW-2F",
              "nSolution": null
            },
            {
              "id": "76f1d9f1-f7bb-4e50-bb37-9f493cc2a761",
              "name": "Autumn End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DbEpKcBFDWONdGBAJc9l20jPUIAvmwAe",
              "solution": null,
              "nQuestion": "1JV1i5Hhdhk4HfcarFBHoa7cuIW1XztKL",
              "nSolution": null
            },
            {
              "id": "14c6a5a8-b0c4-46d2-b655-2a3159802404",
              "name": "End Sem",
              "year": "2008",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1bQOcWHp4nGvnJOe5J1JEV2xcdiWs8IIV",
              "solution": null,
              "nQuestion": "1w4bSHSbmkUAuaUpl78JCgev4ur8m_2C9",
              "nSolution": null
            },
            {
              "id": "d3b4d8b9-29b8-4bb9-b377-8437bb8279d9",
              "name": "Autumn End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1A9iR29txBjSudiurggmr4IU3kx90jgdA",
              "solution": null,
              "nQuestion": "1-QNuaH0OTCyNO9aIvmYADTL23KY15B-1",
              "nSolution": null
            },
            {
              "id": "dc99f5b3-f984-44f0-96bc-724e33d0d827",
              "name": "Spring End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JMyQgE3CkkSm3x_2-z_7Xe6jEiiB2l_P",
              "solution": null,
              "nQuestion": "1nEe-kVxaTIXaNJA3YtdeK4bcIUvCVOuP",
              "nSolution": null
            },
            {
              "id": "83e68cc9-ff3b-4401-a81c-45c521d6d7a7",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66f2de1df740b2b3e5002db2",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1mfy4yZY0I_vicQQMzWTgujnSM9cBJXul",
              "solution": "1TB4W8y_KlB3QRg2xjX0CAF-rxIVA8yoO",
              "nQuestion": "11xfhwmxsIJ5zxwpO93PamhcWO5Tiea_E",
              "nSolution": "1SZ9MwF00tdY-YrdPeJ8paTFPwMTpGOwW"
            },
            {
              "id": "e06d2a4f-fdf1-434e-a6af-bae049687759",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1CqJfQl2AhUgkP02EUmUSlFOUeqL7MQNZ",
              "solution": null,
              "nQuestion": "1csZvSXZE1VE133NbE4SLgT52HdqK-CW2",
              "nSolution": null
            },
            {
              "id": "c10c11d8-8154-47ac-8775-47700def2d9e",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fuNmfJa1y-2B1tPQ-VLcW1FYEmd67I-q",
              "solution": null,
              "nQuestion": "1Jv8KrUIMVc74QIi3Yg5Ow87GlouOGvXq",
              "nSolution": null
            },
            {
              "id": "000580d1-73f8-450e-8a47-aae28154cc48",
              "name": "Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1h2yNYeSVW3C3diHbcti1wRN8dkZ4O4sx",
              "solution": null,
              "nQuestion": "1OukTF7I8R4tPoOp7sTGQLjGG5Y-AoQ3c",
              "nSolution": null
            },
            {
              "id": "20badbd7-20a3-4f50-b41f-d133a2726cd8",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-MBGuQQ6IxZmaIXs0TBmdgO7xS3tB_NE",
              "solution": null,
              "nQuestion": "15KVuGp5Xw20XUzQDK3miE3o8EZy9JB5-",
              "nSolution": null
            },
            {
              "id": "40f01ef9-614f-485b-8f5a-8242f64a97bc",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13sKFwj4tqheAlLR4tq8neCTc1tUVnrLs",
              "solution": null,
              "nQuestion": "19SjylAzkWHrqzzlcDr-seWOqi3bIXlLR",
              "nSolution": null
            },
            {
              "id": "bf8a3e1b-04cf-4d8c-b0ed-b885a24c0dc4",
              "name": "Spring End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19msfXSYsplh8wh4o4CjuCpngmVPJ0lPl",
              "solution": null,
              "nQuestion": "14GbqxQ1uOdoaib6gaMQu_ZZMyG37hQsk",
              "nSolution": null
            },
            {
              "id": "0f2070bc-6783-4915-89a2-513f0e380ec4",
              "name": "Spring Mid Sem",
              "year": "2018",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-5G6TYNg4p5S5mz9tfxHJVxmctCOOFOx",
              "solution": null,
              "nQuestion": "1M8by5D0nT-UfWlmsky1lmWBB7tGrKTP2",
              "nSolution": null
            },
            {
              "id": "ac4dccad-3e47-40c7-adc0-d2502949073d",
              "name": "Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1pWFeKey-Uv6YQZYSZRpBzalPWpdF0h_U",
              "solution": null,
              "nQuestion": "1YUCtmHn3y7o3_XiMC2Yz7PZ8BnKSx6-h",
              "nSolution": null
            },
            {
              "id": "ffac1143-c4d7-44b3-b09f-70f79541b1fb",
              "name": "Autumn End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1aW_XXlQmFPZAYxrhljTmRV2a73w6nz7D",
              "solution": null,
              "nQuestion": "1j0nmFOOtAbVu1GY2V9OQ8rzFRXqNzdkX",
              "nSolution": null
            },
            {
              "id": "860de347-faa5-4a3f-ac3e-1b0b0ad8f631",
              "name": "Autumn End Sem-2",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "15myc4qRKYJ_FJkt8OT8p4EYoCqmQcFgY",
              "solution": null,
              "nQuestion": "1-IAYgCsm05b3P7ZzS1XZpJTEQiU8J9E6",
              "nSolution": null
            },
            {
              "id": "32e03a6f-6336-467c-88a4-4785eee5386d",
              "name": "Spring End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_ChwHYVdGoTTC0_08-kwchAmGFYKeP_E",
              "solution": null,
              "nQuestion": "1uV1RlE-A2LZ3kCJinA7IO9zCmBmkRQyv",
              "nSolution": null
            },
            {
              "id": "21bf600c-c0bc-49bf-8d5d-60b36fee0d96",
              "name": "Spring End Sem-2",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13-TP501uffuKTln_L6h4K-zE1hzsqTGj",
              "solution": null,
              "nQuestion": "1g-WCpgMb5vX18_9EF_aXDvQeSfXXrrK1",
              "nSolution": null
            },
            {
              "id": "4acfc9ee-3388-445b-a302-93425bda81be",
              "name": "Mid Sem",
              "year": "2015",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1TvII7RsePLMveSoI63mD3wCThVMY9vzO",
              "solution": null,
              "nQuestion": "1SWlkFsj5ZjCbCwCpKqtpjM5lXlu5YlO6",
              "nSolution": null
            },
            {
              "id": "1861be4a-34e6-4539-b29f-6ca433d50a1a",
              "name": "Redmid",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1LyT3dh3b29PUA-KCUJjKym_TK60UvO90",
              "solution": null,
              "nQuestion": "1OsBBnAJV9GD_VI18K1M2x7uRY2JW0s8P",
              "nSolution": null
            },
            {
              "id": "c77887e5-65ca-4d32-85ae-cece6cdce29e",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "REVIEW",
              "solutionUploadedBy": "66efc259f740b2b3e5002d88",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1QJRCpW3PHl1kyJN4ZuT5GpNjrjqqPUCU",
              "solution": null,
              "nQuestion": "1_3EOeyaU6VFIeMkJSyuQ80DaqtC4xx42",
              "nSolution": null
            }
          ]
        },
        {
          "id": "660a449c30641ad00aae8aa7",
          "name": "DBMS",
          "SUBCODE": "66787",
          "Credit": "4",
          "folderId": null,
          "pyqs": []
        },
        {
          "id": "6624c205daff3e83284a48b9",
          "name": "OPEN ELECTIVE-6th SEM",
          "SUBCODE": "00000",
          "Credit": "3",
          "folderId": "1iYqoJaSTBH9LB-4mTMnIoth8DVboj6Jo",
          "pyqs": [
            {
              "id": "d5863741-5d83-499e-9d06-3f4ea1e80b98",
              "name": "Disaster Management",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-p3uX7ax82bXU7ygXheVfs1u-erGzFzo",
              "solution": null,
              "nQuestion": "1co_OdJL5DQr7hApwbLgPgMK2Wm4Wg7LY",
              "nSolution": null
            },
            {
              "id": "76d29cd1-a2eb-4d27-af9c-e426cc493c57",
              "name": "Construction Materials and Specifications",
              "year": "2020",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kc1T_p1MfiIcRMKsJnUP1L5akFWLs2fy",
              "solution": null,
              "nQuestion": "1NRrN_FF6kEnGZljNJiuxjTOVRdzFsLEa",
              "nSolution": null
            },
            {
              "id": "31c8f82e-a738-4426-b659-683e769757c6",
              "name": "Linear Control System",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1jxM3A-Gn8a8QMXPqtTTcU3prkivxQeFY",
              "solution": null,
              "nQuestion": "1nWJAT2IkPk7_TWw9LmcqdE39ezQ98rod",
              "nSolution": null
            },
            {
              "id": "8f2f2193-4a19-4615-b61b-316ed3b31f71",
              "name": "Engineering Materials",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hI3bT0l6NFFmuu4be0FICHIX_sYsdrXx",
              "solution": null,
              "nQuestion": "1U4Oic5QfYazhurnJ_lNYW68CuymPUGgc",
              "nSolution": null
            },
            {
              "id": "74c50cea-84c7-49b4-beda-aabe136e01ee",
              "name": "Finite Element Method for Engineers",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1vNevY3IwZhBMMXwSYJKGr8lzkxToTVA6",
              "solution": null,
              "nQuestion": "1Ngg57wUldU4D4VJDXed6tTMIL_mlsxBI",
              "nSolution": null
            },
            {
              "id": "7b131458-06e9-4102-a4c2-4b970c7681f1",
              "name": "Quality Engineering and Management",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RJlcK24Vm15aZk4vHXL5X4OaPnf8f2d0",
              "solution": null,
              "nQuestion": "1NG7I8mAR6fmLBeABsEzpYjtm5Dd57nKv",
              "nSolution": null
            },
            {
              "id": "7d950e00-ad21-4f07-a806-d601c30b928c",
              "name": "Renewable Energy Sources (Mech)",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1scVSdJddBIP1vSKaD8ezY37U1L1ANjWq",
              "solution": null,
              "nQuestion": "1trEli_7aYNohckchkqbe5KRUy-hqGMkU",
              "nSolution": null
            },
            {
              "id": "637dbf72-9b4c-49d2-9b83-cbb12422fcb9",
              "name": "Robotics",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1S3EFR_pq31lLgHAt1ISvx75sdx9198-A",
              "solution": null,
              "nQuestion": "1R0ltVrWSEwvEENpxYyLHkox8Egro4zFy",
              "nSolution": null
            },
            {
              "id": "f3b9687f-0076-4834-8631-6af4c8a9ddda",
              "name": "Fundamentals of Project Management",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1lwrv124l6KPTpEAs1rzTAeOkhZnLBurC",
              "solution": null,
              "nQuestion": "1vzwCVxtqsouZ84iF2w_LNOjKCbiKnFsz",
              "nSolution": null
            },
            {
              "id": "d2068137-9e74-4bab-a487-5e2658922f03",
              "name": "Environmental Chemistry",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1e70i__-ypfoi3Dpn-QOFu1MgHGL334ei",
              "solution": null,
              "nQuestion": "1MWkIMypKw_A1pNXXaNG0NUNqV2SbYPt9",
              "nSolution": null
            },
            {
              "id": "13fa32ca-5415-4329-bee1-67c242ca2278",
              "name": "Coastal Management",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Fx-dVFGbqSYW2b8TjqleFntFIhr_MPkd",
              "solution": null,
              "nQuestion": "1oP4K4oXtoSv8L1GgC1XH_kjAzmax8jxF",
              "nSolution": null
            },
            {
              "id": "4a06e982-9260-40e8-96ee-edb0ce7b8d3c",
              "name": "Basic Transportation Engineering",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PnA_LEQOoUZP0RV2C-iaemMvqkgW_Icr",
              "solution": null,
              "nQuestion": "1rZXk8NPvf8RQQMgWeIn_pITCyNzQ-pCi",
              "nSolution": null
            },
            {
              "id": "c04df21f-04ec-4c77-b86b-5ca20de4dcb3",
              "name": "Principles of Energy Conversion",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "194bi2WFO5ugwygSywvXDFkPjICgxUBvf",
              "solution": null,
              "nQuestion": "1TQ0Dd0qWYxSNrDUv0MJrdH5G6TEa9wd-",
              "nSolution": null
            },
            {
              "id": "ca839202-368b-48ed-a63d-ed74f0d1b9f6",
              "name": "Renewable Energy Sources(electrical)",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NxtUfoXOkpsJ0ZaloZb1TXEITU9U2ZBx",
              "solution": null,
              "nQuestion": "12mA9kD9ti-jfGM4AMoYHalXKclD2kUlC",
              "nSolution": null
            },
            {
              "id": "dd665ae0-49ee-4ef3-9f05-1032631f2708",
              "name": "Energy Audit and Management",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "13m2vUHsTYwA9jwma12mcwD6ynC-XHLi2",
              "solution": null,
              "nQuestion": "1kj4kdwUUYQrbJuLUY_3oHeHQY8NZzFnq",
              "nSolution": null
            },
            {
              "id": "29fccca4-414a-4b8f-832a-f550a7df4473",
              "name": "Law of Patent",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ruNMy2jQBcFzjF7JYIlmpR7DijHCpJIU",
              "solution": null,
              "nQuestion": "1kQY9BbblI--jFSkluatiT42jOEHKoWh7",
              "nSolution": null
            },
            {
              "id": "a5dda5f0-2057-46fe-908e-70253cc8c432",
              "name": "Law of Contract",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Aec5ikk8gAmTFcM5-mG7bYfQoNq9zOdC",
              "solution": null,
              "nQuestion": "1Pg0cIVtkFuq9j_LlH-CB86QwxZJHWN4s",
              "nSolution": null
            },
            {
              "id": "afc93f0b-f7d3-4374-9e5e-59b826e43285",
              "name": "Intellectual Property Rights Law",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1H-sH6aiwwHrze1J3qByZjmHWFjAnAaw9",
              "solution": null,
              "nQuestion": "1HUg7j4IuDvE4PCBoofIj1g4I2GrwpfBz",
              "nSolution": null
            },
            {
              "id": "84c764e8-6beb-4848-ad37-a8df559e5327",
              "name": "Information Technology Law",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1DHCMQgKKgCFLE68tmZaO14EZYJo9VMah",
              "solution": null,
              "nQuestion": "1PyEB77eE8uX7uTl-0YU6MBzQDsk2exji",
              "nSolution": null
            },
            {
              "id": "f5e02933-e9e8-4c63-8704-b214a5d35157",
              "name": "Internet of Things and its Applications",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "14s82ypc6_zK_G7O4jCbXBkusGEdNYnVH",
              "solution": null,
              "nQuestion": "1BmdMLmPNZG7Rb1fYPQxK7Ry-wXSE5zMK",
              "nSolution": null
            },
            {
              "id": "8375963d-36a9-4ffe-b1dd-3d361e2eb274",
              "name": "Internet of Things and its Applications",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ZhT4oW9X-7-g3CkFmvEfSQJp39ACPaen",
              "solution": null,
              "nQuestion": "1ARP5xROAA8Aem4TiU30svjbCczXL29xJ",
              "nSolution": null
            }
          ]
        },
        {
          "id": "663c45c2e702498e19691b29",
          "name": "Professional Practice, Law & Ethics",
          "SUBCODE": "HS 4001",
          "Credit": "2",
          "folderId": "1FLalOr-q-ciQJWWOdJrzjcpHwZkdVerm",
          "pyqs": [
            {
              "id": "fde9b5c9-ca32-4820-a3a8-1bcf6ae029f3",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "666bd557182c6fb152acc34c",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1EVjSRZakieHNrOAvv_ZUYMSACDf5GkQG",
              "solution": "1tTg55lVdkNpN6OvcL9GORMje2TPBBbUK",
              "nQuestion": "1mkz4WSr8IoT_hWI7t3VmYm_i5kOakJbz",
              "nSolution": "1NkAgUaMJXCxEScxenx7Xcdb9DTyn2ehK"
            },
            {
              "id": "c36b1ec0-6d22-4f82-bb9a-efda06174c60",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "REVIEW",
              "solutionUploadedBy": "66ed9874f740b2b3e5002d52",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1WFpN9MQJcEASQLosILxFPY-yPzQog-NX",
              "solution": null,
              "nQuestion": "1C2gl0TSNKjAExI0WP83hDjlesWKbR3OC",
              "nSolution": null
            },
            {
              "id": "557d6575-47c7-479a-b61a-bd5bf98b31e6",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1M8arUFqFpXzE4at7pw9ZtdbfQkIl5Wnp",
              "solution": null,
              "nQuestion": "1R4A1RQmGXZhiPP2yoal-VV8vHv1h1cMd",
              "nSolution": null
            },
            {
              "id": "794ba938-df58-4865-b699-111592b57b8c",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66fe95d6f740b2b3e5002dee",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1R-SJbUbnm-RKNL4BCVYfGUug1hFCH5fc",
              "solution": "172uHwTlOu0Opk3Djm3mhtsXe_aKDZVtP",
              "nQuestion": "1DPe2NKvLNqu8hDQhZjWyO6KciAzyN820",
              "nSolution": "1F5C9S-dQxtcUu3uTWRiywir0R1zXt_Lq"
            },
            {
              "id": "213ee376-cf39-4337-bd25-cd51087048a3",
              "name": "Autumn End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1aWMMoTDvRJWE08VKFg2cNQ3FX-uTZzaY",
              "solution": null,
              "nQuestion": "14UFgKLcOY0tY-KRM7zOsHsMcyxmuey-C",
              "nSolution": null
            },
            {
              "id": "4f3f3e17-c4a4-4e6f-95db-90c875e8de56",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17VJY9bBVAxdnow8uBvm5Zr55y_gQ2rGr",
              "solution": null,
              "nQuestion": "1qWph5LnEdft3W8U1nIL2Uy2nurjDG5Xr",
              "nSolution": null
            },
            {
              "id": "b4adece7-6b85-4f45-969e-32654e212be8",
              "name": "Autumn End Sem-2",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1-cGii-SLmmFjdWzaJ2a4utnaIQXRbDYZ",
              "solution": null,
              "nQuestion": "1nv4pGDAVS_MQ0plYJX3pF_sFaPgJRQYy",
              "nSolution": null
            },
            {
              "id": "eec31ac0-3daa-4807-8cf9-8467eb0d725a",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1m2XYUVuJ7j8KMejjgwyr8AOXvL8pj-_k",
              "solution": null,
              "nQuestion": "1qiFE6pYuCpqn27nCHCoFgQBrB8RKPRzm",
              "nSolution": null
            },
            {
              "id": "ba1a65ef-6aed-48d6-9c9c-96bff295b61a",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721b8495a965de869c43380",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1aC6IzmAFG320pP8kfwA0LPpDmomBsAFr",
              "solution": "1fnzgYuZ4essVlV9Bppmvp44WD4q5J7P8",
              "nQuestion": "1z9GFjl_xs__5z_JF1z32_EBGPBXxqJFD",
              "nSolution": "1HxYk56fhyO9TT3ROCCYCl_F_TgM_539V"
            }
          ]
        },
        {
          "id": "667ec56530a376b99f5af31b",
          "name": "Computer Networks Lab",
          "SUBCODE": "000",
          "Credit": "1",
          "folderId": "1kmPYLOBIU1TPJ_yML6Nf2vCsr8csuEiW",
          "pyqs": []
        },
        {
          "id": "667ec57930a376b99f5af31c",
          "name": "DAA Lab",
          "SUBCODE": "000",
          "Credit": "1",
          "folderId": "1Y-VSHo2pNKmi7ZZ_LVrkFKst3vQ122-7",
          "pyqs": []
        },
        {
          "id": "667f5faca5c50ae2af6118bd",
          "name": "Economics of Development",
          "SUBCODE": "HS20120",
          "Credit": "3",
          "folderId": "1as7Wjd3Zz18xU-EQLo6bCOO10Joaqcvc",
          "pyqs": [
            {
              "id": "9f883794-9fd2-4e07-b50e-c559c7e6f7da",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1saiKcYuzmvQxz9U6p4ZxP9JZGd8402uh",
              "solution": null,
              "nQuestion": "1AdoDp1fyVfMm6j_d-m4lI5sHvj2WylFL",
              "nSolution": null
            },
            {
              "id": "f2549733-4f0b-451e-90f5-1c31e5f7032c",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BfhH3PeR3p0lneC4d-xbTKxFoTTOuZcS",
              "solution": null,
              "nQuestion": "1BIiY-wi2LWe4kikCgY4hopbpg8Cw71wi",
              "nSolution": null
            },
            {
              "id": "b3f997fe-a240-48d6-b68f-6051a4b4bcda",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1xQQhlQLm54i5vZQq9hUTmbI69jo-xos0",
              "solution": null,
              "nQuestion": "136CuPFm0IodQLD0V5oGQ54PjFTSJtdI0",
              "nSolution": null
            },
            {
              "id": "0a4e2de4-af9a-469c-a8ac-bcd15ba06556",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1FvEse6qJScUgMCssOQzIt4XFN7ploskc",
              "solution": null,
              "nQuestion": "17T83CbhXLujZ03LKNj_zIuchQLbRe7dr",
              "nSolution": null
            },
            {
              "id": "034ba062-23e6-4ad0-8cb9-6ba80d98acb8",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1_tqOXU9GrdiBJktdh5kMglLX7CYRSf-x",
              "solution": null,
              "nQuestion": "10pP-9DHlqteI0bDLs5W2Lpc18BUbM3J5",
              "nSolution": null
            }
          ]
        },
        {
          "id": "667f789c48e86f92a1d24a42",
          "name": "International Economic Cooperation",
          "SUBCODE": "HS20122",
          "Credit": "3",
          "folderId": "1oM5Hij58OlLLyra2mfgMlQOlIaShVMLo",
          "pyqs": [
            {
              "id": "811aafac-a907-4d89-be6e-3b8e23525063",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "11RyaEe2d8RuEbcwM6SVZiAadjEOdNv91",
              "solution": null,
              "nQuestion": "1-IerTwZk4r70MNgavxHuUGl24H4L-JP1",
              "nSolution": null
            },
            {
              "id": "8852e32d-031d-4d64-901f-e3d89e2086fb",
              "name": "Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "67d9dc738db82be398f22012",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "14W6IzdcEMWGHELrJboZBgCEV1YJh8hGi",
              "solution": null,
              "nQuestion": "1vGRTHeOZy5YA4vxKfyezkpate_ygg6yz",
              "nSolution": "1KnJJt2FTxEEv4IkZQdyWz0ICW0sESRf0"
            },
            {
              "id": "121b87a5-e486-408b-86e5-e91d79fb434e",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "67d9dd6f8db82be398f22013",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1uKaeBZOMCr4yvM5P5rQJpyGIvpXD2QA1",
              "solution": null,
              "nQuestion": "1D1zHfg6otBbrPbr_kd24Zc3OU2Kqa2KS",
              "nSolution": "1TGCFljP7sMMYrFrP7GL4pQxGIFMz6Y7r"
            },
            {
              "id": "6773b48a-2a99-4ad3-9194-875a95e9d6df",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1I9-3ju38bJiI27j211Ne0smz_j6b5gLO",
              "solution": null,
              "nQuestion": "1IJCjX7nAtWB__7WCaS-yfCi74DUpyyWe",
              "nSolution": null
            },
            {
              "id": "7c6c868a-0bcb-4d0b-95a4-716e1c955826",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "67d9db208db82be398f22011",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1OdDKFzGQhadB0sYa0qbmWtele1DbMrRN",
              "solution": null,
              "nQuestion": "1FOb8S3iQkDr9ck8vCYdt-7oBJ2CBjPq3",
              "nSolution": "1XKJXnSowr13jkVqGwL-IlwVd8BzgHHM_"
            },
            {
              "id": "081e35c4-7575-448e-ba2a-40a290844fed",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "14EmWXWuu9xN4QgNuwrrnK2mXIQG5rFGZ",
              "solution": null,
              "nQuestion": "1PpJgMVsm5JJQst-A9QXrqsxre-rD8ry9",
              "nSolution": null
            }
          ]
        },
        {
          "id": "667f8a4277b386dd006297f4",
          "name": "Distributed Operating System",
          "SUBCODE": "DOS",
          "Credit": "0",
          "folderId": "1lebSKuct3U4z_3tVzSfCSnWCbhyPixzt",
          "pyqs": [
            {
              "id": "c3fd0913-5b29-4eb4-99df-743b5c2812ef",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721bc485a965de869c43384",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1aypfD_PW8ZooTk_o_VfCcfSYpV6rO9tO",
              "solution": "1nBiozI9BmreafbifrbflBwp4MdJnV9Ym",
              "nQuestion": "17IgrpXeansVD-UGRVS6rvdGaUeWcVhRE",
              "nSolution": "1fX0rqMEMzsYBdWAHfkV71mbW7lDQqKvC"
            },
            {
              "id": "80fd3212-62ed-43c5-bb04-7276590efbef",
              "name": "Spring Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1HIWCXs2b6xhmJM80z_FMAhszRzadi3Ps",
              "solution": null,
              "nQuestion": "1PxFgJF5h_9p2M47nhve62NHRbRuewG50",
              "nSolution": null
            },
            {
              "id": "ebca5210-9f7c-42e6-b12c-ebc0c5f55a3a",
              "name": "Spring End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1wN7dS4zMVgclsUPh2fpCVP2QMw43rbSx",
              "solution": null,
              "nQuestion": "1glpNi1xg7EfTLTqQ-CnOeIrghn87C1tK",
              "nSolution": null
            },
            {
              "id": "1cc6de64-c51a-4026-8c30-a1dc86def9e8",
              "name": "Spring Mid Sem",
              "year": "2020",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1o5JWhDyRZCQA15Sirb8gs6vtPUe2_SxZ",
              "solution": null,
              "nQuestion": "1YHrYUFi9K6vkNxrxn72Z1KFZt-LZVztl",
              "nSolution": null
            },
            {
              "id": "963c0c43-d409-4499-a117-c9d1cb96a884",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1PlV6fLa-sIaf7QMommTBRym9eIB8dmQT",
              "solution": null,
              "nQuestion": "1jogGHStApa8jPlc6dPSwzKQnzJlLnZCv",
              "nSolution": null
            }
          ]
        },
        {
          "id": "667f8f8c77b386dd00629814",
          "name": "Data Science and Analytics",
          "SUBCODE": "CS30004",
          "Credit": "0",
          "folderId": "1oADMmC6mNwQ_b3SSec7MpBBb1y1UIhDY",
          "pyqs": []
        },
        {
          "id": "668de61697969283509b07d8",
          "name": "Human Resource Management",
          "SUBCODE": "00000",
          "Credit": "3",
          "folderId": "1pRVFTquS1-HeCkU8RcEBiZyztQeC0W1z",
          "pyqs": [
            {
              "id": "1ab05e3c-15fb-487d-b64a-bd38b293e661",
              "name": "Mid Sem",
              "year": "2014",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66e98c5cf740b2b3e5002c9a",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1OtMnKwLW_kWftwLgrXYwgYG8dSjUF02b",
              "solution": "1I751Rzf76jShJM-J8bOAxzfPZJ6NVblq",
              "nQuestion": "1ivz_dT8km2N5T1NYQQqevAXc9smgf9WB",
              "nSolution": "10P_-AXP_x0P6ZJ-DC5DVhYboOd5dPTEU"
            },
            {
              "id": "9eabb4ac-66ad-4bfa-bd77-8eca0c83c873",
              "name": "Autumn End Sem",
              "year": "2014",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1FiSJDg2tVbKW9PMGzTlAidRCl81-RA0z",
              "solution": null,
              "nQuestion": "1hUQeAOYKbnzxPwwRwAVclcvhkkBAmjHS",
              "nSolution": null
            },
            {
              "id": "0a643178-852a-4779-a547-d48098ebba63",
              "name": "End Sem",
              "year": "2012",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1JTccMVXB92i0-lff4_126pRALvdOmWBo",
              "solution": null,
              "nQuestion": "11aus7ZkkWHljUAJf1-iLA1GrpxvKiONo",
              "nSolution": null
            },
            {
              "id": "10be0ec6-1671-4005-ba96-b2352f62567a",
              "name": "End Sem",
              "year": "2008",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66fe8a5bf740b2b3e5002de8",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1tWFhgMHKwYBkVjrJWbrbUSe612lBTqaD",
              "solution": "1gm5SkrWkPMYvAF0hh3Kfwt8piyXJJ9aI",
              "nQuestion": "1XFfuN-6U4W_SdJv_IjAocRK--HbWAQTn",
              "nSolution": "1Nr_ROib2-8Q-pHH45IOVrIBacduYbkyv"
            },
            {
              "id": "d3cd1ef1-537e-43a9-a467-7cfce040587b",
              "name": "End Sem",
              "year": "2009",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66fe8e31f740b2b3e5002de9",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1E-5np5UWW79r9kkcV7HKAIqIbGvX4HuV",
              "solution": "1M_fOGQR5GAtIv2yXIt21ViHRjcmM14Xt",
              "nQuestion": "1WwZfL9f9_wmOxvpohvzk-iCq1c_-02_-",
              "nSolution": "18HDx8vwVpVpXtMAkU3527VG4OmnLhZjV"
            },
            {
              "id": "1c087aca-3b99-4dd4-a1dc-a556f51131c2",
              "name": "Autumn End Sem",
              "year": "2013",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "12q48zwz51UuwyBxAf4Gzz1aa1Izpx4p6",
              "solution": null,
              "nQuestion": "1LBqiTq-VmCTv8FKUnPVByvG6rntP7jRV",
              "nSolution": null
            },
            {
              "id": "56fc23e5-2419-4d3c-9c6b-e81e1b5b89ab",
              "name": "Autumn End Sem",
              "year": "2015",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1To1jiDcCxAuzB2tgyVS9qQsV3XDFbDFE",
              "solution": null,
              "nQuestion": "1Y4ncVNAMIDs7JRYn7R7_KNqgk0puGEmK",
              "nSolution": null
            },
            {
              "id": "fb214afb-ce05-47a0-b3a4-fe1c03a493bd",
              "name": "Autumn End Sem",
              "year": "2016",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1WSGJuGBzyq5fz__Xk9x0mXJ6xnXIp_JP",
              "solution": null,
              "nQuestion": "1V-8TLn75Lt5m9si8JzS7Aa3h9mDgw7ry",
              "nSolution": null
            },
            {
              "id": "b376890b-20b2-4986-bea4-5bffdae3dbd5",
              "name": "Autumn End Sem",
              "year": "2017",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1hBPdmQrBMyXl1S9PMH6TR3Hsxzs2RtU9",
              "solution": null,
              "nQuestion": "1tMsRJDp3AAP3sdFTrKmiYCCZaL-WVwN-",
              "nSolution": null
            },
            {
              "id": "2a78d189-7954-4b8b-b59e-09652d27c480",
              "name": "Mid Sem",
              "year": "2017",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1m1ENABe7a3WTMTjDIYU85PCFj-SsS7kh",
              "solution": null,
              "nQuestion": "155M1tYPG16i7QwBXJG1v8NZVbFTCFN1P",
              "nSolution": null
            },
            {
              "id": "acea8a3f-4b6e-47f8-ac2c-9e18433bd6eb",
              "name": "Mid Sem",
              "year": "2016",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66e98df2f740b2b3e5002c9b",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RdU_HznG_6a7KFosDo0RuhSNqJGSEzYV",
              "solution": "1plBV16DBQO-ugxcuKAoavd9UX8U3QpsI",
              "nQuestion": "1m5Gu5JMvPf08cDU18Yx5W0FnqKLi4lK4",
              "nSolution": "1PnH4peVMbzfC64eOn6N7kZjkfjHWFWxg"
            },
            {
              "id": "95cd20d2-2c1c-4ad1-84e8-3237b3c727fd",
              "name": "Autumn End Sem",
              "year": "2018",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1S5jkNHOaAz65oCnDp9ERJ5g_YeqFAZ-5",
              "solution": null,
              "nQuestion": "1RkOV7H3sPxkIyzvf8zaC2ss3DBqyea0S",
              "nSolution": null
            },
            {
              "id": "7a6ed4b2-f894-46e5-99a4-09c7ee4c67e6",
              "name": "Autumn Mid Sem",
              "year": "2019",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66f575d0f740b2b3e5002dbb",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1GbC2Rmqkt_RzpDvhbACAqpZKh6m8rz8A",
              "solution": "1AyoWBMYIuHMG1QDGYttOMHWR1Q8Jnqyt",
              "nQuestion": "1Y_tBE_tD1NnVyW-Tg8osjUNUKrV-EUkm",
              "nSolution": "1GSVL0h6rfbOEo7MzoO3UgvoednUsSW3T"
            },
            {
              "id": "e6950409-e1fb-4dd4-a433-69a7ad1b90cf",
              "name": "Autumn End Sem",
              "year": "2019",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "66f57b38f740b2b3e5002dbc",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1sdlZjvdE4n4lAYjnJXV-YzZoAb2k1Orz",
              "solution": "1awOzoo1zBPeoCnukO1oZz32IH17i3cAF",
              "nQuestion": "1lwoWTm5J1fbOvxdDa3dijTywW487yCff",
              "nSolution": "1Bj4X_lcPQA66CsV6g5DLG89PwW5623xs"
            },
            {
              "id": "d260dfba-ffc9-4690-863e-97c18aa89ab9",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1kIwmjZpMcX6pxVJysaX1jRyvFTH5GBWq",
              "solution": null,
              "nQuestion": "1DQyCbGN8wZWAkzDFVadFI2ISP8-Fp1p2",
              "nSolution": null
            },
            {
              "id": "febcf415-bbb8-4a0a-ade5-6c1b37180ffe",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "6721b7325a965de869c4337f",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1LOhNrm2sF9ppT0lx1mBfiIoGPxeBdcHx",
              "solution": "1Kl2qH_ObqYR19tPwCY8Zp9uUBuhR9lpS",
              "nQuestion": "1DyIW9M4o2HzR3E_sJtjxA-CgbTU7zKj_",
              "nSolution": "1mpVB_LFBCDMSFfcg6hvnqQst2tV4fng-"
            },
            {
              "id": "a2d91aac-4e9e-4171-ae46-81a6fd0ce832",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1olps9P90morW5Yp9B6Zj28V2g3A7eWML",
              "solution": null,
              "nQuestion": "1B83Zti55FsxHZ5b2X6w7HNmHJdzXUeMa",
              "nSolution": null
            },
            {
              "id": "6fdfdce1-c14e-4844-b0b2-4fa919b8d517",
              "name": "Spring End Sem",
              "year": "2021",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fD0K6975Zhhz4OjKahP2GPhFWvAc0GFQ",
              "solution": null,
              "nQuestion": "1652nYFwMxIm85MDhtCZotWVsv5zuj8R-",
              "nSolution": null
            }
          ]
        },
        {
          "id": "6690fd1b97969283509b09f6",
          "name": "DSD Lab",
          "SUBCODE": "00000",
          "Credit": "1",
          "folderId": "1yf6fmAP5gryMrv_pJ0v6_5fQy6YGdUNh",
          "pyqs": []
        },
        {
          "id": "6690fe3297969283509b09f9",
          "name": "Data Structure Lab",
          "SUBCODE": "00000",
          "Credit": "1",
          "folderId": "1OhzvShIvavfWr4puv0lvxhr4RP0I_wUr",
          "pyqs": []
        },
        {
          "id": "66911d4197969283509b0a23",
          "name": "OOP Java Lab",
          "SUBCODE": "00000",
          "Credit": "1",
          "folderId": "1E8VwO25gBUp-vFvbZPd7_Q01vpJQqdeO",
          "pyqs": []
        },
        {
          "id": "6691204d97969283509b0a27",
          "name": "CE Lab",
          "SUBCODE": "0000",
          "Credit": "1",
          "folderId": "1DJwsYptVmA5g4n7ARfEE1lJ6CntsKjF-",
          "pyqs": []
        },
        {
          "id": "673ed1465a965de869c436a8",
          "name": "Block Chain",
          "SUBCODE": "CS40012",
          "Credit": "0",
          "folderId": "1fNZGn78-8JaGSv1zbMm8d0Xi0PHnFDPg",
          "pyqs": [
            {
              "id": "0036cc98-778f-454a-a04d-24a50e7cd77f",
              "name": "Spring Mid Sem",
              "year": "2025",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1bzvyg6E_3rtlmwpisYXmTLyBfQP7s_6A",
              "solution": null,
              "nQuestion": null,
              "nSolution": "1xxgl7F9D8_JpbvFFFjtL7O8g5rTWxBlL"
            }
          ]
        },
        {
          "id": "673ed1855a965de869c436a9",
          "name": "Wireless Mobile Communication",
          "SUBCODE": "EC30002",
          "Credit": "0",
          "folderId": "12m511GGt3-dnWXeQ31hA1WOMi73sV4fT",
          "pyqs": [
            {
              "id": "bbd68fc2-b608-4360-8f4c-63a27283b611",
              "name": "Spring Mid Sem",
              "year": "2025",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1USl3L5R_p2DzJHJHyGcPA8LO-8bXoHe-",
              "solution": null,
              "nQuestion": null,
              "nSolution": "1LiVCzl8SmTAgqQPWncNiRz0PmnyC0BUM"
            }
          ]
        },
        {
          "id": "67453d5e5a965de869c4373c",
          "name": "ARM and Advanced Microprocessors",
          "SUBCODE": "EC30007",
          "Credit": "0",
          "folderId": "1JDWTbGu34Nw9wy7S5mU5yyDJp7yEyIRQ",
          "pyqs": []
        },
        {
          "id": "674583e25a965de869c43745",
          "name": "Compilers",
          "SUBCODE": "CS30006",
          "Credit": "0",
          "folderId": "1aMa5Hnqhjz_Z4OBTUEALElCwOkYrYegb",
          "pyqs": []
        },
        {
          "id": "6745d3b123f3ccc204a6a36c",
          "name": "Artificial Intelligence Laboratory",
          "SUBCODE": "CS39002",
          "Credit": "1",
          "folderId": "13xxTCJGD62-5d4fHscmNUtX9tVN9DRHY",
          "pyqs": []
        },
        {
          "id": "6745d54423f3ccc204a6a36d",
          "name": "Applications Development Laboratory",
          "SUBCODE": "CS33002",
          "Credit": "2",
          "folderId": "1SiyjPZsqrFF4D8yVTY1on5ncy08ki2GX",
          "pyqs": []
        },
        {
          "id": "6745d72a23f3ccc204a6a36e",
          "name": "Applications Development",
          "SUBCODE": "CS33002",
          "Credit": "0",
          "folderId": "1sPOaBZXz0qxoeJtIMhFnVH0yIAjKxOvz",
          "pyqs": []
        },
        {
          "id": "6745d87123f3ccc204a6a36f",
          "name": "Data Analytics Laboratory",
          "SUBCODE": "CS39004",
          "Credit": "1",
          "folderId": "1Y5o9fWI2a3xEZrmSW7crW5HsFCsLchGx",
          "pyqs": []
        },
        {
          "id": "6745d8bd23f3ccc204a6a370",
          "name": "Advance Programming Laboratory",
          "SUBCODE": "CS39006",
          "Credit": "2",
          "folderId": "1P3CAEVlqMRPhitB3sM-0V4Ag_-Kwv9Jg",
          "pyqs": []
        },
        {
          "id": "6745d96023f3ccc204a6a371",
          "name": "Wireless Communication & Networking Lab",
          "SUBCODE": "EC39002",
          "Credit": "1",
          "folderId": "1SYYzYv58p4sd3TLbDIqHKXg8O4YKu0RG",
          "pyqs": []
        },
        {
          "id": "6745da5123f3ccc204a6a372",
          "name": "ARM Laboratory",
          "SUBCODE": "EC39006",
          "Credit": "1",
          "folderId": "1-HZAMRrV2L_67WzPHy422tHfj9I6fHS0",
          "pyqs": []
        },
        {
          "id": "6747326d72375d8fe311386b",
          "name": "Advance Programming",
          "SUBCODE": "00000",
          "Credit": "0",
          "folderId": "1ndVcmCpI53M4f4NNA6N94htdRwKnTEVX",
          "pyqs": []
        },
        {
          "id": "674b3cede7f74b6f4151bacd",
          "name": "OS Lab",
          "SUBCODE": "CS29004",
          "Credit": "1",
          "folderId": "1tGeOvgcb22OYjp7dyaLPhR-UOPOg3nF9",
          "pyqs": []
        },
        {
          "id": "674b405ae7f74b6f4151bad3",
          "name": "DBMS Lab",
          "SUBCODE": "CS29006",
          "Credit": "1",
          "folderId": "1OAE_3QKId0mTeoTuOS2kcf5pzpR4m_s4",
          "pyqs": []
        },
        {
          "id": "674bcf99efb88dc42ecd189c",
          "name": "Information Theory and Coding",
          "SUBCODE": "CS20008",
          "Credit": "3",
          "folderId": "1b9chh_Nah-ACGoUr-wB_Yb3M4D25c2nv",
          "pyqs": []
        },
        {
          "id": "674bd16aefb88dc42ecd189d",
          "name": "Principle of Signals & Systems",
          "SUBCODE": "EC20006",
          "Credit": "4",
          "folderId": "1xAbkstSs6cPvEDlP9A9w_tmwi_rTl8-b",
          "pyqs": []
        },
        {
          "id": "674bd95a6a4e34484edd9904",
          "name": "Organisational Behaviour",
          "SUBCODE": "HS20220",
          "Credit": "3",
          "folderId": "1179Vt9FbCKJ1wjjqp2YaIWzRuJYbyvhP",
          "pyqs": [
            {
              "id": "51a6eab6-9841-4562-80b1-d5b52586d1d3",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1fw9Y_-IJrD7MY1C35OGItkxUfVLRiaMC",
              "solution": null,
              "nQuestion": "10oBfCqnHbPuDiHA9dmMnF3wKcRdy6PEc",
              "nSolution": null
            }
          ]
        },
        {
          "id": "6758f9f91e8ec0a1763b30b5",
          "name": "Engineering Mechanics",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1EKZfPVSc-ztNcf-LE7ntOzJo0my9fNAB",
          "pyqs": [
            {
              "id": "e8124d64-9897-4fe5-b419-f67d9cf50c64",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ud39VKxFz2ZBLJxqeHDNXxblnD2na6uM",
              "solution": null,
              "nQuestion": "1085JCl9SxpUwrIZQz-veowScuHvO5m1X",
              "nSolution": null
            }
          ]
        },
        {
          "id": "6758fa411e8ec0a1763b30b6",
          "name": "Creativity and Entrepreneurship",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "13ubUPWSxTEyfsleeDaHhGkFkuOEwEf4f",
          "pyqs": [
            {
              "id": "2d1cf31f-c80d-4553-a2a1-8429a1f3e199",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1Nu5fh-lMPlawqgAIUTKqKwIJ7c6hpCf5",
              "solution": null,
              "nQuestion": "1TKjXzO1tr-6ppEvd5oioPJIW9TcsKE2n",
              "nSolution": null
            }
          ]
        },
        {
          "id": "6758fa911e8ec0a1763b30b7",
          "name": "Essentials of Management",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1rLLDd0lMVySkPjg4gHEkRPR1yp_bfrzB",
          "pyqs": []
        },
        {
          "id": "6758faac1e8ec0a1763b30b8",
          "name": "Society Science and Technology",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1sWvxyoELmBvv6T16H2IZ1NtzAyh0ptAp",
          "pyqs": []
        },
        {
          "id": "6758faca1e8ec0a1763b30b9",
          "name": "Elements of Machine Learning",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1Undk1fr1QXuOw8K7YZ2ZHeMFTnjQIfdm",
          "pyqs": [
            {
              "id": "1356e551-c4a1-4d01-83e5-d3f285a8a7e3",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BAysphu406U3UpI7ki3xwlWIXs46I40a",
              "solution": null,
              "nQuestion": "1pITlP2zhNWLLftkFstpspARZA9uk0KBT",
              "nSolution": null
            },
            {
              "id": "927adac4-f08b-4b20-a373-33b705a371f2",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1NqK-3DQo09qLsydWcWlqEhhYC7DzFvVQ",
              "solution": null,
              "nQuestion": "1mSBd2-7Zc5ndDRs37GNtan4imQeqg-q5",
              "nSolution": null
            }
          ]
        },
        {
          "id": "6758fb151e8ec0a1763b30ba",
          "name": "Biomedical Engineering",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1EVJq4QwiGRRjyU5lIFhZKroFeT10Tjjv",
          "pyqs": []
        },
        {
          "id": "6758fb3c1e8ec0a1763b30bb",
          "name": "Basic Mechanical Engineering",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1YFaofMo9sm_bNL7Tp7DbIRTdm4DIeCj6",
          "pyqs": []
        },
        {
          "id": "6758fb641e8ec0a1763b30bc",
          "name": "Basic Civil Engineering",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1u_yPs1Et0dflzopx8S5uOHbnW_86CvFR",
          "pyqs": []
        },
        {
          "id": "6758fb881e8ec0a1763b30bd",
          "name": "Smart Materials",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1LZMMctF8Xvv0l0p8xqcxLtwjP8d_QnL5",
          "pyqs": []
        },
        {
          "id": "67d451588db82be398f21ffe",
          "name": "Science of Public Health",
          "SUBCODE": "00000",
          "Credit": "2",
          "folderId": "1K0A_lBsnZxW6FyG8Ss_vzdaEMqIvdlKF",
          "pyqs": [
            {
              "id": "a43843a5-9bcf-43b9-9599-bd5221210681",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1RVIul_pKKJMd_Vp9uJAThadm8mSvmDr6",
              "solution": null,
              "nQuestion": "1_UCse3spaKRqP0aS4DXZOiBdy56dwugM",
              "nSolution": null
            },
            {
              "id": "10fc496f-e853-49cf-84aa-7e4cb66ac62e",
              "name": "Spring Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1mTBdH0W8pz8jrj1jeq_gyTP5ihgzfjlb",
              "solution": null,
              "nQuestion": "1FX4L6o9O3GgwlMAJjOs5ENegSkK-RbBr",
              "nSolution": null
            },
            {
              "id": "ede6b03d-0e4f-4f8b-a8f8-2aa61fd64c96",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1l2TW2Nh72LkD7ZPNcnJoxLBQWtMZqzvD",
              "solution": null,
              "nQuestion": "1Ufm9MgLuXPbp3_I_qpYo2RRjNWksGxit",
              "nSolution": null
            },
            {
              "id": "eb327106-7489-419c-b413-9b11f695c15d",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1eZwcQQzsH4ZY8Jv8rw7TXvk3qi0iZcKV",
              "solution": null,
              "nQuestion": "1FRHwLm1aeYalo2mk46fWX9V3HOcIHoJc",
              "nSolution": null
            },
            {
              "id": "1da56dfa-98df-4ae2-871f-c382b8440743",
              "name": "Redmid",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1BMmBsocdS4_vjlFZzK2gK81Ig4pSl8OA",
              "solution": null,
              "nQuestion": "13uQfpBNiYbp9QUD-_fvT27AajZvOsF55",
              "nSolution": null
            }
          ]
        },
        {
          "id": "67d452b18db82be398f21fff",
          "name": "Molecular Diagnostics",
          "SUBCODE": "LS10003",
          "Credit": "0",
          "folderId": "11zO3dUz89LGMVCLBgzIsFxK0gC1P5KQr",
          "pyqs": [
            {
              "id": "c2bbbe66-bbcf-4781-b6e1-4e79ed8dbbd4",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "16jeuuWqvvSB2wRyXeAt5DIQv5_RTU8QS",
              "solution": null,
              "nQuestion": "18wCmRXsB0jemoqPSnE1tKre9BO0RdkZ6",
              "nSolution": null
            },
            {
              "id": "56f70251-472d-4514-914a-9fd1bfed5883",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1y_9VqbPc_XRBqGRs7B2AhOqR2mURQEOX",
              "solution": null,
              "nQuestion": "1WfzojTV_9iWmLWfZxRXAu-8H8kt0Yedn",
              "nSolution": null
            },
            {
              "id": "0907bc58-0078-4d35-baf1-dd90f3d63442",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1TLijmECrllvjZgJASn4lLgeBSS51dPpf",
              "solution": null,
              "nQuestion": "1wZw3geW-RAAXBtDmn7HlgF0jvDcuPOK0",
              "nSolution": null
            },
            {
              "id": "f69ac5da-8855-46f1-af04-caa56c307495",
              "name": "Spring End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1IsnhRZsBzGmWx5hdHbyDuRC8W1h7y1D7",
              "solution": null,
              "nQuestion": "184e7Ki4gLyrTU07H-uHcPASysh3Fx5OX",
              "nSolution": null
            },
            {
              "id": "97892eeb-8fac-43ff-8a86-b1df5711c3c9",
              "name": "Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "18B8Zu8SiU_5BK02U9eGAJ8Kt92Lqwb11",
              "solution": null,
              "nQuestion": "10nFySLJBOQpj2WxjdjjMcv-jS_QQkJum",
              "nSolution": null
            }
          ]
        },
        {
          "id": "67d455e88db82be398f22000",
          "name": "Optimization Technique",
          "SUBCODE": "00000",
          "Credit": "3",
          "folderId": "1obll-fFXqwzr4nwJicJnCVzhmgqIbKGx",
          "pyqs": [
            {
              "id": "a13ac5ee-98f1-4f29-a7d7-862c7034b6a8",
              "name": "Autumn End Sem",
              "year": "2022",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1ACSbq4cQma7Rt_N5he5mD1Z7TSyqO7zl",
              "solution": null,
              "nQuestion": "1yHaaEFZn6UkULMUj78L9Mf-NJiIo_NGh",
              "nSolution": null
            },
            {
              "id": "d2cb6b35-38fe-420e-a3bc-6e7d5e33e5bb",
              "name": "Autumn Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "19C6Z_HzoSYpdbigxVEsJyYBna93QNurd",
              "solution": null,
              "nQuestion": "1EsQiuoEkqxKgzhHJR6ZjXh4562x4S65T",
              "nSolution": null
            },
            {
              "id": "eb32d3c3-0e7f-4802-9f1c-40d148c12daf",
              "name": "Spring End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "16ZyxO-odLuiryTObhTtGJ8BOPp1sEfIr",
              "solution": null,
              "nQuestion": "1DXpxzEqL2yhPSJzSlVUB_RPa3vH00tg0",
              "nSolution": null
            },
            {
              "id": "d09767c8-1e59-4d88-8bb2-7d61ddf1f033",
              "name": "Spring Mid Sem",
              "year": "2023",
              "type": "MID SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "17Ahak8VRm813a1kUIw95uFuxR71_w0ys",
              "solution": null,
              "nQuestion": "1UuDIt1lR0P0O8edpqVwCeCgkoxfutRUQ",
              "nSolution": null
            },
            {
              "id": "1fe1cfa2-5143-43a4-a777-6cf34c6198cb",
              "name": "Autumn End Sem",
              "year": "2023",
              "type": "END SEMESTER",
              "status": "NO-SOLUTION",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1MjlVxEo2ERZK61nrYp28g4AX_enWWbMQ",
              "solution": null,
              "nQuestion": "1a-eg_EJGz25Zy6qE16glapoYA59pApeK",
              "nSolution": null
            }
          ]
        },
        {
          "id": "67d50cc08db82be398f22004",
          "name": "UHV",
          "SUBCODE": "HS30401",
          "Credit": "0",
          "folderId": "1Zg3w4ebi4_JNXmgReGcOnKFYrlCcQLO9",
          "pyqs": [
            {
              "id": "7407f382-bff1-4acd-bda7-8d12ae427b14",
              "name": "Autumn Mid Sem",
              "year": "2024",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "67e0ecca8db82be398f22032",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1XIgBWHjT7Mm_DjMk-tmUWHALjyJvhnWU",
              "solution": null,
              "nQuestion": "1Bv80mLszrVcJWvBq0DF1DtXZyfhaDTEY",
              "nSolution": "1kW3_7d4SIqf5jjwskf7A14A0muJFc5Sq"
            },
            {
              "id": "9db56ac0-0c15-4eea-a8f8-4e999a3dff59",
              "name": "Autumn End Sem",
              "year": "2024",
              "type": "END SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": "67e4064ff13d34c18dbf0422",
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1EME4xbplgIlS7HIY7fwvuAAlF3eLF6zM",
              "solution": null,
              "nQuestion": "1TKMuNnVNOXhWhvuSVP-SA-zBuR6svmeK",
              "nSolution": "15PnUW0ybr4pPaz2xroly33y58AcZJJl4"
            },
            {
              "id": "fe122704-2285-409d-b392-0eef5027a078",
              "name": "Spring Mid Sem",
              "year": "2025",
              "type": "MID SEMESTER",
              "status": "APPROVED",
              "solutionUploadedBy": null,
              "QuestionUploadedBy": null,
              "mimeType": "application/pdf",
              "Question": "1US05Z7WOTQZ6P8UvI1ChfrfE524T429o",
              "solution": null,
              "nQuestion": null,
              "nSolution": "1GlChe9SXv4AFjICzwCSffhR09re7DS4G"
            }
          ]
        }
      ]

      const pyqsAndSol = [];

      for (const subject of allSubjects) {
        const pyqs = subject.pyqs;
        if (pyqs.length === 0) {
          continue;
        }

        for (const pyq of pyqs) {
          if (pyq.status === "NO-SOLUTION" || pyq.status === "APPROVED") {
            continue;
          } else if (pyq.status === "VERIFIED") {
            pyqsAndSol.push({
              subject: subject.name,
              pyqsName: pyq.name,
              year: pyq.year,
              type: pyq.type,
              pyqs: pyq.solution,
            });
          }
        }
      }

      return pyqsAndSol;
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }


  async getAllSVerifiedNotes() {
    try {
      const allSubjects = [
        {
          "id": "65d212841bdc9aab413387ec",
          "name": "PHYSICS",
          "SUBCODE": "PH10001",
          "Credit": "3",
          "folderId": "1NBj0CZ5uc-ThiSApU58PpX9xKR_vhrv0",
          "notes": [
            {
              "id": "72ac6b26-f6fb-4e42-a063-a730a9d0f838",
              "name": "Physics Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1w2wVZidZVgtR3FDfcbJ5vzkzhfUm4mVJ"
            }
          ]
        },
        {
          "id": "65d212841bdc9aab413387ed",
          "name": "Differential Equations and Linear Algebra",
          "SUBCODE": "MA11001",
          "Credit": "4",
          "folderId": "11LQiw6O_sktrg5dl9EUqjppPXfA38F1S",
          "notes": [
            {
              "id": "de2997fd-f482-426a-80a1-777f37ac87bc",
              "name": "Mathematics Part One Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": null,
              "Notes": "1y-4GXyNqRWcvlKEiKa2Z3QtfXBSDRTOa"
            }
          ]
        },
        {
          "id": "65d212841bdc9aab413387ee",
          "name": "SCIENCE OF LIVING SYSTEMS",
          "SUBCODE": "LS10001",
          "Credit": "2",
          "folderId": "1mJrGszv-7G22-3UZVGNyY-IDF29_9Yhs",
          "notes": []
        },
        {
          "id": "65d212841bdc9aab413387ef",
          "name": "ENVIROMENTAL SCIENCE",
          "SUBCODE": "CH10003",
          "Credit": "2",
          "folderId": "1yRnAfw0Z1C1RHZPbO2sm2tO4ETG-T-SK",
          "notes": [
            {
              "id": "7a530d55-af6b-42a0-90e8-34d80dc3dc93",
              "name": "Overview of the Environment",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1bZ75iBklQG9tOtykOtpR7dFqCeFP4mGn"
            },
            {
              "id": "9de53464-1e79-40cf-ad50-6e7fafbdd284",
              "name": "Water Pollution and Control",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1nRj_5C7MSd-zr7jCYUUUmp-Iwkq_QP_v"
            },
            {
              "id": "80c9e09e-5b09-4d59-bcbd-fffff454106d",
              "name": "Hardness of Water and Metal toxicity and Soil Pollution",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1kr0SrulJR_Pe70W_kaQflI5I33B5_67a"
            },
            {
              "id": "3ecf6860-d63b-4243-9a98-53b68c654a27",
              "name": "Green Chemistry",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "10Z3MQZfUrIEoT18SfTKjfDenNp7X3-iv"
            },
            {
              "id": "815af4ec-d029-4cd8-94aa-06b180116a00",
              "name": "Solid Waste Management",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1PqPkTOo8GBYKCodWe_u6hMK2OoxHbJ-I"
            }
          ]
        },
        {
          "id": "65d212841bdc9aab413387f0",
          "name": "PHYSICS LAB",
          "SUBCODE": "PH19001",
          "Credit": "1",
          "folderId": "1-BQdGsjwGgUgmD2xeOcvE_O1Py4l7NqT",
          "notes": []
        },
        {
          "id": "65d212841bdc9aab413387f1",
          "name": "PROGRAMMING LAB",
          "SUBCODE": "CS19001",
          "Credit": "4",
          "folderId": "1vBGBj8J1J13ZGire6k7KTVi9bM1JSqyE",
          "notes": []
        },
        {
          "id": "65d212841bdc9aab413387f2",
          "name": "ENGINEERING DRAWING & GRAPHICS",
          "SUBCODE": "CE18001",
          "Credit": "1",
          "folderId": "1teBnTJZmXgHxipPQMMp5w9W2Sm0UVKV_",
          "notes": []
        },
        {
          "id": "65d212841bdc9aab413387f3",
          "name": "ENGINEERING ELECTIVE-II",
          "SUBCODE": null,
          "Credit": "2",
          "folderId": "1czq0HuYngIIAQ9c-5LasVMpkdlxba8_P",
          "notes": []
        },
        {
          "id": "65d212841bdc9aab413387f4",
          "name": "SCIENCE ELECTIVE",
          "SUBCODE": null,
          "Credit": "2",
          "folderId": "1VM7DUEcLv9Cba_E9AoRmg-qOxQnrTU6l",
          "notes": []
        },
        {
          "id": "65d213b11bdc9aab413387fd",
          "name": "COMMUNICATION LAB",
          "SUBCODE": "HS18001",
          "Credit": "1",
          "folderId": "1nCkNUx-iMeXMmWDrRVEn2d2hkttI-ss6",
          "notes": []
        },
        {
          "id": "65d213b11bdc9aab413387f7",
          "name": "ENGLISH",
          "SUBCODE": "HS10001",
          "Credit": "2",
          "folderId": "160pnTWAGgB2IOPSTl_17I4ofjY257obo",
          "notes": [
            {
              "id": "e8833391-a8a0-4a34-9b21-8e92968688d8",
              "name": "Professional Communication Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1TLPDtbbHbLaU9-RTp7ykJlwZWJFBDF_r"
            }
          ]
        },
        {
          "id": "65d213b11bdc9aab413387fe",
          "name": "ENGINEERING ELECTIVE-I",
          "SUBCODE": null,
          "Credit": "2",
          "folderId": "1vGH4arUhDIYoDbPCX-NNu4RXsXcUhwla",
          "notes": []
        },
        {
          "id": "65d213b11bdc9aab413387fb",
          "name": "ENGINEERING LAB",
          "SUBCODE": "EX19001",
          "Credit": "1",
          "folderId": "1zTvaumOdlZSq8BpuNlM6W2qIhhB0p9X-",
          "notes": []
        },
        {
          "id": "65d213b11bdc9aab413387f8",
          "name": "BASIC ELECTRICAL ENGINEERING",
          "SUBCODE": "EC10001",
          "Credit": "2",
          "folderId": "1CMCRpagYf-Nrow_izVQAjfENbiDVoS0p",
          "notes": [
            {
              "id": "6d5c0ad0-81c3-43ba-b77f-0fb035c16da4",
              "name": "Basic Electrical Engineering Notes 1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1V_vvaJDu27CgMHG4HCA7fqq9Mi3gGDAE"
            },
            {
              "id": "094f7696-26f5-4013-9eaf-9269ff7e195c",
              "name": "Basic Electrical Engineering Notes 2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1aqCFIgB7Oq3iUyr_lR4qSoQaP95fmuAc"
            }
          ]
        },
        {
          "id": "65d213b11bdc9aab413387f6",
          "name": "Transform Calculus and Numerical Analysis",
          "SUBCODE": "MA11002",
          "Credit": "4",
          "folderId": "1HqtbjSjn7SCXMiLs1K_RVcTOh-_EAdEn",
          "notes": []
        },
        {
          "id": "65d213b11bdc9aab413387f9",
          "name": "CHEMISTRY LAB",
          "SUBCODE": "CH19001",
          "Credit": "1",
          "folderId": "1Sm5xgD1Mlp_NQ-YxjRM675-QQv2yTuOp",
          "notes": []
        },
        {
          "id": "65d213b11bdc9aab413387fa",
          "name": "YOGA",
          "SUBCODE": "YG18001",
          "Credit": "1",
          "folderId": "1g-UmLq9QRmE5pUP-XcVvzsZyb0JvLZiY",
          "notes": []
        },
        {
          "id": "65d213b11bdc9aab413387fc",
          "name": "WORKSHOP",
          "SUBCODE": "ME18001",
          "Credit": "1",
          "folderId": "1uAo2YA57kx4pEjdu7r4yqFBZTsCi--YW",
          "notes": []
        },
        {
          "id": "65d213b11bdc9aab413387f5",
          "name": "CHEMISTRY",
          "SUBCODE": "CH10001",
          "Credit": "3",
          "folderId": "169Oi8YbSco-OJmkZE6LKnnty62IekBOM",
          "notes": [
            {
              "id": "290ce12a-82e3-43ff-9af4-8d29176d6f8b",
              "name": "Chemistry Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1AnSEmdS2Wi5FHJFTDEVt4EFgEQIS5ugT"
            },
            {
              "id": "4764c82d-bcb9-4b97-bf4a-2d06eede7745",
              "name": "Thermodynamics Handwritten Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1H3_-VGFyjIFQzgzP-aTnyU2QXCXthYyD"
            },
            {
              "id": "9abe95da-acff-42ed-98f6-8e14b3ab8771",
              "name": "Thermodynamics PPT",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1VRS5nYrT9Q5JnHwqg9igaL6D1SlTHbJW"
            },
            {
              "id": "4c670b86-150d-45dd-beec-4265f2f59ca3",
              "name": "Thermodynamics Numerical -1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "10G_DrcWWnuaTKd_csZ2-VndDxcytfaLG"
            },
            {
              "id": "69eb1d12-8c84-41c3-8259-595d40f63eda",
              "name": "Thermodynamics Numerical -2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1ObWocHEtRmvweQrrYgQ0lZnrnXbRk5q1"
            },
            {
              "id": "abd461b2-3430-4e17-b2a8-0650cd3b89fc",
              "name": "Chemical Equilibrium",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1laE3FMXtv1Mfd5fEX7tyk0X2TFC8vhMo"
            },
            {
              "id": "e0ef2f55-f9ce-4aaa-84bd-35c01202d41d",
              "name": "Chemical Kinetics Handwritten",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1xiEP-lTiyQlzcLiOFKHnY1nyEaAHJz8C"
            },
            {
              "id": "53d09af1-423e-4f0b-98ce-fe7ebead34e3",
              "name": "Chemical Kinetics PPT",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1m-XA27T33kq7x66oMCsMCp-Vme-a6gt7"
            },
            {
              "id": "18d1d85e-f57b-4110-8662-f709b6654679",
              "name": "Organic Spectroscopy Handwritten",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1i_Ey2S8ZXkWiJFf0CcQbHWrYSjmkCHn2"
            },
            {
              "id": "2325882b-ac84-46d2-975c-8d9adf6cdb2f",
              "name": "Organic Spectroscopy PPT",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "18M5F97QwayVxdlZIyvbtPQQTeITFJI1U"
            },
            {
              "id": "5d96e877-688f-4de6-bef9-8ef80a54bd8f",
              "name": "NMR Spectroscopy PPT",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1QDy29tnW2Ov77cT-2I77xUIYI2tvCEt1"
            },
            {
              "id": "d913c943-e9f7-4530-b18f-540d3cea5c27",
              "name": "Electrochemistry Handwritten",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1ILsNfB2yXuEvsDpftbru5sLddZf13keC"
            },
            {
              "id": "3ae6def5-126f-409a-9e09-026238702da3",
              "name": "Electrochemistry PPT",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1GIgRY51bKMOTmB1HPIuK4ny87nxRhUON"
            },
            {
              "id": "9da0b346-0d8e-4739-976a-176478837124",
              "name": "Electrochemistry Numerical",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "181i6x4qOrRw41o8lKhBapYzxpV26Vmae"
            }
          ]
        },
        {
          "id": "65d214db1bdc9aab41338803",
          "name": "Industry 4.0 Technologies",
          "SUBCODE": "EX20001",
          "Credit": "2",
          "folderId": "1aO_AsMZIEOCe9karKTjW85gHzZMSOQkd",
          "notes": [
            {
              "id": "7cdcbe70-b2b7-4947-9651-649e1e93bce4",
              "name": "Introduction Slide of Industry 4.0",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1EhOpS7Am0pwZQqyIHa_yjdLnwszjXQEP"
            },
            {
              "id": "f4268039-e438-452b-a60e-8231650018b0",
              "name": "Technologies",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1InpU9DWGRzTMjOuW5eh79ashR5hp87Hz"
            },
            {
              "id": "9b826c18-0bd2-4e7e-8598-e4c4d0c3e9b8",
              "name": "Design Principle",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1LaVOJirefj8hjAVYdvT0ZONcwKjhH1ES"
            },
            {
              "id": "a4c9dc6e-1c65-4b27-b209-c538922216f0",
              "name": "Additive Technology (CAD, 3D Printing)",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1AS6FxYKPgL6jhwcgnstGKOBImN8aZJAY"
            },
            {
              "id": "d3afc81c-ed26-4700-bb5f-bef60316d237",
              "name": "AI",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1NgeQOFqhUzNmAMTDoanGsns2pXZiHNI4"
            },
            {
              "id": "d0b0d028-2c4c-4d1c-bede-a26f49642f72",
              "name": "Big Data",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1fTu3JjTBbso6tQHqXHMkW96K-lbx-eq2"
            },
            {
              "id": "17d9e5a7-c727-43e1-9312-7632c88cc5c3",
              "name": "Cyber Physical Systems",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1IFANbY3qEqAorje1VzN2KzJzVKJIV78e"
            },
            {
              "id": "92eb4124-422e-4f94-b7f1-ef236df92f8d",
              "name": "Cloud and Fog Computing",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1zMVkfwO4A670LKflvMJsBKS5yRKnr1Ba"
            },
            {
              "id": "4d80edbf-4b91-4a6b-9090-8753cdd45a7d",
              "name": "Augmented Reality and Virtual Reality",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "18Va9Yni3SKG7MyFYe5MVYb3kJRyaP550"
            },
            {
              "id": "757b27b2-000f-496a-a913-5162a0c9aa6d",
              "name": "Block Chain and Cybersecurity",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1yTNwc8dNpRrgmJfn2Ms3gVugQQ6BMeZp"
            },
            {
              "id": "621c9cb7-e44d-4d6b-a285-07a9b7f2f01d",
              "name": "Internet of Things (IoT), IIoT, IoS",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1y31cmAgYljhqCWvGLAYLiIUXceYhql_G"
            },
            {
              "id": "a49e26e5-1224-4b49-bfdd-173115868a2f",
              "name": "Smart Factory",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1rHiCgAh3X8sD29DCBHiQ9IKmT-AlDnwL"
            },
            {
              "id": "91c5b6d2-f64e-4d11-adb6-9d4cc522b06c",
              "name": "Digital Twins",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "19u5SCyn3s5rmwmsAkdOE-56yRRhz_Ind"
            },
            {
              "id": "90cc3532-d2c5-4c60-a473-44574adef382",
              "name": "Robotics and Automation",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "107IPtLbK0u2UQus4yNEZCujBRGSh8WD3"
            },
            {
              "id": "7a9e0ae8-e8b2-46fe-9e55-74710a6efe31",
              "name": "Economical Impact",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1W5ozVpLr0YgU8Ie9P_hN14FajlS9lzxG"
            }
          ]
        },
        {
          "id": "65d214db1bdc9aab41338801",
          "name": "Scientific and Technical Writing",
          "SUBCODE": "EX20003",
          "Credit": "2",
          "folderId": "1Je_r3OrZOKTMNiCFO_tLQUncxV9HVY9F",
          "notes": []
        },
        {
          "id": "65d214db1bdc9aab413387ff",
          "name": "Data Structure",
          "SUBCODE": "CS2001",
          "Credit": "4",
          "folderId": "1wylGvLGZXWnApRkc2noJUostT8FuGE6K",
          "notes": [
            {
              "id": "9e057cec-280d-4b0f-b8be-215a24b7ddc9",
              "name": "Data Structures and Algorithms Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1KMDjN4vouRLyPAwyr9088Ewoxg4V26BI"
            }
          ]
        },
        {
          "id": "65d214db1bdc9aab41338800",
          "name": "Digital Systems Design",
          "SUBCODE": "EC20005",
          "Credit": "3",
          "folderId": "1PMBLip9V7jVPNy_MpOhgNtHEPwIC_tsu",
          "notes": [
            {
              "id": "1d96c7af-84be-44fe-bab3-d966c93a627c",
              "name": "Digital Electronics Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "19GMCy9CzLXGDtFzuIVvqVDgXm6tW-zvS"
            },
            {
              "id": "c62cb198-b232-45ee-a648-cc76674d05fe",
              "name": "Module-1 Basic VLSI System Design",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1C4Q2lQnIB06rfvjwxJJJwtlVdcNYQNa2"
            },
            {
              "id": "96a308ab-5233-4c0a-9f4a-cffadea9041a",
              "name": "Module-2 Binary Codes & Boolean Algebra",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1ZXOmDChHW4TbZJcgPHgJ8_J5NCFR_iZ8"
            },
            {
              "id": "09bc7149-4da7-4857-902f-3e01f1fb6538",
              "name": "Module-3 Combinational Circuits",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1qDg7UEuA3tcuSPJwv3jWaa-gw7XfPCni"
            },
            {
              "id": "0a94df89-8011-43a7-919a-888448b54e15",
              "name": "Module-4 Sequential Circuits",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1p-T1SIOhdV-pQYtO-TcjCHRkPBeHl7kj"
            },
            {
              "id": "d9b6b272-e650-414e-aff2-628fb7bfab78",
              "name": "Module-5 Advanced Concepts CMOS NMOS",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "12NGe2nBjf6pRa6l6KGcNbRusBnNR-0bF"
            }
          ]
        },
        {
          "id": "65d214db1bdc9aab41338802",
          "name": "HASS Elective - II",
          "SUBCODE": "EX20003",
          "Credit": "3",
          "folderId": "1v06pGXIZpo-vobhDai-n_oWYLBr560Qv",
          "notes": []
        },
        {
          "id": "65d214db1bdc9aab41338804",
          "name": "Automata Theory and Formal Languages",
          "SUBCODE": "CS21003",
          "Credit": "4",
          "folderId": "1P-30fTnkY033P2rTaOZmq1p-EUg7ahom",
          "notes": [
            {
              "id": "af3c6931-75ed-4193-b43e-9bc510429aad",
              "name": "Automata and Formal Languages Notes 1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1FO-YY-VulKriznnSAWQxfZXgC0AmVhGC"
            },
            {
              "id": "25670093-e4df-491f-af22-251e4c1491dd",
              "name": "Automata and Formal Languages Notes 2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1SjdwF5rqI2Ywax2TKaBDnouYaDl7gQeq"
            },
            {
              "id": "18981c93-6ac2-4b03-ad15-cf34ff035e9f",
              "name": "Handwritten Complete Note -   3",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "12lntZXISfWCDIqN8LXO9PuXRTMM-B5Wh"
            }
          ]
        },
        {
          "id": "65d214db1bdc9aab41338805",
          "name": "Probability and Statistics",
          "SUBCODE": "MA2011",
          "Credit": "4",
          "folderId": "1h2GkDhwd5NHhEo7TjUccF9KQu3bFIwCg",
          "notes": [
            {
              "id": "7718f08d-5db2-4542-bd6a-0d8e785d1ae0",
              "name": "Probability and Statistics Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1dKee4g06ImQntGhoaJKIFTl9jNYCwRqr"
            },
            {
              "id": "1a4e22ec-d239-4961-a331-548fb07b8f55",
              "name": "Chapter 2.1  to  3.6 Solution",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "102Fa1mr6UWPd_u2dpWv-bCCcfA5G7QTp"
            },
            {
              "id": "a5aabd4f-bc90-45c8-96b2-8bc63b35e1f3",
              "name": "Chapter 3.6  to  4.4 Solution",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1AifsjlS-y7zmbk3TqaTXF55IxvG_2BDw"
            },
            {
              "id": "06c11e65-e358-4605-a62e-0f053b05e621",
              "name": "Linear Combination and CLT",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1JyuLDbDYhsHGLgBDoyeFgBZl-xXyhfrK"
            },
            {
              "id": "f3c69048-3c7d-4b8b-81e5-849896721ae1",
              "name": "Sample Mean, Variance, S.D and their propertites",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1E6cLQj-JVF5lHMUEQctuZM_OPz8gUPlL"
            },
            {
              "id": "9129305a-2628-4b15-8983-7e60173dc42d",
              "name": "Point Estimation of Parameter",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1NAaPGkgEDGEluFcjjaw1zJD4xPqGFutT"
            },
            {
              "id": "1772ebc4-e117-47e5-8720-62079c049065",
              "name": "Regression Analysis_25.5",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1LlW78FWv4XAOdfFT43iY7FR_Rl0cBHhG"
            },
            {
              "id": "b655ee6d-0f64-48d2-b1a0-b437225ff28b",
              "name": "Hypothesis Testing",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1qP2ONVNxr1RRDzTCbjYUgLpETCNWdWRF"
            },
            {
              "id": "01fc116e-eeb8-4662-b5bd-c8141171a7d9",
              "name": "Erwin_Kreyszig",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1sSyc2EGou3X1PvwQAnh9WluaeH9hJjNX"
            },
            {
              "id": "a4ecd77c-6861-498d-98b1-66756a195fec",
              "name": "Chapter 5.1  to 5.3",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1yrf71AeSZPBTW49wUOUFuAtgg_k2yXn7"
            }
          ]
        },
        {
          "id": "65d2211d1bdc9aab41338806",
          "name": "COMPUTER NETWORKS",
          "SUBCODE": "IT3009",
          "Credit": "3",
          "folderId": "1XJcx1-Ly2drudYy0vqr_cK20dJVJYpzX",
          "notes": [
            {
              "id": "61beea9b-9ba7-446f-9ae4-78c73f985e5c",
              "name": "Computer Networking Notes 1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1GqZvp3v8sUw1fpLbr5IY7Uw5m4kWIhB_"
            },
            {
              "id": "841730ca-e51a-409e-b1f6-51a2af22a5d9",
              "name": "Computer Networking Notes 2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1xRoTs3-bTMW2BcwARLXBXbSSrI0h7yPw"
            },
            {
              "id": "87a40ac0-28d5-43c1-8074-ca9f882edc50",
              "name": "Computer Networking Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "19_aeCAoDjjkwDorwYTg0IUUUh6LgIrlZ"
            }
          ]
        },
        {
          "id": "65d2211d1bdc9aab41338809",
          "name": "SOFTWARE ENGINEERING",
          "SUBCODE": "IT3003",
          "Credit": "4",
          "folderId": "1LjbtjshmDlZVSN9scqnoMiXlNnTl9FB1",
          "notes": [
            {
              "id": "3698fdb4-b097-44ea-a7ac-98de484527c6",
              "name": "Software Engineering Notes 1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1iV2mH1h1p3qnMisCDxqG2-2bz0h7ybdG"
            },
            {
              "id": "6ce927e2-51a9-43dd-8b5c-135eec42bd78",
              "name": "Software Engineering Notes 2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1PZS_silP27FpNf1LKPPz6kkmpObbwhwk"
            },
            {
              "id": "53851eea-16f3-4786-ad6f-bd08c0665e0f",
              "name": "Software Engineering Notes 3",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1vJRa5fuTx-LJxu4Hb0O7WCErawV24u82"
            },
            {
              "id": "ebbe2428-e21a-4c4a-9201-0fbb69ddc0b0",
              "name": "Software Engineering Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1wPqqqXo26SwY3rJRqKrj-CBJK9qO7Vic"
            }
          ]
        },
        {
          "id": "65d2211d1bdc9aab41338808",
          "name": "HIGH PERFORMANCE COMPUT",
          "SUBCODE": "CS3010",
          "Credit": "4",
          "folderId": "1PGH1kRoS1BYOZbd3dIi8tzSjH7ruA3js",
          "notes": [
            {
              "id": "de8c6a97-2572-4c76-9d1d-9429274fb45e",
              "name": "High Performance Computing Notes 1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1lkVh8n2XDXwCW4_NyuNLDdSi23fzWB4Q"
            },
            {
              "id": "9c8b46f7-0082-4628-9667-3c0e4c338283",
              "name": "High Performance Computing Notes 2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1Uji3ssCyep6_Uyh97ZNzEpOOH7zw3ius"
            },
            {
              "id": "b64b0eab-cd11-4c5b-bae9-1dcc1f32833b",
              "name": "High Performance Computing Notes 3",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1S2mK_8d56HfCRLQIakFaQjyTKB8fhJzC"
            },
            {
              "id": "2deb851a-e9b7-44e1-a3e0-a1348a7807c7",
              "name": "High Performance Computing Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1xNTdtSA9-NYsH584qTDJrmcEa6xRAA6B"
            }
          ]
        },
        {
          "id": "65d2211d1bdc9aab4133880b",
          "name": "D_ELECTIVE-2",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1P1-jy1ERCB-6Ovv9i4QnJHUYGRI2z9zt",
          "notes": []
        },
        {
          "id": "65d2211d1bdc9aab4133880a",
          "name": "D_ELECTIVE-1",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1-1zTdUh3wfRIEJq8OVma164yP6ox_--6",
          "notes": []
        },
        {
          "id": "65d2211d1bdc9aab41338807",
          "name": "DESIGN & ANALYSIS OF ALGO",
          "SUBCODE": "CS2012",
          "Credit": "3",
          "folderId": "1jPMKCPq5VvpdisqvnlRDw7ORQ4sVBccV",
          "notes": [
            {
              "id": "971a298e-2957-4fdc-b840-70a7a0944c1c",
              "name": "Design and Analysis of Algorithms Notes 1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1bCcP6-rTOEQPjNyCvPHJtu9kRHqC2Qmc"
            },
            {
              "id": "ef6565e1-3e93-4d44-8df0-c0996c15ff39",
              "name": "Design and Analysis of Algorithms Notes 2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "19KxKy2ChaGopwGLwb_o1NAMCL4g9XgQs"
            }
          ]
        },
        {
          "id": "65d221b01bdc9aab4133880c",
          "name": "COMPILER DESIGN",
          "SUBCODE": "CS3008",
          "Credit": "3",
          "folderId": "1XWuvoNDWq-n6W0azKIAcRNSUcPiL-jjV",
          "notes": [
            {
              "id": "b7b1214f-f8e4-4a95-9d4a-6d3b86998240",
              "name": "Compiler Design Notes 1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1WC5ri65-tHyCPgnEsiW5RMKLUn2O2Mbh"
            },
            {
              "id": "1efdfa41-8bf8-4674-9430-5b4f3f644147",
              "name": "Compiler Design Notes 2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1NrHqCgdIOsRNhvuCct9vrSXmzwuGJmlb"
            },
            {
              "id": "111d034f-89b4-49a2-b9a7-b51c5383e772",
              "name": "Compiler Design Notes 3",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1AiBQU78LpSjjeEHk6NyQZKo0ujUuxTyq"
            },
            {
              "id": "915ad417-7f88-4c17-91e7-752bfd5f75d9",
              "name": "CD Full PDF",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1J1KlTTxjhShiMRBY5IbkjkzChBe7IWyf"
            }
          ]
        },
        {
          "id": "65d221b01bdc9aab4133880d",
          "name": "CLOUD COMPUTING",
          "SUBCODE": "IT3022",
          "Credit": "3",
          "folderId": "1YDWvKY3RVtDZG_Cs8_bBNf8FxEbeQK7b",
          "notes": [
            {
              "id": "670466d3-123c-4a50-a951-ddb48b8dc13e",
              "name": "Cloud Computing Slides 1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1Fh0z9cQHwiux3KWf77b96SRX5ZsfAHJm"
            },
            {
              "id": "949582c0-a0d9-465c-a315-be9eb810e00e",
              "name": "Cloud Computing Slides 2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1Nbxce2VxpuaJUS4cmZUS_estXgBSTeEP"
            }
          ]
        },
        {
          "id": "65d221b01bdc9aab4133880e",
          "name": "Software Project Management",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1WB2RqjXJJtMDRlaiVORwUMefP7af0bs_",
          "notes": [
            {
              "id": "0f1be501-c5e9-47b3-808d-9fcff26bda6e",
              "name": "Software Project Management Slides 1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1wKMxxWjW_aaWT9-LVFwv2R_Oycwnq2eN"
            },
            {
              "id": "3f381753-25e4-474c-a049-7182ad50eea9",
              "name": "Software Project Management Slides 2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "11-JrFnW2yPc8qCcN4zfDd-gX0dirLUyW"
            }
          ]
        },
        {
          "id": "65d222721bdc9aab41338810",
          "name": "Data Analytics",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1aa7g6m9e7IHOS98ZA9T4S1z1mJ0eW_Pf",
          "notes": [
            {
              "id": "b516b62f-b539-4eaa-812e-822db020f3d4",
              "name": "Data Analytics Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1d1oKihQmwrSwJeBufijF1ucs3hcKXY5H"
            },
            {
              "id": "3dde832d-d37b-4a60-a7d1-c8197860caa1",
              "name": "Statistical Concepts",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1oOWpii8dS2lBODTuz0QQuxIaVJMg4ZCQ"
            },
            {
              "id": "0430ca0a-b22c-4be9-b7ed-da3707ca7232",
              "name": "Chapter 2 Describing the Distribution of a Variable",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1RTGIXCQMGhOCZI_ulvXgq8dULciXHz7l"
            },
            {
              "id": "a2f6e605-da55-4ead-89da-eaa5e6774acf",
              "name": "Chatper-3(Regression)",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1lZe6x2beJ2eqhYRPZf2hcWfoIjQvtksJ"
            }
          ]
        },
        {
          "id": "65d222721bdc9aab41338812",
          "name": "Internet Of Things",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1tXWyqCsnf4whXjOVbvWfvB-ERkWecKCI",
          "notes": [
            {
              "id": "04fb600b-686a-4960-bdb3-b29b6e14f2cf",
              "name": "Internet of Things Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1hPp6RN1Ipf0ZTDKQwsbB1MhrCEAaNiUz"
            },
            {
              "id": "18526393-a319-421a-b365-697056b979e9",
              "name": "Chapter-1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1KAmdtnKLR-Wt4Qc-D9w3RzdrSps419Ty"
            },
            {
              "id": "3ed096b5-1d8c-4529-b3f1-061c46214aaa",
              "name": "Chapter-2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1mtL8PUOK0BJhuLtRHBLkiR8yLCY1TKFT"
            },
            {
              "id": "df6ba174-c221-4516-87ec-1a8276f4807b",
              "name": "Chapter-3",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1QXkbwvi8SQej5kheQ1M2EnRTzV4UtVBr"
            },
            {
              "id": "494881f4-939c-4b8c-9a74-48d22043a221",
              "name": "Chapter-5",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1a8W1vYeICBf-EWRN2TMxzGQxu-zxTZP6"
            }
          ]
        },
        {
          "id": "65d222721bdc9aab4133880f",
          "name": "Machine Learning",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1gB0JzDFuYETCKwZ7A-xhAgXvTbaiFYVf",
          "notes": [
            {
              "id": "f5736aa0-6b2e-4837-affc-5e8eeddb3328",
              "name": "Machine Learning Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1X2_zLGHdyGX8DrAGfqcVHbR38KUNr0Kg"
            },
            {
              "id": "37a59b9c-0f1d-475e-9924-22261082abea",
              "name": "Machine Learning 1-20.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "12L1mVZauGS0AFqcGJbUcu5IPC5Repmiz"
            },
            {
              "id": "d403fcb8-ad18-4c8b-accd-bc6f5af560d0",
              "name": "Machine Learning 21-40.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1vtlN4X67GHfYBp_WslZDrFXM9S9_hfJP"
            },
            {
              "id": "43b9d4d8-734c-44e8-932b-c3a2e838eebb",
              "name": "Machine Learning 41-67.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "10CnjT7OnB66DZsn_-vYC0RagdvuHZV1M"
            },
            {
              "id": "2bbe7f77-bc65-42c3-a658-e34bcf0cc068",
              "name": "Complete Mid Sem Pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1knGdYdiOfaa36neOqQ3klnbqty3rjdJi"
            },
            {
              "id": "92845af5-c590-44c3-817a-53c555fcf3d2",
              "name": "Complete Post Mid Sem",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1L-Vw4Alohqfaos5uxdkmozDq_IvfzonT"
            }
          ]
        },
        {
          "id": "65d222721bdc9aab41338811",
          "name": "Natural Language Prcessing",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1sqfTf3qrO56n2y3jEcJEB7KOVAPjBEAA",
          "notes": [
            {
              "id": "78c2a07c-689b-489c-ad8b-73f2ac2ab910",
              "name": "Natural Language Processing Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1EQDa0dqQlEnTplqeZ6_Mu7Gbv-jxprOu"
            },
            {
              "id": "2a6c372d-725a-49dc-875e-91079cc30ff0",
              "name": "Natural Language Processing Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1GyU30KCNnT7MWpI4BIQycGR8nzDEr9hV"
            },
            {
              "id": "bc7b3510-dbbf-461a-9bde-33b8ceebedd4",
              "name": "Introduction To NLP",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1qPHMMcew8tsll92Nw9QKxTnHssjW7zV-"
            },
            {
              "id": "3da9aca6-b8bd-40bf-a09d-a89109c5ccce",
              "name": "Words and Morphology",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1-zgi6q-yzJRa0at8VyZ6tggiS4pVn97z"
            },
            {
              "id": "f876a59a-67c1-4ec9-b627-96499c6750d9",
              "name": "Language Models",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1atXYdgtK0E4G2vy65fvza68yjFaiJFGW"
            },
            {
              "id": "36a80e04-1c8a-4ac7-a010-a09f05529f01",
              "name": "Noisy Channel Spelling",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1DWkpeXeB9lxlUYQth1ddpfYpS_NxdiPI"
            },
            {
              "id": "0d17089e-b0e1-43b7-a498-fdb906e3082f",
              "name": "Classification in NLP",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "18bIHXqIrYsPqZOIdlfqVg9A40CEBE14p"
            },
            {
              "id": "771e1b31-6ef8-4a9c-8ddd-380ffa4b65c6",
              "name": "Text Processing.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1vGFmwE1KmPTVh1RuaZgSMa5hO4_lsYZp"
            },
            {
              "id": "ff5040a3-b203-4db7-a796-ac34fcd8dd9e",
              "name": "Emperical Laws",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1O7OmlEfEDYlCBMqrZ2qOAaPGmC-ge00z"
            },
            {
              "id": "1228a843-733b-49d6-8be8-c2565fc646df",
              "name": "POS TAGGING",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1r8IEvKsNhOZHU4CjWxmo6jgQRN4flUBe"
            },
            {
              "id": "e3a6dfaf-7ccd-42a8-955e-73b264e618db",
              "name": "Named Entity Recognition",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1NtBr9Zj_BHkCwUKlWrVeGf-s_BGLVYhh"
            },
            {
              "id": "6b6972ae-7d44-4e9d-9350-8e3890bab077",
              "name": "Hidden Markov Models & Tagging",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1tbAEdaGk8Ky6BjpE8ISBQDG6sZJZgMy7"
            },
            {
              "id": "d8ea1b2a-35b6-49e3-9e5b-2b9b951a24ed",
              "name": "Grammars & Parsing Algorithms",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1Mko6cFNkAFTXv1oSwNsjbi80-4DNFubP"
            }
          ]
        },
        {
          "id": "65d243b8567cea6553c6b517",
          "name": "Scientific and Technical Writing",
          "SUBCODE": "EX20003",
          "Credit": "2",
          "folderId": "1NRpAp4LabgaRdtfMUMJJFxvH7Qw8ubLm",
          "notes": [
            {
              "id": "26351590-ac3f-43ff-93bc-0ea0027b3967",
              "name": "WRITING Forms and Features",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1gw7QVDCDSahEHnewF9kCjG60G_nJ8heh"
            },
            {
              "id": "4190306b-4983-4772-9deb-124d3c235f49",
              "name": "Audience Analysis",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1XrmL-1igjx45e8oqzg156jGG0gwAn-hi"
            },
            {
              "id": "841aec17-cd32-4fc2-b62e-1398a2ebccec",
              "name": "Examples of Documents",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "19-oRJwdMxgQvFB5Z-7PK4xXHF_DAO58p"
            },
            {
              "id": "79dce17e-5dd8-464e-b4bd-7faebfce7ad7",
              "name": "Effective Technical Writing",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1ftf4_FpCOfSyzFbaElBPWCuBY3d4bp5K"
            },
            {
              "id": "8ff5c7f5-2e7f-4368-8a89-1d37ed6f775e",
              "name": "PUNCTUATIONS",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1q_NFv4NfuBDzDgoAx9MQAJxX0u7XiD9E"
            },
            {
              "id": "2d91753b-c511-400c-a1c7-09c323bb87a6",
              "name": "MECHANICS OF TECHNICAL WRITING",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "19WrPL_Ir4mCVPjtMEsTzWr0FwO99SZ7O"
            },
            {
              "id": "4203a03f-c049-4d04-be22-892c6676ef06",
              "name": "LATIN WORDS & PHRASES COMMONLY",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1efFPUd5BJRcSMBrx6-XLCEwAI1Qhrwik"
            },
            {
              "id": "56ee8b81-cad7-4949-9489-6fe86ac46e4f",
              "name": "INFORMAL & COLLOQUIAL ENGLISH",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1lYfD9TdBAvtzsCc9RmxKeg-kVHVYKClp"
            },
            {
              "id": "1180b5ab-6b3a-4843-bcf6-ca8861d7f7be",
              "name": "Dangling Modifiers and Faulty Parallelism",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1e3TqWKxnWsxDQvR6uM1NXlNlXnB12eAm"
            },
            {
              "id": "d7112ba8-2297-4505-b112-80474633e69f",
              "name": "ACTIVE & PASSIVE VOICE",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "18lxKEN73zrktkSTBR5wtYJrHpSF94U0z"
            },
            {
              "id": "2bdc4add-4f4c-4e73-8547-2f82de8707d6",
              "name": "Nominalisation",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1m1kVKplq2ONeVimxrudRxlZe8oM5v9OB"
            },
            {
              "id": "bf905d66-eb9f-4a90-a70a-89b55aee96ec",
              "name": "Bias Free Writing",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1wStBFd14Q2YEVgKrlgq3oCY3SGlZL6cM"
            },
            {
              "id": "f4f843e4-9c1a-4286-855a-6c9411d0fd66",
              "name": "PLAGIARISM",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1rU10NI8O7gtECy4f3RQsNcqZ3LuXGtfO"
            },
            {
              "id": "15cd3821-93b8-4736-93b5-a4d074547f70",
              "name": "signposts",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1wL1wuL27EqC7npxMdm3qDg2_XDLwyWj0"
            },
            {
              "id": "223278d9-6419-4a5f-994c-88090da97734",
              "name": "TRANSITIONS & LINK WORDS",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1yjvinHF9R3oRUAUtYnIcygFmujA3hpnZ"
            },
            {
              "id": "0648b350-94e9-48bb-bf52-bbd84f7189a2",
              "name": "PATTERNS OF IDEA DEVELOPMENT",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1fv-UbVWt5cM-zOzEQifm5VtaL6AdJD9V"
            },
            {
              "id": "65c47819-0d49-4d98-9187-4e9e2d724a53",
              "name": "TYPES OF LISTS",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1U-0KVzNU3rNzH4hNqMKMPcshb2C9MBIH"
            }
          ]
        },
        {
          "id": "65d243b8567cea6553c6b51a",
          "name": "OS",
          "SUBCODE": "CS2002",
          "Credit": "3",
          "folderId": "1TbLCaB8-2PSReL8IZ-CXdnkrivRkmr5d",
          "notes": [
            {
              "id": "4c373165-0a87-42c0-80ae-3294b7254477",
              "name": "Operating Systems Notes 1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1vWCjjKOSvWzS2rRK-ZJSLfG_36QLHTFc"
            },
            {
              "id": "0198db2f-ec93-48aa-a6a8-edb1940a9a45",
              "name": "Operating Systems Notes 2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1xqKKBZWof3XxpFxpt6NkKniPS1C3YEJ-"
            },
            {
              "id": "dd7bf3a6-63b3-407f-88c3-5c7fc816f952",
              "name": "Operating Systems Notes 3",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1yR4caIysSH5caTQdUxbOyxLDG_2NNGxw"
            },
            {
              "id": "84adfcfb-4bc7-4cb7-8a97-a4151a5ed252",
              "name": "Operating Systems Notes 4",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1rMNQEuEMS7Q7VAkVbW2a8F9zN2gxgE7C"
            },
            {
              "id": "678b6b10-6fd6-4355-abe2-70a0074a89c2",
              "name": "Operating Systems Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1MlXdQaPC6bey6tbVUAIcNXd0gCEdsvGX"
            }
          ]
        },
        {
          "id": "65d243b8567cea6553c6b518",
          "name": "HASS Elective - II",
          "SUBCODE": "EX20003",
          "Credit": "3",
          "folderId": "1wbZDXbeS6dLjA0nc4gxcPQSCEPztSZKi",
          "notes": []
        },
        {
          "id": "65d243b8567cea6553c6b51c",
          "name": "COA",
          "SUBCODE": "CS21002",
          "Credit": "4",
          "folderId": "1k8RbQS6fc_w9khO6goAEe95alrb_awN6",
          "notes": [
            {
              "id": "76a77fec-5d11-4098-a366-755ad383dfad",
              "name": "Computer Architecture Notes 1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "18GfdxjUWhetaegg5fKg8SivPZKUh6DU8"
            },
            {
              "id": "caf06ef2-f033-4254-8a60-b30d42038539",
              "name": "Computer Architecture Notes 2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1RCcRqHzcDll_5zQXllyfycRq-G5gQD6C"
            },
            {
              "id": "cbafe11a-6cdb-4c9e-9e7c-600ccc516f90",
              "name": "8_1 COA Addressing mode updated.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1ySlepKInezQxoHANjlSn0wGCWFPXxAtk"
            },
            {
              "id": "39363ee4-b159-437c-9d03-c294967f1fe7",
              "name": "5 COA Memory Operations (1).pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "13c09Bk6pmCqVgZEcsX7TsjHWVlEdMchX"
            },
            {
              "id": "05e1ed9f-9481-4102-ac35-82d16edf2b6f",
              "name": "8 COA Addressing Modes.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1czGDv3WFaCCXHo48KzAQCOng0KvtqrbC"
            },
            {
              "id": "b42bf856-9194-4295-85fb-2de05bfa6e51",
              "name": "7 COA Instruction Sequencing.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1rtl_LRbnhz8Fy8kmyEAYW57lH1T6OeJk"
            },
            {
              "id": "e4d9f82d-3b43-4b82-a796-765b6eff1c96",
              "name": "5_1 COA Number Representation.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1Pfm5zGiNnhLEpn9bIGzX_vD_3xlfWlPO"
            },
            {
              "id": "bb053157-3022-45d9-9965-abff5d1d3c67",
              "name": "5 COA Memory Operations.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "16jNPWVX-WC5wIID4Y9oLZ4SwNOY9cNqm"
            },
            {
              "id": "5ab358c0-b4ad-4486-8e75-a7214773e008",
              "name": "4 COA Performance.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "157xMrcXTyJ1G_Ug3lQQdlxWIDJ3Irfgb"
            },
            {
              "id": "fa3cddba-9db0-4f30-9f38-468b8c2de737",
              "name": "3 COA Bus Structure.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1f_gMPEjjM0mM-4twYKIBdPy_uvoUmSL1"
            },
            {
              "id": "2037a5e5-d9d1-4dcb-804d-3ab0804a56d8",
              "name": "2 COA Basic Operational Concept.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1WCYkfTXyhyORaOSV5MsUG8kcfKIWKqlP"
            },
            {
              "id": "bf0060b5-a4f5-4923-9ef0-666c8e24f7d0",
              "name": "1 COA Introduction.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1j2dLEMtBpG__YzgYKZjr1Jf28Y-GE14-"
            },
            {
              "id": "81593496-d703-40cf-9c4e-3ff673fde669",
              "name": "COA_UNIT-3.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1u3U7JegRAWzNtePn84YcKSsL9lNPKTiw"
            },
            {
              "id": "0d500cc9-6e7f-412f-b1a6-3d1cae61aab5",
              "name": "COA_UNIT-2.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1cAHj5wMqgcNIk1TTYD7rwVfKt6qFS8pa"
            },
            {
              "id": "6c8e1208-ee84-4d1e-b892-5bb98cdab91a",
              "name": "COA_UNIT-1.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1jYVWvuBueO2d0zQ0njK8TndnIU5m8u7E"
            }
          ]
        },
        {
          "id": "65d243b8567cea6553c6b519",
          "name": "OOP JAVA",
          "SUBCODE": "CS20004",
          "Credit": "3",
          "folderId": "19WSxWiqmXvSCIQNuTEAycnhhHX1I3nQm",
          "notes": [
            {
              "id": "b63af291-f27e-442a-a3c9-b4e82db8feb8",
              "name": "HTML Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1ogvUituYholhPqicqO5XWHeAALotG3Vs"
            },
            {
              "id": "5ed67ce3-7077-433c-a22e-6ca5f68c716e",
              "name": "Java Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1iG0k6FblMYHOzjovjCMktsz7QL8uJoVw"
            },
            {
              "id": "495eef96-3584-4d64-a661-caa51bc44973",
              "name": "JDBC Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1AHHHKwoS-fqBX4SMItE5HnFaHT82_u1k"
            },
            {
              "id": "c321da4e-8eaa-4194-95a9-1921674b685f",
              "name": "WT 17.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1AKuClshuAKm5CKPglfYvBi8LSzLoH6o6"
            },
            {
              "id": "7c977358-fefb-49c1-88ee-4829cc8ff7e1",
              "name": "WT 16.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1TxfS1cpIGRu4N0PJDWQuzGCaOi8Nsl3P"
            },
            {
              "id": "9b5a9870-660f-4b91-a342-fb166ee0caf5",
              "name": "WT 15.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "10VsPpHBV-CTmNkU5kFZ6X2inTcTm35Ao"
            },
            {
              "id": "ed648bd2-1a56-430a-aea0-6ce09a0f9a61",
              "name": "WT 14.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1Clbm_-lWAufgD_oIiyntK_EhHpbrInav"
            },
            {
              "id": "27e86eb9-aa79-4f05-bf56-84f0739eb767",
              "name": "WT 13.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1GvqM-ERfZavnmayzUCfGPa2DlTslIxX0"
            },
            {
              "id": "2c237cde-ff63-49b2-abde-89fc4eb44fee",
              "name": "WT 12.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1FmoA_1xVT0Uwz38hVluZTfheHxJVnWXL"
            },
            {
              "id": "42e4eeab-08c8-42e9-94f8-fbb82b4f2397",
              "name": "WT 11.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1TDByfvMVeayRdttdz00zopS95fECOwtH"
            },
            {
              "id": "20376a29-3830-452a-86d4-14462b2e1432",
              "name": "WT 10.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1MhBx6UlKA03_ML0ZhWMqI74BkKfF9TZY"
            },
            {
              "id": "f033201b-9f67-4701-a134-e0054120786d",
              "name": "WT 9.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1Nyk97kSzcoUtbOKOuyRu4jtiM2SPgv_y"
            },
            {
              "id": "c03a6402-a6b2-4ea6-b4f9-5931c54e1bb8",
              "name": "WT 8.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1rcQ_oCTtjUgslfMqSR1EggJ-XUhpXwDI"
            },
            {
              "id": "e53152f2-a466-4973-bb0b-d3ac71bc70cc",
              "name": "WT 7.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1awnFw1BZWTZaIdJ5LovuzrioDyeUR83m"
            },
            {
              "id": "13b12d3a-4408-41b2-a55a-b29e2c93a833",
              "name": "WT 6.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1n9ZTvNyjdtAUdkrMBCI8t8fsDt9N3zSk"
            },
            {
              "id": "d58a6bb8-07f8-4be1-b4ae-5aebe707cf96",
              "name": "WT 5.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1ottlWxdM78LFo_ZUDzCHaXdx7WvfKDND"
            },
            {
              "id": "91bfc4e7-76bc-4e86-a1bb-a75de5abe4c0",
              "name": "WT 4.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1UaPR5EPRv-17ASHjkgl1QDmSsufBkXve"
            },
            {
              "id": "7013a923-7319-40c9-98e3-086b302b75c5",
              "name": "WT 3.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1NkFRPgGBCLfEODO9-vAdMs8uP6J10J78"
            },
            {
              "id": "4666b57a-13f0-41ff-a7db-e86ef0a0811b",
              "name": "WT 2.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1ufstdy8IseYz0ex8ci0di1DkFRvfJVFV"
            },
            {
              "id": "32011202-2725-4021-951b-036c74b9a056",
              "name": "WT 1.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1k29FcbX6fq-d4_lnK-3QnCT4RKBGw3Af"
            }
          ]
        },
        {
          "id": "65d243b8567cea6553c6b51b",
          "name": "Discrete Structures",
          "SUBCODE": "MA21002",
          "Credit": "4",
          "folderId": "1GVMm-AtPcO7GtRBEZ-a18fOvqRuHCbkw",
          "notes": [
            {
              "id": "db92b507-1dad-4b8b-8c92-ee0c16faa182",
              "name": "Discrete Mathematics",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "17JCnAncpfaSHqi-_H3pKpxURo0Pegp-P"
            },
            {
              "id": "15aaba20-e69c-4d09-89cf-09b103f3b098",
              "name": "Solution of Discrete Mathematics Book",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1JrvvmQK3zxcfeUeT839AJSZ9WiP7GT3O"
            }
          ]
        },
        {
          "id": "65d243b8567cea6553c6b51d",
          "name": "DBMS",
          "SUBCODE": "CS20006",
          "Credit": "3",
          "folderId": "1KZx4AV-MF0m6qnvwIAyZxDoG7gnTCe9W",
          "notes": [
            {
              "id": "b490fbc4-8623-4b24-b734-325d80799ec0",
              "name": "Database Management Systems Notes 1",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1VUdeAVjEYqByu_e3HlYdR65z5Vr4RlTX"
            },
            {
              "id": "98e381ab-e600-4a1f-8cc1-afbd759e7a08",
              "name": "Database Management Systems Notes 2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1SjtAEFfWPEcQ4DkHEp5ptK9bdV16PkpF"
            },
            {
              "id": "9758e173-07cb-4c91-b557-3a856d2a5c84",
              "name": "Database Management Systems Notes 3",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1I9R0-7q5rx0SqMs_9dhOjW_QG4l6NghM"
            },
            {
              "id": "a70d9c01-4ce4-4fee-9203-e4d8fa596eff",
              "name": "Database Management Systems Notes 4",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1G7uC6ERqBjmqgxOlJGfEIqVf5kgwJdPA"
            },
            {
              "id": "f75e9038-358c-47fb-961b-f5e4bf033091",
              "name": "Database Management Systems Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1CEvvjAuftd9FKx65AI2Kb3wNte8VqpYr"
            },
            {
              "id": "96b031ec-3d0e-4b9e-9dbd-b0fee7e38030",
              "name": "SQL and PL/SQL Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1qPpFZ9AYC9Rgb1DKGN3m9uW2XO_zx9s8"
            },
            {
              "id": "98620b8d-9de5-42b2-9c1d-32aa19cd96cb",
              "name": "DBMS 5.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1Yg6gNdn6Cj5XYPw5SY9Y1tFJvXhzlmHB"
            },
            {
              "id": "a6ea324e-dc5c-41ae-a649-324866215b97",
              "name": "DBMS 6.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1l8APMTmyaArS85wMJQ84Ay0JbYi55oYR"
            },
            {
              "id": "80eea32f-5d03-4b13-888e-be178fa2289c",
              "name": "DBMS 3.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1Wlg87EvnqgrItxaTZerHrhNIojdZEIQ8"
            },
            {
              "id": "3ac4fc2c-4bb5-4e24-8d61-35291f8624b3",
              "name": "DBMS 4.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "10agZ6beM4GWzFsYy12NI_1dekCUSHR5K"
            },
            {
              "id": "2ffbee60-fb1c-49ae-8226-2c89ef9caf9a",
              "name": "DBMS 7.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1grHGjoUlTZ4GnyX5lpGwr0TTWj6G6-_N"
            },
            {
              "id": "d30176af-5457-4414-a585-816dbe5adbc3",
              "name": "DBMS 12.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1ZimZwBvBXKxLb2vqgF2EP_8Z72C1bUMt"
            },
            {
              "id": "6ce68a13-db88-4f0e-8878-c4130de3f543",
              "name": "DBMS 8.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "16-mmygDMvVzCEBRfNCfxFak5jB8hJx32"
            },
            {
              "id": "326c0726-6e2f-4dca-927b-01a4661b5a14",
              "name": "DBMS 9.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "12YjAHqjYaEpWLPpe45lMfOY5KSqTcx0X"
            },
            {
              "id": "7b5fa7fa-c674-4442-a3c3-9add4096320b",
              "name": "DBMS 10.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1AOFuFh8niJuw0LzbB3rcOvlIfAkHxTeB"
            },
            {
              "id": "0f67e625-5390-40e9-8c4e-2f165695f9bc",
              "name": "DBMS 11.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1Ebj3ybvgfOyqv45xrJo7W-4FfA-nr4jp"
            },
            {
              "id": "a700a67e-fd41-40d9-ac4f-c89688197d12",
              "name": "DBMS 13.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1HJmWy1fbcueEB3_AqetDHRLOJoiU8JiZ"
            },
            {
              "id": "b07dc28b-5aa6-4372-9592-3a5ff0b016be",
              "name": "DBMS 14.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1GQXhO9PiyNHC59aF0Jq-NvqDfK7wQasP"
            },
            {
              "id": "356d6757-1eaa-46db-b798-27bde2309532",
              "name": "DBMS 2.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1pXO6rNj_lAYfsAMmKmFinSC1KB6Q5N1h"
            },
            {
              "id": "3891fb88-8baf-41e6-8ec0-399c770ec390",
              "name": "DBMS 1. Introduction.pdf",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1pzEWGHQE8hFzev_MSCbyzAvCZXkJrX_V"
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388706",
          "name": "Mathematics Part One",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1fK3Y0G6B7CAPbn4mx7lBWAkHCqIkgype",
          "notes": [
            {
              "id": "b1203e6f-36e8-4d00-8c47-40c1f60fc969",
              "name": "test3",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "dsdfsdsds"
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388702",
          "name": "PDC",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1_g2wUxttNOi6xwTlywnmQb-3IBadfi9v",
          "notes": []
        },
        {
          "id": "65d2d560883f3cc806388703",
          "name": "Engineering Economics",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1Oa9LozaddgRGjuv8trM0qyZJmBGfrd9h",
          "notes": [
            {
              "id": "eeba9c93-8a73-4ed6-8dec-46e2910959df",
              "name": "Engineering Economics Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1nBbeiY3UeEk9PSGFrfGMLM5WI-YBXxH3"
            },
            {
              "id": "b3c4f545-64bf-4e45-ac69-e65e9cff12b4",
              "name": "Economics Full Notes -2 ",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1x4xmOVp5s9_-qnW26Bd6CDUfVhbulkOA"
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388704",
          "name": "Mobile Computing",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1ZjCacSY5rPV65uI0bs61VwqOKeKjfXcj",
          "notes": [
            {
              "id": "536cb451-0bc2-4e0e-8f72-fe07dd2cb12b",
              "name": "Mobile Computing Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1gm78GW-xwqeRY0ArHozZrqEUYwvXcxV1"
            }
          ]
        },
        {
          "id": "65d2d560883f3cc80638870c",
          "name": "Cryptography",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1BNytYhnQL7tzP3GsW4PGbL-nIaLGs8To",
          "notes": [
            {
              "id": "636b9348-5a11-4559-818a-f53fcd091036",
              "name": "Cryptography Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1mr_e2fuoBhpve0u1c5szHhahFGWNCcz3"
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388707",
          "name": "Mathematics Part Two",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1ijtbnk99agF-HeZICyzKZWLMf-5gMgNa",
          "notes": []
        },
        {
          "id": "65d2d560883f3cc80638870a",
          "name": "Computational Intelligence",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1Rxofy0k6CWIMtI66E9bca_IhIWURwsGd",
          "notes": [
            {
              "id": "1e6f5cfd-14ff-42cb-a54b-e0fd0859a60a",
              "name": "Computational Intelligence Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1fLN3PdOwQthQXAQqHOCQOGkbITlR-ECZ"
            },
            {
              "id": "fb32929f-7a07-4af4-a426-3f37b98d1ccc",
              "name": "Introduction",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1XpiB58pWolD1kvDo6FgE_0kF4D4Tcian"
            },
            {
              "id": "e23fec3a-48b6-49a4-a0ea-0e3bf1bddc34",
              "name": "Fuzzy Set Intro",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1O2PrdmMGLUs3UuYAtwrooiJE7rcXqMyf"
            },
            {
              "id": "67aee2c8-16ab-46a8-ba4e-64c598933dee",
              "name": "Genetic Intro",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "18Q_4hvJA4L-QYI_LvEY_uGnF4UeXgsF5"
            },
            {
              "id": "266467a4-db8c-4bf0-a249-b69dcce2d93c",
              "name": "4 NN Introduction",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1nYPqGJZ5wNr28NeyhTeXn7P6A9AR9q0Y"
            },
            {
              "id": "30d439e5-a3fd-4909-8d5f-ab90af70af23",
              "name": "NN Architecture",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1qBNAgkAv1W12rHZy8XGgOUSy_f1SAAAM"
            },
            {
              "id": "f870d2be-e620-4e88-93d1-9e025420dff2",
              "name": "Madaline",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1lzb0DRONJlDMc3ToBi9ZzHzp4iwEFEsE"
            },
            {
              "id": "60538c55-ca4e-413a-a48c-cc3961c64731",
              "name": "NN Training",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1Vv41gI4xAtX1m_WVlCVy08D1gTcdyr4D"
            },
            {
              "id": "164fb4b2-029a-44be-b5e2-0948bbe7ac81",
              "name": "Model Assessment and Model Selection",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1If2LqB88fvzoi_OFgDryZeOHWizD7oCk"
            },
            {
              "id": "55508dcd-13ee-41e1-9e59-9116ffb81684",
              "name": "Self Organizing Map",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1nYVjU__1FjcSGKV_R1dYjVdpFCsdWiPx"
            },
            {
              "id": "f1a38a0d-2051-41a2-b53b-eda5587ddd18",
              "name": "Fuzzy Set Theory",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1rJyVQJ4ExY4Gcf5jb6INcWav0vWFmfEh"
            },
            {
              "id": "f2af78f7-2a7a-46e7-bc01-5dec64853479",
              "name": "Fuzzy Membership Function",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "12ePSZbqwq7NIOnbAdFmVNygBPq5_85v3"
            },
            {
              "id": "00c53d83-dc48-419a-83d3-d47c7c365697",
              "name": "Fuzzy Complement",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1ShENVovVru2TCXG2f6USWV499BYZmJ52"
            },
            {
              "id": "885939fd-2106-40fd-b385-d6e103528763",
              "name": "Fuzzy TNorm",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1K5i0rDY_vE3Ft4ss1UdiW0s8vQBc6t1X"
            },
            {
              "id": "8fbd27fe-e892-450d-91c6-d0fc73f0d758",
              "name": "Fuzzy Relation",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1Fb17TbnD9tYo0JOuPnGIUzjG8p77NLd7"
            },
            {
              "id": "87071f1f-cabf-4053-885f-cd2bf76cb4b3",
              "name": "Fuzzy Proposition",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1wAg7QD1nf8-GnuKGnbgbCAlQ177p63oN"
            },
            {
              "id": "f7d2da86-7d62-4795-9a09-f9f4d5cc3f49",
              "name": "Fuzzy Rules",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1Z3RY3Ozjg-fI08WfS59KF-crWZAB1svX"
            },
            {
              "id": "7ca4fb50-103d-4e08-9324-170b74d866ed",
              "name": "Fuzzy Reasoning",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "154nuEUTm1ES2riay_UVPp55CMORkmOYO"
            },
            {
              "id": "403e71f8-15de-4a0a-a896-1fb1d78365f3",
              "name": "Fuzzy Reasoning-2",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1OpGvS8iIbMdkiixx_x7772dK4jQdMZ9w"
            },
            {
              "id": "bee84fb1-c85d-4ab5-a5a6-68d0519c934e",
              "name": "Fuzzy Inferences",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "19Pt2wIs8_B_z7UjuEzrUtfdT3hdlYT9-"
            },
            {
              "id": "6c42eac4-d582-4cda-b803-66441747f65c",
              "name": "Mamdani and Sugeno Fuzzy Inference Systems",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1x-XCvqj8BlGa2KbP-8c1vpeCOqXHqN4A"
            },
            {
              "id": "763b8940-e11f-4a0c-a61c-27bfa7a5f81b",
              "name": "Defuzzification Methods",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "12hYyfZ6MhcwCuM9cyYSGDUyKF_qPNz5Y"
            },
            {
              "id": "cb43fc8b-2bdd-4eb6-8f19-b2088a55bfca",
              "name": "GA Another Example",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1iuB1lobNPu9-wXxgze0AvfneLu7OEIUK"
            },
            {
              "id": "2dfe50b4-b969-437d-8293-2f2e45a41c45",
              "name": "GA Selection Techniques",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1oDuyavTX53wfuYiqu6tw5a3NkYiiTw58"
            },
            {
              "id": "6b7fd7b8-7678-4e41-b221-9ccdfa6a6718",
              "name": "GA Crossover techniques",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1ZsSxIt4qS0BdIQMTwJJaTKzC8dzSgXFA"
            },
            {
              "id": "d525276a-deb4-43df-bcde-2c778fc63123",
              "name": "GA Mutation",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1Kd3QE7zuACS8Hxf-ZgoPPpC-OAw9_BXS"
            },
            {
              "id": "8b06c87f-01b0-4e8d-a67b-53943bcb9260",
              "name": "SA Introduction",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1kyZzDgLZ69ImIJhBC9BiBegT9rwxBqd-"
            },
            {
              "id": "1a880985-894a-48df-9332-4955faa7543d",
              "name": "Hybrid System Intro",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1o8XD19Y2GuSlJNeJpCTo2v7rY2cO7t9v"
            },
            {
              "id": "aea938ff-9eb7-4693-ad3f-823bd621aa61",
              "name": "ANFIS",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1dRhwAZBieXD05uvh09f_mm0e7KXS0tlk"
            }
          ]
        },
        {
          "id": "65d2d560883f3cc80638870e",
          "name": "Object Oriented System Design",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1mVLvby58htZvt7YqnG0esDQyzqU6HLRx",
          "notes": []
        },
        {
          "id": "65d2d560883f3cc806388709",
          "name": "Artificial Intelligence",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1N4NfPNlHGIiNtuoMoI8BKhJjf8ftHzaA",
          "notes": [
            {
              "id": "c7f7c854-6f93-4912-95a4-9aea990eb6cf",
              "name": "Artificial Intelligence Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1hirlDVYgzAF2Af2JM7LDJj25yXCr2LU8"
            },
            {
              "id": "63d42bd9-6281-4af0-8253-f9ed21a3432b",
              "name": "Artificial Intelligence Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1pggpssE0T2bk9pu9o3HkUHDqtERt4MZ_"
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388711",
          "name": "Information Security",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1hcXdDMYj4GfVLx5JkKrMFAs7IBCMHant",
          "notes": []
        },
        {
          "id": "65d2d560883f3cc80638870b",
          "name": "Big Data",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1lKozSt66GymMKwb_rBNYjq7BkvfZUalm",
          "notes": [
            {
              "id": "6c0c27ff-e399-400e-8605-ce644fec7597",
              "name": "Big Data Slides",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1j9h4NOGlhKAhZMb-Y2TolGHnb-TEQk1N"
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388712",
          "name": "Object Oriented Programming",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "15pDYCocO2-z-dqnEnbEcH4uAea6VtH-V",
          "notes": []
        },
        {
          "id": "65d2d560883f3cc806388705",
          "name": "Communication Engineering",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1OMm3igXYbV13ul-zLmSLUc94xwhS2Pff",
          "notes": []
        },
        {
          "id": "65d2d560883f3cc80638870f",
          "name": "Data Mining and Data Warehousing",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1nOYMihlN8Er2_13Xd0FQdmdwH889lCuu",
          "notes": [
            {
              "id": "b8f1133e-f24b-4b1e-b47c-40c8be271f67",
              "name": "Data Mining and Data Warehousing Notes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "VERIFIED",
              "Notes": "1uc9-41er0rchsJtzRpL-3pLiQqnYzXt_"
            },
            {
              "id": "76c4bb48-4b9c-4c41-a9bb-9dd5b257f2f5",
              "name": "Introduction to DMDW",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "18CxgmjoNn67lXBD_NEBuul3sWCtc-TO0"
            },
            {
              "id": "8ec17ce0-0712-4296-81ed-3e7d65d914d5",
              "name": "Getting to Know your data",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1_3q2c8ZVxke4zyMsQe8pANaZECFDsgNf"
            },
            {
              "id": "53963852-07ef-4be0-90d4-b49f7b967199",
              "name": "Basic Statistical Descriptions of Data",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1haO6wLh4E1nuJ3DdmsBpHWmNtvta4iYa"
            },
            {
              "id": "e2a70e35-d289-4ccb-ac1b-21af4710d998",
              "name": "Normalisation",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1SvvOIYdN4o4aUcR8sLqs_H__f0K10EUW"
            },
            {
              "id": "9119d003-8b59-4078-b297-171a9b96520a",
              "name": "Sampling",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1kyitWGOy5fCgErHJQmXTGZ6HhxELamN6"
            },
            {
              "id": "e3bab0ba-5eec-4448-8f67-9c2f4aa33272",
              "name": "Data Warehousing-||",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1-dGgYjg7RKOmTq5ObHbdO3tvTbEjhTtC"
            },
            {
              "id": "5ec21a97-a9e3-4bde-8f6f-6d34134e1c5f",
              "name": "Association Rule Mining",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1sVYnfBG8-tuUgaXmjgJCABmSJ5qCbWwg"
            },
            {
              "id": "c08f68ce-3edb-421f-9eab-a163e6b4ce71",
              "name": "Introduction to Deep Learning",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1Y_9KJVZy1pwF92q5ka61VZkBtKGVz95P"
            },
            {
              "id": "1da35f4d-e13c-434c-b6af-bf0544605f54",
              "name": "Neural Networks",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1Y-TfP5-3Foqed-1lZGCMjpUNoEkWnLzw"
            },
            {
              "id": "2338b9f2-9e05-44b6-9d75-c7722b9fe9b6",
              "name": "Decision Tree",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1-30OIr4c21JIvVaZtfq3VW6T615izkig"
            },
            {
              "id": "5ef4289d-8b89-4730-9794-c055e5dfd47d",
              "name": "Spatial and Temporal Data Mining, text, web mining",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1nSPVBzLQKh2Mygovh8IExbRSMeenOAzF"
            }
          ]
        },
        {
          "id": "65d2d560883f3cc806388710",
          "name": "Principle of Digital Communication",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1WfgSZxZD0H32jiHJjptB9S8Lw8GcepRp",
          "notes": []
        },
        {
          "id": "65d2d560883f3cc80638870d",
          "name": "Cellular Communication",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "17QOluqcLPUSE_pvMwResarF4NjEhEiC7",
          "notes": []
        },
        {
          "id": "65d2d82c883f3cc806388713",
          "name": "Biology",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1L59qxEbQDon2qIhCp_HFEzODVztGLCSo",
          "notes": []
        },
        {
          "id": "65d2df4517082e98c7f1c1b5",
          "name": "Embedded Systems Design and Application",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1e2gKXhWfwDC5A_u9YGGMANZsDHhGImnE",
          "notes": []
        },
        {
          "id": "65d4704a0beae99ad05aeb92",
          "name": "OT",
          "SUBCODE": null,
          "Credit": "3",
          "folderId": "1GqTjzDGncDrnnL8EjL6HG_fgKgVOae1n",
          "notes": []
        },
        {
          "id": "65d470ba0beae99ad05aeb95",
          "name": "CEC",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1xp1hRYag-FpKTInIcz0w24QZj45TEfTU",
          "notes": []
        },
        {
          "id": "65d470ba0beae99ad05aeb93",
          "name": "WSN",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1Zf8H9S5yo1NC8D3pVHK6DreNaCgvmZKZ",
          "notes": []
        },
        {
          "id": "65d470ba0beae99ad05aeb94",
          "name": "SCS",
          "SUBCODE": null,
          "Credit": null,
          "folderId": "1Tn8fDEf7hFf_-8WslLdQOw6QAeDSMTCR",
          "notes": []
        },
        {
          "id": "66051a2a69e3a3fbd8923b84",
          "name": "Basic Electronics",
          "SUBCODE": "EC-10001",
          "Credit": "2",
          "folderId": "1jZw0qA0V_mcTOM41todltrlMJ-YEVUEh",
          "notes": []
        },
        {
          "id": "660a449c30641ad00aae8aa7",
          "name": "DBMS",
          "SUBCODE": "66787",
          "Credit": "4",
          "folderId": null,
          "notes": []
        },
        {
          "id": "6624c205daff3e83284a48b9",
          "name": "OPEN ELECTIVE-6th SEM",
          "SUBCODE": "00000",
          "Credit": "3",
          "folderId": "1iYqoJaSTBH9LB-4mTMnIoth8DVboj6Jo",
          "notes": []
        },
        {
          "id": "663c45c2e702498e19691b29",
          "name": "Professional Practice, Law & Ethics",
          "SUBCODE": "HS 4001",
          "Credit": "2",
          "folderId": "1FLalOr-q-ciQJWWOdJrzjcpHwZkdVerm",
          "notes": [
            {
              "id": "8654fc99-9cec-4289-a31c-0bac386ff8ac",
              "name": "Engineering Ethics",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1k4D7mIl66sR3XLv3UJh_m2Is0ljprjfo"
            },
            {
              "id": "b1a6214f-2f9c-494f-bb29-01cdc44efa1a",
              "name": "Engineering As Social Experimentation",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1YsjT4A4n-CHrVayCVPlm6_nI6KbkffO_"
            },
            {
              "id": "2abd8610-c508-47ef-a116-169098805f8a",
              "name": "Enginnering Responsibility Fot Safety",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1GsAt6JMw-HS1D3JQ3FKmv7C7P4bO0eoo"
            },
            {
              "id": "f3617876-242a-4489-9e17-9757612f810b",
              "name": "Global Issues",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1Y4_EyGzaS5W4paylQnuqYQpOmE9gpjAZ"
            },
            {
              "id": "b4dbf9f0-8f33-41ae-a992-a34bc59fe955",
              "name": "ENVIRONMENT AND HUMAN HEALTH",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1lM5ktvLj02tlYLlmZ0ABDdwBB_Iqsp9s"
            },
            {
              "id": "19755481-8817-47a4-a301-9124e6d8b8a3",
              "name": "LAW OF CONTRACTS AND CONSUMER PROTECTION",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1hBUVZob3rEGjPZrSweNSlLm24s32tPSE"
            },
            {
              "id": "ad9327d4-ea4a-4292-a8b3-cf7f6e93fb92",
              "name": "Multinational Corporations",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1auWlHCvW-YjsjYuPqQswiNIWX8eMIjfq"
            },
            {
              "id": "fbdc9dd4-fa53-4094-9b8a-243e265c11de",
              "name": "Liability for defective product",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1tBWpQZbraUfRD0VXN2_CNDbv421NbXEc"
            },
            {
              "id": "c653acd5-f0f2-4d15-96d0-9b21817c645f",
              "name": "Safety and Risk",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "11an-8ePFTCokQCGTiWri-aZ1irJ2rCVs"
            },
            {
              "id": "54a36ee9-f203-41c3-bdcb-8c0dc1f4e0cb",
              "name": "Evironment protection",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1IJUFG75ggT1PAcO-i24ROiFfB_WWcL-B"
            },
            {
              "id": "771c0efb-d1bf-46d0-bd35-8a6d3022e2f3",
              "name": "Bhopal Gas Tragedy & Standards for Emission of Environmental Pollutants",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "14e-0GqQxi-CAtWO-AWkE_NYCWv6d3X5x"
            }
          ]
        },
        {
          "id": "667ec56530a376b99f5af31b",
          "name": "Computer Networks Lab",
          "SUBCODE": "000",
          "Credit": "1",
          "folderId": "1kmPYLOBIU1TPJ_yML6Nf2vCsr8csuEiW",
          "notes": []
        },
        {
          "id": "667ec57930a376b99f5af31c",
          "name": "DAA Lab",
          "SUBCODE": "000",
          "Credit": "1",
          "folderId": "1Y-VSHo2pNKmi7ZZ_LVrkFKst3vQ122-7",
          "notes": []
        },
        {
          "id": "667f5faca5c50ae2af6118bd",
          "name": "Economics of Development",
          "SUBCODE": "HS20120",
          "Credit": "3",
          "folderId": "1as7Wjd3Zz18xU-EQLo6bCOO10Joaqcvc",
          "notes": []
        },
        {
          "id": "667f789c48e86f92a1d24a42",
          "name": "International Economic Cooperation",
          "SUBCODE": "HS20122",
          "Credit": "3",
          "folderId": "1oM5Hij58OlLLyra2mfgMlQOlIaShVMLo",
          "notes": []
        },
        {
          "id": "667f8a4277b386dd006297f4",
          "name": "Distributed Operating System",
          "SUBCODE": "DOS",
          "Credit": "0",
          "folderId": "1lebSKuct3U4z_3tVzSfCSnWCbhyPixzt",
          "notes": [
            {
              "id": "de2ae3b4-eeb7-4ca3-89a5-5b9554f23cad",
              "name": "Complete Note - 1 ",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1M7umZWJmKvCYIk6dttW9nKvk4Rf3iedO"
            },
            {
              "id": "87444937-6c71-49d3-a841-9a3c6ccf5bef",
              "name": "Unit 1 - Fundamentals of Distributed Systems",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "15OV5gFe3_mee92XehgxB-9SGqq9nymrt"
            },
            {
              "id": "8886b313-a6fb-4898-89e9-521654619077",
              "name": "Unit 2 -Communication in Distributed Systems",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "17tAfi3pO1rt2LbjaE77YMKoF4Q-b_0q7"
            },
            {
              "id": "401d896c-3e3a-43db-8e7f-c87f7191d9ec",
              "name": "Unit 3A - Synchronization and Processes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1JOC97FdvkqmZqKHFPSAMb0cziQxwVeyI"
            },
            {
              "id": "4a7b1c5f-e536-41d5-8cb8-5942c3bc1dff",
              "name": "Unit 3B -  Synchronization and Processes",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1fRdIpN_b5hdIE5y8pRgOLiHy1oWahlNG"
            },
            {
              "id": "5787d548-509e-4cd5-bd52-c2ccdc9e45b6",
              "name": "Unit 4 - Consistency, Replication and Fault Tolerance",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1tZUQQQb-_D5iGSxWD5pmrhb6kv7SNS9O"
            },
            {
              "id": "aa3e5f67-d433-4a45-a610-ab2de16344cd",
              "name": "Unit 5 - Overview of Distributed Shared Memory (DSM)",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1ETFEj6aeYdV2Jfu-tBZ7w9l_3MgVacEr"
            }
          ]
        },
        {
          "id": "667f8f8c77b386dd00629814",
          "name": "Data Science and Analytics",
          "SUBCODE": "CS30004",
          "Credit": "0",
          "folderId": "1oADMmC6mNwQ_b3SSec7MpBBb1y1UIhDY",
          "notes": []
        },
        {
          "id": "668de61697969283509b07d8",
          "name": "Human Resource Management",
          "SUBCODE": "00000",
          "Credit": "3",
          "folderId": "1pRVFTquS1-HeCkU8RcEBiZyztQeC0W1z",
          "notes": [
            {
              "id": "c01e1012-17ae-4365-9bc5-b34b492c96c1",
              "name": "Introduction",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1JHUzLoieQsJ_OxXx7dJy8FbzQtsXGTHg"
            },
            {
              "id": "638d40db-39f7-48ba-a42f-3e12441cf2d8",
              "name": "Human Resource Planning",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1neX_MjSvHgQFrTnEW7Y-Kp4nZyMbQESw"
            },
            {
              "id": "be26b86e-fbd0-4691-954f-d3c846eea61b",
              "name": "Recruitment",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1qd2S21RyUHMVxcOqUpIqaHqioOSEK0sG"
            },
            {
              "id": "a142f9c6-cfd2-432e-bff8-75810a6e656c",
              "name": "Training And Development",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1sAAcl6wbTkRciBTOlSYG46cU-sGufGFp"
            },
            {
              "id": "aef42e91-c814-4c5c-b13a-8486bde3977f",
              "name": "Selection",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1bxNLapaB4_qs55p0RwhxTKJ-LXlbf1E4"
            },
            {
              "id": "1cd3b3d5-ce21-49f5-b178-64d94e5b7b74",
              "name": "Wage and Salary Administration",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1wcrel2O0V6KDQICvcEhY7JCbhjq7Teys"
            },
            {
              "id": "4220635f-ce89-42bf-8dfd-07b75f4455c7",
              "name": "Collective Bargaining",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1jokDes3ahZigOGtzaM5UBEyb-43eap3D"
            },
            {
              "id": "cd908ec4-60e8-4820-9db0-ceef5458ef98",
              "name": "Employee Discipline",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1Uj6eMspwrUDioA_KFS33V_UV0zeYhvCb"
            },
            {
              "id": "6cab1b94-d6a6-4cd0-8f5d-9bfc11a205ee",
              "name": "Industrial Disputes and WPM",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1qUAYgsifb8p2fNhN0o1uP2RUfT176f1W"
            },
            {
              "id": "5b50aee5-ae6f-474c-9f48-fed3269a3fdd",
              "name": "Industrial Relation",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1cjmBpjW3QLh7KL-k0mH6HOD_aXAcbHuC"
            },
            {
              "id": "0639bb01-ddf7-47c0-88fe-8bcc9051ee11",
              "name": "Performance Appraisal",
              "mimeType": "application/pdf",
              "isDownloadable": false,
              "status": "APPROVED",
              "Notes": "1qk9pq-Pq-v8MT3CaVzhEtLylUVK-umyO"
            }
          ]
        },
        {
          "id": "6690fd1b97969283509b09f6",
          "name": "DSD Lab",
          "SUBCODE": "00000",
          "Credit": "1",
          "folderId": "1yf6fmAP5gryMrv_pJ0v6_5fQy6YGdUNh",
          "notes": []
        },
        {
          "id": "6690fe3297969283509b09f9",
          "name": "Data Structure Lab",
          "SUBCODE": "00000",
          "Credit": "1",
          "folderId": "1OhzvShIvavfWr4puv0lvxhr4RP0I_wUr",
          "notes": []
        },
        {
          "id": "66911d4197969283509b0a23",
          "name": "OOP Java Lab",
          "SUBCODE": "00000",
          "Credit": "1",
          "folderId": "1E8VwO25gBUp-vFvbZPd7_Q01vpJQqdeO",
          "notes": []
        },
        {
          "id": "6691204d97969283509b0a27",
          "name": "CE Lab",
          "SUBCODE": "0000",
          "Credit": "1",
          "folderId": "1DJwsYptVmA5g4n7ARfEE1lJ6CntsKjF-",
          "notes": []
        },
        {
          "id": "673ed1465a965de869c436a8",
          "name": "Block Chain",
          "SUBCODE": "CS40012",
          "Credit": "0",
          "folderId": "1fNZGn78-8JaGSv1zbMm8d0Xi0PHnFDPg",
          "notes": []
        },
        {
          "id": "673ed1855a965de869c436a9",
          "name": "Wireless Mobile Communication",
          "SUBCODE": "EC30002",
          "Credit": "0",
          "folderId": "12m511GGt3-dnWXeQ31hA1WOMi73sV4fT",
          "notes": []
        },
        {
          "id": "67453d5e5a965de869c4373c",
          "name": "ARM and Advanced Microprocessors",
          "SUBCODE": "EC30007",
          "Credit": "0",
          "folderId": "1JDWTbGu34Nw9wy7S5mU5yyDJp7yEyIRQ",
          "notes": []
        },
        {
          "id": "674583e25a965de869c43745",
          "name": "Compilers",
          "SUBCODE": "CS30006",
          "Credit": "0",
          "folderId": "1aMa5Hnqhjz_Z4OBTUEALElCwOkYrYegb",
          "notes": []
        },
        {
          "id": "6745d3b123f3ccc204a6a36c",
          "name": "Artificial Intelligence Laboratory",
          "SUBCODE": "CS39002",
          "Credit": "1",
          "folderId": "13xxTCJGD62-5d4fHscmNUtX9tVN9DRHY",
          "notes": []
        },
        {
          "id": "6745d54423f3ccc204a6a36d",
          "name": "Applications Development Laboratory",
          "SUBCODE": "CS33002",
          "Credit": "2",
          "folderId": "1SiyjPZsqrFF4D8yVTY1on5ncy08ki2GX",
          "notes": []
        },
        {
          "id": "6745d72a23f3ccc204a6a36e",
          "name": "Applications Development",
          "SUBCODE": "CS33002",
          "Credit": "0",
          "folderId": "1sPOaBZXz0qxoeJtIMhFnVH0yIAjKxOvz",
          "notes": []
        },
        {
          "id": "6745d87123f3ccc204a6a36f",
          "name": "Data Analytics Laboratory",
          "SUBCODE": "CS39004",
          "Credit": "1",
          "folderId": "1Y5o9fWI2a3xEZrmSW7crW5HsFCsLchGx",
          "notes": []
        },
        {
          "id": "6745d8bd23f3ccc204a6a370",
          "name": "Advance Programming Laboratory",
          "SUBCODE": "CS39006",
          "Credit": "2",
          "folderId": "1P3CAEVlqMRPhitB3sM-0V4Ag_-Kwv9Jg",
          "notes": []
        },
        {
          "id": "6745d96023f3ccc204a6a371",
          "name": "Wireless Communication & Networking Lab",
          "SUBCODE": "EC39002",
          "Credit": "1",
          "folderId": "1SYYzYv58p4sd3TLbDIqHKXg8O4YKu0RG",
          "notes": []
        },
        {
          "id": "6745da5123f3ccc204a6a372",
          "name": "ARM Laboratory",
          "SUBCODE": "EC39006",
          "Credit": "1",
          "folderId": "1-HZAMRrV2L_67WzPHy422tHfj9I6fHS0",
          "notes": []
        },
        {
          "id": "6747326d72375d8fe311386b",
          "name": "Advance Programming",
          "SUBCODE": "00000",
          "Credit": "0",
          "folderId": "1ndVcmCpI53M4f4NNA6N94htdRwKnTEVX",
          "notes": []
        },
        {
          "id": "674b3cede7f74b6f4151bacd",
          "name": "OS Lab",
          "SUBCODE": "CS29004",
          "Credit": "1",
          "folderId": "1tGeOvgcb22OYjp7dyaLPhR-UOPOg3nF9",
          "notes": []
        },
        {
          "id": "674b405ae7f74b6f4151bad3",
          "name": "DBMS Lab",
          "SUBCODE": "CS29006",
          "Credit": "1",
          "folderId": "1OAE_3QKId0mTeoTuOS2kcf5pzpR4m_s4",
          "notes": []
        },
        {
          "id": "674bcf99efb88dc42ecd189c",
          "name": "Information Theory and Coding",
          "SUBCODE": "CS20008",
          "Credit": "3",
          "folderId": "1b9chh_Nah-ACGoUr-wB_Yb3M4D25c2nv",
          "notes": []
        },
        {
          "id": "674bd16aefb88dc42ecd189d",
          "name": "Principle of Signals & Systems",
          "SUBCODE": "EC20006",
          "Credit": "4",
          "folderId": "1xAbkstSs6cPvEDlP9A9w_tmwi_rTl8-b",
          "notes": []
        },
        {
          "id": "674bd95a6a4e34484edd9904",
          "name": "Organisational Behaviour",
          "SUBCODE": "HS20220",
          "Credit": "3",
          "folderId": "1179Vt9FbCKJ1wjjqp2YaIWzRuJYbyvhP",
          "notes": []
        },
        {
          "id": "6758f9f91e8ec0a1763b30b5",
          "name": "Engineering Mechanics",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1EKZfPVSc-ztNcf-LE7ntOzJo0my9fNAB",
          "notes": []
        },
        {
          "id": "6758fa411e8ec0a1763b30b6",
          "name": "Creativity and Entrepreneurship",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "13ubUPWSxTEyfsleeDaHhGkFkuOEwEf4f",
          "notes": []
        },
        {
          "id": "6758fa911e8ec0a1763b30b7",
          "name": "Essentials of Management",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1rLLDd0lMVySkPjg4gHEkRPR1yp_bfrzB",
          "notes": []
        },
        {
          "id": "6758faac1e8ec0a1763b30b8",
          "name": "Society Science and Technology",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1sWvxyoELmBvv6T16H2IZ1NtzAyh0ptAp",
          "notes": []
        },
        {
          "id": "6758faca1e8ec0a1763b30b9",
          "name": "Elements of Machine Learning",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1Undk1fr1QXuOw8K7YZ2ZHeMFTnjQIfdm",
          "notes": []
        },
        {
          "id": "6758fb151e8ec0a1763b30ba",
          "name": "Biomedical Engineering",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1EVJq4QwiGRRjyU5lIFhZKroFeT10Tjjv",
          "notes": []
        },
        {
          "id": "6758fb3c1e8ec0a1763b30bb",
          "name": "Basic Mechanical Engineering",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1YFaofMo9sm_bNL7Tp7DbIRTdm4DIeCj6",
          "notes": []
        },
        {
          "id": "6758fb641e8ec0a1763b30bc",
          "name": "Basic Civil Engineering",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1u_yPs1Et0dflzopx8S5uOHbnW_86CvFR",
          "notes": []
        },
        {
          "id": "6758fb881e8ec0a1763b30bd",
          "name": "Smart Materials",
          "SUBCODE": "0000",
          "Credit": "0",
          "folderId": "1LZMMctF8Xvv0l0p8xqcxLtwjP8d_QnL5",
          "notes": []
        },
        {
          "id": "67d451588db82be398f21ffe",
          "name": "Science of Public Health",
          "SUBCODE": "00000",
          "Credit": "2",
          "folderId": "1K0A_lBsnZxW6FyG8Ss_vzdaEMqIvdlKF",
          "notes": []
        },
        {
          "id": "67d452b18db82be398f21fff",
          "name": "Molecular Diagnostics",
          "SUBCODE": "LS10003",
          "Credit": "0",
          "folderId": "11zO3dUz89LGMVCLBgzIsFxK0gC1P5KQr",
          "notes": []
        },
        {
          "id": "67d455e88db82be398f22000",
          "name": "Optimization Technique",
          "SUBCODE": "00000",
          "Credit": "3",
          "folderId": "1obll-fFXqwzr4nwJicJnCVzhmgqIbKGx",
          "notes": []
        },
        {
          "id": "67d50cc08db82be398f22004",
          "name": "UHV",
          "SUBCODE": "HS30401",
          "Credit": "0",
          "folderId": "1Zg3w4ebi4_JNXmgReGcOnKFYrlCcQLO9",
          "notes": []
        }
      ]

      const pyqsAndSol = [];

      for (const subject of allSubjects) {
        const pyqs = subject.notes;
        if (pyqs.length === 0) {
          continue;
        }

        for (const pyq of pyqs) {
          if (pyq.status === "APPROVED") {
            continue;
          } else if (pyq.status === "VERIFIED") {
            pyqsAndSol.push({
              subject: subject.name,
              pyqsName: pyq.name,
              notes: pyq.Notes,
              status: pyq.status
            });
          }
        }
      }

      return pyqsAndSol;
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }



  async updateStatusVerifiedToApproved() {

    const subjects  =[
      {
        "id": "65d212841bdc9aab413387ec",
        "name": "PHYSICS",
        "SUBCODE": "PH10001",
        "Credit": "3",
        "folderId": "1NBj0CZ5uc-ThiSApU58PpX9xKR_vhrv0",
        "notes": [
          {
            "id": "72ac6b26-f6fb-4e42-a063-a730a9d0f838",
            "name": "Physics Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "18a8dpDOXzrcFfxD1cVT1c676_r6_2hRD"
          }
        ]
      },
      {
        "id": "65d213b11bdc9aab413387f7",
        "name": "ENGLISH",
        "SUBCODE": "HS10001",
        "Credit": "2",
        "folderId": "160pnTWAGgB2IOPSTl_17I4ofjY257obo",
        "notes": [
          {
            "id": "e8833391-a8a0-4a34-9b21-8e92968688d8",
            "name": "Professional Communication Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1GIX1PCOvwOrjUk_klO1lTH4Qpngg3qri"
          }
        ]
      },
      {
        "id": "65d213b11bdc9aab413387f8",
        "name": "BASIC ELECTRICAL ENGINEERING",
        "SUBCODE": "EC10001",
        "Credit": "2",
        "folderId": "1CMCRpagYf-Nrow_izVQAjfENbiDVoS0p",
        "notes": [
          {
            "id": "6d5c0ad0-81c3-43ba-b77f-0fb035c16da4",
            "name": "Basic Electrical Engineering Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "11QUu-7Fe9MSZ9pkNzPMiJ4k4lKE8TEv2"
          },
          {
            "id": "094f7696-26f5-4013-9eaf-9269ff7e195c",
            "name": "Basic Electrical Engineering Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1Jc77vOG499halTgKYyLd8rKJF_fTnhWN"
          }
        ]
      },
      {
        "id": "65d213b11bdc9aab413387f5",
        "name": "CHEMISTRY",
        "SUBCODE": "CH10001",
        "Credit": "3",
        "folderId": "169Oi8YbSco-OJmkZE6LKnnty62IekBOM",
        "notes": [
          {
            "id": "290ce12a-82e3-43ff-9af4-8d29176d6f8b",
            "name": "Chemistry Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1sEWNjIB-QfzQUTBH_p8nH39ZzeSbRh3_"
          }
        ]
      },
      {
        "id": "65d214db1bdc9aab413387ff",
        "name": "Data Structure",
        "SUBCODE": "CS2001",
        "Credit": "4",
        "folderId": "1wylGvLGZXWnApRkc2noJUostT8FuGE6K",
        "notes": [
          {
            "id": "9e057cec-280d-4b0f-b8be-215a24b7ddc9",
            "name": "Data Structures and Algorithms Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1CSuJbYzUFCPGn97wx00UsLcfjLT-DFqD"
          }
        ]
      },
      {
        "id": "65d214db1bdc9aab41338800",
        "name": "Digital Systems Design",
        "SUBCODE": "EC20005",
        "Credit": "3",
        "folderId": "1PMBLip9V7jVPNy_MpOhgNtHEPwIC_tsu",
        "notes": [
          {
            "id": "1d96c7af-84be-44fe-bab3-d966c93a627c",
            "name": "Digital Electronics Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "11SKJCmALy3LnJy-3O87OWGBY92eBaycO"
          }
        ]
      },
      {
        "id": "65d214db1bdc9aab41338804",
        "name": "Automata Theory and Formal Languages",
        "SUBCODE": "CS21003",
        "Credit": "4",
        "folderId": "1P-30fTnkY033P2rTaOZmq1p-EUg7ahom",
        "notes": [
          {
            "id": "af3c6931-75ed-4193-b43e-9bc510429aad",
            "name": "Automata and Formal Languages Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1RKp36drtFuL3QR_qXmr8GaDSV9wl_VK1"
          },
          {
            "id": "25670093-e4df-491f-af22-251e4c1491dd",
            "name": "Automata and Formal Languages Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1DjyAzje76qyk3SvpW8AQY82_XXN18Ufw"
          }
        ]
      },
      {
        "id": "65d214db1bdc9aab41338805",
        "name": "Probability and Statistics",
        "SUBCODE": "MA2011",
        "Credit": "4",
        "folderId": "1h2GkDhwd5NHhEo7TjUccF9KQu3bFIwCg",
        "notes": [
          {
            "id": "7718f08d-5db2-4542-bd6a-0d8e785d1ae0",
            "name": "Probability and Statistics Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1LyfhRaCwiqBDc4sNTMqPKwDrwbPb587L"
          }
        ]
      },
      {
        "id": "65d2211d1bdc9aab41338806",
        "name": "COMPUTER NETWORKS",
        "SUBCODE": "IT3009",
        "Credit": "3",
        "folderId": "1XJcx1-Ly2drudYy0vqr_cK20dJVJYpzX",
        "notes": [
          {
            "id": "61beea9b-9ba7-446f-9ae4-78c73f985e5c",
            "name": "Computer Networking Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1mV35BInPeTCc7lgkinEmo6U7xiLOF3iT"
          },
          {
            "id": "841730ca-e51a-409e-b1f6-51a2af22a5d9",
            "name": "Computer Networking Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1OUtfP9Vzk9yKzV0oRQ8lGXqqBabBUF7F"
          },
          {
            "id": "87a40ac0-28d5-43c1-8074-ca9f882edc50",
            "name": "Computer Networking Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1NrA0XfilVe0FMI2RtgYxOThNd1QDQS25"
          }
        ]
      },
      {
        "id": "65d2211d1bdc9aab41338809",
        "name": "SOFTWARE ENGINEERING",
        "SUBCODE": "IT3003",
        "Credit": "4",
        "folderId": "1LjbtjshmDlZVSN9scqnoMiXlNnTl9FB1",
        "notes": [
          {
            "id": "3698fdb4-b097-44ea-a7ac-98de484527c6",
            "name": "Software Engineering Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "13UmUJ_Q5nDFm6Rg_MKjny8l3xRPai1eR"
          },
          {
            "id": "6ce927e2-51a9-43dd-8b5c-135eec42bd78",
            "name": "Software Engineering Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1whAGsOsTKv2RrkK5Hnghn3yv2P24AG-2"
          },
          {
            "id": "53851eea-16f3-4786-ad6f-bd08c0665e0f",
            "name": "Software Engineering Notes 3",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1gkh5kG5EA2o3VikO-mnu--6m1UxHoFbP"
          },
          {
            "id": "ebbe2428-e21a-4c4a-9201-0fbb69ddc0b0",
            "name": "Software Engineering Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1UUdEE38HdWssrveZtD6HPC-6uQG35bVM"
          }
        ]
      },
      {
        "id": "65d2211d1bdc9aab41338808",
        "name": "HIGH PERFORMANCE COMPUT",
        "SUBCODE": "CS3010",
        "Credit": "4",
        "folderId": "1PGH1kRoS1BYOZbd3dIi8tzSjH7ruA3js",
        "notes": [
          {
            "id": "de8c6a97-2572-4c76-9d1d-9429274fb45e",
            "name": "High Performance Computing Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1mRzLyJhc0qs2R2zMUCBpIwoOrCj6Es0D"
          },
          {
            "id": "9c8b46f7-0082-4628-9667-3c0e4c338283",
            "name": "High Performance Computing Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1jsNxyJOcD0qJ9GscpObjeSyzTI7dyRdZ"
          },
          {
            "id": "b64b0eab-cd11-4c5b-bae9-1dcc1f32833b",
            "name": "High Performance Computing Notes 3",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1Uka9QKaJCm3q3pLf51axGp_6HYS6H0GL"
          },
          {
            "id": "2deb851a-e9b7-44e1-a3e0-a1348a7807c7",
            "name": "High Performance Computing Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1mLDaR5kO-fFW0osntdD0LN7HQU5QFNmR"
          }
        ]
      },
      {
        "id": "65d2211d1bdc9aab41338807",
        "name": "DESIGN & ANALYSIS OF ALGO",
        "SUBCODE": "CS2012",
        "Credit": "3",
        "folderId": "1jPMKCPq5VvpdisqvnlRDw7ORQ4sVBccV",
        "notes": [
          {
            "id": "971a298e-2957-4fdc-b840-70a7a0944c1c",
            "name": "Design and Analysis of Algorithms Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1bCcP6-rTOEQPjNyCvPHJtu9kRHqC2Qmc"
          }
        ]
      },
      {
        "id": "65d221b01bdc9aab4133880c",
        "name": "COMPILER DESIGN",
        "SUBCODE": "CS3008",
        "Credit": "3",
        "folderId": "1XWuvoNDWq-n6W0azKIAcRNSUcPiL-jjV",
        "notes": [
          {
            "id": "b7b1214f-f8e4-4a95-9d4a-6d3b86998240",
            "name": "Compiler Design Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1eT68cNj8E5DDtgFnkpn8zJh4kL9jCu07"
          },
          {
            "id": "111d034f-89b4-49a2-b9a7-b51c5383e772",
            "name": "Compiler Design Notes 3",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1Q8rkt8d1qCQcUCPjrMCNvxA9Yav_4NPK"
          }
        ]
      },
      {
        "id": "65d221b01bdc9aab4133880d",
        "name": "CLOUD COMPUTING",
        "SUBCODE": "IT3022",
        "Credit": "3",
        "folderId": "1YDWvKY3RVtDZG_Cs8_bBNf8FxEbeQK7b",
        "notes": [
          {
            "id": "670466d3-123c-4a50-a951-ddb48b8dc13e",
            "name": "Cloud Computing Slides 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1499C_ohwSo2EjkAZ995tR3ngx0PzgQcM"
          },
          {
            "id": "949582c0-a0d9-465c-a315-be9eb810e00e",
            "name": "Cloud Computing Slides 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1mNnwxIEtomae3B9npCfcsgzZqB0hKXOg"
          }
        ]
      },
      {
        "id": "65d221b01bdc9aab4133880e",
        "name": "Software Project Management",
        "SUBCODE": null,
        "Credit": "3",
        "folderId": "1WB2RqjXJJtMDRlaiVORwUMefP7af0bs_",
        "notes": [
          {
            "id": "0f1be501-c5e9-47b3-808d-9fcff26bda6e",
            "name": "Software Project Management Slides 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1hKybD43QyA8f0fcP5uZL5CCBS7H0NQ_e"
          },
          {
            "id": "3f381753-25e4-474c-a049-7182ad50eea9",
            "name": "Software Project Management Slides 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "PHCCN5ZilJpmPyeNSnqz4S_h1lzk"
          }
        ]
      },
      {
        "id": "65d222721bdc9aab41338810",
        "name": "Data Analytics",
        "SUBCODE": null,
        "Credit": "3",
        "folderId": "1aa7g6m9e7IHOS98ZA9T4S1z1mJ0eW_Pf",
        "notes": [
          {
            "id": "b516b62f-b539-4eaa-812e-822db020f3d4",
            "name": "Data Analytics Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1t8w5ctejs7vLPWx_vIgd62tXTChumwnv"
          }
        ]
      },
      {
        "id": "65d222721bdc9aab41338812",
        "name": "Internet Of Things",
        "SUBCODE": null,
        "Credit": "3",
        "folderId": "1tXWyqCsnf4whXjOVbvWfvB-ERkWecKCI",
        "notes": [
          {
            "id": "04fb600b-686a-4960-bdb3-b29b6e14f2cf",
            "name": "Internet of Things Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1Kxz6cYa-2HtIB_zRcUJhh_R6p_wQB0ql"
          }
        ]
      },
      {
        "id": "65d222721bdc9aab4133880f",
        "name": "Machine Learning",
        "SUBCODE": null,
        "Credit": "3",
        "folderId": "1gB0JzDFuYETCKwZ7A-xhAgXvTbaiFYVf",
        "notes": [
          {
            "id": "f5736aa0-6b2e-4837-affc-5e8eeddb3328",
            "name": "Machine Learning Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1s_VsLu26okx8eni4q92H3fmdbw2PI2J7"
          }
        ]
      },
      {
        "id": "65d222721bdc9aab41338811",
        "name": "Natural Language Prcessing",
        "SUBCODE": null,
        "Credit": "3",
        "folderId": "1sqfTf3qrO56n2y3jEcJEB7KOVAPjBEAA",
        "notes": [
          {
            "id": "78c2a07c-689b-489c-ad8b-73f2ac2ab910",
            "name": "Natural Language Processing Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "17XChTTDCRPTGfpMxXKW8Z10aWe69E4eK"
          },
          {
            "id": "2a6c372d-725a-49dc-875e-91079cc30ff0",
            "name": "Natural Language Processing Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1tyx9TbFm4W8XsEzIr7tFgLXCTAqRxi_G"
          }
        ]
      },
      {
        "id": "65d243b8567cea6553c6b51a",
        "name": "OS",
        "SUBCODE": "CS2002",
        "Credit": "3",
        "folderId": "1TbLCaB8-2PSReL8IZ-CXdnkrivRkmr5d",
        "notes": [
          {
            "id": "4c373165-0a87-42c0-80ae-3294b7254477",
            "name": "Operating Systems Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1Y8BDCOPkXr0juSZeIPdyk_HY4v8KRV7u"
          },
          {
            "id": "0198db2f-ec93-48aa-a6a8-edb1940a9a45",
            "name": "Operating Systems Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1AKkP2vKYQIP10Zj_2s0snm5ajPuDiD6F"
          },
          {
            "id": "dd7bf3a6-63b3-407f-88c3-5c7fc816f952",
            "name": "Operating Systems Notes 3",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1CAdWuSsbOtD2Bm6knqxgm5Rc59_03BdA"
          },
          {
            "id": "84adfcfb-4bc7-4cb7-8a97-a4151a5ed252",
            "name": "Operating Systems Notes 4",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1eby2juAqJo6LwUCmdhKccFgbLpjtbqvh"
          },
          {
            "id": "678b6b10-6fd6-4355-abe2-70a0074a89c2",
            "name": "Operating Systems Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1CjYoGvxgtkuh9VzQrkDkAZe1hKmfl2AT"
          }
        ]
      },
      {
        "id": "65d243b8567cea6553c6b51c",
        "name": "COA",
        "SUBCODE": "CS21002",
        "Credit": "4",
        "folderId": "1k8RbQS6fc_w9khO6goAEe95alrb_awN6",
        "notes": [
          {
            "id": "76a77fec-5d11-4098-a366-755ad383dfad",
            "name": "Computer Architecture Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1atSgjhNkc-LKJc5JcJ8ETVt12N-N8vVb"
          },
          {
            "id": "caf06ef2-f033-4254-8a60-b30d42038539",
            "name": "Computer Architecture Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1RCMBRH-WXFuhBSMVjdQVlsXpud8q69bl"
          }
        ]
      },
      {
        "id": "65d243b8567cea6553c6b519",
        "name": "OOP JAVA",
        "SUBCODE": "CS20004",
        "Credit": "3",
        "folderId": "19WSxWiqmXvSCIQNuTEAycnhhHX1I3nQm",
        "notes": [
          {
            "id": "b63af291-f27e-442a-a3c9-b4e82db8feb8",
            "name": "HTML Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1k60Q1C8cmPdIkZlDoeCD938HhrnfftI4"
          },
          {
            "id": "5ed67ce3-7077-433c-a22e-6ca5f68c716e",
            "name": "Java Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1rE1bYaHoHne1TBsrWe2hvndzUM7DGZ26"
          },
          {
            "id": "495eef96-3584-4d64-a661-caa51bc44973",
            "name": "JDBC Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1-7lyG5Ocu-gD_TWUVZCVWOFtbIZ27ZkN"
          }
        ]
      },
      {
        "id": "65d243b8567cea6553c6b51b",
        "name": "Discrete Structures",
        "SUBCODE": "MA21002",
        "Credit": "4",
        "folderId": "1GVMm-AtPcO7GtRBEZ-a18fOvqRuHCbkw",
        "notes": [
          {
            "id": "db92b507-1dad-4b8b-8c92-ee0c16faa182",
            "name": "Discrete Mathematics",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1O87KW9j3Q5z0oGa58qFxJHOrWcwXiKbA"
          }
        ]
      },
      {
        "id": "65d243b8567cea6553c6b51d",
        "name": "DBMS",
        "SUBCODE": "CS20006",
        "Credit": "3",
        "folderId": "1KZx4AV-MF0m6qnvwIAyZxDoG7gnTCe9W",
        "notes": [
          {
            "id": "b490fbc4-8623-4b24-b734-325d80799ec0",
            "name": "Database Management Systems Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1R7vr8xkDTtAFvuVCnGaUQOuGeBRnDP4k"
          },
          {
            "id": "98e381ab-e600-4a1f-8cc1-afbd759e7a08",
            "name": "Database Management Systems Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1Mo3xmInesdt7St3p7mTEZklKrJgorLA2"
          },
          {
            "id": "9758e173-07cb-4c91-b557-3a856d2a5c84",
            "name": "Database Management Systems Notes 3",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1EkztrPY58PrZm5RDv7BLG35zCUNJ3feW"
          },
          {
            "id": "a70d9c01-4ce4-4fee-9203-e4d8fa596eff",
            "name": "Database Management Systems Notes 4",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "13kg3ySn099SYYo73xsGoW9DO8eO490n9"
          },
          {
            "id": "f75e9038-358c-47fb-961b-f5e4bf033091",
            "name": "Database Management Systems Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1lPhp1pKBvNg5oLu4OwQ_5YOQsENtycfU"
          },
          {
            "id": "96b031ec-3d0e-4b9e-9dbd-b0fee7e38030",
            "name": "SQL and PL/SQL Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1d0xiz6DFbXo-_dNtuiSFoRVOKXIc7_gq"
          }
        ]
      },
      {
        "id": "65d2d560883f3cc806388704",
        "name": "Mobile Computing",
        "SUBCODE": null,
        "Credit": null,
        "folderId": "1ZjCacSY5rPV65uI0bs61VwqOKeKjfXcj",
        "notes": [
          {
            "id": "536cb451-0bc2-4e0e-8f72-fe07dd2cb12b",
            "name": "Mobile Computing Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1_rfffbrniyRD2enKG_uUC2TeHjoIqYsJ"
          }
        ]
      },
      {
        "id": "65d2d560883f3cc80638870c",
        "name": "Cryptography",
        "SUBCODE": null,
        "Credit": null,
        "folderId": "1BNytYhnQL7tzP3GsW4PGbL-nIaLGs8To",
        "notes": [
          {
            "id": "636b9348-5a11-4559-818a-f53fcd091036",
            "name": "Cryptography Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1sC-9di4OWRYyK5mOugczbviO9Cr3m4eY"
          }
        ]
      },
      {
        "id": "65d2d560883f3cc80638870a",
        "name": "Computational Intelligence",
        "SUBCODE": null,
        "Credit": null,
        "folderId": "1Rxofy0k6CWIMtI66E9bca_IhIWURwsGd",
        "notes": [
          {
            "id": "1e6f5cfd-14ff-42cb-a54b-e0fd0859a60a",
            "name": "Computational Intelligence Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1wfjLi9JwDRVWMlCNUf2SidHwBTjTNyM3"
          }
        ]
      },
      {
        "id": "65d2d560883f3cc806388709",
        "name": "Artificial Intelligence",
        "SUBCODE": null,
        "Credit": null,
        "folderId": "1N4NfPNlHGIiNtuoMoI8BKhJjf8ftHzaA",
        "notes": [
          {
            "id": "c7f7c854-6f93-4912-95a4-9aea990eb6cf",
            "name": "Artificial Intelligence Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1eX9aXjDFbb72MXhjIImT1xw7SipWIOqf"
          },
          {
            "id": "63d42bd9-6281-4af0-8253-f9ed21a3432b",
            "name": "Artificial Intelligence Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1pO8wd16Rdb8SbucCNhx0Ow-mlTCTBMOJ"
          }
        ]
      },
      {
        "id": "65d2d560883f3cc80638870b",
        "name": "Big Data",
        "SUBCODE": null,
        "Credit": null,
        "folderId": "1lKozSt66GymMKwb_rBNYjq7BkvfZUalm",
        "notes": [
          {
            "id": "6c0c27ff-e399-400e-8605-ce644fec7597",
            "name": "Big Data Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1SRFphHNbmsr9cLEPQvQGlqqTidE0JJhq"
          }
        ]
      },
      {
        "id": "65d2d560883f3cc80638870f",
        "name": "Data Mining and Data Warehousing",
        "SUBCODE": null,
        "Credit": null,
        "folderId": "1nOYMihlN8Er2_13Xd0FQdmdwH889lCuu",
        "notes": [
          {
            "id": "b8f1133e-f24b-4b1e-b47c-40c8be271f67",
            "name": "Data Mining and Data Warehousing Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1uc9-41er0rchsJtzRpL-3pLiQqnYzXt_"
          }
        ]
      }
    ]

    try {
      for (const subjectToUpdate of subjects) {
        // Fetch the subject from the database
        const subject = await this.prismaService.subject.findUnique({
          where: { id: subjectToUpdate.id }
        });
  
        if (!subject) {
          console.log(`Subject with ID ${subjectToUpdate.id} not found.`);
          continue;
        }
  
        // Update only the notes that match the provided list
        const updatedNotes = subject.notes.map(note => {
          // Check if the note exists in the provided list of notes to update
          const noteToUpdate = subjectToUpdate.notes.find(n => n.id === note.id);
          if (noteToUpdate && note.status === "VERIFIED") {
            return { ...note, status: "APPROVED",Notes:noteToUpdate.Notes }; // Update status to APPROVED
          }
          return note; // Leave unchanged if not in the list or already updated
        });
  
        // Check if any changes were made to the notes
        const hasUpdates = updatedNotes.some((note, index) => note.status !== subject.notes[index].status);
  
        if (hasUpdates) {
          // Update the subject with the modified notes array
          await this.prismaService.subject.update({
            where: { id: subject.id },
            data: { notes: updatedNotes }
          });
          console.log(`Subject with ID ${subject.id} updated successfully.`);
        } else {
          console.log(`No updates needed for Subject with ID ${subject.id}.`);
        }
      }
    } catch (error) {
      console.error("Error updating subjects:", error);
    }


  }


  async listDriveFilesByFolderId() {
    return await this.driveService.listFiles();
  }

}
