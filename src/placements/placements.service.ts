import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class PlacementsService {
    constructor(private readonly prisma:PrismaService){}

    async createCompany(data:{
        companyName:string,
        companyLogo?:string,
        companyDesc?:string,
        companyUrl?:string,
    }){

        try {
            return await this.prisma.placements.create({
                data
            })
        } catch (error) {
            console.log(error)
            throw new InternalServerErrorException("Internal Server Error");
        }
    }


    async getCompanies(){
        try {
            return await this.prisma.placements.findMany({
                select:{
                    companyName:true,
                    companyLogo:true,
                    id:true,
                }
            });
        } catch (error) {
            console.log(error)
            throw new InternalServerErrorException("Internal Server Error");
        }
    }

    async createMaterial(data:{
        companyId:string,
        name:string,
        type:string,
        fileId:string,
    }){
        try {
            return await this.prisma.placmentMaterials.create({
                data:data
            });
        } catch (error) {
            console.log(error)
            throw new InternalServerErrorException("Internal Server Error");
        }
    }

    async getCompanyById(companyId:string){
        try {
            return await this.prisma.placements.findUnique({
                where:{
                    id:companyId
                },
                include:{
                    placementMaterials:{
                        select:{
                             id:true,
                             fileId:true,
                             name:true,
                             type:true,
                        }
                    }
                }
            
            });
        } catch (error) {
            console.log(error)
            throw new InternalServerErrorException("Internal Server Error");
        }
    }


    
}
