import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { AddNotesDTO, SolutionDto } from './notes.dto';
import { Readable } from 'stream';

import * as fs from 'fs';
import { DriveService } from 'src/drive.service';

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
          //   SUBCODE:true,
          //   Credit:true
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error!');
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

      return updateSubject;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while adding pyqs');
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
      };

      console.log(dto.type === 'pyqs', dto.type);

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

      console.log(material);

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

      if(!dto.fileId || !dto.pyqs.id || !dto.pyqs.name || !dto.pyqs.type || !dto.pyqs.year) throw new BadRequestException('Please provide valid data');

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
          user: true,
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
}
