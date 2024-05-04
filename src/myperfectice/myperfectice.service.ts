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
    const data   = [
        "[Elementary] Verbal - One Word Substitution - Let's Learn",
        "[Elementary] Verbal - One Word Substitution - Practice Test",
        "[Elementary] Quant - Number System 2 - Let's Learn",
        "[Elementary] Quant - Number System 2 - Practice Test",
        "Checkpoint - 8 [Elementary] Quant, Verbal - Number System, One Word Substitution - Mock Test",
        "[Elementary] Reasoning - Seating Arrangement - Let's Learn",
        "[Elementary] Reasoning - Seating Arrangement - Practice Test",
        "[Elementary] Quant - Number System 3 - Let's Learn",
        "[Elementary] Quant - Number System 3 - Practice Test",
        "Checkpoint - 9 [Elementary] Quant, Reasoning - Number System, Seating Arrangement",
        "[Elementary] Verbal - Subject-Verb Agreement - Let's Learn",
        "[Elementary] Verbal - Subject-Verb Agreement - Practice Test",
        "[Elementary] Reasoning - Blood Relations - Let's Learn",
        "[Elementary] Reasoning - Blood Relations - Practice Test",
        "[Elementary] Quant - Time, Speed & Distance - Let's Learn",
        "[Elementary] Quant - Time, Speed & Distance - Practice Test",
        "Checkpoint - 10 [Elementary] Quant, Verbal, Reasoning - Speed, Subject-Verb Agreement, Blood",
        "[Elementary] Verbal - Adjectives & Adverbs - Let's Learn",
        "[Elementary] Verbal - Adjectives & Adverbs - Practice Test",
        "[Elementary] Reasoning - Venn Diagram - Let's Learn",
        "[Elementary] Reasoning - Venn Diagram - Practice Test",
        "[Elementary] Quant - Time, Work & Wages - Let's Learn",
        "[Elementary] Quant - Time, Work & Wages - Practice Test",
        "Checkpoint - 11 [Elementary] Quant, Verbal, Reasoning - Work & Wages, Adjectives & Adverbs,",
        "[Elementary] Verbal - Prepositions - Let's Learn",
        "[Elementary] Verbal - Prepositions - Practice Test",
        "[Elementary] Reasoning - Syllogism - Let's Learn",
        "[Elementary] Reasoning - Syllogism - Practice Test",
        "[Elementary] Quant - Permutation & Combination - Let's Learn",
        "[Elementary] Quant - Permutation & Combination - Practice Test",
        "Checkpoint - 12 [Elementary] Quant, Verbal, Reasoning - Permutation, Prepositions, Syllogism -",
        "[Elementary] Verbal - Reading Comprehensions - Let's Learn",
        "[Elementary] Verbal - Reading Comprehensions - Practice Test",
        "[Elementary] Reasoning - Direction Sense - Let's Learn",
        "[Elementary] Reasoning - Direction Sense - Practice Test",
        "[Elementary] Quant - Probability - Let's Learn",
        "[Elementary] Quant - Probability - Practice Test",
        "Checkpoint - 13 [Elementary] Quant, Verbal, Reasoning - Probability, Reading Comprehensions,"
    ]
    
    

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
      return await this.prisma.topic.findMany({
        select:{
            id:true,
            name:true
        }
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


