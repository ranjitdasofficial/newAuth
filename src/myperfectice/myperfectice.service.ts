import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class MyperfecticeService {
  constructor(private readonly prisma: PrismaService) {}

  async createCourse() {
    try {
      const course = await this.prisma.courses.create({
        data: {
          name: 'CODE MASTER v2.0',
          containsCode: true,
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
      
        "N2N-L4-Array-Set1",
        "N2N-L4-Array-Set2",
        "N2N-L4-Array-Set3",
        "N2N-L4-Array-Set4",
        "N2N-L4-Array-Set5",
        "N2N-L4-Array-Set6",
        "N2N-L4-Array-Set7",
        "N2N-L4-Array-Set8",
        "N2N-L4-Array-Set9",
        "N2N-L4-Array-Set10",
        "N2N-L4-Array-Set11",
        "N2N-L4-Array-Set12",
        "N2N-L4-Array-Set13",
        "N2N-L4-Array-Set14",
        "N2N-L4-Array-Set15",
        "N2N-L4-Array-Set16",
        "N2N-L4-Array-Set17",
        "N2N-L4-Array-Set18",
        "N2N-L4-Array-Set19",
        "N2N-L4-Array-Set20",
        "N2N-L4-Array-Set21",
        "N2N-L4-Array-Set22",
        "N2N-L4-Array-Set23",
        "N2N-L4-Array-Set24",
        "N2N-L4-Array-Set25",
        "N2N-L4-Array-Set26",
        "N2N-L4-Array-Set27",
        "N2N-L4-Array-Set28",
        "N2N-L4-Bit Manipulation-Set 1",
        "N2N-L4-Bit Manipulation-Set 2",
        "N2N-L4-Bit Manipulation-Set 3",
        "N2N-L4-Bit Manipulation-Set 4",
        "N2N-L4-Bit Manipulation-Set 5",
        "N2N-L4-Bit Manipulation-Set 6",
        "N2N-L4-Bit Manipulation-Set 7",
        "N2N-L4-Bit Manipulation-Set 8",
        "N2N-L4-Bit Manipulation-Set 9",
        "N2N-L4-Divide & Conquer-Set 1",
        "N2N-L4-Divide & Conquer-Set 2",
        "N2N-L4-Divide & Conquer-Set 3",
        "N2N-L4-Divide & Conquer-Set 4",
        "N2N-L4-Divide & Conquer-Set 5",
        "N2N-L4-Binary Search Tree-Set 1",
  "N2N-L4-Binary Search Tree-Set 2",
  "N2N-L4-Binary Search Tree-Set 3",
  "N2N-L4-Binary Search Tree-Set 4",
  "N2N-L4-Binary Search Tree-Set 5",
  "N2N-L4-Binary Search Tree-Set 6",
  "N2N-L4-Dynamic Programming-Set 1",
  "N2N-L4-Dynamic Programming-Set 2",
  "N2N-L4-Dynamic Programming-Set 3",
  "N2N-L4-Dynamic Programming-Set 4",
  "N2N-L4-Dynamic Programming-Set 5",
  "N2N-L4-Dynamic Programming-Set 6",
  "N2N-L4-Dynamic Programming-Set 7",
  "N2N-L4-Dynamic Programming-Set 8",
  "N2N-L4-Dynamic Programming-Set 9",
  "N2N-L4-Dynamic Programming-Set 10",
  "N2N-L4-Dynamic Programming-Set 11",
  "N2N-L4-Heap-Set1",
  "N2N-L4-Graph-Set1",
  "N2N-L4-Backtracking-Set1",
  "N2N-L4-Greedy",
  "N2N-L4-Linked List-Set1",
  "N2N-L4-Stack-Set1",
            
    ];

    try {
      const topic = await this.prisma.topic.createMany({
        data: data.map((name) => ({
          name: name,
          courseId: '681d84d0d4e9e84155e8061e',
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

  async createQuestionForCode(
    questions: {
      question: string;
      answer: string;
      code:string;
      input:string;
      output:string;
      explanation:string;
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
            code:q.code,
            answer: "NA",
            input:q.input,
            output:q.output,
            explanation:q.explanation,
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
