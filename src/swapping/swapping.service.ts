import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
  } from "@nestjs/common";
import { CustomException } from "src/customException";
//   import { CustomException } from "src/CustomException";
  import { MyMailService } from "src/mail.service";
  import { PrismaService } from "src/prisma.service";
  
  @Injectable()
  export class SwappingService {
    constructor(
      private readonly prisma: PrismaService,
      private readonly mailService: MyMailService
    ) {}
  
    async getAllSwapping(dto: {
      branch: string;
      semester: number;
      userId: string;
    }) {
      console.log(dto);
      try {
        const getMyInfo = await this.prisma.swapping.findUnique({
          where: {
            userId: dto.userId,
          },
          include: {
            remoteUser: {
              select: {
                id: true,
                name: true,
                userId: true,
                editLeft: true,
              },
            },
          },
        });
  
        const swappingInfo = await this.prisma.swapping.findMany({
          where: {
            branch: dto.branch,
            Semester: Number(dto.semester),
          },
          include: {
            remoteUser: {
              select: {
                id: true,
                name: true,
                userId: true,
              },
            },
          },
        });
  
        const findSemesterId = await this.prisma.branch.findUnique({
          where: {
            name: dto.branch,
          },
        });
  
        const findSemetserDetails = await this.prisma.semester.findUnique({
          where: {
            branchId: findSemesterId.id,
            number: Number(dto.semester),
          },
          select: {
            numberOfSectionForSwapping: true,
            isSwappingEnabled: true,
          },
        });
  
        console.log(swappingInfo, getMyInfo);
        return {
          getMyInfo,
          swappingInfo,
          semesterDetails: findSemetserDetails,
        };
      } catch (error) {
        console.log(error);
        throw new InternalServerErrorException(
          "Error occured while fetching swapping data"
        );
      }
    }
  
    async createUserProfile(dto: {
      name: string;
      branch: string;
      Semester: number;
      alloted: number;
      lookingFor: number[];
      contact: string;
      userId: string;
    }) {
      try {
        const user = await this.prisma.swapping.findUnique({
          where: {
            userId: dto.userId,
          },
        });
  
        console.log(user);
        if (user) throw new ConflictException("User Already Exist");
  
        const createUser = await this.prisma.swapping.create({
          data: {
            alloted: dto.alloted,
            branch: dto.branch,
            contact: dto.contact,
            userId: dto.userId,
            name: dto.name,
            Semester: dto.Semester,
            lookingFor: dto.lookingFor,
          },
        });
  
        console.log(createUser);
  
        return createUser;
      } catch (error) {
        if (error instanceof ConflictException) {
          throw error;
        }
        console.log(error);
        throw new InternalServerErrorException("Internal Server Error");
      }
    }
  
    async acceptSwap(dto: { currentUserId: string; remoteUserId: string }) {
      try {

        const isCurrentUserExist = await this.prisma.user.findUnique({
          where:{
            id:dto.currentUserId
          },
          select:{
            id:true,
            email:true,
          }
        })

        if(!isCurrentUserExist) throw new NotFoundException("User not found")

        const isRemoteUserExist = await this.prisma.user.findUnique({
          where:{
            id:dto.remoteUserId
          },
          select:{
            id:true,
            email:true,
          }
        })

        if(!isRemoteUserExist) throw new NotFoundException("User not found")

        const currentUser = await this.prisma.swapping.findUnique({
          where: {
            userId: dto.currentUserId,
          },
        });
  
        const remoteUser = await this.prisma.swapping.findUnique({
          where: {
            userId: dto.remoteUserId,
          },
        });
  
        if (!currentUser || !remoteUser) {
          throw new ConflictException("User not found");
        }
  
        if (currentUser.remoteUserId)
          throw new ConflictException("You have already accepted a swap");
        if (remoteUser.remoteUserId)
          throw new ConflictException("User is not available for swap");
        const update = await this.prisma.$transaction([
          this.prisma.swapping.update({
            where: {
              id: currentUser.id,
            },
            data: {
              remoteUserId: remoteUser.id,
            },
          }),
          this.prisma.swapping.update({
            where: {
              id: remoteUser.id,
            },
            data: {
              remoteUserId: currentUser.id,
            },
          }),
        ]);
  
        if (!update)
          throw new InternalServerErrorException("Error occured while updating");
  
          // console.log(remoteUser.name,remoteUser.email,remoteUser.contact,currentUser.name,currentUser.alloted,currentUser.lookingFor,remoteUser.alloted,remoteUser.lookingFor)
  
        await this.mailService.sendMailToSwapFound(
          remoteUser.name,
          isRemoteUserExist.email,
          remoteUser.contact,
          currentUser.name,
          currentUser.alloted,
          currentUser.lookingFor,
          remoteUser.alloted,
          remoteUser.lookingFor
        );
  
        await this.mailService.sendMailToSwapFound(
          currentUser.name,
          isCurrentUserExist.email,
          currentUser.contact,
          remoteUser.name,
          remoteUser.alloted,
          remoteUser.lookingFor,
          currentUser.alloted,
          currentUser.lookingFor
        );
  
        return update;
      } catch (error) {
        if (error instanceof ConflictException) {
          throw error;
        }
        console.log(error);
        throw new InternalServerErrorException("Internal Server Error");
      }
    }
  
    async updateSwapDetails(dto: {
      userId: string;
      alloted: number;
      lookingFor: number[];
    }) {
      try {
        const user = await this.prisma.swapping.findUnique({
          where: {
            userId: dto.userId,
          },
        });
  
        if (!user) throw new ConflictException("User not found");
  
        if (user.editLeft === 0)
          throw new CustomException("Your Edit limit has been exceed", 429);
  
        const update = await this.prisma.swapping.update({
          where: {
            id: user.id,
          },
          data: {
            alloted: dto.alloted,
            lookingFor: dto.lookingFor,
            editLeft: {
              decrement: 1,
            },
          },
        });
  
        if (!update)
          throw new InternalServerErrorException("Error occured while updating");
        return update;
      } catch (error) {
        if (error instanceof ConflictException) {
          throw error;
        }
        console.log(error);
        throw new InternalServerErrorException("Internal Server Error");
      }
    }
  
    async getOnlyBrances() {
      try {
        const branches = await this.prisma.branch.findMany({
          select: {
            id: true,
            name: true,
          },
        });
  
        return branches;
      } catch (error) {
        console.log(error);
        throw new InternalServerErrorException("Internal Server Error");
      }
    }
  
    async getSemestersByBranchId(branch: string) {
      try {
        const getBranchId = await this.prisma.branch.findUnique({
          where: {
            name: branch,
          },
        });
        if (!getBranchId) throw new NotFoundException("Branch Not Found");
        const semesters = await this.prisma.semester.findMany({
          where: {
            branchId: getBranchId.id,
          },
          select: {
            id: true,
            number: true,
            isSwappingEnabled: true,
            numberOfSectionForSwapping: true,
            isFacultyReviewEnabled: true,
          },
        });
  
        return semesters;
      } catch (error) {
        console.log(error);
        throw new InternalServerErrorException("Internal Server Error");
      }
    }
  
    async updateSemester() {
      try {
        const getAllSemesters = await this.prisma.semester.updateMany({
          data: {
            isSwappingEnabled: false,
            numberOfSectionForSwapping: 0,
          },
        });
        return getAllSemesters;
      } catch (error) {
        console.log(error);
        throw new InternalServerErrorException("Internal Server Error");
      }
    }
  
    async setSectionSwappingEnabled(sestionId: string, event: boolean) {
      try {
        const update = await this.prisma.semester.update({
          where: {
            id: sestionId,
          },
          data: {
            isSwappingEnabled: event,
          },
        });
  
        if (!update)
          throw new InternalServerErrorException("Error occured while updating");
        return update;
      } catch (error) {
        console.log(error);
        throw new InternalServerErrorException("Internal Server Error");
      }
    } 
    
    async setFacultyReviewEnabled(sestionId: string, event: boolean) {
      try {
        const update = await this.prisma.semester.update({
          where: {
            id: sestionId,
          },
          data: {
            isFacultyReviewEnabled: event,
          },
        });
  
        if (!update)
          throw new InternalServerErrorException("Error occured while updating");
        return update;
      } catch (error) {
        console.log(error);
        throw new InternalServerErrorException("Internal Server Error");
      }
    }
  
    async updateSectionNumber(sectionId: string, number: number) {
      try {
        const update = await this.prisma.semester.update({
          where: {
            id: sectionId,
          },
          data: {
            numberOfSectionForSwapping: number,
          },
        });
  
        if (!update)
          throw new InternalServerErrorException("Error occured while updating");
        return update;
      } catch (error) {
        console.log(error);
        throw new InternalServerErrorException("Internal Server Error");
      }
    }
  
    async deleteSwappingByAdmin(userId: string) {
      try {

        console.log(userId)

        const isCurrentUserExist = await this.prisma.user.findUnique({
          where:{
            id:userId
          },
          select:{
            id:true,
            email:true,
          }
        })

        if(!isCurrentUserExist) throw new NotFoundException("User not found")

       


        const user = await this.prisma.swapping.findUnique({
          where: {
            userId: userId,
          },
        });
        if (!user) throw new NotFoundException("User not found");
  
        if (user.remoteUserId) {
          const remoteUser = await this.prisma.swapping.findUnique({
            where:{
              id:user.remoteUserId
            }
          })

          console.log(user.remoteUserId);
          const isRemoteUserExist = await this.prisma.user.findUnique({
            where:{
              id:remoteUser.userId
            },
            select:{
              id:true,
              email:true,
            }
          })
  
          if(!isRemoteUserExist) throw new NotFoundException("Remote User not found")
  


          const update = await this.prisma.$transaction([
            // this.prisma.swapping.update({
            //   where:{
            //     id:user.id
            //   },
            //   data:{
            //     remoteUserId:null
            //   }
            // }),
  
            // this.prisma.swapping.update({
            //   where:{
            //     id:user.remoteUserId
            //   },
            //   data:{
            //     remoteUserId:null
            //   }
            // }),
  
            // this.prisma.swapping.delete({
            //   where:{
            //     id:user.id
            //   },
  
            // }),
            this.prisma.swapping.updateMany({
              where: {
                OR: [
                  {
                    id: user.id,
                  },
                  {
                    id: user.remoteUserId,
                  },
                ],
              },
              data: {
                remoteUserId: null,
              },
            }),
            this.prisma.swapping.deleteMany({
              where: {
                OR: [
                  {
                    id: user.id,
                  },
                  {
                    id: user.remoteUserId,
                  },
                ],
              },
            }),
          ]);
  
          if(update){
            await this.mailService.sendMailToUnmatchedUser(
              isCurrentUserExist.email,user.name
            );
            await this.mailService.sendMailToUnmatchedUser(isRemoteUserExist.email,remoteUser.name)
          }
  
          return {
            success: true,
            message: "User has been deleted successfully",
          };
        }
        const deleteData = await this.prisma.swapping.delete({
          where: {
            id: user.id,
          },
        });
  
        if (!deleteData)
          throw new InternalServerErrorException(
            "Error occured while deleting user"
          );
  
          await this.mailService.sendMailToRemoveProfileByUser(
            isCurrentUserExist.email,
            user.name
          )
        return {
          success: true,
          message: "User has been deleted successfully",
        };
      } catch (error) {
        console.log(error);
        throw new InternalServerErrorException("Internal Server Error");
      }
    }
  
    async deleteSwapByUser(userId: string) {
      try {



        const isCurrentUserExist = await this.prisma.user.findUnique({
          where:{
            id:userId
          },
          select:{
            id:true,
            email:true,
            
          }
        })

        if(!isCurrentUserExist) throw new NotFoundException("User not found")



        const user = await this.prisma.swapping.findUnique({
          where: {
            userId: isCurrentUserExist.id,
          },
        });
  
        if (!user) throw new NotFoundException("User not found");
        if (user.remoteUserId)
          throw new BadRequestException("You have already accepted a swap");
  
        const deleteData = await this.prisma.swapping.delete({
          where: {
            id: user.id,
          },
        });
  
        if (!deleteData)
          throw new InternalServerErrorException(
            "Error occured while deleting user"
          );
  
          await this.mailService.sendMailToRemoveProfileByUser(isCurrentUserExist.email,user.name);
        return {
          success: true,
          message: "User has been deleted successfully",
        };
      } catch (error) {
        console.log(error);
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new InternalServerErrorException("Internal Server Error");
      }
    }
  
    async sendTestMail(){
      try {
        
        await this.mailService.sendMailToSwapFound(
          "Test",
          "dranjitkumar16@gmail.com",
          "1234567890",
          "Test",
          1,
          [1],
          1,
          [1]
        );
      } catch (error) {
        
      }
    }
  }
  