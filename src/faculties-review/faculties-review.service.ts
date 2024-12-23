import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { disconnect } from 'process';
import { PrismaService } from 'src/prisma.service';

import * as ExcelJS from 'exceljs';

@Injectable()
export class FacultiesReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async createSections() {
    try {
      const count = 0;
      // Fetch all semesters
      const allSemesters = await this.prisma.semester.findMany({
        select: {
          id: true,
        },
      });

      // Prepare data for all sections for all semesters
      const sectionsData = [];
      for (const semester of allSemesters) {
        for (let i = 1; i <= 60; i++) {
          sectionsData.push({
            section: i,
            semesterId: semester.id,
          });
        }
      }
      // Batch insert all sections
      const p = await this.prisma.semesterSections.createMany({
        data: sectionsData,
      });
      console.log('Created sections: ', p, count);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } catch (error) {
      // Handle errors
      console.error('Error creating sections:', error);
      // Optionally, throw the error again to propagate it upwards
      throw error;
    }
  }

  getSectionBySemeseterId(semesterId: string) {
    return this.prisma.semesterSections.findMany({
      where: {
        semesterId: semesterId,
      },
    });
  }

  async assignFaculty(data: { facultyId: string; sectionId: string }) {
    const { facultyId, sectionId } = data;
    try {
      if (!facultyId || !sectionId)
        throw new BadRequestException('Invalid data provided');
      const p = await this.prisma.semesterSections.update({
        where: {
          id: sectionId,
        },
        data: {
          faculty: {
            connect: {
              id: facultyId,
            },
          },
        },
      });

      if (!p)
        throw new InternalServerErrorException(
          'Error assigning faculty to section',
        );

      return p;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        'Error assigning faculty to section',
      );
    }
  }

  async getSectionBySectionId(sectionId: string) {
    return this.prisma.semesterSections.findUnique({
      where: {
        id: sectionId,
      },
      include: {
        faculty: true,
      },
    });
  }

  async addFacultyReview() {
    const allReviews = [
      {
        name: 'Mr. Abhishek Raj',
        likes: 39,
        dislikes: 10,
        reviews: [],
      },
      {
        name: 'Mr. Pradeep Kandula',
        likes: 24,
        dislikes: 36,
        reviews: [
          {
            id: '65901ac045c2b626d34b3abd',
            rating: 3,
            commentedBy: '22054390@kiit.ac.in',
            internalScore: 21,
            comments: "he doesn't give marks!",
            teacherId: '65900f80e771e0a80148ed30',
          },
          {
            id: '6590235945c2b626d34b3ae0',
            rating: 1,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 24,
            comments: 'worst faculty',
            teacherId: '65900f80e771e0a80148ed30',
          },
          {
            id: '659029ea45c2b626d34b3af4',
            rating: 5,
            commentedBy: '21053436@kiit.ac.in',
            internalScore: 30,
            comments: 'Teaches good, Gives deserving marks',
            teacherId: '65900f80e771e0a80148ed30',
          },
          {
            id: '659047a245c2b626d34b3b1e',
            rating: 4,
            commentedBy: '22051350@kiit.ac.in',
            internalScore: 27,
            comments: 'Good teacher ',
            teacherId: '65900f80e771e0a80148ed30',
          },
          {
            id: '65912fe745c2b626d34b3b43',
            rating: 4,
            commentedBy: '22051743@kiit.ac.in',
            internalScore: 27,
            comments: 'no extra marks ...just deserving marks\n',
            teacherId: '65900f80e771e0a80148ed30',
          },
        ],
      },
      {
        name: 'Dr. Jagannath Singh',
        likes: 40,
        dislikes: 6,
        reviews: [
          {
            id: '65901c1945c2b626d34b3ac6',
            rating: 5,
            commentedBy: '2229108@kiit.ac.in',
            internalScore: 29,
            comments: 'best',
            teacherId: '65900f82e771e0a80148ed33',
          },
          {
            id: '65903e2b45c2b626d34b3b16',
            rating: 4,
            commentedBy: '22052939@kiit.ac.in',
            internalScore: 30,
            comments: 'Explains every concepts very well . ',
            teacherId: '65900f82e771e0a80148ed33',
          },
        ],
      },
      {
        name: 'Mr. Vijay Kumar Meena',
        likes: 12,
        dislikes: 36,
        reviews: [],
      },
      {
        name: 'Dr. Joydeb Pal',
        likes: 40,
        dislikes: 28,
        reviews: [
          {
            id: '65901e1745c2b626d34b3ad2',
            rating: 5,
            commentedBy: '2206107@kiit.ac.in',
            internalScore: 28,
            comments:
              "He is very good and very chill teacher and also teaches very well. He'll try to give as much as possible internals. You can choose him blindly. ",
            teacherId: '65900f82e771e0a80148ed35',
          },
          {
            id: '659033fa45c2b626d34b3b08',
            rating: 4,
            commentedBy: '22052643@kiit.ac.in',
            internalScore: 29,
            comments: 'Great teaching style.',
            teacherId: '65900f82e771e0a80148ed35',
          },
          {
            id: '6590342145c2b626d34b3b09',
            rating: 5,
            commentedBy: '22052643@kiit.ac.in',
            internalScore: 29,
            comments: '.',
            teacherId: '65900f82e771e0a80148ed35',
          },
          {
            id: '6590568845c2b626d34b3b25',
            rating: 3,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 25,
            comments: 'Average',
            teacherId: '65900f82e771e0a80148ed35',
          },
        ],
      },
      {
        name: 'Prof. S. Padhy',
        likes: 7,
        dislikes: 3,
        reviews: [],
      },
      {
        name: 'Dr. Seba Mohanty',
        likes: 27,
        dislikes: 15,
        reviews: [
          {
            id: '65901bf445c2b626d34b3ac4',
            rating: 4,
            commentedBy: '22051843@kiit.ac.in',
            internalScore: 27,
            comments:
              'Internals me sbko 27 k uper di thi. Marks acha hi deti hai.',
            teacherId: '65900f82e771e0a80148ed34',
          },
          {
            id: '6590207545c2b626d34b3adb',
            rating: 5,
            commentedBy: '22053488@kiit.ac.in',
            internalScore: 28,
            comments: 'Good ',
            teacherId: '65900f82e771e0a80148ed34',
          },
          {
            id: '6590289f45c2b626d34b3af0',
            rating: 5,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments:
              "She's pretty lenient and friendly; marks graciously in both internals as well as mid and end sem exams",
            teacherId: '65900f82e771e0a80148ed34',
          },
          {
            id: '6593a5e645c2b626d34b3b67',
            rating: 5,
            commentedBy: '22052768@kiit.ac.in',
            internalScore: 30,
            comments: 'Gives good marks, also is lenient with attendance',
            teacherId: '65900f82e771e0a80148ed34',
          },
        ],
      },
      {
        name: 'Dr. Ashish Singh',
        likes: 2,
        dislikes: 57,
        reviews: [
          {
            id: '659026cc45c2b626d34b3ae4',
            rating: 1,
            commentedBy: '2105672@kiit.ac.in',
            internalScore: 19,
            comments: 'isko liya to pura semester bhugto ge',
            teacherId: '65900f82e771e0a80148ed36',
          },
          {
            id: '6591295745c2b626d34b3b41',
            rating: 1,
            commentedBy: '2105260@kiit.ac.in',
            internalScore: 16,
            comments: 'Worst faculty. Students are affected very badly',
            teacherId: '65900f82e771e0a80148ed36',
          },
        ],
      },
      {
        name: 'Prof. Kumar Biswal',
        likes: 10,
        dislikes: 14,
        reviews: [],
      },
      {
        name: 'Dr. Promod Mallick',
        likes: 7,
        dislikes: 5,
        reviews: [],
      },
      {
        name: 'Dr. Ananda Meher',
        likes: 12,
        dislikes: 6,
        reviews: [
          {
            id: '65923f6a45c2b626d34b3b53',
            rating: 5,
            commentedBy: '22052653@kiit.ac.in',
            internalScore: 30,
            comments: '\n\n',
            teacherId: '65900f82e771e0a80148ed3a',
          },
        ],
      },
      {
        name: 'Prof. J. R. Panda',
        likes: 5,
        dislikes: 2,
        reviews: [],
      },
      {
        name: 'Dr. Jitendra Ku. Patel',
        likes: 3,
        dislikes: 13,
        reviews: [],
      },
      {
        name: 'Dr. Mahendra Kumar Gourisaria',
        likes: 10,
        dislikes: 123,
        reviews: [
          {
            id: '65913a0545c2b626d34b3b47',
            rating: 1,
            commentedBy: '2206065@kiit.ac.in',
            internalScore: 20,
            comments: '80% of the class got a 25/50 in his internals',
            teacherId: '65900f82e771e0a80148ed3d',
          },
          {
            id: '6593aec245c2b626d34b3b6c',
            rating: 1,
            commentedBy: '2228124@kiit.ac.in',
            internalScore: 19,
            comments: 'Torture',
            teacherId: '65900f82e771e0a80148ed3d',
          },
          {
            id: '6593fb7f45c2b626d34b3b70',
            rating: 1,
            commentedBy: '2206290@kiit.ac.in',
            internalScore: 16,
            comments: "Don't..just don't ",
            teacherId: '65900f82e771e0a80148ed3d',
          },
          {
            id: '6594001945c2b626d34b3b72',
            rating: 5,
            commentedBy: '2205894@kiit.ac.in',
            internalScore: 13,
            comments: 'Maa chud jayegi ',
            teacherId: '65900f82e771e0a80148ed3d',
          },
        ],
      },
      {
        name: 'Mr. Rabi Shaw',
        likes: 13,
        dislikes: 65,
        reviews: [
          {
            id: '6590270145c2b626d34b3ae6',
            rating: 1,
            commentedBy: '2105366@kiit.ac.in',
            internalScore: 30,
            comments:
              "Probably one of the most evil teachers out there, he actively wants his students to fail miserably and then laugh at their helpless faces. He'll pull some of the the most outlandish bullshit just to make you feel worthless about everything. You CAN, however, get good marks under him if you make a very good impression on him somehow. ",
            teacherId: '65900f82e771e0a80148ed43',
          },
          {
            id: '659037e145c2b626d34b3b0f',
            rating: 5,
            commentedBy: '21051720@kiit.ac.in',
            internalScore: 30,
            comments:
              'He is actually good, if you maintain discipline in class, have 90% above attendance and sit in first bench. He will give 28+ in internals out of 30. Just don’t disturb in his class, else he will make your semester hell.',
            teacherId: '65900f82e771e0a80148ed43',
          },
          {
            id: '659056ea45c2b626d34b3b26',
            rating: 5,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 29,
            comments: 'Marks depends on his mood 😂 ',
            teacherId: '65900f82e771e0a80148ed43',
          },
          {
            id: '65df613c0fb947f5b25481d7',
            rating: 1,
            commentedBy: '2205333@kiit.ac.in',
            internalScore: 14,
            comments: 'Just the worst',
            teacherId: '65900f82e771e0a80148ed43',
          },
        ],
      },
      {
        name: 'Mr. Rakesh Kumar Rai',
        likes: 2,
        dislikes: 2,
        reviews: [],
      },
      {
        name: 'Dr. Saurabh Jha',
        likes: 11,
        dislikes: 20,
        reviews: [
          {
            id: '6590d08e45c2b626d34b3b30',
            rating: 1,
            commentedBy: '21052415@kiit.ac.in',
            internalScore: 27,
            comments:
              'Quiz ka answer net pe mil jayega lekin mid aur end sem.. 🤞🤞',
            teacherId: '65900f82e771e0a80148ed3f',
          },
          {
            id: '65944e5a45c2b626d34b3b79',
            rating: 5,
            commentedBy: '2205606@kiit.ac.in',
            internalScore: 30,
            comments: 'best teacher\n',
            teacherId: '65900f82e771e0a80148ed3f',
          },
        ],
      },
      {
        name: 'Dr. Habibul Islam',
        likes: 13,
        dislikes: 5,
        reviews: [
          {
            id: '65901b3045c2b626d34b3ac1',
            rating: 5,
            commentedBy: 'tpiyush2626@gmail.com',
            internalScore: 30,
            comments: 'excellent',
            teacherId: '65900f82e771e0a80148ed40',
          },
          {
            id: '6590201b45c2b626d34b3ad7',
            rating: 4,
            commentedBy: '2206130@kiit.ac.in',
            internalScore: 30,
            comments: 'Highly recommended ',
            teacherId: '65900f82e771e0a80148ed40',
          },
        ],
      },
      {
        name: 'Dr. Saurabh Bilgaiyan',
        likes: 7,
        dislikes: 110,
        reviews: [
          {
            id: '65901db445c2b626d34b3ace',
            rating: 3,
            commentedBy: '2105895@kiit.ac.in',
            internalScore: 30,
            comments:
              "I never studied from him. But my roommate was in his class and he came for substitution in my OS class. I have entered my roommate's internals. He's a good guy assuming you study and attend classes. His teaching style was good. You'll understand stuff. But don't take if you're not gonna grind cause he's also infamous for failing people ",
            teacherId: '65900f82e771e0a80148ed3c',
          },
          {
            id: '659028d745c2b626d34b3af1',
            rating: 1,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 25,
            comments: 'do NOT opt',
            teacherId: '65900f82e771e0a80148ed3c',
          },
          {
            id: '65902a3145c2b626d34b3af7',
            rating: 4,
            commentedBy: '21053436@kiit.ac.in',
            internalScore: 18,
            comments: 'Worst ever',
            teacherId: '65900f82e771e0a80148ed3c',
          },
          {
            id: '65903d7345c2b626d34b3b13',
            rating: 1,
            commentedBy: '2105578@kiit.ac.in',
            internalScore: -1,
            comments:
              'remember the teacher who made out with students? Yes that is him. \n',
            teacherId: '65900f82e771e0a80148ed3c',
          },
        ],
      },
      {
        name: 'Dr. Swarup K. Nayak',
        likes: 3,
        dislikes: 4,
        reviews: [],
      },
      {
        name: 'Dr. Himansu Das',
        likes: 25,
        dislikes: 3,
        reviews: [],
      },
      {
        name: 'Prof. S. Mishra',
        likes: 4,
        dislikes: 9,
        reviews: [],
      },
      {
        name: 'Mr. Deependra Singh',
        likes: 23,
        dislikes: 6,
        reviews: [
          {
            id: '6590344145c2b626d34b3b0a',
            rating: 1,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 25,
            comments: 'No 1 chutiya hai bhai mat lena nahi to regret hoga ',
            teacherId: '65900f82e771e0a80148ed42',
          },
        ],
      },
      {
        name: 'Mrs. Krishna Chakravarty',
        likes: 27,
        dislikes: 4,
        reviews: [],
      },
      {
        name: 'Dr. Debanjan Pathak',
        likes: 24,
        dislikes: 12,
        reviews: [],
      },
      {
        name: 'Dr. Arun Kumar Gupta',
        likes: 27,
        dislikes: 14,
        reviews: [
          {
            id: '6590241645c2b626d34b3ae1',
            rating: 5,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 28,
            comments: 'best faculty',
            teacherId: '65900f82e771e0a80148ed47',
          },
          {
            id: '6590269845c2b626d34b3ae3',
            rating: 4,
            commentedBy: '22052705@kiit.ac.in',
            internalScore: 25,
            comments:
              'Thik thak hi he ...\nAttendance me thoda strict hein sir',
            teacherId: '65900f82e771e0a80148ed47',
          },
          {
            id: '65926c9345c2b626d34b3b54',
            rating: 4,
            commentedBy: '22053675@kiit.ac.in',
            internalScore: 24,
            comments:
              'Internal bahat kam dete hain but mid sem mein thik thak dete hain',
            teacherId: '65900f82e771e0a80148ed47',
          },
          {
            id: '6593069445c2b626d34b3b5d',
            rating: 4,
            commentedBy: '22051204@kiit.ac.in',
            internalScore: 28,
            comments:
              'Bohot achha padhata hai. Internals mein full nehi deta, par bohot lenient checking karta hai.',
            teacherId: '65900f82e771e0a80148ed47',
          },
        ],
      },
      {
        name: 'Dr. Mainak Biswas',
        likes: 26,
        dislikes: 13,
        reviews: [
          {
            id: '65902f3845c2b626d34b3b05',
            rating: 5,
            commentedBy: '2205639@kiit.ac.in',
            internalScore: 30,
            comments:
              'Easy to get marks. A little hard to aprroach but studying will get you marks \n',
            teacherId: '65900f82e771e0a80148ed45',
          },
          {
            id: '65914efb45c2b626d34b3b48',
            rating: 5,
            commentedBy: '22052256@kiit.ac.in',
            internalScore: 27,
            comments: 'Lenient ',
            teacherId: '65900f82e771e0a80148ed45',
          },
        ],
      },
      {
        name: 'Prof. Sushree S. Panda',
        likes: 3,
        dislikes: 8,
        reviews: [],
      },
      {
        name: 'Dr. Aleena Swetapadma',
        likes: 29,
        dislikes: 10,
        reviews: [],
      },
      {
        name: 'Dr. Mitali Routaray',
        likes: 19,
        dislikes: 22,
        reviews: [],
      },
      {
        name: 'Mr. Mainak Chakraborty',
        likes: 32,
        dislikes: 0,
        reviews: [
          {
            id: '6590292245c2b626d34b3af2',
            rating: 5,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments:
              'excellent teaching style; gives ample questions for practice; gives excellent marks',
            teacherId: '65900f83e771e0a80148ed4d',
          },
          {
            id: '6591370545c2b626d34b3b46',
            rating: 1,
            commentedBy: '22051924@kiit.ac.in',
            internalScore: 30,
            comments:
              'Best teacher. Very lenient and gives good marks. Excellent teaching style. Internals mai almost sabko 30/30 diye the AFL mai❤️❤️',
            teacherId: '65900f83e771e0a80148ed4d',
          },
          {
            id: '65914f1645c2b626d34b3b49',
            rating: 5,
            commentedBy: '22052256@kiit.ac.in',
            internalScore: 30,
            comments: 'Chill',
            teacherId: '65900f83e771e0a80148ed4d',
          },
          {
            id: '65914fe645c2b626d34b3b4a',
            rating: 4,
            commentedBy: '22052245@kiit.ac.in',
            internalScore: 29,
            comments: 'good teacher and student friendly',
            teacherId: '65900f83e771e0a80148ed4d',
          },
          {
            id: '6591961945c2b626d34b3b4e',
            rating: 5,
            commentedBy: '2205972@kiit.ac.in',
            internalScore: 27,
            comments: 'badhiya samjhate h, chill af and genuine',
            teacherId: '65900f83e771e0a80148ed4d',
          },
        ],
      },
      {
        name: 'Dr. Srikanta Behera',
        likes: 9,
        dislikes: 1,
        reviews: [],
      },
      {
        name: 'Dr. VIkas Hassija',
        likes: 6,
        dislikes: 25,
        reviews: [
          {
            id: '65902b3545c2b626d34b3afb',
            rating: 4,
            commentedBy: '21053436@kiit.ac.in',
            internalScore: 22,
            comments:
              'Has has k le lega hassija, 26 toh highest rehta hai iske internal me 🥸',
            teacherId: '65900f83e771e0a80148ed51',
          },
        ],
      },
      {
        name: 'Prof. Nazia T. Imran',
        likes: 1,
        dislikes: 1,
        reviews: [],
      },
      {
        name: 'Dr. Mainak Bandyopadhyay',
        likes: 22,
        dislikes: 18,
        reviews: [],
      },
      {
        name: 'Mr. Anil Kumar Swain',
        likes: 30,
        dislikes: 3,
        reviews: [],
      },
      {
        name: 'Prof. S. K. Badi',
        likes: 8,
        dislikes: 17,
        reviews: [],
      },
      {
        name: 'Dr. Biswajit Sahoo',
        likes: 90,
        dislikes: 15,
        reviews: [
          {
            id: '6590430d45c2b626d34b3b19',
            rating: 5,
            commentedBy: '21051974@kiit.ac.in',
            internalScore: 28,
            comments:
              'He is a very good teacher. Maintain give and take relation. If you want to learn just select him',
            teacherId: '65900f83e771e0a80148ed56',
          },
          {
            id: '6590ff0445c2b626d34b3b3e',
            rating: 5,
            commentedBy: '22052843@kiit.ac.in',
            internalScore: 30,
            comments:
              'One of the most chill teacher in KIIT, hamare C lab ke teacher the',
            teacherId: '65900f83e771e0a80148ed56',
          },
        ],
      },
      {
        name: 'Dr. Basanta Kumar Rana',
        likes: 5,
        dislikes: 1,
        reviews: [],
      },
      {
        name: 'Dr. Soumya Ranjan Mishra',
        likes: 21,
        dislikes: 5,
        reviews: [],
      },
      {
        name: 'Mr. Kunal Anand',
        likes: 46,
        dislikes: 3,
        reviews: [],
      },
      {
        name: 'Dr. Hrudaya Kumar Tripathy',
        likes: 11,
        dislikes: 10,
        reviews: [],
      },
      {
        name: 'Ms. Chandani Kumari',
        likes: 20,
        dislikes: 24,
        reviews: [],
      },
      {
        name: 'Dr. Sushruta Mishra',
        likes: 30,
        dislikes: 3,
        reviews: [],
      },
      {
        name: 'Dr. Spandan Guha',
        likes: 5,
        dislikes: 11,
        reviews: [],
      },
      {
        name: 'Dr. Prasanta Ku. Mohanty',
        likes: 32,
        dislikes: 11,
        reviews: [
          {
            id: '6591026445c2b626d34b3b3f',
            rating: 5,
            commentedBy: '22051815@kiit.ac.in',
            internalScore: 30,
            comments:
              'Has very good grasp on the subject. Teaches very good. Just pay attention in his class. Maintain healthy attendance and will give very good in internals. Even if attendance is less than 75 still everyone got 25+ in internals.',
            teacherId: '65900f83e771e0a80148ed5a',
          },
          {
            id: '659466b245c2b626d34b3b7b',
            rating: 4,
            commentedBy: '22052198@kiit.ac.in',
            internalScore: 27,
            comments: 'teaches really well',
            teacherId: '65900f83e771e0a80148ed5a',
          },
        ],
      },
      {
        name: 'Dr. Alivarani Mohapatra',
        likes: 9,
        dislikes: 10,
        reviews: [],
      },
      {
        name: 'Dr. Srikumar Acharya',
        likes: 15,
        dislikes: 9,
        reviews: [],
      },
      {
        name: 'Dr. Jayeeta Chakraborty',
        likes: 13,
        dislikes: 24,
        reviews: [
          {
            id: '659132b845c2b626d34b3b45',
            rating: 1,
            commentedBy: '22054341@kiit.ac.in',
            internalScore: 22,
            comments: 'too less as i did all she said \n',
            teacherId: '65900f83e771e0a80148ed61',
          },
          {
            id: '6593e39345c2b626d34b3b6d',
            rating: 1,
            commentedBy: '2205910@kiit.ac.in',
            internalScore: 20,
            comments: 'marks nhi deti ekdam',
            teacherId: '65900f83e771e0a80148ed61',
          },
        ],
      },
      {
        name: 'Mr. Pragma Kar',
        likes: 3,
        dislikes: 2,
        reviews: [],
      },
      {
        name: 'Ms. Susmita Das',
        likes: 16,
        dislikes: 2,
        reviews: [],
      },
      {
        name: 'Dr. Murari Mandal',
        likes: 10,
        dislikes: 30,
        reviews: [],
      },
      {
        name: 'Dr. Namita Panda',
        likes: 36,
        dislikes: 10,
        reviews: [
          {
            id: '65901f1545c2b626d34b3ad4',
            rating: 5,
            commentedBy: '2106290@kiit.ac.in',
            internalScore: 29,
            comments: 'She is great',
            teacherId: '65900f83e771e0a80148ed66',
          },
          {
            id: '65930e0945c2b626d34b3b63',
            rating: 4,
            commentedBy: '2206340@kiit.ac.in',
            internalScore: 23,
            comments:
              'She is great when it comes to teaching but for internals she conducts class test. You have to score well to get good internals. But can increase internals if you have scored well in mid sem.',
            teacherId: '65900f83e771e0a80148ed66',
          },
        ],
      },
      {
        name: 'Dr. Asif Uddin Khan',
        likes: 17,
        dislikes: 23,
        reviews: [],
      },
      {
        name: 'Dr. Suvasis Nayak',
        likes: 25,
        dislikes: 1,
        reviews: [],
      },
      {
        name: 'Dr. Rinku Datta Rakshit',
        likes: 22,
        dislikes: 5,
        reviews: [
          {
            id: '65904d3645c2b626d34b3b1f',
            rating: 5,
            commentedBy: '2105974@kiit.ac.in',
            internalScore: 30,
            comments: 'Padhati bohot acha h...highly recommended ',
            teacherId: '65900f83e771e0a80148ed67',
          },
        ],
      },
      {
        name: 'Dr. Manas Ranjan Nayak',
        likes: 23,
        dislikes: 9,
        reviews: [
          {
            id: '65903cc445c2b626d34b3b11',
            rating: 3,
            commentedBy: '2128034@kiit.ac.in',
            internalScore: 23,
            comments: 'Good overall. Not the best but will do.\n',
            teacherId: '65900f84e771e0a80148ed69',
          },
          {
            id: '6591ac0e45c2b626d34b3b52',
            rating: 3,
            commentedBy: '2206340@kiit.ac.in',
            internalScore: 25,
            comments:
              'Bhai is aadmi ko khud kuch nhi aata. Lenient h no doubt. But ha agr tmne shi likha h to b guarantee nhi h k marks milenge kyuki usko smjh nhi aata',
            teacherId: '65900f84e771e0a80148ed69',
          },
          {
            id: '6594603e45c2b626d34b3b7a',
            rating: 5,
            commentedBy: '2206385@kiit.ac.in',
            internalScore: 30,
            comments: 'na',
            teacherId: '65900f84e771e0a80148ed69',
          },
        ],
      },
      {
        name: 'Prof. Ganaraj P. S.',
        likes: 8,
        dislikes: 21,
        reviews: [],
      },
      {
        name: 'Dr. Soumya Ranjan Nayak',
        likes: 8,
        dislikes: 11,
        reviews: [
          {
            id: '65902fd245c2b626d34b3b06',
            rating: 3,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 26,
            comments: 'South indian Villian ',
            teacherId: '65900f84e771e0a80148ed6c',
          },
          {
            id: '65930bec45c2b626d34b3b5e',
            rating: 5,
            commentedBy: '22052043@kiit.ac.in',
            internalScore: 30,
            comments:
              'Very Good teacher... especially good if u can get in his good graces... "You can\'t stop me from being myself"',
            teacherId: '65900f84e771e0a80148ed6c',
          },
          {
            id: '65930c5545c2b626d34b3b5f',
            rating: 5,
            commentedBy: '22052042@kiit.ac.in',
            internalScore: 29,
            comments: 'du6urr6vubt o9uo8 ',
            teacherId: '65900f84e771e0a80148ed6c',
          },
          {
            id: '65930c6245c2b626d34b3b60',
            rating: 4,
            commentedBy: '22052044@kiit.ac.in',
            internalScore: 27,
            comments:
              'Good "\'if and only if"\' you are attentive and interact with the teacher',
            teacherId: '65900f84e771e0a80148ed6c',
          },
          {
            id: '65930c7545c2b626d34b3b61',
            rating: 4,
            commentedBy: '22052054@kiit.ac.in',
            internalScore: 27,
            comments:
              'Thik thak hi padhata hai ,exam me bas marks Thora ulta sidha deta hai,kabhi kabhi sahi answers p marks nhi dega but recheck p dene se marks badha dega',
            teacherId: '65900f84e771e0a80148ed6c',
          },
        ],
      },
      {
        name: 'Prof. A. Bakshi',
        likes: 10,
        dislikes: 15,
        reviews: [],
      },
      {
        name: 'Mr. Bijay Das',
        likes: 2,
        dislikes: 2,
        reviews: [],
      },
      {
        name: 'Mr. Debashis Hati',
        likes: 27,
        dislikes: 11,
        reviews: [],
      },
      {
        name: 'Dr. Debdulal Ghosh',
        likes: 7,
        dislikes: 2,
        reviews: [],
      },
      {
        name: 'Dr. Alok Kumar Jagadev',
        likes: 7,
        dislikes: 18,
        reviews: [
          {
            id: '6591a71345c2b626d34b3b4f',
            rating: 3,
            commentedBy: '22054176@kiit.ac.in',
            internalScore: 25,
            comments:
              'Strict teacher and you need to be attentive in class.Will give marks as per you deserve and checks the assignments very strictly ',
            teacherId: '65900f84e771e0a80148ed71',
          },
          {
            id: '6594423c45c2b626d34b3b77',
            rating: 3,
            commentedBy: '22054173@kiit.ac.in',
            internalScore: 27,
            comments:
              "Strict, doesn't let u use phone in class. Good teacher. Sometimes his lectures might be boring, will never let u sleep.",
            teacherId: '65900f84e771e0a80148ed71',
          },
        ],
      },
      {
        name: 'Dr. Akshaya Kumar Panda',
        likes: 11,
        dislikes: 12,
        reviews: [
          {
            id: '65901ff545c2b626d34b3ad6',
            rating: 1,
            commentedBy: 'imamansinha69@gmail.com',
            internalScore: 15,
            comments: 'Number nhi dega',
            teacherId: '65900f84e771e0a80148ed70',
          },
          {
            id: '6591aafe45c2b626d34b3b50',
            rating: 5,
            commentedBy: '2206340@kiit.ac.in',
            internalScore: 25,
            comments:
              'Bhai aankh band kr k paper check kr deta h not in a good sense like tmhare answers shi h to b 0 de dega kyuki vo check hi nhi krta',
            teacherId: '65900f84e771e0a80148ed70',
          },
          {
            id: '6591ab5145c2b626d34b3b51',
            rating: 1,
            commentedBy: '2206340@kiit.ac.in',
            internalScore: 25,
            comments:
              'Bhai aankh band kr k paper check krega not in a good sense. Shi answer pe bhi 0 de dega kyuki vo paper check hi nhi krta',
            teacherId: '65900f84e771e0a80148ed70',
          },
        ],
      },
      {
        name: 'Dr. Minakhi Rout',
        likes: 13,
        dislikes: 26,
        reviews: [
          {
            id: '659383ba45c2b626d34b3b65',
            rating: 1,
            commentedBy: '2206188@kiit.ac.in',
            internalScore: 19,
            comments:
              "very arrogant and she taught in a bookish manner, doesn't give internal marks or take any defaulter test/quiz ",
            teacherId: '65900f84e771e0a80148ed74',
          },
          {
            id: '65df61760fb947f5b25481d8',
            rating: 1,
            commentedBy: '2205333@kiit.ac.in',
            internalScore: 20,
            comments:
              "She's so sadistic, gives marks on her mood. Way too biased ",
            teacherId: '65900f84e771e0a80148ed74',
          },
        ],
      },
      {
        name: 'Dr. Suman Sarkar',
        likes: 24,
        dislikes: 5,
        reviews: [
          {
            id: '659029e945c2b626d34b3af3',
            rating: 5,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments: 'gives excellent marks; teaches pretty well',
            teacherId: '65900f84e771e0a80148ed75',
          },
        ],
      },
      {
        name: 'Dr. Abhijit Sutradhar',
        likes: 5,
        dislikes: 2,
        reviews: [],
      },
      {
        name: 'Prof. P. Biswal',
        likes: 14,
        dislikes: 1,
        reviews: [
          {
            id: '6590404945c2b626d34b3b17',
            rating: 5,
            commentedBy: '22053994@kiit.ac.in',
            internalScore: 29,
            comments: 'very good',
            teacherId: '65900f84e771e0a80148ed78',
          },
        ],
      },
      {
        name: 'Mr. Rohit Kumar Tiwari',
        likes: 16,
        dislikes: 14,
        reviews: [],
      },
      {
        name: 'Dr. Bapuji Sahoo',
        likes: 18,
        dislikes: 18,
        reviews: [
          {
            id: '65901b0f45c2b626d34b3abf',
            rating: 5,
            commentedBy: '22051077@kiit.ac.in',
            internalScore: 30,
            comments:
              "Major positive points are\nIsn't strict in terms of attendance\nTeaches well\nGives good internals to almost everyone ",
            teacherId: '65900f84e771e0a80148ed76',
          },
          {
            id: '65901df945c2b626d34b3ad1',
            rating: 5,
            commentedBy: '2205954@kiit.ac.in',
            internalScore: 30,
            comments:
              'Best teacher full marks in internals and no issue with attendence everyone got 95%',
            teacherId: '65900f84e771e0a80148ed76',
          },
          {
            id: '659076fd45c2b626d34b3b2f',
            rating: 5,
            commentedBy: '2205046@kiit.ac.in',
            internalScore: 29,
            comments:
              'attendance ko leke koi tension nhi hai, marks bhi bohot achhe dete hain, agar thoda bhi aayega toh achha mil jayega',
            teacherId: '65900f84e771e0a80148ed76',
          },
        ],
      },
      {
        name: 'Dr. Subarna  Bhattacharya',
        likes: 4,
        dislikes: 6,
        reviews: [],
      },
      {
        name: 'Mr. Sampriti Soor',
        likes: 10,
        dislikes: 8,
        reviews: [
          {
            id: '6590fa6545c2b626d34b3b3d',
            rating: 1,
            commentedBy: '22052843@kiit.ac.in',
            internalScore: 20,
            comments:
              'Sirf re be tum tam karna aata hai, mithi baatein aur low internals inki khoobi hai',
            teacherId: '65900f84e771e0a80148ed77',
          },
        ],
      },
      {
        name: 'Mr. Vishal Meena',
        likes: 12,
        dislikes: 6,
        reviews: [],
      },
      {
        name: 'Mr. Sankalp Nayak',
        likes: 3,
        dislikes: 31,
        reviews: [
          {
            id: '659057ce45c2b626d34b3b27',
            rating: 1,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 20,
            comments:
              'Not recommended at all. 17-18 was the average internal marks',
            teacherId: '65900f84e771e0a80148ed7c',
          },
        ],
      },
      {
        name: 'Dr. Arjun Kumar Paul',
        likes: 22,
        dislikes: 3,
        reviews: [
          {
            id: '6590204c45c2b626d34b3ad9',
            rating: 5,
            commentedBy: 'khaitanharsh08@gmail.com',
            internalScore: 30,
            comments:
              "Best teacher, doesn't take full attendance,easy proxy, gives you full marks if you score good marks in central quiz and submit all assignments. Very polite teacker",
            teacherId: '65900f84e771e0a80148ed7b',
          },
        ],
      },
      {
        name: 'Mr. Sunil Kumar Gouda',
        likes: 19,
        dislikes: 1,
        reviews: [
          {
            id: '65901d2a45c2b626d34b3acc',
            rating: 5,
            commentedBy: '21051394@kiit.ac.in',
            internalScore: 25,
            comments: 'Good teacher and gives good marks.',
            teacherId: '65900f84e771e0a80148ed7d',
          },
        ],
      },
      {
        name: 'Dr. Pradeep Kumar Mallick',
        likes: 28,
        dislikes: 12,
        reviews: [
          {
            id: '65901bad45c2b626d34b3ac2',
            rating: 5,
            commentedBy: '22053306@kiit.ac.in',
            internalScore: 29,
            comments: 'Nicee',
            teacherId: '65900f84e771e0a80148ed81',
          },
          {
            id: '65912ade45c2b626d34b3b42',
            rating: 5,
            commentedBy: '21052449@kiit.ac.in',
            internalScore: 29,
            comments: 'Great teacher',
            teacherId: '65900f84e771e0a80148ed81',
          },
        ],
      },
      {
        name: 'Dr. M. M. Acharya',
        likes: 14,
        dislikes: 2,
        reviews: [],
      },
      {
        name: 'Dr. Avinash Chaudhary',
        likes: 6,
        dislikes: 0,
        reviews: [],
      },
      {
        name: 'Dr. Krishnandu Hazra',
        likes: 4,
        dislikes: 22,
        reviews: [],
      },
      {
        name: 'Dr. Arijit Patra',
        likes: 20,
        dislikes: 1,
        reviews: [
          {
            id: '65901bc545c2b626d34b3ac3',
            rating: 5,
            commentedBy: '22052975@kiit.ac.in',
            internalScore: 29,
            comments: 'Best',
            teacherId: '65900f84e771e0a80148ed82',
          },
          {
            id: '6596913f45c2b626d34b3c07',
            rating: 5,
            commentedBy: '22053055@kiit.ac.in',
            internalScore: 28,
            comments:
              "GOD\nHe's man of a kind, jus maintain a decent attendance , play ML in his class or doze off np...marks toh bhhar k denge likh k lelo",
            teacherId: '65900f84e771e0a80148ed82',
          },
        ],
      },
      {
        name: 'Dr. Arghya Kundu',
        likes: 6,
        dislikes: 11,
        reviews: [
          {
            id: '6590204045c2b626d34b3ad8',
            rating: 1,
            commentedBy: 'imamansinha69@gmail.com',
            internalScore: 28,
            comments: 'Mt lena isko kabhi bhool kr bhi',
            teacherId: '65900f84e771e0a80148ed84',
          },
        ],
      },
      {
        name: 'Mr. Prasenjit Maiti',
        likes: 30,
        dislikes: 0,
        reviews: [],
      },
      {
        name: 'Ms. Sarita Mishra',
        likes: 16,
        dislikes: 1,
        reviews: [
          {
            id: '65903d8645c2b626d34b3b14',
            rating: 5,
            commentedBy: '2128034@kiit.ac.in',
            internalScore: 28,
            comments: 'BEST.',
            teacherId: '65900f84e771e0a80148ed88',
          },
        ],
      },
      {
        name: 'Dr. Saikat Chakraborty',
        likes: 11,
        dislikes: 21,
        reviews: [
          {
            id: '65902a6245c2b626d34b3af8',
            rating: 1,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments: 'does NOT teach at all!',
            teacherId: '65900f84e771e0a80148ed85',
          },
          {
            id: '65904da445c2b626d34b3b21',
            rating: 1,
            commentedBy: '2105974@kiit.ac.in',
            internalScore: 18,
            comments: 'Bohot test leta h ',
            teacherId: '65900f84e771e0a80148ed85',
          },
        ],
      },
      {
        name: 'Mr. Ajit Kumar Pasayat',
        likes: 23,
        dislikes: 1,
        reviews: [
          {
            id: '65903db845c2b626d34b3b15',
            rating: 5,
            commentedBy: '2128034@kiit.ac.in',
            internalScore: 25,
            comments:
              'BEST PERSON, FULL SUPPORT TO STUDENTS AND EXTREMELY STUDENT FRIENDLY\n',
            teacherId: '65900f84e771e0a80148ed8a',
          },
        ],
      },
      {
        name: 'Dr. Monideepa Roy',
        likes: 10,
        dislikes: 16,
        reviews: [
          {
            id: '65901aed45c2b626d34b3abe',
            rating: 5,
            commentedBy: 'tpiyush2626@gmail.com',
            internalScore: 27,
            comments: 'very good',
            teacherId: '65900f84e771e0a80148ed8c',
          },
        ],
      },
      {
        name: 'Mrs. Naliniprava Behera',
        likes: 51,
        dislikes: 0,
        reviews: [
          {
            id: '6590580145c2b626d34b3b28',
            rating: 5,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 29,
            comments: 'Best faculty of OOP',
            teacherId: '65900f84e771e0a80148ed89',
          },
        ],
      },
      {
        name: 'Ms. Swagatika Sahoo',
        likes: 11,
        dislikes: 15,
        reviews: [
          {
            id: '6593ee8e45c2b626d34b3b6f',
            rating: 5,
            commentedBy: '2205045@kiit.ac.in',
            internalScore: 26,
            comments: 'Afl',
            teacherId: '65900f84e771e0a80148ed86',
          },
        ],
      },
      {
        name: 'Dr. Kumar Surjeet Chaudhury',
        likes: 10,
        dislikes: 8,
        reviews: [],
      },
      {
        name: 'Dr. Sriparna Roy Ghatak',
        likes: 3,
        dislikes: 6,
        reviews: [],
      },
      {
        name: 'Dr. Pratyusa Mukherjee',
        likes: 27,
        dislikes: 16,
        reviews: [
          {
            id: '6590309b45c2b626d34b3b07',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 28,
            comments:
              'Maintain attendence and she will conduct only 2 tests premid and post mid and whatever you get in test that will be your internal and tests questions are from whatever she taught in the class',
            teacherId: '65900f84e771e0a80148ed8d',
          },
        ],
      },
      {
        name: 'Dr. S. Chaudhuri',
        likes: 12,
        dislikes: 0,
        reviews: [],
      },
      {
        name: 'Prof. Shruti',
        likes: 10,
        dislikes: 31,
        reviews: [
          {
            id: '65902c2e45c2b626d34b3b00',
            rating: 1,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 12,
            comments:
              'neither teaches, nor gives marks -- be it internal or sem exams; highest internal score from our sec was about 27-29/50',
            teacherId: '65900f84e771e0a80148ed8e',
          },
          {
            id: '6593fc3845c2b626d34b3b71',
            rating: 1,
            commentedBy: '22052221@kiit.ac.in',
            internalScore: 32,
            comments: ' ',
            teacherId: '65900f84e771e0a80148ed8e',
          },
        ],
      },
      {
        name: 'Dr. Arup Abhinna Acharya',
        likes: 36,
        dislikes: 18,
        reviews: [
          {
            id: '65902b5445c2b626d34b3afd',
            rating: 5,
            commentedBy: '2105366@kiit.ac.in',
            internalScore: 28,
            comments:
              'One of the best teachers in the university, but his quizzes can be brutal at times. ',
            teacherId: '65900f84e771e0a80148ed90',
          },
          {
            id: '65903cd045c2b626d34b3b12',
            rating: 5,
            commentedBy: '22054231@kiit.ac.in',
            internalScore: 28,
            comments: 'teaches well ',
            teacherId: '65900f84e771e0a80148ed90',
          },
          {
            id: '6590582345c2b626d34b3b29',
            rating: 5,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 28,
            comments: 'Highly recommended for DSA',
            teacherId: '65900f84e771e0a80148ed90',
          },
          {
            id: '6594254445c2b626d34b3b75',
            rating: 1,
            commentedBy: '22051815@kiit.ac.in',
            internalScore: 26,
            comments:
              "Teaches very well but doesn't gives marks. Very stringent marking. No step marking and no marks for writing algorithms.",
            teacherId: '65900f84e771e0a80148ed90',
          },
        ],
      },
      {
        name: 'Prof. Pramod Kumar Das',
        likes: 2,
        dislikes: 4,
        reviews: [],
      },
      {
        name: 'Dr. Sujata Swain',
        likes: 42,
        dislikes: 11,
        reviews: [],
      },
      {
        name: 'Dr. Swapnomayee Palit',
        likes: 5,
        dislikes: 3,
        reviews: [],
      },
      {
        name: 'Dr. Subhasis Dash',
        likes: 3,
        dislikes: 10,
        reviews: [
          {
            id: '6590466445c2b626d34b3b1b',
            rating: 4,
            commentedBy: '21051974@kiit.ac.in',
            internalScore: 22,
            comments:
              'more than enough knowledgeable. Sometimes his knowledge goes through the other side of the head, but Qn practiced in the class come in exam. If you have patients  select him it will be very beneficial.',
            teacherId: '65900f84e771e0a80148ed94',
          },
          {
            id: '659072be45c2b626d34b3b2a',
            rating: 1,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 20,
            comments: 'He gives quiz on moodles',
            teacherId: '65900f84e771e0a80148ed94',
          },
        ],
      },
      {
        name: 'Dr. Rajat Kumar Behera',
        likes: 6,
        dislikes: 27,
        reviews: [
          {
            id: '6590733545c2b626d34b3b2b',
            rating: 1,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 15,
            comments: 'He is the worst teacher you can get.',
            teacherId: '65900f84e771e0a80148ed96',
          },
        ],
      },
      {
        name: 'Dr. Rajdeep Chatterjee',
        likes: 22,
        dislikes: 2,
        reviews: [
          {
            id: '65902c7545c2b626d34b3b02',
            rating: 5,
            commentedBy: '21052882@kiit.ac.in',
            internalScore: 30,
            comments:
              'Bhai GOD inshaan hai. Muh pe phek ke marks dete hain. Koi bhi subject me le lo full marks milega.',
            teacherId: '65900f84e771e0a80148ed95',
          },
        ],
      },
      {
        name: 'Mr. Harish Kumar Patnaik',
        likes: 8,
        dislikes: 24,
        reviews: [
          {
            id: '65901b1345c2b626d34b3ac0',
            rating: 1,
            commentedBy: 'tpiyush2626@gmail.com',
            internalScore: 17,
            comments: 'dont take him',
            teacherId: '65900f84e771e0a80148ed97',
          },
          {
            id: '6595002745c2b626d34b3ba4',
            rating: 1,
            commentedBy: '2228089@kiit.ac.in',
            internalScore: 19,
            comments: 'comes late to class and discuss 1 code and leave',
            teacherId: '65900f84e771e0a80148ed97',
          },
        ],
      },
      {
        name: 'Dr. Junali Jasmine Jena',
        likes: 4,
        dislikes: 39,
        reviews: [],
      },
      {
        name: 'Dr. Tanmoy Maitra',
        likes: 3,
        dislikes: 20,
        reviews: [
          {
            id: '65901c3645c2b626d34b3ac7',
            rating: 5,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 29,
            comments:
              'Good knowledge, teaches very well..if you make notes of his class that will be more than enough. Just study that before exams nothing else. Friendly',
            teacherId: '65900f84e771e0a80148ed98',
          },
          {
            id: '6590737245c2b626d34b3b2c',
            rating: 1,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 20,
            comments: 'He is strict.',
            teacherId: '65900f84e771e0a80148ed98',
          },
        ],
      },
      {
        name: 'Dr. Santosh Kumar Baliarsingh',
        likes: 13,
        dislikes: 17,
        reviews: [
          {
            id: '65901de545c2b626d34b3ad0',
            rating: 2,
            commentedBy: '22054339@kiit.ac.in',
            internalScore: 22,
            comments:
              "Doesn't give much internal mark and very tight copy check in exams...",
            teacherId: '65900f84e771e0a80148ed9b',
          },
          {
            id: '659027e445c2b626d34b3aee',
            rating: 5,
            commentedBy: '2105672@kiit.ac.in',
            internalScore: 28,
            comments:
              "If you want to actually learn something , then he's one of the best teachers.",
            teacherId: '65900f84e771e0a80148ed9b',
          },
        ],
      },
      {
        name: 'Dr. Banishree Misra',
        likes: 4,
        dislikes: 6,
        reviews: [
          {
            id: '6590e3a345c2b626d34b3b39',
            rating: 5,
            commentedBy: '22051322@kiit.ac.in',
            internalScore: 29,
            comments: 'Good',
            teacherId: '65900f84e771e0a80148ed9a',
          },
        ],
      },
      {
        name: 'Dr. Arpita Goswami',
        likes: 26,
        dislikes: 5,
        reviews: [],
      },
      {
        name: 'Prof.  K. B. Ray',
        likes: 19,
        dislikes: 18,
        reviews: [
          {
            id: '65902ea945c2b626d34b3b04',
            rating: 5,
            commentedBy: '2205715@kiit.ac.in',
            internalScore: 29,
            comments: 'Very good teacher',
            teacherId: '65900f84e771e0a80148ed9d',
          },
        ],
      },
      {
        name: 'Dr. Jayanta Mondal',
        likes: 19,
        dislikes: 1,
        reviews: [
          {
            id: '65904eb645c2b626d34b3b24',
            rating: 5,
            commentedBy: '2105860@kiit.ac.in',
            internalScore: 30,
            comments: ' ',
            teacherId: '65900f84e771e0a80148ed9e',
          },
        ],
      },
      {
        name: 'Mr. Chandra Shekhar',
        likes: 26,
        dislikes: 3,
        reviews: [],
      },
      {
        name: 'Dr. Chittaranjan Pradhan',
        likes: 44,
        dislikes: 8,
        reviews: [
          {
            id: '659046e345c2b626d34b3b1c',
            rating: 4,
            commentedBy: '21051974@kiit.ac.in',
            internalScore: 26,
            comments:
              'accha padhate hai , sare unhi k ppt distribute hote hai to khudhi samajh lo.',
            teacherId: '65900f85e771e0a80148eda0',
          },
          {
            id: '6590dba045c2b626d34b3b32',
            rating: 5,
            commentedBy: '22052950@kiit.ac.in',
            internalScore: 29,
            comments: 'Very good teacher ',
            teacherId: '65900f85e771e0a80148eda0',
          },
        ],
      },
      {
        name: 'Mr. N. Biraja Isac',
        likes: 19,
        dislikes: 19,
        reviews: [
          {
            id: '659029fc45c2b626d34b3af5',
            rating: 5,
            commentedBy: '2105366@kiit.ac.in',
            internalScore: 30,
            comments:
              'Hare Krishna Hare Ram Krishna Krishna Hare Hare 🙏🙏🛐🛐',
            teacherId: '65900f85e771e0a80148eda1',
          },
        ],
      },
      {
        name: 'Dr. Ranjeeta Patel',
        likes: 5,
        dislikes: 1,
        reviews: [],
      },
      {
        name: 'Ms. Mamita Dash',
        likes: 20,
        dislikes: 6,
        reviews: [
          {
            id: '65902c6645c2b626d34b3b01',
            rating: 4,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments: 'good teacher',
            teacherId: '65900f85e771e0a80148eda3',
          },
          {
            id: '6590479745c2b626d34b3b1d',
            rating: 5,
            commentedBy: '21051974@kiit.ac.in',
            internalScore: 28,
            comments:
              'strict but provide very good notes. Good teacher . Provide deserving marks ',
            teacherId: '65900f85e771e0a80148eda3',
          },
          {
            id: '6590741745c2b626d34b3b2d',
            rating: 5,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 30,
            comments: 'Very good teacher',
            teacherId: '65900f85e771e0a80148eda3',
          },
          {
            id: '6592dd6145c2b626d34b3b58',
            rating: 1,
            commentedBy: '22052317@kiit.ac.in',
            internalScore: 22,
            comments: 'Pura PPT class mai likhwati hai ',
            teacherId: '65900f85e771e0a80148eda3',
          },
        ],
      },
      {
        name: 'Dr. Bhabani Shankar Prasad Mishra',
        likes: 14,
        dislikes: 15,
        reviews: [],
      },
      {
        name: 'Dr. Kartikeswar Mahalik',
        likes: 4,
        dislikes: 10,
        reviews: [],
      },
      {
        name: 'Dr. Satya Champati Rai',
        likes: 14,
        dislikes: 3,
        reviews: [
          {
            id: '659021a345c2b626d34b3adc',
            rating: 4,
            commentedBy: 'khaitanharsh08@gmail.com',
            internalScore: 23,
            comments:
              'Give internals based on knowledge. I will highly recommend this teacher because teacher is very nice. Even if you get low internals, you will learn something for sure. Very sweet teacher. No partiality.',
            teacherId: '65900f85e771e0a80148eda7',
          },
        ],
      },
      {
        name: 'Dr. Santwana Sagnika',
        likes: 29,
        dislikes: 0,
        reviews: [],
      },
      {
        name: 'Dr. Ramesh Kumar Thakur',
        likes: 34,
        dislikes: 1,
        reviews: [
          {
            id: '65902a2645c2b626d34b3af6',
            rating: 5,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 30,
            comments: 'best faculty in whole kiit university',
            teacherId: '65900f85e771e0a80148eda8',
          },
          {
            id: '65902a7445c2b626d34b3af9',
            rating: 5,
            commentedBy: '2105366@kiit.ac.in',
            internalScore: 30,
            comments:
              'Teaching is below average but otherwise an absolute amazing person. ❣️',
            teacherId: '65900f85e771e0a80148eda8',
          },
          {
            id: '65aca35b870bee50deeccbea',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 30,
            comments: 'Best Teacher of It',
            teacherId: '65900f85e771e0a80148eda8',
          },
          {
            id: '65aca3ab870bee50deeccbeb',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 29,
            comments: 'Nice Professor',
            teacherId: '65900f85e771e0a80148eda8',
          },
        ],
      },
      {
        name: 'Prof. P. Dutta',
        likes: 8,
        dislikes: 0,
        reviews: [
          {
            id: '6592e44845c2b626d34b3b5a',
            rating: 4,
            commentedBy: '2206348@kiit.ac.in',
            internalScore: 28,
            comments:
              'Gave marks even to students who barely submitted assignments',
            teacherId: '65900f85e771e0a80148eda9',
          },
        ],
      },
      {
        name: 'Dr. Manoj Kumar Mishra',
        likes: 8,
        dislikes: 2,
        reviews: [],
      },
      {
        name: 'Dr. Mohit Ranjan Panda',
        likes: 19,
        dislikes: 11,
        reviews: [
          {
            id: '65904dea45c2b626d34b3b22',
            rating: 4,
            commentedBy: '2105974@kiit.ac.in',
            internalScore: 26,
            comments: 'Number acha de dega',
            teacherId: '65900f85e771e0a80148edab',
          },
        ],
      },
      {
        name: 'Dr. Manas Ranjan Lenka',
        likes: 10,
        dislikes: 43,
        reviews: [
          {
            id: '65901e3145c2b626d34b3ad3',
            rating: 4,
            commentedBy: '21052168@kiit.ac.in',
            internalScore: 21,
            comments: 'Knowledgeable and nice teaching but very strict ',
            teacherId: '65900f85e771e0a80148edad',
          },
          {
            id: '6592cf4c45c2b626d34b3b57',
            rating: 1,
            commentedBy: '22052080@kiit.ac.in',
            internalScore: 17,
            comments: 'ek toh marks nahi diya upar se ghar pe call kar diya',
            teacherId: '65900f85e771e0a80148edad',
          },
        ],
      },
      {
        name: 'Dr. Banchhanidhi Dash',
        likes: 33,
        dislikes: 15,
        reviews: [],
      },
      {
        name: 'Mr. Sohail Khan',
        likes: 12,
        dislikes: 4,
        reviews: [],
      },
      {
        name: 'Dr. Kalyani Mohanta',
        likes: 5,
        dislikes: 1,
        reviews: [],
      },
      {
        name: 'Prof. Bikash Kumar Behera',
        likes: 8,
        dislikes: 9,
        reviews: [],
      },
      {
        name: 'Dr. Suresh Chandra Satapathy',
        likes: 13,
        dislikes: 10,
        reviews: [],
      },
      {
        name: 'Prof. Sunil Kr. Mishra',
        likes: 8,
        dislikes: 3,
        reviews: [],
      },
      {
        name: 'Ms. Mandakini Priyadarshani Behera',
        likes: 5,
        dislikes: 25,
        reviews: [
          {
            id: '65903c8545c2b626d34b3b10',
            rating: 1,
            commentedBy: '2205421@kiit.ac.in',
            internalScore: 24,
            comments:
              "Has no knowledge of the subject herself. Complete bookish knowledge and can't understand shit if you use your own brain and write a code which does not match the one taught in class. Has very poor idea of the subject.",
            teacherId: '65900f85e771e0a80148edb7',
          },
          {
            id: '659155b345c2b626d34b3b4b',
            rating: 1,
            commentedBy: '22052895@kiit.ac.in',
            internalScore: 25,
            comments:
              'kuch nahi aata usko, sahi likha answer bhi kata ke 0 kar degi , na internal deti hai nahi paper checking me',
            teacherId: '65900f85e771e0a80148edb7',
          },
        ],
      },
      {
        name: 'Dr. Suchismita Das',
        likes: 12,
        dislikes: 5,
        reviews: [],
      },
      {
        name: 'Dr. Amiya Ranjan Panda',
        likes: 26,
        dislikes: 8,
        reviews: [
          {
            id: '6590351045c2b626d34b3b0c',
            rating: 1,
            commentedBy: '22052643@kiit.ac.in',
            internalScore: 23,
            comments:
              'padhata bahut achha hai , lekin marks lana tough hai aur intenal mein bahut kharap marks deta even if you top in mid semester exam',
            teacherId: '65900f85e771e0a80148edb6',
          },
          {
            id: '65904e1445c2b626d34b3b23',
            rating: 4,
            commentedBy: '2105974@kiit.ac.in',
            internalScore: 24,
            comments:
              'Tension ni dega semester me...number bhi thik thaak de dega',
            teacherId: '65900f85e771e0a80148edb6',
          },
          {
            id: '6590efb645c2b626d34b3b3a',
            rating: 5,
            commentedBy: '22052634@kiit.ac.in',
            internalScore: 25,
            comments:
              "As a teacher, he's a very good one. Doesn't care much about the attendance and is'nt strict at all",
            teacherId: '65900f85e771e0a80148edb6',
          },
        ],
      },
      {
        name: 'Dr. Sudeshna Datta Chaudhuri',
        likes: 9,
        dislikes: 5,
        reviews: [],
      },
      {
        name: 'Dr. Laxmipriya Nayak',
        likes: 180,
        dislikes: 11,
        reviews: [
          {
            id: '659026f145c2b626d34b3ae5',
            rating: 5,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 30,
            comments: 'best',
            teacherId: '65900f85e771e0a80148edb5',
          },
          {
            id: '65904d6745c2b626d34b3b20',
            rating: 5,
            commentedBy: '22054430@kiit.ac.in',
            internalScore: 30,
            comments: 'if we want good mark then select.\n',
            teacherId: '65900f85e771e0a80148edb5',
          },
        ],
      },
      {
        name: 'Dr. Partha Sarathi Paul',
        likes: 10,
        dislikes: 9,
        reviews: [
          {
            id: '65902d7845c2b626d34b3b03',
            rating: 1,
            commentedBy: '21052882@kiit.ac.in',
            internalScore: 19,
            comments:
              'Bhai inko dekh k hi neend aa jaati hai. Tumhara answer jaisha bhi ho, agar answer script se match nhi kiya to marks nhi milega, step marks to bhul jao. ',
            teacherId: '65900f85e771e0a80148edb8',
          },
        ],
      },
      {
        name: 'Prof. Ruby Mishra',
        likes: 6,
        dislikes: 2,
        reviews: [],
      },
      {
        name: 'Mr. Nayan Kumar S. Behera',
        likes: 26,
        dislikes: 9,
        reviews: [
          {
            id: '6590362745c2b626d34b3b0d',
            rating: 5,
            commentedBy: 'gupta.ayush.kiit@gmail.com',
            internalScore: 25,
            comments: '28',
            teacherId: '65900f85e771e0a80148edbb',
          },
          {
            id: '6593a79045c2b626d34b3b68',
            rating: 2,
            commentedBy: '22052768@kiit.ac.in',
            internalScore: 23,
            comments:
              "Doesn't teach good, also gave very bad marks in internal to everyone in the class\n",
            teacherId: '65900f85e771e0a80148edbb',
          },
        ],
      },
      {
        name: 'Mr. Tanik Saikh',
        likes: 6,
        dislikes: 21,
        reviews: [
          {
            id: '659025fb45c2b626d34b3ae2',
            rating: 1,
            commentedBy: '22052705@kiit.ac.in',
            internalScore: 23,
            comments:
              'Not recommended... \nteaching skill is very poor..\nBohot bolne ke bad itna internal marks mila..\nQuiz viva sab cls me paper me le raha tha..\nLekin kuch padhana nahi ata he ..\nKuch bhi samjh nahi aya',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '6590270e45c2b626d34b3ae8',
            rating: 1,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 21,
            comments: 'worst',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '6590d83d45c2b626d34b3b31',
            rating: 1,
            commentedBy: '22053724@kiit.ac.in',
            internalScore: 26,
            comments: 'If you wanna fail go ahead',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '6590f44d45c2b626d34b3b3b',
            rating: 5,
            commentedBy: '22051204@kiit.ac.in',
            internalScore: 28,
            comments:
              'Sir padhata nhi hai utna achha, par unka notes bohot useful hai.',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '659160de45c2b626d34b3b4c',
            rating: 3,
            commentedBy: '22052367@kiit.ac.in',
            internalScore: 30,
            comments:
              'Sare quiz, written tests offline with surprise tests. Kaafi important cheezien miss kar denge aur number bhi nahi denge.(Mera paper copy karne wale ko (dusra section) 32/40 aur mujhe 13/40(no grace marks for topics not covered in class). Attendance theek rakhoge toh thoda easy rahega',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '65926e2945c2b626d34b3b55',
            rating: 2,
            commentedBy: '22053675@kiit.ac.in',
            internalScore: 26,
            comments:
              'The worst teacher in kiit inko liya toh marks bhul jayo, padhate bhi bahat kharab hain, internals v nahi dete bahat mushkil se internals mein thoda badhaya ',
            teacherId: '65900f85e771e0a80148edbd',
          },
        ],
      },
      {
        name: 'Mr. A Ranjith',
        likes: 10,
        dislikes: 7,
        reviews: [
          {
            id: '65902bf345c2b626d34b3aff',
            rating: 5,
            commentedBy: '21051584@kiit.ac.in',
            internalScore: 29,
            comments: 'Very good teacher',
            teacherId: '65900f85e771e0a80148edb9',
          },
        ],
      },
      {
        name: 'Dr. Smrutirekha Mohanty',
        likes: 20,
        dislikes: 7,
        reviews: [],
      },
      {
        name: 'Dr. Kumar Devadutta',
        likes: 22,
        dislikes: 10,
        reviews: [
          {
            id: '65901c1645c2b626d34b3ac5',
            rating: 5,
            commentedBy: '21052500@kiit.ac.in',
            internalScore: 29,
            comments:
              'Teaches well, also if you have attendance, you can score full in internals. ',
            teacherId: '65900f85e771e0a80148edbe',
          },
        ],
      },
      {
        name: 'Prof. Swati Swayamsiddha',
        likes: 14,
        dislikes: 1,
        reviews: [],
      },
      {
        name: 'Dr. Vishal Pradhan',
        likes: 25,
        dislikes: 1,
        reviews: [
          {
            id: '6590348045c2b626d34b3b0b',
            rating: 4,
            commentedBy: '22052643@kiit.ac.in',
            internalScore: 27,
            comments: 'Great teaching style.\n',
            teacherId: '65900f85e771e0a80148edbf',
          },
          {
            id: '65930cff45c2b626d34b3b62',
            rating: 5,
            commentedBy: '22052042@kiit.ac.in',
            internalScore: 30,
            comments: 'bestttttttt',
            teacherId: '65900f85e771e0a80148edbf',
          },
        ],
      },
      {
        name: 'Mr. Arup Sarkar',
        likes: 16,
        dislikes: 15,
        reviews: [
          {
            id: '65901cc745c2b626d34b3ac8',
            rating: 4,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 30,
            comments: 'Extremely linent. Bharke marks dega…',
            teacherId: '65900f85e771e0a80148edc3',
          },
          {
            id: '65901d0045c2b626d34b3aca',
            rating: 5,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 30,
            comments:
              'Marks dega. Lekin classes bohot boring honge..Friendly bhi ha',
            teacherId: '65900f85e771e0a80148edc3',
          },
        ],
      },
      {
        name: 'Ms. Priyanka Roy',
        likes: 6,
        dislikes: 48,
        reviews: [
          {
            id: '6591638b45c2b626d34b3b4d',
            rating: 1,
            commentedBy: '22054085@kiit.ac.in',
            internalScore: -2,
            comments: 'worst',
            teacherId: '65900f85e771e0a80148edc2',
          },
        ],
      },
      {
        name: 'Prof. Niten Kumar Panda',
        likes: 4,
        dislikes: 1,
        reviews: [],
      },
      {
        name: 'Dr. Manas Ranjan Mohapatra',
        likes: 5,
        dislikes: 3,
        reviews: [],
      },
      {
        name: 'Mr. Abinas Panda',
        likes: 14,
        dislikes: 8,
        reviews: [
          {
            id: '6590423045c2b626d34b3b18',
            rating: 3,
            commentedBy: '22051807@kiit.ac.in',
            internalScore: 20,
            comments:
              'Internal ma marks nahi deta baki sa thik ha aur har hafta quize ya classe test leta ha .',
            teacherId: '65900f85e771e0a80148edc5',
          },
        ],
      },
      {
        name: 'Prof. Anil Kumar Behera',
        likes: 6,
        dislikes: 2,
        reviews: [
          {
            id: '6590223745c2b626d34b3ade',
            rating: 5,
            commentedBy: 'khaitanharsh08@gmail.com',
            internalScore: 30,
            comments:
              'Will give you andha dun marks on paper and teacher. Very young teacher, toh memes se joke bhi karta hai, aur acha khasa roast karega toh be alert',
            teacherId: '65900f85e771e0a80148edc6',
          },
        ],
      },
      {
        name: 'Dr. Swayam B Mishra',
        likes: 4,
        dislikes: 0,
        reviews: [
          {
            id: '6590371445c2b626d34b3b0e',
            rating: 3,
            commentedBy: '2205177@kiit.ac.in',
            internalScore: 26,
            comments:
              'average teacher, just reads out the PPts, roams in the class while doing so',
            teacherId: '65900f85e771e0a80148edc7',
          },
        ],
      },
      {
        name: 'Dr. Manoranjan Sahoo',
        likes: 27,
        dislikes: 12,
        reviews: [
          {
            id: '6592f5c145c2b626d34b3b5b',
            rating: 4,
            commentedBy: '2205628@kiit.ac.in',
            internalScore: 28,
            comments:
              'Very good teacher, explains well, gives good internals. Only one thing is that never use phone in his class or you are gone!',
            teacherId: '65900f85e771e0a80148edc8',
          },
          {
            id: '6592f5c145c2b626d34b3b5c',
            rating: 4,
            commentedBy: '2205628@kiit.ac.in',
            internalScore: 28,
            comments:
              'Very good teacher, explains well, gives good internals. Only one thing is that never use phone in his class or you are gone!',
            teacherId: '65900f85e771e0a80148edc8',
          },
        ],
      },
      {
        name: 'Mrs. Meghana G Raj',
        likes: 6,
        dislikes: 33,
        reviews: [
          {
            id: '65901f2045c2b626d34b3ad5',
            rating: 1,
            commentedBy: '21052168@kiit.ac.in',
            internalScore: 21,
            comments:
              "Very strict and does not tolerate any indiscipline or even a little bit of disrespectful behaviour such as yawning in her class. Will punish the whole class if any student does the above mentioned thing. Doesn't provide notes, strict marking as if she wants u to fail. ",
            teacherId: '65900f85e771e0a80148edc9',
          },
          {
            id: '65902b4645c2b626d34b3afc',
            rating: 1,
            commentedBy: '21052859@kiit.ac.in',
            internalScore: 18,
            comments:
              'Very strict, won’t give you marks either. Strictly Avoid!',
            teacherId: '65900f85e771e0a80148edc9',
          },
          {
            id: '6590e0b945c2b626d34b3b38',
            rating: 1,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 18,
            comments: 'try to avoid her',
            teacherId: '65900f85e771e0a80148edc9',
          },
        ],
      },
      {
        name: 'Dr. Prasant Kumar Pattnaik',
        likes: 11,
        dislikes: 0,
        reviews: [
          {
            id: '65902bc145c2b626d34b3afe',
            rating: 5,
            commentedBy: '21052859@kiit.ac.in',
            internalScore: 28,
            comments:
              'Excellent teacher, teaching in normal but if you want marks, he is the one. Very cool teacher and you can also do projects under hime in future.',
            teacherId: '65900f85e771e0a80148edcb',
          },
        ],
      },
      {
        name: 'Ms. Krutika Verma',
        likes: 6,
        dislikes: 27,
        reviews: [],
      },
      {
        name: 'Dr. Sudipta Kumar Ghosh',
        likes: 9,
        dislikes: 8,
        reviews: [
          {
            id: '6594477045c2b626d34b3b78',
            rating: 4,
            commentedBy: '22052832@kiit.ac.in',
            internalScore: 25,
            comments: 'badhiya understanding teacher hai',
            teacherId: '65900f85e771e0a80148edca',
          },
        ],
      },
      {
        name: 'Dr. Utkal Keshari Dutta',
        likes: 38,
        dislikes: 1,
        reviews: [
          {
            id: '659027e045c2b626d34b3aed',
            rating: 5,
            commentedBy: '21053469@kiit.ac.in',
            internalScore: 29,
            comments: 'Best Teacher, for marks as well as in Teaching. ',
            teacherId: '65900f85e771e0a80148edcd',
          },
          {
            id: '6592ddba45c2b626d34b3b59',
            rating: 5,
            commentedBy: '22052317@kiit.ac.in',
            internalScore: 28,
            comments: 'Marks milta hai bohot\n',
            teacherId: '65900f85e771e0a80148edcd',
          },
          {
            id: '6594103445c2b626d34b3b73',
            rating: 5,
            commentedBy: '22051815@kiit.ac.in',
            internalScore: 30,
            comments:
              'Best Maths Teacher in KIIT!! Very much Student Friendly. Gives good marks in internals to everyone. ',
            teacherId: '65900f85e771e0a80148edcd',
          },
        ],
      },
      {
        name: 'Dr. Sarbeswar Mohanty',
        likes: 25,
        dislikes: 2,
        reviews: [],
      },
      {
        name: 'Dr. Partha Pratim Sarangi',
        likes: 30,
        dislikes: 16,
        reviews: [],
      },
      {
        name: 'Dr. Mukesh Kumar',
        likes: 15,
        dislikes: 15,
        reviews: [
          {
            id: '65901d9245c2b626d34b3acd',
            rating: 5,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 30,
            comments:
              'Friendly and class me mazak masti krta rehta ha. Lekin Zyada mt kr dena toh gussa ho jayega lekin baad me phirse has deta ha..Min 27 toh dega hi internals agr sab timely submitted ha toh',
            teacherId: '65900f85e771e0a80148edcf',
          },
        ],
      },
      {
        name: 'Prof. Rachita Panda',
        likes: 6,
        dislikes: 0,
        reviews: [],
      },
      {
        name: 'Dr. Amulya Ratna Swain',
        likes: 49,
        dislikes: 10,
        reviews: [
          {
            id: '65901dc145c2b626d34b3acf',
            rating: 1,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 15,
            comments: 'Bhul se bhi mt lena',
            teacherId: '65900f85e771e0a80148edd1',
          },
        ],
      },
      {
        name: 'Dr. Leena Das',
        likes: 3,
        dislikes: 29,
        reviews: [
          {
            id: '6590e09945c2b626d34b3b37',
            rating: 1,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 15,
            comments: '!!!DANGER!!!',
            teacherId: '65900f86e771e0a80148edd4',
          },
        ],
      },
      {
        name: 'Dr. Ajay Kumar Jena',
        likes: 7,
        dislikes: 17,
        reviews: [
          {
            id: '6590e07645c2b626d34b3b36',
            rating: 4,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 25,
            comments: 'dont know anything but internal meh number deta hai',
            teacherId: '65900f86e771e0a80148edd3',
          },
        ],
      },
      {
        name: 'Dr. Samaresh Mishra',
        likes: 26,
        dislikes: 9,
        reviews: [],
      },
      {
        name: 'Dr. Amalesh Kumar Manna',
        likes: 5,
        dislikes: 3,
        reviews: [],
      },
      {
        name: 'Prof. S. K. Mohapatra',
        likes: 7,
        dislikes: 13,
        reviews: [
          {
            id: '6593a89145c2b626d34b3b69',
            rating: 1,
            commentedBy: '22052768@kiit.ac.in',
            internalScore: 22,
            comments: "Doesn't teach anything, bad marksin midsem also",
            teacherId: '65900f86e771e0a80148edd6',
          },
        ],
      },
      {
        name: 'Dr. Suvendu Barik',
        likes: 21,
        dislikes: 12,
        reviews: [
          {
            id: '6590205445c2b626d34b3ada',
            rating: 3,
            commentedBy: '22053180@kiit.ac.in',
            internalScore: 30,
            comments:
              'Awesome chill teacher.\nGreenest flag ever\nU can trust him blindly ',
            teacherId: '65900f86e771e0a80148eddb',
          },
          {
            id: '6590433345c2b626d34b3b1a',
            rating: 5,
            commentedBy: '22053465@kiit.ac.in',
            internalScore: 30,
            comments: 'Best teacher ever',
            teacherId: '65900f86e771e0a80148eddb',
          },
        ],
      },
      {
        name: 'Mr. R. N. Ramakant Parida',
        likes: 5,
        dislikes: 21,
        reviews: [
          {
            id: '6590274545c2b626d34b3ae9',
            rating: 3,
            commentedBy: '21051041@kiit.ac.in',
            internalScore: 26,
            comments:
              'teaches good \nstrict \nwill give good marks if uh pay attention in class',
            teacherId: '65900f86e771e0a80148edda',
          },
          {
            id: '659074ee45c2b626d34b3b2e',
            rating: 1,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 1530,
            comments:
              'The worst you can have in entire KIIT. Quizes are offline all or nothing. Stay miles away from him.',
            teacherId: '65900f86e771e0a80148edda',
          },
        ],
      },
      {
        name: 'Dr. Santosh Kumar Pani',
        likes: 17,
        dislikes: 1,
        reviews: [
          {
            id: '6592afe245c2b626d34b3b56',
            rating: 5,
            commentedBy: '22051722@kiit.ac.in',
            internalScore: 28,
            comments: 'very chill',
            teacherId: '65900f86e771e0a80148edd9',
          },
          {
            id: '6593edad45c2b626d34b3b6e',
            rating: 5,
            commentedBy: '21052316@kiit.ac.in',
            internalScore: 30,
            comments: 'best teacher in terms of everything',
            teacherId: '65900f86e771e0a80148edd9',
          },
        ],
      },
      {
        name: 'Ms. Benazir Neha',
        likes: 39,
        dislikes: 8,
        reviews: [
          {
            id: '65910eb145c2b626d34b3b40',
            rating: 5,
            commentedBy: '2205919@kiit.ac.in',
            internalScore: 27,
            comments: 'Teaches ok and gives lots of marks.',
            teacherId: '65900f86e771e0a80148edd8',
          },
          {
            id: '65943cf545c2b626d34b3b76',
            rating: 5,
            commentedBy: '22051073@kiit.ac.in',
            internalScore: 27,
            comments:
              'Internal mein bhi theek hi de deti hai but mid sem and end sem mein bhar bhar ke marks milenge and padhati bhi sahi hai kaafi',
            teacherId: '65900f86e771e0a80148edd8',
          },
        ],
      },
      {
        name: 'Prof. Satish Kumar Gannamaneni',
        likes: 11,
        dislikes: 20,
        reviews: [
          {
            id: '6593a8bf45c2b626d34b3b6a',
            rating: 5,
            commentedBy: '2206338@kiit.ac.in',
            internalScore: 27,
            comments:
              'idk why so many dislikes...but marks acha deta hai...expectation se zyada. Han bas thoda strict hai aur paka ta bhi hai.\n',
            teacherId: '65900f86e771e0a80148ede2',
          },
          {
            id: '6594822645c2b626d34b3b7c',
            rating: 4,
            commentedBy: '2206290@kiit.ac.in',
            internalScore: 27,
            comments:
              'Isko class lo Mt lo frk nhi padhta .. bs end mai exam Dene jitni attendance ho .. internal Chadha deta hai sahi aur checking bhi acchi krta hai. Overall theek hai class etiquettes ke bare mai bohot lecture deta hai',
            teacherId: '65900f86e771e0a80148ede2',
          },
        ],
      },
      {
        name: 'Dr. Sourajit Behera',
        likes: 20,
        dislikes: 4,
        reviews: [
          {
            id: '6590276945c2b626d34b3aeb',
            rating: 5,
            commentedBy: '21051041@kiit.ac.in',
            internalScore: 28,
            comments: 'best teacher ever',
            teacherId: '65900f86e771e0a80148ede0',
          },
          {
            id: '6590279445c2b626d34b3aec',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 28,
            comments: 'Chill teacher ever You can go for it',
            teacherId: '65900f86e771e0a80148ede0',
          },
          {
            id: '6594220345c2b626d34b3b74',
            rating: 5,
            commentedBy: '22052610@kiit.ac.in',
            internalScore: 2,
            comments: '1',
            teacherId: '65900f86e771e0a80148ede0',
          },
        ],
      },
      {
        name: 'Mr. Gananath Bhuyan',
        likes: 21,
        dislikes: 9,
        reviews: [
          {
            id: '6590f55f45c2b626d34b3b3c',
            rating: 5,
            commentedBy: '22052843@kiit.ac.in',
            internalScore: 28,
            comments:
              'I know strict teacher hai, but internals dete hai lekin attendance cut kar lete hai, padhate good hai',
            teacherId: '65900f86e771e0a80148eddf',
          },
        ],
      },
      {
        name: 'Dr. Dayal Kumar Behera',
        likes: 20,
        dislikes: 0,
        reviews: [
          {
            id: '6590283345c2b626d34b3aef',
            rating: 4,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 27,
            comments:
              'He will take surprise test in class and if you attend more than 80% and if you just write anything in exam still he gives marks',
            teacherId: '65900f86e771e0a80148eddd',
          },
        ],
      },
      {
        name: 'Dr. Madhusudan Bera',
        likes: 21,
        dislikes: 11,
        reviews: [
          {
            id: '6590e04945c2b626d34b3b35',
            rating: 3,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 20,
            comments: 'if dont have better option then go with him',
            teacherId: '65900f86e771e0a80148edde',
          },
        ],
      },
      {
        name: 'Dr. Abhaya Kumar Sahoo',
        likes: 15,
        dislikes: 1,
        reviews: [
          {
            id: '6590276045c2b626d34b3aea',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 30,
            comments: 'He is just nice',
            teacherId: '65900f86e771e0a80148ede1',
          },
        ],
      },
      {
        name: 'Dr. Nibedan Panda',
        likes: 21,
        dislikes: 9,
        reviews: [],
      },
      {
        name: 'Dr. Subhadip Pramanik',
        likes: 9,
        dislikes: 1,
        reviews: [],
      },
      {
        name: 'Ms. Ipsita Paul',
        likes: 9,
        dislikes: 18,
        reviews: [
          {
            id: '6590221745c2b626d34b3add',
            rating: 1,
            commentedBy: '21051716@kiit.ac.in',
            internalScore: 23,
            comments:
              "She don't clear any doubt. Other than study she can talk about anything. Boys who talk random things and entertain her will got marks not on the basis of talent",
            teacherId: '65900f86e771e0a80148ede5',
          },
          {
            id: '6590270545c2b626d34b3ae7',
            rating: 1,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 25,
            comments: "Worst teacher don't expect from her",
            teacherId: '65900f86e771e0a80148ede5',
          },
          {
            id: '6590e02645c2b626d34b3b34',
            rating: 1,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 18,
            comments: 'bad ',
            teacherId: '65900f86e771e0a80148ede5',
          },
        ],
      },
      {
        name: 'Dr. Dipti Dash',
        likes: 19,
        dislikes: 0,
        reviews: [],
      },
      {
        name: 'Dr. Pinaki Sankar Chatterjee',
        likes: 11,
        dislikes: 16,
        reviews: [],
      },
      {
        name: 'Dr. Raghunath Dey',
        likes: 14,
        dislikes: 2,
        reviews: [
          {
            id: '6590dfff45c2b626d34b3b33',
            rating: 3,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 26,
            comments: 'good teaher linient in marks ',
            teacherId: '65900f88e771e0a80148ede7',
          },
        ],
      },
      {
        name: 'Mr. Sourav Kumar Giri',
        likes: 9,
        dislikes: 1,
        reviews: [],
      },
      {
        name: 'Dr. Anuja Kumar Acharya',
        likes: 18,
        dislikes: 18,
        reviews: [
          {
            id: '65901cdf45c2b626d34b3ac9',
            rating: 3,
            commentedBy: '22051843@kiit.ac.in',
            internalScore: 24,
            comments: 'I would recommend mat lena. Risky sir hai. ',
            teacherId: '65900f83e771e0a80148ed4b',
          },
          {
            id: '65902a7845c2b626d34b3afa',
            rating: 5,
            commentedBy: '21053436@kiit.ac.in',
            internalScore: 30,
            comments:
              'He taught good, gave marks, but when i applied for recheck he never recheked it.',
            teacherId: '65900f83e771e0a80148ed4b',
          },
          {
            id: '6593903f45c2b626d34b3b66',
            rating: 1,
            commentedBy: '2205316@kiit.ac.in',
            internalScore: 20,
            comments: 'unnecessarily strict',
            teacherId: '65900f83e771e0a80148ed4b',
          },
        ],
      },
      {
        name: 'Mr. Sujoy Datta',
        likes: 67,
        dislikes: 17,
        reviews: [
          {
            id: '65901d2145c2b626d34b3acb',
            rating: 5,
            commentedBy: '22054339@kiit.ac.in',
            internalScore: 30,
            comments:
              'You will get good internal marks if ur attendance is decent...',
            teacherId: '65900f83e771e0a80148ed4c',
          },
          {
            id: '659022e045c2b626d34b3adf',
            rating: 5,
            commentedBy: 'donkeyking1856@gmail.com',
            internalScore: 26,
            comments: 'just maintain assignments and attendence\n',
            teacherId: '65900f83e771e0a80148ed4c',
          },
          {
            id: '6591327445c2b626d34b3b44',
            rating: 5,
            commentedBy: '22054341@kiit.ac.in',
            internalScore: 29,
            comments: '\n',
            teacherId: '65900f83e771e0a80148ed4c',
          },
          {
            id: '65931e2945c2b626d34b3b64',
            rating: 5,
            commentedBy: '22052219@kiit.ac.in',
            internalScore: -1,
            comments: 'good teacher, gives decent marks',
            teacherId: '65900f83e771e0a80148ed4c',
          },
        ],
      },
    ];

    const actualFaculties = [
      {
        id: '65a6e829307b55dd84067460',
        name: 'Manas Ranjan Lenka',
      },
      {
        id: '65a6e829307b55dd84067461',
        name: 'M. Nazma B. J. Naskar',
      },
      {
        id: '65a6e829307b55dd84067462',
        name: 'Rajdeep Chatterjee',
      },
      {
        id: '65a6e829307b55dd84067463',
        name: 'Mahendra Kumar Gourisaria',
      },
      {
        id: '65a6e829307b55dd84067464',
        name: 'Partha Pratim Sarangi',
      },
      {
        id: '65a6e829307b55dd84067465',
        name: 'Monideepa Roy',
      },
      {
        id: '65a6e829307b55dd84067466',
        name: 'Pradeep Kandula',
      },
      {
        id: '65a6e829307b55dd84067467',
        name: 'Murari Mandal',
      },
      {
        id: '65a6e829307b55dd84067468',
        name: 'Manjusha Pandey',
      },
      {
        id: '65a6e829307b55dd84067469',
        name: 'Partha Sarathi Paul',
      },
      {
        id: '65a6e829307b55dd8406746a',
        name: 'Lipika Dewangan',
      },
      {
        id: '65a6e829307b55dd8406746b',
        name: 'Rajat Kumar Behera',
      },
      {
        id: '65a6e829307b55dd8406746c',
        name: 'Debashis Hati',
      },
      {
        id: '65a6e829307b55dd8406746d',
        name: 'Harish Kumar Patnaik',
      },
      {
        id: '65a6e829307b55dd8406746e',
        name: 'Suchismita Rout',
      },
      {
        id: '65a6e829307b55dd8406746f',
        name: 'Pratyusa Mukherjee',
      },
      {
        id: '65a6e829307b55dd84067470',
        name: 'Jayeeta Chakraborty',
      },
      {
        id: '65a6e829307b55dd84067471',
        name: 'Banhi Sanyal',
      },
      {
        id: '65a6e829307b55dd84067472',
        name: 'Priyanka Roy',
      },
      {
        id: '65a6e829307b55dd84067473',
        name: 'Shilpa Das',
      },
      {
        id: '65a6e829307b55dd84067474',
        name: 'Anirban Bhattacharjee',
      },
      {
        id: '65a6e829307b55dd84067475',
        name: 'Debanjan Pathak',
      },
      {
        id: '65a6e829307b55dd84067476',
        name: 'Hitesh Mohapatra',
      },
      {
        id: '65a6e829307b55dd84067477',
        name: 'Soumya Ranjan Mishra',
      },
      {
        id: '65a6e829307b55dd84067478',
        name: 'Krishnandu Hazra',
      },
      {
        id: '65a6e829307b55dd84067479',
        name: 'Prasenjit Maiti',
      },
      {
        id: '65a6e829307b55dd8406747a',
        name: 'Jhalak Hota',
      },
      {
        id: '65a6e829307b55dd8406747b',
        name: 'Jaydeep Das',
      },
      {
        id: '65a6e829307b55dd8406747c',
        name: 'Jamimamul Bakas',
      },
      {
        id: '65a6e829307b55dd8406747d',
        name: 'Saikat Chakraborty',
      },
      {
        id: '65a6e829307b55dd8406747e',
        name: 'Rabi Shaw',
      },
      {
        id: '65a6e829307b55dd8406747f',
        name: 'Ipsita Paul',
      },
      {
        id: '65a6e829307b55dd84067480',
        name: 'Chandani Kumari',
      },
      {
        id: '65a6e829307b55dd84067481',
        name: 'Jayanta Mondal',
      },
      {
        id: '65a6e829307b55dd84067482',
        name: 'Sujoy Datta',
      },
      {
        id: '65a6e829307b55dd84067483',
        name: 'Tanamay Swain',
      },
      {
        id: '65a6e829307b55dd84067484',
        name: 'BSP Mishra',
      },
      {
        id: '65a6e829307b55dd84067485',
        name: 'Amulya Ratna Swain',
      },
      {
        id: '65a6e829307b55dd84067486',
        name: 'Asif Uddin Khan',
      },
      {
        id: '65a6e829307b55dd84067487',
        name: 'Dayal Kumar Behera',
      },
      {
        id: '65a6e829307b55dd84067488',
        name: 'Mandakini Priyadarshini',
      },
      {
        id: '65a6e829307b55dd84067489',
        name: 'Sharbani Purkayastha',
      },
      {
        id: '65a6e829307b55dd8406748a',
        name: 'Sarita Mishra',
      },
      {
        id: '65a6e829307b55dd8406748b',
        name: 'Soumya Ranjan Nayak',
      },
      {
        id: '65a6e829307b55dd8406748c',
        name: 'Om Prakash Singh',
      },
      {
        id: '65a6e829307b55dd8406748d',
        name: 'Sampriti Soor',
      },
      {
        id: '65a6e829307b55dd8406748e',
        name: 'MD. Shah Fahad',
      },
      {
        id: '65a6e829307b55dd8406748f',
        name: 'Aradhana Behura',
      },
      {
        id: '65a6e829307b55dd84067490',
        name: 'Mainak Chakraborty',
      },
      {
        id: '65a6e829307b55dd84067491',
        name: 'A. Ranjith',
      },
      {
        id: '65a6e829307b55dd84067492',
        name: 'Ajit Kumar Pasayat',
      },
      {
        id: '65a6e829307b55dd84067493',
        name: 'Raghunath Dey',
      },
      {
        id: '65a6e829307b55dd84067494',
        name: 'Mainak Biswas',
      },
      {
        id: '65a6e829307b55dd84067495',
        name: 'Saurajit Behera',
      },
      {
        id: '65a6e829307b55dd84067496',
        name: 'Jagannath Dass',
      },
      {
        id: '65a6e829307b55dd84067497',
        name: 'Sovan Kumar Sahoo',
      },
      {
        id: '65a6e829307b55dd84067498',
        name: 'Abhaya Kumar Sahoo',
      },
      {
        id: '65a6e829307b55dd84067499',
        name: 'Abhishek Raj',
      },
      {
        id: '65a6e829307b55dd8406749a',
        name: 'Abhishek Ray',
      },
      {
        id: '65a6e829307b55dd8406749b',
        name: 'Abinas Panda',
      },
      {
        id: '65a6e829307b55dd8406749c',
        name: 'Adyasha Dash',
      },
      {
        id: '65a6e829307b55dd8406749d',
        name: 'Ajay Anand',
      },
      {
        id: '65a6e829307b55dd8406749e',
        name: 'Ajay Kumar Jena',
      },
      {
        id: '65a6e829307b55dd8406749f',
        name: 'Ajaya Kumar Parida',
      },
      {
        id: '65a6e829307b55dd840674a0',
        name: 'Aleena Swetapadma',
      },
      {
        id: '65a6e829307b55dd840674a1',
        name: 'Alok Kumar Jagadev',
      },
      {
        id: '65a6e829307b55dd840674a2',
        name: 'Ambika Prasad Mishra',
      },
      {
        id: '65a6e829307b55dd840674a3',
        name: 'Amiya Kumar Dash',
      },
      {
        id: '65a6e829307b55dd840674a4',
        name: 'Amiya Ranjan Panda',
      },
      {
        id: '65a6e829307b55dd840674a5',
        name: 'Anjan Bandyopadhyay',
      },
      {
        id: '65a6e829307b55dd840674a6',
        name: 'Anuja Kumar Acharya',
      },
      {
        id: '65a6e829307b55dd840674a7',
        name: 'Arup Abhinna Acharya',
      },
      {
        id: '65a6e829307b55dd840674a8',
        name: 'Arup Sarkar',
      },
      {
        id: '65a6e829307b55dd840674a9',
        name: 'Ashish Singh',
      },
      {
        id: '65a6e829307b55dd840674aa',
        name: 'Banchhanidhi Dash',
      },
      {
        id: '65a6e829307b55dd840674ab',
        name: 'Benazir Neha',
      },
      {
        id: '65a6e829307b55dd840674ac',
        name: 'Bhabani Shankar Prasad Mishra',
      },
      {
        id: '65a6e829307b55dd840674ad',
        name: 'Bhaswati Sahoo',
      },
      {
        id: '65a6e829307b55dd840674ae',
        name: 'Bindu Agarwalla',
      },
      {
        id: '65a6e829307b55dd840674af',
        name: 'Chandra Shekhar',
      },
      {
        id: '65a6e829307b55dd840674b0',
        name: 'Chittaranjan Pradhan',
      },
      {
        id: '65a6e829307b55dd840674b1',
        name: 'Deependra Singh',
      },
      {
        id: '65a6e829307b55dd840674b2',
        name: 'Dipti Dash',
      },
      {
        id: '65a6e829307b55dd840674b3',
        name: 'G B Mund',
      },
      {
        id: '65a6e829307b55dd840674b4',
        name: 'Gananath Bhuyan',
      },
      {
        id: '65a6e829307b55dd840674b5',
        name: 'Himansu Das',
      },
      {
        id: '65a6e829307b55dd840674b6',
        name: 'Hrudaya Kumar Tripathy',
      },
      {
        id: '65a6e829307b55dd840674b7',
        name: 'Jagannath Singh',
      },
      {
        id: '65a6e829307b55dd840674b8',
        name: 'Jasaswi Prasad Mohanty',
      },
      {
        id: '65a6e829307b55dd840674b9',
        name: 'Jay Sarraf',
      },
      {
        id: '65a6e829307b55dd840674ba',
        name: 'Jayanti Dansana',
      },
      {
        id: '65a6e829307b55dd840674bb',
        name: 'Joy Dutta',
      },
      {
        id: '65a6e829307b55dd840674bc',
        name: 'Junali Jasmine Jena',
      },
      {
        id: '65a6e829307b55dd840674bd',
        name: 'Jyotiprakash Mishra',
      },
      {
        id: '65a6e829307b55dd840674be',
        name: 'Krishna Chakravarty',
      },
      {
        id: '65a6e829307b55dd840674bf',
        name: 'Krutika Verma',
      },
      {
        id: '65a6e829307b55dd840674c0',
        name: 'Kumar Devadutta',
      },
      {
        id: '65a6e829307b55dd840674c1',
        name: 'Kunal Anand',
      },
      {
        id: '65a6e829307b55dd840674c2',
        name: 'Lalit Kumar Vashishtha',
      },
      {
        id: '65a6e829307b55dd840674c3',
        name: 'Leena Das',
      },
      {
        id: '65a6e829307b55dd840674c4',
        name: 'Lipika Mohanty',
      },
      {
        id: '65a6e829307b55dd840674c5',
        name: 'M Nazma BJ Naskar',
      },
      {
        id: '65a6e829307b55dd840674c6',
        name: 'Madhabananda Das',
      },
      {
        id: '65a6e829307b55dd840674c7',
        name: 'Mainak Bandyopadhyay',
      },
      {
        id: '65a6e829307b55dd840674c8',
        name: 'Manas Ranjan Biswal',
      },
      {
        id: '65a6e829307b55dd840674c9',
        name: 'Manas Ranjan Nayak',
      },
      {
        id: '65a6e829307b55dd840674ca',
        name: 'Mandakini Priyadarshani Behera',
      },
      {
        id: '65a6e829307b55dd840674cb',
        name: 'Manoj Kumar Mishra',
      },
      {
        id: '65a6e829307b55dd840674cc',
        name: 'Meghana G Raj',
      },
      {
        id: '65a6e829307b55dd840674cd',
        name: 'Minakhi Rout',
      },
      {
        id: '65a6e829307b55dd840674ce',
        name: 'Mohit Ranjan Panda',
      },
      {
        id: '65a6e829307b55dd840674cf',
        name: 'Mukesh Kumar',
      },
      {
        id: '65a6e829307b55dd840674d0',
        name: 'N Biraja Isac',
      },
      {
        id: '65a6e829307b55dd840674d1',
        name: 'Nachiketa Tarasia',
      },
      {
        id: '65a6e829307b55dd840674d2',
        name: 'Naliniprava Behera',
      },
      {
        id: '65a6e829307b55dd840674d3',
        name: 'Namita Panda',
      },
      {
        id: '65a6e829307b55dd840674d4',
        name: 'Nibedan Panda',
      },
      {
        id: '65a6e829307b55dd840674d5',
        name: 'Niranjan Ray',
      },
      {
        id: '65a6e829307b55dd840674d6',
        name: 'Pinaki Sankar Chatterjee',
      },
      {
        id: '65a6e829307b55dd840674d7',
        name: 'Prabhu Prasad Dev',
      },
      {
        id: '65a6e829307b55dd840674d8',
        name: 'Prachet Bhuyan',
      },
      {
        id: '65a6e829307b55dd840674d9',
        name: 'Pradeep Kumar Mallick',
      },
      {
        id: '65a6e829307b55dd840674da',
        name: 'Prasant Kumar Pattnaik',
      },
      {
        id: '65a6e829307b55dd840674db',
        name: 'Ramakant Parida',
      },
      {
        id: '65a6e829307b55dd840674dc',
        name: 'Ramesh Kumar Thakur',
      },
      {
        id: '65a6e829307b55dd840674dd',
        name: 'Rina Kumari',
      },
      {
        id: '65a6e829307b55dd840674de',
        name: 'Rinku Datta Rakshit',
      },
      {
        id: '65a6e829307b55dd840674df',
        name: 'Ronali Padhy',
      },
      {
        id: '65a6e829307b55dd840674e0',
        name: 'Roshni Pradhan',
      },
      {
        id: '65a6e829307b55dd840674e1',
        name: 'Samaresh Mishra',
      },
      {
        id: '65a6e829307b55dd840674e2',
        name: 'Sankalp Nayak',
      },
      {
        id: '65a6e829307b55dd840674e3',
        name: 'Santos Kumar Baliarsingh',
      },
      {
        id: '65a6e829307b55dd840674e4',
        name: 'Santosh Kumar Pani',
      },
      {
        id: '65a6e829307b55dd840674e5',
        name: 'Santosh Kumar Swain',
      },
      {
        id: '65a6e829307b55dd840674e6',
        name: 'Santwana Sagnika',
      },
      {
        id: '65a6e829307b55dd840674e7',
        name: 'Sarita Tripathy',
      },
      {
        id: '65a6e829307b55dd840674e8',
        name: 'Satarupa Mohanty',
      },
      {
        id: '65a6e829307b55dd840674e9',
        name: 'Satyananda Champati Rai',
      },
      {
        id: '65a6e829307b55dd840674ea',
        name: 'Saurabh Bilgaiyan',
      },
      {
        id: '65a6e829307b55dd840674eb',
        name: 'Saurabh Jha',
      },
      {
        id: '65a6e829307b55dd840674ec',
        name: 'Shaswati Patra',
      },
      {
        id: '65a6e829307b55dd840674ed',
        name: 'Siddharth Swarup Rautaray',
      },
      {
        id: '65a6e829307b55dd840674ee',
        name: 'Sohail Khan',
      },
      {
        id: '65a6e829307b55dd840674ef',
        name: 'Sourajit Behera',
      },
      {
        id: '65a6e829307b55dd840674f0',
        name: 'Sourav Kumar Giri',
      },
      {
        id: '65a6e829307b55dd840674f1',
        name: 'Subhadip Pramanik',
      },
      {
        id: '65a6e829307b55dd840674f2',
        name: 'Subhashree Darshana',
      },
      {
        id: '65a6e829307b55dd840674f3',
        name: 'Subhasis Dash',
      },
      {
        id: '65a6e829307b55dd840674f4',
        name: 'Suchismita Das',
      },
      {
        id: '65a6e829307b55dd840674f5',
        name: 'Sujata Swain',
      },
      {
        id: '65a6e829307b55dd840674f6',
        name: 'Suneeta Mohanty',
      },
      {
        id: '65a6e829307b55dd840674f7',
        name: 'Suresh Chandra Satapathy',
      },
      {
        id: '65a6e829307b55dd840674f8',
        name: 'Sushruta Mishra',
      },
      {
        id: '65a6e829307b55dd840674f9',
        name: 'Susmita Das',
      },
      {
        id: '65a6e829307b55dd840674fa',
        name: 'Swagatika Sahoo',
      },
      {
        id: '65a6e829307b55dd840674fb',
        name: 'Tanik Saikh',
      },
      {
        id: '65a6e829307b55dd840674fc',
        name: 'Tanmaya Swain',
      },
      {
        id: '65a6e829307b55dd840674fd',
        name: 'Tanmoy Maitra',
      },
      {
        id: '65a6e829307b55dd840674fe',
        name: 'Vijay Kumar Meena',
      },
      {
        id: '65a6e829307b55dd840674ff',
        name: 'Vikas Hassija',
      },
      {
        id: '65a6e829307b55dd84067500',
        name: 'Vishal Meena',
      },
    ];

    // const filtered = allReviews.map((f)=>{
    //   return {
    //     //remove Mr. Dr. Ms. Prof. from name

    //     name:f.name.replace(/(Mr. |Dr. |Ms. |Prof. )/g, "").trim(),
    //     likes:f.likes,
    //     dislikes:f.dislikes,
    //     reviews:f.reviews
    //   }
    // })

    // const review = allReviews.fillter((review)=>review.teacherId===teacherId);
    // const p = await this.matchAndAssignIds(filtered, actualFaculties);
    // return {
    //   faculties:p,

    // }

    const real = [
      {
        name: 'Abhishek Raj',
        likes: 39,
        dislikes: 10,
        reviews: [],
        id: '65a6e829307b55dd84067499',
      },
      {
        name: 'Pradeep Kandula',
        likes: 24,
        dislikes: 36,
        reviews: [
          {
            id: '65901ac045c2b626d34b3abd',
            rating: 3,
            commentedBy: '22054390@kiit.ac.in',
            internalScore: 21,
            comments: "he doesn't give marks!",
            teacherId: '65900f80e771e0a80148ed30',
          },
          {
            id: '6590235945c2b626d34b3ae0',
            rating: 1,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 24,
            comments: 'worst faculty',
            teacherId: '65900f80e771e0a80148ed30',
          },
          {
            id: '659029ea45c2b626d34b3af4',
            rating: 5,
            commentedBy: '21053436@kiit.ac.in',
            internalScore: 30,
            comments: 'Teaches good, Gives deserving marks',
            teacherId: '65900f80e771e0a80148ed30',
          },
          {
            id: '659047a245c2b626d34b3b1e',
            rating: 4,
            commentedBy: '22051350@kiit.ac.in',
            internalScore: 27,
            comments: 'Good teacher ',
            teacherId: '65900f80e771e0a80148ed30',
          },
          {
            id: '65912fe745c2b626d34b3b43',
            rating: 4,
            commentedBy: '22051743@kiit.ac.in',
            internalScore: 27,
            comments: 'no extra marks ...just deserving marks\n',
            teacherId: '65900f80e771e0a80148ed30',
          },
        ],
        id: '65a6e829307b55dd84067466',
      },
      {
        name: 'Jagannath Singh',
        likes: 40,
        dislikes: 6,
        reviews: [
          {
            id: '65901c1945c2b626d34b3ac6',
            rating: 5,
            commentedBy: '2229108@kiit.ac.in',
            internalScore: 29,
            comments: 'best',
            teacherId: '65900f82e771e0a80148ed33',
          },
          {
            id: '65903e2b45c2b626d34b3b16',
            rating: 4,
            commentedBy: '22052939@kiit.ac.in',
            internalScore: 30,
            comments: 'Explains every concepts very well . ',
            teacherId: '65900f82e771e0a80148ed33',
          },
        ],
        id: '65a6e829307b55dd840674b7',
      },
      {
        name: 'Vijay Kumar Meena',
        likes: 12,
        dislikes: 36,
        reviews: [],
        id: '65a6e829307b55dd840674fe',
      },
      {
        name: 'Joydeb Pal',
        likes: 40,
        dislikes: 28,
        reviews: [
          {
            id: '65901e1745c2b626d34b3ad2',
            rating: 5,
            commentedBy: '2206107@kiit.ac.in',
            internalScore: 28,
            comments:
              "He is very good and very chill teacher and also teaches very well. He'll try to give as much as possible internals. You can choose him blindly. ",
            teacherId: '65900f82e771e0a80148ed35',
          },
          {
            id: '659033fa45c2b626d34b3b08',
            rating: 4,
            commentedBy: '22052643@kiit.ac.in',
            internalScore: 29,
            comments: 'Great teaching style.',
            teacherId: '65900f82e771e0a80148ed35',
          },
          {
            id: '6590342145c2b626d34b3b09',
            rating: 5,
            commentedBy: '22052643@kiit.ac.in',
            internalScore: 29,
            comments: '.',
            teacherId: '65900f82e771e0a80148ed35',
          },
          {
            id: '6590568845c2b626d34b3b25',
            rating: 3,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 25,
            comments: 'Average',
            teacherId: '65900f82e771e0a80148ed35',
          },
        ],
        id: null,
      },
      {
        name: 'S. Padhy',
        likes: 7,
        dislikes: 3,
        reviews: [],
        id: null,
      },
      {
        name: 'Seba Mohanty',
        likes: 27,
        dislikes: 15,
        reviews: [
          {
            id: '65901bf445c2b626d34b3ac4',
            rating: 4,
            commentedBy: '22051843@kiit.ac.in',
            internalScore: 27,
            comments:
              'Internals me sbko 27 k uper di thi. Marks acha hi deti hai.',
            teacherId: '65900f82e771e0a80148ed34',
          },
          {
            id: '6590207545c2b626d34b3adb',
            rating: 5,
            commentedBy: '22053488@kiit.ac.in',
            internalScore: 28,
            comments: 'Good ',
            teacherId: '65900f82e771e0a80148ed34',
          },
          {
            id: '6590289f45c2b626d34b3af0',
            rating: 5,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments:
              "She's pretty lenient and friendly; marks graciously in both internals as well as mid and end sem exams",
            teacherId: '65900f82e771e0a80148ed34',
          },
          {
            id: '6593a5e645c2b626d34b3b67',
            rating: 5,
            commentedBy: '22052768@kiit.ac.in',
            internalScore: 30,
            comments: 'Gives good marks, also is lenient with attendance',
            teacherId: '65900f82e771e0a80148ed34',
          },
        ],
        id: null,
      },
      {
        name: 'Ashish Singh',
        likes: 2,
        dislikes: 57,
        reviews: [
          {
            id: '659026cc45c2b626d34b3ae4',
            rating: 1,
            commentedBy: '2105672@kiit.ac.in',
            internalScore: 19,
            comments: 'isko liya to pura semester bhugto ge',
            teacherId: '65900f82e771e0a80148ed36',
          },
          {
            id: '6591295745c2b626d34b3b41',
            rating: 1,
            commentedBy: '2105260@kiit.ac.in',
            internalScore: 16,
            comments: 'Worst faculty. Students are affected very badly',
            teacherId: '65900f82e771e0a80148ed36',
          },
        ],
        id: '65a6e829307b55dd840674a9',
      },
      {
        name: 'Kumar Biswal',
        likes: 10,
        dislikes: 14,
        reviews: [],
        id: null,
      },
      {
        name: 'Promod Mallick',
        likes: 7,
        dislikes: 5,
        reviews: [],
        id: null,
      },
      {
        name: 'Ananda Meher',
        likes: 12,
        dislikes: 6,
        reviews: [
          {
            id: '65923f6a45c2b626d34b3b53',
            rating: 5,
            commentedBy: '22052653@kiit.ac.in',
            internalScore: 30,
            comments: '\n\n',
            teacherId: '65900f82e771e0a80148ed3a',
          },
        ],
        id: null,
      },
      {
        name: 'J. R. Panda',
        likes: 5,
        dislikes: 2,
        reviews: [],
        id: null,
      },
      {
        name: 'Jitendra Ku. Patel',
        likes: 3,
        dislikes: 13,
        reviews: [],
        id: null,
      },
      {
        name: 'Mahendra Kumar Gourisaria',
        likes: 10,
        dislikes: 123,
        reviews: [
          {
            id: '65913a0545c2b626d34b3b47',
            rating: 1,
            commentedBy: '2206065@kiit.ac.in',
            internalScore: 20,
            comments: '80% of the class got a 25/50 in his internals',
            teacherId: '65900f82e771e0a80148ed3d',
          },
          {
            id: '6593aec245c2b626d34b3b6c',
            rating: 1,
            commentedBy: '2228124@kiit.ac.in',
            internalScore: 19,
            comments: 'Torture',
            teacherId: '65900f82e771e0a80148ed3d',
          },
          {
            id: '6593fb7f45c2b626d34b3b70',
            rating: 1,
            commentedBy: '2206290@kiit.ac.in',
            internalScore: 16,
            comments: "Don't..just don't ",
            teacherId: '65900f82e771e0a80148ed3d',
          },
          {
            id: '6594001945c2b626d34b3b72',
            rating: 5,
            commentedBy: '2205894@kiit.ac.in',
            internalScore: 13,
            comments: 'Maa chud jayegi ',
            teacherId: '65900f82e771e0a80148ed3d',
          },
        ],
        id: '65a6e829307b55dd84067463',
      },
      {
        name: 'Rabi Shaw',
        likes: 13,
        dislikes: 65,
        reviews: [
          {
            id: '6590270145c2b626d34b3ae6',
            rating: 1,
            commentedBy: '2105366@kiit.ac.in',
            internalScore: 30,
            comments:
              "Probably one of the most evil teachers out there, he actively wants his students to fail miserably and then laugh at their helpless faces. He'll pull some of the the most outlandish bullshit just to make you feel worthless about everything. You CAN, however, get good marks under him if you make a very good impression on him somehow. ",
            teacherId: '65900f82e771e0a80148ed43',
          },
          {
            id: '659037e145c2b626d34b3b0f',
            rating: 5,
            commentedBy: '21051720@kiit.ac.in',
            internalScore: 30,
            comments:
              'He is actually good, if you maintain discipline in class, have 90% above attendance and sit in first bench. He will give 28+ in internals out of 30. Just don’t disturb in his class, else he will make your semester hell.',
            teacherId: '65900f82e771e0a80148ed43',
          },
          {
            id: '659056ea45c2b626d34b3b26',
            rating: 5,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 29,
            comments: 'Marks depends on his mood 😂 ',
            teacherId: '65900f82e771e0a80148ed43',
          },
          {
            id: '65df613c0fb947f5b25481d7',
            rating: 1,
            commentedBy: '2205333@kiit.ac.in',
            internalScore: 14,
            comments: 'Just the worst',
            teacherId: '65900f82e771e0a80148ed43',
          },
        ],
        id: '65a6e829307b55dd8406747e',
      },
      {
        name: 'Rakesh Kumar Rai',
        likes: 2,
        dislikes: 2,
        reviews: [],
        id: null,
      },
      {
        name: 'Saurabh Jha',
        likes: 11,
        dislikes: 20,
        reviews: [
          {
            id: '6590d08e45c2b626d34b3b30',
            rating: 1,
            commentedBy: '21052415@kiit.ac.in',
            internalScore: 27,
            comments:
              'Quiz ka answer net pe mil jayega lekin mid aur end sem.. 🤞🤞',
            teacherId: '65900f82e771e0a80148ed3f',
          },
          {
            id: '65944e5a45c2b626d34b3b79',
            rating: 5,
            commentedBy: '2205606@kiit.ac.in',
            internalScore: 30,
            comments: 'best teacher\n',
            teacherId: '65900f82e771e0a80148ed3f',
          },
        ],
        id: '65a6e829307b55dd840674eb',
      },
      {
        name: 'Habibul Islam',
        likes: 13,
        dislikes: 5,
        reviews: [
          {
            id: '65901b3045c2b626d34b3ac1',
            rating: 5,
            commentedBy: 'tpiyush2626@gmail.com',
            internalScore: 30,
            comments: 'excellent',
            teacherId: '65900f82e771e0a80148ed40',
          },
          {
            id: '6590201b45c2b626d34b3ad7',
            rating: 4,
            commentedBy: '2206130@kiit.ac.in',
            internalScore: 30,
            comments: 'Highly recommended ',
            teacherId: '65900f82e771e0a80148ed40',
          },
        ],
        id: null,
      },
      {
        name: 'Saurabh Bilgaiyan',
        likes: 7,
        dislikes: 110,
        reviews: [
          {
            id: '65901db445c2b626d34b3ace',
            rating: 3,
            commentedBy: '2105895@kiit.ac.in',
            internalScore: 30,
            comments:
              "I never studied from him. But my roommate was in his class and he came for substitution in my OS class. I have entered my roommate's internals. He's a good guy assuming you study and attend classes. His teaching style was good. You'll understand stuff. But don't take if you're not gonna grind cause he's also infamous for failing people ",
            teacherId: '65900f82e771e0a80148ed3c',
          },
          {
            id: '659028d745c2b626d34b3af1',
            rating: 1,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 25,
            comments: 'do NOT opt',
            teacherId: '65900f82e771e0a80148ed3c',
          },
          {
            id: '65902a3145c2b626d34b3af7',
            rating: 4,
            commentedBy: '21053436@kiit.ac.in',
            internalScore: 18,
            comments: 'Worst ever',
            teacherId: '65900f82e771e0a80148ed3c',
          },
          {
            id: '65903d7345c2b626d34b3b13',
            rating: 1,
            commentedBy: '2105578@kiit.ac.in',
            internalScore: -1,
            comments:
              'remember the teacher who made out with students? Yes that is him. \n',
            teacherId: '65900f82e771e0a80148ed3c',
          },
        ],
        id: '65a6e829307b55dd840674ea',
      },
      {
        name: 'Swarup K. Nayak',
        likes: 3,
        dislikes: 4,
        reviews: [],
        id: null,
      },
      {
        name: 'Himansu Das',
        likes: 25,
        dislikes: 3,
        reviews: [],
        id: '65a6e829307b55dd840674b5',
      },
      {
        name: 'S. Mishra',
        likes: 4,
        dislikes: 9,
        reviews: [],
        id: null,
      },
      {
        name: 'Deependra Singh',
        likes: 23,
        dislikes: 6,
        reviews: [
          {
            id: '6590344145c2b626d34b3b0a',
            rating: 1,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 25,
            comments: 'No 1 chutiya hai bhai mat lena nahi to regret hoga ',
            teacherId: '65900f82e771e0a80148ed42',
          },
        ],
        id: '65a6e829307b55dd840674b1',
      },
      {
        name: 'Mrs. Krishna Chakravarty',
        likes: 27,
        dislikes: 4,
        reviews: [],
        id: null,
      },
      {
        name: 'Debanjan Pathak',
        likes: 24,
        dislikes: 12,
        reviews: [],
        id: '65a6e829307b55dd84067475',
      },
      {
        name: 'Arun Kumar Gupta',
        likes: 27,
        dislikes: 14,
        reviews: [
          {
            id: '6590241645c2b626d34b3ae1',
            rating: 5,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 28,
            comments: 'best faculty',
            teacherId: '65900f82e771e0a80148ed47',
          },
          {
            id: '6590269845c2b626d34b3ae3',
            rating: 4,
            commentedBy: '22052705@kiit.ac.in',
            internalScore: 25,
            comments:
              'Thik thak hi he ...\nAttendance me thoda strict hein sir',
            teacherId: '65900f82e771e0a80148ed47',
          },
          {
            id: '65926c9345c2b626d34b3b54',
            rating: 4,
            commentedBy: '22053675@kiit.ac.in',
            internalScore: 24,
            comments:
              'Internal bahat kam dete hain but mid sem mein thik thak dete hain',
            teacherId: '65900f82e771e0a80148ed47',
          },
          {
            id: '6593069445c2b626d34b3b5d',
            rating: 4,
            commentedBy: '22051204@kiit.ac.in',
            internalScore: 28,
            comments:
              'Bohot achha padhata hai. Internals mein full nehi deta, par bohot lenient checking karta hai.',
            teacherId: '65900f82e771e0a80148ed47',
          },
        ],
        id: null,
      },
      {
        name: 'Mainak Biswas',
        likes: 26,
        dislikes: 13,
        reviews: [
          {
            id: '65902f3845c2b626d34b3b05',
            rating: 5,
            commentedBy: '2205639@kiit.ac.in',
            internalScore: 30,
            comments:
              'Easy to get marks. A little hard to aprroach but studying will get you marks \n',
            teacherId: '65900f82e771e0a80148ed45',
          },
          {
            id: '65914efb45c2b626d34b3b48',
            rating: 5,
            commentedBy: '22052256@kiit.ac.in',
            internalScore: 27,
            comments: 'Lenient ',
            teacherId: '65900f82e771e0a80148ed45',
          },
        ],
        id: '65a6e829307b55dd84067494',
      },
      {
        name: 'Sushree S. Panda',
        likes: 3,
        dislikes: 8,
        reviews: [],
        id: null,
      },
      {
        name: 'Aleena Swetapadma',
        likes: 29,
        dislikes: 10,
        reviews: [],
        id: '65a6e829307b55dd840674a0',
      },
      {
        name: 'Mitali Routaray',
        likes: 19,
        dislikes: 22,
        reviews: [],
        id: null,
      },
      {
        name: 'Mainak Chakraborty',
        likes: 32,
        dislikes: 0,
        reviews: [
          {
            id: '6590292245c2b626d34b3af2',
            rating: 5,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments:
              'excellent teaching style; gives ample questions for practice; gives excellent marks',
            teacherId: '65900f83e771e0a80148ed4d',
          },
          {
            id: '6591370545c2b626d34b3b46',
            rating: 1,
            commentedBy: '22051924@kiit.ac.in',
            internalScore: 30,
            comments:
              'Best teacher. Very lenient and gives good marks. Excellent teaching style. Internals mai almost sabko 30/30 diye the AFL mai❤️❤️',
            teacherId: '65900f83e771e0a80148ed4d',
          },
          {
            id: '65914f1645c2b626d34b3b49',
            rating: 5,
            commentedBy: '22052256@kiit.ac.in',
            internalScore: 30,
            comments: 'Chill',
            teacherId: '65900f83e771e0a80148ed4d',
          },
          {
            id: '65914fe645c2b626d34b3b4a',
            rating: 4,
            commentedBy: '22052245@kiit.ac.in',
            internalScore: 29,
            comments: 'good teacher and student friendly',
            teacherId: '65900f83e771e0a80148ed4d',
          },
          {
            id: '6591961945c2b626d34b3b4e',
            rating: 5,
            commentedBy: '2205972@kiit.ac.in',
            internalScore: 27,
            comments: 'badhiya samjhate h, chill af and genuine',
            teacherId: '65900f83e771e0a80148ed4d',
          },
        ],
        id: '65a6e829307b55dd84067490',
      },
      {
        name: 'Srikanta Behera',
        likes: 9,
        dislikes: 1,
        reviews: [],
        id: null,
      },
      {
        name: 'VIkas Hassija',
        likes: 6,
        dislikes: 25,
        reviews: [
          {
            id: '65902b3545c2b626d34b3afb',
            rating: 4,
            commentedBy: '21053436@kiit.ac.in',
            internalScore: 22,
            comments:
              'Has has k le lega hassija, 26 toh highest rehta hai iske internal me 🥸',
            teacherId: '65900f83e771e0a80148ed51',
          },
        ],
        id: null,
      },
      {
        name: 'Nazia T. Imran',
        likes: 1,
        dislikes: 1,
        reviews: [],
        id: null,
      },
      {
        name: 'Mainak Bandyopadhyay',
        likes: 22,
        dislikes: 18,
        reviews: [],
        id: '65a6e829307b55dd840674c7',
      },
      {
        name: 'Anil Kumar Swain',
        likes: 30,
        dislikes: 3,
        reviews: [],
        id: null,
      },
      {
        name: 'S. K. Badi',
        likes: 8,
        dislikes: 17,
        reviews: [],
        id: null,
      },
      {
        name: 'Biswajit Sahoo',
        likes: 90,
        dislikes: 15,
        reviews: [
          {
            id: '6590430d45c2b626d34b3b19',
            rating: 5,
            commentedBy: '21051974@kiit.ac.in',
            internalScore: 28,
            comments:
              'He is a very good teacher. Maintain give and take relation. If you want to learn just select him',
            teacherId: '65900f83e771e0a80148ed56',
          },
          {
            id: '6590ff0445c2b626d34b3b3e',
            rating: 5,
            commentedBy: '22052843@kiit.ac.in',
            internalScore: 30,
            comments:
              'One of the most chill teacher in KIIT, hamare C lab ke teacher the',
            teacherId: '65900f83e771e0a80148ed56',
          },
        ],
        id: null,
      },
      {
        name: 'Basanta Kumar Rana',
        likes: 5,
        dislikes: 1,
        reviews: [],
        id: null,
      },
      {
        name: 'Soumya Ranjan Mishra',
        likes: 21,
        dislikes: 5,
        reviews: [],
        id: '65a6e829307b55dd84067477',
      },
      {
        name: 'Kunal Anand',
        likes: 46,
        dislikes: 3,
        reviews: [],
        id: '65a6e829307b55dd840674c1',
      },
      {
        name: 'Hrudaya Kumar Tripathy',
        likes: 11,
        dislikes: 10,
        reviews: [],
        id: '65a6e829307b55dd840674b6',
      },
      {
        name: 'Chandani Kumari',
        likes: 20,
        dislikes: 24,
        reviews: [],
        id: '65a6e829307b55dd84067480',
      },
      {
        name: 'Sushruta Mishra',
        likes: 30,
        dislikes: 3,
        reviews: [],
        id: '65a6e829307b55dd840674f8',
      },
      {
        name: 'Spandan Guha',
        likes: 5,
        dislikes: 11,
        reviews: [],
        id: null,
      },
      {
        name: 'Prasanta Ku. Mohanty',
        likes: 32,
        dislikes: 11,
        reviews: [
          {
            id: '6591026445c2b626d34b3b3f',
            rating: 5,
            commentedBy: '22051815@kiit.ac.in',
            internalScore: 30,
            comments:
              'Has very good grasp on the subject. Teaches very good. Just pay attention in his class. Maintain healthy attendance and will give very good in internals. Even if attendance is less than 75 still everyone got 25+ in internals.',
            teacherId: '65900f83e771e0a80148ed5a',
          },
          {
            id: '659466b245c2b626d34b3b7b',
            rating: 4,
            commentedBy: '22052198@kiit.ac.in',
            internalScore: 27,
            comments: 'teaches really well',
            teacherId: '65900f83e771e0a80148ed5a',
          },
        ],
        id: null,
      },
      {
        name: 'Alivarani Mohapatra',
        likes: 9,
        dislikes: 10,
        reviews: [],
        id: null,
      },
      {
        name: 'Srikumar Acharya',
        likes: 15,
        dislikes: 9,
        reviews: [],
        id: null,
      },
      {
        name: 'Jayeeta Chakraborty',
        likes: 13,
        dislikes: 24,
        reviews: [
          {
            id: '659132b845c2b626d34b3b45',
            rating: 1,
            commentedBy: '22054341@kiit.ac.in',
            internalScore: 22,
            comments: 'too less as i did all she said \n',
            teacherId: '65900f83e771e0a80148ed61',
          },
          {
            id: '6593e39345c2b626d34b3b6d',
            rating: 1,
            commentedBy: '2205910@kiit.ac.in',
            internalScore: 20,
            comments: 'marks nhi deti ekdam',
            teacherId: '65900f83e771e0a80148ed61',
          },
        ],
        id: '65a6e829307b55dd84067470',
      },
      {
        name: 'Pragma Kar',
        likes: 3,
        dislikes: 2,
        reviews: [],
        id: null,
      },
      {
        name: 'Susmita Das',
        likes: 16,
        dislikes: 2,
        reviews: [],
        id: '65a6e829307b55dd840674f9',
      },
      {
        name: 'Murari Mandal',
        likes: 10,
        dislikes: 30,
        reviews: [],
        id: '65a6e829307b55dd84067467',
      },
      {
        name: 'Namita Panda',
        likes: 36,
        dislikes: 10,
        reviews: [
          {
            id: '65901f1545c2b626d34b3ad4',
            rating: 5,
            commentedBy: '2106290@kiit.ac.in',
            internalScore: 29,
            comments: 'She is great',
            teacherId: '65900f83e771e0a80148ed66',
          },
          {
            id: '65930e0945c2b626d34b3b63',
            rating: 4,
            commentedBy: '2206340@kiit.ac.in',
            internalScore: 23,
            comments:
              'She is great when it comes to teaching but for internals she conducts class test. You have to score well to get good internals. But can increase internals if you have scored well in mid sem.',
            teacherId: '65900f83e771e0a80148ed66',
          },
        ],
        id: '65a6e829307b55dd840674d3',
      },
      {
        name: 'Asif Uddin Khan',
        likes: 17,
        dislikes: 23,
        reviews: [],
        id: '65a6e829307b55dd84067486',
      },
      {
        name: 'Suvasis Nayak',
        likes: 25,
        dislikes: 1,
        reviews: [],
        id: null,
      },
      {
        name: 'Rinku Datta Rakshit',
        likes: 22,
        dislikes: 5,
        reviews: [
          {
            id: '65904d3645c2b626d34b3b1f',
            rating: 5,
            commentedBy: '2105974@kiit.ac.in',
            internalScore: 30,
            comments: 'Padhati bohot acha h...highly recommended ',
            teacherId: '65900f83e771e0a80148ed67',
          },
        ],
        id: '65a6e829307b55dd840674de',
      },
      {
        name: 'Manas Ranjan Nayak',
        likes: 23,
        dislikes: 9,
        reviews: [
          {
            id: '65903cc445c2b626d34b3b11',
            rating: 3,
            commentedBy: '2128034@kiit.ac.in',
            internalScore: 23,
            comments: 'Good overall. Not the best but will do.\n',
            teacherId: '65900f84e771e0a80148ed69',
          },
          {
            id: '6591ac0e45c2b626d34b3b52',
            rating: 3,
            commentedBy: '2206340@kiit.ac.in',
            internalScore: 25,
            comments:
              'Bhai is aadmi ko khud kuch nhi aata. Lenient h no doubt. But ha agr tmne shi likha h to b guarantee nhi h k marks milenge kyuki usko smjh nhi aata',
            teacherId: '65900f84e771e0a80148ed69',
          },
          {
            id: '6594603e45c2b626d34b3b7a',
            rating: 5,
            commentedBy: '2206385@kiit.ac.in',
            internalScore: 30,
            comments: 'na',
            teacherId: '65900f84e771e0a80148ed69',
          },
        ],
        id: '65a6e829307b55dd840674c9',
      },
      {
        name: 'Ganaraj P. S.',
        likes: 8,
        dislikes: 21,
        reviews: [],
        id: null,
      },
      {
        name: 'Soumya Ranjan Nayak',
        likes: 8,
        dislikes: 11,
        reviews: [
          {
            id: '65902fd245c2b626d34b3b06',
            rating: 3,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 26,
            comments: 'South indian Villian ',
            teacherId: '65900f84e771e0a80148ed6c',
          },
          {
            id: '65930bec45c2b626d34b3b5e',
            rating: 5,
            commentedBy: '22052043@kiit.ac.in',
            internalScore: 30,
            comments:
              'Very Good teacher... especially good if u can get in his good graces... "You can\'t stop me from being myself"',
            teacherId: '65900f84e771e0a80148ed6c',
          },
          {
            id: '65930c5545c2b626d34b3b5f',
            rating: 5,
            commentedBy: '22052042@kiit.ac.in',
            internalScore: 29,
            comments: 'du6urr6vubt o9uo8 ',
            teacherId: '65900f84e771e0a80148ed6c',
          },
          {
            id: '65930c6245c2b626d34b3b60',
            rating: 4,
            commentedBy: '22052044@kiit.ac.in',
            internalScore: 27,
            comments:
              'Good "\'if and only if"\' you are attentive and interact with the teacher',
            teacherId: '65900f84e771e0a80148ed6c',
          },
          {
            id: '65930c7545c2b626d34b3b61',
            rating: 4,
            commentedBy: '22052054@kiit.ac.in',
            internalScore: 27,
            comments:
              'Thik thak hi padhata hai ,exam me bas marks Thora ulta sidha deta hai,kabhi kabhi sahi answers p marks nhi dega but recheck p dene se marks badha dega',
            teacherId: '65900f84e771e0a80148ed6c',
          },
        ],
        id: '65a6e829307b55dd8406748b',
      },
      {
        name: 'A. Bakshi',
        likes: 10,
        dislikes: 15,
        reviews: [],
        id: null,
      },
      {
        name: 'Bijay Das',
        likes: 2,
        dislikes: 2,
        reviews: [],
        id: null,
      },
      {
        name: 'Debashis Hati',
        likes: 27,
        dislikes: 11,
        reviews: [],
        id: '65a6e829307b55dd8406746c',
      },
      {
        name: 'Debdulal Ghosh',
        likes: 7,
        dislikes: 2,
        reviews: [],
        id: null,
      },
      {
        name: 'Alok Kumar Jagadev',
        likes: 7,
        dislikes: 18,
        reviews: [
          {
            id: '6591a71345c2b626d34b3b4f',
            rating: 3,
            commentedBy: '22054176@kiit.ac.in',
            internalScore: 25,
            comments:
              'Strict teacher and you need to be attentive in class.Will give marks as per you deserve and checks the assignments very strictly ',
            teacherId: '65900f84e771e0a80148ed71',
          },
          {
            id: '6594423c45c2b626d34b3b77',
            rating: 3,
            commentedBy: '22054173@kiit.ac.in',
            internalScore: 27,
            comments:
              "Strict, doesn't let u use phone in class. Good teacher. Sometimes his lectures might be boring, will never let u sleep.",
            teacherId: '65900f84e771e0a80148ed71',
          },
        ],
        id: '65a6e829307b55dd840674a1',
      },
      {
        name: 'Akshaya Kumar Panda',
        likes: 11,
        dislikes: 12,
        reviews: [
          {
            id: '65901ff545c2b626d34b3ad6',
            rating: 1,
            commentedBy: 'imamansinha69@gmail.com',
            internalScore: 15,
            comments: 'Number nhi dega',
            teacherId: '65900f84e771e0a80148ed70',
          },
          {
            id: '6591aafe45c2b626d34b3b50',
            rating: 5,
            commentedBy: '2206340@kiit.ac.in',
            internalScore: 25,
            comments:
              'Bhai aankh band kr k paper check kr deta h not in a good sense like tmhare answers shi h to b 0 de dega kyuki vo check hi nhi krta',
            teacherId: '65900f84e771e0a80148ed70',
          },
          {
            id: '6591ab5145c2b626d34b3b51',
            rating: 1,
            commentedBy: '2206340@kiit.ac.in',
            internalScore: 25,
            comments:
              'Bhai aankh band kr k paper check krega not in a good sense. Shi answer pe bhi 0 de dega kyuki vo paper check hi nhi krta',
            teacherId: '65900f84e771e0a80148ed70',
          },
        ],
        id: null,
      },
      {
        name: 'Minakhi Rout',
        likes: 13,
        dislikes: 26,
        reviews: [
          {
            id: '659383ba45c2b626d34b3b65',
            rating: 1,
            commentedBy: '2206188@kiit.ac.in',
            internalScore: 19,
            comments:
              "very arrogant and she taught in a bookish manner, doesn't give internal marks or take any defaulter test/quiz ",
            teacherId: '65900f84e771e0a80148ed74',
          },
          {
            id: '65df61760fb947f5b25481d8',
            rating: 1,
            commentedBy: '2205333@kiit.ac.in',
            internalScore: 20,
            comments:
              "She's so sadistic, gives marks on her mood. Way too biased ",
            teacherId: '65900f84e771e0a80148ed74',
          },
        ],
        id: '65a6e829307b55dd840674cd',
      },
      {
        name: 'Suman Sarkar',
        likes: 24,
        dislikes: 5,
        reviews: [
          {
            id: '659029e945c2b626d34b3af3',
            rating: 5,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments: 'gives excellent marks; teaches pretty well',
            teacherId: '65900f84e771e0a80148ed75',
          },
        ],
        id: null,
      },
      {
        name: 'Abhijit Sutradhar',
        likes: 5,
        dislikes: 2,
        reviews: [],
        id: null,
      },
      {
        name: 'P. Biswal',
        likes: 14,
        dislikes: 1,
        reviews: [
          {
            id: '6590404945c2b626d34b3b17',
            rating: 5,
            commentedBy: '22053994@kiit.ac.in',
            internalScore: 29,
            comments: 'very good',
            teacherId: '65900f84e771e0a80148ed78',
          },
        ],
        id: null,
      },
      {
        name: 'Rohit Kumar Tiwari',
        likes: 16,
        dislikes: 14,
        reviews: [],
        id: null,
      },
      {
        name: 'Bapuji Sahoo',
        likes: 18,
        dislikes: 18,
        reviews: [
          {
            id: '65901b0f45c2b626d34b3abf',
            rating: 5,
            commentedBy: '22051077@kiit.ac.in',
            internalScore: 30,
            comments:
              "Major positive points are\nIsn't strict in terms of attendance\nTeaches well\nGives good internals to almost everyone ",
            teacherId: '65900f84e771e0a80148ed76',
          },
          {
            id: '65901df945c2b626d34b3ad1',
            rating: 5,
            commentedBy: '2205954@kiit.ac.in',
            internalScore: 30,
            comments:
              'Best teacher full marks in internals and no issue with attendence everyone got 95%',
            teacherId: '65900f84e771e0a80148ed76',
          },
          {
            id: '659076fd45c2b626d34b3b2f',
            rating: 5,
            commentedBy: '2205046@kiit.ac.in',
            internalScore: 29,
            comments:
              'attendance ko leke koi tension nhi hai, marks bhi bohot achhe dete hain, agar thoda bhi aayega toh achha mil jayega',
            teacherId: '65900f84e771e0a80148ed76',
          },
        ],
        id: null,
      },
      {
        name: 'Subarna  Bhattacharya',
        likes: 4,
        dislikes: 6,
        reviews: [],
        id: null,
      },
      {
        name: 'Sampriti Soor',
        likes: 10,
        dislikes: 8,
        reviews: [
          {
            id: '6590fa6545c2b626d34b3b3d',
            rating: 1,
            commentedBy: '22052843@kiit.ac.in',
            internalScore: 20,
            comments:
              'Sirf re be tum tam karna aata hai, mithi baatein aur low internals inki khoobi hai',
            teacherId: '65900f84e771e0a80148ed77',
          },
        ],
        id: '65a6e829307b55dd8406748d',
      },
      {
        name: 'Vishal Meena',
        likes: 12,
        dislikes: 6,
        reviews: [],
        id: '65a6e829307b55dd84067500',
      },
      {
        name: 'Sankalp Nayak',
        likes: 3,
        dislikes: 31,
        reviews: [
          {
            id: '659057ce45c2b626d34b3b27',
            rating: 1,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 20,
            comments:
              'Not recommended at all. 17-18 was the average internal marks',
            teacherId: '65900f84e771e0a80148ed7c',
          },
        ],
        id: '65a6e829307b55dd840674e2',
      },
      {
        name: 'Arjun Kumar Paul',
        likes: 22,
        dislikes: 3,
        reviews: [
          {
            id: '6590204c45c2b626d34b3ad9',
            rating: 5,
            commentedBy: 'khaitanharsh08@gmail.com',
            internalScore: 30,
            comments:
              "Best teacher, doesn't take full attendance,easy proxy, gives you full marks if you score good marks in central quiz and submit all assignments. Very polite teacker",
            teacherId: '65900f84e771e0a80148ed7b',
          },
        ],
        id: null,
      },
      {
        name: 'Sunil Kumar Gouda',
        likes: 19,
        dislikes: 1,
        reviews: [
          {
            id: '65901d2a45c2b626d34b3acc',
            rating: 5,
            commentedBy: '21051394@kiit.ac.in',
            internalScore: 25,
            comments: 'Good teacher and gives good marks.',
            teacherId: '65900f84e771e0a80148ed7d',
          },
        ],
        id: null,
      },
      {
        name: 'Pradeep Kumar Mallick',
        likes: 28,
        dislikes: 12,
        reviews: [
          {
            id: '65901bad45c2b626d34b3ac2',
            rating: 5,
            commentedBy: '22053306@kiit.ac.in',
            internalScore: 29,
            comments: 'Nicee',
            teacherId: '65900f84e771e0a80148ed81',
          },
          {
            id: '65912ade45c2b626d34b3b42',
            rating: 5,
            commentedBy: '21052449@kiit.ac.in',
            internalScore: 29,
            comments: 'Great teacher',
            teacherId: '65900f84e771e0a80148ed81',
          },
        ],
        id: '65a6e829307b55dd840674d9',
      },
      {
        name: 'M. M. Acharya',
        likes: 14,
        dislikes: 2,
        reviews: [],
        id: null,
      },
      {
        name: 'Avinash Chaudhary',
        likes: 6,
        dislikes: 0,
        reviews: [],
        id: null,
      },
      {
        name: 'Krishnandu Hazra',
        likes: 4,
        dislikes: 22,
        reviews: [],
        id: '65a6e829307b55dd84067478',
      },
      {
        name: 'Arijit Patra',
        likes: 20,
        dislikes: 1,
        reviews: [
          {
            id: '65901bc545c2b626d34b3ac3',
            rating: 5,
            commentedBy: '22052975@kiit.ac.in',
            internalScore: 29,
            comments: 'Best',
            teacherId: '65900f84e771e0a80148ed82',
          },
          {
            id: '6596913f45c2b626d34b3c07',
            rating: 5,
            commentedBy: '22053055@kiit.ac.in',
            internalScore: 28,
            comments:
              "GOD\nHe's man of a kind, jus maintain a decent attendance , play ML in his class or doze off np...marks toh bhhar k denge likh k lelo",
            teacherId: '65900f84e771e0a80148ed82',
          },
        ],
        id: null,
      },
      {
        name: 'Arghya Kundu',
        likes: 6,
        dislikes: 11,
        reviews: [
          {
            id: '6590204045c2b626d34b3ad8',
            rating: 1,
            commentedBy: 'imamansinha69@gmail.com',
            internalScore: 28,
            comments: 'Mt lena isko kabhi bhool kr bhi',
            teacherId: '65900f84e771e0a80148ed84',
          },
        ],
        id: null,
      },
      {
        name: 'Prasenjit Maiti',
        likes: 30,
        dislikes: 0,
        reviews: [],
        id: '65a6e829307b55dd84067479',
      },
      {
        name: 'Sarita Mishra',
        likes: 16,
        dislikes: 1,
        reviews: [
          {
            id: '65903d8645c2b626d34b3b14',
            rating: 5,
            commentedBy: '2128034@kiit.ac.in',
            internalScore: 28,
            comments: 'BEST.',
            teacherId: '65900f84e771e0a80148ed88',
          },
        ],
        id: '65a6e829307b55dd8406748a',
      },
      {
        name: 'Saikat Chakraborty',
        likes: 11,
        dislikes: 21,
        reviews: [
          {
            id: '65902a6245c2b626d34b3af8',
            rating: 1,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments: 'does NOT teach at all!',
            teacherId: '65900f84e771e0a80148ed85',
          },
          {
            id: '65904da445c2b626d34b3b21',
            rating: 1,
            commentedBy: '2105974@kiit.ac.in',
            internalScore: 18,
            comments: 'Bohot test leta h ',
            teacherId: '65900f84e771e0a80148ed85',
          },
        ],
        id: '65a6e829307b55dd8406747d',
      },
      {
        name: 'Ajit Kumar Pasayat',
        likes: 23,
        dislikes: 1,
        reviews: [
          {
            id: '65903db845c2b626d34b3b15',
            rating: 5,
            commentedBy: '2128034@kiit.ac.in',
            internalScore: 25,
            comments:
              'BEST PERSON, FULL SUPPORT TO STUDENTS AND EXTREMELY STUDENT FRIENDLY\n',
            teacherId: '65900f84e771e0a80148ed8a',
          },
        ],
        id: '65a6e829307b55dd84067492',
      },
      {
        name: 'Monideepa Roy',
        likes: 10,
        dislikes: 16,
        reviews: [
          {
            id: '65901aed45c2b626d34b3abe',
            rating: 5,
            commentedBy: 'tpiyush2626@gmail.com',
            internalScore: 27,
            comments: 'very good',
            teacherId: '65900f84e771e0a80148ed8c',
          },
        ],
        id: '65a6e829307b55dd84067465',
      },
      {
        name: 'Mrs. Naliniprava Behera',
        likes: 51,
        dislikes: 0,
        reviews: [
          {
            id: '6590580145c2b626d34b3b28',
            rating: 5,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 29,
            comments: 'Best faculty of OOP',
            teacherId: '65900f84e771e0a80148ed89',
          },
        ],
        id: null,
      },
      {
        name: 'Swagatika Sahoo',
        likes: 11,
        dislikes: 15,
        reviews: [
          {
            id: '6593ee8e45c2b626d34b3b6f',
            rating: 5,
            commentedBy: '2205045@kiit.ac.in',
            internalScore: 26,
            comments: 'Afl',
            teacherId: '65900f84e771e0a80148ed86',
          },
        ],
        id: '65a6e829307b55dd840674fa',
      },
      {
        name: 'Kumar Surjeet Chaudhury',
        likes: 10,
        dislikes: 8,
        reviews: [],
        id: null,
      },
      {
        name: 'Sriparna Roy Ghatak',
        likes: 3,
        dislikes: 6,
        reviews: [],
        id: null,
      },
      {
        name: 'Pratyusa Mukherjee',
        likes: 27,
        dislikes: 16,
        reviews: [
          {
            id: '6590309b45c2b626d34b3b07',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 28,
            comments:
              'Maintain attendence and she will conduct only 2 tests premid and post mid and whatever you get in test that will be your internal and tests questions are from whatever she taught in the class',
            teacherId: '65900f84e771e0a80148ed8d',
          },
        ],
        id: '65a6e829307b55dd8406746f',
      },
      {
        name: 'S. Chaudhuri',
        likes: 12,
        dislikes: 0,
        reviews: [],
        id: null,
      },
      {
        name: 'Shruti',
        likes: 10,
        dislikes: 31,
        reviews: [
          {
            id: '65902c2e45c2b626d34b3b00',
            rating: 1,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 12,
            comments:
              'neither teaches, nor gives marks -- be it internal or sem exams; highest internal score from our sec was about 27-29/50',
            teacherId: '65900f84e771e0a80148ed8e',
          },
          {
            id: '6593fc3845c2b626d34b3b71',
            rating: 1,
            commentedBy: '22052221@kiit.ac.in',
            internalScore: 32,
            comments: ' ',
            teacherId: '65900f84e771e0a80148ed8e',
          },
        ],
        id: null,
      },
      {
        name: 'Arup Abhinna Acharya',
        likes: 36,
        dislikes: 18,
        reviews: [
          {
            id: '65902b5445c2b626d34b3afd',
            rating: 5,
            commentedBy: '2105366@kiit.ac.in',
            internalScore: 28,
            comments:
              'One of the best teachers in the university, but his quizzes can be brutal at times. ',
            teacherId: '65900f84e771e0a80148ed90',
          },
          {
            id: '65903cd045c2b626d34b3b12',
            rating: 5,
            commentedBy: '22054231@kiit.ac.in',
            internalScore: 28,
            comments: 'teaches well ',
            teacherId: '65900f84e771e0a80148ed90',
          },
          {
            id: '6590582345c2b626d34b3b29',
            rating: 5,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 28,
            comments: 'Highly recommended for DSA',
            teacherId: '65900f84e771e0a80148ed90',
          },
          {
            id: '6594254445c2b626d34b3b75',
            rating: 1,
            commentedBy: '22051815@kiit.ac.in',
            internalScore: 26,
            comments:
              "Teaches very well but doesn't gives marks. Very stringent marking. No step marking and no marks for writing algorithms.",
            teacherId: '65900f84e771e0a80148ed90',
          },
        ],
        id: '65a6e829307b55dd840674a7',
      },
      {
        name: 'Pramod Kumar Das',
        likes: 2,
        dislikes: 4,
        reviews: [],
        id: null,
      },
      {
        name: 'Sujata Swain',
        likes: 42,
        dislikes: 11,
        reviews: [],
        id: '65a6e829307b55dd840674f5',
      },
      {
        name: 'Swapnomayee Palit',
        likes: 5,
        dislikes: 3,
        reviews: [],
        id: null,
      },
      {
        name: 'Subhasis Dash',
        likes: 3,
        dislikes: 10,
        reviews: [
          {
            id: '6590466445c2b626d34b3b1b',
            rating: 4,
            commentedBy: '21051974@kiit.ac.in',
            internalScore: 22,
            comments:
              'more than enough knowledgeable. Sometimes his knowledge goes through the other side of the head, but Qn practiced in the class come in exam. If you have patients  select him it will be very beneficial.',
            teacherId: '65900f84e771e0a80148ed94',
          },
          {
            id: '659072be45c2b626d34b3b2a',
            rating: 1,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 20,
            comments: 'He gives quiz on moodles',
            teacherId: '65900f84e771e0a80148ed94',
          },
        ],
        id: '65a6e829307b55dd840674f3',
      },
      {
        name: 'Rajat Kumar Behera',
        likes: 6,
        dislikes: 27,
        reviews: [
          {
            id: '6590733545c2b626d34b3b2b',
            rating: 1,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 15,
            comments: 'He is the worst teacher you can get.',
            teacherId: '65900f84e771e0a80148ed96',
          },
        ],
        id: '65a6e829307b55dd8406746b',
      },
      {
        name: 'Rajdeep Chatterjee',
        likes: 22,
        dislikes: 2,
        reviews: [
          {
            id: '65902c7545c2b626d34b3b02',
            rating: 5,
            commentedBy: '21052882@kiit.ac.in',
            internalScore: 30,
            comments:
              'Bhai GOD inshaan hai. Muh pe phek ke marks dete hain. Koi bhi subject me le lo full marks milega.',
            teacherId: '65900f84e771e0a80148ed95',
          },
        ],
        id: '65a6e829307b55dd84067462',
      },
      {
        name: 'Harish Kumar Patnaik',
        likes: 8,
        dislikes: 24,
        reviews: [
          {
            id: '65901b1345c2b626d34b3ac0',
            rating: 1,
            commentedBy: 'tpiyush2626@gmail.com',
            internalScore: 17,
            comments: 'dont take him',
            teacherId: '65900f84e771e0a80148ed97',
          },
          {
            id: '6595002745c2b626d34b3ba4',
            rating: 1,
            commentedBy: '2228089@kiit.ac.in',
            internalScore: 19,
            comments: 'comes late to class and discuss 1 code and leave',
            teacherId: '65900f84e771e0a80148ed97',
          },
        ],
        id: '65a6e829307b55dd8406746d',
      },
      {
        name: 'Junali Jasmine Jena',
        likes: 4,
        dislikes: 39,
        reviews: [],
        id: '65a6e829307b55dd840674bc',
      },
      {
        name: 'Tanmoy Maitra',
        likes: 3,
        dislikes: 20,
        reviews: [
          {
            id: '65901c3645c2b626d34b3ac7',
            rating: 5,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 29,
            comments:
              'Good knowledge, teaches very well..if you make notes of his class that will be more than enough. Just study that before exams nothing else. Friendly',
            teacherId: '65900f84e771e0a80148ed98',
          },
          {
            id: '6590737245c2b626d34b3b2c',
            rating: 1,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 20,
            comments: 'He is strict.',
            teacherId: '65900f84e771e0a80148ed98',
          },
        ],
        id: '65a6e829307b55dd840674fd',
      },
      {
        name: 'Santosh Kumar Baliarsingh',
        likes: 13,
        dislikes: 17,
        reviews: [
          {
            id: '65901de545c2b626d34b3ad0',
            rating: 2,
            commentedBy: '22054339@kiit.ac.in',
            internalScore: 22,
            comments:
              "Doesn't give much internal mark and very tight copy check in exams...",
            teacherId: '65900f84e771e0a80148ed9b',
          },
          {
            id: '659027e445c2b626d34b3aee',
            rating: 5,
            commentedBy: '2105672@kiit.ac.in',
            internalScore: 28,
            comments:
              "If you want to actually learn something , then he's one of the best teachers.",
            teacherId: '65900f84e771e0a80148ed9b',
          },
        ],
        id: null,
      },
      {
        name: 'Banishree Misra',
        likes: 4,
        dislikes: 6,
        reviews: [
          {
            id: '6590e3a345c2b626d34b3b39',
            rating: 5,
            commentedBy: '22051322@kiit.ac.in',
            internalScore: 29,
            comments: 'Good',
            teacherId: '65900f84e771e0a80148ed9a',
          },
        ],
        id: null,
      },
      {
        name: 'Arpita Goswami',
        likes: 26,
        dislikes: 5,
        reviews: [],
        id: null,
      },
      {
        name: 'K. B. Ray',
        likes: 19,
        dislikes: 18,
        reviews: [
          {
            id: '65902ea945c2b626d34b3b04',
            rating: 5,
            commentedBy: '2205715@kiit.ac.in',
            internalScore: 29,
            comments: 'Very good teacher',
            teacherId: '65900f84e771e0a80148ed9d',
          },
        ],
        id: null,
      },
      {
        name: 'Jayanta Mondal',
        likes: 19,
        dislikes: 1,
        reviews: [
          {
            id: '65904eb645c2b626d34b3b24',
            rating: 5,
            commentedBy: '2105860@kiit.ac.in',
            internalScore: 30,
            comments: ' ',
            teacherId: '65900f84e771e0a80148ed9e',
          },
        ],
        id: '65a6e829307b55dd84067481',
      },
      {
        name: 'Chandra Shekhar',
        likes: 26,
        dislikes: 3,
        reviews: [],
        id: '65a6e829307b55dd840674af',
      },
      {
        name: 'Chittaranjan Pradhan',
        likes: 44,
        dislikes: 8,
        reviews: [
          {
            id: '659046e345c2b626d34b3b1c',
            rating: 4,
            commentedBy: '21051974@kiit.ac.in',
            internalScore: 26,
            comments:
              'accha padhate hai , sare unhi k ppt distribute hote hai to khudhi samajh lo.',
            teacherId: '65900f85e771e0a80148eda0',
          },
          {
            id: '6590dba045c2b626d34b3b32',
            rating: 5,
            commentedBy: '22052950@kiit.ac.in',
            internalScore: 29,
            comments: 'Very good teacher ',
            teacherId: '65900f85e771e0a80148eda0',
          },
        ],
        id: '65a6e829307b55dd840674b0',
      },
      {
        name: 'N. Biraja Isac',
        likes: 19,
        dislikes: 19,
        reviews: [
          {
            id: '659029fc45c2b626d34b3af5',
            rating: 5,
            commentedBy: '2105366@kiit.ac.in',
            internalScore: 30,
            comments:
              'Hare Krishna Hare Ram Krishna Krishna Hare Hare 🙏🙏🛐🛐',
            teacherId: '65900f85e771e0a80148eda1',
          },
        ],
        id: null,
      },
      {
        name: 'Ranjeeta Patel',
        likes: 5,
        dislikes: 1,
        reviews: [],
        id: null,
      },
      {
        name: 'Mamita Dash',
        likes: 20,
        dislikes: 6,
        reviews: [
          {
            id: '65902c6645c2b626d34b3b01',
            rating: 4,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments: 'good teacher',
            teacherId: '65900f85e771e0a80148eda3',
          },
          {
            id: '6590479745c2b626d34b3b1d',
            rating: 5,
            commentedBy: '21051974@kiit.ac.in',
            internalScore: 28,
            comments:
              'strict but provide very good notes. Good teacher . Provide deserving marks ',
            teacherId: '65900f85e771e0a80148eda3',
          },
          {
            id: '6590741745c2b626d34b3b2d',
            rating: 5,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 30,
            comments: 'Very good teacher',
            teacherId: '65900f85e771e0a80148eda3',
          },
          {
            id: '6592dd6145c2b626d34b3b58',
            rating: 1,
            commentedBy: '22052317@kiit.ac.in',
            internalScore: 22,
            comments: 'Pura PPT class mai likhwati hai ',
            teacherId: '65900f85e771e0a80148eda3',
          },
        ],
        id: null,
      },
      {
        name: 'Bhabani Shankar Prasad Mishra',
        likes: 14,
        dislikes: 15,
        reviews: [],
        id: '65a6e829307b55dd840674ac',
      },
      {
        name: 'Kartikeswar Mahalik',
        likes: 4,
        dislikes: 10,
        reviews: [],
        id: null,
      },
      {
        name: 'Satya Champati Rai',
        likes: 14,
        dislikes: 3,
        reviews: [
          {
            id: '659021a345c2b626d34b3adc',
            rating: 4,
            commentedBy: 'khaitanharsh08@gmail.com',
            internalScore: 23,
            comments:
              'Give internals based on knowledge. I will highly recommend this teacher because teacher is very nice. Even if you get low internals, you will learn something for sure. Very sweet teacher. No partiality.',
            teacherId: '65900f85e771e0a80148eda7',
          },
        ],
        id: null,
      },
      {
        name: 'Santwana Sagnika',
        likes: 29,
        dislikes: 0,
        reviews: [],
        id: '65a6e829307b55dd840674e6',
      },
      {
        name: 'Ramesh Kumar Thakur',
        likes: 34,
        dislikes: 1,
        reviews: [
          {
            id: '65902a2645c2b626d34b3af6',
            rating: 5,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 30,
            comments: 'best faculty in whole kiit university',
            teacherId: '65900f85e771e0a80148eda8',
          },
          {
            id: '65902a7445c2b626d34b3af9',
            rating: 5,
            commentedBy: '2105366@kiit.ac.in',
            internalScore: 30,
            comments:
              'Teaching is below average but otherwise an absolute amazing person. ❣️',
            teacherId: '65900f85e771e0a80148eda8',
          },
          {
            id: '65aca35b870bee50deeccbea',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 30,
            comments: 'Best Teacher of It',
            teacherId: '65900f85e771e0a80148eda8',
          },
          {
            id: '65aca3ab870bee50deeccbeb',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 29,
            comments: 'Nice Professor',
            teacherId: '65900f85e771e0a80148eda8',
          },
        ],
        id: '65a6e829307b55dd840674dc',
      },
      {
        name: 'P. Dutta',
        likes: 8,
        dislikes: 0,
        reviews: [
          {
            id: '6592e44845c2b626d34b3b5a',
            rating: 4,
            commentedBy: '2206348@kiit.ac.in',
            internalScore: 28,
            comments:
              'Gave marks even to students who barely submitted assignments',
            teacherId: '65900f85e771e0a80148eda9',
          },
        ],
        id: null,
      },
      {
        name: 'Manoj Kumar Mishra',
        likes: 8,
        dislikes: 2,
        reviews: [],
        id: '65a6e829307b55dd840674cb',
      },
      {
        name: 'Mohit Ranjan Panda',
        likes: 19,
        dislikes: 11,
        reviews: [
          {
            id: '65904dea45c2b626d34b3b22',
            rating: 4,
            commentedBy: '2105974@kiit.ac.in',
            internalScore: 26,
            comments: 'Number acha de dega',
            teacherId: '65900f85e771e0a80148edab',
          },
        ],
        id: '65a6e829307b55dd840674ce',
      },
      {
        name: 'Manas Ranjan Lenka',
        likes: 10,
        dislikes: 43,
        reviews: [
          {
            id: '65901e3145c2b626d34b3ad3',
            rating: 4,
            commentedBy: '21052168@kiit.ac.in',
            internalScore: 21,
            comments: 'Knowledgeable and nice teaching but very strict ',
            teacherId: '65900f85e771e0a80148edad',
          },
          {
            id: '6592cf4c45c2b626d34b3b57',
            rating: 1,
            commentedBy: '22052080@kiit.ac.in',
            internalScore: 17,
            comments: 'ek toh marks nahi diya upar se ghar pe call kar diya',
            teacherId: '65900f85e771e0a80148edad',
          },
        ],
        id: '65a6e829307b55dd84067460',
      },
      {
        name: 'Banchhanidhi Dash',
        likes: 33,
        dislikes: 15,
        reviews: [],
        id: '65a6e829307b55dd840674aa',
      },
      {
        name: 'Sohail Khan',
        likes: 12,
        dislikes: 4,
        reviews: [],
        id: '65a6e829307b55dd840674ee',
      },
      {
        name: 'Kalyani Mohanta',
        likes: 5,
        dislikes: 1,
        reviews: [],
        id: null,
      },
      {
        name: 'Bikash Kumar Behera',
        likes: 8,
        dislikes: 9,
        reviews: [],
        id: null,
      },
      {
        name: 'Suresh Chandra Satapathy',
        likes: 13,
        dislikes: 10,
        reviews: [],
        id: '65a6e829307b55dd840674f7',
      },
      {
        name: 'Sunil Kr. Mishra',
        likes: 8,
        dislikes: 3,
        reviews: [],
        id: null,
      },
      {
        name: 'Mandakini Priyadarshani Behera',
        likes: 5,
        dislikes: 25,
        reviews: [
          {
            id: '65903c8545c2b626d34b3b10',
            rating: 1,
            commentedBy: '2205421@kiit.ac.in',
            internalScore: 24,
            comments:
              "Has no knowledge of the subject herself. Complete bookish knowledge and can't understand shit if you use your own brain and write a code which does not match the one taught in class. Has very poor idea of the subject.",
            teacherId: '65900f85e771e0a80148edb7',
          },
          {
            id: '659155b345c2b626d34b3b4b',
            rating: 1,
            commentedBy: '22052895@kiit.ac.in',
            internalScore: 25,
            comments:
              'kuch nahi aata usko, sahi likha answer bhi kata ke 0 kar degi , na internal deti hai nahi paper checking me',
            teacherId: '65900f85e771e0a80148edb7',
          },
        ],
        id: '65a6e829307b55dd840674ca',
      },
      {
        name: 'Suchismita Das',
        likes: 12,
        dislikes: 5,
        reviews: [],
        id: '65a6e829307b55dd840674f4',
      },
      {
        name: 'Amiya Ranjan Panda',
        likes: 26,
        dislikes: 8,
        reviews: [
          {
            id: '6590351045c2b626d34b3b0c',
            rating: 1,
            commentedBy: '22052643@kiit.ac.in',
            internalScore: 23,
            comments:
              'padhata bahut achha hai , lekin marks lana tough hai aur intenal mein bahut kharap marks deta even if you top in mid semester exam',
            teacherId: '65900f85e771e0a80148edb6',
          },
          {
            id: '65904e1445c2b626d34b3b23',
            rating: 4,
            commentedBy: '2105974@kiit.ac.in',
            internalScore: 24,
            comments:
              'Tension ni dega semester me...number bhi thik thaak de dega',
            teacherId: '65900f85e771e0a80148edb6',
          },
          {
            id: '6590efb645c2b626d34b3b3a',
            rating: 5,
            commentedBy: '22052634@kiit.ac.in',
            internalScore: 25,
            comments:
              "As a teacher, he's a very good one. Doesn't care much about the attendance and is'nt strict at all",
            teacherId: '65900f85e771e0a80148edb6',
          },
        ],
        id: '65a6e829307b55dd840674a4',
      },
      {
        name: 'Sudeshna Datta Chaudhuri',
        likes: 9,
        dislikes: 5,
        reviews: [],
        id: null,
      },
      {
        name: 'Laxmipriya Nayak',
        likes: 180,
        dislikes: 11,
        reviews: [
          {
            id: '659026f145c2b626d34b3ae5',
            rating: 5,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 30,
            comments: 'best',
            teacherId: '65900f85e771e0a80148edb5',
          },
          {
            id: '65904d6745c2b626d34b3b20',
            rating: 5,
            commentedBy: '22054430@kiit.ac.in',
            internalScore: 30,
            comments: 'if we want good mark then select.\n',
            teacherId: '65900f85e771e0a80148edb5',
          },
        ],
        id: null,
      },
      {
        name: 'Partha Sarathi Paul',
        likes: 10,
        dislikes: 9,
        reviews: [
          {
            id: '65902d7845c2b626d34b3b03',
            rating: 1,
            commentedBy: '21052882@kiit.ac.in',
            internalScore: 19,
            comments:
              'Bhai inko dekh k hi neend aa jaati hai. Tumhara answer jaisha bhi ho, agar answer script se match nhi kiya to marks nhi milega, step marks to bhul jao. ',
            teacherId: '65900f85e771e0a80148edb8',
          },
        ],
        id: '65a6e829307b55dd84067469',
      },
      {
        name: 'Ruby Mishra',
        likes: 6,
        dislikes: 2,
        reviews: [],
        id: null,
      },
      {
        name: 'Nayan Kumar S. Behera',
        likes: 26,
        dislikes: 9,
        reviews: [
          {
            id: '6590362745c2b626d34b3b0d',
            rating: 5,
            commentedBy: 'gupta.ayush.kiit@gmail.com',
            internalScore: 25,
            comments: '28',
            teacherId: '65900f85e771e0a80148edbb',
          },
          {
            id: '6593a79045c2b626d34b3b68',
            rating: 2,
            commentedBy: '22052768@kiit.ac.in',
            internalScore: 23,
            comments:
              "Doesn't teach good, also gave very bad marks in internal to everyone in the class\n",
            teacherId: '65900f85e771e0a80148edbb',
          },
        ],
        id: null,
      },
      {
        name: 'Tanik Saikh',
        likes: 6,
        dislikes: 21,
        reviews: [
          {
            id: '659025fb45c2b626d34b3ae2',
            rating: 1,
            commentedBy: '22052705@kiit.ac.in',
            internalScore: 23,
            comments:
              'Not recommended... \nteaching skill is very poor..\nBohot bolne ke bad itna internal marks mila..\nQuiz viva sab cls me paper me le raha tha..\nLekin kuch padhana nahi ata he ..\nKuch bhi samjh nahi aya',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '6590270e45c2b626d34b3ae8',
            rating: 1,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 21,
            comments: 'worst',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '6590d83d45c2b626d34b3b31',
            rating: 1,
            commentedBy: '22053724@kiit.ac.in',
            internalScore: 26,
            comments: 'If you wanna fail go ahead',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '6590f44d45c2b626d34b3b3b',
            rating: 5,
            commentedBy: '22051204@kiit.ac.in',
            internalScore: 28,
            comments:
              'Sir padhata nhi hai utna achha, par unka notes bohot useful hai.',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '659160de45c2b626d34b3b4c',
            rating: 3,
            commentedBy: '22052367@kiit.ac.in',
            internalScore: 30,
            comments:
              'Sare quiz, written tests offline with surprise tests. Kaafi important cheezien miss kar denge aur number bhi nahi denge.(Mera paper copy karne wale ko (dusra section) 32/40 aur mujhe 13/40(no grace marks for topics not covered in class). Attendance theek rakhoge toh thoda easy rahega',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '65926e2945c2b626d34b3b55',
            rating: 2,
            commentedBy: '22053675@kiit.ac.in',
            internalScore: 26,
            comments:
              'The worst teacher in kiit inko liya toh marks bhul jayo, padhate bhi bahat kharab hain, internals v nahi dete bahat mushkil se internals mein thoda badhaya ',
            teacherId: '65900f85e771e0a80148edbd',
          },
        ],
        id: '65a6e829307b55dd840674fb',
      },
      {
        name: 'A Ranjith',
        likes: 10,
        dislikes: 7,
        reviews: [
          {
            id: '65902bf345c2b626d34b3aff',
            rating: 5,
            commentedBy: '21051584@kiit.ac.in',
            internalScore: 29,
            comments: 'Very good teacher',
            teacherId: '65900f85e771e0a80148edb9',
          },
        ],
        id: null,
      },
      {
        name: 'Smrutirekha Mohanty',
        likes: 20,
        dislikes: 7,
        reviews: [],
        id: null,
      },
      {
        name: 'Kumar Devadutta',
        likes: 22,
        dislikes: 10,
        reviews: [
          {
            id: '65901c1645c2b626d34b3ac5',
            rating: 5,
            commentedBy: '21052500@kiit.ac.in',
            internalScore: 29,
            comments:
              'Teaches well, also if you have attendance, you can score full in internals. ',
            teacherId: '65900f85e771e0a80148edbe',
          },
        ],
        id: '65a6e829307b55dd840674c0',
      },
      {
        name: 'Swati Swayamsiddha',
        likes: 14,
        dislikes: 1,
        reviews: [],
        id: null,
      },
      {
        name: 'Vishal Pradhan',
        likes: 25,
        dislikes: 1,
        reviews: [
          {
            id: '6590348045c2b626d34b3b0b',
            rating: 4,
            commentedBy: '22052643@kiit.ac.in',
            internalScore: 27,
            comments: 'Great teaching style.\n',
            teacherId: '65900f85e771e0a80148edbf',
          },
          {
            id: '65930cff45c2b626d34b3b62',
            rating: 5,
            commentedBy: '22052042@kiit.ac.in',
            internalScore: 30,
            comments: 'bestttttttt',
            teacherId: '65900f85e771e0a80148edbf',
          },
        ],
        id: null,
      },
      {
        name: 'Arup Sarkar',
        likes: 16,
        dislikes: 15,
        reviews: [
          {
            id: '65901cc745c2b626d34b3ac8',
            rating: 4,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 30,
            comments: 'Extremely linent. Bharke marks dega…',
            teacherId: '65900f85e771e0a80148edc3',
          },
          {
            id: '65901d0045c2b626d34b3aca',
            rating: 5,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 30,
            comments:
              'Marks dega. Lekin classes bohot boring honge..Friendly bhi ha',
            teacherId: '65900f85e771e0a80148edc3',
          },
        ],
        id: '65a6e829307b55dd840674a8',
      },
      {
        name: 'Priyanka Roy',
        likes: 6,
        dislikes: 48,
        reviews: [
          {
            id: '6591638b45c2b626d34b3b4d',
            rating: 1,
            commentedBy: '22054085@kiit.ac.in',
            internalScore: -2,
            comments: 'worst',
            teacherId: '65900f85e771e0a80148edc2',
          },
        ],
        id: '65a6e829307b55dd84067472',
      },
      {
        name: 'Niten Kumar Panda',
        likes: 4,
        dislikes: 1,
        reviews: [],
        id: null,
      },
      {
        name: 'Manas Ranjan Mohapatra',
        likes: 5,
        dislikes: 3,
        reviews: [],
        id: null,
      },
      {
        name: 'Abinas Panda',
        likes: 14,
        dislikes: 8,
        reviews: [
          {
            id: '6590423045c2b626d34b3b18',
            rating: 3,
            commentedBy: '22051807@kiit.ac.in',
            internalScore: 20,
            comments:
              'Internal ma marks nahi deta baki sa thik ha aur har hafta quize ya classe test leta ha .',
            teacherId: '65900f85e771e0a80148edc5',
          },
        ],
        id: '65a6e829307b55dd8406749b',
      },
      {
        name: 'Anil Kumar Behera',
        likes: 6,
        dislikes: 2,
        reviews: [
          {
            id: '6590223745c2b626d34b3ade',
            rating: 5,
            commentedBy: 'khaitanharsh08@gmail.com',
            internalScore: 30,
            comments:
              'Will give you andha dun marks on paper and teacher. Very young teacher, toh memes se joke bhi karta hai, aur acha khasa roast karega toh be alert',
            teacherId: '65900f85e771e0a80148edc6',
          },
        ],
        id: null,
      },
      {
        name: 'Swayam B Mishra',
        likes: 4,
        dislikes: 0,
        reviews: [
          {
            id: '6590371445c2b626d34b3b0e',
            rating: 3,
            commentedBy: '2205177@kiit.ac.in',
            internalScore: 26,
            comments:
              'average teacher, just reads out the PPts, roams in the class while doing so',
            teacherId: '65900f85e771e0a80148edc7',
          },
        ],
        id: null,
      },
      {
        name: 'Manoranjan Sahoo',
        likes: 27,
        dislikes: 12,
        reviews: [
          {
            id: '6592f5c145c2b626d34b3b5b',
            rating: 4,
            commentedBy: '2205628@kiit.ac.in',
            internalScore: 28,
            comments:
              'Very good teacher, explains well, gives good internals. Only one thing is that never use phone in his class or you are gone!',
            teacherId: '65900f85e771e0a80148edc8',
          },
          {
            id: '6592f5c145c2b626d34b3b5c',
            rating: 4,
            commentedBy: '2205628@kiit.ac.in',
            internalScore: 28,
            comments:
              'Very good teacher, explains well, gives good internals. Only one thing is that never use phone in his class or you are gone!',
            teacherId: '65900f85e771e0a80148edc8',
          },
        ],
        id: null,
      },
      {
        name: 'Mrs. Meghana G Raj',
        likes: 6,
        dislikes: 33,
        reviews: [
          {
            id: '65901f2045c2b626d34b3ad5',
            rating: 1,
            commentedBy: '21052168@kiit.ac.in',
            internalScore: 21,
            comments:
              "Very strict and does not tolerate any indiscipline or even a little bit of disrespectful behaviour such as yawning in her class. Will punish the whole class if any student does the above mentioned thing. Doesn't provide notes, strict marking as if she wants u to fail. ",
            teacherId: '65900f85e771e0a80148edc9',
          },
          {
            id: '65902b4645c2b626d34b3afc',
            rating: 1,
            commentedBy: '21052859@kiit.ac.in',
            internalScore: 18,
            comments:
              'Very strict, won’t give you marks either. Strictly Avoid!',
            teacherId: '65900f85e771e0a80148edc9',
          },
          {
            id: '6590e0b945c2b626d34b3b38',
            rating: 1,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 18,
            comments: 'try to avoid her',
            teacherId: '65900f85e771e0a80148edc9',
          },
        ],
        id: null,
      },
      {
        name: 'Prasant Kumar Pattnaik',
        likes: 11,
        dislikes: 0,
        reviews: [
          {
            id: '65902bc145c2b626d34b3afe',
            rating: 5,
            commentedBy: '21052859@kiit.ac.in',
            internalScore: 28,
            comments:
              'Excellent teacher, teaching in normal but if you want marks, he is the one. Very cool teacher and you can also do projects under hime in future.',
            teacherId: '65900f85e771e0a80148edcb',
          },
        ],
        id: '65a6e829307b55dd840674da',
      },
      {
        name: 'Krutika Verma',
        likes: 6,
        dislikes: 27,
        reviews: [],
        id: '65a6e829307b55dd840674bf',
      },
      {
        name: 'Sudipta Kumar Ghosh',
        likes: 9,
        dislikes: 8,
        reviews: [
          {
            id: '6594477045c2b626d34b3b78',
            rating: 4,
            commentedBy: '22052832@kiit.ac.in',
            internalScore: 25,
            comments: 'badhiya understanding teacher hai',
            teacherId: '65900f85e771e0a80148edca',
          },
        ],
        id: null,
      },
      {
        name: 'Utkal Keshari Dutta',
        likes: 38,
        dislikes: 1,
        reviews: [
          {
            id: '659027e045c2b626d34b3aed',
            rating: 5,
            commentedBy: '21053469@kiit.ac.in',
            internalScore: 29,
            comments: 'Best Teacher, for marks as well as in Teaching. ',
            teacherId: '65900f85e771e0a80148edcd',
          },
          {
            id: '6592ddba45c2b626d34b3b59',
            rating: 5,
            commentedBy: '22052317@kiit.ac.in',
            internalScore: 28,
            comments: 'Marks milta hai bohot\n',
            teacherId: '65900f85e771e0a80148edcd',
          },
          {
            id: '6594103445c2b626d34b3b73',
            rating: 5,
            commentedBy: '22051815@kiit.ac.in',
            internalScore: 30,
            comments:
              'Best Maths Teacher in KIIT!! Very much Student Friendly. Gives good marks in internals to everyone. ',
            teacherId: '65900f85e771e0a80148edcd',
          },
        ],
        id: null,
      },
      {
        name: 'Sarbeswar Mohanty',
        likes: 25,
        dislikes: 2,
        reviews: [],
        id: null,
      },
      {
        name: 'Partha Pratim Sarangi',
        likes: 30,
        dislikes: 16,
        reviews: [],
        id: '65a6e829307b55dd84067464',
      },
      {
        name: 'Mukesh Kumar',
        likes: 15,
        dislikes: 15,
        reviews: [
          {
            id: '65901d9245c2b626d34b3acd',
            rating: 5,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 30,
            comments:
              'Friendly and class me mazak masti krta rehta ha. Lekin Zyada mt kr dena toh gussa ho jayega lekin baad me phirse has deta ha..Min 27 toh dega hi internals agr sab timely submitted ha toh',
            teacherId: '65900f85e771e0a80148edcf',
          },
        ],
        id: '65a6e829307b55dd840674cf',
      },
      {
        name: 'Rachita Panda',
        likes: 6,
        dislikes: 0,
        reviews: [],
        id: null,
      },
      {
        name: 'Amulya Ratna Swain',
        likes: 49,
        dislikes: 10,
        reviews: [
          {
            id: '65901dc145c2b626d34b3acf',
            rating: 1,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 15,
            comments: 'Bhul se bhi mt lena',
            teacherId: '65900f85e771e0a80148edd1',
          },
        ],
        id: '65a6e829307b55dd84067485',
      },
      {
        name: 'Leena Das',
        likes: 3,
        dislikes: 29,
        reviews: [
          {
            id: '6590e09945c2b626d34b3b37',
            rating: 1,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 15,
            comments: '!!!DANGER!!!',
            teacherId: '65900f86e771e0a80148edd4',
          },
        ],
        id: '65a6e829307b55dd840674c3',
      },
      {
        name: 'Ajay Kumar Jena',
        likes: 7,
        dislikes: 17,
        reviews: [
          {
            id: '6590e07645c2b626d34b3b36',
            rating: 4,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 25,
            comments: 'dont know anything but internal meh number deta hai',
            teacherId: '65900f86e771e0a80148edd3',
          },
        ],
        id: '65a6e829307b55dd8406749e',
      },
      {
        name: 'Samaresh Mishra',
        likes: 26,
        dislikes: 9,
        reviews: [],
        id: '65a6e829307b55dd840674e1',
      },
      {
        name: 'Amalesh Kumar Manna',
        likes: 5,
        dislikes: 3,
        reviews: [],
        id: null,
      },
      {
        name: 'S. K. Mohapatra',
        likes: 7,
        dislikes: 13,
        reviews: [
          {
            id: '6593a89145c2b626d34b3b69',
            rating: 1,
            commentedBy: '22052768@kiit.ac.in',
            internalScore: 22,
            comments: "Doesn't teach anything, bad marksin midsem also",
            teacherId: '65900f86e771e0a80148edd6',
          },
        ],
        id: null,
      },
      {
        name: 'Suvendu Barik',
        likes: 21,
        dislikes: 12,
        reviews: [
          {
            id: '6590205445c2b626d34b3ada',
            rating: 3,
            commentedBy: '22053180@kiit.ac.in',
            internalScore: 30,
            comments:
              'Awesome chill teacher.\nGreenest flag ever\nU can trust him blindly ',
            teacherId: '65900f86e771e0a80148eddb',
          },
          {
            id: '6590433345c2b626d34b3b1a',
            rating: 5,
            commentedBy: '22053465@kiit.ac.in',
            internalScore: 30,
            comments: 'Best teacher ever',
            teacherId: '65900f86e771e0a80148eddb',
          },
        ],
        id: null,
      },
      {
        name: 'R. N. Ramakant Parida',
        likes: 5,
        dislikes: 21,
        reviews: [
          {
            id: '6590274545c2b626d34b3ae9',
            rating: 3,
            commentedBy: '21051041@kiit.ac.in',
            internalScore: 26,
            comments:
              'teaches good \nstrict \nwill give good marks if uh pay attention in class',
            teacherId: '65900f86e771e0a80148edda',
          },
          {
            id: '659074ee45c2b626d34b3b2e',
            rating: 1,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 1530,
            comments:
              'The worst you can have in entire KIIT. Quizes are offline all or nothing. Stay miles away from him.',
            teacherId: '65900f86e771e0a80148edda',
          },
        ],
        id: null,
      },
      {
        name: 'Santosh Kumar Pani',
        likes: 17,
        dislikes: 1,
        reviews: [
          {
            id: '6592afe245c2b626d34b3b56',
            rating: 5,
            commentedBy: '22051722@kiit.ac.in',
            internalScore: 28,
            comments: 'very chill',
            teacherId: '65900f86e771e0a80148edd9',
          },
          {
            id: '6593edad45c2b626d34b3b6e',
            rating: 5,
            commentedBy: '21052316@kiit.ac.in',
            internalScore: 30,
            comments: 'best teacher in terms of everything',
            teacherId: '65900f86e771e0a80148edd9',
          },
        ],
        id: '65a6e829307b55dd840674e4',
      },
      {
        name: 'Benazir Neha',
        likes: 39,
        dislikes: 8,
        reviews: [
          {
            id: '65910eb145c2b626d34b3b40',
            rating: 5,
            commentedBy: '2205919@kiit.ac.in',
            internalScore: 27,
            comments: 'Teaches ok and gives lots of marks.',
            teacherId: '65900f86e771e0a80148edd8',
          },
          {
            id: '65943cf545c2b626d34b3b76',
            rating: 5,
            commentedBy: '22051073@kiit.ac.in',
            internalScore: 27,
            comments:
              'Internal mein bhi theek hi de deti hai but mid sem and end sem mein bhar bhar ke marks milenge and padhati bhi sahi hai kaafi',
            teacherId: '65900f86e771e0a80148edd8',
          },
        ],
        id: '65a6e829307b55dd840674ab',
      },
      {
        name: 'Satish Kumar Gannamaneni',
        likes: 11,
        dislikes: 20,
        reviews: [
          {
            id: '6593a8bf45c2b626d34b3b6a',
            rating: 5,
            commentedBy: '2206338@kiit.ac.in',
            internalScore: 27,
            comments:
              'idk why so many dislikes...but marks acha deta hai...expectation se zyada. Han bas thoda strict hai aur paka ta bhi hai.\n',
            teacherId: '65900f86e771e0a80148ede2',
          },
          {
            id: '6594822645c2b626d34b3b7c',
            rating: 4,
            commentedBy: '2206290@kiit.ac.in',
            internalScore: 27,
            comments:
              'Isko class lo Mt lo frk nhi padhta .. bs end mai exam Dene jitni attendance ho .. internal Chadha deta hai sahi aur checking bhi acchi krta hai. Overall theek hai class etiquettes ke bare mai bohot lecture deta hai',
            teacherId: '65900f86e771e0a80148ede2',
          },
        ],
        id: null,
      },
      {
        name: 'Sourajit Behera',
        likes: 20,
        dislikes: 4,
        reviews: [
          {
            id: '6590276945c2b626d34b3aeb',
            rating: 5,
            commentedBy: '21051041@kiit.ac.in',
            internalScore: 28,
            comments: 'best teacher ever',
            teacherId: '65900f86e771e0a80148ede0',
          },
          {
            id: '6590279445c2b626d34b3aec',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 28,
            comments: 'Chill teacher ever You can go for it',
            teacherId: '65900f86e771e0a80148ede0',
          },
          {
            id: '6594220345c2b626d34b3b74',
            rating: 5,
            commentedBy: '22052610@kiit.ac.in',
            internalScore: 2,
            comments: '1',
            teacherId: '65900f86e771e0a80148ede0',
          },
        ],
        id: '65a6e829307b55dd840674ef',
      },
      {
        name: 'Gananath Bhuyan',
        likes: 21,
        dislikes: 9,
        reviews: [
          {
            id: '6590f55f45c2b626d34b3b3c',
            rating: 5,
            commentedBy: '22052843@kiit.ac.in',
            internalScore: 28,
            comments:
              'I know strict teacher hai, but internals dete hai lekin attendance cut kar lete hai, padhate good hai',
            teacherId: '65900f86e771e0a80148eddf',
          },
        ],
        id: '65a6e829307b55dd840674b4',
      },
      {
        name: 'Dayal Kumar Behera',
        likes: 20,
        dislikes: 0,
        reviews: [
          {
            id: '6590283345c2b626d34b3aef',
            rating: 4,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 27,
            comments:
              'He will take surprise test in class and if you attend more than 80% and if you just write anything in exam still he gives marks',
            teacherId: '65900f86e771e0a80148eddd',
          },
        ],
        id: '65a6e829307b55dd84067487',
      },
      {
        name: 'Madhusudan Bera',
        likes: 21,
        dislikes: 11,
        reviews: [
          {
            id: '6590e04945c2b626d34b3b35',
            rating: 3,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 20,
            comments: 'if dont have better option then go with him',
            teacherId: '65900f86e771e0a80148edde',
          },
        ],
        id: null,
      },
      {
        name: 'Abhaya Kumar Sahoo',
        likes: 15,
        dislikes: 1,
        reviews: [
          {
            id: '6590276045c2b626d34b3aea',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 30,
            comments: 'He is just nice',
            teacherId: '65900f86e771e0a80148ede1',
          },
        ],
        id: '65a6e829307b55dd84067498',
      },
      {
        name: 'Nibedan Panda',
        likes: 21,
        dislikes: 9,
        reviews: [],
        id: '65a6e829307b55dd840674d4',
      },
      {
        name: 'Subhadip Pramanik',
        likes: 9,
        dislikes: 1,
        reviews: [],
        id: '65a6e829307b55dd840674f1',
      },
      {
        name: 'Ipsita Paul',
        likes: 9,
        dislikes: 18,
        reviews: [
          {
            id: '6590221745c2b626d34b3add',
            rating: 1,
            commentedBy: '21051716@kiit.ac.in',
            internalScore: 23,
            comments:
              "She don't clear any doubt. Other than study she can talk about anything. Boys who talk random things and entertain her will got marks not on the basis of talent",
            teacherId: '65900f86e771e0a80148ede5',
          },
          {
            id: '6590270545c2b626d34b3ae7',
            rating: 1,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 25,
            comments: "Worst teacher don't expect from her",
            teacherId: '65900f86e771e0a80148ede5',
          },
          {
            id: '6590e02645c2b626d34b3b34',
            rating: 1,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 18,
            comments: 'bad ',
            teacherId: '65900f86e771e0a80148ede5',
          },
        ],
        id: '65a6e829307b55dd8406747f',
      },
      {
        name: 'Dipti Dash',
        likes: 19,
        dislikes: 0,
        reviews: [],
        id: '65a6e829307b55dd840674b2',
      },
      {
        name: 'Pinaki Sankar Chatterjee',
        likes: 11,
        dislikes: 16,
        reviews: [],
        id: '65a6e829307b55dd840674d6',
      },
      {
        name: 'Raghunath Dey',
        likes: 14,
        dislikes: 2,
        reviews: [
          {
            id: '6590dfff45c2b626d34b3b33',
            rating: 3,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 26,
            comments: 'good teaher linient in marks ',
            teacherId: '65900f88e771e0a80148ede7',
          },
        ],
        id: '65a6e829307b55dd84067493',
      },
      {
        name: 'Sourav Kumar Giri',
        likes: 9,
        dislikes: 1,
        reviews: [],
        id: '65a6e829307b55dd840674f0',
      },
      {
        name: 'Anuja Kumar Acharya',
        likes: 18,
        dislikes: 18,
        reviews: [
          {
            id: '65901cdf45c2b626d34b3ac9',
            rating: 3,
            commentedBy: '22051843@kiit.ac.in',
            internalScore: 24,
            comments: 'I would recommend mat lena. Risky sir hai. ',
            teacherId: '65900f83e771e0a80148ed4b',
          },
          {
            id: '65902a7845c2b626d34b3afa',
            rating: 5,
            commentedBy: '21053436@kiit.ac.in',
            internalScore: 30,
            comments:
              'He taught good, gave marks, but when i applied for recheck he never recheked it.',
            teacherId: '65900f83e771e0a80148ed4b',
          },
          {
            id: '6593903f45c2b626d34b3b66',
            rating: 1,
            commentedBy: '2205316@kiit.ac.in',
            internalScore: 20,
            comments: 'unnecessarily strict',
            teacherId: '65900f83e771e0a80148ed4b',
          },
        ],
        id: '65a6e829307b55dd840674a6',
      },
      {
        name: 'Sujoy Datta',
        likes: 67,
        dislikes: 17,
        reviews: [
          {
            id: '65901d2145c2b626d34b3acb',
            rating: 5,
            commentedBy: '22054339@kiit.ac.in',
            internalScore: 30,
            comments:
              'You will get good internal marks if ur attendance is decent...',
            teacherId: '65900f83e771e0a80148ed4c',
          },
          {
            id: '659022e045c2b626d34b3adf',
            rating: 5,
            commentedBy: 'donkeyking1856@gmail.com',
            internalScore: 26,
            comments: 'just maintain assignments and attendence\n',
            teacherId: '65900f83e771e0a80148ed4c',
          },
          {
            id: '6591327445c2b626d34b3b44',
            rating: 5,
            commentedBy: '22054341@kiit.ac.in',
            internalScore: 29,
            comments: '\n',
            teacherId: '65900f83e771e0a80148ed4c',
          },
          {
            id: '65931e2945c2b626d34b3b64',
            rating: 5,
            commentedBy: '22052219@kiit.ac.in',
            internalScore: -1,
            comments: 'good teacher, gives decent marks',
            teacherId: '65900f83e771e0a80148ed4c',
          },
        ],
        id: '65a6e829307b55dd84067482',
      },
    ];

    // const filterReal = real.filter((r)=>r.id!==null);
    // return filterReal;

    // return  allFaculties;
  }

  //  filterObjectsByMatchingName(array1: any, array2: any) {
  //   return array1.map(obj1 => array2.some(obj2 =>{
  //     if( obj1.name === obj2.name){
  //       return{
  //         ...obj1,
  //         id:obj2.id
  //       }
  //     }
  //   }));
  // }

  matchAndAssignIds(array1: any, array2: any) {
    return new Promise((resolve) => {
      array1.forEach((obj1) => {
        const matchedObj = array2.find((obj2) => obj1.name === obj2.name);
        if (matchedObj) {
          obj1.id = matchedObj.id;
        } else {
          obj1.id = null;
        }
      });
      resolve(array1);
    });
  }

  getRandomIndex(array) {
    return Math.floor(Math.random() * array.length);
  }

  async addReviewsToFacultiesDetails() {
    // const data =

    const allId = [
      '65b51b8271212d151fedf6b5',
      '65b51e7a71212d151fedf6b7',
      '65b51ea871212d151fedf6b8',
      '65b5233847ab2137a3346d23',
      '65b5236047ab2137a3346d24',
      '65b525a447ab2137a3346d25',
      '65b525b147ab2137a3346d26',
      '65b525bd47ab2137a3346d27',
      '65b525c947ab2137a3346d28',
      '65b5261447ab2137a3346d29',
      '65b5263747ab2137a3346d2a',
      '65b5267847ab2137a3346d2c',
      '65b5268647ab2137a3346d2d',
      '65b5270e47ab2137a3346d2e',
      '65b5275147ab2137a3346d2f',
      '65b527ea47ab2137a3346d30',
      '65b527f147ab2137a3346d31',
      '65b5293447ab2137a3346d34',
      '65b52a9547ab2137a3346d38',
      '65b52c0a47ab2137a3346d39',
      '65b52c7947ab2137a3346d3a',
      '65b5300b47ab2137a3346d3b',
      '65b531a347ab2137a3346d3c',
      '65b531fc47ab2137a3346d3d',
      '65b5320847ab2137a3346d3e',
      '65b534ec47ab2137a3346d3f',
      '65b5358447ab2137a3346d40',
      '65b537d847ab2137a3346d41',
      '65b53e9a47ab2137a3346d42',
      '65b5506547ab2137a3346d43',
      '65b5507147ab2137a3346d44',
      '65b5576c47ab2137a3346d45',
      '65b563bc47ab2137a3346d46',
      '65b5bf7f47ab2137a3346d47',
      '65b5c24247ab2137a3346d48',
      '65b5cb9f47ab2137a3346d49',
      '65b5cc6347ab2137a3346d4a',
      '65b5db1547ab2137a3346d4b',
      '65b5e6e747ab2137a3346d4c',
      '65b5e84f47ab2137a3346d4d',
      '65b5ebb347ab2137a3346d4f',
      '65b5ec2e47ab2137a3346d50',
      '65b5f14a47ab2137a3346d51',
      '65b5f8da47ab2137a3346d52',
      '65b5fad347ab2137a3346d53',
      '65b5fb4547ab2137a3346d54',
      '65b6046b47ab2137a3346d55',
      '65b6051847ab2137a3346d56',
      '65b6096347ab2137a3346d57',
      '65b60bb247ab2137a3346d58',
      '65b62d3e47ab2137a3346d59',
      '65b639fd47ab2137a3346d5a',
      '65b6451047ab2137a3346d5b',
      '65b6608247ab2137a3346d5c',
      '65b6644747ab2137a3346d5d',
      '65b66b4747ab2137a3346d5e',
      '65b66e8347ab2137a3346d5f',
      '65b67a0547ab2137a3346d60',
      '65b687e547ab2137a3346d61',
      '65b6932b47ab2137a3346d64',
      '65b6a3e647ab2137a3346d66',
      '65b6b1a747ab2137a3346d67',
      '65b72d5547ab2137a3346d68',
      '65b7315e47ab2137a3346d69',
      '65b7353547ab2137a3346d6a',
      '65b7415547ab2137a3346d6b',
      '65b7480547ab2137a3346d6d',
      '65b74b8d47ab2137a3346d6e',
      '65b74cf647ab2137a3346d6f',
      '65b74d1147ab2137a3346d70',
      '65b74d4147ab2137a3346d71',
      '65b74eb847ab2137a3346d72',
      '65b74f7847ab2137a3346d73',
      '65b74fba47ab2137a3346d74',
      '65b7507847ab2137a3346d75',
      '65b750d047ab2137a3346d76',
      '65b752fb47ab2137a3346d77',
      '65b753d547ab2137a3346d78',
      '65b754e647ab2137a3346d79',
      '65b7558f47ab2137a3346d7a',
      '65b757ce47ab2137a3346d7b',
      '65b75b7f47ab2137a3346d7c',
      '65b75f6f47ab2137a3346d7d',
      '65b7606847ab2137a3346d7e',
      '65b7633647ab2137a3346d7f',
      '65b765d547ab2137a3346d80',
      '65b768dc47ab2137a3346d81',
      '65b76bd747ab2137a3346d82',
      '65b7716247ab2137a3346d83',
      '65b773ac47ab2137a3346d84',
      '65b778b747ab2137a3346d85',
      '65b77f1f47ab2137a3346d86',
      '65b7920e47ab2137a3346d87',
      '65b7969847ab2137a3346d88',
      '65b7a30e47ab2137a3346d89',
      '65b7ab5a47ab2137a3346d8a',
      '65b7af6647ab2137a3346d8b',
      '65b7b4bd47ab2137a3346d8c',
      '65b7b6da47ab2137a3346d8d',
      '65b7bd9247ab2137a3346d8e',
      '65b7c10a47ab2137a3346d8f',
      '65b7c15d47ab2137a3346d90',
      '65b7cb1c47ab2137a3346d91',
      '65b7cebb47ab2137a3346d92',
      '65b7db5e47ab2137a3346d93',
      '65b7e5c447ab2137a3346d94',
      '65b7e8ed47ab2137a3346d95',
      '65b7ef8b47ab2137a3346d96',
      '65b7f59f47ab2137a3346d97',
      '65b7f9e847ab2137a3346d98',
      '65b7ff5b47ab2137a3346d99',
      '65b8222747ab2137a3346d9a',
      '65b8259547ab2137a3346d9b',
      '65b85af247ab2137a3346d9c',
      '65b86fe347ab2137a3346d9d',
      '65b8738247ab2137a3346d9e',
      '65b8760647ab2137a3346d9f',
      '65b88ed147ab2137a3346da0',
      '65b8a81147ab2137a3346da1',
      '65b8b20747ab2137a3346da2',
      '65b8b52f47ab2137a3346da3',
      '65b8c18047ab2137a3346da4',
      '65b8c3ed47ab2137a3346da5',
      '65b8d57647ab2137a3346da6',
      '65b8d89347ab2137a3346da7',
      '65b8f03c47ab2137a3346da8',
      '65b8f8ec47ab2137a3346da9',
      '65b9011e47ab2137a3346daa',
      '65b9021047ab2137a3346dab',
      '65b904b047ab2137a3346dac',
      '65b90a0347ab2137a3346dad',
      '65b90f3947ab2137a3346dae',
      '65b91cc747ab2137a3346daf',
      '65b9241a47ab2137a3346db0',
      '65b9256d47ab2137a3346db1',
      '65b944cc47ab2137a3346db2',
      '65b9b64d47ab2137a3346db3',
      '65b9be4047ab2137a3346db4',
      '65b9d1db47ab2137a3346db5',
      '65b9ef3b47ab2137a3346db6',
      '65b9f0d247ab2137a3346db7',
      '65b9f7d647ab2137a3346db8',
      '65b9f88847ab2137a3346db9',
      '65ba467247ab2137a3346dba',
      '65ba534847ab2137a3346dbb',
      '65ba54c647ab2137a3346dbc',
      '65ba636547ab2137a3346dbd',
      '65ba7b1147ab2137a3346dbe',
      '65ba835547ab2137a3346dbf',
      '65ba8c0047ab2137a3346dc0',
      '65ba943147ab2137a3346dc1',
      '65baa9a147ab2137a3346dc2',
      '65bac51647ab2137a3346dc3',
      '65bb037a47ab2137a3346dc4',
      '65bb1a6247ab2137a3346dc5',
      '65bb597347ab2137a3346dc6',
      '65bba14447ab2137a3346dc7',
      '65bba54647ab2137a3346dc8',
      '65bba63a47ab2137a3346dc9',
      '65bba76a47ab2137a3346dca',
      '65bba89247ab2137a3346dcb',
      '65bbb07247ab2137a3346dcc',
      '65bbb09447ab2137a3346dcd',
      '65bc647a47ab2137a3346dce',
      '65bc9b6b47ab2137a3346dcf',
      '65bc9edc47ab2137a3346dd0',
      '65bcceeb47ab2137a3346dd1',
      '65bcf09c47ab2137a3346dd2',
      '65bcf24747ab2137a3346dd3',
      '65bd00f047ab2137a3346dd4',
      '65bd10ed47ab2137a3346dd5',
      '65bd130647ab2137a3346dd6',
      '65bd162347ab2137a3346dd7',
      '65bd266147ab2137a3346dd8',
      '65bd286047ab2137a3346dd9',
      '65bd2b5947ab2137a3346dda',
      '65bd35ce47ab2137a3346ddb',
      '65bd49ec47ab2137a3346ddc',
      '65bdc4cb47ab2137a3346ddd',
      '65be1fe047ab2137a3346ddf',
      '65be29ad47ab2137a3346de0',
      '65be2f8747ab2137a3346de1',
      '65be4f4347ab2137a3346de2',
      '65be574147ab2137a3346de3',
      '65be57d347ab2137a3346de4',
      '65be580d47ab2137a3346de5',
      '65be5b0b47ab2137a3346de6',
      '65be607647ab2137a3346de7',
      '65be6b8c47ab2137a3346de8',
      '65be728747ab2137a3346de9',
      '65be730547ab2137a3346dea',
      '65be7ae047ab2137a3346deb',
      '65be7be147ab2137a3346dec',
      '65be7d7e47ab2137a3346ded',
      '65be804d47ab2137a3346dee',
      '65be80be47ab2137a3346def',
      '65be866347ab2137a3346df0',
      '65be8a2747ab2137a3346df1',
      '65be8a9f47ab2137a3346df2',
      '65bea07a47ab2137a3346df3',
      '65bf0de247ab2137a3346df4',
      '65bf373047ab2137a3346df5',
      '65bf564947ab2137a3346df6',
      '65bfb7aa0985a524b12d0417',
      '65bfbdde0985a524b12d0418',
      '65bfbf8f0985a524b12d0419',
      '65bfc1180985a524b12d041a',
      '65bfcb570985a524b12d041b',
      '65bfcd530985a524b12d041c',
      '65bfd86f0985a524b12d041d',
      '65bfd8ac0985a524b12d041e',
      '65c061820985a524b12d041f',
      '65c0699e0985a524b12d0426',
      '65c06bfc0985a524b12d0429',
      '65c0b5ef0985a524b12d042a',
      '65c0f8e20985a524b12d042b',
      '65c1006a0985a524b12d042c',
      '65c1007d0985a524b12d042d',
      '65c119580985a524b12d042e',
      '65c119670985a524b12d042f',
      '65c11acb0985a524b12d0430',
      '65c12b740985a524b12d0431',
      '65c12f950985a524b12d0432',
      '65c13bcb0985a524b12d0433',
      '65c1ade90985a524b12d0434',
      '65c1caf60985a524b12d0435',
      '65c1eaf60985a524b12d0436',
      '65c1f49e0985a524b12d0437',
      '65c206a10985a524b12d0438',
      '65c20c610985a524b12d0439',
      '65c21e2f0985a524b12d043a',
      '65c22b5d0985a524b12d043b',
      '65c22ebb0985a524b12d043c',
      '65c244da0985a524b12d043d',
      '65c24a3f0985a524b12d043e',
      '65c258a70985a524b12d043f',
      '65c2598c0985a524b12d0440',
      '65c259ef0985a524b12d0441',
      '65c2654f0985a524b12d0442',
      '65c280260985a524b12d0443',
      '65c30c7e0985a524b12d0444',
      '65c31dd40985a524b12d0445',
      '65c321140985a524b12d0446',
      '65c3235c0985a524b12d0447',
      '65c3d63d0985a524b12d0448',
      '65c3d8fb0985a524b12d0449',
      '65c3e9450985a524b12d044a',
      '65c44d820985a524b12d044b',
      '65c45bc50985a524b12d044c',
      '65c4a49a0985a524b12d044d',
      '65c4c05e0985a524b12d044e',
      '65c4d7090985a524b12d044f',
      '65c4dfcc0985a524b12d0450',
      '65c4f5620985a524b12d0451',
      '65c5108e0985a524b12d0452',
      '65c52e4a0985a524b12d0453',
      '65c598ba0985a524b12d0454',
      '65c5a0230985a524b12d0455',
      '65c5c10b0985a524b12d0456',
      '65c5efca0985a524b12d0457',
      '65c62f9d0985a524b12d0458',
      '65c666440985a524b12d0459',
      '65c781b70985a524b12d045a',
      '65c787230985a524b12d045b',
      '65c78cdd0985a524b12d045c',
      '65c793760985a524b12d045d',
      '65c7a3790985a524b12d045e',
      '65c7aa3e0985a524b12d045f',
      '65c7c47a0985a524b12d0460',
      '65c83b260985a524b12d0461',
      '65c8ad190985a524b12d0462',
      '65c8ba5e0985a524b12d0463',
      '65c8c03d0985a524b12d0464',
      '65c8d3b10985a524b12d0465',
      '65c8e3f90985a524b12d0466',
      '65c8ebbd0985a524b12d0467',
      '65c8ed1c0985a524b12d0468',
      '65c91f760985a524b12d0469',
      '65c925790985a524b12d046a',
      '65c950060985a524b12d046b',
      '65c98f980985a524b12d046c',
      '65c991eb0985a524b12d046d',
      '65c9a3da0985a524b12d046e',
      '65c9a5bb0985a524b12d046f',
      '65c9b4570985a524b12d0470',
      '65c9b7710985a524b12d0471',
      '65c9c2aa0985a524b12d0472',
      '65c9e8cb0985a524b12d0473',
      '65c9ea030985a524b12d0474',
      '65c9f1920985a524b12d0475',
      '65ca44a40985a524b12d0476',
      '65ca68d90985a524b12d0477',
      '65ca91250985a524b12d0478',
      '65cae3020985a524b12d0479',
      '65caf3810985a524b12d047a',
      '65cb00190985a524b12d047b',
      '65cb5f6e0985a524b12d047c',
      '65cb66d40985a524b12d047d',
      '65cb7a420985a524b12d047e',
      '65cba3e30985a524b12d047f',
      '65cbafaf0985a524b12d0480',
      '65cbb1f40985a524b12d0481',
      '65cbb24a0985a524b12d0482',
      '65cbc6700985a524b12d0483',
      '65cbd4250985a524b12d0484',
      '65cc71410985a524b12d0485',
      '65cce2d60985a524b12d0486',
      '65cd89cd0985a524b12d0487',
      '65cda3ff0985a524b12d0488',
      '65cda7fc0985a524b12d0489',
      '65cdb40a0985a524b12d048a',
      '65cdc7440985a524b12d048b',
      '65cddcd40985a524b12d048c',
      '65ce1dd20985a524b12d048d',
      '65ce44500985a524b12d048e',
      '65ce69450985a524b12d048f',
      '65cee9d70985a524b12d0490',
      '65cf824b0985a524b12d0491',
      '65cfaed50985a524b12d0492',
      '65cfb5cd0985a524b12d0493',
      '65d028310985a524b12d0494',
      '65d049050985a524b12d0495',
      '65d05d870985a524b12d0496',
      '65d05fd30985a524b12d0497',
      '65d067440985a524b12d0498',
      '65d06c400985a524b12d0499',
      '65d07085afa614e831481aeb',
      '65d07265afa614e831481aec',
      '65d073dcafa614e831481aed',
      '65d07534afa614e831481aee',
      '65d0774bafa614e831481aef',
      '65d0812fafa614e831481af1',
      '65d084f2afa614e831481af2',
      '65d0860bafa614e831481af3',
      '65d08627afa614e831481af4',
      '65d08632afa614e831481af5',
      '65d08766afa614e831481af7',
      '65d0878eafa614e831481af8',
      '65d087c8afa614e831481af9',
      '65d087e6afa614e831481afa',
      '65d08805afa614e831481afd',
      '65d08862afa614e831481b01',
      '65d088afafa614e831481b02',
      '65d088bdafa614e831481b03',
      '65d08921afa614e831481b06',
      '65d0893fafa614e831481b07',
      '65d08954afa614e831481b08',
      '65d08980afa614e831481b09',
      '65d08986afa614e831481b0a',
      '65d089b5afa614e831481b0c',
      '65d089d2afa614e831481b0f',
      '65d08a21afa614e831481b10',
      '65d08a78afa614e831481b11',
      '65d08a7bafa614e831481b12',
      '65d08b05afa614e831481b13',
      '65d08f4cafa614e831481b17',
      '65d08fdbafa614e831481b18',
      '65d0903cafa614e831481b19',
      '65d0908eafa614e831481b1a',
      '65d09151afa614e831481b1d',
      '65d091dcafa614e831481b1e',
      '65d093b7afa614e831481b1f',
      '65d093e3afa614e831481b20',
      '65d094cdafa614e831481b21',
      '65d094fdafa614e831481b22',
      '65d09652afa614e831481b24',
      '65d097c6afa614e831481b25',
      '65d09af1afa614e831481b26',
      '65d09b68afa614e831481b27',
      '65d09edcafa614e831481b29',
      '65d09fbdafa614e831481b2a',
      '65d0a261afa614e831481b2c',
      '65d0a2f9afa614e831481b2e',
      '65d0a36aafa614e831481b2f',
      '65d0a55aafa614e831481b30',
      '65d0a67dafa614e831481b32',
      '65d0a6acafa614e831481b33',
      '65d0a6b6afa614e831481b34',
      '65d0a6e2afa614e831481b35',
      '65d0a6e3afa614e831481b36',
      '65d0a732afa614e831481b38',
      '65d0a762afa614e831481b39',
      '65d0a8caafa614e831481b3b',
      '65d0a8e9afa614e831481b3c',
      '65d0a929afa614e831481b3d',
      '65d0a9e3afa614e831481b3e',
      '65d0aa3aafa614e831481b40',
      '65d0aa9dafa614e831481b42',
      '65d0aa9fafa614e831481b43',
      '65d0aab9afa614e831481b44',
      '65d0ab6dafa614e831481b45',
      '65d0abe4afa614e831481b46',
      '65d0ad0cafa614e831481b47',
      '65d0adb4afa614e831481b48',
      '65d0ae3aafa614e831481b49',
      '65d0ae64afa614e831481b4a',
      '65d0aef4afa614e831481b4c',
      '65d0afacafa614e831481b4d',
      '65d0b005afa614e831481b4f',
      '65d0b017afa614e831481b50',
      '65d0b033afa614e831481b51',
      '65d0b104afa614e831481b53',
      '65d0b13eafa614e831481b54',
      '65d0b186afa614e831481b55',
      '65d0b1b7afa614e831481b56',
      '65d0b2baafa614e831481b58',
      '65d0b30dafa614e831481b59',
      '65d0b3b1afa614e831481b5a',
      '65d0b47dafa614e831481b5c',
      '65d0b4f7afa614e831481b5d',
      '65d0b55aafa614e831481b5e',
      '65d0b774afa614e831481b5f',
      '65d0b8b1afa614e831481b60',
      '65d0ba20afa614e831481b62',
      '65d0ba2eafa614e831481b63',
      '65d0ba34afa614e831481b64',
      '65d0bae9afa614e831481b66',
      '65d0bb83afa614e831481b68',
      '65d0bbb4afa614e831481b69',
      '65d0bcb0afa614e831481b6b',
      '65d0bdafafa614e831481b6c',
      '65d0be04afa614e831481b6d',
      '65d0be39afa614e831481b6e',
      '65d0be76afa614e831481b70',
      '65d0bec9afa614e831481b71',
      '65d0bf01afa614e831481b73',
      '65d0bf9dafa614e831481b76',
      '65d0c068afa614e831481b78',
      '65d0c0a0afa614e831481b79',
      '65d0c158afa614e831481b7b',
      '65d0c219afa614e831481b7c',
      '65d0c259afa614e831481b7d',
      '65d0c3abafa614e831481b7e',
      '65d0c473afa614e831481b7f',
      '65d0c50dafa614e831481b80',
      '65d0c5e2afa614e831481b82',
      '65d0c747afa614e831481b83',
      '65d0c89bafa614e831481b85',
      '65d0cb6dafa614e831481b86',
      '65d0cc41afa614e831481b87',
      '65d0cec0afa614e831481b88',
      '65d0cedaafa614e831481b89',
      '65d0cf96afa614e831481b8b',
      '65d0cff5afa614e831481b8c',
      '65d0d1dfafa614e831481b8d',
      '65d0d25cafa614e831481b8e',
      '65d0d473afa614e831481b90',
      '65d0d6ffafa614e831481b92',
      '65d0d7f5afa614e831481b93',
      '65d0d9f3afa614e831481b95',
      '65d0dd88afa614e831481b96',
      '65d0df39afa614e831481b97',
      '65d0df64afa614e831481b98',
      '65d0dff3afa614e831481b9a',
      '65d0e17aafa614e831481b9c',
      '65d0e19aafa614e831481b9d',
      '65d0e1f7afa614e831481b9e',
      '65d0e2a2afa614e831481b9f',
      '65d0e305afa614e831481ba1',
      '65d0e32fafa614e831481ba2',
      '65d0e35dafa614e831481ba3',
      '65d0e45dafa614e831481ba5',
      '65d0e4d1afa614e831481ba6',
      '65d0e574afa614e831481ba7',
      '65d0e71aafa614e831481ba8',
      '65d0ea06afa614e831481ba9',
      '65d0ea7bafa614e831481bab',
      '65d0ea9dafa614e831481bac',
      '65d0eb7bafa614e831481baf',
      '65d0ececafa614e831481bb0',
      '65d0ed63afa614e831481bb1',
      '65d0ed7bafa614e831481bb2',
      '65d0ee31afa614e831481bb3',
      '65d0ee86afa614e831481bb5',
      '65d0f408afa614e831481bb8',
      '65d0f443afa614e831481bb9',
      '65d0f4baafa614e831481bba',
      '65d0f5ecafa614e831481bbc',
      '65d0f65bafa614e831481bbd',
      '65d0f6b7afa614e831481bbf',
      '65d0f6d8afa614e831481bc1',
      '65d0f86dafa614e831481bc2',
      '65d0f878afa614e831481bc3',
      '65d0f9ddafa614e831481bc4',
      '65d0fbe0afa614e831481bc7',
      '65d0fcbdafa614e831481bc9',
      '65d0fccfafa614e831481bca',
      '65d0fd47afa614e831481bcb',
      '65d0fda8afa614e831481bcc',
      '65d0fdd6afa614e831481bcd',
      '65d0ffc2afa614e831481bce',
      '65d1029cafa614e831481bd0',
      '65d10532afa614e831481bd2',
      '65d108d8afa614e831481bd3',
      '65d1096bafa614e831481bd4',
      '65d10a14afa614e831481bd5',
      '65d10b05afa614e831481bd7',
      '65d10b19afa614e831481bd8',
      '65d10b1bafa614e831481bd9',
      '65d10b74afa614e831481bda',
      '65d10db4afa614e831481bdc',
      '65d10e66afa614e831481bde',
      '65d10fc9afa614e831481bdf',
      '65d10fd2afa614e831481be0',
      '65d11188afa614e831481be3',
      '65d1126cafa614e831481be6',
      '65d117f7afa614e831481be9',
      '65d1180bafa614e831481bea',
      '65d119c3afa614e831481bec',
      '65d11c5aafa614e831481bed',
      '65d11ecdafa614e831481bef',
      '65d12602afa614e831481bf1',
      '65d13797afa614e831481bf2',
      '65d1677fafa614e831481bf4',
      '65d16fecafa614e831481bf7',
      '65d1801aafa614e831481bf9',
      '65d18373afa614e831481bfb',
      '65d18386afa614e831481bfc',
      '65d18821afa614e831481bfd',
      '65d18e3fafa614e831481bfe',
      '65d19287afa614e831481c00',
      '65d192b0afa614e831481c01',
      '65d193e0afa614e831481c02',
      '65d1944cafa614e831481c05',
      '65d1963fafa614e831481c07',
      '65d19662afa614e831481c08',
      '65d196e5afa614e831481c09',
      '65d19879afa614e831481c0b',
      '65d19b20afa614e831481c0e',
      '65d19c20afa614e831481c0f',
      '65d19cafafa614e831481c10',
      '65d19d11afa614e831481c11',
      '65d19d99afa614e831481c12',
      '65d19dd7afa614e831481c13',
      '65d1a310afa614e831481c17',
      '65d1a42dafa614e831481c19',
      '65d1a619afa614e831481c1a',
      '65d1a88bafa614e831481c1c',
      '65d1a895afa614e831481c1d',
      '65d1a8fbafa614e831481c1e',
      '65d1ac97afa614e831481c20',
      '65d1ae46afa614e831481c21',
      '65d1b03aafa614e831481c23',
      '65d1b0f6afa614e831481c25',
      '65d1b13eafa614e831481c26',
      '65d1b296afa614e831481c27',
      '65d1b526afa614e831481c29',
      '65d1b612afa614e831481c2a',
      '65d1b626afa614e831481c2b',
      '65d1b698afa614e831481c2e',
      '65d1b7d8afa614e831481c2f',
      '65d1b853afa614e831481c30',
      '65d1b904afa614e831481c32',
      '65d1b990afa614e831481c34',
      '65d1bc42afa614e831481c38',
      '65d1be72afa614e831481c39',
      '65d1bec1afa614e831481c3a',
      '65d1c3134d8381f50c551afb',
      '65d1c35d4d8381f50c551afd',
      '65d1c6504d8381f50c551afe',
      '65d1c85f4d8381f50c551aff',
      '65d1c9654d8381f50c551b00',
      '65d1c96f4d8381f50c551b01',
      '65d1ca404d8381f50c551b02',
      '65d1caf14d8381f50c551b04',
      '65d1cb344d8381f50c551b05',
      '65d1d01d4d8381f50c551b06',
      '65d1d57c4d8381f50c551b07',
      '65d1d66f4d8381f50c551b08',
      '65d1dba44d8381f50c551b09',
      '65d1de2e4d8381f50c551b0b',
      '65d1de624d8381f50c551b0c',
      '65d1df004d8381f50c551b0d',
      '65d1dfed4d8381f50c551b0e',
      '65d1e20c4d8381f50c551b11',
      '65d1e2794d8381f50c551b12',
      '65d1e3134d8381f50c551b14',
      '65d1e3ae4d8381f50c551b15',
      '65d1e3c54d8381f50c551b16',
      '65d1e6364d8381f50c551b17',
      '65d1e6834d8381f50c551b18',
      '65d1e9364d8381f50c551b19',
      '65d1ea314d8381f50c551b1b',
      '65d1eac74d8381f50c551b1c',
      '65d1eb064d8381f50c551b1d',
      '65d1eb534d8381f50c551b1f',
      '65d1f08f4d8381f50c551b20',
      '65d1f6264d8381f50c551b22',
      '65d1fa694d8381f50c551b23',
      '65d1fd0f4d8381f50c551b24',
      '65d1fd404d8381f50c551b25',
      '65d1ff764d8381f50c551b29',
      '65d200aa4d8381f50c551b2a',
      '65d201754d8381f50c551b2b',
      '65d201f94d8381f50c551b2c',
      '65d205694d8381f50c551b2e',
      '65d2093f4d8381f50c551b31',
      '65d209714d8381f50c551b32',
      '65d20bc94d8381f50c551b35',
      '65d20c134d8381f50c551b36',
      '65d20eab4d8381f50c551b38',
      '65d20ecd4d8381f50c551b3a',
      '65d20f2f4d8381f50c551b3c',
      '65d20f464d8381f50c551b3d',
      '65d20f954d8381f50c551b3e',
      '65d210b64d8381f50c551b3f',
      '65d210e64d8381f50c551b40',
      '65d2127d4d8381f50c551b41',
      '65d214494d8381f50c551b42',
      '65d2144a4d8381f50c551b43',
      '65d215174d8381f50c551b44',
      '65d216684d8381f50c551b45',
      '65d217584d8381f50c551b46',
      '65d219114d8381f50c551b48',
      '65d21d324d8381f50c551b49',
      '65d21d8b4d8381f50c551b4a',
      '65d21f084d8381f50c551b4c',
      '65d21fcd4d8381f50c551b4e',
      '65d220554d8381f50c551b4f',
      '65d221234d8381f50c551b51',
      '65d2212b4d8381f50c551b52',
      '65d221ba4d8381f50c551b55',
      '65d221c14d8381f50c551b56',
      '65d221ea4d8381f50c551b59',
      '65d223aa4d8381f50c551b5a',
      '65d2249e4d8381f50c551b5c',
      '65d225724d8381f50c551b5e',
      '65d2265e5e6adfcd7bc0c0c6',
      '65d226e65e6adfcd7bc0c0c7',
      '65d228065e6adfcd7bc0c0c9',
      '65d228275e6adfcd7bc0c0ca',
      '65d228405e6adfcd7bc0c0cb',
      '65d2299f5e6adfcd7bc0c0cd',
      '65d22b535e6adfcd7bc0c0ce',
      '65d22f6a5e6adfcd7bc0c0cf',
      '65d231c65e6adfcd7bc0c0d1',
      '65d234775e6adfcd7bc0c0d3',
      '65d237845e6adfcd7bc0c0d4',
      '65d23d385e6adfcd7bc0c0d6',
      '65d23e595e6adfcd7bc0c0d8',
      '65d23ece5e6adfcd7bc0c0d9',
      '65d240ee5e6adfcd7bc0c0db',
      '65d243565e6adfcd7bc0c0dd',
      '65d243aa5e6adfcd7bc0c0de',
      '65d243b65e6adfcd7bc0c0df',
      '65d243d45e6adfcd7bc0c0e0',
      '65d244e55e6adfcd7bc0c0e2',
      '65d2454a5e6adfcd7bc0c0e3',
      '65d2459d5e6adfcd7bc0c0e4',
      '65d247275e6adfcd7bc0c0e5',
      '65d2496e5e6adfcd7bc0c0e6',
      '65d2498a5e6adfcd7bc0c0e7',
      '65d249da5e6adfcd7bc0c0e8',
      '65d24a405e6adfcd7bc0c0e9',
      '65d24a9f5e6adfcd7bc0c0ec',
      '65d24b305e6adfcd7bc0c0ee',
      '65d24be95e6adfcd7bc0c0ef',
      '65d24e4e5e6adfcd7bc0c0f0',
      '65d24ea15e6adfcd7bc0c0f1',
      '65d251c35e6adfcd7bc0c0f4',
      '65d254a45e6adfcd7bc0c0f5',
      '65d2553e5e6adfcd7bc0c0f6',
      '65d2560a5e6adfcd7bc0c0f7',
      '65d257165e6adfcd7bc0c0f8',
      '65d257455e6adfcd7bc0c0f9',
      '65d25acb5e6adfcd7bc0c0fb',
      '65d2727f5e6adfcd7bc0c0fd',
      '65d28d205e6adfcd7bc0c0fe',
      '65d2a69c5e6adfcd7bc0c0ff',
      '65d2c1205e6adfcd7bc0c101',
      '65d2c1c85e6adfcd7bc0c102',
      '65d2c32c5e6adfcd7bc0c104',
      '65d2c8f05e6adfcd7bc0c105',
      '65d2c9025e6adfcd7bc0c106',
      '65d2ca1f5e6adfcd7bc0c108',
      '65d2d02e5e6adfcd7bc0c10a',
      '65d2d8f35e6adfcd7bc0c10c',
      '65d2dcd25e6adfcd7bc0c10d',
      '65d2e17c5e6adfcd7bc0c10e',
      '65d2e2925e6adfcd7bc0c10f',
      '65d2e53e5e6adfcd7bc0c110',
      '65d2e7ba5e6adfcd7bc0c111',
      '65d2ed1b5e6adfcd7bc0c113',
      '65d2eecc5e6adfcd7bc0c114',
      '65d2efc55e6adfcd7bc0c115',
      '65d2f3365e6adfcd7bc0c116',
      '65d2f3475e6adfcd7bc0c117',
      '65d2f3775e6adfcd7bc0c118',
      '65d2f3965e6adfcd7bc0c119',
      '65d2f3ab5e6adfcd7bc0c11a',
      '65d2f4845e6adfcd7bc0c11c',
      '65d2f5085e6adfcd7bc0c11d',
      '65d2f5da5e6adfcd7bc0c11e',
      '65d2f63e5e6adfcd7bc0c11f',
      '65d2f6885e6adfcd7bc0c120',
      '65d2f7fb5e6adfcd7bc0c122',
      '65d2fad25e6adfcd7bc0c123',
      '65d2fc595e6adfcd7bc0c125',
      '65d2fd205e6adfcd7bc0c126',
      '65d2fd755e6adfcd7bc0c127',
      '65d2ffcd5e6adfcd7bc0c128',
      '65d300085e6adfcd7bc0c129',
      '65d3007d5e6adfcd7bc0c12a',
      '65d301045e6adfcd7bc0c12c',
      '65d306135e6adfcd7bc0c12d',
      '65d306645e6adfcd7bc0c12e',
      '65d306e55e6adfcd7bc0c12f',
      '65d30c795e6adfcd7bc0c130',
      '65d30f865e6adfcd7bc0c131',
      '65d314c15e6adfcd7bc0c133',
      '65d315285e6adfcd7bc0c134',
      '65d319e85e6adfcd7bc0c136',
      '65d31c6d5e6adfcd7bc0c138',
      '65d31f695e6adfcd7bc0c139',
      '65d31fd85e6adfcd7bc0c13a',
      '65d323825e6adfcd7bc0c13c',
      '65d325645e6adfcd7bc0c13f',
      '65d327f15e6adfcd7bc0c140',
      '65d328a35e6adfcd7bc0c142',
      '65d32a125e6adfcd7bc0c143',
      '65d330d95e6adfcd7bc0c145',
      '65d3334a5e6adfcd7bc0c146',
      '65d3335e5e6adfcd7bc0c147',
      '65d336e35e6adfcd7bc0c148',
      '65d33dd25e6adfcd7bc0c14a',
      '65d340335e6adfcd7bc0c14b',
      '65d341a55e6adfcd7bc0c14c',
      '65d345c55e6adfcd7bc0c14d',
      '65d347d25e6adfcd7bc0c14f',
      '65d349895e6adfcd7bc0c150',
      '65d34b715e6adfcd7bc0c152',
      '65d34c745e6adfcd7bc0c154',
      '65d34d285e6adfcd7bc0c155',
      '65d354df5e6adfcd7bc0c156',
      '65d356a65e6adfcd7bc0c157',
      '65d359175e6adfcd7bc0c159',
      '65d359a25e6adfcd7bc0c15a',
      '65d359a25e6adfcd7bc0c15b',
      '65d35c235e6adfcd7bc0c15c',
      '65d35f415e6adfcd7bc0c15d',
      '65d362bc5e6adfcd7bc0c15e',
      '65d364635e6adfcd7bc0c15f',
      '65d365125e6adfcd7bc0c160',
      '65d365965e6adfcd7bc0c161',
      '65d366995e6adfcd7bc0c162',
      '65d366bc5e6adfcd7bc0c163',
      '65d366d45e6adfcd7bc0c164',
      '65d366f55e6adfcd7bc0c165',
      '65d3679d5e6adfcd7bc0c166',
      '65d369d25e6adfcd7bc0c167',
      '65d36b095e6adfcd7bc0c168',
      '65d36d695e6adfcd7bc0c169',
      '65d36d705e6adfcd7bc0c16a',
      '65d370eb5e6adfcd7bc0c16c',
      '65d3714e5e6adfcd7bc0c16e',
      '65d372525e6adfcd7bc0c170',
      '65d374325e6adfcd7bc0c171',
      '65d374c35e6adfcd7bc0c172',
      '65d3790c5e6adfcd7bc0c173',
      '65d379695e6adfcd7bc0c174',
      '65d379bb5e6adfcd7bc0c175',
      '65d37ac25e6adfcd7bc0c177',
      '65d37dc75e6adfcd7bc0c179',
      '65d37ddb5e6adfcd7bc0c17a',
      '65d37e125e6adfcd7bc0c17c',
      '65d380505e6adfcd7bc0c17f',
      '65d3810e5e6adfcd7bc0c181',
      '65d3830d5e6adfcd7bc0c182',
      '65d3851b5e6adfcd7bc0c183',
      '65d387415e6adfcd7bc0c184',
      '65d388f95e6adfcd7bc0c186',
      '65d3891a5e6adfcd7bc0c187',
      '65d38a435e6adfcd7bc0c189',
      '65d38d0e5e6adfcd7bc0c18d',
      '65d38d9e5e6adfcd7bc0c18f',
      '65d38f155e6adfcd7bc0c191',
      '65d393545e6adfcd7bc0c192',
      '65d395015e6adfcd7bc0c193',
      '65d3970d5e6adfcd7bc0c194',
      '65d397795e6adfcd7bc0c195',
      '65d39a725e6adfcd7bc0c197',
      '65d39af75e6adfcd7bc0c198',
      '65d39b725e6adfcd7bc0c199',
      '65d39bed5e6adfcd7bc0c19a',
      '65d39fa55e6adfcd7bc0c19d',
      '65d39fb05e6adfcd7bc0c19e',
      '65d3a0a75e6adfcd7bc0c19f',
      '65d3a1a05e6adfcd7bc0c1a1',
      '65d3a2635e6adfcd7bc0c1a2',
      '65d3a2875e6adfcd7bc0c1a3',
      '65d3a37e5e6adfcd7bc0c1a4',
      '65d3a44f5e6adfcd7bc0c1a6',
      '65d3a4e95e6adfcd7bc0c1a7',
      '65d3a5d45e6adfcd7bc0c1a8',
      '65d3a7d35e6adfcd7bc0c1a9',
      '65d3a8f65e6adfcd7bc0c1aa',
      '65d3aa17700ec9cc83a1701c',
      '65d3aac25e6adfcd7bc0c1ac',
      '65d3ab585e6adfcd7bc0c1ae',
      '65d3aec05e6adfcd7bc0c1b0',
      '65d3b1065e6adfcd7bc0c1b1',
      '65d3b14a5e6adfcd7bc0c1b2',
      '65d3ba2e5e6adfcd7bc0c1b3',
      '65d3c41f5e6adfcd7bc0c1b4',
      '65d3cc345e6adfcd7bc0c1b5',
      '65d3d61b5e6adfcd7bc0c1b6',
      '65d3d9d65e6adfcd7bc0c1b7',
      '65d40cfd5e6adfcd7bc0c1b8',
      '65d412145e6adfcd7bc0c1b9',
      '65d415dd5e6adfcd7bc0c1bb',
      '65d41c7c5e6adfcd7bc0c1bd',
      '65d41d355e6adfcd7bc0c1bf',
      '65d41f085e6adfcd7bc0c1c1',
      '65d4308d5e6adfcd7bc0c1c4',
      '65d4327f5e6adfcd7bc0c1c6',
      '65d4364a5e6adfcd7bc0c1c7',
      '65d443265e6adfcd7bc0c1c9',
      '65d4467b5e6adfcd7bc0c1cb',
      '65d447e85e6adfcd7bc0c1cd',
      '65d448db5e6adfcd7bc0c1cf',
      '65d449ba5e6adfcd7bc0c1d0',
      '65d44a015e6adfcd7bc0c1d2',
      '65d44d9c5e6adfcd7bc0c1d4',
      '65d44db25e6adfcd7bc0c1d5',
      '65d459945e6adfcd7bc0c1d6',
      '65d45a3d5e6adfcd7bc0c1d7',
      '65d45a455e6adfcd7bc0c1d8',
      '65d45cd65e6adfcd7bc0c1da',
      '65d45f015e6adfcd7bc0c1db',
      '65d475ef5e6adfcd7bc0c1dd',
      '65d476f25e6adfcd7bc0c1de',
      '65d47ab25e6adfcd7bc0c1e0',
      '65d47b545e6adfcd7bc0c1e1',
      '65d481ed5e6adfcd7bc0c1e4',
      '65d484aa5e6adfcd7bc0c1e5',
      '65d489135e6adfcd7bc0c1e7',
      '65d48a335e6adfcd7bc0c1e8',
      '65d490065e6adfcd7bc0c1e9',
      '65d492985e6adfcd7bc0c1eb',
      '65d492a85e6adfcd7bc0c1ec',
      '65d493cd5e6adfcd7bc0c1ed',
      '65d497da5e6adfcd7bc0c1ef',
      '65d4990d5e6adfcd7bc0c1f1',
      '65d49c395e6adfcd7bc0c1f3',
      '65d49d315e6adfcd7bc0c1f4',
      '65d4a48baa980c579a71da9a',
      '65d4a897aa980c579a71da9b',
      '65d4a8b8aa980c579a71da9c',
      '65d4aa5aaa980c579a71da9e',
      '65d4ab5baa980c579a71da9f',
      '65d4abc3aa980c579a71daa0',
      '65d4abe4aa980c579a71daa1',
      '65d4ac1eaa980c579a71daa2',
      '65d4acc7aa980c579a71daa3',
      '65d4ad6caa980c579a71daa4',
      '65d4ae04aa980c579a71daa5',
      '65d4af5eaa980c579a71daa6',
      '65d4b0d2aa980c579a71daa7',
      '65d4b0f5aa980c579a71daa8',
      '65d4b200aa980c579a71daa9',
      '65d4b246aa980c579a71daab',
      '65d4b3bdaa980c579a71daac',
      '65d4b58eaa980c579a71daae',
      '65d4b641aa980c579a71daaf',
      '65d4b8a6aa980c579a71dab3',
      '65d4b8d6aa980c579a71dab4',
      '65d4b967aa980c579a71dab5',
      '65d4b984aa980c579a71dab6',
      '65d4bb06aa980c579a71dab7',
      '65d4c07caa980c579a71daba',
      '65d4c0ceaa980c579a71dabb',
      '65d4c0d1aa980c579a71dabc',
      '65d4c12daa980c579a71dabd',
      '65d4c13eaa980c579a71dabf',
      '65d4c141aa980c579a71dac0',
      '65d4c213aa980c579a71dac3',
      '65d4c3cfaa980c579a71dac5',
      '65d4c462aa980c579a71dac7',
      '65d4c4c9aa980c579a71dac8',
      '65d4c4e6aa980c579a71dac9',
      '65d4c79eaa980c579a71dacb',
      '65d4c878aa980c579a71dacc',
      '65d4c906aa980c579a71dacd',
      '65d4c93eaa980c579a71dace',
      '65d4caa3aa980c579a71dad0',
      '65d4cc84aa980c579a71dad3',
      '65d4cd8aaa980c579a71dad5',
      '65d4cf91565d15f95b04e36f',
      '65d4d1281d4b0e2de0baf5ba',
      '65d4d22e1d4b0e2de0baf5bb',
      '65d4d23a1d4b0e2de0baf5bc',
      '65d4d36c1d4b0e2de0baf5be',
      '65d4d5411d4b0e2de0baf5bf',
      '65d4d5c31d4b0e2de0baf5c1',
      '65d4d9771d4b0e2de0baf5c3',
      '65d4dd171d4b0e2de0baf5c5',
      '65d4ddc91d4b0e2de0baf5c6',
      '65d4deb31d4b0e2de0baf5c7',
      '65d4e0511d4b0e2de0baf5c9',
      '65d4e0741d4b0e2de0baf5ca',
      '65d4e2fd1d4b0e2de0baf5cc',
      '65d4e3631d4b0e2de0baf5cd',
      '65d4e3ca1d4b0e2de0baf5ce',
      '65d4e5de1d4b0e2de0baf5d2',
      '65d4e6fb1d4b0e2de0baf5d3',
      '65d4e7501d4b0e2de0baf5d4',
      '65d4e7541d4b0e2de0baf5d5',
      '65d4e7f01d4b0e2de0baf5d7',
      '65d4e84f1d4b0e2de0baf5d8',
      '65d4e8c91d4b0e2de0baf5d9',
      '65d4e9651d4b0e2de0baf5da',
      '65d4eafc1d4b0e2de0baf5db',
      '65d4ebc51d4b0e2de0baf5dc',
      '65d4ee2e1d4b0e2de0baf5de',
      '65d4efa61d4b0e2de0baf5df',
      '65d4f4321d4b0e2de0baf5e0',
      '65d4f5cc1d4b0e2de0baf5e1',
      '65d4f7ce1d4b0e2de0baf5e2',
      '65d4f8a21d4b0e2de0baf5e3',
      '65d4f9c71d4b0e2de0baf5e4',
      '65d4fff91d4b0e2de0baf5e5',
      '65d502e11d4b0e2de0baf5e6',
      '65d503e71d4b0e2de0baf5e7',
      '65d5050a1d4b0e2de0baf5e9',
      '65d508af1d4b0e2de0baf5ea',
      '65d50d851d4b0e2de0baf5eb',
      '65d50dd81d4b0e2de0baf5ec',
      '65d5185a1d4b0e2de0baf5ed',
      '65d51e411d4b0e2de0baf5ee',
      '65d53c3c1d4b0e2de0baf5ef',
      '65d5612b1d4b0e2de0baf5f0',
      '65d567d21d4b0e2de0baf5f3',
      '65d56aa41d4b0e2de0baf5f4',
      '65d571f51d4b0e2de0baf5f7',
      '65d57b74cbccf4670b3ca0c9',
      '65d57de6cbccf4670b3ca0ca',
      '65d57e07cbccf4670b3ca0cb',
      '65d582f0cbccf4670b3ca0d0',
      '65d582fdcbccf4670b3ca0d1',
      '65d583fbcbccf4670b3ca0d3',
      '65d5849dcbccf4670b3ca0d4',
      '65d584ebcbccf4670b3ca0d5',
      '65d586b8cbccf4670b3ca0d6',
      '65d586bccbccf4670b3ca0d7',
      '65d58983cbccf4670b3ca0d9',
      '65d58a4ccbccf4670b3ca0da',
      '65d58c45cbccf4670b3ca0db',
      '65d58de0cbccf4670b3ca0dc',
      '65d59482cbccf4670b3ca0dd',
      '65d5959ccbccf4670b3ca0df',
      '65d597a9cbccf4670b3ca0e0',
      '65d5992ccbccf4670b3ca0e2',
      '65d59a73cbccf4670b3ca0e3',
      '65d59ae5cbccf4670b3ca0e4',
      '65d59be2cbccf4670b3ca0e5',
      '65d59c03cbccf4670b3ca0e6',
      '65d5a0fbcbccf4670b3ca0e7',
      '65d5a779cbccf4670b3ca0e9',
      '65d5b033cbccf4670b3ca0eb',
      '65d5b04acbccf4670b3ca0ec',
      '65d5b8bbcbccf4670b3ca0ef',
      '65d5bd2ecbccf4670b3ca0f0',
      '65d5c301cbccf4670b3ca0f1',
      '65d5c4accbccf4670b3ca0f2',
      '65d5c696cbccf4670b3ca0f4',
      '65d5c8c4cbccf4670b3ca0f5',
      '65d5c9e8cbccf4670b3ca0f7',
      '65d5cb61cbccf4670b3ca0f8',
      '65d5cd28cbccf4670b3ca0fa',
      '65d5d163cbccf4670b3ca0fc',
      '65d5d34ecbccf4670b3ca0fd',
      '65d5d534cbccf4670b3ca0fe',
      '65d5e285cbccf4670b3ca100',
      '65d5e913cbccf4670b3ca102',
      '65d5f052cbccf4670b3ca104',
      '65d5f300cbccf4670b3ca105',
      '65d5f3d3cbccf4670b3ca106',
      '65d5f68fcbccf4670b3ca108',
      '65d5fc95cbccf4670b3ca10b',
      '65d601f3cbccf4670b3ca10d',
      '65d60608cbccf4670b3ca110',
      '65d60a5fcbccf4670b3ca113',
      '65d60addcbccf4670b3ca115',
      '65d60b7bcbccf4670b3ca117',
      '65d60bd2cbccf4670b3ca118',
      '65d60be6cbccf4670b3ca119',
      '65d60c0dcbccf4670b3ca11a',
      '65d60c0ecbccf4670b3ca11b',
      '65d60c26cbccf4670b3ca11d',
      '65d60c98cbccf4670b3ca120',
      '65d60cbecbccf4670b3ca121',
      '65d60d6bcbccf4670b3ca124',
      '65d60d7acbccf4670b3ca125',
      '65d60de2cbccf4670b3ca126',
      '65d60dfecbccf4670b3ca127',
      '65d60e0ccbccf4670b3ca128',
      '65d60effcbccf4670b3ca12d',
      '65d60f76cbccf4670b3ca12e',
      '65d60f83cbccf4670b3ca12f',
      '65d61156cbccf4670b3ca130',
      '65d612b3cbccf4670b3ca131',
      '65d612bccbccf4670b3ca132',
      '65d61597cbccf4670b3ca134',
      '65d615a9cbccf4670b3ca135',
      '65d619fccbccf4670b3ca137',
      '65d61c60cbccf4670b3ca139',
      '65d61f48cbccf4670b3ca13c',
      '65d6234acbccf4670b3ca13e',
      '65d624f4cbccf4670b3ca13f',
      '65d624fbcbccf4670b3ca140',
      '65d6258ecbccf4670b3ca143',
      '65d626b0cbccf4670b3ca146',
      '65d6273dcbccf4670b3ca148',
      '65d62893cbccf4670b3ca14a',
      '65d6290fcbccf4670b3ca14b',
      '65d62c84cbccf4670b3ca14c',
      '65d62d0bcbccf4670b3ca14d',
      '65d63249cbccf4670b3ca14e',
      '65d638e9cbccf4670b3ca150',
      '65d639dacbccf4670b3ca151',
      '65d63b2ccbccf4670b3ca153',
      '65d63b94cbccf4670b3ca154',
      '65d63cffcbccf4670b3ca155',
      '65d63d7dcbccf4670b3ca156',
      '65d6418ecbccf4670b3ca159',
      '65d641f5cbccf4670b3ca15a',
      '65d6487bcbccf4670b3ca15c',
      '65d64b1ccbccf4670b3ca15f',
      '65d64fd2cbccf4670b3ca162',
      '65d650f2cbccf4670b3ca163',
      '65d65211cbccf4670b3ca165',
      '65d654e3cbccf4670b3ca166',
      '65d654fdcbccf4670b3ca167',
      '65d656decbccf4670b3ca16a',
      '65d6582fcbccf4670b3ca16c',
      '65d65900cbccf4670b3ca16d',
      '65d65af3cbccf4670b3ca16f',
      '65d65bcacbccf4670b3ca171',
      '65d66004cbccf4670b3ca173',
      '65d66176cbccf4670b3ca174',
      '65d66a70a226064c68a248ae',
      '65d66e8fa226064c68a248af',
      '65d676c9a226064c68a248b0',
      '65d67d48a226064c68a248b2',
      '65d6ab34a226064c68a248b7',
      '65d6b833a226064c68a248b8',
      '65d6be0da226064c68a248ba',
      '65d6c00da226064c68a248bc',
      '65d6cf5fa226064c68a248bd',
      '65d6d972a226064c68a248be',
      '65d6df94a226064c68a248bf',
      '65d6e0d2a226064c68a248c1',
      '65d6e500a226064c68a248c3',
      '65d6ea93a226064c68a248c5',
      '65d6ebdea226064c68a248c8',
      '65d6ec2ba226064c68a248ca',
      '65d6ec48a226064c68a248cb',
      '65d6edb5a226064c68a248cd',
      '65d6ee0ea226064c68a248ce',
      '65d6eea0a226064c68a248cf',
      '65d6ef56a226064c68a248d0',
      '65d6f296a226064c68a248d3',
      '65d6f509a226064c68a248d4',
      '65d6f5ffa226064c68a248d5',
      '65d6f7c7a226064c68a248d6',
      '65d6ffb3a226064c68a248d9',
      '65d70382a226064c68a248dc',
      '65d70acca226064c68a248de',
      '65d71599a226064c68a248e3',
      '65d71ea9a226064c68a248e6',
      '65d71f41a226064c68a248e7',
      '65d7200ca226064c68a248e9',
      '65d7234ba226064c68a248eb',
      '65d72a880fb947f5b2547e53',
      '65d72fbf0fb947f5b2547e59',
      '65d731330fb947f5b2547e5b',
      '65d7315f0fb947f5b2547e5c',
      '65d731930fb947f5b2547e5d',
      '65d731c40fb947f5b2547e5e',
      '65d732090fb947f5b2547e60',
      '65d7323f0fb947f5b2547e61',
      '65d733e00fb947f5b2547e62',
      '65d734260fb947f5b2547e63',
      '65d735460fb947f5b2547e64',
      '65d735610fb947f5b2547e65',
      '65d736300fb947f5b2547e67',
      '65d736310fb947f5b2547e68',
      '65d737900fb947f5b2547e69',
      '65d738600fb947f5b2547e6a',
      '65d738680fb947f5b2547e6b',
      '65d7387c0fb947f5b2547e6c',
      '65d739260fb947f5b2547e6e',
      '65d7392d0fb947f5b2547e6f',
      '65d739a20fb947f5b2547e70',
      '65d73e340fb947f5b2547e72',
      '65d73e980fb947f5b2547e73',
      '65d741ae0fb947f5b2547e75',
      '65d742c00fb947f5b2547e76',
      '65d743570fb947f5b2547e77',
      '65d748e40fb947f5b2547e79',
      '65d748ff0fb947f5b2547e7a',
      '65d74c3b0fb947f5b2547e7b',
      '65d74c4d0fb947f5b2547e7c',
      '65d74e390fb947f5b2547e7e',
      '65d74f540fb947f5b2547e80',
      '65d74fa90fb947f5b2547e81',
      '65d7505c0fb947f5b2547e82',
      '65d756ea0fb947f5b2547e83',
      '65d758830fb947f5b2547e84',
      '65d75af40fb947f5b2547e86',
      '65d75bf90fb947f5b2547e89',
      '65d75d600fb947f5b2547e8b',
      '65d75e200fb947f5b2547e8d',
      '65d760c80fb947f5b2547e8f',
      '65d763090fb947f5b2547e90',
      '65d7631f0fb947f5b2547e91',
      '65d765ae0fb947f5b2547e92',
      '65d76eb00fb947f5b2547e94',
      '65d770320fb947f5b2547e95',
      '65d775620fb947f5b2547e9b',
      '65d775f90fb947f5b2547e9d',
      '65d77c110fb947f5b2547ea4',
      '65d77de20fb947f5b2547ea5',
      '65d77ee30fb947f5b2547ea7',
      '65d77f380fb947f5b2547ea9',
      '65d77f4a0fb947f5b2547eaa',
      '65d7802f0fb947f5b2547eab',
      '65d780cd0fb947f5b2547eac',
      '65d780f20fb947f5b2547ead',
      '65d781930fb947f5b2547eaf',
      '65d781ae0fb947f5b2547eb0',
      '65d784060fb947f5b2547eb2',
      '65d786fc0fb947f5b2547eb3',
      '65d787100fb947f5b2547eb4',
      '65d7890e0fb947f5b2547eb6',
      '65d78ac70fb947f5b2547eb7',
      '65d78bda0fb947f5b2547eb8',
      '65d78bed0fb947f5b2547eb9',
      '65d78bff0fb947f5b2547eba',
      '65d78c120fb947f5b2547ebb',
      '65d78c210fb947f5b2547ebd',
      '65d78c500fb947f5b2547ebe',
      '65d78f300fb947f5b2547ec0',
      '65d78fb30fb947f5b2547ec1',
      '65d790680fb947f5b2547ec2',
      '65d795080fb947f5b2547ec4',
      '65d796920fb947f5b2547ec5',
      '65d798af0fb947f5b2547ec6',
      '65d799b20fb947f5b2547ec8',
      '65d79a780fb947f5b2547ec9',
      '65d7acc10fb947f5b2547ecc',
      '65d7b83d0fb947f5b2547ece',
      '65d7c8630fb947f5b2547ed0',
      '65d7d5a60fb947f5b2547ed1',
      '65d7da240fb947f5b2547ed3',
      '65d7e52b0fb947f5b2547ed4',
      '65d809a20fb947f5b2547ed6',
      '65d80b030fb947f5b2547ed8',
      '65d80cd10fb947f5b2547eda',
      '65d8151b0fb947f5b2547edb',
      '65d8174f0fb947f5b2547edc',
      '65d82ab30fb947f5b2547ede',
      '65d82e870fb947f5b2547edf',
      '65d82f500fb947f5b2547ee1',
      '65d835c90fb947f5b2547ee3',
      '65d839140fb947f5b2547ee4',
      '65d83c390fb947f5b2547ee5',
      '65d842780fb947f5b2547ee6',
      '65d8449a0fb947f5b2547ee7',
      '65d844af0fb947f5b2547ee8',
      '65d846580fb947f5b2547eea',
      '65d8486f0fb947f5b2547eec',
      '65d84ed90fb947f5b2547eed',
      '65d84fb30fb947f5b2547eee',
      '65d850670fb947f5b2547eef',
      '65d8554c0fb947f5b2547ef0',
      '65d85a0d0fb947f5b2547ef1',
      '65d85eac0fb947f5b2547ef3',
      '65d864ed0fb947f5b2547ef4',
      '65d8677c0fb947f5b2547ef5',
      '65d86bb60fb947f5b2547ef6',
      '65d874430fb947f5b2547ef9',
      '65d881100fb947f5b2547efa',
      '65d881c30fb947f5b2547efb',
      '65d8849d0fb947f5b2547efe',
      '65d886940fb947f5b2547f00',
      '65d888400fb947f5b2547f02',
      '65d889f90fb947f5b2547f05',
      '65d88ca40fb947f5b2547f08',
      '65d88d9e0fb947f5b2547f09',
      '65d88de30fb947f5b2547f0b',
      '65d89b040fb947f5b2547f0e',
      '65d89b5a0fb947f5b2547f10',
      '65d89bf70fb947f5b2547f12',
      '65d89dd90fb947f5b2547f13',
      '65d89ecb0fb947f5b2547f15',
      '65d8a3690fb947f5b2547f17',
      '65d8a4ea0fb947f5b2547f18',
      '65d8a6820fb947f5b2547f1a',
      '65d8ab9f0fb947f5b2547f1d',
      '65d8ad0f0fb947f5b2547f1f',
      '65d8afaa0fb947f5b2547f20',
      '65d8afb40fb947f5b2547f21',
      '65d8b0b10fb947f5b2547f25',
      '65d8b1c40fb947f5b2547f26',
      '65d8b8563a08b38eb45f6b46',
      '65d8bb990fb947f5b2547f29',
      '65d8bb9e0fb947f5b2547f2a',
      '65d8bc470fb947f5b2547f2d',
      '65d8bcd10fb947f5b2547f2e',
      '65d8beb20fb947f5b2547f2f',
      '65d8bee30fb947f5b2547f31',
      '65d8bef70fb947f5b2547f32',
      '65d8bf620fb947f5b2547f33',
      '65d8bf630fb947f5b2547f34',
      '65d8bf730fb947f5b2547f35',
      '65d8bf8c0fb947f5b2547f37',
      '65d8c0f80fb947f5b2547f38',
      '65d8c1020fb947f5b2547f39',
      '65d8c3f80fb947f5b2547f3f',
      '65d8c5880fb947f5b2547f41',
      '65d8c5ad0fb947f5b2547f42',
      '65d8c6d30fb947f5b2547f43',
      '65d8c7490fb947f5b2547f45',
      '65d8c7e00fb947f5b2547f46',
      '65d8ca160fb947f5b2547f49',
      '65d8ca290fb947f5b2547f4a',
      '65d8cb330fb947f5b2547f4b',
      '65d8cce70fb947f5b2547f4d',
      '65d8d0c80fb947f5b2547f51',
      '65d8d0d50fb947f5b2547f52',
      '65d8d3200fb947f5b2547f53',
      '65d8db9b0fb947f5b2547f55',
      '65d8dc230fb947f5b2547f56',
      '65d8de5d0fb947f5b2547f59',
      '65d8dea80fb947f5b2547f5a',
      '65d8e3560fb947f5b2547f5b',
      '65d8e39a0fb947f5b2547f5c',
      '65d8e4ca0fb947f5b2547f5d',
      '65d8e5d90fb947f5b2547f5e',
      '65d8e6400fb947f5b2547f5f',
      '65d8e7430fb947f5b2547f61',
      '65d8e8580fb947f5b2547f64',
      '65d8e8c10fb947f5b2547f66',
      '65d8eb070fb947f5b2547f6a',
      '65d8eb490fb947f5b2547f6b',
      '65d8ed020fb947f5b2547f6d',
      '65d8ed6a0fb947f5b2547f6e',
      '65d8ed990fb947f5b2547f70',
      '65d8ed9e0fb947f5b2547f71',
      '65d8eda30fb947f5b2547f72',
      '65d8edbe0fb947f5b2547f73',
      '65d8ee190fb947f5b2547f76',
      '65d8ee200fb947f5b2547f77',
      '65d8ee700fb947f5b2547f78',
      '65d8ee800fb947f5b2547f79',
      '65d8eedc0fb947f5b2547f7a',
      '65d8ef240fb947f5b2547f7b',
      '65d8ef260fb947f5b2547f7c',
      '65d8ef4b0fb947f5b2547f7d',
      '65d8ef530fb947f5b2547f7e',
      '65d8ef930fb947f5b2547f7f',
      '65d8f0040fb947f5b2547f81',
      '65d8f0160fb947f5b2547f82',
      '65d8f0270fb947f5b2547f83',
      '65d8f0880fb947f5b2547f86',
      '65d8f0d00fb947f5b2547f88',
      '65d8f0fe0fb947f5b2547f89',
      '65d8f1020fb947f5b2547f8a',
      '65d8f1350fb947f5b2547f8b',
      '65d8f1680fb947f5b2547f8d',
      '65d8f1840fb947f5b2547f8e',
      '65d8f1d80fb947f5b2547f91',
      '65d8f2840fb947f5b2547f94',
      '65d8f57b0fb947f5b2547f95',
      '65d8f5a10fb947f5b2547f96',
      '65d8f6410fb947f5b2547f98',
      '65d8f9720fb947f5b2547f9a',
      '65d8fd170fb947f5b2547f9b',
      '65d903850fb947f5b2547f9e',
      '65d904a90fb947f5b2547fa0',
      '65d90c8b0fb947f5b2547fa4',
      '65d9183f0fb947f5b2547fa5',
      '65d91e440fb947f5b2547fa6',
      '65d941190fb947f5b2547fa7',
      '65d95d2a0fb947f5b2547fa8',
      '65d968260fb947f5b2547fa9',
      '65d968310fb947f5b2547faa',
      '65d9687d0fb947f5b2547fac',
      '65d96c8d0fb947f5b2547fad',
      '65d96db60fb947f5b2547faf',
      '65d96ea00fb947f5b2547fb1',
      '65d96eba0fb947f5b2547fb2',
      '65d96f480fb947f5b2547fb3',
      '65d97b4d0fb947f5b2547fb5',
      '65d97c220fb947f5b2547fb6',
      '65d97c5f0fb947f5b2547fb7',
      '65d97e330fb947f5b2547fba',
      '65d9819f0fb947f5b2547fbb',
      '65d981df0fb947f5b2547fbd',
      '65d983500fb947f5b2547fbe',
      '65d98b8a0fb947f5b2547fc1',
      '65d98cf90fb947f5b2547fc2',
      '65d98dc60fb947f5b2547fc3',
      '65d9911f0fb947f5b2547fc4',
      '65d993290fb947f5b2547fc6',
      '65d9935e0fb947f5b2547fc7',
      '65d998ab0fb947f5b2547fc9',
      '65d9a1c80fb947f5b2547fcc',
      '65d9a88e0fb947f5b2547fcd',
      '65d9a9250fb947f5b2547fce',
      '65d9aac30fb947f5b2547fcf',
      '65d9afd40fb947f5b2547fd0',
      '65d9b4d30fb947f5b2547fd2',
      '65d9bae90fb947f5b2547fd3',
      '65d9be3b0fb947f5b2547fd4',
      '65d9c1b80fb947f5b2547fd5',
      '65d9c9ca0fb947f5b2547fd6',
      '65d9d4ad0fb947f5b2547fda',
      '65d9da070fb947f5b2547fdb',
      '65d9e5da0fb947f5b2547fdc',
      '65d9e9280fb947f5b2547fdd',
      '65d9edae0fb947f5b2547fe0',
      '65d9f09c0fb947f5b2547fe6',
      '65d9f0aa0fb947f5b2547fe7',
      '65d9f31d0fb947f5b2547fed',
      '65d9f4d70fb947f5b2547ff0',
      '65d9f5510fb947f5b2547ff1',
      '65d9f9c10fb947f5b2547ff4',
      '65d9fa550fb947f5b2547ff5',
      '65d9faa40fb947f5b2547ff6',
      '65d9fb420fb947f5b2547ff7',
      '65d9fcb50fb947f5b2547ff8',
      '65da04710fb947f5b2547ffc',
      '65da05d40fb947f5b2547ffd',
      '65da0b2a0fb947f5b2547ffe',
      '65da0b8e0fb947f5b2547fff',
      '65da0d540fb947f5b2548000',
      '65da141a0fb947f5b2548002',
      '65da16520fb947f5b2548003',
      '65da1e3f0fb947f5b2548004',
      '65da20030fb947f5b2548005',
      '65da21370fb947f5b2548006',
      '65da234a0fb947f5b2548007',
      '65da25870fb947f5b2548009',
      '65da29090fb947f5b254800b',
      '65da2a800fb947f5b254800c',
      '65da2cf20fb947f5b254800d',
      '65da2e7c0fb947f5b2548010',
      '65da340e0fb947f5b2548012',
      '65da34790fb947f5b2548013',
      '65da34fe0fb947f5b2548014',
      '65da38a10fb947f5b2548016',
      '65da3cb10fb947f5b2548018',
      '65da3cc20fb947f5b2548019',
      '65da3cd50fb947f5b254801a',
      '65da43730fb947f5b254801e',
      '65da46430fb947f5b2548020',
      '65da46cf0fb947f5b2548021',
      '65da56ef0fb947f5b2548022',
      '65da70fa0fb947f5b2548023',
      '65da92d40fb947f5b2548025',
      '65daa9d80fb947f5b2548026',
      '65daae4e0fb947f5b2548027',
      '65dab18d0fb947f5b2548028',
      '65dabbde0fb947f5b2548029',
      '65dabc730fb947f5b254802a',
      '65dabff30fb947f5b254802b',
      '65dac7ed0fb947f5b254802c',
      '65daca030fb947f5b254802e',
      '65dacb620fb947f5b254802f',
      '65dacc910fb947f5b2548030',
      '65dace160fb947f5b2548032',
      '65dacfe00fb947f5b2548033',
      '65dad1fa0fb947f5b2548035',
      '65dad4270fb947f5b2548036',
      '65dad9380fb947f5b2548038',
      '65dadfd50fb947f5b254803a',
      '65dae3300fb947f5b254803b',
      '65dae33b0fb947f5b254803c',
      '65dae3950fb947f5b254803d',
      '65dae3c50fb947f5b254803e',
      '65dae3e30fb947f5b254803f',
      '65dae40b0fb947f5b2548040',
      '65dae4380fb947f5b2548041',
      '65dae5300fb947f5b2548042',
      '65dae5610fb947f5b2548043',
      '65dae57e0fb947f5b2548044',
      '65dae5a10fb947f5b2548045',
      '65dae5f00fb947f5b2548046',
      '65dae73b0fb947f5b2548047',
      '65dae75f0fb947f5b2548048',
      '65dae7840fb947f5b2548049',
      '65dae8800fb947f5b254804a',
      '65dae8ac0fb947f5b254804b',
      '65dae90a0fb947f5b254804d',
      '65daea430fb947f5b254804e',
      '65daead90fb947f5b254804f',
      '65daf8df0fb947f5b2548052',
      '65dafa990fb947f5b2548054',
      '65db07440fb947f5b2548056',
      '65db07530fb947f5b2548057',
      '65db078e0fb947f5b2548059',
      '65db089e0fb947f5b254805a',
      '65db0b7e0fb947f5b254805c',
      '65db0eab0fb947f5b254805d',
      '65db13af0fb947f5b254805e',
      '65db158d0fb947f5b254805f',
      '65db178d0fb947f5b2548060',
      '65db185a0fb947f5b2548061',
      '65db18fd0fb947f5b2548063',
      '65db19610fb947f5b2548065',
      '65db19b90fb947f5b2548066',
      '65db1a510fb947f5b2548067',
      '65db1b5f0fb947f5b2548068',
      '65db1ccc0fb947f5b2548069',
      '65db1f890fb947f5b254806a',
      '65db20ca0fb947f5b254806c',
      '65db22f80fb947f5b254806d',
      '65db27a60fb947f5b254806f',
      '65db2a150fb947f5b2548070',
      '65db2a770fb947f5b2548071',
      '65db2df10fb947f5b2548073',
      '65db30540fb947f5b2548074',
      '65db31f30fb947f5b2548075',
      '65db32220fb947f5b2548076',
      '65db33e80fb947f5b2548077',
      '65db3ad90fb947f5b2548078',
      '65db3ddb0fb947f5b2548079',
      '65db3df60fb947f5b254807a',
      '65db4a700fb947f5b254807d',
      '65db4b680fb947f5b254807f',
      '65db4dec0fb947f5b2548080',
      '65db4e260fb947f5b2548081',
      '65db4e350fb947f5b2548082',
      '65db511b0fb947f5b2548084',
      '65db52e90fb947f5b2548085',
      '65db534b0fb947f5b2548087',
      '65db5a470fb947f5b2548089',
      '65db5c160fb947f5b254808a',
      '65db5cea0fb947f5b254808b',
      '65db5e730fb947f5b254808c',
      '65db63a70fb947f5b254808d',
      '65db63b90fb947f5b254808e',
      '65db69060fb947f5b2548090',
      '65db6aec0fb947f5b2548091',
      '65db6c900fb947f5b2548092',
      '65db6d2a0fb947f5b2548093',
      '65db6da70fb947f5b2548094',
      '65db6db20fb947f5b2548095',
      '65db6ef70fb947f5b2548096',
      '65db71150fb947f5b2548098',
      '65db72210fb947f5b254809b',
      '65db72250fb947f5b254809c',
      '65db785a0fb947f5b254809e',
      '65db7da50fb947f5b254809f',
      '65db85d60fb947f5b25480a1',
      '65db86010fb947f5b25480a2',
      '65db89770fb947f5b25480a3',
      '65db8a4d0fb947f5b25480a5',
      '65db8b610fb947f5b25480a6',
      '65db8f380fb947f5b25480a7',
      '65db903a0fb947f5b25480a8',
      '65db90a00fb947f5b25480aa',
      '65db930e0fb947f5b25480ac',
      '65db940f0fb947f5b25480ad',
      '65db97ae0fb947f5b25480ae',
      '65db9fc20fb947f5b25480b0',
      '65dbaca80fb947f5b25480b1',
      '65dbb0670fb947f5b25480b4',
      '65dbcc900fb947f5b25480b5',
      '65dbdab70fb947f5b25480b6',
      '65dbf03c0fb947f5b25480b7',
      '65dbf2e00fb947f5b25480b9',
      '65dbf6860fb947f5b25480ba',
      '65dbfa6d0fb947f5b25480bb',
      '65dbfdc50fb947f5b25480bd',
      '65dc058a0fb947f5b25480bf',
      '65dc0f0d0fb947f5b25480c1',
      '65dc19450fb947f5b25480c3',
      '65dc1aa50fb947f5b25480c4',
      '65dc23060fb947f5b25480c5',
      '65dc36740fb947f5b25480c7',
      '65dc53210fb947f5b25480c9',
      '65dc548a0fb947f5b25480ca',
      '65dc6f260fb947f5b25480ce',
      '65dc78140fb947f5b25480d1',
      '65dc7eb10fb947f5b25480d3',
      '65dc81740fb947f5b25480d4',
      '65dc84860fb947f5b25480d5',
      '65dc874b0fb947f5b25480d7',
      '65dc88de0fb947f5b25480d9',
      '65dc8a040fb947f5b25480da',
      '65dc8bd90fb947f5b25480db',
      '65dc8ddb0fb947f5b25480dc',
      '65dc8e530fb947f5b25480de',
      '65dc8e710fb947f5b25480df',
      '65dc910e0fb947f5b25480e0',
      '65dc915f0fb947f5b25480e2',
      '65dc916f0fb947f5b25480e3',
      '65dc91fa0fb947f5b25480e4',
      '65dc92890fb947f5b25480e6',
      '65dc92b10fb947f5b25480e8',
      '65dc92ce0fb947f5b25480e9',
      '65dc95120fb947f5b25480eb',
      '65dc953f0fb947f5b25480ec',
      '65dc96b70fb947f5b25480ed',
      '65dc96db0fb947f5b25480ee',
      '65dc97440fb947f5b25480ef',
      '65dc97af0fb947f5b25480f1',
      '65dc98eb0fb947f5b25480f4',
      '65dc98f90fb947f5b25480f5',
      '65dc990a0fb947f5b25480f6',
      '65dc99760fb947f5b25480f7',
      '65dc9b1a0fb947f5b25480f9',
      '65dc9b570fb947f5b25480fa',
      '65dc9b640fb947f5b25480fb',
      '65dc9f450fb947f5b25480fd',
      '65dca07c0fb947f5b25480fe',
      '65dca1360fb947f5b2548100',
      '65dca1630fb947f5b2548101',
      '65dca1f90fb947f5b2548105',
      '65dca9960fb947f5b2548108',
      '65dcaaca0fb947f5b254810a',
      '65dcab070fb947f5b254810b',
      '65dcac6b0fb947f5b254810c',
      '65dcad840fb947f5b254810d',
      '65dcb1100fb947f5b254810e',
      '65dcb2560fb947f5b254810f',
      '65dcb2b80fb947f5b2548110',
      '65dcb5010fb947f5b2548112',
      '65dcb7dc0fb947f5b2548114',
      '65dcbc1d0fb947f5b2548117',
      '65dcc3210fb947f5b254811b',
      '65dcc38a0fb947f5b254811c',
      '65dcc38d0fb947f5b254811d',
      '65dcc4620fb947f5b254811e',
      '65dcc7020fb947f5b2548120',
      '65dcc8250fb947f5b2548122',
      '65dcc8bd0fb947f5b2548123',
      '65dccb050fb947f5b2548125',
      '65dccc450fb947f5b2548126',
      '65dccd210fb947f5b2548127',
      '65dcd8350fb947f5b254812a',
      '65dcd9d50fb947f5b254812b',
      '65dcdbd60fb947f5b254812c',
      '65dcdd740fb947f5b254812d',
      '65dce4550fb947f5b254812f',
      '65dce4b60fb947f5b2548131',
      '65dce8190fb947f5b2548132',
      '65dd01f40fb947f5b2548134',
      '65dd18d80fb947f5b2548135',
      '65dd1dec0fb947f5b2548136',
      '65dd383e0fb947f5b2548137',
      '65dd4a9e0fb947f5b2548138',
      '65dd4f3c0fb947f5b2548139',
      '65dd5ad60fb947f5b254813c',
      '65dd5d1a0fb947f5b254813e',
      '65dd5f6a0fb947f5b2548140',
      '65dd61ec0fb947f5b2548141',
      '65dd646b0fb947f5b2548142',
      '65dd65c60fb947f5b2548143',
      '65dd6afe0fb947f5b2548144',
      '65dd82db0fb947f5b2548147',
      '65dd91cc0fb947f5b2548148',
      '65dd959b0fb947f5b2548149',
      '65dd9e720fb947f5b254814a',
      '65dda3c70fb947f5b254814b',
      '65dda4990fb947f5b254814c',
      '65ddcd040fb947f5b254814e',
      '65ddd0120fb947f5b2548150',
      '65ddd2e50fb947f5b2548151',
      '65ddd73b0fb947f5b2548152',
      '65dddd7c0fb947f5b2548153',
      '65ddde890fb947f5b2548154',
      '65dddee30fb947f5b2548155',
      '65dde4a30fb947f5b2548156',
      '65dde57c0fb947f5b2548157',
      '65dde5840fb947f5b2548158',
      '65dde6810fb947f5b2548159',
      '65dde6f60fb947f5b254815a',
      '65dde7ff0fb947f5b254815b',
      '65dde85f0fb947f5b254815c',
      '65dde9020fb947f5b254815d',
      '65ddeb5c0fb947f5b254815f',
      '65ddec9c0fb947f5b2548161',
      '65ddeec30fb947f5b2548162',
      '65ddf1ae0fb947f5b2548163',
      '65ddf4060fb947f5b2548164',
      '65ddf4ee0fb947f5b2548165',
      '65ddf59e0fb947f5b2548166',
      '65ddf6750fb947f5b2548167',
      '65ddfa120fb947f5b2548169',
      '65de02160fb947f5b254816b',
      '65de04a60fb947f5b254816c',
      '65de05170fb947f5b254816e',
      '65de06430fb947f5b254816f',
      '65de076e0fb947f5b2548171',
      '65de09d20fb947f5b2548173',
      '65de09d50fb947f5b2548174',
      '65de0b210fb947f5b2548177',
      '65de0b340fb947f5b2548178',
      '65de0d250fb947f5b2548179',
      '65de0d690fb947f5b254817a',
      '65de0e300fb947f5b254817c',
      '65de0eb40fb947f5b254817e',
      '65de0fd40fb947f5b254817f',
      '65de17810fb947f5b2548181',
      '65de18e20fb947f5b2548182',
      '65de1ab50fb947f5b2548183',
      '65de20e80fb947f5b2548184',
      '65de20eb0fb947f5b2548185',
      '65de20f30fb947f5b2548186',
      '65de21970fb947f5b2548189',
      '65de22680fb947f5b254818a',
      '65de23050fb947f5b254818b',
      '65de29060fb947f5b254818c',
      '65de2b0c0fb947f5b254818e',
      '65de2eea0fb947f5b254818f',
      '65de31960fb947f5b2548190',
      '65de319c0fb947f5b2548191',
      '65de32230fb947f5b2548193',
      '65de323a0fb947f5b2548194',
      '65de336a0fb947f5b2548196',
      '65de33b50fb947f5b2548197',
      '65de33de0fb947f5b2548198',
      '65de34850fb947f5b2548199',
      '65de39700fb947f5b254819a',
      '65de3b490fb947f5b254819b',
      '65de43440fb947f5b254819c',
      '65de43d20fb947f5b254819e',
      '65de44910fb947f5b254819f',
      '65de476a0fb947f5b25481a1',
      '65de47740fb947f5b25481a2',
      '65de4b170fb947f5b25481a3',
      '65de5ad70fb947f5b25481a8',
      '65de5b210fb947f5b25481a9',
      '65de5bef0fb947f5b25481aa',
      '65de61e10fb947f5b25481ab',
      '65de82300fb947f5b25481ae',
      '65de9b6a0fb947f5b25481af',
      '65deaca10fb947f5b25481b0',
      '65deaffa0fb947f5b25481b1',
      '65deba110fb947f5b25481b3',
      '65ded0150fb947f5b25481b5',
      '65ded51e0fb947f5b25481b6',
      '65dede7d0fb947f5b25481b8',
      '65df03bd0fb947f5b25481bb',
      '65df0b610fb947f5b25481bd',
      '65df11120fb947f5b25481be',
      '65df23b60fb947f5b25481c0',
      '65df25010fb947f5b25481c1',
      '65df25f60fb947f5b25481c3',
      '65df29420fb947f5b25481c4',
      '65df2c2b0fb947f5b25481c6',
      '65df2c610fb947f5b25481c7',
      '65df2c650fb947f5b25481c8',
      '65df33c70fb947f5b25481ca',
      '65df34dd0fb947f5b25481cb',
      '65df37530fb947f5b25481cd',
      '65df37ac0fb947f5b25481ce',
      '65df3c4e0fb947f5b25481cf',
      '65df3dd70fb947f5b25481d0',
      '65df3ff50fb947f5b25481d1',
      '65df439d0fb947f5b25481d2',
      '65df50c10fb947f5b25481d4',
      '65df528b0fb947f5b25481d5',
      '65df57010fb947f5b25481d6',
      '65df6f500fb947f5b25481dc',
      '65df73750fb947f5b25481dd',
      '65df797c0fb947f5b25481de',
      '65df7c570fb947f5b25481df',
      '65df7c780fb947f5b25481e1',
      '65df7eb00fb947f5b25481e2',
      '65df818e0fb947f5b25481e3',
      '65df85b80fb947f5b25481e4',
      '65df88ea0fb947f5b25481e5',
      '65dfa4970fb947f5b25481e7',
      '65dffd0f0fb947f5b25481e8',
      '65dffd7a0fb947f5b25481e9',
      '65e00e2b0fb947f5b25481ea',
      '65e00ea40fb947f5b25481eb',
      '65e0116b0fb947f5b25481ed',
      '65e013090fb947f5b25481ee',
      '65e020ab0fb947f5b25481f0',
      '65e0234c0fb947f5b25481f1',
      '65e024e00fb947f5b25481f2',
      '65e03b590fb947f5b25481f4',
      '65e0412c0fb947f5b25481f5',
      '65e04a730fb947f5b25481f6',
      '65e052d00fb947f5b25481f7',
      '65e061150fb947f5b25481f8',
      '65e06fd00fb947f5b25481f9',
      '65e074aa0fb947f5b25481fb',
      '65e075b30fb947f5b25481fc',
      '65e077d50fb947f5b25481fd',
      '65e07e5f0fb947f5b25481fe',
      '65e080af0fb947f5b2548200',
      '65e081420fb947f5b2548201',
      '65e086c80fb947f5b2548203',
      '65e089b10fb947f5b2548205',
      '65e096be0fb947f5b2548206',
      '65e0982d0fb947f5b2548207',
      '65e0a2b6cc176893883e4889',
      '65e0a477cc176893883e488a',
      '65e0ac5ccc176893883e488b',
      '65e0ac7acc176893883e488c',
      '65e0b079cc176893883e488e',
      '65e0b333cc176893883e488f',
      '65e0b85fcc176893883e4892',
      '65e0c2d1cc176893883e4893',
      '65e0c394cc176893883e4894',
      '65e0c4eccc176893883e4895',
      '65e0daa8cc176893883e4896',
      '65e0db89cc176893883e4898',
      '65e0e3cccc176893883e4899',
      '65e0e44ccc176893883e489b',
      '65e0ed13cc176893883e489c',
      '65e0fbe5cc176893883e489d',
      '65e10a1fcc176893883e489e',
      '65e159ddcc176893883e489f',
      '65e19423cc176893883e48a1',
      '65e194c9cc176893883e48a2',
      '65e1c2dacc176893883e48a6',
      '65e1ce6bcc176893883e48a7',
      '65e1d0f0cc176893883e48a8',
      '65e1d501cc176893883e48a9',
      '65e1d509cc176893883e48aa',
      '65e1d58ecc176893883e48ab',
      '65e1d779cc176893883e48ac',
      '65e1d90bcc176893883e48ad',
      '65e1db22cc176893883e48ae',
      '65e1dc06cc176893883e48af',
      '65e1de6acc176893883e48b1',
      '65e1dfeccc176893883e48b2',
      '65e1e2f4cc176893883e48b3',
      '65e1e8bdcc176893883e48b4',
      '65e1ebafcc176893883e48b6',
      '65e1ebb3cc176893883e48b7',
      '65e1f103cc176893883e48b9',
      '65e1f3a9cc176893883e48ba',
      '65e1f7c4cc176893883e48bc',
      '65e1f7f7cc176893883e48bd',
      '65e206e3cc176893883e48bf',
      '65e214eacc176893883e48c0',
      '65e21823cc176893883e48c2',
      '65e21b26cc176893883e48c3',
      '65e21d7acc176893883e48c4',
      '65e21f18cc176893883e48c5',
      '65e227dfcc176893883e48c6',
      '65e2293ecc176893883e48c7',
      '65e22b1fcc176893883e48c8',
      '65e23095cc176893883e48c9',
      '65e27dc4cc176893883e48ca',
      '65e2a7bdcc176893883e48cb',
      '65e2ab1ccc176893883e48cc',
      '65e32a41cc176893883e48ce',
      '65e32ea6cc176893883e48d0',
      '65e34c21cc176893883e48d1',
      '65e360fbcc176893883e48d2',
      '65e38a86cc176893883e48d3',
      '65e42779cc176893883e48d5',
      '65e43e44cc176893883e48d6',
      '65e4556dcc176893883e48d8',
      '65e4762fcc176893883e48d9',
      '65e49d72cc176893883e48da',
      '65e4de6dcc176893883e48db',
      '65e55682cc176893883e48dd',
      '65e55ef8cc176893883e48de',
      '65e59160cc176893883e48df',
      '65e59451cc176893883e48e0',
      '65e59a1bcc176893883e48e2',
      '65e5ea6dcc176893883e48e4',
      '65e5fe09cc176893883e48e5',
      '65e615dbcc176893883e48e6',
      '65e621cacc176893883e48e7',
      '65e632afcc176893883e48e8',
      '65e64d98cc176893883e48e9',
      '65e689c6cc176893883e48ea',
      '65e68f37cc176893883e48ec',
      '65e6feafcc176893883e48ed',
      '65e74f75cc176893883e48ee',
      '65e84bc3cc176893883e48ef',
      '65e898e3cc176893883e48f1',
      '65e8bef1cc176893883e48f2',
      '65e934cacc176893883e48f3',
      '65e9485ccc176893883e48f4',
      '65e959f0cc176893883e48f6',
      '65e9ddf3cc176893883e48f8',
      '65e9eeebcc176893883e48f9',
      '65ea8dd8cc176893883e48fb',
      '65eaf318cc176893883e48fc',
      '65eaf807cc176893883e48fd',
      '65eb1da7cc176893883e48ff',
      '65eb2ea5cc176893883e4900',
      '65eb2fa6cc176893883e4902',
      '65eb3c55cc176893883e4904',
      '65ebbad0cc176893883e4905',
      '65ebd1edcc176893883e4906',
      '65ebebb1cc176893883e4907',
      '65ebec01cc176893883e4909',
      '65ebf363cc176893883e490a',
      '65ebf697cc176893883e490b',
      '65ec0155cc176893883e490d',
      '65ec0a8acc176893883e490e',
      '65ec26fbcc176893883e4910',
      '65ec369dcc176893883e4911',
      '65ec53c4cc176893883e4912',
      '65ec5bcfcc176893883e4914',
      '65ec5f9bcc176893883e4915',
      '65ec626fcc176893883e4916',
      '65ec663fcc176893883e4917',
      '65ec66c1cc176893883e4919',
      '65ec6e84cc176893883e491a',
      '65ec6faccc176893883e491c',
    ];

    const rv = [
      {
        id: '65900f84e771e0a80148ed84',
        name: 'Dr. Arghya Kundu',
        section: [1],
        subject: 'OOPJ,OPPJ(L)',
        likes: [
          'aanchalpandey783@gmail.com',
          '21052723@kiit.ac.in',
          '2105228@kiit.ac.in',
          '21053326@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22051073@kiit.ac.in',
        ],
        dislikes: [
          'khushisonalisinha0710@gmail.com',
          'imamansinha69@gmail.com',
          '21051173@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          '2105553@kiit.ac.in',
          'architaaswain16@gmail.com',
          '21051929@kiit.ac.in',
          '21051347@kiit.ac.in',
          '22053056@kiit.ac.in',
          '21052036@kiit.ac.in',
          '22054040@kiit.ac.in',
        ],
        reviews: [
          {
            id: '6590204045c2b626d34b3ad8',
            rating: 1,
            commentedBy: 'imamansinha69@gmail.com',
            internalScore: 28,
            comments: 'Mt lena isko kabhi bhool kr bhi',
            teacherId: '65900f84e771e0a80148ed84',
          },
        ],
      },

      {
        id: '65900f84e771e0a80148ed91',
        name: 'Prof. Pramod Kumar Das',
        section: [1, 52],
        subject: 'DSS',
        likes: ['shaswat.sherpur@gmail.com', '22053872@kiit.ac.in'],
        dislikes: [
          '2228176@kiit.ac.in',
          'arpanbagchi16@gmail.com',
          '22052978@kiit.ac.in',
          '22053308@kiit.ac.in',
        ],
        reviews: [],
      },
      {
        id: '65900f85e771e0a80148edae',
        name: 'Dr. Kalyani Mohanta',
        section: [1],
        subject: 'STW',
        likes: [
          '22052084@kiit.ac.in',
          '2205421@kiit.ac.in',
          '2229194@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: ['2206191@kiit.ac.in'],
        reviews: [],
      },

      {
        id: '65900f83e771e0a80148ed62',
        name: 'Dr. Srikumar Acharya',
        section: [2, 55],
        subject: 'DSS',
        likes: [
          '22051573@kiit.ac.in',
          '2105356@kiit.ac.in',
          '22051774@kiit.ac.in',
          '22053683@kiit.ac.in',
          '2205592@kiit.ac.in',
          '22051700@kiit.ac.in',
          '22052366@kiit.ac.in',
          '2206272@kiit.ac.in',
          '22053373@kiit.ac.in',
          '2206275@kiit.ac.in',
          '22052137@kiit.ac.in',
          '21053452@kiit.ac.in',
          '2205327@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22053408@kiit.ac.in',
        ],
        dislikes: [
          '21052859@kiit.ac.in',
          '22053185@kiit.ac.in',
          'pratikdash2004@gmail.com',
          '2205449@kiit.ac.in',
          '2205184@kiit.ac.in',
          '2205761@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22052287@kiit.ac.in',
          '22051651@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f85e771e0a80148edc7',
        name: 'Dr. Swayam B Mishra',
        section: [2],
        subject: 'STW',
        likes: [
          '22051266@kiit.ac.in',
          '2205570@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22053565@kiit.ac.in',
        ],
        dislikes: [],
        reviews: [
          {
            id: '6590371445c2b626d34b3b0e',
            rating: 3,
            commentedBy: '2205177@kiit.ac.in',
            internalScore: 26,
            comments:
              'average teacher, just reads out the PPts, roams in the class while doing so',
            teacherId: '65900f85e771e0a80148edc7',
          },
        ],
      },

      {
        id: '65900f83e771e0a80148ed5a',
        name: 'Dr. Prasanta Ku. Mohanty',
        section: [3, 46, 54],
        subject: 'DSS',
        likes: [
          '21052500@kiit.ac.in',
          '2105259@kiit.ac.in',
          '21052156@kiit.ac.in',
          '2105914@kiit.ac.in',
          '22051925@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          '22052620@kiit.ac.in',
          '21051040@kiit.ac.in',
          '21051376@kiit.ac.in',
          '22052189@kiit.ac.in',
          '21053420@kiit.ac.in',
          '22053090@kiit.ac.in',
          '2205666@kiit.ac.in',
          '22053568@kiit.ac.in',
          '2105566@kiit.ac.in',
          '22052843@kiit.ac.in',
          '22053683@kiit.ac.in',
          '22051448@kiit.ac.in',
          '22051815@kiit.ac.in',
          '22052137@kiit.ac.in',
          '22052337@kiit.ac.in',
          '22053614@kiit.ac.in',
          '22052078@kiit.ac.in',
          '22051429@kiit.ac.in',
          '22051425@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22054234@kiit.ac.in',
          '22052198@kiit.ac.in',
          '22051745@kiit.ac.in',
          '22052515@kiit.ac.in',
          '22052409@kiit.ac.in',
          '22053233@kiit.ac.in',
        ],
        dislikes: [
          '2205251@kiit.ac.in',
          'imamansinha69@gmail.com',
          '22051531@kiit.ac.in',
          '2105393@kiit.ac.in',
          '22052860@kiit.ac.in',
          '22051593@kiit.ac.in',
          '21052868@kiit.ac.in',
          '2105383@kiit.ac.in',
          '22052562@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22053308@kiit.ac.in',
        ],
        reviews: [
          {
            id: '6591026445c2b626d34b3b3f',
            rating: 5,
            commentedBy: '22051815@kiit.ac.in',
            internalScore: 30,
            comments:
              'Has very good grasp on the subject. Teaches very good. Just pay attention in his class. Maintain healthy attendance and will give very good in internals. Even if attendance is less than 75 still everyone got 25+ in internals.',
            teacherId: '65900f83e771e0a80148ed5a',
          },
          {
            id: '659466b245c2b626d34b3b7b',
            rating: 4,
            commentedBy: '22052198@kiit.ac.in',
            internalScore: 27,
            comments: 'teaches really well',
            teacherId: '65900f83e771e0a80148ed5a',
          },
        ],
      },

      {
        id: '65900f84e771e0a80148ed8f',
        name: 'Dr. S. Chaudhuri',
        section: [3],
        subject: 'STW',
        likes: [
          '2105914@kiit.ac.in',
          '21052859@kiit.ac.in',
          '21052413@kiit.ac.in',
          '2229096@kiit.ac.in',
          '22052879@kiit.ac.in',
          '22052337@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052515@kiit.ac.in',
          '22054276@kiit.ac.in',
          '22052409@kiit.ac.in',
          '22053233@kiit.ac.in',
          '2206005@kiit.ac.in',
        ],
        dislikes: [],
        reviews: [],
      },

      {
        id: '65900f85e771e0a80148edb0',
        name: 'Prof. Bikash Kumar Behera',
        section: [3, 24],
        subject: 'COA',
        likes: [
          '22053090@kiit.ac.in',
          '2205251@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22053990@kiit.ac.in',
          '22052409@kiit.ac.in',
          '22052515@kiit.ac.in',
          '22053233@kiit.ac.in',
          '22052383@kiit.ac.in',
        ],
        dislikes: [
          '22053185@kiit.ac.in',
          '22053634@kiit.ac.in',
          'dwivedyamrit1@gmail.com',
          '21051710@kiit.ac.in',
          '2205485@kiit.ac.in',
          '2205596@kiit.ac.in',
          '2229095@kiit.ac.in',
          '2229044@kiit.ac.in',
          '22053926@kiit.ac.in',
        ],
        reviews: [],
      },
      {
        id: '65900f83e771e0a80148ed54',
        name: 'Dr. Basanta Kumar Rana',
        section: [4],
        subject: 'STW',
        likes: [
          '2206172@kiit.ac.in',
          '22054463@kiit.ac.in',
          'hasanmahmudsourov27.9.2002@gmail.com',
          '2206379@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: ['22052527@kiit.ac.in'],
        reviews: [],
      },

      {
        id: '65900f84e771e0a80148ed7b',
        name: 'Dr. Arjun Kumar Paul',
        section: [4, 53],
        subject: 'DSS',
        likes: [
          '22053127@kiit.ac.in',
          '22051469@kiit.ac.in',
          'khaitanharsh08@gmail.com',
          '21051554@kiit.ac.in',
          '22051326@kiit.ac.in',
          '22053764@kiit.ac.in',
          '21053469@kiit.ac.in',
          '2105672@kiit.ac.in',
          '2228128@kiit.ac.in',
          '2105311@kiit.ac.in',
          '2206375@kiit.ac.in',
          '22053683@kiit.ac.in',
          '22051793@kiit.ac.in',
          '22052643@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22053119@kiit.ac.in',
          '22051204@kiit.ac.in',
          '22053673@kiit.ac.in',
          '23057058@kiit.ac.in',
          '22053872@kiit.ac.in',
          '2229044@kiit.ac.in',
          '2229084@kiit.ac.in',
        ],
        dislikes: [
          '2105316@kiit.ac.in',
          '22051347@kiit.ac.in',
          '22053675@kiit.ac.in',
        ],
        reviews: [
          {
            id: '6590204c45c2b626d34b3ad9',
            rating: 5,
            commentedBy: 'khaitanharsh08@gmail.com',
            internalScore: 30,
            comments:
              "Best teacher, doesn't take full attendance,easy proxy, gives you full marks if you score good marks in central quiz and submit all assignments. Very polite teacker",
            teacherId: '65900f84e771e0a80148ed7b',
          },
        ],
      },

      {
        id: '65900f84e771e0a80148ed7d',
        name: 'Mr. Sunil Kumar Gouda',
        section: [4, 25],
        subject: 'OOPJ,OPPJ(L)',
        likes: [
          '21051394@kiit.ac.in',
          '21052122@kiit.ac.in',
          '21052413@kiit.ac.in',
          'aanchalpandey783@gmail.com',
          'imamansinha69@gmail.com',
          '2105914@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          '21053469@kiit.ac.in',
          '2105228@kiit.ac.in',
          '21053326@kiit.ac.in',
          '22054390@kiit.ac.in',
          '2105762@kiit.ac.in',
          '21053338@kiit.ac.in',
          '22052366@kiit.ac.in',
          '22053565@kiit.ac.in',
          '22052137@kiit.ac.in',
          '2205152@kiit.ac.in',
          '2205165@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: ['2206118@kiit.ac.in'],
        reviews: [
          {
            id: '65901d2a45c2b626d34b3acc',
            rating: 5,
            commentedBy: '21051394@kiit.ac.in',
            internalScore: 25,
            comments: 'Good teacher and gives good marks.',
            teacherId: '65900f84e771e0a80148ed7d',
          },
        ],
      },

      {
        id: '65900f82e771e0a80148ed38',
        name: 'Dr. Jitendra Ku. Patel',
        section: [5],
        subject: 'STW',
        likes: [
          '2205251@kiit.ac.in',
          '22053306@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          '21052168@kiit.ac.in',
          '22053764@kiit.ac.in',
          '21052759@kiit.ac.in',
          '22053185@kiit.ac.in',
          '22052388@kiit.ac.in',
          '2206375@kiit.ac.in',
          '22053483@kiit.ac.in',
          '22053495@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22053308@kiit.ac.in',
          '22052825@kiit.ac.in',
          '22052525@kiit.ac.in',
          '22051723@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f83e771e0a80148ed56',
        name: 'Dr. Biswajit Sahoo',
        section: [5, 35],
        subject: 'OS',
        likes: [
          '21051456@kiit.ac.in',
          '21051939@kiit.ac.in',
          '2106110@kiit.ac.in',
          '21052500@kiit.ac.in',
          '2106302@kiit.ac.in',
          '2105259@kiit.ac.in',
          '21053329@kiit.ac.in',
          '2205107@kiit.ac.in',
          '21052156@kiit.ac.in',
          'khushisonalisinha0710@gmail.com',
          '2105627@kiit.ac.in',
          '21052122@kiit.ac.in',
          '21052413@kiit.ac.in',
          '2105079@kiit.ac.in',
          '21053420@kiit.ac.in',
          'aanchalpandey783@gmail.com',
          '21051729@kiit.ac.in',
          '21051801@kiit.ac.in',
          '2106283@kiit.ac.in',
          'imamansinha69@gmail.com',
          '22052948@kiit.ac.in',
          '21053365@kiit.ac.in',
          '2105914@kiit.ac.in',
          'shaswat.sherpur@gmail.com',
          'ashwinikapoor16@gmail.com',
          '2105393@kiit.ac.in',
          '21051173@kiit.ac.in',
          '2105366@kiit.ac.in',
          '2105553@kiit.ac.in',
          '21053469@kiit.ac.in',
          '22052860@kiit.ac.in',
          'diptimayeepradhan2003@gmail.com',
          '21051040@kiit.ac.in',
          '21051067@kiit.ac.in',
          '21051929@kiit.ac.in',
          '21052859@kiit.ac.in',
          '22052975@kiit.ac.in',
          '21051461@kiit.ac.in',
          '21051376@kiit.ac.in',
          '2105715@kiit.ac.in',
          '21051390@kiit.ac.in',
          '2105228@kiit.ac.in',
          '2129081@kiit.ac.in',
          '21051772@kiit.ac.in',
          '21051327@kiit.ac.in',
          '22053807@kiit.ac.in',
          'arpanbagchi16@gmail.com',
          '21052399@kiit.ac.in',
          '21052809@kiit.ac.in',
          '2105831@kiit.ac.in',
          '21052095@kiit.ac.in',
          '21052868@kiit.ac.in',
          '2105050@kiit.ac.in',
          '2105356@kiit.ac.in',
          '21052432@kiit.ac.in',
          '2128034@kiit.ac.in',
          '21053326@kiit.ac.in',
          '21051974@kiit.ac.in',
          'neolicious08@gmail.com',
          '21052036@kiit.ac.in',
          '2105347@kiit.ac.in',
          'snehakashyap020704@gmail.com',
          '21052149@kiit.ac.in',
          '2105986@kiit.ac.in',
          '2105762@kiit.ac.in',
          '2105566@kiit.ac.in',
          '21053338@kiit.ac.in',
          '21052415@kiit.ac.in',
          '2205267@kiit.ac.in',
          '21053384@kiit.ac.in',
          '21051710@kiit.ac.in',
          '22052843@kiit.ac.in',
          '22053683@kiit.ac.in',
          '22052807@kiit.ac.in',
          '21051909@kiit.ac.in',
          '22051448@kiit.ac.in',
          '2105260@kiit.ac.in',
          '2205596@kiit.ac.in',
          '2105750@kiit.ac.in',
          '2105763@kiit.ac.in',
          '2106089@kiit.ac.in',
          '22054403@kiit.ac.in',
          '2105011@kiit.ac.in',
          '2206275@kiit.ac.in',
          '22051204@kiit.ac.in',
          '2205169@kiit.ac.in',
          '22052348@kiit.ac.in',
          '22052868@kiit.ac.in',
          '21052981@kiit.ac.in',
          '22053029@kiit.ac.in',
        ],
        dislikes: [
          '2105743@kiit.ac.in',
          '2105790@kiit.ac.in',
          '21052791@kiit.ac.in',
          '2105541@kiit.ac.in',
          'debmalyadebnath@gmail.com',
          '2105974@kiit.ac.in',
          '2106101@kiit.ac.in',
          '22053483@kiit.ac.in',
          '22053495@kiit.ac.in',
          '2206118@kiit.ac.in',
          '2205508@kiit.ac.in',
          '22053308@kiit.ac.in',
          '22052825@kiit.ac.in',
          '22052525@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        reviews: [
          {
            id: '6590430d45c2b626d34b3b19',
            rating: 5,
            commentedBy: '21051974@kiit.ac.in',
            internalScore: 28,
            comments:
              'He is a very good teacher. Maintain give and take relation. If you want to learn just select him',
            teacherId: '65900f83e771e0a80148ed56',
          },
          {
            id: '6590ff0445c2b626d34b3b3e',
            rating: 5,
            commentedBy: '22052843@kiit.ac.in',
            internalScore: 30,
            comments:
              'One of the most chill teacher in KIIT, hamare C lab ke teacher the',
            teacherId: '65900f83e771e0a80148ed56',
          },
        ],
      },

      {
        id: '65900f84e771e0a80148ed9d',
        name: 'Prof.  K. B. Ray',
        section: [5, 22],
        subject: 'COA',
        likes: [
          'adityatiwari211104@gmail.com',
          'ashwinikapoor16@gmail.com',
          '2205715@kiit.ac.in',
          '22053724@kiit.ac.in',
          '22051774@kiit.ac.in',
          '22053675@kiit.ac.in',
          '22052366@kiit.ac.in',
          '2205165@kiit.ac.in',
          '22054256@kiit.ac.in',
          '22053865@kiit.ac.in',
          '2205521@kiit.ac.in',
          '22053673@kiit.ac.in',
          '22052137@kiit.ac.in',
          '22052078@kiit.ac.in',
          '22052317@kiit.ac.in',
          '22054463@kiit.ac.in',
          '2205508@kiit.ac.in',
          '22053872@kiit.ac.in',
          '2205761@kiit.ac.in',
        ],
        dislikes: [
          '22053483@kiit.ac.in',
          '22053495@kiit.ac.in',
          '22053614@kiit.ac.in',
          '2205206@kiit.ac.in',
          '2205489@kiit.ac.in',
          '2205485@kiit.ac.in',
          '2205185@kiit.ac.in',
          '2205191@kiit.ac.in',
          '2205219@kiit.ac.in',
          '2205208@kiit.ac.in',
          '22051204@kiit.ac.in',
          '2205101@kiit.ac.in',
          '2206019@kiit.ac.in',
          '22053308@kiit.ac.in',
          '22052825@kiit.ac.in',
          '22052525@kiit.ac.in',
          '22052409@kiit.ac.in',
          '22052107@kiit.ac.in',
        ],
        reviews: [
          {
            id: '65902ea945c2b626d34b3b04',
            rating: 5,
            commentedBy: '2205715@kiit.ac.in',
            internalScore: 29,
            comments: 'Very good teacher',
            teacherId: '65900f84e771e0a80148ed9d',
          },
        ],
      },

      {
        id: '65900f85e771e0a80148edc8',
        name: 'Dr. Manoranjan Sahoo',
        section: [5, 50],
        subject: 'DSS',
        likes: [
          '2228122@kiit.ac.in',
          '2228176@kiit.ac.in',
          '2106302@kiit.ac.in',
          '21051729@kiit.ac.in',
          'aanchalpandey783@gmail.com',
          'sdiccus@gmail.com',
          '21051716@kiit.ac.in',
          '21051488@kiit.ac.in',
          '21053471@kiit.ac.in',
          '21053469@kiit.ac.in',
          '2228128@kiit.ac.in',
          'abantigsh@gmail.com',
          '2105311@kiit.ac.in',
          '2106101@kiit.ac.in',
          '2105566@kiit.ac.in',
          '21052415@kiit.ac.in',
          '22051140@kiit.ac.in',
          '22052807@kiit.ac.in',
          '22052347@kiit.ac.in',
          '22051497@kiit.ac.in',
          '2106191@kiit.ac.in',
          '2206275@kiit.ac.in',
          '2205628@kiit.ac.in',
          '22052863@kiit.ac.in',
          '2206313@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22054256@kiit.ac.in',
        ],
        dislikes: [
          '2106283@kiit.ac.in',
          '2105743@kiit.ac.in',
          '21052809@kiit.ac.in',
          '22052542@kiit.ac.in',
          '22053483@kiit.ac.in',
          '22051700@kiit.ac.in',
          '22053303@kiit.ac.in',
          '2106089@kiit.ac.in',
          '22051774@kiit.ac.in',
          '22053308@kiit.ac.in',
          '22052825@kiit.ac.in',
          '22052525@kiit.ac.in',
        ],
        reviews: [
          {
            id: '6592f5c145c2b626d34b3b5b',
            rating: 4,
            commentedBy: '2205628@kiit.ac.in',
            internalScore: 28,
            comments:
              'Very good teacher, explains well, gives good internals. Only one thing is that never use phone in his class or you are gone!',
            teacherId: '65900f85e771e0a80148edc8',
          },
          {
            id: '6592f5c145c2b626d34b3b5c',
            rating: 4,
            commentedBy: '2205628@kiit.ac.in',
            internalScore: 28,
            comments:
              'Very good teacher, explains well, gives good internals. Only one thing is that never use phone in his class or you are gone!',
            teacherId: '65900f85e771e0a80148edc8',
          },
        ],
      },
      {
        id: '65900f84e771e0a80148ed80',
        name: 'Dr. M. M. Acharya',
        section: [6, 49],
        subject: 'DSS',
        likes: [
          '22053891@kiit.ac.in',
          '22052557@kiit.ac.in',
          '21051067@kiit.ac.in',
          '2205715@kiit.ac.in',
          '21051390@kiit.ac.in',
          '22052928@kiit.ac.in',
          '2205251@kiit.ac.in',
          '21051974@kiit.ac.in',
          '21051756@kiit.ac.in',
          '22053938@kiit.ac.in',
          '2228064@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22053926@kiit.ac.in',
          '2205455@kiit.ac.in',
        ],
        dislikes: ['22052717@kiit.ac.in', '22053950@kiit.ac.in'],
        reviews: [],
      },

      {
        id: '65900f84e771e0a80148ed7f',
        name: 'Dr. Avinash Chaudhary',
        section: [6],
        subject: 'STW',
        likes: [
          '22054008@kiit.ac.in',
          '2205251@kiit.ac.in',
          '22053683@kiit.ac.in',
          '2229130@kiit.ac.in',
          '2228009@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [],
        reviews: [],
      },

      {
        id: '65900f82e771e0a80148ed39',
        name: 'Dr. Promod Mallick',
        section: [7],
        subject: 'STW',
        likes: [
          '22052932@kiit.ac.in',
          '2228176@kiit.ac.in',
          '2228055@kiit.ac.in',
          '22054351@kiit.ac.in',
          '22052166@kiit.ac.in',
          '22052337@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          '22053056@kiit.ac.in',
          '2230040@kiit.ac.in',
          '2228068@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22051723@kiit.ac.in',
        ],
        reviews: [],
      },
      {
        id: '65900f85e771e0a80148edb5',
        name: 'Dr. Laxmipriya Nayak',
        section: [7, 48],
        subject: 'DSS',
        likes: [
          '22052051@kiit.ac.in',
          '22054339@kiit.ac.in',
          '2105743@kiit.ac.in',
          'tejassoni1110@gmail.com',
          '22052244@kiit.ac.in',
          'piyushverma2k17@gmail.com',
          'neolicious08@gmail.com',
          '22054430@kiit.ac.in',
          '2105860@kiit.ac.in',
          '2105762@kiit.ac.in',
          'nknitu2308@gmail.com',
          '22054400@kiit.ac.in',
          '22054401@kiit.ac.in',
          '22054402@kiit.ac.in',
          '22054404@kiit.ac.in',
          '22054405@kiit.ac.in',
          '22054406@kiit.ac.in',
          '22054407@kiit.ac.in',
          '22054408@kiit.ac.in',
          '22054409@kiit.ac.in',
          '220544010@kiit.ac.in',
          '220544011@kiit.ac.in',
          '220544012@kiit.ac.in',
          '220544013@kiit.ac.in',
          '220544014@kiit.ac.in',
          '220544015@kiit.ac.in',
          '220544016@kiit.ac.in',
          '220544017@kiit.ac.in',
          '220544018@kiit.ac.in',
          '220544019@kiit.ac.in',
          '220544020@kiit.ac.in',
          '220544021@kiit.ac.in',
          '220544022@kiit.ac.in',
          '220544023@kiit.ac.in',
          '220544024@kiit.ac.in',
          '220544025@kiit.ac.in',
          '220544026@kiit.ac.in',
          '220544027@kiit.ac.in',
          '220544028@kiit.ac.in',
          '220544029@kiit.ac.in',
          '220544030@kiit.ac.in',
          '220544031@kiit.ac.in',
          '220544032@kiit.ac.in',
          '220544033@kiit.ac.in',
          '220544034@kiit.ac.in',
          '220544035@kiit.ac.in',
          '220544036@kiit.ac.in',
          '220544037@kiit.ac.in',
          '220544038@kiit.ac.in',
          '220544039@kiit.ac.in',
          '220544040@kiit.ac.in',
          '220544041@kiit.ac.in',
          '220544042@kiit.ac.in',
          '220544043@kiit.ac.in',
          '220544044@kiit.ac.in',
          '220544045@kiit.ac.in',
          '220544046@kiit.ac.in',
          '220544047@kiit.ac.in',
          '220544048@kiit.ac.in',
          '220544049@kiit.ac.in',
          '220544050@kiit.ac.in',
          '220544051@kiit.ac.in',
          '220544052@kiit.ac.in',
          '220544053@kiit.ac.in',
          '220544054@kiit.ac.in',
          '220544055@kiit.ac.in',
          '220544056@kiit.ac.in',
          '220544057@kiit.ac.in',
          '220544058@kiit.ac.in',
          '220544059@kiit.ac.in',
          '220544060@kiit.ac.in',
          '220544061@kiit.ac.in',
          '220544062@kiit.ac.in',
          '220544063@kiit.ac.in',
          '220544064@kiit.ac.in',
          '220544065@kiit.ac.in',
          '220544066@kiit.ac.in',
          '220544067@kiit.ac.in',
          '220544068@kiit.ac.in',
          '220544069@kiit.ac.in',
          '220544070@kiit.ac.in',
          '220544071@kiit.ac.in',
          '220544072@kiit.ac.in',
          '220544073@kiit.ac.in',
          '220544074@kiit.ac.in',
          '220544075@kiit.ac.in',
          '220544076@kiit.ac.in',
          '220544077@kiit.ac.in',
          '220544078@kiit.ac.in',
          '220544079@kiit.ac.in',
          '220544080@kiit.ac.in',
          '220544081@kiit.ac.in',
          '220544082@kiit.ac.in',
          '220544083@kiit.ac.in',
          '220544084@kiit.ac.in',
          '220544085@kiit.ac.in',
          '220544086@kiit.ac.in',
          '220544087@kiit.ac.in',
          '2205440150@kiit.ac.in',
          '220544088@kiit.ac.in',
          '2205440151@kiit.ac.in',
          '220544089@kiit.ac.in',
          '2205440152@kiit.ac.in',
          '220544090@kiit.ac.in',
          '220544091@kiit.ac.in',
          '2205440154@kiit.ac.in',
          '220544092@kiit.ac.in',
          '2205440155@kiit.ac.in',
          '220544093@kiit.ac.in',
          '2205440156@kiit.ac.in',
          '220544094@kiit.ac.in',
          '2205440157@kiit.ac.in',
          '220544095@kiit.ac.in',
          '2205440158@kiit.ac.in',
          '220544096@kiit.ac.in',
          '2205440159@kiit.ac.in',
          '220544097@kiit.ac.in',
          '2205440160@kiit.ac.in',
          '220544098@kiit.ac.in',
          '2205440161@kiit.ac.in',
          '220544099@kiit.ac.in',
          '2205440162@kiit.ac.in',
          '2205440100@kiit.ac.in',
          '2205440163@kiit.ac.in',
          '2205440101@kiit.ac.in',
          '2205440164@kiit.ac.in',
          '2205440102@kiit.ac.in',
          '2205440165@kiit.ac.in',
          '2205440103@kiit.ac.in',
          '2205440166@kiit.ac.in',
          '2205440104@kiit.ac.in',
          '2205440167@kiit.ac.in',
          '2205440105@kiit.ac.in',
          '2205440168@kiit.ac.in',
          '2205440106@kiit.ac.in',
          '2205440169@kiit.ac.in',
          '2205440107@kiit.ac.in',
          '2205440170@kiit.ac.in',
          '2205440108@kiit.ac.in',
          '2205440171@kiit.ac.in',
          '2205440109@kiit.ac.in',
          '2205440172@kiit.ac.in',
          '2205440110@kiit.ac.in',
          '2205440173@kiit.ac.in',
          '2205440111@kiit.ac.in',
          '2205440174@kiit.ac.in',
          '2205440112@kiit.ac.in',
          '2205440175@kiit.ac.in',
          '2205440113@kiit.ac.in',
          '2205440176@kiit.ac.in',
          '2205440114@kiit.ac.in',
          '2205440177@kiit.ac.in',
          '2205440115@kiit.ac.in',
          '2205440178@kiit.ac.in',
          '2205440116@kiit.ac.in',
          '2205440179@kiit.ac.in',
          '2205440117@kiit.ac.in',
          '2205440180@kiit.ac.in',
          '2205440118@kiit.ac.in',
          '2205440181@kiit.ac.in',
          '2205440119@kiit.ac.in',
          '2205440182@kiit.ac.in',
          '22054386@kiit.ac.in',
          '22054132@kiit.ac.in',
          '22051448@kiit.ac.in',
          '22054352@kiit.ac.in',
          '22054139@kiit.ac.in',
          '22051327@kiit.ac.in',
          '22052245@kiit.ac.in',
          '22051823@kiit.ac.in',
          '2105750@kiit.ac.in',
          '2105763@kiit.ac.in',
          '2106191@kiit.ac.in',
          '22054202@kiit.ac.in',
          '22052042@kiit.ac.in',
          '22053872@kiit.ac.in',
          '2205569@kiit.ac.in',
          '22054058@kiit.ac.in',
          '22054097@kiit.ac.in',
          '22054040@kiit.ac.in',
        ],
        dislikes: [
          '22052914@kiit.ac.in',
          '22053234@kiit.ac.in',
          'prabhakars367@gmail.com',
          'singhprabhakarkumar07@gmail.com',
          'snehakashyap020704@gmail.com',
          '2106101@kiit.ac.in',
          '22051829@kiit.ac.in',
          '2205596@kiit.ac.in',
          '2106089@kiit.ac.in',
          '2205984@kiit.ac.in',
          '22054403@kiit.ac.in',
        ],
        reviews: [
          {
            id: '659026f145c2b626d34b3ae5',
            rating: 5,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 30,
            comments: 'best',
            teacherId: '65900f85e771e0a80148edb5',
          },
          {
            id: '65904d6745c2b626d34b3b20',
            rating: 5,
            commentedBy: '22054430@kiit.ac.in',
            internalScore: 30,
            comments: 'if we want good mark then select.\n',
            teacherId: '65900f85e771e0a80148edb5',
          },
        ],
      },

      {
        id: '65900f85e771e0a80148edbb',
        name: 'Mr. Nayan Kumar S. Behera',
        section: [7, 45],
        subject: 'OS(L)',
        likes: [
          '2205810@kiit.ac.in',
          '2228055@kiit.ac.in',
          '2106302@kiit.ac.in',
          '21051456@kiit.ac.in',
          '21052413@kiit.ac.in',
          '21051729@kiit.ac.in',
          '2105079@kiit.ac.in',
          '21053469@kiit.ac.in',
          '22053722@kiit.ac.in',
          'gupta.ayush.kiit@gmail.com',
          'tmohanty271@gmail.com',
          'rajeshojha1807@gmail.com',
          'abidewithme48@gmail.com',
          'litub704@gmail.com',
          'pradeeprout0824@gmail.com',
          'avijitbiswas6969@gmail.com',
          'linexshreyas@gmail.com',
          'reddyjaswanth825@gmail.com',
          '21052415@kiit.ac.in',
          '22053614@kiit.ac.in',
          '2105260@kiit.ac.in',
          '22054090@kiit.ac.in',
          '2228080@kiit.ac.in',
          'nayan.beherafcs@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22053408@kiit.ac.in',
        ],
        dislikes: [
          '21051929@kiit.ac.in',
          '22054008@kiit.ac.in',
          '2228006@kiit.ac.in',
          '22053724@kiit.ac.in',
          '22053683@kiit.ac.in',
          '22051448@kiit.ac.in',
          '22052768@kiit.ac.in',
          '22052536@kiit.ac.in',
          '22053455@kiit.ac.in',
        ],
        reviews: [
          {
            id: '6590362745c2b626d34b3b0d',
            rating: 5,
            commentedBy: 'gupta.ayush.kiit@gmail.com',
            internalScore: 25,
            comments: '28',
            teacherId: '65900f85e771e0a80148edbb',
          },
          {
            id: '6593a79045c2b626d34b3b68',
            rating: 2,
            commentedBy: '22052768@kiit.ac.in',
            internalScore: 23,
            comments:
              "Doesn't teach good, also gave very bad marks in internal to everyone in the class\n",
            teacherId: '65900f85e771e0a80148edbb',
          },
        ],
      },
      {
        id: '65900f82e771e0a80148ed47',
        name: 'Dr. Arun Kumar Gupta',
        section: [8, 47],
        subject: 'DSS',
        likes: [
          '22051573@kiit.ac.in',
          '2105914@kiit.ac.in',
          '22052705@kiit.ac.in',
          '21053469@kiit.ac.in',
          '2004295@kiit.ac.in',
          '22051593@kiit.ac.in',
          '21052399@kiit.ac.in',
          '2105356@kiit.ac.in',
          'teaminf69@gmail.com',
          'piyushverma2k17@gmail.com',
          '2230127@kiit.ac.in',
          '22051037@kiit.ac.in',
          '22054166@kiit.ac.in',
          '22053724@kiit.ac.in',
          '22053938@kiit.ac.in',
          '2228055@kiit.ac.in',
          '22052262@kiit.ac.in',
          '22053498@kiit.ac.in',
          '22051868@kiit.ac.in',
          '2105872@kiit.ac.in',
          '22051167@kiit.ac.in',
          '22052413@kiit.ac.in',
          '22051178@kiit.ac.in',
          '2205508@kiit.ac.in',
          '22051204@kiit.ac.in',
          '22053295@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          '22051755@kiit.ac.in',
          '22053675@kiit.ac.in',
          '2205948@kiit.ac.in',
          '2205208@kiit.ac.in',
          '2205206@kiit.ac.in',
          '2205485@kiit.ac.in',
          '2205185@kiit.ac.in',
          '2205600@kiit.ac.in',
          '2206019@kiit.ac.in',
          '22053455@kiit.ac.in',
          '22051723@kiit.ac.in',
          '22051017@kiit.ac.in',
          '22052337@kiit.ac.in',
          '2205763@kiit.ac.in',
        ],
        reviews: [
          {
            id: '6590241645c2b626d34b3ae1',
            rating: 5,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 28,
            comments: 'best faculty',
            teacherId: '65900f82e771e0a80148ed47',
          },
          {
            id: '6590269845c2b626d34b3ae3',
            rating: 4,
            commentedBy: '22052705@kiit.ac.in',
            internalScore: 25,
            comments:
              'Thik thak hi he ...\nAttendance me thoda strict hein sir',
            teacherId: '65900f82e771e0a80148ed47',
          },
          {
            id: '65926c9345c2b626d34b3b54',
            rating: 4,
            commentedBy: '22053675@kiit.ac.in',
            internalScore: 24,
            comments:
              'Internal bahat kam dete hain but mid sem mein thik thak dete hain',
            teacherId: '65900f82e771e0a80148ed47',
          },
          {
            id: '6593069445c2b626d34b3b5d',
            rating: 4,
            commentedBy: '22051204@kiit.ac.in',
            internalScore: 28,
            comments:
              'Bohot achha padhata hai. Internals mein full nehi deta, par bohot lenient checking karta hai.',
            teacherId: '65900f82e771e0a80148ed47',
          },
        ],
      },

      {
        id: '65900f83e771e0a80148ed55',
        name: 'Prof. S. K. Badi',
        section: [8, 26],
        subject: 'COA',
        likes: [
          '2105259@kiit.ac.in',
          'abhivai146@gmail.com',
          '21053420@kiit.ac.in',
          '2205265@kiit.ac.in',
          '22051117@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22053465@kiit.ac.in',
          '2205333@kiit.ac.in',
        ],
        dislikes: [
          '2104059@kiit.ac.in',
          '21051554@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          '2105366@kiit.ac.in',
          '22053331@kiit.ac.in',
          '2004295@kiit.ac.in',
          '21051347@kiit.ac.in',
          '2105383@kiit.ac.in',
          '2205208@kiit.ac.in',
          '2205206@kiit.ac.in',
          '2205485@kiit.ac.in',
          '2205185@kiit.ac.in',
          '2205600@kiit.ac.in',
          '2206019@kiit.ac.in',
          '2205697@kiit.ac.in',
          '2205950@kiit.ac.in',
          '2205763@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f83e771e0a80148ed5b',
        name: 'Dr. Spandan Guha',
        section: [8],
        subject: 'STW',
        likes: [
          '22052932@kiit.ac.in',
          '22051531@kiit.ac.in',
          '2205134@kiit.ac.in',
          '22052597@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          '22053331@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22054163@kiit.ac.in',
          '2205208@kiit.ac.in',
          '2205206@kiit.ac.in',
          '2205485@kiit.ac.in',
          '2205185@kiit.ac.in',
          '22052337@kiit.ac.in',
          '22052116@kiit.ac.in',
          '2206019@kiit.ac.in',
          '2205763@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f82e771e0a80148ed32',
        name: 'Prof. S. Padhy',
        section: [9],
        subject: 'COA',
        likes: [
          '21052759@kiit.ac.in',
          '22053312@kiit.ac.in',
          '2205327@kiit.ac.in',
          '22053872@kiit.ac.in',
          '2205144@kiit.ac.in',
          '21053420@kiit.ac.in',
          '23051340@kiit.ac.in',
        ],
        dislikes: [
          '2206118@kiit.ac.in',
          '22051723@kiit.ac.in',
          '21052608@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f82e771e0a80148ed3e',
        name: 'Mr. Rakesh Kumar Rai',
        section: [9, 13],
        subject: 'DBMS,OOPJ,OPPJ(L)',
        likes: ['22054176@kiit.ac.in', '22053872@kiit.ac.in'],
        dislikes: ['22053308@kiit.ac.in', '22051723@kiit.ac.in'],
        reviews: [],
      },

      {
        id: '65900f82e771e0a80148ed44',
        name: 'Dr. Swarup K. Nayak',
        section: [9],
        subject: 'STW',
        likes: [
          '22053903@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052256@kiit.ac.in',
        ],
        dislikes: [
          'imamansinha69@gmail.com',
          '22052366@kiit.ac.in',
          '22054273@kiit.ac.in',
          '22051723@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f84e771e0a80148ed70',
        name: 'Dr. Akshaya Kumar Panda',
        section: [9],
        subject: 'DSS',
        likes: [
          '2106302@kiit.ac.in',
          'debasmith2804@gmail.com',
          'shaswat.sherpur@gmail.com',
          '21051376@kiit.ac.in',
          'arpanbagchi16@gmail.com',
          '22054351@kiit.ac.in',
          '22051320@kiit.ac.in',
          '22051229@kiit.ac.in',
          '2206080@kiit.ac.in',
          '22053872@kiit.ac.in',
          '2206169@kiit.ac.in',
        ],
        dislikes: [
          'imamansinha69@gmail.com',
          '2106268@kiit.ac.in',
          '2206375@kiit.ac.in',
          '2205984@kiit.ac.in',
          '22051321@kiit.ac.in',
          '2206118@kiit.ac.in',
          '2206340@kiit.ac.in',
          '2206331@kiit.ac.in',
          '2205209@kiit.ac.in',
          '22051236@kiit.ac.in',
          '2206205@kiit.ac.in',
          '22051369@kiit.ac.in',
        ],
        reviews: [
          {
            id: '65901ff545c2b626d34b3ad6',
            rating: 1,
            commentedBy: 'imamansinha69@gmail.com',
            internalScore: 15,
            comments: 'Number nhi dega',
            teacherId: '65900f84e771e0a80148ed70',
          },
          {
            id: '6591aafe45c2b626d34b3b50',
            rating: 5,
            commentedBy: '2206340@kiit.ac.in',
            internalScore: 25,
            comments:
              'Bhai aankh band kr k paper check kr deta h not in a good sense like tmhare answers shi h to b 0 de dega kyuki vo check hi nhi krta',
            teacherId: '65900f84e771e0a80148ed70',
          },
          {
            id: '6591ab5145c2b626d34b3b51',
            rating: 1,
            commentedBy: '2206340@kiit.ac.in',
            internalScore: 25,
            comments:
              'Bhai aankh band kr k paper check krega not in a good sense. Shi answer pe bhi 0 de dega kyuki vo paper check hi nhi krta',
            teacherId: '65900f84e771e0a80148ed70',
          },
        ],
      },

      {
        id: '65900f83e771e0a80148ed50',
        name: 'Dr. Mitali Routaray',
        section: [10, 45],
        subject: 'DSS',
        likes: [
          '21052500@kiit.ac.in',
          '2106302@kiit.ac.in',
          '2105743@kiit.ac.in',
          '22051531@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          'architaaswain16@gmail.com',
          '2129081@kiit.ac.in',
          '21051772@kiit.ac.in',
          'arpanbagchi16@gmail.com',
          '2205060@kiit.ac.in',
          '22054111@kiit.ac.in',
          '22051448@kiit.ac.in',
          '22053532@kiit.ac.in',
          '22051204@kiit.ac.in',
          '2205172@kiit.ac.in',
          '22053700@kiit.ac.in',
          '2205092@kiit.ac.in',
          '22051470@kiit.ac.in',
          '22052755@kiit.ac.in',
        ],
        dislikes: [
          '2106110@kiit.ac.in',
          '22054339@kiit.ac.in',
          '2205107@kiit.ac.in',
          '21051729@kiit.ac.in',
          '21053380@kiit.ac.in',
          '2205134@kiit.ac.in',
          '22053495@kiit.ac.in',
          '22053483@kiit.ac.in',
          '22053484@kiit.ac.in',
          '22051700@kiit.ac.in',
          '2205570@kiit.ac.in',
          '22052135@kiit.ac.in',
          '22051115@kiit.ac.in',
          '22052467@kiit.ac.in',
          '22052517@kiit.ac.in',
          '22053309@kiit.ac.in',
          '22054206@kiit.ac.in',
          '22053673@kiit.ac.in',
          '22053998@kiit.ac.in',
          '22053455@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22051437@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f84e771e0a80148ed9a',
        name: 'Dr. Banishree Misra',
        section: [10],
        subject: 'STW',
        likes: [
          '2205455@kiit.ac.in',
          '22051322@kiit.ac.in',
          '2205134@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          '22054347@kiit.ac.in',
          '22053495@kiit.ac.in',
          '22053483@kiit.ac.in',
          '22053484@kiit.ac.in',
          '22051115@kiit.ac.in',
          '22053309@kiit.ac.in',
        ],
        reviews: [
          {
            id: '6590e3a345c2b626d34b3b39',
            rating: 5,
            commentedBy: '22051322@kiit.ac.in',
            internalScore: 29,
            comments: 'Good',
            teacherId: '65900f84e771e0a80148ed9a',
          },
        ],
      },

      {
        id: '65900f83e771e0a80148ed68',
        name: 'Dr. Suvasis Nayak',
        section: [11, 31],
        subject: 'DSS',
        likes: [
          '21052500@kiit.ac.in',
          '22052932@kiit.ac.in',
          '21051729@kiit.ac.in',
          '21051801@kiit.ac.in',
          '21051716@kiit.ac.in',
          '21052723@kiit.ac.in',
          '22053764@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          '21051041@kiit.ac.in',
          '21053469@kiit.ac.in',
          '21051040@kiit.ac.in',
          '21051067@kiit.ac.in',
          '2105715@kiit.ac.in',
          '22052819@kiit.ac.in',
          '22052828@kiit.ac.in',
          '2105585@kiit.ac.in',
          '2229155@kiit.ac.in',
          '21051710@kiit.ac.in',
          '22052879@kiit.ac.in',
          '2205302@kiit.ac.in',
          '2229096@kiit.ac.in',
          '2105763@kiit.ac.in',
          '22052042@kiit.ac.in',
          '22052337@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: ['2206118@kiit.ac.in'],
        reviews: [],
      },
      {
        id: '65900f84e771e0a80148ed8b',
        name: 'Dr. Sriparna Roy Ghatak',
        section: [11, 32],
        subject: 'STW',
        likes: [
          '2206118@kiit.ac.in',
          '22053872@kiit.ac.in',
          '23051570@kiit.ac.in',
        ],
        dislikes: [
          '22054339@kiit.ac.in',
          '22051531@kiit.ac.in',
          '22053722@kiit.ac.in',
          '2105289@kiit.ac.in',
          '22053247@kiit.ac.in',
          '2205763@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f82e771e0a80148ed35',
        name: 'Dr. Joydeb Pal',
        section: [12, 32],
        subject: 'DSS',
        likes: [
          '2206146@kiit.ac.in',
          'randibaaz835@gmail.com',
          '2105627@kiit.ac.in',
          'aanchalpandey783@gmail.com',
          '2206107@kiit.ac.in',
          '2206169@kiit.ac.in',
          '21051801@kiit.ac.in',
          '21051729@kiit.ac.in',
          '21051173@kiit.ac.in',
          '22052628@kiit.ac.in',
          '21051929@kiit.ac.in',
          '2105715@kiit.ac.in',
          '22053807@kiit.ac.in',
          '2128044@kiit.ac.in',
          '22052643@kiit.ac.in',
          '2105831@kiit.ac.in',
          '21051715@kiit.ac.in',
          '2105986@kiit.ac.in',
          '2105585@kiit.ac.in',
          '21051664@kiit.ac.in',
          '2105762@kiit.ac.in',
          '21051592@kiit.ac.in',
          '22052712@kiit.ac.in',
          '22052879@kiit.ac.in',
          '2206065@kiit.ac.in',
          '2206293@kiit.ac.in',
          '22052609@kiit.ac.in',
          '2105750@kiit.ac.in',
          '2105763@kiit.ac.in',
          '2106089@kiit.ac.in',
          '2206380@kiit.ac.in',
          '22054395@kiit.ac.in',
          '22051204@kiit.ac.in',
          '22053610@kiit.ac.in',
          '2206021@kiit.ac.in',
          '2205533@kiit.ac.in',
          '22054078@kiit.ac.in',
          '22051480@kiit.ac.in',
          '2205497@kiit.ac.in',
          '2205408@kiit.ac.in',
        ],
        dislikes: [
          '2106302@kiit.ac.in',
          '2105743@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          '21052759@kiit.ac.in',
          '2105964@kiit.ac.in',
          '2105289@kiit.ac.in',
          '21051772@kiit.ac.in',
          '21052432@kiit.ac.in',
          '2105860@kiit.ac.in',
          '2128088@kiit.ac.in',
          '22051448@kiit.ac.in',
          '2105872@kiit.ac.in',
          '21052708@kiit.ac.in',
          '2206118@kiit.ac.in',
          '2205206@kiit.ac.in',
          '2205489@kiit.ac.in',
          '2205485@kiit.ac.in',
          '2205185@kiit.ac.in',
          '2205191@kiit.ac.in',
          '2205219@kiit.ac.in',
          '2205208@kiit.ac.in',
          '2205508@kiit.ac.in',
          '2205954@kiit.ac.in',
          '22054276@kiit.ac.in',
          '22051723@kiit.ac.in',
          '22053872@kiit.ac.in',
          '2205763@kiit.ac.in',
          '21052608@kiit.ac.in',
        ],
        reviews: [
          {
            id: '65901e1745c2b626d34b3ad2',
            rating: 5,
            commentedBy: '2206107@kiit.ac.in',
            internalScore: 28,
            comments:
              "He is very good and very chill teacher and also teaches very well. He'll try to give as much as possible internals. You can choose him blindly. ",
            teacherId: '65900f82e771e0a80148ed35',
          },
          {
            id: '659033fa45c2b626d34b3b08',
            rating: 4,
            commentedBy: '22052643@kiit.ac.in',
            internalScore: 29,
            comments: 'Great teaching style.',
            teacherId: '65900f82e771e0a80148ed35',
          },
          {
            id: '6590342145c2b626d34b3b09',
            rating: 5,
            commentedBy: '22052643@kiit.ac.in',
            internalScore: 29,
            comments: '.',
            teacherId: '65900f82e771e0a80148ed35',
          },
          {
            id: '6590568845c2b626d34b3b25',
            rating: 3,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 25,
            comments: 'Average',
            teacherId: '65900f82e771e0a80148ed35',
          },
        ],
      },

      {
        id: '65900f83e771e0a80148ed5d',
        name: 'Dr. Alivarani Mohapatra',
        section: [12],
        subject: 'STW',
        likes: [
          '22052557@kiit.ac.in',
          '22052548@kiit.ac.in',
          '2106101@kiit.ac.in',
          '2106089@kiit.ac.in',
          '2205596@kiit.ac.in',
          '2205533@kiit.ac.in',
          '22051950@kiit.ac.in',
          '2205569@kiit.ac.in',
          '22054078@kiit.ac.in',
        ],
        dislikes: [
          '2206118@kiit.ac.in',
          '2205206@kiit.ac.in',
          '2205489@kiit.ac.in',
          '2205485@kiit.ac.in',
          '2205185@kiit.ac.in',
          '2205191@kiit.ac.in',
          '2205219@kiit.ac.in',
          '2205208@kiit.ac.in',
          '2205954@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f85e771e0a80148eda2',
        name: 'Dr. Ranjeeta Patel',
        section: [13],
        subject: 'STW',
        likes: [
          '2205267@kiit.ac.in',
          '22054351@kiit.ac.in',
          '22054038@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052842@kiit.ac.in',
        ],
        dislikes: ['2105011@kiit.ac.in'],
        reviews: [],
      },

      {
        id: '65900f85e771e0a80148edc4',
        name: 'Dr. Manas Ranjan Mohapatra',
        section: [14, 30, 51],
        subject: 'DSS',
        likes: [
          '22053764@kiit.ac.in',
          'linexshreyas@gmail.com',
          '22053256@kiit.ac.in',
          '2205954@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          '22053807@kiit.ac.in',
          '22052895@kiit.ac.in',
          '2206118@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f85e771e0a80148edc6',
        name: 'Prof. Anil Kumar Behera',
        section: [14],
        subject: 'STW',
        likes: [
          'khaitanharsh08@gmail.com',
          '22052860@kiit.ac.in',
          '22054347@kiit.ac.in',
          '2206375@kiit.ac.in',
          '2206212@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: ['2205165@kiit.ac.in', '22052930@kiit.ac.in'],
        reviews: [
          {
            id: '6590223745c2b626d34b3ade',
            rating: 5,
            commentedBy: 'khaitanharsh08@gmail.com',
            internalScore: 30,
            comments:
              'Will give you andha dun marks on paper and teacher. Very young teacher, toh memes se joke bhi karta hai, aur acha khasa roast karega toh be alert',
            teacherId: '65900f85e771e0a80148edc6',
          },
        ],
      },

      {
        id: '65900f84e771e0a80148ed78',
        name: 'Prof. P. Biswal',
        section: [15, 21],
        subject: 'COA',
        likes: [
          '22053994@kiit.ac.in',
          '22051967@kiit.ac.in',
          '2205171@kiit.ac.in',
          '2205984@kiit.ac.in',
          '22051924@kiit.ac.in',
          '2205972@kiit.ac.in',
          '2205931@kiit.ac.in',
          '2205948@kiit.ac.in',
          '2205327@kiit.ac.in',
          '22053543@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22054173@kiit.ac.in',
          '22052975@kiit.ac.in',
          '22051812@kiit.ac.in',
        ],
        dislikes: ['22054181@kiit.ac.in'],
        reviews: [
          {
            id: '6590404945c2b626d34b3b17',
            rating: 5,
            commentedBy: '22053994@kiit.ac.in',
            internalScore: 29,
            comments: 'very good',
            teacherId: '65900f84e771e0a80148ed78',
          },
        ],
      },

      {
        id: '65900f84e771e0a80148ed79',
        name: 'Dr. Subarna  Bhattacharya',
        section: [15, 18],
        subject: 'STW',
        likes: [
          '2206191@kiit.ac.in',
          '2206202@kiit.ac.in',
          '2206156@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          '2206118@kiit.ac.in',
          '22052043@kiit.ac.in',
          '21053420@kiit.ac.in',
          '22053308@kiit.ac.in',
          '22052379@kiit.ac.in',
          '22054040@kiit.ac.in',
        ],
        reviews: [],
      },
      {
        id: '65900f85e771e0a80148edb4',
        name: 'Dr. Sudeshna Datta Chaudhuri',
        section: [16],
        subject: 'STW',
        likes: [
          '2105914@kiit.ac.in',
          '21052859@kiit.ac.in',
          '22052996@kiit.ac.in',
          '21052413@kiit.ac.in',
          '2105260@kiit.ac.in',
          '22052567@kiit.ac.in',
          '2205274@kiit.ac.in',
          '2229095@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          '22052379@kiit.ac.in',
          '2229121@kiit.ac.in',
          '22051815@kiit.ac.in',
          '22054186@kiit.ac.in',
          '22053675@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f85e771e0a80148edba',
        name: 'Prof. Ruby Mishra',
        section: [16],
        subject: 'COA',
        likes: [
          '22054293@kiit.ac.in',
          'dattarhituraj@gmail.com',
          '22053341@kiit.ac.in',
          '2205274@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22053321@kiit.ac.in',
        ],
        dislikes: ['2206118@kiit.ac.in', '22054186@kiit.ac.in'],
        reviews: [],
      },
      {
        id: '65900f85e771e0a80148edca',
        name: 'Dr. Sudipta Kumar Ghosh',
        section: [16, 28],
        subject: 'DSS',
        likes: [
          '22052860@kiit.ac.in',
          '22052843@kiit.ac.in',
          '2228167@kiit.ac.in',
          '2205138@kiit.ac.in',
          '2205274@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052832@kiit.ac.in',
          '22053233@kiit.ac.in',
          '2205333@kiit.ac.in',
        ],
        dislikes: [
          '2106110@kiit.ac.in',
          '21052413@kiit.ac.in',
          '2105672@kiit.ac.in',
          '21053420@kiit.ac.in',
          '2205842@kiit.ac.in',
          '2229194@kiit.ac.in',
          '22054186@kiit.ac.in',
          '22053675@kiit.ac.in',
        ],
        reviews: [
          {
            id: '6594477045c2b626d34b3b78',
            rating: 4,
            commentedBy: '22052832@kiit.ac.in',
            internalScore: 25,
            comments: 'badhiya understanding teacher hai',
            teacherId: '65900f85e771e0a80148edca',
          },
        ],
      },

      {
        id: '65900f84e771e0a80148ed75',
        name: 'Dr. Suman Sarkar',
        section: [17, 33, 43],
        subject: 'DSS',
        likes: [
          '21051287@kiit.ac.in',
          '22054144@kiit.ac.in',
          '2205973@kiit.ac.in',
          'adityatiwari211104@gmail.com',
          '22054148@kiit.ac.in',
          '2205629@kiit.ac.in',
          '22054181@kiit.ac.in',
          '22053807@kiit.ac.in',
          '2105347@kiit.ac.in',
          '21052149@kiit.ac.in',
          'nknitu2308@gmail.com',
          '22052388@kiit.ac.in',
          '2205412@kiit.ac.in',
          '22054139@kiit.ac.in',
          '2105260@kiit.ac.in',
          '22052245@kiit.ac.in',
          '22052777@kiit.ac.in',
          '2205131@kiit.ac.in',
          '22051369@kiit.ac.in',
          '2205434@kiit.ac.in',
          '22054115@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22054173@kiit.ac.in',
          '22052337@kiit.ac.in',
        ],
        dislikes: [
          'youhavebeenthunderstruck12@gmail.com',
          '22052887@kiit.ac.in',
          '22052409@kiit.ac.in',
          '22053455@kiit.ac.in',
          '2205984@kiit.ac.in',
        ],
        reviews: [
          {
            id: '659029e945c2b626d34b3af3',
            rating: 5,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments: 'gives excellent marks; teaches pretty well',
            teacherId: '65900f84e771e0a80148ed75',
          },
        ],
      },

      {
        id: '65900f84e771e0a80148ed9c',
        name: 'Dr. Arpita Goswami',
        section: [17],
        subject: 'STW',
        likes: [
          '21051729@kiit.ac.in',
          'debasmith2804@gmail.com',
          '21052981@kiit.ac.in',
          '21051716@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          'tejassoni1110@gmail.com',
          '2105553@kiit.ac.in',
          '21053469@kiit.ac.in',
          '21052859@kiit.ac.in',
          '21051849@kiit.ac.in',
          '21052809@kiit.ac.in',
          '21052868@kiit.ac.in',
          '21051715@kiit.ac.in',
          '21051756@kiit.ac.in',
          '2105986@kiit.ac.in',
          '2206375@kiit.ac.in',
          '2205238@kiit.ac.in',
          '21051710@kiit.ac.in',
          '2206212@kiit.ac.in',
          '2205984@kiit.ac.in',
          '2205134@kiit.ac.in',
          '22052245@kiit.ac.in',
          '22052137@kiit.ac.in',
          '22052337@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052256@kiit.ac.in',
        ],
        dislikes: [
          '21053471@kiit.ac.in',
          '22054008@kiit.ac.in',
          '2205301@kiit.ac.in',
          '22052287@kiit.ac.in',
          '2205165@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f84e771e0a80148ed82',
        name: 'Dr. Arijit Patra',
        section: [18, 27, 42],
        subject: 'DSS',
        likes: [
          '22052975@kiit.ac.in',
          '22053882@kiit.ac.in',
          'tejassoni1110@gmail.com',
          '21052723@kiit.ac.in',
          '21051554@kiit.ac.in',
          '21053469@kiit.ac.in',
          '22053903@kiit.ac.in',
          '22053984@kiit.ac.in',
          '22052252@kiit.ac.in',
          '22051829@kiit.ac.in',
          '22052076@kiit.ac.in',
          '22051874@kiit.ac.in',
          '22052256@kiit.ac.in',
          '22052895@kiit.ac.in',
          '22053119@kiit.ac.in',
          '22052042@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22051909@kiit.ac.in',
          '22053449@kiit.ac.in',
          '22053055@kiit.ac.in',
        ],
        dislikes: ['22052043@kiit.ac.in'],
        reviews: [
          {
            id: '65901bc545c2b626d34b3ac3',
            rating: 5,
            commentedBy: '22052975@kiit.ac.in',
            internalScore: 29,
            comments: 'Best',
            teacherId: '65900f84e771e0a80148ed82',
          },
          {
            id: '6596913f45c2b626d34b3c07',
            rating: 5,
            commentedBy: '22053055@kiit.ac.in',
            internalScore: 28,
            comments:
              "GOD\nHe's man of a kind, jus maintain a decent attendance , play ML in his class or doze off np...marks toh bhhar k denge likh k lelo",
            teacherId: '65900f84e771e0a80148ed82',
          },
        ],
      },

      {
        id: '65900f84e771e0a80148ed8e',
        name: 'Prof. Shruti',
        section: [18, 31],
        subject: 'COA',
        likes: [
          '2205973@kiit.ac.in',
          '21053471@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          '22052548@kiit.ac.in',
          '21052859@kiit.ac.in',
          '22051117@kiit.ac.in',
          'nknitu2308@gmail.com',
          '2105763@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22053889@kiit.ac.in',
        ],
        dislikes: [
          '2205595@kiit.ac.in',
          '21053329@kiit.ac.in',
          '22052029@kiit.ac.in',
          '2205976@kiit.ac.in',
          '21051041@kiit.ac.in',
          '22054148@kiit.ac.in',
          'architaaswain16@gmail.com',
          '2105457@kiit.ac.in',
          '2205629@kiit.ac.in',
          '22053807@kiit.ac.in',
          '21053326@kiit.ac.in',
          '21051756@kiit.ac.in',
          '2105566@kiit.ac.in',
          '21053384@kiit.ac.in',
          '21051710@kiit.ac.in',
          '22052966@kiit.ac.in',
          '22052363@kiit.ac.in',
          '2105750@kiit.ac.in',
          '22052777@kiit.ac.in',
          '22054202@kiit.ac.in',
          '22052043@kiit.ac.in',
          '2205596@kiit.ac.in',
          '22053180@kiit.ac.in',
          '2205434@kiit.ac.in',
          '22051749@kiit.ac.in',
          '22052221@kiit.ac.in',
          '2205508@kiit.ac.in',
          '2205569@kiit.ac.in',
          '22052245@kiit.ac.in',
          '22051943@kiit.ac.in',
          '22052383@kiit.ac.in',
        ],
        reviews: [
          {
            id: '65902c2e45c2b626d34b3b00',
            rating: 1,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 12,
            comments:
              'neither teaches, nor gives marks -- be it internal or sem exams; highest internal score from our sec was about 27-29/50',
            teacherId: '65900f84e771e0a80148ed8e',
          },
          {
            id: '6593fc3845c2b626d34b3b71',
            rating: 1,
            commentedBy: '22052221@kiit.ac.in',
            internalScore: 32,
            comments: ' ',
            teacherId: '65900f84e771e0a80148ed8e',
          },
        ],
      },

      {
        id: '65900f82e771e0a80148ed3b',
        name: 'Prof. J. R. Panda',
        section: [19, 34],
        subject: 'STW',
        likes: [
          '2205251@kiit.ac.in',
          '22053029@kiit.ac.in',
          '22052042@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22054347@kiit.ac.in',
        ],
        dislikes: ['2206118@kiit.ac.in', '22051723@kiit.ac.in'],
        reviews: [],
      },

      {
        id: '65900f83e771e0a80148ed57',
        name: 'Mr. Anil Kumar Swain',
        section: [19, 34],
        subject: 'COA',
        likes: [
          '2106302@kiit.ac.in',
          '2105627@kiit.ac.in',
          'sakshimohan76@gmail.com',
          '2205251@kiit.ac.in',
          '2106290@kiit.ac.in',
          '21051287@kiit.ac.in',
          '2106283@kiit.ac.in',
          'imamansinha69@gmail.com',
          '21052981@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          '21051346@kiit.ac.in',
          '21051040@kiit.ac.in',
          '21051347@kiit.ac.in',
          '21051376@kiit.ac.in',
          '21051327@kiit.ac.in',
          '21052095@kiit.ac.in',
          '2105050@kiit.ac.in',
          '21052432@kiit.ac.in',
          '22053465@kiit.ac.in',
          '2105311@kiit.ac.in',
          '21051756@kiit.ac.in',
          '2105762@kiit.ac.in',
          '22053256@kiit.ac.in',
          '2205175@kiit.ac.in',
          '2105260@kiit.ac.in',
          '2106089@kiit.ac.in',
          '2205596@kiit.ac.in',
          '2205600@kiit.ac.in',
          '2205533@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          'khushisonalisinha0710@gmail.com',
          '22052895@kiit.ac.in',
          '2206118@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f85e771e0a80148edbf',
        name: 'Dr. Vishal Pradhan',
        section: [19, 34],
        subject: 'DSS',
        likes: [
          '2205594@kiit.ac.in',
          '22052051@kiit.ac.in',
          '22052029@kiit.ac.in',
          '22052015@kiit.ac.in',
          '21053469@kiit.ac.in',
          '22052643@kiit.ac.in',
          'neolicious08@gmail.com',
          'snehakashyap020704@gmail.com',
          '22052076@kiit.ac.in',
          '22052966@kiit.ac.in',
          '2205592@kiit.ac.in',
          '22052887@kiit.ac.in',
          '2206053@kiit.ac.in',
          '2206050@kiit.ac.in',
          '2205596@kiit.ac.in',
          '2205585@kiit.ac.in',
          '2206061@kiit.ac.in',
          '22052042@kiit.ac.in',
          '22052094@kiit.ac.in',
          '2205521@kiit.ac.in',
          '2205600@kiit.ac.in',
          '2205634@kiit.ac.in',
          '2205533@kiit.ac.in',
          '22053872@kiit.ac.in',
          '2205569@kiit.ac.in',
        ],
        dislikes: ['22053293@kiit.ac.in'],
        reviews: [
          {
            id: '6590348045c2b626d34b3b0b',
            rating: 4,
            commentedBy: '22052643@kiit.ac.in',
            internalScore: 27,
            comments: 'Great teaching style.\n',
            teacherId: '65900f85e771e0a80148edbf',
          },
          {
            id: '65930cff45c2b626d34b3b62',
            rating: 5,
            commentedBy: '22052042@kiit.ac.in',
            internalScore: 30,
            comments: 'bestttttttt',
            teacherId: '65900f85e771e0a80148edbf',
          },
        ],
      },

      {
        id: '65900f84e771e0a80148ed6f',
        name: 'Dr. Debdulal Ghosh',
        section: [20, 41],
        subject: 'DSS',
        likes: [
          'imamansinha69@gmail.com',
          '21051040@kiit.ac.in',
          '22051615@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22053137@kiit.ac.in',
          '22054347@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: ['2228055@kiit.ac.in', '2205984@kiit.ac.in'],
        reviews: [],
      },

      {
        id: '65900f85e771e0a80148edb2',
        name: 'Prof. Sunil Kr. Mishra',
        section: [20, 36],
        subject: 'STW',
        likes: [
          '22052760@kiit.ac.in',
          '21052868@kiit.ac.in',
          '22054200@kiit.ac.in',
          '2105566@kiit.ac.in',
          '2205533@kiit.ac.in',
          '22052317@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052956@kiit.ac.in',
        ],
        dislikes: [
          'snehakashyap020704@gmail.com',
          '2205238@kiit.ac.in',
          '2205596@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f85e771e0a80148edc0',
        name: 'Prof. Swati Swayamsiddha',
        section: [20, 43],
        subject: 'COA',
        likes: [
          '2106110@kiit.ac.in',
          '22051326@kiit.ac.in',
          '21051173@kiit.ac.in',
          '21051592@kiit.ac.in',
          '22051322@kiit.ac.in',
          '22053377@kiit.ac.in',
          '2205134@kiit.ac.in',
          '22052172@kiit.ac.in',
          '22052116@kiit.ac.in',
          '23057053@kiit.ac.in',
          '22054186@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22053043@kiit.ac.in',
          '22053080@kiit.ac.in',
        ],
        dislikes: ['22051700@kiit.ac.in'],
        reviews: [],
      },

      {
        id: '65900f83e771e0a80148ed4f',
        name: 'Dr. Srikanta Behera',
        section: [21, 40],
        subject: 'DSS',
        likes: [
          '2205374@kiit.ac.in',
          '2205810@kiit.ac.in',
          '22054085@kiit.ac.in',
          '22052806@kiit.ac.in',
          '2205513@kiit.ac.in',
          '2205231@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052975@kiit.ac.in',
          '2205984@kiit.ac.in',
        ],
        dislikes: ['22053611@kiit.ac.in'],
        reviews: [],
      },

      {
        id: '65900f83e771e0a80148ed64',
        name: 'Mr. Pragma Kar',
        section: [21],
        subject: 'OPPJ(L)',
        likes: [
          '2105289@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052975@kiit.ac.in',
        ],
        dislikes: ['22053056@kiit.ac.in', '2206118@kiit.ac.in'],
        reviews: [],
      },

      {
        id: '65900f85e771e0a80148eda3',
        name: 'Ms. Mamita Dash',
        section: [21, 49, 51],
        subject: 'STW',
        likes: [
          '21052981@kiit.ac.in',
          '2105743@kiit.ac.in',
          '2105914@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          '21051171@kiit.ac.in',
          '2105228@kiit.ac.in',
          '2205629@kiit.ac.in',
          '21053326@kiit.ac.in',
          '21052036@kiit.ac.in',
          '21051974@kiit.ac.in',
          '22051037@kiit.ac.in',
          '21053380@kiit.ac.in',
          '2205238@kiit.ac.in',
          '2229193@kiit.ac.in',
          '22054341@kiit.ac.in',
          '22052777@kiit.ac.in',
          '22051031@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052975@kiit.ac.in',
          '22052956@kiit.ac.in',
        ],
        dislikes: [
          'imamansinha69@gmail.com',
          '2205973@kiit.ac.in',
          '22051925@kiit.ac.in',
          '21051554@kiit.ac.in',
          '22052317@kiit.ac.in',
          '22051204@kiit.ac.in',
        ],
        reviews: [
          {
            id: '65902c6645c2b626d34b3b01',
            rating: 4,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments: 'good teacher',
            teacherId: '65900f85e771e0a80148eda3',
          },
          {
            id: '6590479745c2b626d34b3b1d',
            rating: 5,
            commentedBy: '21051974@kiit.ac.in',
            internalScore: 28,
            comments:
              'strict but provide very good notes. Good teacher . Provide deserving marks ',
            teacherId: '65900f85e771e0a80148eda3',
          },
          {
            id: '6590741745c2b626d34b3b2d',
            rating: 5,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 30,
            comments: 'Very good teacher',
            teacherId: '65900f85e771e0a80148eda3',
          },
          {
            id: '6592dd6145c2b626d34b3b58',
            rating: 1,
            commentedBy: '22052317@kiit.ac.in',
            internalScore: 22,
            comments: 'Pura PPT class mai likhwati hai ',
            teacherId: '65900f85e771e0a80148eda3',
          },
        ],
      },
      {
        id: '65900f85e771e0a80148eda6',
        name: 'Dr. Kartikeswar Mahalik',
        section: [22, 39],
        subject: 'DSS',
        likes: [
          '2205251@kiit.ac.in',
          '22054038@kiit.ac.in',
          '22054463@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          '22053614@kiit.ac.in',
          '22054185@kiit.ac.in',
          '2205206@kiit.ac.in',
          '2205489@kiit.ac.in',
          '2205485@kiit.ac.in',
          '2205185@kiit.ac.in',
          '2205191@kiit.ac.in',
          '2205219@kiit.ac.in',
          '2205208@kiit.ac.in',
          '2206019@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f86e771e0a80148edd6',
        name: 'Prof. S. K. Mohapatra',
        section: [22],
        subject: 'STW',
        likes: [
          '2105743@kiit.ac.in',
          '2205251@kiit.ac.in',
          '22052879@kiit.ac.in',
          '22053295@kiit.ac.in',
          '22051204@kiit.ac.in',
          '22054463@kiit.ac.in',
          '22053114@kiit.ac.in',
        ],
        dislikes: [
          '22053614@kiit.ac.in',
          '2205206@kiit.ac.in',
          '2205489@kiit.ac.in',
          '2205485@kiit.ac.in',
          '2205185@kiit.ac.in',
          '2205191@kiit.ac.in',
          '2205219@kiit.ac.in',
          '2205208@kiit.ac.in',
          '22052121@kiit.ac.in',
          '22052768@kiit.ac.in',
          '2206019@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052107@kiit.ac.in',
        ],
        reviews: [
          {
            id: '6593a89145c2b626d34b3b69',
            rating: 1,
            commentedBy: '22052768@kiit.ac.in',
            internalScore: 22,
            comments: "Doesn't teach anything, bad marksin midsem also",
            teacherId: '65900f86e771e0a80148edd6',
          },
        ],
      },

      {
        id: '65900f82e771e0a80148ed3a',
        name: 'Dr. Ananda Meher',
        section: [23, 47, 50, 54, 55],
        subject: 'STW',
        likes: [
          '2205251@kiit.ac.in',
          '22052620@kiit.ac.in',
          '22053923@kiit.ac.in',
          '22053608@kiit.ac.in',
          '22053498@kiit.ac.in',
          '22054043@kiit.ac.in',
          '22052444@kiit.ac.in',
          '22052653@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052608@kiit.ac.in',
          '22053926@kiit.ac.in',
          '23057052@kiit.ac.in',
        ],
        dislikes: [
          '22053938@kiit.ac.in',
          '22052774@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22053455@kiit.ac.in',
          '22051723@kiit.ac.in',
          '22052337@kiit.ac.in',
        ],
        reviews: [
          {
            id: '65923f6a45c2b626d34b3b53',
            rating: 5,
            commentedBy: '22052653@kiit.ac.in',
            internalScore: 30,
            comments: '\n\n',
            teacherId: '65900f82e771e0a80148ed3a',
          },
        ],
      },

      {
        id: '65900f84e771e0a80148ed6b',
        name: 'Prof. Ganaraj P. S.',
        section: [23, 42],
        subject: 'COA',
        likes: [
          '21051801@kiit.ac.in',
          '22051925@kiit.ac.in',
          '2105393@kiit.ac.in',
          '2205361@kiit.ac.in',
          'abantigsh@gmail.com',
          '22051204@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052608@kiit.ac.in',
        ],
        dislikes: [
          '21052500@kiit.ac.in',
          'nirbhaykakani6@gmail.com',
          'aanchalpandey783@gmail.com',
          'imamansinha69@gmail.com',
          '22051531@kiit.ac.in',
          '21051716@kiit.ac.in',
          '22054111@kiit.ac.in',
          '21051929@kiit.ac.in',
          '21051461@kiit.ac.in',
          '21051347@kiit.ac.in',
          '22052620@kiit.ac.in',
          'brutalbrothers05@gmail.com',
          '21053326@kiit.ac.in',
          '22053568@kiit.ac.in',
          '22051755@kiit.ac.in',
          '2205134@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22053860@kiit.ac.in',
          '22053455@kiit.ac.in',
          '22052467@kiit.ac.in',
          '22054066@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f84e771e0a80148ed76',
        name: 'Dr. Bapuji Sahoo',
        section: [23, 38],
        subject: 'DSS',
        likes: [
          '22051077@kiit.ac.in',
          '2205954@kiit.ac.in',
          '22053764@kiit.ac.in',
          '2206191@kiit.ac.in',
          '2206281@kiit.ac.in',
          'neolicious08@gmail.com',
          '2205046@kiit.ac.in',
          '22053992@kiit.ac.in',
          '23057064@kiit.ac.in',
          '22051532@kiit.ac.in',
          '2206156@kiit.ac.in',
          '22052094@kiit.ac.in',
          '22051063@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052093@kiit.ac.in',
          '2205508@kiit.ac.in',
          '22052608@kiit.ac.in',
          '23051340@kiit.ac.in',
        ],
        dislikes: [
          '2206118@kiit.ac.in',
          '2205206@kiit.ac.in',
          '2205489@kiit.ac.in',
          '2205191@kiit.ac.in',
          '2205497@kiit.ac.in',
          '2205485@kiit.ac.in',
          '2205757@kiit.ac.in',
          '2205185@kiit.ac.in',
          '2205219@kiit.ac.in',
          '2205208@kiit.ac.in',
          '2205512@kiit.ac.in',
          '22053614@kiit.ac.in',
          '2205138@kiit.ac.in',
          '22052200@kiit.ac.in',
          '22051860@kiit.ac.in',
          '22052121@kiit.ac.in',
          '22053455@kiit.ac.in',
          '2205569@kiit.ac.in',
        ],
        reviews: [
          {
            id: '65901b0f45c2b626d34b3abf',
            rating: 5,
            commentedBy: '22051077@kiit.ac.in',
            internalScore: 30,
            comments:
              "Major positive points are\nIsn't strict in terms of attendance\nTeaches well\nGives good internals to almost everyone ",
            teacherId: '65900f84e771e0a80148ed76',
          },
          {
            id: '65901df945c2b626d34b3ad1',
            rating: 5,
            commentedBy: '2205954@kiit.ac.in',
            internalScore: 30,
            comments:
              'Best teacher full marks in internals and no issue with attendence everyone got 95%',
            teacherId: '65900f84e771e0a80148ed76',
          },
          {
            id: '659076fd45c2b626d34b3b2f',
            rating: 5,
            commentedBy: '2205046@kiit.ac.in',
            internalScore: 29,
            comments:
              'attendance ko leke koi tension nhi hai, marks bhi bohot achhe dete hain, agar thoda bhi aayega toh achha mil jayega',
            teacherId: '65900f84e771e0a80148ed76',
          },
        ],
      },

      {
        id: '65900f84e771e0a80148ed72',
        name: 'Dr. Abhijit Sutradhar',
        section: [24, 37],
        subject: 'DSS',
        likes: [
          '22053090@kiit.ac.in',
          '2205251@kiit.ac.in',
          '2205206@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22051032@kiit.ac.in',
        ],
        dislikes: ['2206118@kiit.ac.in', '22052337@kiit.ac.in'],
        reviews: [],
      },

      {
        id: '65900f84e771e0a80148ed73',
        name: 'Mr. Rohit Kumar Tiwari',
        section: [38],
        subject: 'OS,OS(L)',
        likes: [
          '2106110@kiit.ac.in',
          '2206172@kiit.ac.in',
          'khushisonalisinha0710@gmail.com',
          '21052168@kiit.ac.in',
          '2105743@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          '21053469@kiit.ac.in',
          'architaaswain16@gmail.com',
          '21052432@kiit.ac.in',
          '2105541@kiit.ac.in',
          '2106268@kiit.ac.in',
          '2105566@kiit.ac.in',
          '22051448@kiit.ac.in',
          '22051700@kiit.ac.in',
          '2206212@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          '2205206@kiit.ac.in',
          '2205489@kiit.ac.in',
          '2205497@kiit.ac.in',
          '2205485@kiit.ac.in',
          '2205757@kiit.ac.in',
          '2205185@kiit.ac.in',
          '2205219@kiit.ac.in',
          '2205208@kiit.ac.in',
          '2205512@kiit.ac.in',
          '2205138@kiit.ac.in',
          '22052200@kiit.ac.in',
          '2205191@kiit.ac.in',
          '22053614@kiit.ac.in',
          '22051860@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f86e771e0a80148ede2',
        name: 'Prof. Satish Kumar Gannamaneni',
        section: [24, 38],
        subject: 'STW',
        likes: [
          '2206172@kiit.ac.in',
          '22053090@kiit.ac.in',
          '2205251@kiit.ac.in',
          '2206375@kiit.ac.in',
          '2206065@kiit.ac.in',
          '22053373@kiit.ac.in',
          '2205757@kiit.ac.in',
          '22053295@kiit.ac.in',
          '2206338@kiit.ac.in',
          '22053872@kiit.ac.in',
          '2206290@kiit.ac.in',
        ],
        dislikes: [
          '22053185@kiit.ac.in',
          'shaswat.sherpur@gmail.com',
          '22054347@kiit.ac.in',
          '2205954@kiit.ac.in',
          '2206293@kiit.ac.in',
          '2205206@kiit.ac.in',
          '2205489@kiit.ac.in',
          '2205191@kiit.ac.in',
          '2205497@kiit.ac.in',
          '2205485@kiit.ac.in',
          '2205185@kiit.ac.in',
          '2205219@kiit.ac.in',
          '2205208@kiit.ac.in',
          '2205512@kiit.ac.in',
          '22052337@kiit.ac.in',
          '22052200@kiit.ac.in',
          '2206019@kiit.ac.in',
          '22052093@kiit.ac.in',
          '22051860@kiit.ac.in',
          '2205306@kiit.ac.in',
        ],
        reviews: [
          {
            id: '6593a8bf45c2b626d34b3b6a',
            rating: 5,
            commentedBy: '2206338@kiit.ac.in',
            internalScore: 27,
            comments:
              'idk why so many dislikes...but marks acha deta hai...expectation se zyada. Han bas thoda strict hai aur paka ta bhi hai.\n',
            teacherId: '65900f86e771e0a80148ede2',
          },
          {
            id: '6594822645c2b626d34b3b7c',
            rating: 4,
            commentedBy: '2206290@kiit.ac.in',
            internalScore: 27,
            comments:
              'Isko class lo Mt lo frk nhi padhta .. bs end mai exam Dene jitni attendance ho .. internal Chadha deta hai sahi aur checking bhi acchi krta hai. Overall theek hai class etiquettes ke bare mai bohot lecture deta hai',
            teacherId: '65900f86e771e0a80148ede2',
          },
        ],
      },

      {
        id: '65900f82e771e0a80148ed37',
        name: 'Prof. Kumar Biswal',
        section: [25, 47],
        subject: 'COA',
        likes: [
          '21051939@kiit.ac.in',
          '2205251@kiit.ac.in',
          '22053764@kiit.ac.in',
          'abantigsh@gmail.com',
          '22051829@kiit.ac.in',
          '22051320@kiit.ac.in',
          '22053498@kiit.ac.in',
          '22051967@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22051700@kiit.ac.in',
        ],
        dislikes: [
          '22053185@kiit.ac.in',
          '22052608@kiit.ac.in',
          '2004295@kiit.ac.in',
          '21052759@kiit.ac.in',
          '21053405@kiit.ac.in',
          '22052628@kiit.ac.in',
          '22052388@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22053232@kiit.ac.in',
          '22051931@kiit.ac.in',
          '22053455@kiit.ac.in',
          '22051723@kiit.ac.in',
          '22052337@kiit.ac.in',
          '21052608@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f82e771e0a80148ed40',
        name: 'Dr. Habibul Islam',
        section: [25, 36],
        subject: 'DSS',
        likes: [
          'shivammishra.2522@gmail.com',
          'tpiyush2626@gmail.com',
          '22053039@kiit.ac.in',
          '2105715@kiit.ac.in',
          '21051772@kiit.ac.in',
          '22053807@kiit.ac.in',
          'neolicious08@gmail.com',
          '2230127@kiit.ac.in',
          '22054181@kiit.ac.in',
          '22051205@kiit.ac.in',
          '2206375@kiit.ac.in',
          '2206275@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          'imamansinha69@gmail.com',
          '22051700@kiit.ac.in',
          '2205854@kiit.ac.in',
          '22051723@kiit.ac.in',
          '22052842@kiit.ac.in',
        ],
        reviews: [
          {
            id: '65901b3045c2b626d34b3ac1',
            rating: 5,
            commentedBy: 'tpiyush2626@gmail.com',
            internalScore: 30,
            comments: 'excellent',
            teacherId: '65900f82e771e0a80148ed40',
          },
          {
            id: '6590201b45c2b626d34b3ad7',
            rating: 4,
            commentedBy: '2206130@kiit.ac.in',
            internalScore: 30,
            comments: 'Highly recommended ',
            teacherId: '65900f82e771e0a80148ed40',
          },
        ],
      },

      {
        id: '65900f85e771e0a80148edce',
        name: 'Dr. Sarbeswar Mohanty',
        section: [25, 27, 52, 53],
        subject: 'STW',
        likes: [
          '21052156@kiit.ac.in',
          'imamansinha69@gmail.com',
          '21051287@kiit.ac.in',
          '2105366@kiit.ac.in',
          '21051232@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          '21051390@kiit.ac.in',
          'piyushverma2k17@gmail.com',
          '2105347@kiit.ac.in',
          'snehakashyap020704@gmail.com',
          '2105974@kiit.ac.in',
          '21052149@kiit.ac.in',
          'nknitu2308@gmail.com',
          '22054200@kiit.ac.in',
          '2105566@kiit.ac.in',
          '21052415@kiit.ac.in',
          '21051710@kiit.ac.in',
          '22051818@kiit.ac.in',
          '21052413@kiit.ac.in',
          '2205972@kiit.ac.in',
          '22053240@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22051757@kiit.ac.in',
          '22051943@kiit.ac.in',
          '22053903@kiit.ac.in',
        ],
        dislikes: ['22051347@kiit.ac.in', '2205684@kiit.ac.in'],
        reviews: [],
      },
      {
        id: '65900f85e771e0a80148edd0',
        name: 'Prof. Rachita Panda',
        section: [26],
        subject: 'STW',
        likes: [
          '22054347@kiit.ac.in',
          '2206375@kiit.ac.in',
          '22052094@kiit.ac.in',
          '2205600@kiit.ac.in',
          '22054304@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [],
        reviews: [],
      },
      {
        id: '65900f86e771e0a80148edd5',
        name: 'Dr. Amalesh Kumar Manna',
        section: [26, 35],
        subject: 'DSS',
        likes: [
          '22051700@kiit.ac.in',
          '2205169@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052189@kiit.ac.in',
          '22053029@kiit.ac.in',
        ],
        dislikes: [
          '22053868@kiit.ac.in',
          '22053455@kiit.ac.in',
          '22053909@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f83e771e0a80148ed4a',
        name: 'Prof. Sushree S. Panda',
        section: [28],
        subject: 'STW',
        likes: [
          'shivammishra.2522@gmail.com',
          '2205931@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          '2205107@kiit.ac.in',
          'khushisonalisinha0710@gmail.com',
          '2205948@kiit.ac.in',
          '22051826@kiit.ac.in',
          '2205984@kiit.ac.in',
          '22051924@kiit.ac.in',
          '2205327@kiit.ac.in',
          '22051723@kiit.ac.in',
        ],
        reviews: [],
      },
      {
        id: '65900f84e771e0a80148ed87',
        name: 'Dr. Kumar Surjeet Chaudhury',
        section: [28, 44],
        subject: 'OS,OS(L)',
        likes: [
          '21052457@kiit.ac.in',
          '2105553@kiit.ac.in',
          '21051376@kiit.ac.in',
          '21052036@kiit.ac.in',
          '21051715@kiit.ac.in',
          'nknitu2308@gmail.com',
          '21052415@kiit.ac.in',
          '21051301@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22051849@kiit.ac.in',
        ],
        dislikes: [
          'ashwinikapoor16@gmail.com',
          '21052095@kiit.ac.in',
          '22051829@kiit.ac.in',
          '22052397@kiit.ac.in',
          '22052417@kiit.ac.in',
          '22052844@kiit.ac.in',
          '2205984@kiit.ac.in',
          '2105890@kiit.ac.in',
        ],
        reviews: [],
      },
      {
        id: '65900f82e771e0a80148ed34',
        name: 'Dr. Seba Mohanty',
        section: [29, 31, 33, 35, 37],
        subject: 'STW',
        likes: [
          '22051843@kiit.ac.in',
          '22052933@kiit.ac.in',
          '2205973@kiit.ac.in',
          '22052948@kiit.ac.in',
          'donkeyking1856@gmail.com',
          '22052628@kiit.ac.in',
          '22054148@kiit.ac.in',
          '21052759@kiit.ac.in',
          '2205629@kiit.ac.in',
          '21051772@kiit.ac.in',
          '22053807@kiit.ac.in',
          '22051826@kiit.ac.in',
          '22051458@kiit.ac.in',
          '2105388@kiit.ac.in',
          '22052245@kiit.ac.in',
          '22052608@kiit.ac.in',
          '2205432@kiit.ac.in',
          '22052317@kiit.ac.in',
          '2205169@kiit.ac.in',
          '2205044@kiit.ac.in',
          '22052768@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052189@kiit.ac.in',
          '2205172@kiit.ac.in',
          '22053408@kiit.ac.in',
          '22053029@kiit.ac.in',
          '21053420@kiit.ac.in',
        ],
        dislikes: [
          'youhavebeenthunderstruck12@gmail.com',
          '22052620@kiit.ac.in',
          '22053810@kiit.ac.in',
          '22052887@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22052345@kiit.ac.in',
          '22053868@kiit.ac.in',
          '22053455@kiit.ac.in',
          '22053909@kiit.ac.in',
          '22053883@kiit.ac.in',
          '22051723@kiit.ac.in',
          '2205984@kiit.ac.in',
          '22052337@kiit.ac.in',
          '2205763@kiit.ac.in',
          '21052608@kiit.ac.in',
        ],
        reviews: [
          {
            id: '65901bf445c2b626d34b3ac4',
            rating: 4,
            commentedBy: '22051843@kiit.ac.in',
            internalScore: 27,
            comments:
              'Internals me sbko 27 k uper di thi. Marks acha hi deti hai.',
            teacherId: '65900f82e771e0a80148ed34',
          },
          {
            id: '6590207545c2b626d34b3adb',
            rating: 5,
            commentedBy: '22053488@kiit.ac.in',
            internalScore: 28,
            comments: 'Good ',
            teacherId: '65900f82e771e0a80148ed34',
          },
          {
            id: '6590289f45c2b626d34b3af0',
            rating: 5,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments:
              "She's pretty lenient and friendly; marks graciously in both internals as well as mid and end sem exams",
            teacherId: '65900f82e771e0a80148ed34',
          },
          {
            id: '6593a5e645c2b626d34b3b67',
            rating: 5,
            commentedBy: '22052768@kiit.ac.in',
            internalScore: 30,
            comments: 'Gives good marks, also is lenient with attendance',
            teacherId: '65900f82e771e0a80148ed34',
          },
        ],
      },
      {
        id: '65900f85e771e0a80148edcd',
        name: 'Dr. Utkal Keshari Dutta',
        section: [15, 29],
        subject: 'DSS',
        likes: [
          '2228122@kiit.ac.in',
          '2228055@kiit.ac.in',
          '2105316@kiit.ac.in',
          '21053469@kiit.ac.in',
          '2228176@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          '2228041@kiit.ac.in',
          '21051849@kiit.ac.in',
          '2228128@kiit.ac.in',
          '2228050@kiit.ac.in',
          '2228006@kiit.ac.in',
          '2105311@kiit.ac.in',
          '22053568@kiit.ac.in',
          '2105762@kiit.ac.in',
          '2228068@kiit.ac.in',
          '22051774@kiit.ac.in',
          '22053256@kiit.ac.in',
          '2205238@kiit.ac.in',
          '2228080@kiit.ac.in',
          '22054038@kiit.ac.in',
          '22054263@kiit.ac.in',
          '22053992@kiit.ac.in',
          '22051031@kiit.ac.in',
          '2105260@kiit.ac.in',
          '22051815@kiit.ac.in',
          '22054341@kiit.ac.in',
          '22054090@kiit.ac.in',
          '2205364@kiit.ac.in',
          '22052317@kiit.ac.in',
          '22053642@kiit.ac.in',
          '22051204@kiit.ac.in',
          '22053560@kiit.ac.in',
          '22053872@kiit.ac.in',
          '2205420@kiit.ac.in',
          '22051807@kiit.ac.in',
          '22054253@kiit.ac.in',
          '22052956@kiit.ac.in',
          '2205267@kiit.ac.in',
        ],
        dislikes: ['22053455@kiit.ac.in'],
        reviews: [
          {
            id: '659027e045c2b626d34b3aed',
            rating: 5,
            commentedBy: '21053469@kiit.ac.in',
            internalScore: 29,
            comments: 'Best Teacher, for marks as well as in Teaching. ',
            teacherId: '65900f85e771e0a80148edcd',
          },
          {
            id: '6592ddba45c2b626d34b3b59',
            rating: 5,
            commentedBy: '22052317@kiit.ac.in',
            internalScore: 28,
            comments: 'Marks milta hai bohot\n',
            teacherId: '65900f85e771e0a80148edcd',
          },
          {
            id: '6594103445c2b626d34b3b73',
            rating: 5,
            commentedBy: '22051815@kiit.ac.in',
            internalScore: 30,
            comments:
              'Best Maths Teacher in KIIT!! Very much Student Friendly. Gives good marks in internals to everyone. ',
            teacherId: '65900f85e771e0a80148edcd',
          },
        ],
      },

      {
        id: '65900f83e771e0a80148ed52',
        name: 'Prof. Nazia T. Imran',
        section: [30],
        subject: 'STW',
        likes: ['22053872@kiit.ac.in'],
        dislikes: ['22054304@kiit.ac.in'],
        reviews: [],
      },
      {
        id: '65900f85e771e0a80148eda9',
        name: 'Prof. P. Dutta',
        section: [35],
        subject: 'COA',
        likes: [
          '22052948@kiit.ac.in',
          '2206118@kiit.ac.in',
          '2206275@kiit.ac.in',
          '2205169@kiit.ac.in',
          '22053163@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22052616@kiit.ac.in',
          '22053029@kiit.ac.in',
        ],
        dislikes: [],
        reviews: [
          {
            id: '6592e44845c2b626d34b3b5a',
            rating: 4,
            commentedBy: '2206348@kiit.ac.in',
            internalScore: 28,
            comments:
              'Gave marks even to students who barely submitted assignments',
            teacherId: '65900f85e771e0a80148eda9',
          },
        ],
      },

      {
        id: '65900f83e771e0a80148ed65',
        name: 'Dr. Asif Uddin Khan',
        section: [38, 50],
        subject: 'COA',
        likes: [
          '2206172@kiit.ac.in',
          '2105627@kiit.ac.in',
          '2105914@kiit.ac.in',
          '2206191@kiit.ac.in',
          '2206246@kiit.ac.in',
          '22051829@kiit.ac.in',
          '2105260@kiit.ac.in',
          '2206080@kiit.ac.in',
          '2206053@kiit.ac.in',
          '22052347@kiit.ac.in',
          '22052620@kiit.ac.in',
          '2206379@kiit.ac.in',
          '22052013@kiit.ac.in',
          '2205813@kiit.ac.in',
          '22053872@kiit.ac.in',
          '2205508@kiit.ac.in',
          '2206005@kiit.ac.in',
        ],
        dislikes: [
          '22054339@kiit.ac.in',
          '22054347@kiit.ac.in',
          '2205954@kiit.ac.in',
          '22054341@kiit.ac.in',
          '22052527@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22051700@kiit.ac.in',
          '2205191@kiit.ac.in',
          '2205206@kiit.ac.in',
          '2205489@kiit.ac.in',
          '2205497@kiit.ac.in',
          '2205485@kiit.ac.in',
          '2205757@kiit.ac.in',
          '2205185@kiit.ac.in',
          '2205219@kiit.ac.in',
          '2205208@kiit.ac.in',
          '2205512@kiit.ac.in',
          '2205138@kiit.ac.in',
          '22052200@kiit.ac.in',
          '2206019@kiit.ac.in',
          '22053543@kiit.ac.in',
          '22051860@kiit.ac.in',
          '22052525@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f84e771e0a80148ed6a',
        name: 'Prof. A. Bakshi',
        section: [39, 44],
        subject: 'COA',
        likes: [
          '21051801@kiit.ac.in',
          '2105672@kiit.ac.in',
          '2128044@kiit.ac.in',
          '2105974@kiit.ac.in',
          '2105566@kiit.ac.in',
          '21051909@kiit.ac.in',
          '2205414@kiit.ac.in',
          '22052650@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22054173@kiit.ac.in',
        ],
        dislikes: [
          'imamansinha69@gmail.com',
          '22054144@kiit.ac.in',
          '21051554@kiit.ac.in',
          '22051745@kiit.ac.in',
          '22051829@kiit.ac.in',
          '2128034@kiit.ac.in',
          '22054090@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22052610@kiit.ac.in',
          '21051301@kiit.ac.in',
          '22053610@kiit.ac.in',
          '22052397@kiit.ac.in',
          '22052417@kiit.ac.in',
          '22052844@kiit.ac.in',
          '2205984@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f85e771e0a80148eda7',
        name: 'Dr. Satya Champati Rai',
        section: [39],
        subject: 'OS,OS(L)',
        likes: [
          '2228055@kiit.ac.in',
          '2228176@kiit.ac.in',
          '2105079@kiit.ac.in',
          'khaitanharsh08@gmail.com',
          '21051554@kiit.ac.in',
          '21053469@kiit.ac.in',
          '21053405@kiit.ac.in',
          '21052809@kiit.ac.in',
          'abantigsh@gmail.com',
          '2228156@kiit.ac.in',
          '2228080@kiit.ac.in',
          '2228009@kiit.ac.in',
          '22051204@kiit.ac.in',
          '22053872@kiit.ac.in',
        ],
        dislikes: [
          '2228122@kiit.ac.in',
          '21052859@kiit.ac.in',
          '2228050@kiit.ac.in',
        ],
        reviews: [
          {
            id: '659021a345c2b626d34b3adc',
            rating: 4,
            commentedBy: 'khaitanharsh08@gmail.com',
            internalScore: 23,
            comments:
              'Give internals based on knowledge. I will highly recommend this teacher because teacher is very nice. Even if you get low internals, you will learn something for sure. Very sweet teacher. No partiality.',
            teacherId: '65900f85e771e0a80148eda7',
          },
        ],
      },
      {
        id: '65900f86e771e0a80148eddb',
        name: 'Dr. Suvendu Barik',
        section: [39, 41, 43, 45, 48],
        subject: 'STW',
        likes: [
          '22053180@kiit.ac.in',
          '21052723@kiit.ac.in',
          '2205892@kiit.ac.in',
          '21053471@kiit.ac.in',
          'ashwinikapoor16@gmail.com',
          '2205570@kiit.ac.in',
          'abhiksamanta004@gmail.com',
          '22051615@kiit.ac.in',
          '2228128@kiit.ac.in',
          '22052643@kiit.ac.in',
          'piyushverma2k17@gmail.com',
          '22053465@kiit.ac.in',
          'linexshreyas@gmail.com',
          'nknitu2308@gmail.com',
          '21051909@kiit.ac.in',
          '2105763@kiit.ac.in',
          '22053998@kiit.ac.in',
          '22054206@kiit.ac.in',
          '22053872@kiit.ac.in',
          '22051880@kiit.ac.in',
          '22052755@kiit.ac.in',
        ],
        dislikes: [
          '21051554@kiit.ac.in',
          'shaswat.sherpur@gmail.com',
          '22052914@kiit.ac.in',
          '22053234@kiit.ac.in',
          'prabhakars367@gmail.com',
          'singhprabhakarkumar07@gmail.com',
          '21051710@kiit.ac.in',
          '22051829@kiit.ac.in',
          '22052895@kiit.ac.in',
          '22053250@kiit.ac.in',
          '22053455@kiit.ac.in',
          '2205984@kiit.ac.in',
        ],
        reviews: [
          {
            id: '6590205445c2b626d34b3ada',
            rating: 3,
            commentedBy: '22053180@kiit.ac.in',
            internalScore: 30,
            comments:
              'Awesome chill teacher.\nGreenest flag ever\nU can trust him blindly ',
            teacherId: '65900f86e771e0a80148eddb',
          },
          {
            id: '6590433345c2b626d34b3b1a',
            rating: 5,
            commentedBy: '22053465@kiit.ac.in',
            internalScore: 30,
            comments: 'Best teacher ever',
            teacherId: '65900f86e771e0a80148eddb',
          },
        ],
      },

      {
        id: '65900f84e771e0a80148ed92',
        name: 'Dr. Swapnomayee Palit',
        section: [40, 42],
        subject: 'STW',
        likes: [
          '22054144@kiit.ac.in',
          '22051216@kiit.ac.in',
          '2106089@kiit.ac.in',
          '22053872@kiit.ac.in',
          '2205984@kiit.ac.in',
        ],
        dislikes: [
          '22053611@kiit.ac.in',
          '22054090@kiit.ac.in',
          '22052078@kiit.ac.in',
        ],
        reviews: [],
      },

      {
        id: '65900f85e771e0a80148edbc',
        name: 'Dr. Smrutirekha Mohanty',
        section: [44, 46],
        subject: 'STW',
        likes: [
          '21052413@kiit.ac.in',
          'sakshimohan76@gmail.com',
          '2105743@kiit.ac.in',
          '21053469@kiit.ac.in',
          '22052628@kiit.ac.in',
          '22053722@kiit.ac.in',
          '21052882@kiit.ac.in',
          '21053405@kiit.ac.in',
          '21051849@kiit.ac.in',
          '21052809@kiit.ac.in',
          '2105860@kiit.ac.in',
          '2105762@kiit.ac.in',
          '2205761@kiit.ac.in',
          '2105260@kiit.ac.in',
          '2205165@kiit.ac.in',
          '2206203@kiit.ac.in',
          '21051301@kiit.ac.in',
          '2206313@kiit.ac.in',
          '22053872@kiit.ac.in',
          '2206275@kiit.ac.in',
        ],
        dislikes: [
          '22051829@kiit.ac.in',
          '2206118@kiit.ac.in',
          '22052397@kiit.ac.in',
          '22052417@kiit.ac.in',
          '22052844@kiit.ac.in',
          '2205984@kiit.ac.in',
          '21053420@kiit.ac.in',
        ],
        reviews: [],
      },
    ];

    const allReview = [
      {
        name: 'Abhishek Raj',
        likes: 39,
        dislikes: 10,
        reviews: [],
        id: '65a6e829307b55dd84067499',
      },
      {
        name: 'Pradeep Kandula',
        likes: 24,
        dislikes: 36,
        reviews: [
          {
            id: '65901ac045c2b626d34b3abd',
            rating: 3,
            commentedBy: '22054390@kiit.ac.in',
            internalScore: 21,
            comments: "he doesn't give marks!",
            teacherId: '65900f80e771e0a80148ed30',
          },
          {
            id: '6590235945c2b626d34b3ae0',
            rating: 1,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 24,
            comments: 'worst faculty',
            teacherId: '65900f80e771e0a80148ed30',
          },
          {
            id: '659029ea45c2b626d34b3af4',
            rating: 5,
            commentedBy: '21053436@kiit.ac.in',
            internalScore: 30,
            comments: 'Teaches good, Gives deserving marks',
            teacherId: '65900f80e771e0a80148ed30',
          },
          {
            id: '659047a245c2b626d34b3b1e',
            rating: 4,
            commentedBy: '22051350@kiit.ac.in',
            internalScore: 27,
            comments: 'Good teacher ',
            teacherId: '65900f80e771e0a80148ed30',
          },
          {
            id: '65912fe745c2b626d34b3b43',
            rating: 4,
            commentedBy: '22051743@kiit.ac.in',
            internalScore: 27,
            comments: 'no extra marks ...just deserving marks\n',
            teacherId: '65900f80e771e0a80148ed30',
          },
        ],
        id: '65a6e829307b55dd84067466',
      },
      {
        name: 'Jagannath Singh',
        likes: 40,
        dislikes: 6,
        reviews: [
          {
            id: '65901c1945c2b626d34b3ac6',
            rating: 5,
            commentedBy: '2229108@kiit.ac.in',
            internalScore: 29,
            comments: 'best',
            teacherId: '65900f82e771e0a80148ed33',
          },
          {
            id: '65903e2b45c2b626d34b3b16',
            rating: 4,
            commentedBy: '22052939@kiit.ac.in',
            internalScore: 30,
            comments: 'Explains every concepts very well . ',
            teacherId: '65900f82e771e0a80148ed33',
          },
        ],
        id: '65a6e829307b55dd840674b7',
      },
      {
        name: 'Vijay Kumar Meena',
        likes: 12,
        dislikes: 36,
        reviews: [],
        id: '65a6e829307b55dd840674fe',
      },
      {
        name: 'Ashish Singh',
        likes: 2,
        dislikes: 57,
        reviews: [
          {
            id: '659026cc45c2b626d34b3ae4',
            rating: 1,
            commentedBy: '2105672@kiit.ac.in',
            internalScore: 19,
            comments: 'isko liya to pura semester bhugto ge',
            teacherId: '65900f82e771e0a80148ed36',
          },
          {
            id: '6591295745c2b626d34b3b41',
            rating: 1,
            commentedBy: '2105260@kiit.ac.in',
            internalScore: 16,
            comments: 'Worst faculty. Students are affected very badly',
            teacherId: '65900f82e771e0a80148ed36',
          },
        ],
        id: '65a6e829307b55dd840674a9',
      },
      {
        name: 'Mahendra Kumar Gourisaria',
        likes: 10,
        dislikes: 123,
        reviews: [
          {
            id: '65913a0545c2b626d34b3b47',
            rating: 1,
            commentedBy: '2206065@kiit.ac.in',
            internalScore: 20,
            comments: '80% of the class got a 25/50 in his internals',
            teacherId: '65900f82e771e0a80148ed3d',
          },
          {
            id: '6593aec245c2b626d34b3b6c',
            rating: 1,
            commentedBy: '2228124@kiit.ac.in',
            internalScore: 19,
            comments: 'Torture',
            teacherId: '65900f82e771e0a80148ed3d',
          },
          {
            id: '6593fb7f45c2b626d34b3b70',
            rating: 1,
            commentedBy: '2206290@kiit.ac.in',
            internalScore: 16,
            comments: "Don't..just don't ",
            teacherId: '65900f82e771e0a80148ed3d',
          },
          {
            id: '6594001945c2b626d34b3b72',
            rating: 5,
            commentedBy: '2205894@kiit.ac.in',
            internalScore: 13,
            comments: 'Maa chud jayegi ',
            teacherId: '65900f82e771e0a80148ed3d',
          },
        ],
        id: '65a6e829307b55dd84067463',
      },
      {
        name: 'Rabi Shaw',
        likes: 13,
        dislikes: 65,
        reviews: [
          {
            id: '6590270145c2b626d34b3ae6',
            rating: 1,
            commentedBy: '2105366@kiit.ac.in',
            internalScore: 30,
            comments:
              "Probably one of the most evil teachers out there, he actively wants his students to fail miserably and then laugh at their helpless faces. He'll pull some of the the most outlandish bullshit just to make you feel worthless about everything. You CAN, however, get good marks under him if you make a very good impression on him somehow. ",
            teacherId: '65900f82e771e0a80148ed43',
          },
          {
            id: '659037e145c2b626d34b3b0f',
            rating: 5,
            commentedBy: '21051720@kiit.ac.in',
            internalScore: 30,
            comments:
              'He is actually good, if you maintain discipline in class, have 90% above attendance and sit in first bench. He will give 28+ in internals out of 30. Just don’t disturb in his class, else he will make your semester hell.',
            teacherId: '65900f82e771e0a80148ed43',
          },
          {
            id: '659056ea45c2b626d34b3b26',
            rating: 5,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 29,
            comments: 'Marks depends on his mood 😂 ',
            teacherId: '65900f82e771e0a80148ed43',
          },
          {
            id: '65df613c0fb947f5b25481d7',
            rating: 1,
            commentedBy: '2205333@kiit.ac.in',
            internalScore: 14,
            comments: 'Just the worst',
            teacherId: '65900f82e771e0a80148ed43',
          },
        ],
        id: '65a6e829307b55dd8406747e',
      },
      {
        name: 'Saurabh Jha',
        likes: 11,
        dislikes: 20,
        reviews: [
          {
            id: '6590d08e45c2b626d34b3b30',
            rating: 1,
            commentedBy: '21052415@kiit.ac.in',
            internalScore: 27,
            comments:
              'Quiz ka answer net pe mil jayega lekin mid aur end sem.. 🤞🤞',
            teacherId: '65900f82e771e0a80148ed3f',
          },
          {
            id: '65944e5a45c2b626d34b3b79',
            rating: 5,
            commentedBy: '2205606@kiit.ac.in',
            internalScore: 30,
            comments: 'best teacher\n',
            teacherId: '65900f82e771e0a80148ed3f',
          },
        ],
        id: '65a6e829307b55dd840674eb',
      },
      {
        name: 'Saurabh Bilgaiyan',
        likes: 7,
        dislikes: 110,
        reviews: [
          {
            id: '65901db445c2b626d34b3ace',
            rating: 3,
            commentedBy: '2105895@kiit.ac.in',
            internalScore: 30,
            comments:
              "I never studied from him. But my roommate was in his class and he came for substitution in my OS class. I have entered my roommate's internals. He's a good guy assuming you study and attend classes. His teaching style was good. You'll understand stuff. But don't take if you're not gonna grind cause he's also infamous for failing people ",
            teacherId: '65900f82e771e0a80148ed3c',
          },
          {
            id: '659028d745c2b626d34b3af1',
            rating: 1,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 25,
            comments: 'do NOT opt',
            teacherId: '65900f82e771e0a80148ed3c',
          },
          {
            id: '65902a3145c2b626d34b3af7',
            rating: 4,
            commentedBy: '21053436@kiit.ac.in',
            internalScore: 18,
            comments: 'Worst ever',
            teacherId: '65900f82e771e0a80148ed3c',
          },
          {
            id: '65903d7345c2b626d34b3b13',
            rating: 1,
            commentedBy: '2105578@kiit.ac.in',
            internalScore: -1,
            comments:
              'remember the teacher who made out with students? Yes that is him. \n',
            teacherId: '65900f82e771e0a80148ed3c',
          },
        ],
        id: '65a6e829307b55dd840674ea',
      },
      {
        name: 'Himansu Das',
        likes: 25,
        dislikes: 3,
        reviews: [],
        id: '65a6e829307b55dd840674b5',
      },
      {
        name: 'Deependra Singh',
        likes: 23,
        dislikes: 6,
        reviews: [
          {
            id: '6590344145c2b626d34b3b0a',
            rating: 1,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 25,
            comments: 'No 1 chutiya hai bhai mat lena nahi to regret hoga ',
            teacherId: '65900f82e771e0a80148ed42',
          },
        ],
        id: '65a6e829307b55dd840674b1',
      },
      {
        name: 'Debanjan Pathak',
        likes: 24,
        dislikes: 12,
        reviews: [],
        id: '65a6e829307b55dd84067475',
      },
      {
        name: 'Mainak Biswas',
        likes: 26,
        dislikes: 13,
        reviews: [
          {
            id: '65902f3845c2b626d34b3b05',
            rating: 5,
            commentedBy: '2205639@kiit.ac.in',
            internalScore: 30,
            comments:
              'Easy to get marks. A little hard to aprroach but studying will get you marks \n',
            teacherId: '65900f82e771e0a80148ed45',
          },
          {
            id: '65914efb45c2b626d34b3b48',
            rating: 5,
            commentedBy: '22052256@kiit.ac.in',
            internalScore: 27,
            comments: 'Lenient ',
            teacherId: '65900f82e771e0a80148ed45',
          },
        ],
        id: '65a6e829307b55dd84067494',
      },
      {
        name: 'Aleena Swetapadma',
        likes: 29,
        dislikes: 10,
        reviews: [],
        id: '65a6e829307b55dd840674a0',
      },
      {
        name: 'Mainak Chakraborty',
        likes: 32,
        dislikes: 0,
        reviews: [
          {
            id: '6590292245c2b626d34b3af2',
            rating: 5,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments:
              'excellent teaching style; gives ample questions for practice; gives excellent marks',
            teacherId: '65900f83e771e0a80148ed4d',
          },
          {
            id: '6591370545c2b626d34b3b46',
            rating: 1,
            commentedBy: '22051924@kiit.ac.in',
            internalScore: 30,
            comments:
              'Best teacher. Very lenient and gives good marks. Excellent teaching style. Internals mai almost sabko 30/30 diye the AFL mai❤️❤️',
            teacherId: '65900f83e771e0a80148ed4d',
          },
          {
            id: '65914f1645c2b626d34b3b49',
            rating: 5,
            commentedBy: '22052256@kiit.ac.in',
            internalScore: 30,
            comments: 'Chill',
            teacherId: '65900f83e771e0a80148ed4d',
          },
          {
            id: '65914fe645c2b626d34b3b4a',
            rating: 4,
            commentedBy: '22052245@kiit.ac.in',
            internalScore: 29,
            comments: 'good teacher and student friendly',
            teacherId: '65900f83e771e0a80148ed4d',
          },
          {
            id: '6591961945c2b626d34b3b4e',
            rating: 5,
            commentedBy: '2205972@kiit.ac.in',
            internalScore: 27,
            comments: 'badhiya samjhate h, chill af and genuine',
            teacherId: '65900f83e771e0a80148ed4d',
          },
        ],
        id: '65a6e829307b55dd84067490',
      },
      {
        name: 'Mainak Bandyopadhyay',
        likes: 22,
        dislikes: 18,
        reviews: [],
        id: '65a6e829307b55dd840674c7',
      },
      {
        name: 'Soumya Ranjan Mishra',
        likes: 21,
        dislikes: 5,
        reviews: [],
        id: '65a6e829307b55dd84067477',
      },
      {
        name: 'Kunal Anand',
        likes: 46,
        dislikes: 3,
        reviews: [],
        id: '65a6e829307b55dd840674c1',
      },
      {
        name: 'Hrudaya Kumar Tripathy',
        likes: 11,
        dislikes: 10,
        reviews: [],
        id: '65a6e829307b55dd840674b6',
      },
      {
        name: 'Chandani Kumari',
        likes: 20,
        dislikes: 24,
        reviews: [],
        id: '65a6e829307b55dd84067480',
      },
      {
        name: 'Sushruta Mishra',
        likes: 30,
        dislikes: 3,
        reviews: [],
        id: '65a6e829307b55dd840674f8',
      },
      {
        name: 'Jayeeta Chakraborty',
        likes: 13,
        dislikes: 24,
        reviews: [
          {
            id: '659132b845c2b626d34b3b45',
            rating: 1,
            commentedBy: '22054341@kiit.ac.in',
            internalScore: 22,
            comments: 'too less as i did all she said \n',
            teacherId: '65900f83e771e0a80148ed61',
          },
          {
            id: '6593e39345c2b626d34b3b6d',
            rating: 1,
            commentedBy: '2205910@kiit.ac.in',
            internalScore: 20,
            comments: 'marks nhi deti ekdam',
            teacherId: '65900f83e771e0a80148ed61',
          },
        ],
        id: '65a6e829307b55dd84067470',
      },
      {
        name: 'Susmita Das',
        likes: 16,
        dislikes: 2,
        reviews: [],
        id: '65a6e829307b55dd840674f9',
      },
      {
        name: 'Murari Mandal',
        likes: 10,
        dislikes: 30,
        reviews: [],
        id: '65a6e829307b55dd84067467',
      },
      {
        name: 'Namita Panda',
        likes: 36,
        dislikes: 10,
        reviews: [
          {
            id: '65901f1545c2b626d34b3ad4',
            rating: 5,
            commentedBy: '2106290@kiit.ac.in',
            internalScore: 29,
            comments: 'She is great',
            teacherId: '65900f83e771e0a80148ed66',
          },
          {
            id: '65930e0945c2b626d34b3b63',
            rating: 4,
            commentedBy: '2206340@kiit.ac.in',
            internalScore: 23,
            comments:
              'She is great when it comes to teaching but for internals she conducts class test. You have to score well to get good internals. But can increase internals if you have scored well in mid sem.',
            teacherId: '65900f83e771e0a80148ed66',
          },
        ],
        id: '65a6e829307b55dd840674d3',
      },
      {
        name: 'Asif Uddin Khan',
        likes: 17,
        dislikes: 23,
        reviews: [],
        id: '65a6e829307b55dd84067486',
      },
      {
        name: 'Rinku Datta Rakshit',
        likes: 22,
        dislikes: 5,
        reviews: [
          {
            id: '65904d3645c2b626d34b3b1f',
            rating: 5,
            commentedBy: '2105974@kiit.ac.in',
            internalScore: 30,
            comments: 'Padhati bohot acha h...highly recommended ',
            teacherId: '65900f83e771e0a80148ed67',
          },
        ],
        id: '65a6e829307b55dd840674de',
      },
      {
        name: 'Manas Ranjan Nayak',
        likes: 23,
        dislikes: 9,
        reviews: [
          {
            id: '65903cc445c2b626d34b3b11',
            rating: 3,
            commentedBy: '2128034@kiit.ac.in',
            internalScore: 23,
            comments: 'Good overall. Not the best but will do.\n',
            teacherId: '65900f84e771e0a80148ed69',
          },
          {
            id: '6591ac0e45c2b626d34b3b52',
            rating: 3,
            commentedBy: '2206340@kiit.ac.in',
            internalScore: 25,
            comments:
              'Bhai is aadmi ko khud kuch nhi aata. Lenient h no doubt. But ha agr tmne shi likha h to b guarantee nhi h k marks milenge kyuki usko smjh nhi aata',
            teacherId: '65900f84e771e0a80148ed69',
          },
          {
            id: '6594603e45c2b626d34b3b7a',
            rating: 5,
            commentedBy: '2206385@kiit.ac.in',
            internalScore: 30,
            comments: 'na',
            teacherId: '65900f84e771e0a80148ed69',
          },
        ],
        id: '65a6e829307b55dd840674c9',
      },
      {
        name: 'Soumya Ranjan Nayak',
        likes: 8,
        dislikes: 11,
        reviews: [
          {
            id: '65902fd245c2b626d34b3b06',
            rating: 3,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 26,
            comments: 'South indian Villian ',
            teacherId: '65900f84e771e0a80148ed6c',
          },
          {
            id: '65930bec45c2b626d34b3b5e',
            rating: 5,
            commentedBy: '22052043@kiit.ac.in',
            internalScore: 30,
            comments:
              'Very Good teacher... especially good if u can get in his good graces... "You can\'t stop me from being myself"',
            teacherId: '65900f84e771e0a80148ed6c',
          },
          {
            id: '65930c5545c2b626d34b3b5f',
            rating: 5,
            commentedBy: '22052042@kiit.ac.in',
            internalScore: 29,
            comments: 'du6urr6vubt o9uo8 ',
            teacherId: '65900f84e771e0a80148ed6c',
          },
          {
            id: '65930c6245c2b626d34b3b60',
            rating: 4,
            commentedBy: '22052044@kiit.ac.in',
            internalScore: 27,
            comments:
              'Good "\'if and only if"\' you are attentive and interact with the teacher',
            teacherId: '65900f84e771e0a80148ed6c',
          },
          {
            id: '65930c7545c2b626d34b3b61',
            rating: 4,
            commentedBy: '22052054@kiit.ac.in',
            internalScore: 27,
            comments:
              'Thik thak hi padhata hai ,exam me bas marks Thora ulta sidha deta hai,kabhi kabhi sahi answers p marks nhi dega but recheck p dene se marks badha dega',
            teacherId: '65900f84e771e0a80148ed6c',
          },
        ],
        id: '65a6e829307b55dd8406748b',
      },
      {
        name: 'Debashis Hati',
        likes: 27,
        dislikes: 11,
        reviews: [],
        id: '65a6e829307b55dd8406746c',
      },
      {
        name: 'Alok Kumar Jagadev',
        likes: 7,
        dislikes: 18,
        reviews: [
          {
            id: '6591a71345c2b626d34b3b4f',
            rating: 3,
            commentedBy: '22054176@kiit.ac.in',
            internalScore: 25,
            comments:
              'Strict teacher and you need to be attentive in class.Will give marks as per you deserve and checks the assignments very strictly ',
            teacherId: '65900f84e771e0a80148ed71',
          },
          {
            id: '6594423c45c2b626d34b3b77',
            rating: 3,
            commentedBy: '22054173@kiit.ac.in',
            internalScore: 27,
            comments:
              "Strict, doesn't let u use phone in class. Good teacher. Sometimes his lectures might be boring, will never let u sleep.",
            teacherId: '65900f84e771e0a80148ed71',
          },
        ],
        id: '65a6e829307b55dd840674a1',
      },
      {
        name: 'Minakhi Rout',
        likes: 13,
        dislikes: 26,
        reviews: [
          {
            id: '659383ba45c2b626d34b3b65',
            rating: 1,
            commentedBy: '2206188@kiit.ac.in',
            internalScore: 19,
            comments:
              "very arrogant and she taught in a bookish manner, doesn't give internal marks or take any defaulter test/quiz ",
            teacherId: '65900f84e771e0a80148ed74',
          },
          {
            id: '65df61760fb947f5b25481d8',
            rating: 1,
            commentedBy: '2205333@kiit.ac.in',
            internalScore: 20,
            comments:
              "She's so sadistic, gives marks on her mood. Way too biased ",
            teacherId: '65900f84e771e0a80148ed74',
          },
        ],
        id: '65a6e829307b55dd840674cd',
      },
      {
        name: 'Sampriti Soor',
        likes: 10,
        dislikes: 8,
        reviews: [
          {
            id: '6590fa6545c2b626d34b3b3d',
            rating: 1,
            commentedBy: '22052843@kiit.ac.in',
            internalScore: 20,
            comments:
              'Sirf re be tum tam karna aata hai, mithi baatein aur low internals inki khoobi hai',
            teacherId: '65900f84e771e0a80148ed77',
          },
        ],
        id: '65a6e829307b55dd8406748d',
      },
      {
        name: 'Vishal Meena',
        likes: 12,
        dislikes: 6,
        reviews: [],
        id: '65a6e829307b55dd84067500',
      },
      {
        name: 'Sankalp Nayak',
        likes: 3,
        dislikes: 31,
        reviews: [
          {
            id: '659057ce45c2b626d34b3b27',
            rating: 1,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 20,
            comments:
              'Not recommended at all. 17-18 was the average internal marks',
            teacherId: '65900f84e771e0a80148ed7c',
          },
        ],
        id: '65a6e829307b55dd840674e2',
      },
      {
        name: 'Pradeep Kumar Mallick',
        likes: 28,
        dislikes: 12,
        reviews: [
          {
            id: '65901bad45c2b626d34b3ac2',
            rating: 5,
            commentedBy: '22053306@kiit.ac.in',
            internalScore: 29,
            comments: 'Nicee',
            teacherId: '65900f84e771e0a80148ed81',
          },
          {
            id: '65912ade45c2b626d34b3b42',
            rating: 5,
            commentedBy: '21052449@kiit.ac.in',
            internalScore: 29,
            comments: 'Great teacher',
            teacherId: '65900f84e771e0a80148ed81',
          },
        ],
        id: '65a6e829307b55dd840674d9',
      },
      {
        name: 'Krishnandu Hazra',
        likes: 4,
        dislikes: 22,
        reviews: [],
        id: '65a6e829307b55dd84067478',
      },
      {
        name: 'Prasenjit Maiti',
        likes: 30,
        dislikes: 0,
        reviews: [],
        id: '65a6e829307b55dd84067479',
      },
      {
        name: 'Sarita Mishra',
        likes: 16,
        dislikes: 1,
        reviews: [
          {
            id: '65903d8645c2b626d34b3b14',
            rating: 5,
            commentedBy: '2128034@kiit.ac.in',
            internalScore: 28,
            comments: 'BEST.',
            teacherId: '65900f84e771e0a80148ed88',
          },
        ],
        id: '65a6e829307b55dd8406748a',
      },
      {
        name: 'Saikat Chakraborty',
        likes: 11,
        dislikes: 21,
        reviews: [
          {
            id: '65902a6245c2b626d34b3af8',
            rating: 1,
            commentedBy: '2205629@kiit.ac.in',
            internalScore: 30,
            comments: 'does NOT teach at all!',
            teacherId: '65900f84e771e0a80148ed85',
          },
          {
            id: '65904da445c2b626d34b3b21',
            rating: 1,
            commentedBy: '2105974@kiit.ac.in',
            internalScore: 18,
            comments: 'Bohot test leta h ',
            teacherId: '65900f84e771e0a80148ed85',
          },
        ],
        id: '65a6e829307b55dd8406747d',
      },
      {
        name: 'Ajit Kumar Pasayat',
        likes: 23,
        dislikes: 1,
        reviews: [
          {
            id: '65903db845c2b626d34b3b15',
            rating: 5,
            commentedBy: '2128034@kiit.ac.in',
            internalScore: 25,
            comments:
              'BEST PERSON, FULL SUPPORT TO STUDENTS AND EXTREMELY STUDENT FRIENDLY\n',
            teacherId: '65900f84e771e0a80148ed8a',
          },
        ],
        id: '65a6e829307b55dd84067492',
      },
      {
        name: 'Monideepa Roy',
        likes: 10,
        dislikes: 16,
        reviews: [
          {
            id: '65901aed45c2b626d34b3abe',
            rating: 5,
            commentedBy: 'tpiyush2626@gmail.com',
            internalScore: 27,
            comments: 'very good',
            teacherId: '65900f84e771e0a80148ed8c',
          },
        ],
        id: '65a6e829307b55dd84067465',
      },
      {
        name: 'Swagatika Sahoo',
        likes: 11,
        dislikes: 15,
        reviews: [
          {
            id: '6593ee8e45c2b626d34b3b6f',
            rating: 5,
            commentedBy: '2205045@kiit.ac.in',
            internalScore: 26,
            comments: 'Afl',
            teacherId: '65900f84e771e0a80148ed86',
          },
        ],
        id: '65a6e829307b55dd840674fa',
      },
      {
        name: 'Pratyusa Mukherjee',
        likes: 27,
        dislikes: 16,
        reviews: [
          {
            id: '6590309b45c2b626d34b3b07',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 28,
            comments:
              'Maintain attendence and she will conduct only 2 tests premid and post mid and whatever you get in test that will be your internal and tests questions are from whatever she taught in the class',
            teacherId: '65900f84e771e0a80148ed8d',
          },
        ],
        id: '65a6e829307b55dd8406746f',
      },
      {
        name: 'Arup Abhinna Acharya',
        likes: 36,
        dislikes: 18,
        reviews: [
          {
            id: '65902b5445c2b626d34b3afd',
            rating: 5,
            commentedBy: '2105366@kiit.ac.in',
            internalScore: 28,
            comments:
              'One of the best teachers in the university, but his quizzes can be brutal at times. ',
            teacherId: '65900f84e771e0a80148ed90',
          },
          {
            id: '65903cd045c2b626d34b3b12',
            rating: 5,
            commentedBy: '22054231@kiit.ac.in',
            internalScore: 28,
            comments: 'teaches well ',
            teacherId: '65900f84e771e0a80148ed90',
          },
          {
            id: '6590582345c2b626d34b3b29',
            rating: 5,
            commentedBy: '2105986@kiit.ac.in',
            internalScore: 28,
            comments: 'Highly recommended for DSA',
            teacherId: '65900f84e771e0a80148ed90',
          },
          {
            id: '6594254445c2b626d34b3b75',
            rating: 1,
            commentedBy: '22051815@kiit.ac.in',
            internalScore: 26,
            comments:
              "Teaches very well but doesn't gives marks. Very stringent marking. No step marking and no marks for writing algorithms.",
            teacherId: '65900f84e771e0a80148ed90',
          },
        ],
        id: '65a6e829307b55dd840674a7',
      },
      {
        name: 'Sujata Swain',
        likes: 42,
        dislikes: 11,
        reviews: [],
        id: '65a6e829307b55dd840674f5',
      },
      {
        name: 'Subhasis Dash',
        likes: 3,
        dislikes: 10,
        reviews: [
          {
            id: '6590466445c2b626d34b3b1b',
            rating: 4,
            commentedBy: '21051974@kiit.ac.in',
            internalScore: 22,
            comments:
              'more than enough knowledgeable. Sometimes his knowledge goes through the other side of the head, but Qn practiced in the class come in exam. If you have patients  select him it will be very beneficial.',
            teacherId: '65900f84e771e0a80148ed94',
          },
          {
            id: '659072be45c2b626d34b3b2a',
            rating: 1,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 20,
            comments: 'He gives quiz on moodles',
            teacherId: '65900f84e771e0a80148ed94',
          },
        ],
        id: '65a6e829307b55dd840674f3',
      },
      {
        name: 'Rajat Kumar Behera',
        likes: 6,
        dislikes: 27,
        reviews: [
          {
            id: '6590733545c2b626d34b3b2b',
            rating: 1,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 15,
            comments: 'He is the worst teacher you can get.',
            teacherId: '65900f84e771e0a80148ed96',
          },
        ],
        id: '65a6e829307b55dd8406746b',
      },
      {
        name: 'Rajdeep Chatterjee',
        likes: 22,
        dislikes: 2,
        reviews: [
          {
            id: '65902c7545c2b626d34b3b02',
            rating: 5,
            commentedBy: '21052882@kiit.ac.in',
            internalScore: 30,
            comments:
              'Bhai GOD inshaan hai. Muh pe phek ke marks dete hain. Koi bhi subject me le lo full marks milega.',
            teacherId: '65900f84e771e0a80148ed95',
          },
        ],
        id: '65a6e829307b55dd84067462',
      },
      {
        name: 'Harish Kumar Patnaik',
        likes: 8,
        dislikes: 24,
        reviews: [
          {
            id: '65901b1345c2b626d34b3ac0',
            rating: 1,
            commentedBy: 'tpiyush2626@gmail.com',
            internalScore: 17,
            comments: 'dont take him',
            teacherId: '65900f84e771e0a80148ed97',
          },
          {
            id: '6595002745c2b626d34b3ba4',
            rating: 1,
            commentedBy: '2228089@kiit.ac.in',
            internalScore: 19,
            comments: 'comes late to class and discuss 1 code and leave',
            teacherId: '65900f84e771e0a80148ed97',
          },
        ],
        id: '65a6e829307b55dd8406746d',
      },
      {
        name: 'Junali Jasmine Jena',
        likes: 4,
        dislikes: 39,
        reviews: [],
        id: '65a6e829307b55dd840674bc',
      },
      {
        name: 'Tanmoy Maitra',
        likes: 3,
        dislikes: 20,
        reviews: [
          {
            id: '65901c3645c2b626d34b3ac7',
            rating: 5,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 29,
            comments:
              'Good knowledge, teaches very well..if you make notes of his class that will be more than enough. Just study that before exams nothing else. Friendly',
            teacherId: '65900f84e771e0a80148ed98',
          },
          {
            id: '6590737245c2b626d34b3b2c',
            rating: 1,
            commentedBy: '21053380@kiit.ac.in',
            internalScore: 20,
            comments: 'He is strict.',
            teacherId: '65900f84e771e0a80148ed98',
          },
        ],
        id: '65a6e829307b55dd840674fd',
      },
      {
        name: 'Jayanta Mondal',
        likes: 19,
        dislikes: 1,
        reviews: [
          {
            id: '65904eb645c2b626d34b3b24',
            rating: 5,
            commentedBy: '2105860@kiit.ac.in',
            internalScore: 30,
            comments: ' ',
            teacherId: '65900f84e771e0a80148ed9e',
          },
        ],
        id: '65a6e829307b55dd84067481',
      },
      {
        name: 'Chandra Shekhar',
        likes: 26,
        dislikes: 3,
        reviews: [],
        id: '65a6e829307b55dd840674af',
      },
      {
        name: 'Chittaranjan Pradhan',
        likes: 44,
        dislikes: 8,
        reviews: [
          {
            id: '659046e345c2b626d34b3b1c',
            rating: 4,
            commentedBy: '21051974@kiit.ac.in',
            internalScore: 26,
            comments:
              'accha padhate hai , sare unhi k ppt distribute hote hai to khudhi samajh lo.',
            teacherId: '65900f85e771e0a80148eda0',
          },
          {
            id: '6590dba045c2b626d34b3b32',
            rating: 5,
            commentedBy: '22052950@kiit.ac.in',
            internalScore: 29,
            comments: 'Very good teacher ',
            teacherId: '65900f85e771e0a80148eda0',
          },
        ],
        id: '65a6e829307b55dd840674b0',
      },
      {
        name: 'Bhabani Shankar Prasad Mishra',
        likes: 14,
        dislikes: 15,
        reviews: [],
        id: '65a6e829307b55dd840674ac',
      },
      {
        name: 'Santwana Sagnika',
        likes: 29,
        dislikes: 0,
        reviews: [],
        id: '65a6e829307b55dd840674e6',
      },
      {
        name: 'Ramesh Kumar Thakur',
        likes: 34,
        dislikes: 1,
        reviews: [
          {
            id: '65902a2645c2b626d34b3af6',
            rating: 5,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 30,
            comments: 'best faculty in whole kiit university',
            teacherId: '65900f85e771e0a80148eda8',
          },
          {
            id: '65902a7445c2b626d34b3af9',
            rating: 5,
            commentedBy: '2105366@kiit.ac.in',
            internalScore: 30,
            comments:
              'Teaching is below average but otherwise an absolute amazing person. ❣️',
            teacherId: '65900f85e771e0a80148eda8',
          },
          {
            id: '65aca35b870bee50deeccbea',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 30,
            comments: 'Best Teacher of It',
            teacherId: '65900f85e771e0a80148eda8',
          },
          {
            id: '65aca3ab870bee50deeccbeb',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 29,
            comments: 'Nice Professor',
            teacherId: '65900f85e771e0a80148eda8',
          },
        ],
        id: '65a6e829307b55dd840674dc',
      },
      {
        name: 'Manoj Kumar Mishra',
        likes: 8,
        dislikes: 2,
        reviews: [],
        id: '65a6e829307b55dd840674cb',
      },
      {
        name: 'Mohit Ranjan Panda',
        likes: 19,
        dislikes: 11,
        reviews: [
          {
            id: '65904dea45c2b626d34b3b22',
            rating: 4,
            commentedBy: '2105974@kiit.ac.in',
            internalScore: 26,
            comments: 'Number acha de dega',
            teacherId: '65900f85e771e0a80148edab',
          },
        ],
        id: '65a6e829307b55dd840674ce',
      },
      {
        name: 'Manas Ranjan Lenka',
        likes: 10,
        dislikes: 43,
        reviews: [
          {
            id: '65901e3145c2b626d34b3ad3',
            rating: 4,
            commentedBy: '21052168@kiit.ac.in',
            internalScore: 21,
            comments: 'Knowledgeable and nice teaching but very strict ',
            teacherId: '65900f85e771e0a80148edad',
          },
          {
            id: '6592cf4c45c2b626d34b3b57',
            rating: 1,
            commentedBy: '22052080@kiit.ac.in',
            internalScore: 17,
            comments: 'ek toh marks nahi diya upar se ghar pe call kar diya',
            teacherId: '65900f85e771e0a80148edad',
          },
        ],
        id: '65a6e829307b55dd84067460',
      },
      {
        name: 'Banchhanidhi Dash',
        likes: 33,
        dislikes: 15,
        reviews: [],
        id: '65a6e829307b55dd840674aa',
      },
      {
        name: 'Sohail Khan',
        likes: 12,
        dislikes: 4,
        reviews: [],
        id: '65a6e829307b55dd840674ee',
      },
      {
        name: 'Suresh Chandra Satapathy',
        likes: 13,
        dislikes: 10,
        reviews: [],
        id: '65a6e829307b55dd840674f7',
      },
      {
        name: 'Mandakini Priyadarshani Behera',
        likes: 5,
        dislikes: 25,
        reviews: [
          {
            id: '65903c8545c2b626d34b3b10',
            rating: 1,
            commentedBy: '2205421@kiit.ac.in',
            internalScore: 24,
            comments:
              "Has no knowledge of the subject herself. Complete bookish knowledge and can't understand shit if you use your own brain and write a code which does not match the one taught in class. Has very poor idea of the subject.",
            teacherId: '65900f85e771e0a80148edb7',
          },
          {
            id: '659155b345c2b626d34b3b4b',
            rating: 1,
            commentedBy: '22052895@kiit.ac.in',
            internalScore: 25,
            comments:
              'kuch nahi aata usko, sahi likha answer bhi kata ke 0 kar degi , na internal deti hai nahi paper checking me',
            teacherId: '65900f85e771e0a80148edb7',
          },
        ],
        id: '65a6e829307b55dd840674ca',
      },
      {
        name: 'Suchismita Das',
        likes: 12,
        dislikes: 5,
        reviews: [],
        id: '65a6e829307b55dd840674f4',
      },
      {
        name: 'Amiya Ranjan Panda',
        likes: 26,
        dislikes: 8,
        reviews: [
          {
            id: '6590351045c2b626d34b3b0c',
            rating: 1,
            commentedBy: '22052643@kiit.ac.in',
            internalScore: 23,
            comments:
              'padhata bahut achha hai , lekin marks lana tough hai aur intenal mein bahut kharap marks deta even if you top in mid semester exam',
            teacherId: '65900f85e771e0a80148edb6',
          },
          {
            id: '65904e1445c2b626d34b3b23',
            rating: 4,
            commentedBy: '2105974@kiit.ac.in',
            internalScore: 24,
            comments:
              'Tension ni dega semester me...number bhi thik thaak de dega',
            teacherId: '65900f85e771e0a80148edb6',
          },
          {
            id: '6590efb645c2b626d34b3b3a',
            rating: 5,
            commentedBy: '22052634@kiit.ac.in',
            internalScore: 25,
            comments:
              "As a teacher, he's a very good one. Doesn't care much about the attendance and is'nt strict at all",
            teacherId: '65900f85e771e0a80148edb6',
          },
        ],
        id: '65a6e829307b55dd840674a4',
      },
      {
        name: 'Partha Sarathi Paul',
        likes: 10,
        dislikes: 9,
        reviews: [
          {
            id: '65902d7845c2b626d34b3b03',
            rating: 1,
            commentedBy: '21052882@kiit.ac.in',
            internalScore: 19,
            comments:
              'Bhai inko dekh k hi neend aa jaati hai. Tumhara answer jaisha bhi ho, agar answer script se match nhi kiya to marks nhi milega, step marks to bhul jao. ',
            teacherId: '65900f85e771e0a80148edb8',
          },
        ],
        id: '65a6e829307b55dd84067469',
      },
      {
        name: 'Tanik Saikh',
        likes: 6,
        dislikes: 21,
        reviews: [
          {
            id: '659025fb45c2b626d34b3ae2',
            rating: 1,
            commentedBy: '22052705@kiit.ac.in',
            internalScore: 23,
            comments:
              'Not recommended... \nteaching skill is very poor..\nBohot bolne ke bad itna internal marks mila..\nQuiz viva sab cls me paper me le raha tha..\nLekin kuch padhana nahi ata he ..\nKuch bhi samjh nahi aya',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '6590270e45c2b626d34b3ae8',
            rating: 1,
            commentedBy: '22051615@kiit.ac.in',
            internalScore: 21,
            comments: 'worst',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '6590d83d45c2b626d34b3b31',
            rating: 1,
            commentedBy: '22053724@kiit.ac.in',
            internalScore: 26,
            comments: 'If you wanna fail go ahead',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '6590f44d45c2b626d34b3b3b',
            rating: 5,
            commentedBy: '22051204@kiit.ac.in',
            internalScore: 28,
            comments:
              'Sir padhata nhi hai utna achha, par unka notes bohot useful hai.',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '659160de45c2b626d34b3b4c',
            rating: 3,
            commentedBy: '22052367@kiit.ac.in',
            internalScore: 30,
            comments:
              'Sare quiz, written tests offline with surprise tests. Kaafi important cheezien miss kar denge aur number bhi nahi denge.(Mera paper copy karne wale ko (dusra section) 32/40 aur mujhe 13/40(no grace marks for topics not covered in class). Attendance theek rakhoge toh thoda easy rahega',
            teacherId: '65900f85e771e0a80148edbd',
          },
          {
            id: '65926e2945c2b626d34b3b55',
            rating: 2,
            commentedBy: '22053675@kiit.ac.in',
            internalScore: 26,
            comments:
              'The worst teacher in kiit inko liya toh marks bhul jayo, padhate bhi bahat kharab hain, internals v nahi dete bahat mushkil se internals mein thoda badhaya ',
            teacherId: '65900f85e771e0a80148edbd',
          },
        ],
        id: '65a6e829307b55dd840674fb',
      },
      {
        name: 'Kumar Devadutta',
        likes: 22,
        dislikes: 10,
        reviews: [
          {
            id: '65901c1645c2b626d34b3ac5',
            rating: 5,
            commentedBy: '21052500@kiit.ac.in',
            internalScore: 29,
            comments:
              'Teaches well, also if you have attendance, you can score full in internals. ',
            teacherId: '65900f85e771e0a80148edbe',
          },
        ],
        id: '65a6e829307b55dd840674c0',
      },
      {
        name: 'Arup Sarkar',
        likes: 16,
        dislikes: 15,
        reviews: [
          {
            id: '65901cc745c2b626d34b3ac8',
            rating: 4,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 30,
            comments: 'Extremely linent. Bharke marks dega…',
            teacherId: '65900f85e771e0a80148edc3',
          },
          {
            id: '65901d0045c2b626d34b3aca',
            rating: 5,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 30,
            comments:
              'Marks dega. Lekin classes bohot boring honge..Friendly bhi ha',
            teacherId: '65900f85e771e0a80148edc3',
          },
        ],
        id: '65a6e829307b55dd840674a8',
      },
      {
        name: 'Priyanka Roy',
        likes: 6,
        dislikes: 48,
        reviews: [
          {
            id: '6591638b45c2b626d34b3b4d',
            rating: 1,
            commentedBy: '22054085@kiit.ac.in',
            internalScore: -2,
            comments: 'worst',
            teacherId: '65900f85e771e0a80148edc2',
          },
        ],
        id: '65a6e829307b55dd84067472',
      },
      {
        name: 'Abinas Panda',
        likes: 14,
        dislikes: 8,
        reviews: [
          {
            id: '6590423045c2b626d34b3b18',
            rating: 3,
            commentedBy: '22051807@kiit.ac.in',
            internalScore: 20,
            comments:
              'Internal ma marks nahi deta baki sa thik ha aur har hafta quize ya classe test leta ha .',
            teacherId: '65900f85e771e0a80148edc5',
          },
        ],
        id: '65a6e829307b55dd8406749b',
      },
      {
        name: 'Prasant Kumar Pattnaik',
        likes: 11,
        dislikes: 0,
        reviews: [
          {
            id: '65902bc145c2b626d34b3afe',
            rating: 5,
            commentedBy: '21052859@kiit.ac.in',
            internalScore: 28,
            comments:
              'Excellent teacher, teaching in normal but if you want marks, he is the one. Very cool teacher and you can also do projects under hime in future.',
            teacherId: '65900f85e771e0a80148edcb',
          },
        ],
        id: '65a6e829307b55dd840674da',
      },
      {
        name: 'Krutika Verma',
        likes: 6,
        dislikes: 27,
        reviews: [],
        id: '65a6e829307b55dd840674bf',
      },
      {
        name: 'Partha Pratim Sarangi',
        likes: 30,
        dislikes: 16,
        reviews: [],
        id: '65a6e829307b55dd84067464',
      },
      {
        name: 'Mukesh Kumar',
        likes: 15,
        dislikes: 15,
        reviews: [
          {
            id: '65901d9245c2b626d34b3acd',
            rating: 5,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 30,
            comments:
              'Friendly and class me mazak masti krta rehta ha. Lekin Zyada mt kr dena toh gussa ho jayega lekin baad me phirse has deta ha..Min 27 toh dega hi internals agr sab timely submitted ha toh',
            teacherId: '65900f85e771e0a80148edcf',
          },
        ],
        id: '65a6e829307b55dd840674cf',
      },
      {
        name: 'Amulya Ratna Swain',
        likes: 49,
        dislikes: 10,
        reviews: [
          {
            id: '65901dc145c2b626d34b3acf',
            rating: 1,
            commentedBy: '2106302@kiit.ac.in',
            internalScore: 15,
            comments: 'Bhul se bhi mt lena',
            teacherId: '65900f85e771e0a80148edd1',
          },
        ],
        id: '65a6e829307b55dd84067485',
      },
      {
        name: 'Leena Das',
        likes: 3,
        dislikes: 29,
        reviews: [
          {
            id: '6590e09945c2b626d34b3b37',
            rating: 1,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 15,
            comments: '!!!DANGER!!!',
            teacherId: '65900f86e771e0a80148edd4',
          },
        ],
        id: '65a6e829307b55dd840674c3',
      },
      {
        name: 'Ajay Kumar Jena',
        likes: 7,
        dislikes: 17,
        reviews: [
          {
            id: '6590e07645c2b626d34b3b36',
            rating: 4,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 25,
            comments: 'dont know anything but internal meh number deta hai',
            teacherId: '65900f86e771e0a80148edd3',
          },
        ],
        id: '65a6e829307b55dd8406749e',
      },
      {
        name: 'Samaresh Mishra',
        likes: 26,
        dislikes: 9,
        reviews: [],
        id: '65a6e829307b55dd840674e1',
      },
      {
        name: 'Santosh Kumar Pani',
        likes: 17,
        dislikes: 1,
        reviews: [
          {
            id: '6592afe245c2b626d34b3b56',
            rating: 5,
            commentedBy: '22051722@kiit.ac.in',
            internalScore: 28,
            comments: 'very chill',
            teacherId: '65900f86e771e0a80148edd9',
          },
          {
            id: '6593edad45c2b626d34b3b6e',
            rating: 5,
            commentedBy: '21052316@kiit.ac.in',
            internalScore: 30,
            comments: 'best teacher in terms of everything',
            teacherId: '65900f86e771e0a80148edd9',
          },
        ],
        id: '65a6e829307b55dd840674e4',
      },
      {
        name: 'Benazir Neha',
        likes: 39,
        dislikes: 8,
        reviews: [
          {
            id: '65910eb145c2b626d34b3b40',
            rating: 5,
            commentedBy: '2205919@kiit.ac.in',
            internalScore: 27,
            comments: 'Teaches ok and gives lots of marks.',
            teacherId: '65900f86e771e0a80148edd8',
          },
          {
            id: '65943cf545c2b626d34b3b76',
            rating: 5,
            commentedBy: '22051073@kiit.ac.in',
            internalScore: 27,
            comments:
              'Internal mein bhi theek hi de deti hai but mid sem and end sem mein bhar bhar ke marks milenge and padhati bhi sahi hai kaafi',
            teacherId: '65900f86e771e0a80148edd8',
          },
        ],
        id: '65a6e829307b55dd840674ab',
      },
      {
        name: 'Sourajit Behera',
        likes: 20,
        dislikes: 4,
        reviews: [
          {
            id: '6590276945c2b626d34b3aeb',
            rating: 5,
            commentedBy: '21051041@kiit.ac.in',
            internalScore: 28,
            comments: 'best teacher ever',
            teacherId: '65900f86e771e0a80148ede0',
          },
          {
            id: '6590279445c2b626d34b3aec',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 28,
            comments: 'Chill teacher ever You can go for it',
            teacherId: '65900f86e771e0a80148ede0',
          },
          {
            id: '6594220345c2b626d34b3b74',
            rating: 5,
            commentedBy: '22052610@kiit.ac.in',
            internalScore: 2,
            comments: '1',
            teacherId: '65900f86e771e0a80148ede0',
          },
        ],
        id: '65a6e829307b55dd840674ef',
      },
      {
        name: 'Gananath Bhuyan',
        likes: 21,
        dislikes: 9,
        reviews: [
          {
            id: '6590f55f45c2b626d34b3b3c',
            rating: 5,
            commentedBy: '22052843@kiit.ac.in',
            internalScore: 28,
            comments:
              'I know strict teacher hai, but internals dete hai lekin attendance cut kar lete hai, padhate good hai',
            teacherId: '65900f86e771e0a80148eddf',
          },
        ],
        id: '65a6e829307b55dd840674b4',
      },
      {
        name: 'Dayal Kumar Behera',
        likes: 20,
        dislikes: 0,
        reviews: [
          {
            id: '6590283345c2b626d34b3aef',
            rating: 4,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 27,
            comments:
              'He will take surprise test in class and if you attend more than 80% and if you just write anything in exam still he gives marks',
            teacherId: '65900f86e771e0a80148eddd',
          },
        ],
        id: '65a6e829307b55dd84067487',
      },
      {
        name: 'Abhaya Kumar Sahoo',
        likes: 15,
        dislikes: 1,
        reviews: [
          {
            id: '6590276045c2b626d34b3aea',
            rating: 5,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 30,
            comments: 'He is just nice',
            teacherId: '65900f86e771e0a80148ede1',
          },
        ],
        id: '65a6e829307b55dd84067498',
      },
      {
        name: 'Nibedan Panda',
        likes: 21,
        dislikes: 9,
        reviews: [],
        id: '65a6e829307b55dd840674d4',
      },
      {
        name: 'Subhadip Pramanik',
        likes: 9,
        dislikes: 1,
        reviews: [],
        id: '65a6e829307b55dd840674f1',
      },
      {
        name: 'Ipsita Paul',
        likes: 9,
        dislikes: 18,
        reviews: [
          {
            id: '6590221745c2b626d34b3add',
            rating: 1,
            commentedBy: '21051716@kiit.ac.in',
            internalScore: 23,
            comments:
              "She don't clear any doubt. Other than study she can talk about anything. Boys who talk random things and entertain her will got marks not on the basis of talent",
            teacherId: '65900f86e771e0a80148ede5',
          },
          {
            id: '6590270545c2b626d34b3ae7',
            rating: 1,
            commentedBy: '21053420@kiit.ac.in',
            internalScore: 25,
            comments: "Worst teacher don't expect from her",
            teacherId: '65900f86e771e0a80148ede5',
          },
          {
            id: '6590e02645c2b626d34b3b34',
            rating: 1,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 18,
            comments: 'bad ',
            teacherId: '65900f86e771e0a80148ede5',
          },
        ],
        id: '65a6e829307b55dd8406747f',
      },
      {
        name: 'Dipti Dash',
        likes: 19,
        dislikes: 0,
        reviews: [],
        id: '65a6e829307b55dd840674b2',
      },
      {
        name: 'Pinaki Sankar Chatterjee',
        likes: 11,
        dislikes: 16,
        reviews: [],
        id: '65a6e829307b55dd840674d6',
      },
      {
        name: 'Raghunath Dey',
        likes: 14,
        dislikes: 2,
        reviews: [
          {
            id: '6590dfff45c2b626d34b3b33',
            rating: 3,
            commentedBy: '21051592@kiit.ac.in',
            internalScore: 26,
            comments: 'good teaher linient in marks ',
            teacherId: '65900f88e771e0a80148ede7',
          },
        ],
        id: '65a6e829307b55dd84067493',
      },
      {
        name: 'Sourav Kumar Giri',
        likes: 9,
        dislikes: 1,
        reviews: [],
        id: '65a6e829307b55dd840674f0',
      },
      {
        name: 'Anuja Kumar Acharya',
        likes: 18,
        dislikes: 18,
        reviews: [
          {
            id: '65901cdf45c2b626d34b3ac9',
            rating: 3,
            commentedBy: '22051843@kiit.ac.in',
            internalScore: 24,
            comments: 'I would recommend mat lena. Risky sir hai. ',
            teacherId: '65900f83e771e0a80148ed4b',
          },
          {
            id: '65902a7845c2b626d34b3afa',
            rating: 5,
            commentedBy: '21053436@kiit.ac.in',
            internalScore: 30,
            comments:
              'He taught good, gave marks, but when i applied for recheck he never recheked it.',
            teacherId: '65900f83e771e0a80148ed4b',
          },
          {
            id: '6593903f45c2b626d34b3b66',
            rating: 1,
            commentedBy: '2205316@kiit.ac.in',
            internalScore: 20,
            comments: 'unnecessarily strict',
            teacherId: '65900f83e771e0a80148ed4b',
          },
        ],
        id: '65a6e829307b55dd840674a6',
      },
      {
        name: 'Sujoy Datta',
        likes: 67,
        dislikes: 17,
        reviews: [
          {
            id: '65901d2145c2b626d34b3acb',
            rating: 5,
            commentedBy: '22054339@kiit.ac.in',
            internalScore: 30,
            comments:
              'You will get good internal marks if ur attendance is decent...',
            teacherId: '65900f83e771e0a80148ed4c',
          },
          {
            id: '659022e045c2b626d34b3adf',
            rating: 5,
            commentedBy: 'donkeyking1856@gmail.com',
            internalScore: 26,
            comments: 'just maintain assignments and attendence\n',
            teacherId: '65900f83e771e0a80148ed4c',
          },
          {
            id: '6591327445c2b626d34b3b44',
            rating: 5,
            commentedBy: '22054341@kiit.ac.in',
            internalScore: 29,
            comments: '\n',
            teacherId: '65900f83e771e0a80148ed4c',
          },
          {
            id: '65931e2945c2b626d34b3b64',
            rating: 5,
            commentedBy: '22052219@kiit.ac.in',
            internalScore: -1,
            comments: 'good teacher, gives decent marks',
            teacherId: '65900f83e771e0a80148ed4c',
          },
        ],
        id: '65a6e829307b55dd84067482',
      },
    ];

    // const k = allReview.filter((p))
    // //assign randomly id to each review where commentedby

    // const p = allReview.map((faculty)=>{
    //   if(faculty.reviews.length>0){
    //     const f = faculty.reviews.map((review)=>{
    //       const i = Math.floor(Math.random()*allId.length);
    //       console.log(i);
    //       return{
    //         rating: review.rating,
    //         userId:allId[i],
    //         internalScore: review.internalScore,
    //         comments: review.comments,
    //         facultyId: faculty.id,
    //       }
    //   })

    //   return{
    //    name:faculty.name,
    //    id:faculty.id,
    //    review:f
    //   }
    // }
    // })

    //     Ganga Bishnu Mund

    // Ms. Sricheta Parui
    // Mr. Kamalesh Karmakar
    // Dr. Subhranshu Sekhar Tripathy
    // Dr. Debachudamani Prusti
    // Ms. Uppada Gautami

    const newFac = [
      {
        name: 'Sricheta Parui',
      },
      {
        name: 'Kamalesh Karmakar',
      },
      {
        name: 'Subhranshu Sekhar Tripathy',
      },
      {
        name: 'Debachudamani Prusti',
      },
      {
        name: 'Uppada Gautami',
      },
      {
        name: 'Ganga Bishnu Mund',
      },
    ];

    try {
      // allReview.forEach(async (fac) => {
      //   await this.prisma.facultiesDetails.update({
      //     where: {
      //       id: fac.id,
      //     },
      //     data: {
      //       likesId: this.generateIds('65ec7b99c25f0eb2966fea47', fac.likes),
      //       dislikesId: this.generateIds(
      //         '65ec7b99c25f0eb2966fea47',
      //         fac.dislikes,
      //       ),
      //     },
      //   });
      // });

      // const newProf = rv.map((r)=>{

      //   //replace the titles like Dr. Prof Mr Ms with space

      //   const name = r.name.replace(/Dr. |Prof. |Mr. |Ms. /g, '')
      //   const likes = r.likes.length;
      //   const dislike = r.dislikes.length;

      //   const likesId = this.generateIds('65ec7b99c25f0eb2966fea47', likes);
      //   const dislikesId = this.generateIds('65ec7b99c25f0eb2966fea47', dislike);

      //   return {
      //     name,
      //     likesId,
      //     dislikesId
      //   }
      // })

      // return newProf;

      const newProf = [
        {
          name: 'Arghya Kundu',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Pramod Kumar Das',
          likesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Kalyani Mohanta',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Srikumar Acharya',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Swayam B Mishra',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [],
        },
        {
          name: 'Prasanta Ku. Mohanty',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'S. Chaudhuri',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [],
        },
        {
          name: 'Bikash Kumar Behera',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Basanta Kumar Rana',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Arjun Kumar Paul',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Sunil Kumar Gouda',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Jitendra Ku. Patel',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Biswajit Sahoo',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: ' K. B. Ray',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Manoranjan Sahoo',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'M. M. Acharya',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Avinash Chaudhary',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [],
        },
        {
          name: 'Promod Mallick',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Laxmipriya Nayak',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Nayan Kumar S. Behera',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Arun Kumar Gupta',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'S. K. Badi',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Spandan Guha',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'S. Padhy',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Rakesh Kumar Rai',
          likesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Swarup K. Nayak',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Akshaya Kumar Panda',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Mitali Routaray',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Banishree Misra',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Suvasis Nayak',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Sriparna Roy Ghatak',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Joydeb Pal',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Alivarani Mohapatra',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Ranjeeta Patel',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Manas Ranjan Mohapatra',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Anil Kumar Behera',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'P. Biswal',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Subarna  Bhattacharya',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Sudeshna Datta Chaudhuri',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Ruby Mishra',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Sudipta Kumar Ghosh',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Suman Sarkar',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Arpita Goswami',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Arijit Patra',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Shruti',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'J. R. Panda',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Anil Kumar Swain',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Vishal Pradhan',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Debdulal Ghosh',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Sunil Kr. Mishra',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Swati Swayamsiddha',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Srikanta Behera',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Pragma Kar',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Mamita Dash',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Kartikeswar Mahalik',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'S. K. Mohapatra',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Ananda Meher',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Ganaraj P. S.',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Bapuji Sahoo',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Abhijit Sutradhar',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Rohit Kumar Tiwari',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Satish Kumar Gannamaneni',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Kumar Biswal',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Habibul Islam',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Sarbeswar Mohanty',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Rachita Panda',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [],
        },
        {
          name: 'Amalesh Kumar Manna',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Sushree S. Panda',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Kumar Surjeet Chaudhury',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Seba Mohanty',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Utkal Keshari Dutta',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'Nazia T. Imran',
          likesId: ['65ec7b99c25f0eb2966fea47'],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
        },
        {
          name: 'P. Dutta',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [],
        },
        {
          name: 'Asif Uddin Khan',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'A. Bakshi',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Satya Champati Rai',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Suvendu Barik',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Swapnomayee Palit',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
        {
          name: 'Smrutirekha Mohanty',
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
        },
      ];

      const createNewProf = await this.prisma.facultiesDetails.createMany({
        data: newFac,
      });

      // const facList = await this.prisma.facultiesDetails.findMany({});
      // return rv.reduce((acc, obj) => {
      //     const name = obj.name.replace(/Dr. |Prof. |Mr. |Ms. /g, '')
      //   acc[name] = {
      //     name:name,
      //     reviews:obj.reviews,
      //   };
      //   return acc;
      // }, {});

      const newFilt = {
        'Arghya Kundu': {
          name: 'Arghya Kundu',
          reviews: [
            {
              id: '6590204045c2b626d34b3ad8',
              rating: 1,
              commentedBy: 'imamansinha69@gmail.com',
              internalScore: 28,
              comments: 'Mt lena isko kabhi bhool kr bhi',
              teacherId: '65900f84e771e0a80148ed84',
            },
          ],
        },
        'Pramod Kumar Das': {
          name: 'Pramod Kumar Das',
          reviews: [],
        },
        'Kalyani Mohanta': {
          name: 'Kalyani Mohanta',
          reviews: [],
        },
        'Srikumar Acharya': {
          name: 'Srikumar Acharya',
          reviews: [],
        },
        'Swayam B Mishra': {
          name: 'Swayam B Mishra',
          reviews: [
            {
              id: '6590371445c2b626d34b3b0e',
              rating: 3,
              commentedBy: '2205177@kiit.ac.in',
              internalScore: 26,
              comments:
                'average teacher, just reads out the PPts, roams in the class while doing so',
              teacherId: '65900f85e771e0a80148edc7',
            },
          ],
        },
        'Prasanta Ku. Mohanty': {
          name: 'Prasanta Ku. Mohanty',
          reviews: [
            {
              id: '6591026445c2b626d34b3b3f',
              rating: 5,
              commentedBy: '22051815@kiit.ac.in',
              internalScore: 30,
              comments:
                'Has very good grasp on the subject. Teaches very good. Just pay attention in his class. Maintain healthy attendance and will give very good in internals. Even if attendance is less than 75 still everyone got 25+ in internals.',
              teacherId: '65900f83e771e0a80148ed5a',
            },
            {
              id: '659466b245c2b626d34b3b7b',
              rating: 4,
              commentedBy: '22052198@kiit.ac.in',
              internalScore: 27,
              comments: 'teaches really well',
              teacherId: '65900f83e771e0a80148ed5a',
            },
          ],
        },
        'S. Chaudhuri': {
          name: 'S. Chaudhuri',
          reviews: [],
        },
        'Bikash Kumar Behera': {
          name: 'Bikash Kumar Behera',
          reviews: [],
        },
        'Basanta Kumar Rana': {
          name: 'Basanta Kumar Rana',
          reviews: [],
        },
        'Arjun Kumar Paul': {
          name: 'Arjun Kumar Paul',
          reviews: [
            {
              id: '6590204c45c2b626d34b3ad9',
              rating: 5,
              commentedBy: 'khaitanharsh08@gmail.com',
              internalScore: 30,
              comments:
                "Best teacher, doesn't take full attendance,easy proxy, gives you full marks if you score good marks in central quiz and submit all assignments. Very polite teacker",
              teacherId: '65900f84e771e0a80148ed7b',
            },
          ],
        },
        'Sunil Kumar Gouda': {
          name: 'Sunil Kumar Gouda',
          reviews: [
            {
              id: '65901d2a45c2b626d34b3acc',
              rating: 5,
              commentedBy: '21051394@kiit.ac.in',
              internalScore: 25,
              comments: 'Good teacher and gives good marks.',
              teacherId: '65900f84e771e0a80148ed7d',
            },
          ],
        },
        'Jitendra Ku. Patel': {
          name: 'Jitendra Ku. Patel',
          reviews: [],
        },
        'Biswajit Sahoo': {
          name: 'Biswajit Sahoo',
          reviews: [
            {
              id: '6590430d45c2b626d34b3b19',
              rating: 5,
              commentedBy: '21051974@kiit.ac.in',
              internalScore: 28,
              comments:
                'He is a very good teacher. Maintain give and take relation. If you want to learn just select him',
              teacherId: '65900f83e771e0a80148ed56',
            },
            {
              id: '6590ff0445c2b626d34b3b3e',
              rating: 5,
              commentedBy: '22052843@kiit.ac.in',
              internalScore: 30,
              comments:
                'One of the most chill teacher in KIIT, hamare C lab ke teacher the',
              teacherId: '65900f83e771e0a80148ed56',
            },
          ],
        },
        ' K. B. Ray': {
          name: ' K. B. Ray',
          reviews: [
            {
              id: '65902ea945c2b626d34b3b04',
              rating: 5,
              commentedBy: '2205715@kiit.ac.in',
              internalScore: 29,
              comments: 'Very good teacher',
              teacherId: '65900f84e771e0a80148ed9d',
            },
          ],
        },
        'Manoranjan Sahoo': {
          name: 'Manoranjan Sahoo',
          reviews: [
            {
              id: '6592f5c145c2b626d34b3b5b',
              rating: 4,
              commentedBy: '2205628@kiit.ac.in',
              internalScore: 28,
              comments:
                'Very good teacher, explains well, gives good internals. Only one thing is that never use phone in his class or you are gone!',
              teacherId: '65900f85e771e0a80148edc8',
            },
            {
              id: '6592f5c145c2b626d34b3b5c',
              rating: 4,
              commentedBy: '2205628@kiit.ac.in',
              internalScore: 28,
              comments:
                'Very good teacher, explains well, gives good internals. Only one thing is that never use phone in his class or you are gone!',
              teacherId: '65900f85e771e0a80148edc8',
            },
          ],
        },
        'M. M. Acharya': {
          name: 'M. M. Acharya',
          reviews: [],
        },
        'Avinash Chaudhary': {
          name: 'Avinash Chaudhary',
          reviews: [],
        },
        'Promod Mallick': {
          name: 'Promod Mallick',
          reviews: [],
        },
        'Laxmipriya Nayak': {
          name: 'Laxmipriya Nayak',
          reviews: [
            {
              id: '659026f145c2b626d34b3ae5',
              rating: 5,
              commentedBy: '22051615@kiit.ac.in',
              internalScore: 30,
              comments: 'best',
              teacherId: '65900f85e771e0a80148edb5',
            },
            {
              id: '65904d6745c2b626d34b3b20',
              rating: 5,
              commentedBy: '22054430@kiit.ac.in',
              internalScore: 30,
              comments: 'if we want good mark then select.\n',
              teacherId: '65900f85e771e0a80148edb5',
            },
          ],
        },
        'Nayan Kumar S. Behera': {
          name: 'Nayan Kumar S. Behera',
          reviews: [
            {
              id: '6590362745c2b626d34b3b0d',
              rating: 5,
              commentedBy: 'gupta.ayush.kiit@gmail.com',
              internalScore: 25,
              comments: '28',
              teacherId: '65900f85e771e0a80148edbb',
            },
            {
              id: '6593a79045c2b626d34b3b68',
              rating: 2,
              commentedBy: '22052768@kiit.ac.in',
              internalScore: 23,
              comments:
                "Doesn't teach good, also gave very bad marks in internal to everyone in the class\n",
              teacherId: '65900f85e771e0a80148edbb',
            },
          ],
        },
        'Arun Kumar Gupta': {
          name: 'Arun Kumar Gupta',
          reviews: [
            {
              id: '6590241645c2b626d34b3ae1',
              rating: 5,
              commentedBy: '22051615@kiit.ac.in',
              internalScore: 28,
              comments: 'best faculty',
              teacherId: '65900f82e771e0a80148ed47',
            },
            {
              id: '6590269845c2b626d34b3ae3',
              rating: 4,
              commentedBy: '22052705@kiit.ac.in',
              internalScore: 25,
              comments:
                'Thik thak hi he ...\nAttendance me thoda strict hein sir',
              teacherId: '65900f82e771e0a80148ed47',
            },
            {
              id: '65926c9345c2b626d34b3b54',
              rating: 4,
              commentedBy: '22053675@kiit.ac.in',
              internalScore: 24,
              comments:
                'Internal bahat kam dete hain but mid sem mein thik thak dete hain',
              teacherId: '65900f82e771e0a80148ed47',
            },
            {
              id: '6593069445c2b626d34b3b5d',
              rating: 4,
              commentedBy: '22051204@kiit.ac.in',
              internalScore: 28,
              comments:
                'Bohot achha padhata hai. Internals mein full nehi deta, par bohot lenient checking karta hai.',
              teacherId: '65900f82e771e0a80148ed47',
            },
          ],
        },
        'S. K. Badi': {
          name: 'S. K. Badi',
          reviews: [],
        },
        'Spandan Guha': {
          name: 'Spandan Guha',
          reviews: [],
        },
        'S. Padhy': {
          name: 'S. Padhy',
          reviews: [],
        },
        'Rakesh Kumar Rai': {
          name: 'Rakesh Kumar Rai',
          reviews: [],
        },
        'Swarup K. Nayak': {
          name: 'Swarup K. Nayak',
          reviews: [],
        },
        'Akshaya Kumar Panda': {
          name: 'Akshaya Kumar Panda',
          reviews: [
            {
              id: '65901ff545c2b626d34b3ad6',
              rating: 1,
              commentedBy: 'imamansinha69@gmail.com',
              internalScore: 15,
              comments: 'Number nhi dega',
              teacherId: '65900f84e771e0a80148ed70',
            },
            {
              id: '6591aafe45c2b626d34b3b50',
              rating: 5,
              commentedBy: '2206340@kiit.ac.in',
              internalScore: 25,
              comments:
                'Bhai aankh band kr k paper check kr deta h not in a good sense like tmhare answers shi h to b 0 de dega kyuki vo check hi nhi krta',
              teacherId: '65900f84e771e0a80148ed70',
            },
            {
              id: '6591ab5145c2b626d34b3b51',
              rating: 1,
              commentedBy: '2206340@kiit.ac.in',
              internalScore: 25,
              comments:
                'Bhai aankh band kr k paper check krega not in a good sense. Shi answer pe bhi 0 de dega kyuki vo paper check hi nhi krta',
              teacherId: '65900f84e771e0a80148ed70',
            },
          ],
        },
        'Mitali Routaray': {
          name: 'Mitali Routaray',
          reviews: [],
        },
        'Banishree Misra': {
          name: 'Banishree Misra',
          reviews: [
            {
              id: '6590e3a345c2b626d34b3b39',
              rating: 5,
              commentedBy: '22051322@kiit.ac.in',
              internalScore: 29,
              comments: 'Good',
              teacherId: '65900f84e771e0a80148ed9a',
            },
          ],
        },
        'Suvasis Nayak': {
          name: 'Suvasis Nayak',
          reviews: [],
        },
        'Sriparna Roy Ghatak': {
          name: 'Sriparna Roy Ghatak',
          reviews: [],
        },
        'Joydeb Pal': {
          name: 'Joydeb Pal',
          reviews: [
            {
              id: '65901e1745c2b626d34b3ad2',
              rating: 5,
              commentedBy: '2206107@kiit.ac.in',
              internalScore: 28,
              comments:
                "He is very good and very chill teacher and also teaches very well. He'll try to give as much as possible internals. You can choose him blindly. ",
              teacherId: '65900f82e771e0a80148ed35',
            },
            {
              id: '659033fa45c2b626d34b3b08',
              rating: 4,
              commentedBy: '22052643@kiit.ac.in',
              internalScore: 29,
              comments: 'Great teaching style.',
              teacherId: '65900f82e771e0a80148ed35',
            },
            {
              id: '6590342145c2b626d34b3b09',
              rating: 5,
              commentedBy: '22052643@kiit.ac.in',
              internalScore: 29,
              comments: '.',
              teacherId: '65900f82e771e0a80148ed35',
            },
            {
              id: '6590568845c2b626d34b3b25',
              rating: 3,
              commentedBy: '2105986@kiit.ac.in',
              internalScore: 25,
              comments: 'Average',
              teacherId: '65900f82e771e0a80148ed35',
            },
          ],
        },
        'Alivarani Mohapatra': {
          name: 'Alivarani Mohapatra',
          reviews: [],
        },
        'Ranjeeta Patel': {
          name: 'Ranjeeta Patel',
          reviews: [],
        },
        'Manas Ranjan Mohapatra': {
          name: 'Manas Ranjan Mohapatra',
          reviews: [],
        },
        'Anil Kumar Behera': {
          name: 'Anil Kumar Behera',
          reviews: [
            {
              id: '6590223745c2b626d34b3ade',
              rating: 5,
              commentedBy: 'khaitanharsh08@gmail.com',
              internalScore: 30,
              comments:
                'Will give you andha dun marks on paper and teacher. Very young teacher, toh memes se joke bhi karta hai, aur acha khasa roast karega toh be alert',
              teacherId: '65900f85e771e0a80148edc6',
            },
          ],
        },
        'P. Biswal': {
          name: 'P. Biswal',
          reviews: [
            {
              id: '6590404945c2b626d34b3b17',
              rating: 5,
              commentedBy: '22053994@kiit.ac.in',
              internalScore: 29,
              comments: 'very good',
              teacherId: '65900f84e771e0a80148ed78',
            },
          ],
        },
        'Subarna  Bhattacharya': {
          name: 'Subarna  Bhattacharya',
          reviews: [],
        },
        'Sudeshna Datta Chaudhuri': {
          name: 'Sudeshna Datta Chaudhuri',
          reviews: [],
        },
        'Ruby Mishra': {
          name: 'Ruby Mishra',
          reviews: [],
        },
        'Sudipta Kumar Ghosh': {
          name: 'Sudipta Kumar Ghosh',
          reviews: [
            {
              id: '6594477045c2b626d34b3b78',
              rating: 4,
              commentedBy: '22052832@kiit.ac.in',
              internalScore: 25,
              comments: 'badhiya understanding teacher hai',
              teacherId: '65900f85e771e0a80148edca',
            },
          ],
        },
        'Suman Sarkar': {
          name: 'Suman Sarkar',
          reviews: [
            {
              id: '659029e945c2b626d34b3af3',
              rating: 5,
              commentedBy: '2205629@kiit.ac.in',
              internalScore: 30,
              comments: 'gives excellent marks; teaches pretty well',
              teacherId: '65900f84e771e0a80148ed75',
            },
          ],
        },
        'Arpita Goswami': {
          name: 'Arpita Goswami',
          reviews: [],
        },
        'Arijit Patra': {
          name: 'Arijit Patra',
          reviews: [
            {
              id: '65901bc545c2b626d34b3ac3',
              rating: 5,
              commentedBy: '22052975@kiit.ac.in',
              internalScore: 29,
              comments: 'Best',
              teacherId: '65900f84e771e0a80148ed82',
            },
            {
              id: '6596913f45c2b626d34b3c07',
              rating: 5,
              commentedBy: '22053055@kiit.ac.in',
              internalScore: 28,
              comments:
                "GOD\nHe's man of a kind, jus maintain a decent attendance , play ML in his class or doze off np...marks toh bhhar k denge likh k lelo",
              teacherId: '65900f84e771e0a80148ed82',
            },
          ],
        },
        Shruti: {
          name: 'Shruti',
          reviews: [
            {
              id: '65902c2e45c2b626d34b3b00',
              rating: 1,
              commentedBy: '2205629@kiit.ac.in',
              internalScore: 12,
              comments:
                'neither teaches, nor gives marks -- be it internal or sem exams; highest internal score from our sec was about 27-29/50',
              teacherId: '65900f84e771e0a80148ed8e',
            },
            {
              id: '6593fc3845c2b626d34b3b71',
              rating: 1,
              commentedBy: '22052221@kiit.ac.in',
              internalScore: 32,
              comments: ' ',
              teacherId: '65900f84e771e0a80148ed8e',
            },
          ],
        },
        'J. R. Panda': {
          name: 'J. R. Panda',
          reviews: [],
        },
        'Anil Kumar Swain': {
          name: 'Anil Kumar Swain',
          reviews: [],
        },
        'Vishal Pradhan': {
          name: 'Vishal Pradhan',
          reviews: [
            {
              id: '6590348045c2b626d34b3b0b',
              rating: 4,
              commentedBy: '22052643@kiit.ac.in',
              internalScore: 27,
              comments: 'Great teaching style.\n',
              teacherId: '65900f85e771e0a80148edbf',
            },
            {
              id: '65930cff45c2b626d34b3b62',
              rating: 5,
              commentedBy: '22052042@kiit.ac.in',
              internalScore: 30,
              comments: 'bestttttttt',
              teacherId: '65900f85e771e0a80148edbf',
            },
          ],
        },
        'Debdulal Ghosh': {
          name: 'Debdulal Ghosh',
          reviews: [],
        },
        'Sunil Kr. Mishra': {
          name: 'Sunil Kr. Mishra',
          reviews: [],
        },
        'Swati Swayamsiddha': {
          name: 'Swati Swayamsiddha',
          reviews: [],
        },
        'Srikanta Behera': {
          name: 'Srikanta Behera',
          reviews: [],
        },
        'Pragma Kar': {
          name: 'Pragma Kar',
          reviews: [],
        },
        'Mamita Dash': {
          name: 'Mamita Dash',
          reviews: [
            {
              id: '65902c6645c2b626d34b3b01',
              rating: 4,
              commentedBy: '2205629@kiit.ac.in',
              internalScore: 30,
              comments: 'good teacher',
              teacherId: '65900f85e771e0a80148eda3',
            },
            {
              id: '6590479745c2b626d34b3b1d',
              rating: 5,
              commentedBy: '21051974@kiit.ac.in',
              internalScore: 28,
              comments:
                'strict but provide very good notes. Good teacher . Provide deserving marks ',
              teacherId: '65900f85e771e0a80148eda3',
            },
            {
              id: '6590741745c2b626d34b3b2d',
              rating: 5,
              commentedBy: '21053380@kiit.ac.in',
              internalScore: 30,
              comments: 'Very good teacher',
              teacherId: '65900f85e771e0a80148eda3',
            },
            {
              id: '6592dd6145c2b626d34b3b58',
              rating: 1,
              commentedBy: '22052317@kiit.ac.in',
              internalScore: 22,
              comments: 'Pura PPT class mai likhwati hai ',
              teacherId: '65900f85e771e0a80148eda3',
            },
          ],
        },
        'Kartikeswar Mahalik': {
          name: 'Kartikeswar Mahalik',
          reviews: [],
        },
        'S. K. Mohapatra': {
          name: 'S. K. Mohapatra',
          reviews: [
            {
              id: '6593a89145c2b626d34b3b69',
              rating: 1,
              commentedBy: '22052768@kiit.ac.in',
              internalScore: 22,
              comments: "Doesn't teach anything, bad marksin midsem also",
              teacherId: '65900f86e771e0a80148edd6',
            },
          ],
        },
        'Ananda Meher': {
          name: 'Ananda Meher',
          reviews: [
            {
              id: '65923f6a45c2b626d34b3b53',
              rating: 5,
              commentedBy: '22052653@kiit.ac.in',
              internalScore: 30,
              comments: '\n\n',
              teacherId: '65900f82e771e0a80148ed3a',
            },
          ],
        },
        'Ganaraj P. S.': {
          name: 'Ganaraj P. S.',
          reviews: [],
        },
        'Bapuji Sahoo': {
          name: 'Bapuji Sahoo',
          reviews: [
            {
              id: '65901b0f45c2b626d34b3abf',
              rating: 5,
              commentedBy: '22051077@kiit.ac.in',
              internalScore: 30,
              comments:
                "Major positive points are\nIsn't strict in terms of attendance\nTeaches well\nGives good internals to almost everyone ",
              teacherId: '65900f84e771e0a80148ed76',
            },
            {
              id: '65901df945c2b626d34b3ad1',
              rating: 5,
              commentedBy: '2205954@kiit.ac.in',
              internalScore: 30,
              comments:
                'Best teacher full marks in internals and no issue with attendence everyone got 95%',
              teacherId: '65900f84e771e0a80148ed76',
            },
            {
              id: '659076fd45c2b626d34b3b2f',
              rating: 5,
              commentedBy: '2205046@kiit.ac.in',
              internalScore: 29,
              comments:
                'attendance ko leke koi tension nhi hai, marks bhi bohot achhe dete hain, agar thoda bhi aayega toh achha mil jayega',
              teacherId: '65900f84e771e0a80148ed76',
            },
          ],
        },
        'Abhijit Sutradhar': {
          name: 'Abhijit Sutradhar',
          reviews: [],
        },
        'Rohit Kumar Tiwari': {
          name: 'Rohit Kumar Tiwari',
          reviews: [],
        },
        'Satish Kumar Gannamaneni': {
          name: 'Satish Kumar Gannamaneni',
          reviews: [
            {
              id: '6593a8bf45c2b626d34b3b6a',
              rating: 5,
              commentedBy: '2206338@kiit.ac.in',
              internalScore: 27,
              comments:
                'idk why so many dislikes...but marks acha deta hai...expectation se zyada. Han bas thoda strict hai aur paka ta bhi hai.\n',
              teacherId: '65900f86e771e0a80148ede2',
            },
            {
              id: '6594822645c2b626d34b3b7c',
              rating: 4,
              commentedBy: '2206290@kiit.ac.in',
              internalScore: 27,
              comments:
                'Isko class lo Mt lo frk nhi padhta .. bs end mai exam Dene jitni attendance ho .. internal Chadha deta hai sahi aur checking bhi acchi krta hai. Overall theek hai class etiquettes ke bare mai bohot lecture deta hai',
              teacherId: '65900f86e771e0a80148ede2',
            },
          ],
        },
        'Kumar Biswal': {
          name: 'Kumar Biswal',
          reviews: [],
        },
        'Habibul Islam': {
          name: 'Habibul Islam',
          reviews: [
            {
              id: '65901b3045c2b626d34b3ac1',
              rating: 5,
              commentedBy: 'tpiyush2626@gmail.com',
              internalScore: 30,
              comments: 'excellent',
              teacherId: '65900f82e771e0a80148ed40',
            },
            {
              id: '6590201b45c2b626d34b3ad7',
              rating: 4,
              commentedBy: '2206130@kiit.ac.in',
              internalScore: 30,
              comments: 'Highly recommended ',
              teacherId: '65900f82e771e0a80148ed40',
            },
          ],
        },
        'Sarbeswar Mohanty': {
          name: 'Sarbeswar Mohanty',
          reviews: [],
        },
        'Rachita Panda': {
          name: 'Rachita Panda',
          reviews: [],
        },
        'Amalesh Kumar Manna': {
          name: 'Amalesh Kumar Manna',
          reviews: [],
        },
        'Sushree S. Panda': {
          name: 'Sushree S. Panda',
          reviews: [],
        },
        'Kumar Surjeet Chaudhury': {
          name: 'Kumar Surjeet Chaudhury',
          reviews: [],
        },
        'Seba Mohanty': {
          name: 'Seba Mohanty',
          reviews: [
            {
              id: '65901bf445c2b626d34b3ac4',
              rating: 4,
              commentedBy: '22051843@kiit.ac.in',
              internalScore: 27,
              comments:
                'Internals me sbko 27 k uper di thi. Marks acha hi deti hai.',
              teacherId: '65900f82e771e0a80148ed34',
            },
            {
              id: '6590207545c2b626d34b3adb',
              rating: 5,
              commentedBy: '22053488@kiit.ac.in',
              internalScore: 28,
              comments: 'Good ',
              teacherId: '65900f82e771e0a80148ed34',
            },
            {
              id: '6590289f45c2b626d34b3af0',
              rating: 5,
              commentedBy: '2205629@kiit.ac.in',
              internalScore: 30,
              comments:
                "She's pretty lenient and friendly; marks graciously in both internals as well as mid and end sem exams",
              teacherId: '65900f82e771e0a80148ed34',
            },
            {
              id: '6593a5e645c2b626d34b3b67',
              rating: 5,
              commentedBy: '22052768@kiit.ac.in',
              internalScore: 30,
              comments: 'Gives good marks, also is lenient with attendance',
              teacherId: '65900f82e771e0a80148ed34',
            },
          ],
        },
        'Utkal Keshari Dutta': {
          name: 'Utkal Keshari Dutta',
          reviews: [
            {
              id: '659027e045c2b626d34b3aed',
              rating: 5,
              commentedBy: '21053469@kiit.ac.in',
              internalScore: 29,
              comments: 'Best Teacher, for marks as well as in Teaching. ',
              teacherId: '65900f85e771e0a80148edcd',
            },
            {
              id: '6592ddba45c2b626d34b3b59',
              rating: 5,
              commentedBy: '22052317@kiit.ac.in',
              internalScore: 28,
              comments: 'Marks milta hai bohot\n',
              teacherId: '65900f85e771e0a80148edcd',
            },
            {
              id: '6594103445c2b626d34b3b73',
              rating: 5,
              commentedBy: '22051815@kiit.ac.in',
              internalScore: 30,
              comments:
                'Best Maths Teacher in KIIT!! Very much Student Friendly. Gives good marks in internals to everyone. ',
              teacherId: '65900f85e771e0a80148edcd',
            },
          ],
        },
        'Nazia T. Imran': {
          name: 'Nazia T. Imran',
          reviews: [],
        },
        'P. Dutta': {
          name: 'P. Dutta',
          reviews: [
            {
              id: '6592e44845c2b626d34b3b5a',
              rating: 4,
              commentedBy: '2206348@kiit.ac.in',
              internalScore: 28,
              comments:
                'Gave marks even to students who barely submitted assignments',
              teacherId: '65900f85e771e0a80148eda9',
            },
          ],
        },
        'Asif Uddin Khan': {
          name: 'Asif Uddin Khan',
          reviews: [],
        },
        'A. Bakshi': {
          name: 'A. Bakshi',
          reviews: [],
        },
        'Satya Champati Rai': {
          name: 'Satya Champati Rai',
          reviews: [
            {
              id: '659021a345c2b626d34b3adc',
              rating: 4,
              commentedBy: 'khaitanharsh08@gmail.com',
              internalScore: 23,
              comments:
                'Give internals based on knowledge. I will highly recommend this teacher because teacher is very nice. Even if you get low internals, you will learn something for sure. Very sweet teacher. No partiality.',
              teacherId: '65900f85e771e0a80148eda7',
            },
          ],
        },
        'Suvendu Barik': {
          name: 'Suvendu Barik',
          reviews: [
            {
              id: '6590205445c2b626d34b3ada',
              rating: 3,
              commentedBy: '22053180@kiit.ac.in',
              internalScore: 30,
              comments:
                'Awesome chill teacher.\nGreenest flag ever\nU can trust him blindly ',
              teacherId: '65900f86e771e0a80148eddb',
            },
            {
              id: '6590433345c2b626d34b3b1a',
              rating: 5,
              commentedBy: '22053465@kiit.ac.in',
              internalScore: 30,
              comments: 'Best teacher ever',
              teacherId: '65900f86e771e0a80148eddb',
            },
          ],
        },
        'Swapnomayee Palit': {
          name: 'Swapnomayee Palit',
          reviews: [],
        },
        'Smrutirekha Mohanty': {
          name: 'Smrutirekha Mohanty',
          reviews: [],
        },
      };

      //  const p =  facList.map((obj) => {
      //     const isExist = newFilt[obj.name];
      //     console.log(isExist)
      //     if(isExist!==undefined){

      //       return {
      //         ...obj,
      //         reviews:isExist.reviews
      //       };
      //     }
      //     return null;
      //   });

      //   return p.filter((u)=>u!==null);

      const finalV = [
        {
          id: '664de829e19980085db960a8',
          name: 'Pramod Kumar Das',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960a9',
          name: 'Kalyani Mohanta',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960aa',
          name: 'Srikumar Acharya',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960ab',
          name: 'Swayam B Mishra',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6590371445c2b626d34b3b0e',
              rating: 3,
              commentedBy: '2205177@kiit.ac.in',
              internalScore: 26,
              comments:
                'average teacher, just reads out the PPts, roams in the class while doing so',
              teacherId: '65900f85e771e0a80148edc7',
            },
          ],
        },
        {
          id: '664de829e19980085db960ac',
          name: 'Prasanta Ku. Mohanty',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6591026445c2b626d34b3b3f',
              rating: 5,
              commentedBy: '22051815@kiit.ac.in',
              internalScore: 30,
              comments:
                'Has very good grasp on the subject. Teaches very good. Just pay attention in his class. Maintain healthy attendance and will give very good in internals. Even if attendance is less than 75 still everyone got 25+ in internals.',
              teacherId: '65900f83e771e0a80148ed5a',
            },
            {
              id: '659466b245c2b626d34b3b7b',
              rating: 4,
              commentedBy: '22052198@kiit.ac.in',
              internalScore: 27,
              comments: 'teaches really well',
              teacherId: '65900f83e771e0a80148ed5a',
            },
          ],
        },
        {
          id: '664de829e19980085db960ad',
          name: 'S. Chaudhuri',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960ae',
          name: 'Bikash Kumar Behera',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960af',
          name: 'Basanta Kumar Rana',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960b0',
          name: 'Arjun Kumar Paul',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6590204c45c2b626d34b3ad9',
              rating: 5,
              commentedBy: 'khaitanharsh08@gmail.com',
              internalScore: 30,
              comments:
                "Best teacher, doesn't take full attendance,easy proxy, gives you full marks if you score good marks in central quiz and submit all assignments. Very polite teacker",
              teacherId: '65900f84e771e0a80148ed7b',
            },
          ],
        },
        {
          id: '664de829e19980085db960b1',
          name: 'Sunil Kumar Gouda',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '65901d2a45c2b626d34b3acc',
              rating: 5,
              commentedBy: '21051394@kiit.ac.in',
              internalScore: 25,
              comments: 'Good teacher and gives good marks.',
              teacherId: '65900f84e771e0a80148ed7d',
            },
          ],
        },
        {
          id: '664de829e19980085db960b2',
          name: 'Jitendra Ku. Patel',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960b3',
          name: 'Biswajit Sahoo',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6590430d45c2b626d34b3b19',
              rating: 5,
              commentedBy: '21051974@kiit.ac.in',
              internalScore: 28,
              comments:
                'He is a very good teacher. Maintain give and take relation. If you want to learn just select him',
              teacherId: '65900f83e771e0a80148ed56',
            },
            {
              id: '6590ff0445c2b626d34b3b3e',
              rating: 5,
              commentedBy: '22052843@kiit.ac.in',
              internalScore: 30,
              comments:
                'One of the most chill teacher in KIIT, hamare C lab ke teacher the',
              teacherId: '65900f83e771e0a80148ed56',
            },
          ],
        },
        {
          id: '664de829e19980085db960b4',
          name: ' K. B. Ray',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '65902ea945c2b626d34b3b04',
              rating: 5,
              commentedBy: '2205715@kiit.ac.in',
              internalScore: 29,
              comments: 'Very good teacher',
              teacherId: '65900f84e771e0a80148ed9d',
            },
          ],
        },
        {
          id: '664de829e19980085db960b5',
          name: 'Manoranjan Sahoo',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6592f5c145c2b626d34b3b5b',
              rating: 4,
              commentedBy: '2205628@kiit.ac.in',
              internalScore: 28,
              comments:
                'Very good teacher, explains well, gives good internals. Only one thing is that never use phone in his class or you are gone!',
              teacherId: '65900f85e771e0a80148edc8',
            },
            {
              id: '6592f5c145c2b626d34b3b5c',
              rating: 4,
              commentedBy: '2205628@kiit.ac.in',
              internalScore: 28,
              comments:
                'Very good teacher, explains well, gives good internals. Only one thing is that never use phone in his class or you are gone!',
              teacherId: '65900f85e771e0a80148edc8',
            },
          ],
        },
        {
          id: '664de829e19980085db960b6',
          name: 'M. M. Acharya',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960b7',
          name: 'Avinash Chaudhary',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960b8',
          name: 'Promod Mallick',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960b9',
          name: 'Laxmipriya Nayak',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '659026f145c2b626d34b3ae5',
              rating: 5,
              commentedBy: '22051615@kiit.ac.in',
              internalScore: 30,
              comments: 'best',
              teacherId: '65900f85e771e0a80148edb5',
            },
            {
              id: '65904d6745c2b626d34b3b20',
              rating: 5,
              commentedBy: '22054430@kiit.ac.in',
              internalScore: 30,
              comments: 'if we want good mark then select.\n',
              teacherId: '65900f85e771e0a80148edb5',
            },
          ],
        },
        {
          id: '664de829e19980085db960ba',
          name: 'Nayan Kumar S. Behera',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6590362745c2b626d34b3b0d',
              rating: 5,
              commentedBy: 'gupta.ayush.kiit@gmail.com',
              internalScore: 25,
              comments: '28',
              teacherId: '65900f85e771e0a80148edbb',
            },
            {
              id: '6593a79045c2b626d34b3b68',
              rating: 2,
              commentedBy: '22052768@kiit.ac.in',
              internalScore: 23,
              comments:
                "Doesn't teach good, also gave very bad marks in internal to everyone in the class\n",
              teacherId: '65900f85e771e0a80148edbb',
            },
          ],
        },
        {
          id: '664de829e19980085db960bb',
          name: 'Arun Kumar Gupta',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6590241645c2b626d34b3ae1',
              rating: 5,
              commentedBy: '22051615@kiit.ac.in',
              internalScore: 28,
              comments: 'best faculty',
              teacherId: '65900f82e771e0a80148ed47',
            },
            {
              id: '6590269845c2b626d34b3ae3',
              rating: 4,
              commentedBy: '22052705@kiit.ac.in',
              internalScore: 25,
              comments:
                'Thik thak hi he ...\nAttendance me thoda strict hein sir',
              teacherId: '65900f82e771e0a80148ed47',
            },
            {
              id: '65926c9345c2b626d34b3b54',
              rating: 4,
              commentedBy: '22053675@kiit.ac.in',
              internalScore: 24,
              comments:
                'Internal bahat kam dete hain but mid sem mein thik thak dete hain',
              teacherId: '65900f82e771e0a80148ed47',
            },
            {
              id: '6593069445c2b626d34b3b5d',
              rating: 4,
              commentedBy: '22051204@kiit.ac.in',
              internalScore: 28,
              comments:
                'Bohot achha padhata hai. Internals mein full nehi deta, par bohot lenient checking karta hai.',
              teacherId: '65900f82e771e0a80148ed47',
            },
          ],
        },
        {
          id: '664de829e19980085db960bc',
          name: 'S. K. Badi',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960bd',
          name: 'Spandan Guha',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960be',
          name: 'S. Padhy',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960bf',
          name: 'Rakesh Kumar Rai',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960c0',
          name: 'Swarup K. Nayak',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960c1',
          name: 'Akshaya Kumar Panda',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '65901ff545c2b626d34b3ad6',
              rating: 1,
              commentedBy: 'imamansinha69@gmail.com',
              internalScore: 15,
              comments: 'Number nhi dega',
              teacherId: '65900f84e771e0a80148ed70',
            },
            {
              id: '6591aafe45c2b626d34b3b50',
              rating: 5,
              commentedBy: '2206340@kiit.ac.in',
              internalScore: 25,
              comments:
                'Bhai aankh band kr k paper check kr deta h not in a good sense like tmhare answers shi h to b 0 de dega kyuki vo check hi nhi krta',
              teacherId: '65900f84e771e0a80148ed70',
            },
            {
              id: '6591ab5145c2b626d34b3b51',
              rating: 1,
              commentedBy: '2206340@kiit.ac.in',
              internalScore: 25,
              comments:
                'Bhai aankh band kr k paper check krega not in a good sense. Shi answer pe bhi 0 de dega kyuki vo paper check hi nhi krta',
              teacherId: '65900f84e771e0a80148ed70',
            },
          ],
        },
        {
          id: '664de829e19980085db960c2',
          name: 'Mitali Routaray',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960c3',
          name: 'Banishree Misra',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6590e3a345c2b626d34b3b39',
              rating: 5,
              commentedBy: '22051322@kiit.ac.in',
              internalScore: 29,
              comments: 'Good',
              teacherId: '65900f84e771e0a80148ed9a',
            },
          ],
        },
        {
          id: '664de829e19980085db960c4',
          name: 'Suvasis Nayak',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960c5',
          name: 'Sriparna Roy Ghatak',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960c6',
          name: 'Joydeb Pal',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '65901e1745c2b626d34b3ad2',
              rating: 5,
              commentedBy: '2206107@kiit.ac.in',
              internalScore: 28,
              comments:
                "He is very good and very chill teacher and also teaches very well. He'll try to give as much as possible internals. You can choose him blindly. ",
              teacherId: '65900f82e771e0a80148ed35',
            },
            {
              id: '659033fa45c2b626d34b3b08',
              rating: 4,
              commentedBy: '22052643@kiit.ac.in',
              internalScore: 29,
              comments: 'Great teaching style.',
              teacherId: '65900f82e771e0a80148ed35',
            },
            {
              id: '6590342145c2b626d34b3b09',
              rating: 5,
              commentedBy: '22052643@kiit.ac.in',
              internalScore: 29,
              comments: '.',
              teacherId: '65900f82e771e0a80148ed35',
            },
            {
              id: '6590568845c2b626d34b3b25',
              rating: 3,
              commentedBy: '2105986@kiit.ac.in',
              internalScore: 25,
              comments: 'Average',
              teacherId: '65900f82e771e0a80148ed35',
            },
          ],
        },
        {
          id: '664de829e19980085db960c7',
          name: 'Alivarani Mohapatra',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960c8',
          name: 'Ranjeeta Patel',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960c9',
          name: 'Manas Ranjan Mohapatra',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960ca',
          name: 'Anil Kumar Behera',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6590223745c2b626d34b3ade',
              rating: 5,
              commentedBy: 'khaitanharsh08@gmail.com',
              internalScore: 30,
              comments:
                'Will give you andha dun marks on paper and teacher. Very young teacher, toh memes se joke bhi karta hai, aur acha khasa roast karega toh be alert',
              teacherId: '65900f85e771e0a80148edc6',
            },
          ],
        },
        {
          id: '664de829e19980085db960cb',
          name: 'P. Biswal',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6590404945c2b626d34b3b17',
              rating: 5,
              commentedBy: '22053994@kiit.ac.in',
              internalScore: 29,
              comments: 'very good',
              teacherId: '65900f84e771e0a80148ed78',
            },
          ],
        },
        {
          id: '664de829e19980085db960cc',
          name: 'Subarna  Bhattacharya',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960cd',
          name: 'Sudeshna Datta Chaudhuri',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960ce',
          name: 'Ruby Mishra',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960cf',
          name: 'Sudipta Kumar Ghosh',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6594477045c2b626d34b3b78',
              rating: 4,
              commentedBy: '22052832@kiit.ac.in',
              internalScore: 25,
              comments: 'badhiya understanding teacher hai',
              teacherId: '65900f85e771e0a80148edca',
            },
          ],
        },
        {
          id: '664de829e19980085db960d0',
          name: 'Suman Sarkar',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '659029e945c2b626d34b3af3',
              rating: 5,
              commentedBy: '2205629@kiit.ac.in',
              internalScore: 30,
              comments: 'gives excellent marks; teaches pretty well',
              teacherId: '65900f84e771e0a80148ed75',
            },
          ],
        },
        {
          id: '664de829e19980085db960d1',
          name: 'Arpita Goswami',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960d2',
          name: 'Arijit Patra',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '65901bc545c2b626d34b3ac3',
              rating: 5,
              commentedBy: '22052975@kiit.ac.in',
              internalScore: 29,
              comments: 'Best',
              teacherId: '65900f84e771e0a80148ed82',
            },
            {
              id: '6596913f45c2b626d34b3c07',
              rating: 5,
              commentedBy: '22053055@kiit.ac.in',
              internalScore: 28,
              comments:
                "GOD\nHe's man of a kind, jus maintain a decent attendance , play ML in his class or doze off np...marks toh bhhar k denge likh k lelo",
              teacherId: '65900f84e771e0a80148ed82',
            },
          ],
        },
        {
          id: '664de829e19980085db960d3',
          name: 'Shruti',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '65902c2e45c2b626d34b3b00',
              rating: 1,
              commentedBy: '2205629@kiit.ac.in',
              internalScore: 12,
              comments:
                'neither teaches, nor gives marks -- be it internal or sem exams; highest internal score from our sec was about 27-29/50',
              teacherId: '65900f84e771e0a80148ed8e',
            },
            {
              id: '6593fc3845c2b626d34b3b71',
              rating: 1,
              commentedBy: '22052221@kiit.ac.in',
              internalScore: 32,
              comments: ' ',
              teacherId: '65900f84e771e0a80148ed8e',
            },
          ],
        },
        {
          id: '664de829e19980085db960d4',
          name: 'J. R. Panda',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960d5',
          name: 'Anil Kumar Swain',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960d6',
          name: 'Vishal Pradhan',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6590348045c2b626d34b3b0b',
              rating: 4,
              commentedBy: '22052643@kiit.ac.in',
              internalScore: 27,
              comments: 'Great teaching style.\n',
              teacherId: '65900f85e771e0a80148edbf',
            },
            {
              id: '65930cff45c2b626d34b3b62',
              rating: 5,
              commentedBy: '22052042@kiit.ac.in',
              internalScore: 30,
              comments: 'bestttttttt',
              teacherId: '65900f85e771e0a80148edbf',
            },
          ],
        },
        {
          id: '664de829e19980085db960d7',
          name: 'Debdulal Ghosh',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960d8',
          name: 'Sunil Kr. Mishra',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960d9',
          name: 'Swati Swayamsiddha',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960da',
          name: 'Srikanta Behera',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960db',
          name: 'Pragma Kar',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960dc',
          name: 'Mamita Dash',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '65902c6645c2b626d34b3b01',
              rating: 4,
              commentedBy: '2205629@kiit.ac.in',
              internalScore: 30,
              comments: 'good teacher',
              teacherId: '65900f85e771e0a80148eda3',
            },
            {
              id: '6590479745c2b626d34b3b1d',
              rating: 5,
              commentedBy: '21051974@kiit.ac.in',
              internalScore: 28,
              comments:
                'strict but provide very good notes. Good teacher . Provide deserving marks ',
              teacherId: '65900f85e771e0a80148eda3',
            },
            {
              id: '6590741745c2b626d34b3b2d',
              rating: 5,
              commentedBy: '21053380@kiit.ac.in',
              internalScore: 30,
              comments: 'Very good teacher',
              teacherId: '65900f85e771e0a80148eda3',
            },
            {
              id: '6592dd6145c2b626d34b3b58',
              rating: 1,
              commentedBy: '22052317@kiit.ac.in',
              internalScore: 22,
              comments: 'Pura PPT class mai likhwati hai ',
              teacherId: '65900f85e771e0a80148eda3',
            },
          ],
        },
        {
          id: '664de829e19980085db960dd',
          name: 'Kartikeswar Mahalik',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960de',
          name: 'S. K. Mohapatra',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6593a89145c2b626d34b3b69',
              rating: 1,
              commentedBy: '22052768@kiit.ac.in',
              internalScore: 22,
              comments: "Doesn't teach anything, bad marksin midsem also",
              teacherId: '65900f86e771e0a80148edd6',
            },
          ],
        },
        {
          id: '664de829e19980085db960df',
          name: 'Ananda Meher',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '65923f6a45c2b626d34b3b53',
              rating: 5,
              commentedBy: '22052653@kiit.ac.in',
              internalScore: 30,
              comments: '\n\n',
              teacherId: '65900f82e771e0a80148ed3a',
            },
          ],
        },
        {
          id: '664de829e19980085db960e0',
          name: 'Ganaraj P. S.',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960e1',
          name: 'Bapuji Sahoo',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '65901b0f45c2b626d34b3abf',
              rating: 5,
              commentedBy: '22051077@kiit.ac.in',
              internalScore: 30,
              comments:
                "Major positive points are\nIsn't strict in terms of attendance\nTeaches well\nGives good internals to almost everyone ",
              teacherId: '65900f84e771e0a80148ed76',
            },
            {
              id: '65901df945c2b626d34b3ad1',
              rating: 5,
              commentedBy: '2205954@kiit.ac.in',
              internalScore: 30,
              comments:
                'Best teacher full marks in internals and no issue with attendence everyone got 95%',
              teacherId: '65900f84e771e0a80148ed76',
            },
            {
              id: '659076fd45c2b626d34b3b2f',
              rating: 5,
              commentedBy: '2205046@kiit.ac.in',
              internalScore: 29,
              comments:
                'attendance ko leke koi tension nhi hai, marks bhi bohot achhe dete hain, agar thoda bhi aayega toh achha mil jayega',
              teacherId: '65900f84e771e0a80148ed76',
            },
          ],
        },
        {
          id: '664de829e19980085db960e2',
          name: 'Abhijit Sutradhar',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960e3',
          name: 'Rohit Kumar Tiwari',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960e4',
          name: 'Satish Kumar Gannamaneni',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6593a8bf45c2b626d34b3b6a',
              rating: 5,
              commentedBy: '2206338@kiit.ac.in',
              internalScore: 27,
              comments:
                'idk why so many dislikes...but marks acha deta hai...expectation se zyada. Han bas thoda strict hai aur paka ta bhi hai.\n',
              teacherId: '65900f86e771e0a80148ede2',
            },
            {
              id: '6594822645c2b626d34b3b7c',
              rating: 4,
              commentedBy: '2206290@kiit.ac.in',
              internalScore: 27,
              comments:
                'Isko class lo Mt lo frk nhi padhta .. bs end mai exam Dene jitni attendance ho .. internal Chadha deta hai sahi aur checking bhi acchi krta hai. Overall theek hai class etiquettes ke bare mai bohot lecture deta hai',
              teacherId: '65900f86e771e0a80148ede2',
            },
          ],
        },
        {
          id: '664de829e19980085db960e5',
          name: 'Kumar Biswal',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960e6',
          name: 'Habibul Islam',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '65901b3045c2b626d34b3ac1',
              rating: 5,
              commentedBy: 'tpiyush2626@gmail.com',
              internalScore: 30,
              comments: 'excellent',
              teacherId: '65900f82e771e0a80148ed40',
            },
            {
              id: '6590201b45c2b626d34b3ad7',
              rating: 4,
              commentedBy: '2206130@kiit.ac.in',
              internalScore: 30,
              comments: 'Highly recommended ',
              teacherId: '65900f82e771e0a80148ed40',
            },
          ],
        },
        {
          id: '664de829e19980085db960e7',
          name: 'Sarbeswar Mohanty',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47', '65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960e8',
          name: 'Rachita Panda',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960e9',
          name: 'Amalesh Kumar Manna',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960ea',
          name: 'Sushree S. Panda',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960eb',
          name: 'Kumar Surjeet Chaudhury',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960ec',
          name: 'Seba Mohanty',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '65901bf445c2b626d34b3ac4',
              rating: 4,
              commentedBy: '22051843@kiit.ac.in',
              internalScore: 27,
              comments:
                'Internals me sbko 27 k uper di thi. Marks acha hi deti hai.',
              teacherId: '65900f82e771e0a80148ed34',
            },
            {
              id: '6590207545c2b626d34b3adb',
              rating: 5,
              commentedBy: '22053488@kiit.ac.in',
              internalScore: 28,
              comments: 'Good ',
              teacherId: '65900f82e771e0a80148ed34',
            },
            {
              id: '6590289f45c2b626d34b3af0',
              rating: 5,
              commentedBy: '2205629@kiit.ac.in',
              internalScore: 30,
              comments:
                "She's pretty lenient and friendly; marks graciously in both internals as well as mid and end sem exams",
              teacherId: '65900f82e771e0a80148ed34',
            },
            {
              id: '6593a5e645c2b626d34b3b67',
              rating: 5,
              commentedBy: '22052768@kiit.ac.in',
              internalScore: 30,
              comments: 'Gives good marks, also is lenient with attendance',
              teacherId: '65900f82e771e0a80148ed34',
            },
          ],
        },
        {
          id: '664de829e19980085db960ed',
          name: 'Utkal Keshari Dutta',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '659027e045c2b626d34b3aed',
              rating: 5,
              commentedBy: '21053469@kiit.ac.in',
              internalScore: 29,
              comments: 'Best Teacher, for marks as well as in Teaching. ',
              teacherId: '65900f85e771e0a80148edcd',
            },
            {
              id: '6592ddba45c2b626d34b3b59',
              rating: 5,
              commentedBy: '22052317@kiit.ac.in',
              internalScore: 28,
              comments: 'Marks milta hai bohot\n',
              teacherId: '65900f85e771e0a80148edcd',
            },
            {
              id: '6594103445c2b626d34b3b73',
              rating: 5,
              commentedBy: '22051815@kiit.ac.in',
              internalScore: 30,
              comments:
                'Best Maths Teacher in KIIT!! Very much Student Friendly. Gives good marks in internals to everyone. ',
              teacherId: '65900f85e771e0a80148edcd',
            },
          ],
        },
        {
          id: '664de829e19980085db960ee',
          name: 'Nazia T. Imran',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: ['65ec7b99c25f0eb2966fea47'],
          dislikesId: ['65ec7b99c25f0eb2966fea47'],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960ef',
          name: 'P. Dutta',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6592e44845c2b626d34b3b5a',
              rating: 4,
              commentedBy: '2206348@kiit.ac.in',
              internalScore: 28,
              comments:
                'Gave marks even to students who barely submitted assignments',
              teacherId: '65900f85e771e0a80148eda9',
            },
          ],
        },
        {
          id: '664de829e19980085db960f0',
          name: 'Asif Uddin Khan',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960f1',
          name: 'A. Bakshi',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960f2',
          name: 'Satya Champati Rai',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '659021a345c2b626d34b3adc',
              rating: 4,
              commentedBy: 'khaitanharsh08@gmail.com',
              internalScore: 23,
              comments:
                'Give internals based on knowledge. I will highly recommend this teacher because teacher is very nice. Even if you get low internals, you will learn something for sure. Very sweet teacher. No partiality.',
              teacherId: '65900f85e771e0a80148eda7',
            },
          ],
        },
        {
          id: '664de829e19980085db960f3',
          name: 'Suvendu Barik',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [
            {
              id: '6590205445c2b626d34b3ada',
              rating: 3,
              commentedBy: '22053180@kiit.ac.in',
              internalScore: 30,
              comments:
                'Awesome chill teacher.\nGreenest flag ever\nU can trust him blindly ',
              teacherId: '65900f86e771e0a80148eddb',
            },
            {
              id: '6590433345c2b626d34b3b1a',
              rating: 5,
              commentedBy: '22053465@kiit.ac.in',
              internalScore: 30,
              comments: 'Best teacher ever',
              teacherId: '65900f86e771e0a80148eddb',
            },
          ],
        },
        {
          id: '664de829e19980085db960f4',
          name: 'Swapnomayee Palit',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
        {
          id: '664de829e19980085db960f5',
          name: 'Smrutirekha Mohanty',
          phone: null,
          email: null,
          description: null,
          jobTitle: null,
          moreInfo: null,
          profileUrl: null,
          likesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          dislikesId: [
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
            '65ec7b99c25f0eb2966fea47',
          ],
          semesterSectionId: [],
          subjectId: [],
          createdAt: '2024-05-22T12:42:17.372Z',
          updatedAt: '2024-05-22T12:42:17.372Z',
          reviews: [],
        },
      ];

      // for (var i = 0; i < finalV.length; i++) {

      // const newRv = finalV[i].reviews.map((p) => {
      //   return {
      //     rating: p.rating,
      //     userId: '65ec7b99c25f0eb2966fea47',
      //     internalScore: p.internalScore,
      //     comments: p.comments,
      //     facultyId: finalV[i].id,
      //     // ss:"ss"
      //   };
      // });

      // if (newRv.length > 0) {
      //   // await this.prisma.facultiesDetails.update({
      //   //   where: {
      //   //     id: finalV[1].id,
      //   //   },
      //   //   data: {
      //   //     reviews: {createMany: {data: newRv}},
      //   //   },
      //   // });

      //   await this.prisma.review.createMany({
      //     data: newRv,
      //   });
      // }
      // }

      // const allIds = finalV.map((p)=>p.id)

      // Filter the second array to only include emails that are in the Set
      // return facList.filter(obj => emailSet.has(obj.name));

      // return emailSet;

      // return createNewProf;

      // console.log('success');
      return createNewProf;
    } catch (error) {
      console.log(error);
      throw error;
    }

    // return p.filter((k)=>k!==null);
  }

  generateIds(baseId: string, count: number): string[] {
    return Array(count).fill(baseId);
  }

  async getFacDetails() {
    const allReview = await this.prisma.facultiesDetails.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        subject: {
          select: {
            name: true,
          },
        },
        semesterSection: {
          select: {
            id: true,
            section: true,
            semester: {
              select: {
                number: true,
                branch: true,
              },
            },
          },
        },
        reviews: true,
      },
    });
    return allReview;
  }

  async getFacultiesIdsAndName() {
    try {
      return await this.prisma.facultiesDetails.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy:{
          name:"asc"
        }
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }


  async assignSubjectToFaculty(data: { facultiesId: string[]; subjectId: string }) {
    try {
      const { facultiesId, subjectId } = data;
  
      // Fetch all faculties that match the given IDs
      const allFaculties = await this.prisma.facultiesDetails.findMany({
        where: {
          id: {
            in: facultiesId,
          },
        },
        select: {
          subjectId: true,
          id: true,
          name: true,
        },
      });
  
      console.log(facultiesId, subjectId, allFaculties);
  
      // Helper to chunk the faculties array
      const chunkArray = (array: any[], size: number) =>
        array.reduce((acc, _, i) => (i % size === 0 ? [...acc, array.slice(i, i + size)] : acc), []);
  
      // Process in chunks to avoid overloading the database
      const facultyChunks = chunkArray(allFaculties, 10); // Adjust chunk size as needed
  
      for (const chunk of facultyChunks) {
        const promises = chunk.map(async (d) => {
          const subjectIds = d.subjectId || []; // Ensure subjectId is defined
          console.log(subjectIds, d);
          if (!subjectIds.includes(subjectId)) {
            // Connect the subject to the faculty
            console.log('here');
            await this.prisma.facultiesDetails.update({
              where: {
                id: d.id,
              },
              data: {
                subject: {
                  connect: {
                    id: subjectId,
                  },
                },
              },
            });
          }
        });
  
        // Wait for all updates in this chunk to complete
        await Promise.all(promises);
      }
  
      return true;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        'Error in assigning subject to faculty',
      );
    }
  }
  

  // async assignSubjectToFaculty(data: {
  //   facultiesId: string[];
  //   subjectId: string;
  // }) {
  //   try {
  //     const { facultiesId, subjectId } = data;

  //     const allFaculties = await this.prisma.facultiesDetails.findMany({
  //       where: {
  //         id: {
  //           in: facultiesId,
  //         },
  //       },
  //       select: {
  //         subjectId: true,
  //         id: true,
  //         name: true,
  //       },
  //     });

  //     console.log(facultiesId, subjectId, allFaculties);

  //     const promises = allFaculties.map(async (d) => {
  //       const subjectIds = d.subjectId;
  //       console.log(subjectIds, d);
  //       if (!subjectIds.includes(subjectId)) {
  //         // Connect the subject to the faculty

  //         console.log('here');
  //         await this.prisma.facultiesDetails.update({
  //           where: {
  //             id: d.id,
  //           },
  //           data: {
  //             subject: {
  //               connect: {
  //                 id: subjectId,
  //               },
  //             },
  //           },
  //         });
  //       }
  //     });

  //     await Promise.all(promises);

  //     return true;
  //   } catch (error) {
  //     console.log(error);
  //     throw new InternalServerErrorException(
  //       'Error in assigning subject to faculty',
  //     );
  //   }
  // }

  async disconnectAllSubjectsFromFaculties() {
    try {
      const allFaculties = await this.prisma.facultiesDetails.findMany({
        select: {
          id: true,
          subjectId: true,
        },
      });

      for (const faculty of allFaculties) {
        await this.prisma.facultiesDetails.update({
          where: {
            id: faculty.id,
          },
          data: {
            subject: {
              disconnect: faculty.subjectId.map((subjectId) => ({
                id: subjectId,
              })),
            },
          },
        });
      }

      return true;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error disconnecting all subjects from faculties',
      );
    }
  }

  //disconnect sll sections from faculties
  async disconnectAllSectionsFromFaculties() {
    try {
      const allFaculties = await this.prisma.facultiesDetails.findMany({
        select: {
          id: true,
          semesterSectionId: true,
        },
      });

      for (const faculty of allFaculties) {
        await this.prisma.facultiesDetails.update({
          where: {
            id: faculty.id,
          },

          data: {
            semesterSection: {
              disconnect: faculty.semesterSectionId.map((sectionId) => ({
                id: sectionId,
              })),
            },
          },
        });
      }

      return true;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error disconnecting all sections from faculties',
      );
    }
  }

  async assignSectionToFaculty(data: {
    facultiesId: string[];
    sectionId: string;
  }) {
    try {
      const { facultiesId, sectionId } = data;

      const allFaculties = await this.prisma.facultiesDetails.findMany({
        where: {
          id: {
            in: facultiesId,
          },
        },
        select: {
          semesterSectionId: true,
          id: true,
        },
      });

      console.log(facultiesId, sectionId, allFaculties);

      const promises = allFaculties.map(async (d) => {
        const sectionIds = d.semesterSectionId;
        console.log(sectionIds.includes(sectionId));
        if (!sectionIds.includes(sectionId)) {
          // Connect the subject to the faculty
          console.log('here we go');
          await this.prisma.facultiesDetails.update({
            where: {
              id: d.id,
            },
            data: {
              semesterSection: {
                connect: {
                  id: sectionId,
                },
              },
            },
          });
        }
      });

      await Promise.all(promises);

      return true;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error in assigning subject to faculty',
      );
    }
  }

  async getSectionsBySemesterId(semesterId: string) {
    try {
      return await this.prisma.semesterSections.findMany({
        where: {
          semesterId: semesterId,
        },
        select: {
          id: true,
          section: true,
          semesterId: true,
          faculty: {
            select: {
              name: true,
            },
          },
        },
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getAllBranchInfo() {
    try {
      const branch = await this.prisma.branch.findMany({
        include: {
          semesters: {
            select: {
              number: true,
              id: true,
            },
          },
        },
      });

      return {
        branch,
      };
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }

  // name: string;
  // email: string;
  // moreInfo: string;
  // phone: string;
  // profileUrl: string;
  // updateDetailsLink: string;
  // jobTitle:string;
  // id:string;

  async getFacultiesDetails() {
    try {
      const faculties = await this.prisma.facultiesDetails.findMany({
        include: {
          semesterSection: {
            select: {
              section: true,
            },
          },
          subject: {
            select: {
              name: true,
            },
          },
          reviews: {
            select: {
              id: true,
            },
          },
        },
      });
      return {
        facultiesData: faculties,
        semesterDetails: {
          noOfSections: 1,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getFacultiesDetailsByBranchAndSemester(
    branch: string,
    semester: string,
  ) {
    try {
      const branchId = await this.prisma.branch.findUnique({
        where: {
          name: branch,
        },
      });

      if (!branchId) throw new BadRequestException('Branch not found');
      console.log(branch, semester);
      const semesterId = await this.prisma.semester.findUnique({
        where: {
          number: {
            equals: Number(semester),
          },
          branchId: branchId.id,
        },
      });

      console.log(semesterId);

      if (!semesterId.isFacultyReviewEnabled) {
        throw new ServiceUnavailableException(
          'Faculty Review is not enabled for this semester',
        );
      }

      const facultiesData = await this.prisma.facultiesDetails.findMany({
        where: {
          semesterSection: {
            some: {
              semesterId: semesterId.id,
            },
          },
        },
        include: {
          semesterSection: {
            select: {
              section: true,
              semester: {
                select: {
                  number: true,
                  branch: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },

          subject: {
            select: {
              name: true,
            },
          },
          reviews: {
            select: {
              id: true,
            },
          },
        },
      });

      return {
        facultiesData: facultiesData,
        semesterDetails: {
          noOfSections: semesterId.numberOfSectionForSwapping,
        },
      };
    } catch (error) {
      console.log(error);
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getFacultiesDetailsByBranchAndSemesterTest(
    branch: string,
    semester: string,
  ) {
    try {
      const branchId = await this.prisma.branch.findUnique({
        where: {
          name: branch,
        },
      });

      if (!branchId) throw new BadRequestException('Branch not found');
      console.log(branch, semester);
      const semesterId = await this.prisma.semester.findUnique({
        where: {
          number: {
            equals: Number(semester),
          },
          branchId: branchId.id,
        },
      });

      if (!semesterId.isFacultyReviewEnabled) {
        throw new ServiceUnavailableException(
          'Faculty Review is not enabled for this semester',
        );
      }
      const targetDate = new Date('2024-07-12T00:00:00Z');

      const facultiesData = await this.prisma.facultiesDetails.findMany({
        where: {
          semesterSection: {
            some: {
              semesterId: semesterId.id,
            },
          },
          createdAt: {
            gte: targetDate,
          },
        },
        include: {
          semesterSection: {
            select: {
              section: true,
              semester: {
                select: {
                  number: true,
                  branch: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          subject: {
            select: {
              name: true,
            },
          },
          reviews: {
            select: {
              id: true,
            },
          },
        },
      });

      return {
        facultiesData: facultiesData,
        semesterDetails: {
          noOfSections: semesterId.numberOfSectionForSwapping,
        },
      };
    } catch (error) {
      console.log(error);
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }
  async getFacultiesDetailsById(facultyId: string) {
    try {
      const facultiesData = await this.prisma.facultiesDetails.findUnique({
        where: {
          id: facultyId,
        },
        include: {
          semesterSection: {
            select: {
              section: true,
              semester: {
                select: {
                  number: true,
                  branch: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          subject: {
            select: {
              name: true,
            },
          },
          reviews: {
            select: {
              id: true,
              comments: true,
              rating: true,
              facultyId: true,
              internalScore: true,
            },
          },
        },
      });

      return facultiesData;
    } catch (error) {
      console.log(error, facultyId);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async likeDislikeFaculties(facultyId: string, userId: string, event: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) throw new BadRequestException('User not found');

      const faculty = await this.prisma.facultiesDetails.findUnique({
        where: {
          id: facultyId,
        },
      });

      if (!faculty) throw new BadRequestException('Faculty not found');

      const updateLikesDislikes = await this.prisma.facultiesDetails.update({
        where: {
          id: facultyId,
        },
        data: {
          likesId: {
            set:
              event === 'Like'
                ? [...faculty.likesId, userId]
                : faculty.likesId.filter((id) => id !== userId),
          },
          dislikesId: {
            set:
              event === 'Like'
                ? faculty.dislikesId.filter((id) => id !== userId)
                : [...faculty.dislikesId, userId],
          },
        },
      });

      if (!updateLikesDislikes) {
        throw new InternalServerErrorException('Internal Server Error');
      }
      return true;
    } catch (error) {
      console.log(error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  // rating        Float
  // userId        String           @unique @db.ObjectId
  // user          User             @relation(fields: [userId], references: [id])
  // internalScore Int
  // comments      String
  // facultyId     String           @db.ObjectId
  // faculty       FacultiesDetails @relation(fields: [facultyId], references: [id])
  async addReviewToFaculty(data: {
    rating: number;
    facultyId: string;
    comments: string;
    userId: string;
    internalScore: number;
  }) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: data.userId,
        },
      });

      if (!user) throw new BadRequestException('User not found');

      const faculty = await this.prisma.facultiesDetails.findUnique({
        where: {
          id: data.facultyId,
        },
      });

      if (!faculty) throw new BadRequestException('Faculty not found');

      const review = await this.prisma.review.create({
        data: {
          rating: data.rating,
          userId: data.userId,
          internalScore: data.internalScore,
          comments: data.comments,
          facultyId: data.facultyId,
        },
      });

      if (!review)
        throw new InternalServerErrorException('Internal Server Error');

      return true;
    } catch (error) {
      console.log(error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async udateContact(data: {
    data: {
      email?: string;
      phone?: string;
    };
    id: string;
  }) {
    try {
      const updateFaculties = await this.prisma.facultiesDetails.update({
        where: {
          id: data.id,
        },
        data: {
          ...data.data,
        },
      });

      return true;
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async createFaculty(data: { name: string }) {
    try {
      const fac = await this.prisma.facultiesDetails.create({
        data: {
          name: data.name,
        },
      });

      return fac;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async createManyFaculty() {
    try {
      const fac = [
        'B.V.V. S. Subhramanyam',
        'S Ramavath',
        'Priyanka Panigrahi'
      ];

      const facultyData = fac.map((name) => ({ name }));

      await this.prisma.facultiesDetails.createMany({
        data: facultyData,
      });
    } catch (error) {
      console.error('Error creating faculties:', error);
    }
  }

  async disconnectSectionsFromFaculty(data: {
    facultyId: string;
    sectionId: string;
  }) {
    try {
      const faculty = await this.prisma.facultiesDetails.findUnique({
        where: {
          id: data.facultyId,
        },
      });

      if (!faculty) throw new BadRequestException('Faculty not found');

      const updateFaculty = await this.prisma.facultiesDetails.update({
        where: {
          id: data.facultyId,
        },
        data: {
          semesterSection: {
            disconnect: {
              id: data.sectionId,
            },
          },
        },
      });

      return updateFaculty;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async enableElecFac() {
    const facIds = ['65a6e829307b55dd84067476'];

    try {
      const update = await this.prisma.facultiesDetails.updateMany({
        where: {
          id: {
            in: facIds,
          },
        },
        data: {
          isElective: true,
        },
      });

      return update;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getElectiveFaculties() {
    const subject = [
      'Artificial Intelligence',
      'Machine Learning',
      'HIGH PERFORMANCE COMPUT',
      'Internet Of Things',
      'Data Mining and Data Warehousing',
      'Big Data',
      'Data Science And Analytics',
      'Distributed Operating System',
      'Computational Intelligence',
      'COMPILER DESIGN',
    ];
    try {
      const faculties = await this.prisma.facultiesDetails.findMany({
        where: {
          isElective: true,
          subject: {
            some: {
              name: {
                in: subject,
              },
            },
          },
        },
        select: {
          semesterSection: {
            select: {
              section: true,
              semester: {
                select: {
                  number: true,
                  branch: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          likesId: true,
          dislikesId: true,
          id: true,
          name: true,

          subject: {
            select: {
              name: true,
            },
          },
          reviews: {
            select: {
              id: true,
            },
          },
        },
      });

      console.log(faculties);

      return {
        facultiesData: faculties,
        semesterDetails: {
          noOfSections: 0,
        },
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  // -------------------------------------------
  // //generate reports

  //   constructor(private readonly prismService: PrismaService) {}
    HIGHLY_RECOMMENDED_THRESHOLD = 0.8; // Adjust as needed
    RECOMMENDED_THRESHOLD = 0.6; // Adjust as needed
    AVERAGE_THRESHOLD = 0.4; // Adjust as needed
    MODERATELY_RECOMMENDED_THRESHOLD = 0.2; // Adjust as needed
    MIN_INTERACTIONS_THRESHOLD = 5; // Minimum interactions to consider

  //   //get Teachee By Section

    siteInformation: string = `
    Report generated from KIIT-CONNECT WEBSITE.
    Website: https://www.kiitconnect.com/
    WhatsApp Group: https://chat.whatsapp.com/Bmnw7wm9jUi19HD59bJ8Zn
    Auto Generated by KIIT-CONNECT
  `;
    async generateReport(data:{
      branch:string,
      semester:number,

    }) {

      console.log(data)
      const Teachers =[]
      // const teacherData = await this.prisma.facultiesDetails.findMany({
      //   // where:{
      //   //   semesterSection:{
      //   //     every:{
      //   //       semesterId:"65d20c6248b08e85746da025"
      //   //     }
      //   //   }
      //   // },
      //   include: { reviews: true,semesterSection:true,subject:true,},
      // });

      const branchId = await this.prisma.branch.findUnique({
        where: {
          name: data.branch,
        },
      });

      if (!branchId) throw new BadRequestException('Branch not found');
      const semesterId = await this.prisma.semester.findUnique({
        where: {
          number: {
            equals: data.semester,
          },
          branchId: branchId.id,
        },
      });

      if (!semesterId.isFacultyReviewEnabled) {
        throw new ServiceUnavailableException(
          'Faculty Review is not enabled for this semester',
        );
      }

      const facultiesData = await this.prisma.facultiesDetails.findMany({
        where: {
          semesterSection: {
            some: {
              semesterId: semesterId.id,
            },
          },
        },
        include: {
          semesterSection: {
            select: {
              section: true,
              semester:{
                select:{
                  number:true,
                  branch:{
                    select:{
                      id:true,
                      name:true
                    }
                  }
                }
              }
            },
          },
          subject: {
            select: {
              name: true,
            },
          },
          reviews: {
            select: {
              id: true,
              comments: true,
            },
          },
        },
      });

      const pq = facultiesData.filter((f)=>{
      return f.semesterSection.map((p)=>p.semester.branch.name).includes(data.branch)
      })

      console.log(pq)

      // return pq;

      for (let i = 1; i <= semesterId.numberOfSectionForSwapping; i++) {
        const sec1 = await Promise.all(
          pq.map(async (teacher) => {

            const filtr = teacher.semesterSection.filter((g)=>g.semester.number===data.semester && g.section===i && g.semester.branch.name===data.branch);
            if (filtr.length>0) {

              return {
                //   id: teacher.id,
                name: teacher.name,
                subject: teacher.subject.filter((f)=>{
                  return this.subjectList.includes(f.name)
                }).map((s)=>{

                  return this.reverseSubjectMap(s.name)
                })
                ,
                likes: teacher.likesId.length,
                dislikes: teacher.dislikesId.length,
                reviews: teacher.reviews.map((review) => review.comments),
              };
            }

          }),
        );

        const filteredSec1 = sec1.filter((teacher) => teacher !== undefined);

        Teachers.push({
          section: i,
          data: filteredSec1,
        });
      }

      console.log(Teachers);

      const headers = Object.keys(Teachers[0].data[0]);
      console.log(headers);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Section_1`);

      this.addSiteInformation(worksheet);
      this.addReportGeneratedTime(worksheet);
      this.addCustomMessage(worksheet,"Just Avoid: If anyone found sharing of screenshot then that person id will be banned permanentally from kiit-connect and if anyone report about that person who has shared the screenshot can be rewarded Premium Membership and Some gift.")

      worksheet.addRow(['Color Legend']);
      this.addLegendRow(worksheet, 'Highly Recommended', '00FF00');
      this.addLegendRow(worksheet, 'Recommended', '00FFFF');
      this.addLegendRow(worksheet, 'Medium', 'FFFF00');
      this.addLegendRow(worksheet, 'Try to Avoid', 'FFA500');
      this.addLegendRow(worksheet, 'Avoid(Not Recommended)', 'FF0000');
      worksheet.addRow([]);
      worksheet.addRow(headers);

      worksheet.columns = [
        { header: headers[0], width: 1 / 0.02645833 }, // 15 cm
        { header: headers[1], width: 0.6 / 0.02645833 }, // 10 cm
        { header: headers[2], width: 0.3 / 0.02645833 }, // 10 cm
        { header: headers[3], width: 0.3 / 0.02645833 }, // 10 cm
        { header: headers[4], width: 20 / 0.02645833 }, // 10 cm
        // Add more columns if needed
    ];

      Teachers.forEach((sec) => {
        worksheet.addRow([`Section ${sec.section}`]);
        //   worksheet.addRow([`Section ${sec.section}`]);
        //add some space to row

        sec.data.forEach((row) => {
          const values = headers.map((header) => row[header]);
          const rowRef = worksheet.addRow(values);

          const totalInteractions = row.likes + row.dislikes;

          if (totalInteractions < this.MIN_INTERACTIONS_THRESHOLD) {
            return 0; // Not enough interactions for a reliable recommendation
          }

          // export const applyColorBasedOnRatio = (like: number, dislike: number) => {
          //   const totalInteractions = like + dislike;

          //   if (totalInteractions < MIN_INTERACTIONS_THRESHOLD) {
          //     return {
          //       color: "text-cyan-500",
          //       text: "In Progress",
          //     };
          //     // Not enough interactions for a reliable recommendation
          //   }

          //   const p = like / totalInteractions;
          //   const ratio = Math.round(p * 100) / 100;

          // const rat = row.likes / Math.max(row.dislikes, 1);

          const rat = row.likes / totalInteractions;
                  //   const ratio = Math.round(p * 100) / 100;

          const ratio = Math.round(rat * 100) / 100;
          console.log(ratio);

          // const p = Math.round(ratio * 100) / 100;
          this.applyColorBasedOnRatio(rowRef, ratio);
        });
        worksheet.addRow([null]);
      });

      // Save workbook to a file
      await workbook.xlsx.writeFile(`${data.branch}-${data.semester}.xlsx`);

      return Teachers;
    }

    subjectList =   [
      // "Industry 4.0 Technologies",
      // "Data Structure",
      // "Digital Systems Design",
      // "Automata Theory and Formal Languages",
      // "Scientific and Technical Writing",
      // "DSD Lab",
      // "Data Structure Lab",
      // "Communication Engineering",
      // "COA",
      // "OOP JAVA",
      // "Probability and Statistics",
      // 'CE Lab'

      // "Cloud Computing",
      "Artificial Intelligence",
      "Machine Learning",
      "Software Project Management",
      // "Data Science and Analytics",
      // "Data Analytics Laboratory",

      "CLOUD COMPUTING",

      // "Compilers",

      // "Wireless Mobile Communication",
      // "Block Chain",
      // "Wireless Communication & Networking Lab",

      // "ARM and Advanced Microprocessors",
      // "Data Mining and Data Warehousing",
      // "ARM Laboratory",
      // "Advance Programming Laboratory",
      // "Advance Programming"
      "Artificial Intelligence Laboratory",
      "Applications Development Laboratory",
      "Applications Development"
    ];

    // ['DAA Lab','COMPUTER NETWORKS','SOFTWARE ENGINEERING','Computer Networks Lab','Engineering Economics','DESIGN & ANALYSIS OF ALGO','International Economic Cooperation','Economics Of Development']
    // Electives: any[] = ['ML', 'IOT', 'NLP', 'DA'];

    // async getDataForElective() {
    //   const Elective = [];
    //   const teacherData = await this.prismService.elective.findMany({
    //     include: { reviews: true },
    //   });

    //   for (let i = 0; i < this.Electives.length; i++) {
    //     const sec1 = await Promise.all(
    //       teacherData.map(async (teacher) => {
    //         if (teacher.subject === this.Electives[i]) {
    //           return {
    //             //   id: teacher.id,
    //             name: teacher.name,
    //             subject: teacher.subject,
    //             likes: teacher.likes.length,
    //             dislikes: teacher.dislikes.length,
    //             reviews: teacher.reviews.map((review) => review.comments),
    //           };
    //         }
    //       }),
    //     );

    //     const filteredSec1 = sec1.filter((teacher) => teacher !== undefined);

    //     Elective.push({
    //       subject: this.Electives[i],
    //       data: filteredSec1,
    //     });
    //   }

    //   const headers = Object.keys(Elective[0].data[0]);
    //   console.log(headers);

    //   const workbook = new ExcelJS.Workbook();
    //   const worksheet = workbook.addWorksheet(`Elective_1`);

    //   this.addSiteInformation(worksheet);
    //   this.addReportGeneratedTime(worksheet);

    //   worksheet.addRow(['Color Legend']);
    //   this.addLegendRow(worksheet, 'Highly Recommended', '00FF00');
    //   this.addLegendRow(worksheet, 'Recommended', '00FFFF');
    //   this.addLegendRow(worksheet, 'Average', 'FFFF00');
    //   this.addLegendRow(worksheet, 'Moderately Recommended', 'FFA500');
    //   this.addLegendRow(worksheet, 'Not Recommended', 'FF0000');
    //   worksheet.addRow([]);
    //   worksheet.addRow(headers);

    //   Elective.forEach((sec) => {
    //     worksheet.addRow([`Subject:- ${sec.subject}`]);
    //     //   worksheet.addRow([`Section ${sec.section}`]);
    //     //add some space to row

    //     sec.data.forEach((row) => {
    //       const values = headers.map((header) => row[header]);
    //       const rowRef = worksheet.addRow(values);

    //       const totalInteractions = row.likes + row.dislikes;

    //       if (totalInteractions < this.MIN_INTERACTIONS_THRESHOLD) {
    //         return 0; // Not enough interactions for a reliable recommendation
    //       }

    //       const ratio = row.likes / totalInteractions;
    //       const p = Math.round(ratio * 100) / 100;
    //       this.applyColorBasedOnRatio(rowRef, p);
    //     });
    //     worksheet.addRow([null]);
    //   });

    //   // Save workbook to a file
    //   await workbook.xlsx.writeFile('Electives-Export.xlsx');
    //   console.log(Elective);
    //   return Elective;
    // }

   subjectMap = (subject:string)=>{

      console.log(subject)
     switch(subject){
        case "CN":
          return "COMPUTER NETWORKS"
        case "SE":
          return "SOFTWARE ENGINEERING"
        case "CN Lab":
          return "Computer Networks Lab"
        case "EE":
          return "Engineering Economics"
        case "DAA Lab":
          return "DAA Lab"
        case "DAA":
          return "DESIGN & ANALYSIS OF ALGO"
        case "EOD":
          return "Economics Of Development"
        case "IEC":
          return "International Economic Cooperation"
        case "AI":
          return "Artificial Intelligence"
        case "ML":
          return "Machine Learning"
        case "HPC":
          return "HIGH PERFORMANCE COMPUT"
        case "IoT":
          return "Internet Of Things"
        case "DMDW":
          console.log("here")
          return "Data Mining and Data Warehousing"
        case "BD":
          return "Big Data"
        case "DSA":
          return "Data Science and Analytics"
        case "DOS":
          return "Distributed Operating System"
        case "CI":
          return "Computational Intelligence"
        case "CD":
          return "Compilers"

       case "AD(L)":
        return "Applications Development Laboratory"

        case "AD":
          return "Applications Development"

        case "AI(L)":
          return "Artificial Intelligence Laboratory"

        case "ML(L)":
          return "Machine Learning Laboratory"

        case "SPM":
          return "Software Project Management"

        case "CC":
          return "CLOUD COMPUTING"

        case "CC(L)":
          return "Cloud Computing Lab"

          case "DA(L)":
            return "Data Analytics Laboratory"

            case "AP(L)":
              return "Advance Programming Laboratory"

              case "AP":
                return "Advance Programming"

                case "BC":
                  return "Block Chain"

                  case "WMC":
                    return "Wireless Mobile Communication"

                    case "WCN(L)":
                      return "Wireless Communication & Networking Lab"


                      case "AAM(L)":
                        return "ARM Laboratory"

                        case "AAM":
                          return "ARM and Advanced Microprocessors"



              




        default:
          return subject;
      }

    }

     reverseSubjectMap = (fullSubjectName:string) => {
      console.log(fullSubjectName);
      switch(fullSubjectName){

        case "Probability and Statistics":
          return "PS";
      case "Industry 4.0 Technologies":
          return "IND4";
      case "Data Structure":
          return "DS";
      case "Digital Systems Design":
          return "DSD";
      case "Automata Theory and Formal Languages":
          return "AFL";
      case "Scientific and Technical Writing":
          return "STW";
      case "DSD Lab":
          return "DSD(L)";
      case "Data Structure Lab":
          return "DS(L)";
      case "Communication Engineering":
          return "CE";
      case "COA":
          return "COA";
      case "OOP JAVA":
          return "OOPJ";
      case "CE Lab":
          return "CE(L)";
        case "COMPUTER NETWORKS":
          return "CN";
        case "SOFTWARE ENGINEERING":
          return "SE";
        case "Computer Networks Lab":
          return "CN Lab";
        case "Engineering Economics":
          return "EE";
        case "DAA Lab":
          return "DAA Lab";
        case "DESIGN & ANALYSIS OF ALGO":
          return "DAA";
        case "Economics Of Development":
          return "EOD";
        case "International Economic Cooperation":
          return "IEC";
        case "Artificial Intelligence":
          return "AI";
        case "Machine Learning":
          return "ML";
        case "HIGH PERFORMANCE COMPUT":
          return "HPC";
        case "Internet Of Things":
          return "IoT";
        case "Data Mining and Data Warehousing":
          console.log("here");
          return "DMDW";
        case "Big Data":
          return "BD";
        case "Data Science and Analytics":
          return "DSA";
        case "Distributed Operating System":
          return "DOS";
        case "Computational Intelligence":
          return "CI";
        case "COMPILER DESIGN":
          return "CD";

        case "Applications Development Laboratory":
          return "AD(L)";

        case "Applications Development":
          return "AD";

        case "Artificial Intelligence Laboratory":
          return "AI(L)";

        case "Machine Learning Laboratory":
          return "ML(L)";

        case "Software Project Management":
          return "SPM";

        case "CLOUD COMPUTING":
          return "CC";

        case "Cloud Computing Lab":
          return "CC(L)";

          case "Data Analytics Laboratory":
            return "DA(L)";

            case "Advance Programming Laboratory":
              return "AP(L)";

              case "Advance Programming":
                return "AP";

                case "Block Chain":
                  return "BC";

                  case "Wireless Mobile Communication":
                    return "WMC";

                    case "Wireless Communication & Networking Lab":
                      return "WCN(L)";


                      case "ARM Laboratory":
                        return "AAM(L)";

                        case "ARM and Advanced Microprocessors":
                          return "AAM";




                



        default:
          return fullSubjectName;
      }
    };

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
          size: 13,
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color },
        };
      });
    }

    applyColorBasedOnRatio(rowRef: any, ratio: any) {
      switch (true) {
        case ratio >= this.HIGHLY_RECOMMENDED_THRESHOLD:
          this.applyColor(rowRef, '00FF00'); // Green color
          break;
        case ratio >= this.RECOMMENDED_THRESHOLD &&
          ratio < this.HIGHLY_RECOMMENDED_THRESHOLD:
          this.applyColor(rowRef, '00FFFF'); // Blue color
          break;
        case ratio >= this.AVERAGE_THRESHOLD &&
          ratio < this.RECOMMENDED_THRESHOLD:
          this.applyColor(rowRef, 'FFFF00'); // Yellow color
          break;
        case ratio >= this.MODERATELY_RECOMMENDED_THRESHOLD &&
          ratio < this.AVERAGE_THRESHOLD:
          this.applyColor(rowRef, 'FFA500'); // Orange color
          break;
        case ratio < this.MODERATELY_RECOMMENDED_THRESHOLD:
          this.applyColor(rowRef, 'FF0000'); // Red color
          break;
        default:
          break;

      }
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
    addCustomMessage(worksheet: ExcelJS.Worksheet,message:string) {

      // Style for italicized and gray text
      const timeStyle = {
        font: {
          // italic: true,
          bold:true,
          color: { argb: 'FF0000' }, // red font color
        },
      };

      // Add the report generated time with styles
      worksheet.addRow([message]).getCell(1).style = timeStyle;
      worksheet.addRow([null]); // Add an empty row for separation
    }
  // -------------------------------------------------------



  // --------------------------------------------------------



//   HIGHLY_RECOMMENDED_THRESHOLD = 0.8;
//   RECOMMENDED_THRESHOLD = 0.6;
//   AVERAGE_THRESHOLD = 0.4;
//   MODERATELY_RECOMMENDED_THRESHOLD = 0.2;
//   MIN_INTERACTIONS_THRESHOLD = 5;

//   siteInformation: string = `
//   Report generated from KIIT-CONNECT WEBSITE.
//   Website: https://www.kiitconnect.com/
//   WhatsApp Group: https://chat.whatsapp.com/Bmnw7wm9jUi19HD59bJ8Zn
//   Auto Generated by KIIT-CONNECT
// `;

//   checkSemesterSubjects(semester: number, branch: string, subject: string) {
//     switch (branch) {
//       case 'CSE':
//         switch (semester) {
//           case 1:
//             break;
//           case 2:
//             break;

//           case 3:
//             break;

//           case 4:
//             break;

//           case 5:
//             break;
//           case 6:
//             const subjectList = [
//               'machine learning',
//               'artificial intelligence',
//               'cloud computing',
//               'software project management',
//             ];
//             return subjectList.includes(subject);
//           default:
//             break;
//         }

//         break;

//       case 'CSSE':
//         switch (semester) {
//           case 1:
//             break;

//           case 2:
//             break;

//           case 3:
//             break;

//           case 4:
//             break;

//           case 5:
//             break;
//           case 6:
//             break;

//           default:
//             break;
//         }

//         break;

//       case 'CSCE':
//         switch (semester) {
//           case 1:
//             break;

//           case 2:
//             break;

//           case 3:
//             break;

//           case 4:
//             break;

//           case 5:
//             break;
//           case 6:
//             break;

//           default:
//             break;
//         }

//         break;

//       case 'IT':
//         switch (semester) {
//           case 1:
//             break;

//           case 2:
//             break;

//           case 3:
//             break;

//           case 4:
//             break;

//           case 5:
//             break;
//           case 6:
//             const subjectList = [
//               'machine learning',
//               'cloud computing',
//               'data science and analytics',
//               'software project management',
//             ];

//             return subjectList.includes(subject);

//           default:
//             return false;
//         }
//         break;

//       default:
//         return false;
//     }

//     //   const subjectList = [
//     //     "Industry 4.0 Technologies",
//     //     "Data Structure",
//     //     "Digital Systems Design",
//     //     "Automata Theory and Formal Languages",
//     //     "Scientific and Technical Writing",
//     //     "DSD Lab",
//     //     "Data Structure Lab",
//     //     "Communication Engineering",
//     //     "COA",
//     //     "OOP JAVA",
//     //     "Probability and Statistics",
//     //     'CE Lab'
//     //   ];

//     // }
//   }

//   reverseSubjectMap(fullSubjectName: string): string {
//     const subjectMapping: { [key: string]: string } = {
//       'Cloud Computing': 'Cloud Computing',
//       'Artificial Intelligence': 'Artificial Intelligence',
//       'Machine Learning': 'Machine Learning',
//       'Software Project Management': 'Software Project Management',
//       // Add other mappings here
//     };
//     return subjectMapping[fullSubjectName] || fullSubjectName;
//   }

//   async generateReport(data: { branch: string; semester: number }) {
//     const TeachersBySubject: { [key: string]: any[] } = {};

//     const branchId = await this.prisma.branch.findUnique({
//       where: { name: data.branch },
//     });
//     if (!branchId) throw new BadRequestException('Branch not found');

//     const semester = await this.prisma.semester.findUnique({
//       where: {
//         number: data.semester,
//         branchId: branchId.id,
//       },
//     });
//     if (!semester || !semester.isFacultyReviewEnabled) {
//       throw new ServiceUnavailableException(
//         'Faculty Review is not enabled for this semester',
//       );
//     }

//     const facultiesData = await this.prisma.facultiesDetails.findMany({
//       where: {
//         semesterSection: { some: { semesterId: semester.id } },
//       },
//       include: {
//         subject: { select: { name: true } },
//         reviews: { select: { id: true, comments: true } },
//       },
//     });

//     facultiesData.forEach((faculty) => {
//       faculty.subject.forEach((subject) => {
//         const subjectName = this.reverseSubjectMap(subject.name);

//         if(!this.checkSemesterSubjects(data.semester,data.branch,subjectName.toLowerCase())) return;

//         if (!TeachersBySubject[subjectName]) {
//           TeachersBySubject[subjectName] = [];
//         }


//         TeachersBySubject[subjectName].push({
//           name: faculty.name,
//           likes: faculty.likesId?.length || 0,
//           dislikes: faculty.dislikesId?.length || 0,
//           reviews: faculty.reviews
//             .map((review) => review.comments)
//             .filter(Boolean),
//         });
//       });
//     });

//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet('Faculty Report');

//     this.addSiteInformation(worksheet);
//     this.addReportGeneratedTime(worksheet);
//     this.addLegend(worksheet);

//     Object.keys(TeachersBySubject).forEach((subjectName) => {
//       const subjectRow = worksheet.addRow([`Subject: ${subjectName}`]);
//       this.applyColor(subjectRow, 'ADD8E6'); // Light Blue for subject header

//       worksheet.addRow(['Faculty Name', 'Likes', 'Dislikes', 'Reviews']); // Table header

//       worksheet.columns = [
//         { header: "Faculty Name", width: 1 / 0.02645833 }, // 15 cm
//         { header: "Likes", width: 0.6 / 0.02645833 }, // 10 cm
//         { header: "Dislikes", width: 0.3 / 0.02645833 }, // 10 cm 
//         { header: "Reviews", width: 10 / 0.02645833 }, // 10 cm
//         // { header:"Reviews", width: 0.3 / 0.02645833 }, // 10 cm 
//         // Add more columns if needed
//     ];

//       TeachersBySubject[subjectName].forEach((faculty) => {
//         const row = worksheet.addRow([
//           faculty.name,
//           faculty.likes,
//           faculty.dislikes,
//           faculty.reviews.join('; '),
//         ]);

//         // Calculate and apply color based on the ratio of likes to dislikes
//         // const totalInteractions = faculty.likes + faculty.dislikes;
//         // const ratio =
//         //   totalInteractions >= this.MIN_INTERACTIONS_THRESHOLD
//         //     ? faculty.likes / totalInteractions
//         //     : 0;
//         // this.applyColorBasedOnRatio(row, ratio);



//         // const values = headers.map((header) => row[header]);
//         // const rowRef = worksheet.addRow(values);

//         const totalInteractions = faculty.likes + faculty.dislikes;

//         if (totalInteractions < this.MIN_INTERACTIONS_THRESHOLD) {
//           return 0; // Not enough interactions for a reliable recommendation
//         }


//         // export const applyColorBasedOnRatio = (like: number, dislike: number) => {
//         //   const totalInteractions = like + dislike;
        
//         //   if (totalInteractions < MIN_INTERACTIONS_THRESHOLD) {
//         //     return {
//         //       color: "text-cyan-500",
//         //       text: "In Progress",
//         //     };
//         //     // Not enough interactions for a reliable recommendation
//         //   }
        
//         //   const p = like / totalInteractions;
//         //   const ratio = Math.round(p * 100) / 100;
      

//         // const rat = row.likes / Math.max(row.dislikes, 1);


//         const rat = faculty.likes / totalInteractions;
//                 //   const ratio = Math.round(p * 100) / 100;


//         const ratio = Math.round(rat * 100) / 100;
//         console.log(ratio);
      
//         // const p = Math.round(ratio * 100) / 100;
//         this.applyColorBasedOnRatio(row, ratio);
        

//       });

//       worksheet.addRow([]); // Add spacing between subjects
//     });

//     const filePath = `${data.branch}-${data.semester}-FacultyReport.xlsx`;
//     await workbook.xlsx.writeFile(filePath);

//     return {
//       message: 'Report generated successfully',
//       path: filePath,
//     };
//   }
//   // }



//   addSiteInformation(worksheet: ExcelJS.Worksheet) {
//     const lines = this.siteInformation.split('\n');

//     // Style for bold text
//     const boldStyle = {
//       bold: true,
//     };

//     // Style for hyperlinks
//     const hyperlinkStyle = {
//       font: {
//         color: { argb: '0000FF' }, // Blue font color
//         underline: true,
//       },
//     };

//     // Style for normal text
//     const normalStyle = {};

//     lines.forEach((line) => {
//       const cell = worksheet.addRow([line]).getCell(1);

//       // Apply styles based on content
//       if (line.includes('Website:')) {
//         cell.font = Object.assign({}, boldStyle, hyperlinkStyle);
//       } else if (line.includes('WhatsApp Group:')) {
//         cell.font = Object.assign({}, boldStyle, hyperlinkStyle);
//       } else {
//         cell.font = Object.assign({}, boldStyle, normalStyle);
//       }
//     });

//     // Add an empty row for separation
//     worksheet.addRow([null]);
//   }

//   addReportGeneratedTime(worksheet: ExcelJS.Worksheet) {
//     const now = new Date();
//     const formattedTime = `Report generated on: ${now.toLocaleString()}`;

//     // Style for italicized and gray text
//     const timeStyle = {
//       font: {
//         italic: true,
//         color: { argb: '756562' }, // Gray font color
//       },
//     };

//     // Add the report generated time with styles
//     worksheet.addRow([formattedTime]).getCell(1).style = timeStyle;
//     worksheet.addRow([null]); // Add an empty row for separation
//   }
//   addCustomMessage(worksheet: ExcelJS.Worksheet,message:string) {

//     // Style for italicized and gray text
//     const timeStyle = {
//       font: {
//         // italic: true,
//         bold:true,
//         color: { argb: 'FF0000' }, // red font color
//       },
//     };

//     // Add the report generated time with styles
//     worksheet.addRow([message]).getCell(1).style = timeStyle;
//     worksheet.addRow([null]); // Add an empty row for separation
//   }




  // addSiteInformation(worksheet: ExcelJS.Worksheet) {
  //   const lines = this.siteInformation.split('\n');
  //   lines.forEach((line) => worksheet.addRow([line]));
  //   worksheet.addRow([null]);
  // }

  // addReportGeneratedTime(worksheet: ExcelJS.Worksheet) {
  //   const now = new Date();
  //   worksheet.addRow([`Report generated on: ${now.toLocaleString()}`]);
  //   worksheet.addRow([null]);
  // }




  // addLegend(worksheet: ExcelJS.Worksheet) {
  //   worksheet.addRow(['Legend:']);
  //   this.addLegendRow(worksheet, 'Highly Recommended (≥ 80%)', '00FF00'); // Green
  //   this.addLegendRow(worksheet, 'Recommended (60-79%)', '00FFFF'); // Blue
  //   this.addLegendRow(worksheet, 'Average (40-59%)', 'FFFF00'); // Yellow
  //   this.addLegendRow(worksheet, 'Moderately Recommended (20-39%)', 'FFA500'); // Orange
  //   this.addLegendRow(worksheet, 'Not Recommended (< 20%)', 'FF0000'); // Red
  //   worksheet.addRow([null]);
  // }

  // applyColor(rowRef: ExcelJS.Row, color: string) {
  //   for (let i = 1; i <= rowRef.cellCount; i++) {
  //     rowRef.getCell(i).fill = {
  //       type: 'pattern',
  //       pattern: 'solid',
  //       fgColor: { argb: color },
  //     };
  //   }
  // }

  // applyColor(rowRef: ExcelJS.Row, color: string) {
  //   for (let i = 1; i <= rowRef.cellCount; i++) {
  //     rowRef.getCell(i).fill = {
  //       type: 'pattern',
  //       pattern: 'solid',
  //       fgColor: { argb: color },
  //     };
  //   }
  // }

  // addLegendRow(worksheet: ExcelJS.Worksheet, label: string, color: string) {
  //   const legendRow = worksheet.addRow([label]);
  //   legendRow.eachCell((cell) => {
  //     cell.font = {
  //       // color: { argb: '' },
  //       // White font color

  //       bold: true,
  //       size: 13,
  //     };
  //     cell.fill = {
  //       type: 'pattern',
  //       pattern: 'solid',
  //       fgColor: { argb: color },
  //     };
  //   });
  // }



  // applyColorBasedOnRatio(rowRef: any, ratio: any) {
  //   switch (true) {
  //     case ratio >= this.HIGHLY_RECOMMENDED_THRESHOLD:
  //       this.applyColor(rowRef, '00FF00'); // Green color
  //       break;
  //     case ratio >= this.RECOMMENDED_THRESHOLD &&
  //       ratio < this.HIGHLY_RECOMMENDED_THRESHOLD:
  //       this.applyColor(rowRef, '00FFFF'); // Blue color
  //       break;
  //     case ratio >= this.AVERAGE_THRESHOLD &&
  //       ratio < this.RECOMMENDED_THRESHOLD:
  //       this.applyColor(rowRef, 'FFFF00'); // Yellow color
  //       break;
  //     case ratio >= this.MODERATELY_RECOMMENDED_THRESHOLD &&
  //       ratio < this.AVERAGE_THRESHOLD:
  //       this.applyColor(rowRef, 'FFA500'); // Orange color
  //       break;
  //     case ratio < this.MODERATELY_RECOMMENDED_THRESHOLD:
  //       this.applyColor(rowRef, 'FF0000'); // Red color
  //       break;
  //     default:
  //       break;

  //    // Red color
  //     // case ratio >= 3:
  //     //   // Highly recommended
  //     //    this.applyColor(rowRef, '00FF00'); // Green color
  //     //   break;
  
  //     // case ratio >= 2 && ratio < 3:
  //     //   // Recommended
  //     //       this.applyColor(rowRef, '00FFFF'); // Blue color
  //     //       break;
  //     // case ratio >= 1.6 && ratio < 2:
  //     //   // Average
  //     //        this.applyColor(rowRef, 'FFFF00'); // Yellow color

  //     //        break;
  //     // case ratio >= 1 && ratio < 1.6:
  //     //   // Moderately Recommended
  //     // this.applyColor(rowRef, 'FFA500'); // Orange color
  //     // break;
  //     // case ratio < 1:
  //     //   // Not Recommended
  //     //     this.applyColor(rowRef, 'FF0000'); // Red color
  //     //     break;
  //     // default:
  //     //  break;
  //   }
  // }


  // addLegendRow(worksheet: ExcelJS.Worksheet, label: string, color: string) {
  //   const legendRow = worksheet.addRow([label]);
  //   legendRow.eachCell((cell) => {
  //     cell.font = { bold: true, size: 13 };
  //     cell.fill = {
  //       type: 'pattern',
  //       pattern: 'solid',
  //       fgColor: { argb: color },
  //     };
  //   });
  // }

  // applyColorBasedOnRatio(rowRef: ExcelJS.Row, ratio: number) {
  //   switch (true) {
  //     case ratio >= this.HIGHLY_RECOMMENDED_THRESHOLD:
  //       this.applyColor(rowRef, '00FF00'); // Green
  //       break;
  //     case ratio >= this.RECOMMENDED_THRESHOLD:
  //       this.applyColor(rowRef, '00FFFF'); // Blue
  //       break;
  //     case ratio >= this.AVERAGE_THRESHOLD:
  //       this.applyColor(rowRef, 'FFFF00'); // Yellow
  //       break;
  //     case ratio >= this.MODERATELY_RECOMMENDED_THRESHOLD:
  //       this.applyColor(rowRef, 'FFA500'); // Orange
  //       break;
  //     case ratio < this.MODERATELY_RECOMMENDED_THRESHOLD:
  //       this.applyColor(rowRef, 'FF0000'); // Red
  //       break;
  //     default:
  //       break;
  //   }
  // }

  //

  //   subjects = {
  //     0: 'CSE',
  //     1: 'DSS',
  //     2: 'OOPJ',
  //     3: 'DBMS',
  //     4: 'OS',
  //     5: 'COA',
  //     6: 'STW',
  //     7: 'OS(L)',
  //     8: 'OPPJ(L)',
  //     9: 'DBMS(L)',
  //     10: 'VT(L)',
  //   };

  //   AllFaculty: {} = {};

  //   idp = 0;

  //   //async fetch all data from xls file
  //   async fetchAllDataFromXls() {
  //     // const workbook = new ExcelJS.Workbook();

  //     const filepath = path.join(process.cwd(), 'forthsem.xlsx');
  //     const workbook = await xlsx.readFile(filepath);

  //     //  const workbook = xlsx.readFile('./Quiz_Question.xlsx');  // Step 2
  //     let workbook_sheet = workbook.SheetNames;
  //     let workbook_response = xlsx.utils.sheet_to_json(
  //       // Step 4
  //       workbook.Sheets[workbook_sheet[0]],
  //     );

  //     const first = workbook_response[2];
  //     const headers = workbook_response[1];
  //     console.log(headers, first);

  //     workbook_response.forEach(async (element, index) => {
  //       if (index === 0 || index === 1) return;
  //       Object.keys(element).forEach((key, idx) => {
  //         if (idx === 0) return;

  //         if (element[key].includes('New Faculty')) {
  //           return;
  //         }

  //         if (this.AllFaculty[element[key]]) {
  //           if (
  //             !this.AllFaculty[element[key]].subjects.includes(this.subjects[idx])
  //           ) {
  //             this.AllFaculty[element[key]].subjects.push(this.subjects[idx]);
  //           }
  //           if (!this.AllFaculty[element[key]].sections.includes(index - 1)) {
  //             this.AllFaculty[element[key]].sections.push(index - 1);
  //           }
  //         } else {
  //           this.AllFaculty[element[key]] = {
  //             name: element[key],
  //             subjects: [this.subjects[idx]],
  //             sections: [index - 1],
  //           };
  //         }
  //       });
  //     });

  //     // workbook_response.forEach(async (element) => {
  //     //  console.log(element)

  //     //   });
  //     // console.log(addData);

  //     // console.log(workbook_response);

  //     return this.AllFaculty;
  //   }

  async increaseDecreaseLikes(data: { facultyId: string; event: string }) {
    try {
      const faculty = await this.prisma.facultiesDetails.findUnique({
        where: {
          id: data.facultyId,
        },
      });

      if (!faculty) throw new BadRequestException('Faculty not found');

      const ids = [
        '65ec7b99c25f0eb2966fea47',
        '65ec7b99c25f0eb2966fea47',
        '65ec7b99c25f0eb2966fea47',
        '65ec7b99c25f0eb2966fea47',
        '65ec7b99c25f0eb2966fea47',
      ];
      const dataClause =
        data.event === 'Like'
          ? {
              likesId: {
                set: [...faculty.likesId, ...ids],
              },
            }
          : {
              dislikesId: {
                set: [...faculty.dislikesId, ...ids],
              },
            };

      const updateLikesDislikes = await this.prisma.facultiesDetails.update({
        where: {
          id: data.facultyId,
        },
        data: dataClause,
      });

      return true;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getAllPremiumMembers() {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          isPremium: true,
          email: {
            startsWith: '24',
          },
        },
      });

      return {
        length: users.length,
        // users:users
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async countNoOfPremiumUsers() {
    try {
      // Get today's date and set the time to the start of the day
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const yeaterdayStart = new Date();
      yeaterdayStart.setDate(yeaterdayStart.getDate() - 1);

      console.log(todayStart,yeaterdayStart)
        
      const users = await this.prisma.user.findMany({
        where: {
          isPremium: true,
          email:{
            startsWith:"24"
          }
          // updatedAt: {
          //   gte: todayStart,
          // },
        },
      });
  
      return {
        length: users.length,
        users,
      };
    } catch (error) {
      console.error('Error counting premium users:', error.message, error.stack);
      throw new InternalServerErrorException('Unable to count premium users.');
    }
  }
  
}
