import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class MyperfecticeService {
  constructor(private readonly prisma: PrismaService) {}


  async createCourse(){
    try {
        const course = await this.prisma.courses.create({
            data:{
                name:"Cognite Game v4.5",
            
            }
        });
        return course;
    } catch (error) {
        console.log(error);
        throw new InternalServerErrorException("Error in creating course");
    }
  }

  async createTopic() {
    const data = [
      "[Beginner] Verbal - Articles - Let's Learn",
      '[Beginner] Verbal - Articles - Practice Test',
      "[Beginner] Reasoning - Syllogism - Let's Learn",
      '[Beginner] Reasoning - Syllogism - Practice Test',
      "[Beginner] Quant - Percentage - Let's Learn",
      '[Beginner] Quant - Percentage - Practice Test',
      'CheckPoint-1 [Beginner] Quant, Verbal, Reasoning - Percentage, Syllogism, Articles - Mock Test',
      "[Beginner] Reasoning - Logical Venn Diagram - Let's Learn",
      '[Beginner] Reasoning - Logical Venn Diagram - Practice Test',
      "[Beginner] Quant - Simple & Compound Interest - Let's Learn",
      '[Beginner] Quant - Simple & Compound Interest - Practice Test',
      'Checkpoint-2 [Beginner] Quant, Reasoning - SI & CI, Venn Diagram - Mock Test',
      "[Beginner] Verbal - Noun - Let's Learn",
      '[Beginner] Verbal - Noun - Practice Test',
      "[Beginner] Reasoning - Direction Sense Test - Let's Learn",
      '[Beginner] Reasoning - Direction Sense Test - Practice Test',
      'Checkpoint -3 [Beginner] Verbal, Reasoning - Noun, Direction Sense Test - Mock',
      "[Beginner] Reasoning - Alpha-Numeric-Symbol - Let's Learn",
      '[Beginner] Reasoning - Alpha-Numeric-Symbol - Practice Test',
      "[Beginner] Quant - Profit & Loss - Let's Learn",
      '[Beginner] Quant - Profit & Loss - Practice Test',
      'Checkpoint - 4 [Beginner] Quant, Reasoning - Profit & Loss, Alpha-Numeric-Symbol - Mock Test',
      "[Beginner] Verbal - Pronouns - Let's Learn",
      '[Beginner] Verbal - Pronouns - Practice Test',
      "[Beginner] Reasoning - Sequence - Let's Learn",
      '[Beginner] Reasoning - Sequence - Practice Test',
      "[Beginner] Quant - Ratio & Proportion - Let's Learn",
      '[Beginner] Quant - Ratio & Proportion - Practice Test',
      'Checkpoint - 5 [Beginner] Quant, Verbal, Reasoning - Ratio & Proportion, Pronouns',
      "[Beginner] Verbal - Prepositions - Let's Learn",
      '[Beginner] Verbal - Prepositions - Practice Test',
      "[Beginner] Reasoning - Word Formation - Let's Learn",
      '[Beginner] Reasoning - Word Formation - Practice Test',
      'Checkpoint - 6 [Beginner] Verbal, Reasoning - Prepositions, Word Formation - Mock Test',
      "[Beginner] Reasoning - Coding-Decoding - Let's Learn",
      '[Beginner] Reasoning - Coding-Decoding - Practice Test',
      "[Beginner] Quant - Average & Ages - Let's Learn",
      '[Beginner] Quant - Average & Ages - Practice Test',
      'Checkpoint - 7 [Beginner] Quant, Reasoning - Average, Coding-Decoding - Mock',
      "[Beginner] Verbal - Synonyms - Let's Learn",
      '[Beginner] Verbal - Synonyms - Practice Test',
      "[Beginner] Reasoning - Odd One Out - Let's Learn",
      '[Beginner] Reasoning - Odd One Out - Practice Test',
      "[Beginner] Quant - Time, Speed & Distance - Let's Learn",
      '[Beginner] Quant - Time, Speed & Distance - Practice Test',
      'Checkpoint - 8 [Beginner] Quant, Verbal, Reasoning - Speed & Distance, Synonyms, Odd One Out - Mock Test',
      "[Beginner] Verbal - Antonyms - Let's Learn",
      '[Beginner] Verbal - Antonyms - Practice Test',
      "[Beginner] Reasoning - Analogy - Let's Learn",
      '[Beginner] Reasoning - Analogy - Practice Test',
      'Checkpoint - 9 [Beginner] Verbal, Reasoning - Antonyms, Analogy - Mock Test',
      "[Beginner] Reasoning - Blood Relations - Let's Learn",
      '[Beginner] Reasoning - Blood Relations - Practice Test',
      "[Beginner] Quant - Algebra - Let's Learn",
      '[Beginner] Quant - Algebra - Practice Test',
      'Checkpoint - 10 [Beginner] Quant, Reasoning - Algebra, Blood Relations - Mock Test',
    ];

    try {
      const topic = await this.prisma.topic.createMany({
        data: data.map((name) => ({
          name: name,
          courseId:"66344dd5b284d1fecec4bdb8"
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
      return await this.prisma.topic.findMany();
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
        select:{
            name:true,
            id:true,
            courseId:true

           
        }
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error in fetching topics');
    }
  }


  async getQuestionsByTopicId(id: string) {
    try {
        console.log(id)
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


