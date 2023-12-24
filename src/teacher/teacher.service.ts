import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ReviewDto, TeacherDto } from './dto/Teacher.dto';



const data = [
    {"Name": "Dr. Roshni Pradhan", "Subject": "CD CC", "Section": [1, 2]},
    {"Name": "Dr. Anjan Bandyopadhyay", "Subject": "CD CC", "Section": [1, 3]},
    {"Name": "Mrs. Lipika Mohanty", "Subject": "CD CC", "Section": [2, 23, 34]},
    {"Name": "Dr. Sarita Tripathy", "Subject": "CD T&TL TTL", "Section": [1, 4, 6]},
    {"Name": "Dr. Jasaswi Prasad Mohanty", "Subject": "CD T&TL TTL", "Section": [3, 17, 39]},
    {"Name": "Mrs. Lipika Dewangan", "Subject": "CD T&TL TTL", "Section": [2, 29, 38]},
    {"Name": "Dr. Abhishek Ray", "Subject": "CD T&TL", "Section": [1, 4]},
    {"Name": "Mr. Ajay Anand", "Subject": "CD T&TL TTL", "Section": [8, 12, 25, 32]},
    {"Name": "Mr. Lalit Kumar Vashishtha", "Subject": "CD T&TL TTL", "Section": [12, 19, 27, 37]},
    {"Name": "Mr. Prabhu Prasad Dev", "Subject": "CD T&TL TTL", "Section": [10, 26, 31, 38]},
    {"Name": "Dr. Jay Sarraf", "Subject": "CC SPM CC(Lab)", "Section": [2, 3, 5, 3, 27, 29]},
    {"Name": "Dr. Suchismita Rout", "Subject": "CC SPM CC(Lab)", "Section": [2, 3, 5, 5, 9, 10, 33]},
    {"Name": "Mr. Manas Ranjan Biswal", "Subject": "CC SPM CC(Lab)", "Section": [2, 3, 5, 11, 32, 36]},
    {"Name": "Dr. Prachet Bhuyan", "Subject": "CC SPM", "Section": [2, 3, 23, 25, 37]},
    {"Name": "Dr. Manjusha Pandey", "Subject": "CC SPM CC(Lab)", "Section": [2, 3, 5, 11, 19]},
    {"Name": "Dr. Jaydeep Das", "Subject": "CC SPM CC(Lab)", "Section": [2, 3, 5, 18, 21, 30]},
    {"Name": "Ms. Shilpa Das", "Subject": "CC T&TL CC(Lab) TTL", "Section": [2, 4, 5, 6, 4, 24, 39]},
    {"Name": "Ms. Aradhana Behura", "Subject": "CC T&TL CC(Lab) TTL", "Section": [2, 4, 5, 6, 9, 22, 24]},
    {"Name": "Mr. Sovan Kumar Sahoo", "Subject": "CC T&TL CC(Lab) TTL", "Section": [2, 4, 5, 6, 7, 14, 32]},
    {"Name": "Ms. Sricheta Parui", "Subject": "CC CC(Lab)", "Section": [2, 5, 1, 5, 13, 37]},
    {"Name": "Dr. Hitesh Mahapatra", "Subject": "CC CC(Lab)", "Section": [2, 5, 1, 5, 23]},
    {"Name": "Dr. Ambika Prasad Mishra", "Subject": "CC CC(Lab)", "Section": [2, 5, 2, 28]},
    {"Name": "Mrs. Subhashree Darshana", "Subject": "CC CC(Lab)", "Section": [2, 5, 6]},
    {"Name": "Mr. Kamalesh Karmakar", "Subject": "CC CC(Lab)", "Section": [2, 5, 7]},
    {"Name": "Dr. Suneeta Mohanty", "Subject": "CC CC(Lab)", "Section": [2, 5, 8, 38]},
    {"Name": "Dr. Santosh Kumar Swain", "Subject": "CC CC(Lab)", "Section": [2, 5, 12, 29]},
    {"Name": "Mrs. Ronali Padhy", "Subject": "CC CC(Lab)", "Section": [2, 5, 14, 35]},
    {"Name": "Dr. Subhranshu Sekhar Tripathy", "Subject": "CC CC(Lab)", "Section": [2, 5, 15, 17, 18]},
    {"Name": "Dr. Niranjan Kumar Ray", "Subject": "CC CC(Lab)", "Section": [2, 5, 16]},
    {"Name": "Dr. Dipti Dash", "Subject": "CC CC(Lab)", "Section": [2, 5, 20, 26]},
    {"Name": "Dr. Nachiketa Tarasia", "Subject": "CC CC(Lab)", "Section": [2, 5, 22, 34]},
    {"Name": "Dr. Ashish Singh", "Subject": "CC CC(Lab)", "Section": [2, 5, 25, 31]},
    {"Name": "Mr. Jhalak Hota", "Subject": "CD", "Section": [1, 20, 39]},
    {"Name": "Dr. Ajaya Kumar Parida", "Subject": "CD", "Section": [5, 22]},
    {"Name": "Dr. Ganga Bishnu Mund", "Subject": "CD", "Section": [6, 24, 36]},
    {"Name": "Mrs. Bindu Agarwalla", "Subject": "CD", "Section": [7, 25]},
    {"Name": "Mr. Nayan Kumar S. Behera", "Subject": "CD", "Section": [9, 19]},
    {"Name": "Mr. Amiya Kumar Dash", "Subject": "CD", "Section": [11, 23]},
    {"Name": "Mr. Tanik Saikh", "Subject": "CD", "Section": [14, 16]},
    {"Name": "Dr. Bhaswati Sahoo", "Subject": "CD", "Section": [21, 33]},
    {"Name": "Mr. Harish Kumar Patnaik", "Subject": "SPM", "Section": [1]},
    {"Name": "Mr. Arup Sarkar", "Subject": "SPM", "Section": [2, 39]},
    {"Name": "Ms. Krutika Verma", "Subject": "SPM", "Section": [3]},
    {"Name": "Dr. Raghunath Dey", "Subject": "SPM", "Section": [4]},
    {"Name": "Dr. Sushruta Mishra", "Subject": "SPM", "Section": [6, 17]},
    {"Name": "Dr. Saurabh Jha", "Subject": "SPM", "Section": [7]},
    {"Name": "Dr. Debachudamani Prusti", "Subject": "SPM", "Section": [8]},
    {"Name": "Dr. Jayanta Mondal", "Subject": "SPM", "Section": [10, 34]},
    {"Name": "Dr. Junali Jasmine Jena", "Subject": "SPM", "Section": [12, 30]},
    {"Name": "Ms. Swagatika Sahoo", "Subject": "SPM", "Section": [13]},
    {"Name": "Mr. Kunal Anand", "Subject": "SPM", "Section": [14, 33]},
    {"Name": "Dr. Jagannath Singh", "Subject": "SPM", "Section": [15, 24]},
    {"Name": "Ms. Priyanka Roy", "Subject": "SPM", "Section": [16, 22]},
    {"Name": "Dr. Saurabh Bilgaiyan", "Subject": "SPM", "Section": [19, 35]},
    {"Name": "Dr. Kumar Devadutta", "Subject": "SPM", "Section": [21, 38]},
    {"Name": "Mrs. Krishna Chakravarty", "Subject": "SPM", "Section": [26]},
    {"Name": "Ms. Chandani Kumari", "Subject": "SPM", "Section": [28]},
    {"Name": "Dr. Leena Das", "Subject": "SPM", "Section": [31, 36]},
    {"Name": "Dr. Soumya Ranjan Nayak", "Subject": "T&TL TTL", "Section": [1, 6]},
    {"Name": "Dr. Soumya Ranjan Mishra", "Subject": "T&TL TTL", "Section": [3, 34]},
    {"Name": "Mr. Pradeep Kandula", "Subject": "T&TL TTL", "Section": [4]},
    {"Name": "Mr. Ajit Kumar Pasayat", "Subject": "T&TL TTL", "Section": [5, 10]},
    {"Name": "Dr. Saikat Chakraborty", "Subject": "T&TL TTL", "Section": [8, 35]},
    {"Name": "Dr. Santwana Sagnika", "Subject": "T&TL TTL", "Section": [9]},
    {"Name": "Dr. Himansu Das", "Subject": "T&TL TTL", "Section": [11, 20]},
    {"Name": "Dr. Subhadip Pramanik", "Subject": "T&TL TTL", "Section": [13]},
    {"Name": "Dr. Dayal Kumar Behera", "Subject": "T&TL TTL", "Section": [15, 31]},
    {"Name": "Dr. Mainak Biswas", "Subject": "T&TL TTL", "Section": [16, 28]},
    {"Name": "Mr. Abhishek Raj", "Subject": "T&TL TTL", "Section": [17, 23]},
    {"Name": "Dr. Sujata Swain", "Subject": "T&TL TTL", "Section": [18]},
    {"Name": "Mr. Vijay Kumar Meena", "Subject": "T&TL TTL", "Section": [21]},
    {"Name": "Dr. Mohit Ranjan Panda", "Subject": "T&TL TTL", "Section": [27, 36]},
    {"Name": "Mr. Deependra Singh", "Subject": "T&TL TTL", "Section": [29]},
    {"Name": "Dr. Suchismita Das", "Subject": "T&TL TTL", "Section": [30]},
    {"Name": "Dr. Satarupa Mohanty", "Subject": "T&TL TTL", "Section": [33]},
    {"Name": "Mrs. Jayanti Dansana", "Subject": "T&TL TTL", "Section": [37]}
  ]
  

  
  const dap=
  [
    {
      "Name": "Dr. Roshni Pradhan",
      "Subject": "CD,CC",
      "Section": [4, 18, 33, 35]
    },
    {
      "Name": "Dr. Anjan Bandyopadhyay",
      "Subject": "CD,SPM",
      "Section": [13, 20, 27, 28]
    },
    {
      "Name": "Mrs. Lipika Mohanty",
      "Subject": "CD,SPM",
      "Section": [2,23, 34]
    },
    {
      "Name": "Dr. Sarita Tripathy",
      "Subject": "CD,T&TL,TTL",
      "Section": [15, 32]
    },
    {
      "Name": "Dr. Jasaswi Prasad Mohanty",
      "Subject": "CD,T&TL,TTL",
      "Section": [3, 17, 39]
    },
    {
      "Name": "Mrs. Lipika Dewangan",
      "Subject": "CD,T&TL,TTL",
      "Section": [2, 29, 38]
    },
    {
      "Name": "Dr. Abhishek Ray",
      "Subject": "CD,T&TL",
      "Section": [18, 26, 30]
    },
    {
      "Name": "Mr. Ajay Anand",
      "Subject": "CD,T&TL,TTL",
      "Section": [8, 12, 25, 32]
    },
    {
      "Name": "Mr. Lalit Kumar Vashishtha",
      "Subject": "CD,T&TL,TTL",
      "Section": [12, 19, 27, 37]
    },
    {
      "Name": "Mr. Prabhu Prasad Dev",
      "Subject": "CD,T&TL,TTL",
      "Section": [10, 26, 31, 38]
    },
    {
      "Name": "Dr. Jay Sarraf",
      "Subject": "CC,SPM,CC(Lab)",
      "Section": [3, 27, 29]
    },
    {
      "Name": "Dr. Suchismita Rout",
      "Subject": "CC,SPM,CC(Lab)",
      "Section": [5, 9, 10, 33]
    },
    {
      "Name": "Mr. Manas Ranjan Biswal",
      "Subject": "CC,SPM,CC(Lab)",
      "Section": [11, 32, 36]
    },
    {
      "Name": "Dr. Prachet Bhuyan",
      "Subject": "CC,SPM",
      "Section": [23, 25, 37]
    },
    {
      "Name": "Dr. Manjusha Pandey",
      "Subject": "CC,SPM,CC(Lab)",
      "Section": [11, 19]
    },
    {
      "Name": "Dr. Jaydeep Das",
      "Subject": "CC,SPM,CC(Lab)",
      "Section": [18, 21, 30]
    },
    {
      "Name": "Ms. Shilpa Das",
      "Subject": "CC,T&TL,CC(lab),TTL",
      "Section": [4, 24, 39]
    },
    {
      "Name": "Ms. Aradhana Behura",
      "Subject": "CC,T&TL,CC(lab),TTL",
      "Section": [9, 22, 24]
    },
    {
      "Name": "Mr. Sovan Kumar Sahoo",
      "Subject": "CC,T&TL,CC(lab),TTL",
      "Section": [7, 14, 32]
    },
    {
      "Name": "Ms. Sricheta Parui",
      "Subject": "CC,CC(Lab)",
      "Section": [1, 5, 13, 37]
    },
    {
      "Name": "Dr. Hitesh Mahapatra",
      "Subject": "CC,CC(Lab)",
      "Section": [1, 5, 23]
    },
    {
      "Name": "Dr. Ambika Prasad Mishra",
      "Subject": "CC,CC(Lab)",
      "Section": [2, 28]
    },
    {
      "Name": "Mrs. Subhashree Darshana",
      "Subject": "CC,CC(Lab)",
      "Section": [6]
    },
    {
      "Name": "Mr. Kamalesh Karmakar",
      "Subject": "CC,CC(Lab)",
      "Section": [7]
    },
    {
      "Name": "Dr. Suneeta Mohanty",
      "Subject": "CC,CC(Lab)",
      "Section": [8, 38]
    },
    {
      "Name": "Dr. Santosh Kumar Swain",
      "Subject": "CC,CC(Lab)",
      "Section": [12, 29]
    },
    {
      "Name": "Mrs. Ronali Padhy",
      "Subject": "CC,CC(Lab)",
      "Section": [14, 35]
    },
    {
      "Name": "Dr. Subhranshu Sekhar Tripathy",
      "Subject": "CC,CC(Lab)",
      "Section": [15, 17, 18]
    },
    {
      "Name": "Dr. Niranjan Kumar Ray",
      "Subject": "CC,CC(Lab)",
      "Section": [16]
    },
    {
      "Name": "Dr. Dipti Dash",
      "Subject": "CC,CC(Lab)",
      "Section": [20, 26]
    },
    {
      "Name": "Dr. Nachiketa Tarasia",
      "Subject": "CC,CC(Lab)",
      "Section": [22, 34]
    },
    {
      "Name": "Dr. Ashish Singh",
      "Subject": "CC,CC(Lab)",
      "Section": [25, 31]
    },
    {
      "Name": "Mr. Jhalak Hota",
      "Subject": "CD",
      "Section": [1, 20, 39]
    },
    {
      "Name": "Dr. Ajaya Kumar Parida",
      "Subject": "CD",
      "Section": [5, 22]
    },
    {
      "Name": "Dr. Ganga Bishnu Mund",
      "Subject": "CD",
      "Section": [6, 24, 36]
    },
    {
      "Name": "Mrs. Bindu Agarwalla",
      "Subject": "CD",
      "Section": [7, 25]
    },
    {
      "Name": "Mr. Nayan Kumar S. Behera",
      "Subject": "CD",
      "Section": [9, 19]
    },
    {
      "Name": "Mr. Amiya Kumar Dash",
      "Subject": "CD",
      "Section": [11, 23]
    },
    {
      "Name": "Mr. Tanik Saikh",
      "Subject": "CD",
      "Section": [14, 16]
    },
    {
      "Name": "Dr. Bhaswati Sahoo",
      "Subject": "CD",
      "Section": [21, 33]
    },
    {
      "Name": "Mr. Harish Kumar Patnaik",
      "Subject": "SPM",
      "Section": [1]
    },
    {
      "Name": "Mr. Arup Sarkar",
      "Subject": "SPM",
      "Section": [2, 39]
    },
    {
      "Name": "Ms. Krutika Verma",
      "Subject": "SPM",
      "Section": [3]
    },
    {
      "Name": "Dr. Raghunath Dey",
      "Subject": "SPM",
      "Section": [4]
    },
    {
      "Name": "Dr. Sushruta Mishra",
      "Subject": "SPM",
      "Section": [6, 17]
    },
    {
      "Name": "Dr. Saurabh Jha",
      "Subject": "SPM",
      "Section": [7]
    },
    {
      "Name": "Dr. Debachudamani Prusti",
      "Subject": "SPM",
      "Section": [8]
    },
    {
      "Name": "Dr. Jayanta Mondal",
      "Subject": "SPM",
      "Section": [10, 34]
    },
    {
      "Name": "Dr. Junali Jasmine Jena",
      "Subject": "SPM",
      "Section": [12, 30]
    },
    {
      "Name": "Ms. Swagatika Sahoo",
      "Subject": "SPM",
      "Section": [13]
    },
    {
      "Name": "Mr. Kunal Anand",
      "Subject": "SPM",
      "Section": [14, 33]
    },
    {
      "Name": "Dr. Jagannath Singh",
      "Subject": "SPM",
      "Section": [15, 24]
    },
    {
      "Name": "Ms. Priyanka Roy",
      "Subject": "SPM",
      "Section": [16, 22]
    },
    {
      "Name": "Dr. Saurabh Bilgaiyan",
      "Subject": "SPM",
      "Section": [19, 35]
    },
    {
      "Name": "Dr. Kumar Devadutta",
      "Subject": "SPM",
      "Section": [21, 38]
    },
    {
      "Name": "Mrs. Krishna Chakravarty",
      "Subject": "SPM",
      "Section": [26]
    },
    {
      "Name": "Ms. Chandani Kumari",
      "Subject": "SPM",
      "Section": [28]
    },
    {
      "Name": "Dr. Leena Das",
      "Subject": "SPM",
      "Section": [31, 36]
    },
    {
      "Name": "Dr. Soumya Ranjan Nayak",
      "Subject": "T&TL,TTL",
      "Section": [1, 6]
    },
    {
      "Name": "Dr. Soumya Ranjan Mishra",
      "Subject": "T&TL,TTL",
      "Section": [3 , 34]
    },
    {
      "Name": "Mr. Pradeep Kandula",
      "Subject": "T&TL,TTL",
      "Section": [4]
    },
    {
      "Name": "Mr. Ajit Kumar Pasayat",
      "Subject": "T&TL,TTL",
      "Section": [5, 10]
    },
    {
      "Name": "Dr. Saikat Chakraborty",
      "Subject": "T&TL,TTL",
      "Section": [8, 35]
    },
    {
      "Name": "Dr. Santwana Sagnika",
      "Subject": "T&TL,TTL",
      "Section": [9]
    },
    {
      "Name": "Dr. Himansu Das",
      "Subject": "T&TL,TTL",
      "Section": [11, 20]
    },
    {
      "Name": "Dr. Subhadip Pramanik",
      "Subject": "T&TL,TTL",
      "Section": [13]
    },
    {
      "Name": "Dr. Dayal Kumar Behera",
      "Subject": "T&TL,TTL",
      "Section": [15, 31]
    },
    {
      "Name": "Dr. Mainak Biswas",
      "Subject": "T&TL,TTL",
      "Section": [16, 28]
    },
    {
      "Name": "Mr. Abhishek Raj",
      "Subject": "T&TL,TTL",
      "Section": [17, 23]
    },
    {
      "Name": "Dr. Sujata Swain",
      "Subject": "T&TL,TTL",
      "Section": [18]
    },
    {
      "Name": "Mr. Vijay Kumar Meena",
      "Subject": "T&TL,TTL",
      "Section": [21]
    },
    {
      "Name": "Dr. Mohit Ranjan Panda",
      "Subject": "T&TL,TTL",
      "Section": [27, 36]
    },
    {
      "Name": "Mr. Deependra Singh",
      "Subject": "T&TL,TTL",
      "Section": [29]
    },
    {
      "Name": "Dr. Suchismita Das",
      "Subject": "T&TL,TTL",
      "Section": [30]
    },
    {
      "Name": "Dr. Satarupa Mohanty",
      "Subject": "T&TL, TTL",
      "Section": [33]
    },
    {
      "Name": "Mrs. Jayanti Dansana",
      "Subject": "T&TL, TTL",
      "Section": [37]
    },
    {
      "Name": "Dr. Junali Jasmine Jena",
      "Subject": "SPM",
      "Section": [12, 30]
    }
  ]
    

@Injectable()
export class TeacherService {

    constructor(private readonly prismService:PrismaService){}

    async addTeacher(dto:TeacherDto){
        console.log("hello")
    try {
        //send all data to prisma
        const complete = await Promise.all(dap.map(async (teacher) => {
            const { Name, Subject, Section } = teacher;
            const teacherData = await this.prismService.teacher.create({
                data: {
                    name: Name,
                    subject: Subject,
                    section: Section, // Convert Section array to an array of numbers
                    dislikes: [],
                    likes: [],
                    reviews: { create: [] }
                }
            });
            return teacherData;
        }));
        console.log(complete);

        return complete;

    
    } catch (error) {
        console.log(error);
        throw new UnauthorizedException('Invalid credentials');
    }


}

    async getAllTeacher() {
        console.log("fired teacher");
        return this.prismService.teacher.findMany({
            include: { reviews: true }
        });
    }


    //add review
    async addReview(id: string, review:ReviewDto) {
        try {
            const teacher = await this.prismService.teacher.findUnique({
                where: { id },
                include: { reviews: true }
            });
            if (!teacher) throw new Error('Teacher not found');
            const {teacherId,...rest} = review;
           const addRev = await this.prismService.review.create({
                data: {
                    ...rest,
                    teacher: { connect: { id: teacher.id } }
                }
            });
            console.log(addRev);
         
         
            // console.log(updatedTeacher);
            return addRev;

        } catch (error) {
            console.log(error);
            throw new UnauthorizedException('Invalid credentials');
        }
    }

    //get Teacher by id

    async getTeacherById(id:string){
        try {
            const teacher = await this.prismService.teacher.findUnique({
                where: { id },
                include: { reviews: true }
            });
            if (!teacher) throw new Error('Teacher not found');
            return teacher;
        } catch (error) {
            console.log(error);
            throw new UnauthorizedException('Invalid credentials');
        }
    }


    //like and dislike
    async likeAndDislike(id:string,like:boolean,email:string){
        try {
            const teacher = await this.prismService.teacher.findUnique({
                where: { id },
                include: { reviews: true }
            });
            if (!teacher) throw new Error('Teacher not found');
            if(like){
                const updatedTeacher = await this.prismService.teacher.update({
                    where: { id },
                    data: {
                        likes: { set:!teacher.likes.includes(email)?[...teacher.likes, email]:teacher.likes},
                        dislikes:{set:teacher.dislikes.filter((item)=>item!==email)}
                    }
                });
                return updatedTeacher;
            }else{
                const updatedTeacher = await this.prismService.teacher.update({
                    where: { id },
                    data: {
                        dislikes: { set:!teacher.dislikes.includes(email)?[...teacher.dislikes, email]:teacher.dislikes },
                        likes:{set:teacher.likes.filter((item)=>item!==email)}
                    }
                });
                return updatedTeacher;
            }
        } catch (error) {
            console.log(error);
            throw new UnauthorizedException('Invalid credentials');
        }
    }
}
