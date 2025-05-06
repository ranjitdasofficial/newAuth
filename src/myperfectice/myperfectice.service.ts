import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class MyperfecticeService {
  constructor(private readonly prisma: PrismaService) {}

  async createCourse() {
    try {
      const course = await this.prisma.courses.create({
        data: {
          name: 'PlaceMe CSE/MCS/Msc',
        },
      });
      return course;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error in creating course');
    }
  }

  async deleteCourse(id: string) {
    try {
      const course = await this.prisma.courses.delete({
        where: {
          id: id,
        },
      });
      return course;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error in deleting course');
    }
  }

  async createTopic() {
    const data = [
      "Practice 01 of 24 ( Data Structure )",
      "Practice 02 of 24 ( Data Structure )",
      "Practice 03 of 24 ( Data Structure )",
      "Mock 01 of 24 ( Data Structure )",
      
      "Practice 04 of 24 ( Algorithm )",
      "Practice 05 of 24 ( Algorithm )",
      "Practice 06 of 24 ( Algorithm )",
      "Mock 02 of 24 ( Algorithm )",
      
      "Practice 07 of 24 ( DBMS )",
      "Practice 08 of 24 ( DBMS )",
      "Practice 09 of 24 ( DBMS )",
      "Mock 03 of 24 ( DBMS )",
      
      "Practice 10 of 24 ( Operating System )",
      "Practice 11 of 24 ( Operating System )",
      "Practice 12 of 24 ( Operating System )",
      "Mock 04 of 24 ( Operating System )",
      
      "Practice 13 of 24 ( Computer Network )",
      "Practice 14 of 24 ( Computer Network )",
      "Practice 15 of 24 ( Computer Network )",
      "Mock 05 of 24 ( Computer Network )",
      
      "Practice 16 of 24 ( TOC )",
      "Practice 17 of 24 ( TOC )",
      "Practice 18 of 24 ( TOC )",
      "Mock 06 of 24 ( TOC )",
      
      "Practice 19 of 24 ( Linux )",
      "Practice 20 of 24 ( Linux )",
      "Practice 21 of 24 ( Linux )",
      "Mock 07 of 24 ( Linux )",
      
      "Practice 22 of 24 ( Compiler Design )",
      "Practice 23 of 24 ( Compiler Design )",
      "Practice 24 of 24 ( Compiler Design )",
      "Mock 08 of 24 ( Compiler Design )"
    ];

    try {
      const topic = await this.prisma.topic.createMany({
        data: data.map((name) => ({
          name: name,
          courseId: '6819ab8f5fb8df7cc46cb222',
        })),
      });

      return topic;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error in creating topic');
    }
  }

  async getCourses() {
    try {
      return await this.prisma.courses.findMany();
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error in fetching courses');
    }
  }

  async getTopics() {
    try {
      return await this.prisma.topic.findMany({
        select: {
          id: true,
          name: true,
        },
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error in fetching topics');
    }
  }

  async getTopicsByCourseId(id: string) {
    try {
      return await this.prisma.topic.findMany({
        where: {
          courseId: id,
          
        },
        orderBy:{id:'asc'},
        select: {
          name: true,
          id: true,
          courseId: true,
        },
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error in fetching topics');
    }
  }

  async getQuestionsByTopicId(id: string) {
    try {
      console.log(id);
      return await this.prisma.topic.findUnique({
        where: {
          id: id,
        },
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error in fetching questions');
    }
  }

  async createQuestion(
    questions: {
      question: string;
      answer: string;
    }[],
    id: string,
  ) {
    try {
      const question = await this.prisma.topic.update({
        where: {
          id: id,
        },

        data: {
          Questions: questions.map((q) => ({
            question: q.question,
            answer: q.answer,
          })),
        },
      });

      if (!question) {
        throw new InternalServerErrorException('Topic not found');
      }

      return question;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error in creating question');
    }
  }
}
