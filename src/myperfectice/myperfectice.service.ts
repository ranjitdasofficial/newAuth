import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class MyperfecticeService {
  constructor(private readonly prisma: PrismaService) {}

  async createCourse() {
    try {
      const course = await this.prisma.courses.create({
        data: {
          name: 'Cognite Game v4.5',
        },
      });
      return course;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error in creating course');
    }
  }

  async createTopic() {
    const data = [
      "[Advance] Verbal - Pronouns - Let's Learn",
      '[Advance] Verbal - Pronouns - Practice Test',
      "[Advance] Reasoning - Sequence - Let's Learn",
      '[Advance] Reasoning - Sequence - Practice Test',
      "[Advance] Quant - Percentage - Let's Learn",
      '[Advance] Quant - Percentage - Practice Test',
      'Checkpoint - 1 [Advance] Quant, Verbal, Reasoning - Percentage, Pronouns',
      "[Advance] Verbal - Subject-Verb Agreement - Let's Learn",
      '[Advance] Verbal - Subject-Verb-Agreement - Practice Test',
      "[Advance] Quant - Simple & Compound Interest - Let's Learn",
      '[Advance] Quant - Simple & Compound Interest - Practice Test',
      'Checkpoint - 2 [Advance] Quant, Verbal - SI & CI, Subject-Verb Agreement - Mock',
      "[Advance] Verbal - Synonyms & Antonyms - Let's Learn",
      '[Advance] Verbal - Synonyms & Antonyms - Practice Test',
      "[Advance] Reasoning - Venn Diagram - Let's Learn",
      '[Advance] Reasoning - Venn Diagram - Practice Test',
      "[Advance] Quant - Profit & Loss - Let's Learn",
      '[Advance] Quant - Profit & Loss - Practice Test',
      'Checkpoint - 3 [Advance] Quant, Verbal, Reasoning - Profit & Loss',
      '[Advance] Verbal - One word Substitution - Practice Test',
      "[Advance] Quant - Ratio & Proportion - Let's Learn",
      '[Advance] Quant - Ratio & Proportion - Practice Test',
      'Checkpoint - 4 [Advance] Quant, Verbal - Ratio & Proportion, One word Substitution',
      "[Advance] Verbal - Idiomatic Expressions - Let's Learn",
      '[Advance] Verbal - Idiomatic Expressions - Practice Test',
      "[Advance] Reasoning - Non-Verbal Reasoning - Let's Learn",
      '[Advance] Reasoning - Non-Verbal Reasoning - Practice Test',
      "[Advance] Reasoning - Non-Verbal Reasoning - Let's Learn",
      '[Advance] Reasoning - Non-Verbal Reasoning - Practice Test',
      'Checkpoint - 5 [Advance] Quant, Verbal, Reasoning - Average, Idiomatic',
      "[Advance] Verbal - Adjectives & Adverbs - Let's Learn",
      '[Advance] Verbal - Adjectives & Adverbs - Practice Test',
      "[Advance] Quant - Time , Speed & Distance - Let's Learn",
      '[Advance] Quant - Time , Speed & Distance - Practice Test',
      'Checkpoint - 6 [Advance] Quant, Verbal - Speed & Distance, Adjectives & Adverbs',
      "[Advance] Reasoning - Seating Arrangements - Let's Learn",
      '[Advance] Reasoning - Seating Arrangements - Practice Test',
      "[Advance] Quant - Time, Work & Wages - Let's Learn",
      '[Advance] Quant - Time, Work & Wages - Practice Test',
      'Checkpoint - 7 [Advance] Quant, Reasoning - Work & Wages, Seating Arrangements - Mock Test',
      "[Advance] Verbal - Conjunctions - Let's Learn",
      '[Advance] Verbal - Conjunctions - Practice Test',
      "[Advance] Quant - Number System 1 - Let's Learn",
      '[Advance] Quant - Number System 1 - Practice Test',
      'Checkpoint - 8 [Advance] Quant, Verbal - Number System, Conjunctions - Mock Test',
      "[Advance] Verbal - Modifiers & Determiners - Let's Learn",
      '[Advance] Verbal - Modifiers & Determiners - Practice Test',
      "[Advance] Reasoning - Clock & Calendar - Let's Learn",
      '[Advance] Reasoning - Clock & Calendar - Practice Test',
      "[Advance] Quant - Number System 2 - Let's Learn",
      '[Advance] Quant - Number System 2 - Practice Test',
      'Checkpoint - 9 [Advance] Quant, Verbal, Reasoning - Number System',
      "[Advance] Verbal - Parallelism - Let's Learn",
      '[Advance] Verbal - Parallelism - Practice Test',
      "[Advance] Quant - Algebra 1 - Let's Learn",
      '[Advance] Quant - Algebra 1 - Practice Test',
      'Checkpoint - 10 [Advance] Quant, Verbal - Algebra, Parallelism - Mock Test',
      "[Advance] Verbal - Para Jumbles - Let's Learn",
      '[Advance] Verbal - Para Jumbles - Practice Test',
      "[Advance] Reasoning - Cube & Dice - Let's Learn",
      '[Advance] Reasoning - Cube & Dice - Practice Test',
      "[Advance] Quant - Algebra 2 - Let's Learn",
      '[Advance] Quant - Algebra 2 - Practice Test',
      'Checkpoint - 11 [Advance] Quant, Verbal, Reasoning - Algebra, Para- Mock Test',
      "[Advance] Verbal - Reading Comprehensions - Let's Learn",
      '[Advance] Verbal - Reading Comprehensions - Practice Test',
      "[Advance] Reasoning - Decision Making - Let's Learn",
      '[Advance] Reasoning - Decision Making - Practice Test',
      "[Advance] Quant - Geometry - Let's Learn",
      '[Advance] Quant - Geometry - Practice Test',
      'Checkpoint - 12 [Advance] Quant, Verbal, Reasoning - Geometry, Reading',
      '[Advance] Verbal - Critical Reasoning 1 - Practice Test',
      "[Advance] Quant - Permutation & Combination, Probability - Let's Learn",
      '[Advance] Quant - Permutation & Combination, Probability - Practice Test',
      'Checkpoint - 13 [Advance] Quant, Verbal - Permutation, Critical Reasoning',
      '[Advance] Verbal - Critical Reasoning 2 - Practice Test',
      "[Advance] Reasoning - Puzzles - Let's Learn",
      '[Advance] Reasoning - Puzzles - Practice Test',
      "[Advance] Quant - Data Interpretation - Let's Learn",
      '[Advance] Quant - Data Interpretation - Practice Test',
      'Checkpoint - 14 [Advance] Quant, Verbal, Reasoning - Data Interpretation-Mock Test',
    ];

    try {
      const topic = await this.prisma.topic.createMany({
        data: data.map((name) => ({
          name: name,
          courseId: '66344dd5b284d1fecec4bdb8',
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
