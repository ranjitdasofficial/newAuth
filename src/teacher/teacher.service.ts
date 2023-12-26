import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ReviewDto, TeacherDto } from './dto/Teacher.dto';
import * as ExcelJS from 'exceljs';

// import dap from './dap.json';

const Ml= [
    { "name": "Mr. Sankalp Nayak", "subject": "ML", "section": [1] },
    { "name": "Mr. Sohail Khan", "subject": "ML", "section": [3] },
    { "name": "Dr. Ramesh Kumar Thakur", "subject": "ML", "section": [4] },
    { "name": "Dr. Minakhi Rout", "subject": "ML", "section": [5] },
    { "name": "Dr. Kumar Surjeet Chaudhury", "subject": "ML", "section": [6] },
    { "name": "Prof. P. K. Samanta", "subject": "ML", "section": [7] },
    { "name": "Prof. Wriddhi Bhowmick", "subject": "ML", "section": [9] },
    { "name": "Prof. T. Kar", "subject": "ML", "section": [2, 11] },
    { "name": "Mr. A Ranjith", "subject": "ML", "section": [12] },
    { "name": "Mr. Chandra Shekhar", "subject": "ML", "section": [13] },
    { "name": "Prof. A. Gorai", "subject": "ML", "section": [10, 14] },
    { "name": "Mr. Sunil Kumar Gouda", "subject": "ML", "section": [15] },
    { "name": "Prof. Parveen Malik", "subject": "ML", "section": [16] },
    { "name": "Mr. Nayan Kumar S. Behera", "subject": "ML", "section": [17] },
    { "name": "Dr. Jayeeta Chakraborty", "subject": "ML", "section": [18] },
    { "name": "Dr. Satya Champati Rai", "subject": "ML", "section": [8, 19] },
    { "name": "Dr. Partha Pratim Sarangi", "subject": "ML", "section": [20] },
    { "name": "Dr. Rinku Datta Rakshit", "subject": "ML", "section": [21] },
    { "name": "Dr. Babita Panda", "subject": "ML", "section": [22] },
    { "name": "Dr. Pampa Sinha", "subject": "ML", "section": [23] },
    { "name": "Prof. Subodh Kumar Mohanty", "subject": "ML", "section": [24] },
    { "name": "Dr. Shubhasri Kundu", "subject": "ML", "section": [25] },
    { "name": "Dr. Subrat Kumar Barik", "subject": "ML", "section": [26] },
    { "name": "Dr. Padarbinda Samal", "subject": "ML", "section": [127] }
  ]



  const IOT=[
    { "name": "Mr. R. N. Ramakant Parida", "subject": "IOT", "section": [1] },
    { "name": "Dr. Debachudamani Prusti", "subject": "IOT", "section": [2] },
    { "name": "Mrs. Ronali Padhy", "subject": "IOT", "section": [3] },
    { "name": "Prof. T. M. Behera", "subject": "IOT", "section": [4, 10] },
    { "name": "Dr. Hitesh Mahapatra", "subject": "IOT", "section": [5, 8] },
    { "name": "Dr. Banchhanidhi Dash", "subject": "IOT", "section": [6] },
    { "name": "Prof. Akshaya Kumar Pati", "subject": "IOT", "section": [7] },
    { "name": "Prof. A. Samui", "subject": "IOT", "section": [9] },
    { "name": "Mr. Prasenjit Maiti", "subject": "IOT", "section": [11] },
    { "name": "Prof. Deepak Kumar Rout", "subject": "IOT", "section": [12] },
    { "name": "Prof. Swagat Das", "subject": "IOT", "section": [13] }
  ]


  const NLP=[
      { "name": "Mrs. Lipika Dewangan", "subject": "NLP", "section": [1, 4] },
      { "name": "Dr. Mainak Bandyopadhyay", "subject": "NLP", "section": [2, 5] },
      { "name": "Dr. Murari Mandal", "subject": "NLP", "section": [3] },
      { "name": "Dr. Ambika Prasad Mishra", "subject": "NLP", "section": [6] }
    ]
  

    const DA=[
        { "name": "Dr. Satarupa Mohanty", "subject": "DA", "section": [1, 29] },
        { "name": "Dr. Pratyusa Mukherjee", "subject": "DA", "section": [2] },
        { "name": "Dr. Subhadip Pramanik", "subject": "DA", "section": [3, 22] },
        { "name": "Dr. Abhaya Kumar Sahoo", "subject": "DA", "section": [4] },
        { "name": "Mr. Abinas Panda", "subject": "DA", "section": [5] },
        { "name": "Dr. Sarita Tripathy", "subject": "DA", "section": [6, 32] },
        { "name": "Mrs. Naliniprava Behera", "subject": "DA", "section": [7] },
        { "name": "Dr. Nibedan Panda", "subject": "DA", "section": [8] },
        { "name": "Mr. Pragma Kar", "subject": "DA", "section": [9, 20] },
        { "name": "Dr. Santosh Kumar Baliarsingh", "subject": "DA", "section": [10, 19] },
        { "name": "Mr. Deependra Singh", "subject": "DA", "section": [11, 21] },
        { "name": "Dr. Santwana Sagnika", "subject": "DA", "section": [12, 34] },
        { "name": "Mrs. Jayanti Dansana", "subject": "DA", "section": [13, 33] },
        { "name": "Mr. Vishal Meena", "subject": "DA", "section": [14] },
        { "name": "Dr. Subhranshu Sekhar Tripathy", "subject": "DA", "section": [15] },
        { "name": "Mr. Ajay Anand", "subject": "DA", "section": [16] },
        { "name": "Mrs. Meghana G Raj", "subject": "DA", "section": [17] },
        { "name": "Ms. Sricheta Parui", "subject": "DA", "section": [18] },
        { "name": "Dr. Mukesh Kumar", "subject": "DA", "section": [23] },
        { "name": "Mr. Jhalak Hota", "subject": "DA", "section": [24] },
        { "name": "Dr. Rajat Kumar Behera", "subject": "DA", "section": [25] },
        { "name": "Dr. Soumya Ranjan Nayak", "subject": "DA", "section": [26] },
        { "name": "Dr. Saikat Chakraborty", "subject": "DA", "section": [27] },
        { "name": "Mr. Rabi Shaw", "subject": "DA", "section": [28, 30] },
        { "name": "Dr. Aleena Swetapadma", "subject": "DA", "section": [31] }
      ]
  

@Injectable()
export class TeacherService {
  constructor(private readonly prismService: PrismaService) {}

  async addTeacher() {
    console.log('hello');
    try {
      //send all data to prisma
      const complete = await Promise.all(
        DA.map(async (teacher) => {
          const { name, subject, section } = teacher;
          const teacherData = await this.prismService.elective.create({
            data: {
              name: name,
              subject: subject,
              section: section, // Convert Section array to an array of numbers
              dislikes: [],
              likes: [],
              reviews: { create: [] },
            },
          });
          return teacherData;
        }),
      );
      console.log(complete);

      return complete;
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async getAllTeacher() {
    console.log('fired teacher');
    return this.prismService.teacher.findMany({
      include: { reviews: true },
    });
  }



  async getAllElective() {
    console.log('fired teacher');
    return this.prismService.elective.findMany({
      include: { reviews: true },
    });
  }
  //add review
  async addReview(id: string, review: ReviewDto) {
    try {
      const teacher = await this.prismService.teacher.findUnique({
        where: { id },
        include: { reviews: true },
      });
      if (!teacher) throw new Error('Teacher not found');
      const { teacherId, ...rest } = review;
      const addRev = await this.prismService.review.create({
        data: {
          ...rest,
          teacher: { connect: { id: teacher.id } },
        },
      });
      console.log(addRev);

      // console.log(updatedTeacher);
      return addRev;
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Invalid credentials');
    }
  }



  async addReviewElective(id: string, review: ReviewDto) {
    try {
      const teacher = await this.prismService.elective.findUnique({
        where: { id },
        include: { reviews: true },
      });
      if (!teacher) throw new Error('Teacher not found');
      const { teacherId, ...rest } = review;
      const addRev = await this.prismService.electiveReview.create({
        data: {
          ...rest,
          teacher: { connect: { id: teacher.id } },
        },
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

  async getTeacherById(id: string) {
    try {
      const teacher = await this.prismService.teacher.findUnique({
        where: { id },
        include: { reviews: true },
      });
      if (!teacher) throw new Error('Teacher not found');
      return teacher;
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Invalid credentials');
    }
  }



  async getElectiveById(id: string) {
    try {
      const teacher = await this.prismService.elective.findUnique({
        where: { id },
        include: { reviews: true },
      });
      if (!teacher) throw new Error('Teacher not found');
      return teacher;
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Invalid credentials');
    }
  }
  //like and dislike
  async likeAndDislike(id: string, like: boolean, email: string) {
    try {
      const teacher = await this.prismService.teacher.findUnique({
        where: { id },
        include: { reviews: true },
      });
      if (!teacher) throw new Error('Teacher not found');
      if (like) {
        const updatedTeacher = await this.prismService.teacher.update({
          where: { id },
          data: {
            likes: {
              set: !teacher.likes.includes(email)
                ? [...teacher.likes, email]
                : teacher.likes,
            },
            dislikes: {
              set: teacher.dislikes.filter((item) => item !== email),
            },
          },
        });
        return updatedTeacher;
      } else {
        const updatedTeacher = await this.prismService.teacher.update({
          where: { id },
          data: {
            dislikes: {
              set: !teacher.dislikes.includes(email)
                ? [...teacher.dislikes, email]
                : teacher.dislikes,
            },
            likes: { set: teacher.likes.filter((item) => item !== email) },
          },
        });
        return updatedTeacher;
      }
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Invalid credentials');
    }
  }



  async likeAndDislikeReview(id: string, like: boolean, email: string) {
    try {
      const teacher = await this.prismService.elective.findUnique({
        where: { id },
        include: { reviews: true },
      });
      if (!teacher) throw new Error('Teacher not found');
      if (like) {
        const updatedTeacher = await this.prismService.elective.update({
          where: { id },
          data: {
            likes: {
              set: !teacher.likes.includes(email)
                ? [...teacher.likes, email]
                : teacher.likes,
            },
            dislikes: {
              set: teacher.dislikes.filter((item) => item !== email),
            },
          },
        });
        return updatedTeacher;
      } else {
        const updatedTeacher = await this.prismService.elective.update({
          where: { id },
          data: {
            dislikes: {
              set: !teacher.dislikes.includes(email)
                ? [...teacher.dislikes, email]
                : teacher.dislikes,
            },
            likes: { set: teacher.likes.filter((item) => item !== email) },
          },
        });
        return updatedTeacher;
      }
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  //get Teachee By Section
  
  Teachers: any[] = [];
  siteInformation: string = `
  Report generated from KIIT-CONNECT WEBSITE.

  Website: https://www.kiitconnect.live/section_review/
  WhatsApp Group: https://chat.whatsapp.com/BPdjPtAlV1IE2ARH2GrzIq
  Created by Ranjit Das
`;
  async getData() {
    const teacherData = await this.prismService.teacher.findMany({
        include: { reviews: true },
        });
        
    for (let i = 1; i < 40; i++) {
      const sec1 = await Promise.all(
        teacherData.map(async (teacher) => {
          if (teacher.section.includes(i)) {
            return {
            //   id: teacher.id,
              name: teacher.name,
              subject: teacher.subject,
              likes: teacher.likes.length,
              dislikes: teacher.dislikes.length,
              reviews: teacher.reviews.map((review) => review.comments),
            };
          }
        })
      );

      const filteredSec1 = sec1.filter((teacher) => teacher !== undefined);

      this.Teachers.push({
        section: i,
        data: filteredSec1,
      });
    }

    const headers = Object.keys(this.Teachers[0].data[0]);
    console.log(headers);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Section_1`);

    this.addSiteInformation(worksheet);
    this.addReportGeneratedTime(worksheet);


    worksheet.addRow(['Color Legend']);
    this.addLegendRow(worksheet, 'Highly Recommended', '00FF00');
    this.addLegendRow(worksheet, 'Recommended', '00FFFF');
    this.addLegendRow(worksheet, 'Average', 'FFFF00');
    this.addLegendRow(worksheet, 'Moderately Recommended', 'FFA500');
    this.addLegendRow(worksheet, 'Not Recommended', 'FF0000');
    worksheet.addRow([]);
    worksheet.addRow(headers);

    this.Teachers.forEach((sec) => {
      worksheet.addRow([`Section ${sec.section}`]);
    //   worksheet.addRow([`Section ${sec.section}`]);
    //add some space to row
        

      sec.data.forEach((row) => {
        const values = headers.map((header) => row[header]);
        const rowRef = worksheet.addRow(values);

        const rat = row.likes / Math.max(row.dislikes, 1);
        // Avoid division by zero

        // Round off value to 2 decimal places
        const ratio = Math.round(rat * 100) / 100;
        console.log(ratio);

        switch (true) {
          case ratio >= 3:
            // Highly recommended
            this.applyColor(rowRef, '00FF00'); // Green color
            break;
          case ratio >= 2 && ratio < 3:
            // Recommended
            this.applyColor(rowRef, '00FFFF'); // Blue color
            break;
          case ratio >= 1.6 && ratio < 2:
            // Average
            this.applyColor(rowRef, 'FFFF00'); // Yellow color
            break;
          case ratio >= 1 && ratio < 1.6:
            // Moderately Recommended
            this.applyColor(rowRef, 'FFA500'); // Orange color
            break;
          case ratio < 1:
            // Not Recommended
            this.applyColor(rowRef, 'FF0000'); // Red color
            break;
          default:
            break;
        }
      });
      worksheet.addRow([null]);
    });

    // Save workbook to a file
    await workbook.xlsx.writeFile('sec-2.xlsx');

    return this.Teachers;
  }

  applyColor(rowRef: ExcelJS.Row, color: string) {
    for (let i = 1; i <= rowRef.cellCount; i++) {
      rowRef.getCell(i).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color },
      };
    }
  }

  addLegendRow(worksheet: ExcelJS.Worksheet, label: string, color: string) {
    const legendRow = worksheet.addRow([label]);
    legendRow.eachCell((cell) => {
      cell.font = {
        // color: { argb: '' },
         // White font color

        bold: true,
        size:13
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color },
      };
    });
  }




  addSiteInformation(worksheet: ExcelJS.Worksheet) {
    const lines = this.siteInformation.split('\n');

    // Style for bold text
    const boldStyle = {
      bold: true,
    };

    // Style for hyperlinks
    const hyperlinkStyle = {
      font: {
        color: { argb: '0000FF' }, // Blue font color
        underline: true,
      },
    };

    // Style for normal text
    const normalStyle = {};

    lines.forEach((line) => {
        const cell = worksheet.addRow([line]).getCell(1);

        // Apply styles based on content
        if (line.includes('Website:')) {
            cell.font = Object.assign({}, boldStyle, hyperlinkStyle);
        } else if (line.includes('WhatsApp Group:')) {
            cell.font = Object.assign({}, boldStyle, hyperlinkStyle);
        } else {
            cell.font = Object.assign({}, boldStyle, normalStyle);
        }
    });

    // Add an empty row for separation
    worksheet.addRow([null]);
  }


  addReportGeneratedTime(worksheet: ExcelJS.Worksheet) {
    const now = new Date();
    const formattedTime = `Report generated on: ${now.toLocaleString()}`;

    // Style for italicized and gray text
    const timeStyle = {
      font: {
        italic: true,
        color: { argb: '756562' }, // Gray font color
      },
    };

    // Add the report generated time with styles
    worksheet.addRow([formattedTime]).getCell(1).style = timeStyle;
    worksheet.addRow([null]); // Add an empty row for separation
  }

}
