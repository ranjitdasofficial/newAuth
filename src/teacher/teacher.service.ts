import {
  ConflictException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  AddLinks,
  FacultiesContactDto,
  ReviewDto,
  TeacherDto,
  
  UpdateDataDTO,
  

} from './dto/Teacher.dto';
import * as ExcelJS from 'exceljs';
import * as path from 'path';

import * as xlsx from 'xlsx';
import * as fs from 'fs';

// import dap from './dap.json';

const Ml = [
  { name: 'Mr. Sankalp Nayak', subject: 'ML', section: [1] },
  { name: 'Mr. Sohail Khan', subject: 'ML', section: [3] },
  { name: 'Dr. Ramesh Kumar Thakur', subject: 'ML', section: [4] },
  { name: 'Dr. Minakhi Rout', subject: 'ML', section: [5] },
  { name: 'Dr. Kumar Surjeet Chaudhury', subject: 'ML', section: [6] },
  { name: 'Prof. P. K. Samanta', subject: 'ML', section: [7] },
  { name: 'Prof. Wriddhi Bhowmick', subject: 'ML', section: [9] },
  { name: 'Prof. T. Kar', subject: 'ML', section: [2, 11] },
  { name: 'Mr. A Ranjith', subject: 'ML', section: [12] },
  { name: 'Mr. Chandra Shekhar', subject: 'ML', section: [13] },
  { name: 'Prof. A. Gorai', subject: 'ML', section: [10, 14] },
  { name: 'Mr. Sunil Kumar Gouda', subject: 'ML', section: [15] },
  { name: 'Prof. Parveen Malik', subject: 'ML', section: [16] },
  { name: 'Mr. Nayan Kumar S. Behera', subject: 'ML', section: [17] },
  { name: 'Dr. Jayeeta Chakraborty', subject: 'ML', section: [18] },
  { name: 'Dr. Satya Champati Rai', subject: 'ML', section: [8, 19] },
  { name: 'Dr. Partha Pratim Sarangi', subject: 'ML', section: [20] },
  { name: 'Dr. Rinku Datta Rakshit', subject: 'ML', section: [21] },
  { name: 'Dr. Babita Panda', subject: 'ML', section: [22] },
  { name: 'Dr. Pampa Sinha', subject: 'ML', section: [23] },
  { name: 'Prof. Subodh Kumar Mohanty', subject: 'ML', section: [24] },
  { name: 'Dr. Shubhasri Kundu', subject: 'ML', section: [25] },
  { name: 'Dr. Subrat Kumar Barik', subject: 'ML', section: [26] },
  { name: 'Dr. Padarbinda Samal', subject: 'ML', section: [127] },
];

const IOT = [
  { name: 'Mr. R. N. Ramakant Parida', subject: 'IOT', section: [1] },
  { name: 'Dr. Debachudamani Prusti', subject: 'IOT', section: [2] },
  { name: 'Mrs. Ronali Padhy', subject: 'IOT', section: [3] },
  { name: 'Prof. T. M. Behera', subject: 'IOT', section: [4, 10] },
  { name: 'Dr. Hitesh Mahapatra', subject: 'IOT', section: [5, 8] },
  { name: 'Dr. Banchhanidhi Dash', subject: 'IOT', section: [6] },
  { name: 'Prof. Akshaya Kumar Pati', subject: 'IOT', section: [7] },
  { name: 'Prof. A. Samui', subject: 'IOT', section: [9] },
  { name: 'Mr. Prasenjit Maiti', subject: 'IOT', section: [11] },
  { name: 'Prof. Deepak Kumar Rout', subject: 'IOT', section: [12] },
  { name: 'Prof. Swagat Das', subject: 'IOT', section: [13] },
];

const NLP = [
  { name: 'Mrs. Lipika Dewangan', subject: 'NLP', section: [1, 4] },
  { name: 'Dr. Mainak Bandyopadhyay', subject: 'NLP', section: [2, 5] },
  { name: 'Dr. Murari Mandal', subject: 'NLP', section: [3] },
  { name: 'Dr. Ambika Prasad Mishra', subject: 'NLP', section: [6] },
];

const DA = [
  { name: 'Dr. Satarupa Mohanty', subject: 'DA', section: [1, 29] },
  { name: 'Dr. Pratyusa Mukherjee', subject: 'DA', section: [2] },
  { name: 'Dr. Subhadip Pramanik', subject: 'DA', section: [3, 22] },
  { name: 'Dr. Abhaya Kumar Sahoo', subject: 'DA', section: [4] },
  { name: 'Mr. Abinas Panda', subject: 'DA', section: [5] },
  { name: 'Dr. Sarita Tripathy', subject: 'DA', section: [6, 32] },
  { name: 'Mrs. Naliniprava Behera', subject: 'DA', section: [7] },
  { name: 'Dr. Nibedan Panda', subject: 'DA', section: [8] },
  { name: 'Mr. Pragma Kar', subject: 'DA', section: [9, 20] },
  { name: 'Dr. Santosh Kumar Baliarsingh', subject: 'DA', section: [10, 19] },
  { name: 'Mr. Deependra Singh', subject: 'DA', section: [11, 21] },
  { name: 'Dr. Santwana Sagnika', subject: 'DA', section: [12, 34] },
  { name: 'Mrs. Jayanti Dansana', subject: 'DA', section: [13, 33] },
  { name: 'Mr. Vishal Meena', subject: 'DA', section: [14] },
  { name: 'Dr. Subhranshu Sekhar Tripathy', subject: 'DA', section: [15] },
  { name: 'Mr. Ajay Anand', subject: 'DA', section: [16] },
  { name: 'Mrs. Meghana G Raj', subject: 'DA', section: [17] },
  { name: 'Ms. Sricheta Parui', subject: 'DA', section: [18] },
  { name: 'Dr. Mukesh Kumar', subject: 'DA', section: [23] },
  { name: 'Mr. Jhalak Hota', subject: 'DA', section: [24] },
  { name: 'Dr. Rajat Kumar Behera', subject: 'DA', section: [25] },
  { name: 'Dr. Soumya Ranjan Nayak', subject: 'DA', section: [26] },
  { name: 'Dr. Saikat Chakraborty', subject: 'DA', section: [27] },
  { name: 'Mr. Rabi Shaw', subject: 'DA', section: [28, 30] },
  { name: 'Dr. Aleena Swetapadma', subject: 'DA', section: [31] },
];

const sec = {
  'Prof. Pramod Kumar Das': {
    name: 'Prof. Pramod Kumar Das',
    subjects: ['DSS'],
    sections: [1, 52],
  },
  'Dr. Arghya Kundu': {
    name: 'Dr. Arghya Kundu',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [1],
  },
  'Ms. Sarita Mishra': {
    name: 'Ms. Sarita Mishra',
    subjects: ['DBMS', 'DBMS(L)', 'OS'],
    sections: [1, 7, 26],
  },
  'Mr. Abhishek Raj': {
    name: 'Mr. Abhishek Raj',
    subjects: ['OS', 'OS(L)'],
    sections: [1, 23],
  },
  'Dr. Himansu Das': {
    name: 'Dr. Himansu Das',
    subjects: ['COA'],
    sections: [1, 51],
  },
  'Dr. Kalyani Mohanta': {
    name: 'Dr. Kalyani Mohanta',
    subjects: ['STW'],
    sections: [1],
  },
  'Dr. Srikumar Acharya': {
    name: 'Dr. Srikumar Acharya',
    subjects: ['DSS'],
    sections: [2, 55],
  },
  'Dr. Abhaya Kumar Sahoo': {
    name: 'Dr. Abhaya Kumar Sahoo',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [2, 18],
  },
  'Ms. Mandakini Priyadarshani Behera': {
    name: 'Ms. Mandakini Priyadarshani Behera',
    subjects: ['DBMS', 'OS', 'OS(L)'],
    sections: [2, 29, 52],
  },
  'Dr. Murari Mandal': {
    name: 'Dr. Murari Mandal',
    subjects: ['OS', 'OS(L)'],
    sections: [2, 49],
  },
  'Mr. Ajit Kumar Pasayat': {
    name: 'Mr. Ajit Kumar Pasayat',
    subjects: ['COA'],
    sections: [2, 17],
  },
  'Dr. Swayam B Mishra': {
    name: 'Dr. Swayam B Mishra',
    subjects: ['STW'],
    sections: [2],
  },
  'Dr. Jayanta Mondal': {
    name: 'Dr. Jayanta Mondal',
    subjects: ['DBMS(L)', 'DBMS'],
    sections: [2, 49],
  },
  'Dr. Prasanta Ku. Mohanty': {
    name: 'Dr. Prasanta Ku. Mohanty',
    subjects: ['DSS'],
    sections: [3, 46, 54],
  },
  'Dr. Soumya Ranjan Mishra': {
    name: 'Dr. Soumya Ranjan Mishra',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [3, 45],
  },
  'Mr. Kunal Anand': {
    name: 'Mr. Kunal Anand',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [3, 13, 30],
  },
  'Dr. Raghunath Dey': {
    name: 'Dr. Raghunath Dey',
    subjects: ['OS', 'OS(L)'],
    sections: [3, 15],
  },
  'Prof. Bikash Kumar Behera': {
    name: 'Prof. Bikash Kumar Behera',
    subjects: ['COA'],
    sections: [3, 24],
  },
  'Dr. S. Chaudhuri': {
    name: 'Dr. S. Chaudhuri',
    subjects: ['STW'],
    sections: [3],
  },
  'Dr. Arjun Kumar Paul': {
    name: 'Dr. Arjun Kumar Paul',
    subjects: ['DSS'],
    sections: [4, 53],
  },
  'Mr. Sunil Kumar Gouda': {
    name: 'Mr. Sunil Kumar Gouda',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [4, 25],
  },
  'Dr. Rajat Kumar Behera': {
    name: 'Dr. Rajat Kumar Behera',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [4],
  },
  'Ms. Krutika Verma': {
    name: 'Ms. Krutika Verma',
    subjects: ['OS', 'OS(L)'],
    sections: [4, 14],
  },
  'Dr. Namita Panda': {
    name: 'Dr. Namita Panda',
    subjects: ['COA', 'OS(L)'],
    sections: [4, 5, 53],
  },
  'Dr. Basanta Kumar Rana': {
    name: 'Dr. Basanta Kumar Rana',
    subjects: ['STW'],
    sections: [4],
  },
  'Dr. Manoranjan Sahoo': {
    name: 'Dr. Manoranjan Sahoo',
    subjects: ['DSS'],
    sections: [5, 50],
  },
  'Mr. Sujoy Datta': {
    name: 'Mr. Sujoy Datta',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [5, 29, 37],
  },
  'Dr. Hrudaya Kumar Tripathy': {
    name: 'Dr. Hrudaya Kumar Tripathy',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [5, 29],
  },
  'Dr. Biswajit Sahoo': {
    name: 'Dr. Biswajit Sahoo',
    subjects: ['OS'],
    sections: [5, 35],
  },
  'Prof.  K. B. Ray': {
    name: 'Prof.  K. B. Ray',
    subjects: ['COA'],
    sections: [5, 22],
  },
  'Dr. Jitendra Ku. Patel': {
    name: 'Dr. Jitendra Ku. Patel',
    subjects: ['STW'],
    sections: [5],
  },
  'Dr. M. M. Acharya': {
    name: 'Dr. M. M. Acharya',
    subjects: ['DSS'],
    sections: [6, 49],
  },
  'Dr. Junali Jasmine Jena': {
    name: 'Dr. Junali Jasmine Jena',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [6, 40],
  },
  'Mr. Vishal Meena': {
    name: 'Mr. Vishal Meena',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [6, 28],
  },
  'Dr. Alok Kumar Jagadev': {
    name: 'Dr. Alok Kumar Jagadev',
    subjects: ['OS', 'OS(L)'],
    sections: [6],
  },
  'Dr. Anuja Kumar Acharya': {
    name: 'Dr. Anuja Kumar Acharya',
    subjects: ['COA', 'DBMS(L)'],
    sections: [6, 14, 21, 54],
  },
  'Dr. Avinash Chaudhary': {
    name: 'Dr. Avinash Chaudhary',
    subjects: ['STW'],
    sections: [6],
  },
  'Dr. Laxmipriya Nayak': {
    name: 'Dr. Laxmipriya Nayak',
    subjects: ['DSS'],
    sections: [7, 48],
  },
  'Mr. Harish Kumar Patnaik': {
    name: 'Mr. Harish Kumar Patnaik',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [7],
  },
  'Dr. Prasant Kumar Pattnaik': {
    name: 'Dr. Prasant Kumar Pattnaik',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [7],
  },
  'Dr. Dayal Kumar Behera': {
    name: 'Dr. Dayal Kumar Behera',
    subjects: ['COA'],
    sections: [7, 41],
  },
  'Dr. Promod Mallick': {
    name: 'Dr. Promod Mallick',
    subjects: ['STW'],
    sections: [7],
  },
  'Mr. Nayan Kumar S. Behera': {
    name: 'Mr. Nayan Kumar S. Behera',
    subjects: ['OS(L)'],
    sections: [7, 45],
  },
  'Dr. Arun Kumar Gupta': {
    name: 'Dr. Arun Kumar Gupta',
    subjects: ['DSS'],
    sections: [8, 47],
  },
  'Dr. Monideepa Roy': {
    name: 'Dr. Monideepa Roy',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [8],
  },
  'Dr. Chittaranjan Pradhan': {
    name: 'Dr. Chittaranjan Pradhan',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [8],
  },
  'Dr. Banchhanidhi Dash': {
    name: 'Dr. Banchhanidhi Dash',
    subjects: ['OS', 'OS(L)'],
    sections: [8, 48],
  },
  'Prof. S. K. Badi': {
    name: 'Prof. S. K. Badi',
    subjects: ['COA'],
    sections: [8, 26],
  },
  'Dr. Spandan Guha': {
    name: 'Dr. Spandan Guha',
    subjects: ['STW'],
    sections: [8],
  },
  'Dr. Akshaya Kumar Panda': {
    name: 'Dr. Akshaya Kumar Panda',
    subjects: ['DSS'],
    sections: [9],
  },
  'Mrs. Naliniprava Behera': {
    name: 'Mrs. Naliniprava Behera',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [9, 27],
  },
  'Mr. Rakesh Kumar Rai': {
    name: 'Mr. Rakesh Kumar Rai',
    subjects: ['DBMS', 'OOPJ', 'OPPJ(L)'],
    sections: [9, 13],
  },
  'Mr. Prasenjit Maiti': {
    name: 'Mr. Prasenjit Maiti',
    subjects: ['OS', 'OS(L)'],
    sections: [9],
  },
  'Prof. S. Padhy': {
    name: 'Prof. S. Padhy',
    subjects: ['COA'],
    sections: [9],
  },
  'Dr. Swarup K. Nayak': {
    name: 'Dr. Swarup K. Nayak',
    subjects: ['STW'],
    sections: [9],
  },
  'Dr. Kumar Devadutta': {
    name: 'Dr. Kumar Devadutta',
    subjects: ['DBMS(L)', 'DBMS'],
    sections: [9, 12],
  },
  'Dr. Mitali Routaray': {
    name: 'Dr. Mitali Routaray',
    subjects: ['DSS'],
    sections: [10, 45],
  },
  'Dr. Nibedan Panda': {
    name: 'Dr. Nibedan Panda',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [10, 47],
  },
  'Dr. Samaresh Mishra': {
    name: 'Dr. Samaresh Mishra',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [10],
  },
  'Ms. Swagatika Sahoo': {
    name: 'Ms. Swagatika Sahoo',
    subjects: ['OS', 'OS(L)'],
    sections: [10],
  },
  'Dr. Mohit Ranjan Panda': {
    name: 'Dr. Mohit Ranjan Panda',
    subjects: ['COA'],
    sections: [10, 36, 45],
  },
  'Dr. Banishree Misra': {
    name: 'Dr. Banishree Misra',
    subjects: ['STW'],
    sections: [10],
  },
  'Dr. Suvasis Nayak': {
    name: 'Dr. Suvasis Nayak',
    subjects: ['DSS'],
    sections: [11, 31],
  },
  'Mr. Rabi Shaw': {
    name: 'Mr. Rabi Shaw',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [11, 46],
  },
  'Dr. Debanjan Pathak': {
    name: 'Dr. Debanjan Pathak',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [11, 22],
  },
  'Dr. Amulya Ratna Swain': {
    name: 'Dr. Amulya Ratna Swain',
    subjects: ['OS'],
    sections: [11, 41],
  },
  'Dr. Sujata Swain': {
    name: 'Dr. Sujata Swain',
    subjects: ['COA'],
    sections: [11, 12, 55],
  },
  'Dr. Sriparna Roy Ghatak': {
    name: 'Dr. Sriparna Roy Ghatak',
    subjects: ['STW'],
    sections: [11, 32],
  },
  'Dr. Tanmoy Maitra': {
    name: 'Dr. Tanmoy Maitra',
    subjects: ['OS(L)', 'OS'],
    sections: [11, 25],
  },
  'Dr. Joydeb Pal': {
    name: 'Dr. Joydeb Pal',
    subjects: ['DSS'],
    sections: [12, 32],
  },
  'Dr. Arup Abhinna Acharya': {
    name: 'Dr. Arup Abhinna Acharya',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [12, 43],
  },
  'Dr. Manas Ranjan Lenka': {
    name: 'Dr. Manas Ranjan Lenka',
    subjects: ['OS', 'OS(L)'],
    sections: [12, 54],
  },
  'Dr. Alivarani Mohapatra': {
    name: 'Dr. Alivarani Mohapatra',
    subjects: ['STW'],
    sections: [12],
  },
  'Dr. Madhusudan Bera': {
    name: 'Dr. Madhusudan Bera',
    subjects: ['DSS'],
    sections: [13, 44],
  },
  'Dr. Santosh Kumar Baliarsingh': {
    name: 'Dr. Santosh Kumar Baliarsingh',
    subjects: ['DBMS'],
    sections: [13],
  },
  'Dr. Saurabh Bilgaiyan': {
    name: 'Dr. Saurabh Bilgaiyan',
    subjects: ['OS', 'OS(L)'],
    sections: [13, 55],
  },
  'Dr. Suchismita Das': {
    name: 'Dr. Suchismita Das',
    subjects: ['COA', 'OS', 'OS(L)'],
    sections: [13, 26],
  },
  'Dr. Ranjeeta Patel': {
    name: 'Dr. Ranjeeta Patel',
    subjects: ['STW'],
    sections: [13],
  },
  'Dr. Manas Ranjan Mohapatra': {
    name: 'Dr. Manas Ranjan Mohapatra',
    subjects: ['DSS'],
    sections: [14, 30, 51],
  },
  'Mr. Pradeep Kandula': {
    name: 'Mr. Pradeep Kandula',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [14, 15],
  },
  'Dr. Dipti Dash': {
    name: 'Dr. Dipti Dash',
    subjects: ['DBMS'],
    sections: [14],
  },
  'Dr. Suresh Chandra Satapathy': {
    name: 'Dr. Suresh Chandra Satapathy',
    subjects: ['COA'],
    sections: [14, 29, 33],
  },
  'Prof. Anil Kumar Behera': {
    name: 'Prof. Anil Kumar Behera',
    subjects: ['STW'],
    sections: [14],
  },
  'Dr. Utkal Keshari Dutta': {
    name: 'Dr. Utkal Keshari Dutta',
    subjects: ['DSS'],
    sections: [15, 29],
  },
  'Dr. Subhadip Pramanik': {
    name: 'Dr. Subhadip Pramanik',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [15],
  },
  'Prof. P. Biswal': {
    name: 'Prof. P. Biswal',
    subjects: ['COA'],
    sections: [15, 21],
  },
  'Dr. Subarna  Bhattacharya': {
    name: 'Dr. Subarna  Bhattacharya',
    subjects: ['STW'],
    sections: [15, 18],
  },
  'Dr. Sudipta Kumar Ghosh': {
    name: 'Dr. Sudipta Kumar Ghosh',
    subjects: ['DSS'],
    sections: [16, 28],
  },
  'Dr. Partha Pratim Sarangi': {
    name: 'Dr. Partha Pratim Sarangi',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [16, 28],
  },
  'Dr. Pradeep Kumar Mallick': {
    name: 'Dr. Pradeep Kumar Mallick',
    subjects: ['DBMS', 'DBMS(L)', 'OOPJ'],
    sections: [16, 17, 44],
  },
  'Mr. Abinas Panda': {
    name: 'Mr. Abinas Panda',
    subjects: ['OS', 'OS(L)'],
    sections: [16, 46],
  },
  'Prof. Ruby Mishra': {
    name: 'Prof. Ruby Mishra',
    subjects: ['COA'],
    sections: [16],
  },
  'Dr. Sudeshna Datta Chaudhuri': {
    name: 'Dr. Sudeshna Datta Chaudhuri',
    subjects: ['STW'],
    sections: [16],
  },
  'Dr. Suman Sarkar': {
    name: 'Dr. Suman Sarkar',
    subjects: ['DSS'],
    sections: [17, 33, 43],
  },
  'Dr. Saikat Chakraborty': {
    name: 'Dr. Saikat Chakraborty',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [17, 25],
  },
  'Dr. Subhasis Dash': {
    name: 'Dr. Subhasis Dash',
    subjects: ['OS', 'OS(L)'],
    sections: [17, 30, 36],
  },
  'Dr. Arpita Goswami': {
    name: 'Dr. Arpita Goswami',
    subjects: ['STW'],
    sections: [17],
  },
  'Ms. Ipsita Paul': {
    name: 'Ms. Ipsita Paul',
    subjects: ['OPPJ(L)'],
    sections: [17],
  },
  'Dr. Arijit Patra': {
    name: 'Dr. Arijit Patra',
    subjects: ['DSS'],
    sections: [18, 27, 42],
  },
  'Dr. Sushruta Mishra': {
    name: 'Dr. Sushruta Mishra',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [18, 25],
  },
  'Dr. Ajay Kumar Jena': {
    name: 'Dr. Ajay Kumar Jena',
    subjects: ['OS', 'OS(L)'],
    sections: [18, 47],
  },
  'Prof. Shruti': {
    name: 'Prof. Shruti',
    subjects: ['COA'],
    sections: [18, 31],
  },
  'Dr. Vishal Pradhan': {
    name: 'Dr. Vishal Pradhan',
    subjects: ['DSS'],
    sections: [19, 34],
  },
  'Mr. Sourav Kumar Giri': {
    name: 'Mr. Sourav Kumar Giri',
    subjects: ['OOPJ', 'OPPJ(L)', 'DBMS'],
    sections: [19, 30, 32],
  },
  'Dr. Jayeeta Chakraborty': {
    name: 'Dr. Jayeeta Chakraborty',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [19, 34],
  },
  'Dr. Mainak Bandyopadhyay': {
    name: 'Dr. Mainak Bandyopadhyay',
    subjects: ['OS', 'OS(L)'],
    sections: [19, 33],
  },
  'Mr. Anil Kumar Swain': {
    name: 'Mr. Anil Kumar Swain',
    subjects: ['COA'],
    sections: [19, 34],
  },
  'Prof. J. R. Panda': {
    name: 'Prof. J. R. Panda',
    subjects: ['STW'],
    sections: [19, 34],
  },
  'Dr. Debdulal Ghosh': {
    name: 'Dr. Debdulal Ghosh',
    subjects: ['DSS'],
    sections: [20, 41],
  },
  'Mr. Vijay Kumar Meena': {
    name: 'Mr. Vijay Kumar Meena',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [20, 34, 44],
  },
  'Ms. Susmita Das': {
    name: 'Ms. Susmita Das',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [20, 23],
  },
  'Mr. A Ranjith': {
    name: 'Mr. A Ranjith',
    subjects: ['OS', 'OS(L)'],
    sections: [20, 32],
  },
  'Prof. Swati Swayamsiddha': {
    name: 'Prof. Swati Swayamsiddha',
    subjects: ['COA'],
    sections: [20, 43],
  },
  'Prof. Sunil Kr. Mishra': {
    name: 'Prof. Sunil Kr. Mishra',
    subjects: ['STW'],
    sections: [20, 36],
  },
  'Mr. Mainak Chakraborty': {
    name: 'Mr. Mainak Chakraborty',
    subjects: ['OPPJ(L)'],
    sections: [20],
  },
  'Dr. Srikanta Behera': {
    name: 'Dr. Srikanta Behera',
    subjects: ['DSS'],
    sections: [21, 40],
  },
  'Mr. Tanik Saikh': {
    name: 'Mr. Tanik Saikh',
    subjects: ['OOPJ'],
    sections: [21],
  },
  'Dr. Jagannath Singh': {
    name: 'Dr. Jagannath Singh',
    subjects: ['DBMS'],
    sections: [21],
  },
  'Mr. Gananath Bhuyan': {
    name: 'Mr. Gananath Bhuyan',
    subjects: ['OS', 'OS(L)', 'DBMS'],
    sections: [21, 37, 40],
  },
  'Ms. Mamita Dash': {
    name: 'Ms. Mamita Dash',
    subjects: ['STW'],
    sections: [21, 49, 51],
  },
  'Mr. Pragma Kar': {
    name: 'Mr. Pragma Kar',
    subjects: ['OPPJ(L)'],
    sections: [21],
  },
  'Dr. Kartikeswar Mahalik': {
    name: 'Dr. Kartikeswar Mahalik',
    subjects: ['DSS'],
    sections: [22, 39],
  },
  'Dr. Mainak Biswas': {
    name: 'Dr. Mainak Biswas',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [22, 40],
  },
  'Dr. Pratyusa Mukherjee': {
    name: 'Dr. Pratyusa Mukherjee',
    subjects: ['OS', 'OS(L)'],
    sections: [22, 27],
  },
  'Prof. S. K. Mohapatra': {
    name: 'Prof. S. K. Mohapatra',
    subjects: ['STW'],
    sections: [22],
  },
  'Dr. Bapuji Sahoo': {
    name: 'Dr. Bapuji Sahoo',
    subjects: ['DSS'],
    sections: [23, 38],
  },
  'Mr. Debashis Hati': {
    name: 'Mr. Debashis Hati',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [23, 52],
  },
  'Prof. Ganaraj P. S.': {
    name: 'Prof. Ganaraj P. S.',
    subjects: ['COA'],
    sections: [23, 42],
  },
  'Dr. Ananda Meher': {
    name: 'Dr. Ananda Meher',
    subjects: ['STW'],
    sections: [23, 47, 50, 54, 55],
  },
  'Dr. Abhijit Sutradhar': {
    name: 'Dr. Abhijit Sutradhar',
    subjects: ['DSS'],
    sections: [24, 37],
  },
  'Dr. Sourajit Behera': {
    name: 'Dr. Sourajit Behera',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [24, 33],
  },
  'Dr. Mukesh Kumar': {
    name: 'Dr. Mukesh Kumar',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [24, 38],
  },
  'Mr. Deependra Singh': {
    name: 'Mr. Deependra Singh',
    subjects: ['OS', 'OS(L)'],
    sections: [24],
  },
  'Prof. Satish Kumar Gannamaneni': {
    name: 'Prof. Satish Kumar Gannamaneni',
    subjects: ['STW'],
    sections: [24, 38],
  },
  'Dr. Habibul Islam': {
    name: 'Dr. Habibul Islam',
    subjects: ['DSS'],
    sections: [25, 36],
  },
  'Prof. Kumar Biswal': {
    name: 'Prof. Kumar Biswal',
    subjects: ['COA'],
    sections: [25, 47],
  },
  'Dr. Sarbeswar Mohanty': {
    name: 'Dr. Sarbeswar Mohanty',
    subjects: ['STW'],
    sections: [25, 27, 52, 53],
  },
  'Dr. Amalesh Kumar Manna': {
    name: 'Dr. Amalesh Kumar Manna',
    subjects: ['DSS'],
    sections: [26, 35],
  },
  'Mr. N. Biraja Isac': {
    name: 'Mr. N. Biraja Isac',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [26, 32, 48],
  },
  'Prof. Rachita Panda': {
    name: 'Prof. Rachita Panda',
    subjects: ['STW'],
    sections: [26],
  },
  'Mr. Sankalp Nayak': {
    name: 'Mr. Sankalp Nayak',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [27, 51],
  },
  'Dr. Manoj Kumar Mishra': {
    name: 'Dr. Manoj Kumar Mishra',
    subjects: ['COA', 'OS(L)'],
    sections: [27, 35, 49],
  },
  'Dr. Kumar Surjeet Chaudhury': {
    name: 'Dr. Kumar Surjeet Chaudhury',
    subjects: ['OS', 'OS(L)'],
    sections: [28, 44],
  },
  'Dr. Bhabani Shankar Prasad Mishra': {
    name: 'Dr. Bhabani Shankar Prasad Mishra',
    subjects: ['COA'],
    sections: [28, 48],
  },
  'Prof. Sushree S. Panda': {
    name: 'Prof. Sushree S. Panda',
    subjects: ['STW'],
    sections: [28],
  },
  'Dr. Seba Mohanty': {
    name: 'Dr. Seba Mohanty',
    subjects: ['STW'],
    sections: [29, 31, 33, 35, 37],
  },
  'Dr. VIkas Hassija': {
    name: 'Dr. VIkas Hassija',
    subjects: ['COA'],
    sections: [30, 37, 52],
  },
  'Prof. Nazia T. Imran': {
    name: 'Prof. Nazia T. Imran',
    subjects: ['STW'],
    sections: [30],
  },
  'Ms. Chandani Kumari': {
    name: 'Ms. Chandani Kumari',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [31, 36, 50],
  },
  'Dr. Rajdeep Chatterjee': {
    name: 'Dr. Rajdeep Chatterjee',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [31],
  },
  'Dr. Krishnandu Hazra': {
    name: 'Dr. Krishnandu Hazra',
    subjects: ['OS', 'OS(L)'],
    sections: [31, 51],
  },
  'Prof. S. Mishra': {
    name: 'Prof. S. Mishra',
    subjects: ['COA'],
    sections: [32, 40],
  },
  'Mr. Arup Sarkar': {
    name: 'Mr. Arup Sarkar',
    subjects: ['DBMS(L)', 'DBMS'],
    sections: [32, 36],
  },
  'Ms. Benazir Neha': {
    name: 'Ms. Benazir Neha',
    subjects: ['DBMS', 'DBMS(L)', 'OOPJ'],
    sections: [33, 37, 51],
  },
  'Dr. Santosh Kumar Pani': {
    name: 'Dr. Santosh Kumar Pani',
    subjects: ['OS'],
    sections: [34],
  },
  'Dr. Partha Sarathi Paul': {
    name: 'Dr. Partha Sarathi Paul',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [35],
  },
  'Dr. Aleena Swetapadma': {
    name: 'Dr. Aleena Swetapadma',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [35, 45],
  },
  'Prof. P. Dutta': {
    name: 'Prof. P. Dutta',
    subjects: ['COA'],
    sections: [35],
  },
  'Dr. Manas Ranjan Nayak': {
    name: 'Dr. Manas Ranjan Nayak',
    subjects: ['OOPJ', 'OS', 'OS(L)'],
    sections: [36, 53],
  },
  'Dr. Pinaki Sankar Chatterjee': {
    name: 'Dr. Pinaki Sankar Chatterjee',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [38, 55],
  },
  'Mr. Rohit Kumar Tiwari': {
    name: 'Mr. Rohit Kumar Tiwari',
    subjects: ['OS', 'OS(L)'],
    sections: [38],
  },
  'Dr. Asif Uddin Khan': {
    name: 'Dr. Asif Uddin Khan',
    subjects: ['COA'],
    sections: [38, 50],
  },
  'Mr. Sohail Khan': {
    name: 'Mr. Sohail Khan',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [39, 49],
  },
  'Mr. R. N. Ramakant Parida': {
    name: 'Mr. R. N. Ramakant Parida',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [39, 55],
  },
  'Dr. Satya Champati Rai': {
    name: 'Dr. Satya Champati Rai',
    subjects: ['OS', 'OS(L)'],
    sections: [39],
  },
  'Prof. A. Bakshi': {
    name: 'Prof. A. Bakshi',
    subjects: ['COA'],
    sections: [39, 44],
  },
  'Dr. Suvendu Barik': {
    name: 'Dr. Suvendu Barik',
    subjects: ['STW'],
    sections: [39, 41, 43, 45, 48],
  },
  'Mr. Chandra Shekhar': {
    name: 'Mr. Chandra Shekhar',
    subjects: ['OS', 'OS(L)'],
    sections: [40, 50],
  },
  'Dr. Swapnomayee Palit': {
    name: 'Dr. Swapnomayee Palit',
    subjects: ['STW'],
    sections: [40, 42],
  },
  'Dr. Mahendra Kumar Gourisaria': {
    name: 'Dr. Mahendra Kumar Gourisaria',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [41, 42],
  },
  'Dr. Ramesh Kumar Thakur': {
    name: 'Dr. Ramesh Kumar Thakur',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [41, 42],
  },
  'Dr. Santwana Sagnika': {
    name: 'Dr. Santwana Sagnika',
    subjects: ['OS', 'OS(L)'],
    sections: [42],
  },
  'Dr. Amiya Ranjan Panda': {
    name: 'Dr. Amiya Ranjan Panda',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [43],
  },
  'Mr. Sampriti Soor': {
    name: 'Mr. Sampriti Soor',
    subjects: ['OS', 'OS(L)'],
    sections: [43],
  },
  'Dr. Smrutirekha Mohanty': {
    name: 'Dr. Smrutirekha Mohanty',
    subjects: ['STW'],
    sections: [44, 46],
  },
  'Dr. Saurabh Jha': {
    name: 'Dr. Saurabh Jha',
    subjects: ['OS'],
    sections: [45],
  },
  'Dr. Minakhi Rout': {
    name: 'Dr. Minakhi Rout',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [46],
  },
  'Prof. Niten Kumar Panda': {
    name: 'Prof. Niten Kumar Panda',
    subjects: ['COA'],
    sections: [46],
  },
  'Mrs. Krishna Chakravarty': {
    name: 'Mrs. Krishna Chakravarty',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [47],
  },
  'Dr. Leena Das': {
    name: 'Dr. Leena Das',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [48, 53],
  },
  'Mrs. Meghana G Raj': {
    name: 'Mrs. Meghana G Raj',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [50],
  },
  'Mr. Bijay Das': {
    name: 'Mr. Bijay Das',
    subjects: ['OS'],
    sections: [51],
  },
  'Dr. Soumya Ranjan Nayak': {
    name: 'Dr. Soumya Ranjan Nayak',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [52],
  },
  'Dr. Rinku Datta Rakshit': {
    name: 'Dr. Rinku Datta Rakshit',
    subjects: ['OOPJ', 'OPPJ(L)'],
    sections: [53, 54],
  },
  'Dr. Ashish Singh': {
    name: 'Dr. Ashish Singh',
    subjects: ['DBMS'],
    sections: [53],
  },
  'Ms. Priyanka Roy': {
    name: 'Ms. Priyanka Roy',
    subjects: ['DBMS', 'DBMS(L)'],
    sections: [54],
  },
};

@Injectable()
export class TeacherService {
  constructor(private readonly prismService: PrismaService) {}
  HIGHLY_RECOMMENDED_THRESHOLD = 0.8; // Adjust as needed
  RECOMMENDED_THRESHOLD = 0.6; // Adjust as needed
  AVERAGE_THRESHOLD = 0.4; // Adjust as needed
  MODERATELY_RECOMMENDED_THRESHOLD = 0.2; // Adjust as needed
  MIN_INTERACTIONS_THRESHOLD = 5; // Minimum interactions to consider
  async addTeacher() {
    console.log('hello');
    try {
      //send all data to prisma

      // const complete = await Promise.all(
      //   DA.map(async (teacher) => {
      //     const { name, subject, section } = teacher;
      //     const teacherData = await this.prismService.elective.create({
      //       data: {
      //         name: name,
      //         subject: subject,
      //         section: section, // Convert Section array to an array of numbers
      //         dislikes: [],
      //         likes: [],
      //         reviews: { create: [] },
      //       },
      //     });
      //     return teacherData;
      //   }),
      // );
      // console.log(complete);

      const allCreate = await Promise.all(
        Object.keys(sec).map(async (key) => {
          const teacherData = await this.prismService.teacher.create({
            data: {
              name: sec[key].name,
              subject: sec[key].subjects.join(','),
              section: sec[key].sections, // Convert Section array to an array of numbers
              dislikes: [],
              likes: [],
              reviews: { create: [] },
            },
          });
          return teacherData;
        }),
      );

      return allCreate;
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

    for (let i = 1; i < 56; i++) {
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
        }),
      );

      const filteredSec1 = sec1.filter((teacher) => teacher !== undefined);

      this.Teachers.push({
        section: i,
        data: filteredSec1,
      });
    }

    console.log(this.Teachers);

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

        const totalInteractions = row.likes + row.dislikes;

        if (totalInteractions < this.MIN_INTERACTIONS_THRESHOLD) {
          return 0; // Not enough interactions for a reliable recommendation
        }

        const ratio = row.likes / totalInteractions;
        const p = Math.round(ratio * 100) / 100;
        this.applyColorBasedOnRatio(rowRef, p);
      });
      worksheet.addRow([null]);
    });

    // Save workbook to a file
    await workbook.xlsx.writeFile('sec-2.xlsx');

    return this.Teachers;
  }

  Electives: any[] = ['ML', 'IOT', 'NLP', 'DA'];

  async getDataForElective() {
    const Elective = [];
    const teacherData = await this.prismService.elective.findMany({
      include: { reviews: true },
    });

    for (let i = 0; i < this.Electives.length; i++) {
      const sec1 = await Promise.all(
        teacherData.map(async (teacher) => {
          if (teacher.subject === this.Electives[i]) {
            return {
              //   id: teacher.id,
              name: teacher.name,
              subject: teacher.subject,
              likes: teacher.likes.length,
              dislikes: teacher.dislikes.length,
              reviews: teacher.reviews.map((review) => review.comments),
            };
          }
        }),
      );

      const filteredSec1 = sec1.filter((teacher) => teacher !== undefined);

      Elective.push({
        subject: this.Electives[i],
        data: filteredSec1,
      });
    }

    const headers = Object.keys(Elective[0].data[0]);
    console.log(headers);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Elective_1`);

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

    Elective.forEach((sec) => {
      worksheet.addRow([`Subject:- ${sec.subject}`]);
      //   worksheet.addRow([`Section ${sec.section}`]);
      //add some space to row

      sec.data.forEach((row) => {
        const values = headers.map((header) => row[header]);
        const rowRef = worksheet.addRow(values);

        const totalInteractions = row.likes + row.dislikes;

        if (totalInteractions < this.MIN_INTERACTIONS_THRESHOLD) {
          return 0; // Not enough interactions for a reliable recommendation
        }

        const ratio = row.likes / totalInteractions;
        const p = Math.round(ratio * 100) / 100;
        this.applyColorBasedOnRatio(rowRef, p);
      });
      worksheet.addRow([null]);
    });

    // Save workbook to a file
    await workbook.xlsx.writeFile('Electives-Export.xlsx');
    console.log(Elective);
    return Elective;
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

  // getAllGroupLinkss

  async GetAllGroupLinks() {
    return await this.prismService.groupLinks.findMany({});
  }

  async addGroupLinks(dto: AddLinks) {
    try {
      return await this.prismService.groupLinks.create({
        data: dto,
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Interal Server Error');
    }
  }

  subjects = {
    0: 'CSE',
    1: 'DSS',
    2: 'OOPJ',
    3: 'DBMS',
    4: 'OS',
    5: 'COA',
    6: 'STW',
    7: 'OS(L)',
    8: 'OPPJ(L)',
    9: 'DBMS(L)',
    10: 'VT(L)',
  };

  AllFaculty: {} = {};

  idp = 0;

  //async fetch all data from xls file
  async fetchAllDataFromXls() {
    // const workbook = new ExcelJS.Workbook();

    const filepath = path.join(process.cwd(), 'forthsem.xlsx');
    const workbook = await xlsx.readFile(filepath);

    //  const workbook = xlsx.readFile('./Quiz_Question.xlsx');  // Step 2
    let workbook_sheet = workbook.SheetNames;
    let workbook_response = xlsx.utils.sheet_to_json(
      // Step 4
      workbook.Sheets[workbook_sheet[0]],
    );

    const first = workbook_response[2];
    const headers = workbook_response[1];
    console.log(headers, first);

    workbook_response.forEach(async (element, index) => {
      if (index === 0 || index === 1) return;
      Object.keys(element).forEach((key, idx) => {
        if (idx === 0) return;

        if (element[key].includes('New Faculty')) {
          return;
        }

        if (this.AllFaculty[element[key]]) {
          if (
            !this.AllFaculty[element[key]].subjects.includes(this.subjects[idx])
          ) {
            this.AllFaculty[element[key]].subjects.push(this.subjects[idx]);
          }
          if (!this.AllFaculty[element[key]].sections.includes(index - 1)) {
            this.AllFaculty[element[key]].sections.push(index - 1);
          }
        } else {
          this.AllFaculty[element[key]] = {
            name: element[key],
            subjects: [this.subjects[idx]],
            sections: [index - 1],
          };
        }
      });
    });

    // workbook_response.forEach(async (element) => {
    //  console.log(element)

    //   });
    // console.log(addData);

    // console.log(workbook_response);

    return this.AllFaculty;
  }

  //create Faculties Contacts
  async createFacultiesContacts(data: FacultiesContactDto) {
    try {
      const res = await this.prismService.professorContacts.create({
        data: data,
      });
      return res;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Invalid credentials');
    }
  }

  //getAllfaculties contacts
  async getAllFacultiesContacts() {
    try {
      const res = await this.prismService.professorContacts.findMany({});
      return res;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Invalid credentials');
    }
  }

  FinalData = [
    {
      name: 'Manas Ranjan Lenka',
      phone: '9861077824',
      email: 'manaslenkafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Manas Ranjan Lenka has started his career in the software industry and worked in various telecom technologies, i.e. 4G (LTE), 3G, 2G , IPSec, SIGCOMP protocols development etc. for 9 years. Then switched to education industry in 2013 and is',
      moreInfo: 'https://cse.kiit.ac.in/profiles/manas-ranjan-lenka/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/prasant-patnaik.jpg',
    },
    { name: 'M. Nazma B. J. Naskar', phone: '8240841372' },
    {
      name: 'Rajdeep Chatterjee',
      phone: '9040820056',
      email: 'rajdeepfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Rajdeep Chatterjee received his Bachelor of Engineering in Computer Science and Engineering from The University of Burdwan in 2008. He completed both his Master of Technology and Ph.D. in Computer Science and Engineering from KIIT Deemed to be University in',
      moreInfo: 'https://cse.kiit.ac.in/profiles/rajdeep-chatterjee/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Rajdeep-Chatterjee-Rajdeep-Chatterjee.jpg',
    },
    {
      name: 'Mahendra Kumar Gourisaria',
      phone: '9937540600',
      email: 'mkgourisariafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Mahendra Kumar Gourisaria is presently working as an Assistant Professor in the School of Computer Engineering at KIIT University, Bhubaneswar, Odisha. He has received his Master degree in Computer Application from Indira Gandhi National Open University, New Delhi and M.Tech',
      moreInfo: 'https://cse.kiit.ac.in/profiles/mahendra-kumar-gourisaria/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Mahendra-Kumar-Gourisaria.jpg',
    },
    {
      name: 'Partha Pratim Sarangi',
      phone: '7008034997',
      email: 'pp.sarangifcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Partha Pratim Sarangi is working as Assistant Professor (II) in the School of Computer Engineering, KIIT Deemed to be University. He has obtained his MTech (Computer Science) from Utkal University and Ph. D. (Computer Science & Engineering) from KIIT',
      moreInfo: 'https://cse.kiit.ac.in/profiles/partha-pratim-sarangi/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2021/01/Partha-pratim-Sarangi.jpg',
    },
    {
      name: 'Monideepa Roy',
      phone: '9090649909',
      email: 'monideepafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Monideepa Roy has been working as an Associate Professor at KIIT Deemed University, Bhubaneswar since the last 11 years. She did her Bachelors & Masters in Mathematics from IIT Kharagpur, and her PhD in CSE from Jadavpur University. Her',
      moreInfo: 'https://cse.kiit.ac.in/profiles/monideepa-roy/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/monideepa-roy.jpg',
    },
    {
      name: 'Pradeep Kandula',
      phone: '8984266460',
      email: 'pkandulafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Pradeep Kandula holds master degree in computer science from prestigious IIT Kharagpur (W.B). He completed his Master of Computer Application from Sri Kottam Tulasi Reddy Memory College of Engineering ( affiliated to JNTU). He is working in KIIT University (Deemed-to-be-University)',
      moreInfo: 'https://cse.kiit.ac.in/profiles/pradeep-kandula/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/pradeep-kandula.jpg',
    },
    {
      name: 'Murari Mandal',
      phone: '7597585929',
      email: 'murari.mandalfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'I am an Assistant Professor at the School of Computer Engineering, KIIT Bhubaneshwar. I was a Postdoctoral Research Fellow at National University of Singapore (NUS). I worked with Prof. Mohan Kankanhalli and Prof. Jussi Keppo in the N-CRiPT Lab. I am also worked in collaboration',
      moreInfo: 'https://cse.kiit.ac.in/profiles/murari-mandal/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/10/murari_blue-Murari-Mandal-988x1024.jpg',
    },
    {
      name: 'Manjusha Pandey',
      phone: '8763999448',
      email: 'manjushafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Manjusha Pandey is presently working as an Associate Professor at School of Computer Engineering, Kalinga Institute of Industrial Technology, Deemed to be University, Bhubaneswar Odisha, India. She has teaching and research experience of more than 10 years. She did her',
      moreInfo: 'https://cse.kiit.ac.in/profiles/manjusha-pandey/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/manjusha.jpg',
    },
    {
      name: 'Partha Sarathi Paul',
      phone: '9836242994',
      email: 'parthasarathi.paulfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        '"Hello, my name is Partha Sarathi Paul. I have been a PhD Scholar in the Department of Computer Science & Engineering at the National Institute of Technology Durgapur, India since February 2014 and have completed my PhD finally on 2nd',
      moreInfo: 'https://cse.kiit.ac.in/profiles/partha-sarathi-paul/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/02/Partha-Sarathi-Paul.jpg',
    },
    {
      name: 'Lipika Dewangan',
      phone: '8328813061',
      email: 'lipika.dewanganfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Mrs. Lipika Dewangan has five years of teaching experience as a Lecturer in computer science and engineering in various organisations. Currently, she is working as an assistant professor in KIIT, Deemed to be University, Bhubaneswar.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/lipika-dewangan/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Lipika-Dewangan.jpg',
    },
    {
      name: 'Rajat Kumar Behera',
      phone: '9886072882',
      email: 'rajatkumar.beherafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Rajat Behera joined KIIT in July 2016 after spending 15 years in IT Industry. Since coming to KIIT, Deemed to be University, Bhubaneswar, he has served in the School of Computer Engineering. He did graduation from VSSUT with specialization in',
      moreInfo: 'https://cse.kiit.ac.in/profiles/rajat-kumar-behera/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Rajat-Kumar-Behera.jpg',
    },
    {
      name: 'Debashis Hati',
      phone: '9437028209',
      email: 'dhatifcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'He got his Engineering degree( CSE) from Bangalore University , done his masters in CSE from R.E.C.(currently N.I.T.), Rourkela in the year 1997. At the beginning of his career, he spent 4 years in industry and continuing teaching for last',
      moreInfo: 'https://cse.kiit.ac.in/profiles/debashis-hati/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Debashis-Hati.jpg',
    },
    {
      name: 'Harish Kumar Patnaik',
      phone: '9777799567',
      email: 'hpatnaikfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Harish Kumar Patnaik is currently working as an Assistant Professor (II) in School of Computer Engineering, KIIT University, Bhubaneswar. He has received his M. Tech. degree in Computer Science from School of Math- Stat & Computer Science, Utkal University. Currently',
      moreInfo: 'https://cse.kiit.ac.in/profiles/harish-kumar-patnaik/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Harish-Kumar-Patnaik.jpg',
    },
    {
      name: 'Suchismita Rout',
      phone: '7008219659',
      email: 'suchismita.routfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Suchismita Rout is currently working as an Associate Professor in School of Computer Engineering in KIIT Deemed-to-be University, Odisha, India. She received her M. Tech from NIT Rourkela and PhD from KIIT Deemed to be University in Computer Science',
      moreInfo: 'https://cse.kiit.ac.in/profiles/suchismita-rout/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/10/SR_photo-Dr-Suchismita-Rout.png',
    },
    {
      name: 'Pratyusa Mukherjee',
      phone: '9861937376',
      email: 'pratyusa.mukherjeefcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Pratyusa Mukherjee is currently working as an Assistant Professor in School of Computer Engineering, KIIT Deemed to be University, Bhubaneshwar, Odisha. She is also pursuing her Ph. D. in KIIT. She completed her M.Tech in Information Technology from Indian Institute',
      moreInfo: 'https://cse.kiit.ac.in/profiles/pratyusa-mukherjee/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2021/01/Pratyusa-Mukherjee.jpg',
    },
    {
      name: 'Jayeeta Chakraborty',
      phone: '8420916487',
      email: 'jayeeta.chakrabortyfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        "Jayeeta Chakraborty is (ongoing) Ph.D. from the department of Computer Science and Engineering in National Institute of Technology, Rourkela. She received her Master's degree from National Institute of Technology, Kurukshetra in the year 2017. Her current research interests include human",
      moreInfo: 'https://cse.kiit.ac.in/profiles/jayeeta-chakraborty/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/07/JayeetaChakraborty.jpg',
    },
    { name: 'Banhi Sanyal', phone: '8777048400' },
    {
      name: 'Priyanka Roy',
      phone: '8981610124',
      email: 'priyanka.royfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Priyanka Roy is an Assistant Professor in School of Computer Engineering, Kalinga Institute of Industrial Technology(KIIT) University, Bhubaneswar, India. She received her M.Tech degree in CSE from University of Calcutta. She is pursuing PhD in Indian Institute of Technology(Indian School',
      moreInfo: 'https://cse.kiit.ac.in/profiles/priyanka-roy/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2021/07/Priyanka-Roy-760x1024.jpg',
    },
    {
      name: 'Shilpa Das',
      phone: '7008810670',
      email: 'shilpa.dasfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        "Shilpa Das is an Assistant Professor in the School of Computer Engineering, KIIT University. She has received her B.Tech. in 2011 from BPUT and M.Tech. in 2013 in Computer Science & Engineering from ITER, S'O'A University. She is currently pursuing",
      moreInfo: 'https://cse.kiit.ac.in/profiles/shilpa-das/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/07/ShilpaDas.jpg',
    },
    {
      name: 'Anirban Bhattacharjee',
      phone: '9903380626',
      email: 'anirban.bhattacharjeefcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'I have completed my M.Tech and PhD from Indian Institute of Engineering Science and Technology. My Research areas include synthesis of reversible and quantum circuits, optimization of quantum circuits.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/anirban-bhattacharjee/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/07/anirbanbhattacharjee.jpg',
    },
    {
      name: 'Debanjan Pathak',
      phone: '9002505683',
      email: 'debanjan.pathakfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Debanjan Pathak received the B.tech (CSE) degree from Jalpaiguri Govt. Engg. College in 2014, M. Tech. (CSE) from IIT(ISM), Dhanbad in 2017. He is pursuing his Ph.D. (CSE) from NIT, Warangal. His area of research is Computer vision, Image Processing,',
      moreInfo: 'https://cse.kiit.ac.in/profiles/debanjan-pathak/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Debanjan-Pathak.jpg',
    },
    {
      name: 'Hitesh Mohapatra',
      phone: '9436992299',
      email: 'hiteshmahapatra.fcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Received his Ph.D. in Computer Science & Engineering in 2021 from Veer Surendra Sai University of Technology, Burla, India. He has contributed 22+ SCI and Scopus indexed research papers, 21 international/national conferences, and books on Software Engineering and C Programming',
      moreInfo: 'https://cse.kiit.ac.in/profiles/hitesh-mohapatra/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/07/hitesh.jpeg',
    },
    {
      name: 'Soumya Ranjan Mishra',
      phone: '8096177170',
      email: 'soumyaranjan.mishrafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Soumya Ranjan Mishra is presently working as an Assistant Professor (II) at the School of Computer Engineering, Kalinga Institute of Industrial Technology (Deemed to be University), Bhubaneswar Odisha, India. He has teaching and research experience of more than 10+',
      moreInfo: 'https://cse.kiit.ac.in/profiles/soumya-ranjan-mishra/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/07/SoumyaRanjan.jpg',
    },
    { name: 'Krishnandu Hazra', phone: '7384656641' },
    {
      name: 'Prasenjit Maiti',
      phone: '9078804402',
      email: 'prasenjit.maitifcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Prasenjit Maiti is an Assistant Professor in the School of Computer Engineering, KIIT DU, Bhubaneswar, India. He received his B.Tech (Computer Science and Engineering) in 2008 from the Maulana Abul Kalam Azad University of Technology (Formerly known as West Bengal',
      moreInfo: 'https://cse.kiit.ac.in/profiles/prasenjit-maiti/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/02/Prasenjit-Maiti.jpg',
    },
    {
      name: 'Jhalak Hota',
      phone: '9438134390',
      email: 'jhalak.hotafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Jhalak Hota has completed M.Tech. from NIT Rourkela. He has 4 experience of teaching experience.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/jhalak-hota/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Jhalak-Hota.jpg',
    },
    { name: 'Jaydeep Das', phone: '9474811813' },
    { name: 'Jamimamul Bakas', phone: '9064008165' },
    {
      name: 'Saikat Chakraborty',
      phone: '9937684296',
      email: 'saikat.chakrabortyfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Saikat Chakraborty obtained his B.Tech from the West Bengal University of Technology, M.Tech from Jadavpur University & Ph.D from NIT Rourkela in Computer Science & Engineering. He worked as an Graduate Apprentice Engineer in Bharat Sanchar Nigam Limited (BSNL)',
      moreInfo: 'https://cse.kiit.ac.in/profiles/saikat-chakraborty/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/01/Saikat-Chakraborty.jpg',
    },
    {
      name: 'Rabi Shaw',
      phone: '9007960872',
      email: 'rabi.shawfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Mr. Rabi Shaw is currently working as an Assistant Professor in the School of Computer Engineering, KIIT DU, Bhubaneswar, India. He received his B.E. (Computer Science & Engineering) and M.E. (Computer Science & Engineering) from University Institute of Technology, Burdwan',
      moreInfo: 'https://cse.kiit.ac.in/profiles/rabi-shaw/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/07/RabiShaw.jpg',
    },
    {
      name: 'Ipsita Paul',
      phone: '7205308557',
      email: 'ipsita.paulfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'B.Tech in Information Technology from KIIT du, industry working exp in TCS, M.Tech in CSE from KIIT du',
      moreInfo: 'https://cse.kiit.ac.in/profiles/ipsita-paul/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Ipsita-Paul-911x1024.jpg',
    },
    {
      name: 'Chandani Kumari',
      phone: '9861554963',
      email: 'chandani.kumarifcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Chandani Kumari has done her BTech from KIIT, Deemed to be University, Bhubaneswar. She is currently pursuing M.Tech. from KIIT, Deemed to be University, Bhubaneswar. She has industrial experience in IT sector and is a certified trainer in Core',
      moreInfo: 'https://cse.kiit.ac.in/profiles/chandani-kumari/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Chandani-Kumari.jpg',
    },
    {
      name: 'Jayanta Mondal',
      phone: '7908003806',
      email: 'jayanta.mondalfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Jayanta Mondal has completed his PhD in CSE from KIIT University, Bhubaneswar in 2018. He has a total experience of 8 years in the field of teaching and research. His research interests include cryptography, sensitive data security, and data',
      moreInfo: 'https://cse.kiit.ac.in/profiles/jayanta-mondal/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/09/Jayanta-Mondal.jpg',
    },
    {
      name: 'Sujoy Datta',
      phone: '8093713885',
      email: 'sdattafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Sujoy Datta has 6 years of experience in teaching, teaching B.Tech and M.Tech classes in Bhubaneswar , Odisha. He earned an M.Tech in Computer Science and Data Processing from IIT Kharagpur, India.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/sujoy-datta/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/sujoy_datta-Sujoy-Datta.jpg',
    },
    { name: 'Tanamay Swain', phone: '9437389858' },
    { name: 'BSP Mishra', phone: '7978054232' },
    {
      name: 'Amulya Ratna Swain',
      phone: '9439627127',
      email: 'amulyafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Amulya Ratna Swain received his M.E. degree in Software Engineering from Jadavpur University, Calcutta, India in 2006. He received the PhD degree in Computer Science from Indian Institute of Science, Bangalore, India, in 2013. He has ten years of teaching',
      moreInfo: 'https://cse.kiit.ac.in/profiles/amulya-ratna-swain/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Amulya-Ratna-Swain-amulya-swain.jpg',
    },
    {
      name: 'Asif Uddin Khan',
      phone: '9337202290',
      email: 'asif.khanfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Received Ph.D. degree in Computer Science from Utkal University, Bhubaneswar. Completed Ph.D. coursework from National Central University Taiwan, M.Tech in Computer Science & Engg from IIIT Bhubaneswar and B.Tech in Computer Science & Engg. from CV Raman College of Engineering',
      moreInfo: 'https://cse.kiit.ac.in/profiles/asif-uddin-khan/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Asif-Uddin-Khan.jpg',
    },
    {
      name: 'Dayal Kumar Behera',
      phone: '9853334495',
      email: 'dayal.beherafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr Dayal Kumar Behera, is working as an Asst. Professor (II) in the School of Computer Engineering, KIIT Deemed to be University, Bhubaneswar, Odisha. He is an enthusiastic, proactive faculty member and researcher with more than fifteen years of experience',
      moreInfo: 'https://cse.kiit.ac.in/profiles/dayal-kumar-behera/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Dayal-Kumar-Behera.jpg',
    },
    { name: 'Mandakini Priyadarshini', phone: '8917364496' },
    { name: 'Sharbani Purkayastha', phone: '9101726687' },
    {
      name: 'Sarita Mishra',
      phone: '9108172521',
      email: 'sarita.mishrafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        "Pursued Bachelor's degree from College of Engineering & Technology, Bhubaneswar. Worked as an Associate Software Engineer at Accenture for around 2 years. Pursued Master's degree from Kalinga Institute of Industrial Technology, Bhubaneswar. Currently pursuing Ph.D from Kalinga Institute of Industrial",
      moreInfo: 'https://cse.kiit.ac.in/profiles/sarita-mishra/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Sarita-Mishra.jpg',
    },
    {
      name: 'Soumya Ranjan Nayak',
      phone: '8328911292',
      email: 'soumyaranjan.nayakfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Soumya Ranjan Nayak is currently working as Senior Assistant Professor in the School of Computer Engineering, Kalinga Institute of Industrial technology (KIIT) Deemed to be University, Odisha. He received his Ph.D and M.Tech degree in Computer Science and Engineering',
      moreInfo: 'https://cse.kiit.ac.in/profiles/soumya-ranjan-nayak/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Soumya-Ranjan-Nayak.jpg',
    },
    { name: 'Om Prakash Singh', phone: '8091769503' },
    {
      name: 'Sampriti Soor',
      phone: '6297669108',
      email: 'sampriti.soorfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Sampriti Soor received the B.Tech. degree in Information Technology from West Bengal University of Technology, Kolkata, and an M.E. degree in Software Engineering from Jadavpur University, Kolkata in 2011 and 2015 respectively. From 2012 to 2013, he worked as a',
      moreInfo: 'https://cse.kiit.ac.in/profiles/sampriti-soor/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Sampriti-Soor.jpg',
    },
    { name: 'MD. Shah Fahad', phone: '9973766537' },
    {
      name: 'Aradhana Behura',
      phone: '7787821733',
      email: 'aradhana.behurafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        "Aradhana Behura is currently working as an Assistant Professor in the School of Computer Engineering, KIIT Deemed to be University. She has obtained her Bachelor's degree from VSSUT, Burla, Master's degree in Computer Science and Engineering from Veer Surendra Sai",
      moreInfo: 'https://cse.kiit.ac.in/profiles/aradhana-behura/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/07/Aradhana-Behura.jpg',
    },
    {
      name: 'Mainak Chakraborty',
      phone: '8777351940',
      email: 'mainak.chakrabortyfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Mainak Chakraborty (Senior Member, IEEE): is presently pursuing his Ph.D. (thesis submitted ) from Defence Institute of Advanced Technology (DIAT), an autonomous institute under the Ministry of Defence, Girinagar, Pune, INDIA. He was an Assistant Professor (C.S.E) in the Dream',
      moreInfo: 'https://cse.kiit.ac.in/profiles/mainak-chakraborty/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Mainak-Chakraborty.jpg',
    },
    { name: 'A. Ranjith', phone: '7981195876' },
    {
      name: 'Ajit Kumar Pasayat',
      phone: '7008588187',
      email: 'ajit.pasayatfcs@kiit.ac.in',
      jobTitle: 'Asst. Prof',
      description:
        'Ajit Kumar Pasayat is currently working as an assistant professor in the School of Computer Science Engineering at Kalinga Institute of Industrial Technology (KIIT), DU, India. He received B Tech in Information Technology from C. V. Raman Global University, Bhubaneswar,',
      moreInfo: 'https://cse.kiit.ac.in/profiles/ajit-kumar-pasayat/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Ajit-Kumar-Pasayat.jpg',
    },
    {
      name: 'Raghunath Dey',
      phone: '9853338925',
      email: 'raghunath.deyfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Raghunath Dey is currently working as an Assistant Professor in School of Computer Engineering Department, KIIT Deemed to be University, Bhubaneswar, Odisha. He has done M.E. in Information Technology from Jadavpur University, Kolkata, W.B. in the year 2012. Dr.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/raghunath-dey/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Raghunath-Dey.jpg',
    },
    {
      name: 'Mainak Biswas',
      phone: '8788463370',
      email: 'mainak.biswasfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Mainak Biswas, PhD, is a computer scientist with specialization in the application of machine learning and deep learning in the biomedical domain. His research is inspired by providing an effective solution for computer-aided diagnosis of diverse diseases. His PhD specialization',
      moreInfo: 'https://cse.kiit.ac.in/profiles/mainak-biswas/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Mainak-Biswas.jpg',
    },
    { name: 'Saurajit Behera', phone: '7292811677' },
    { name: 'Jagannath Dass', phone: '9971115939' },
    {
      name: 'Sovan Kumar Sahoo',
      phone: '9804554434',
      email: 'sovan.sahoofcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Sovan Kumar Sahoo is an Assistant Professor at the School of Computer Engineering, KIIT Bhubaneshwar. He is pursuing Ph.D. from the Department of Computer Science & Engineering, IIT Patna. He has spent the last seven years conducting research in Natural',
      moreInfo: 'https://cse.kiit.ac.in/profiles/sovan-kumar-sahoo/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Sovan-Kumar-Sahoo.jpg',
    },
    {
      name: 'Abhaya Kumar Sahoo',
      email: 'abhaya.sahoofcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Abhaya Kumar Sahoo is currently working as an Associate Professor in School of Computer Engineering, KIIT Deemed to be University, Odisha. He has completed his B. Tech, M. Tech and Ph.D. from KIIT Deemed to be University in 2010,',
      moreInfo: 'https://cse.kiit.ac.in/profiles/abhaya-kumar-sahoo/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/AbhayakumarSahoo.jpg',
    },
    {
      name: 'Abhishek Raj',
      email: 'abhishek.rajfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'I am an accomplished assistant professor specializing in the field of Computer Science and Engineering (CSE) with a focus on Machine Learning , Hardware Security and Computer Architecture. With a strong academic background and expertise in cutting-edge technologies, I have',
      moreInfo: 'https://cse.kiit.ac.in/profiles/abhishek-raj/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/08/abhisek-raj.jpeg',
    },
    {
      name: 'Abhishek Ray',
      email: 'arayfcs@kiit.ac.in',
      jobTitle: 'Associate Professor & Associate Dean (T&P)',
      description:
        'With the quality of Novelty and Transparency a teacher who is a self motivated and loves of life as a teacher is to engage deeply with students to enhance their professional career. Over 23 years of experience in teaching, research',
      moreInfo: 'https://cse.kiit.ac.in/profiles/abhishek-ray/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Abhishek-Ray-Passport-Photo.jpg',
    },
    {
      name: 'Abinas Panda',
      email: 'abinas.pandafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Abinas Panda currently serves as an Assistant Professor in the School of Computer Engineering. He is pursuing his Doctoral course at the National Institute of Technology, Rourkela. He has completed his Master’s Degree from the Department of Computer Science &',
      moreInfo: 'https://cse.kiit.ac.in/profiles/abinas-panda/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Abinas-Panda.jpg',
    },
    {
      name: 'Adyasha Dash',
      email: 'adyasha.dashfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        "Mrs. Adyasha Dash is currently working as an Assistant professor in School Of Computer Engineering, KIIT Deemed to be University,India.She has 5 years of teaching experience.she holds a bachelor's degree in Computer Science and Engineering from Silicon Institute of Technology",
      moreInfo: 'https://cse.kiit.ac.in/profiles/adyasha-dash/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2018/08/Adyasha-Dash-fcs.jpg',
    },
    {
      name: 'Ajay Anand',
      email: 'ajay.anandfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        '"He completed his B.Tech. In Mechanical Engineering from IIT Madras in 2003 and M.S. from State University of New York in 2006 after which he worked as Software Engineer in Game Development and Virtual Reality Systems before returning to India',
      moreInfo: 'https://cse.kiit.ac.in/profiles/ajay-anand/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Ajay-Anan.jpg',
    },
    {
      name: 'Ajay Kumar Jena',
      email: 'ajay.jenafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Ajay Kumar Jena is working as Assistant Professor in the School of Computer Engineering, KIIT Deemed to be University. He has obtained his Master degree in Computer Science and Engineering from BPUT, Rourkela and received his Ph. D. degree',
      moreInfo: 'https://cse.kiit.ac.in/profiles/ajay-kumar-jena/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Ajay-Kumar-Jena.jpg',
    },
    {
      name: 'Ajaya Kumar Parida',
      email: 'ajaya.paridafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Ajaya Kumar Parida is currently working as an Associate Professor in the School of Computer Engineering, Kalinga Institute of Industrial Technology (KIIT), Deemed to be University, Bhubaneswar, India. He has received his B.E degree from KIIT University, India and MBA',
      moreInfo: 'https://cse.kiit.ac.in/profiles/ajaya-kumar-parida/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Ajaya-Kumar-Parida.jpg',
    },
    {
      name: 'Aleena Swetapadma',
      email: 'aleena.swetapadmafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Aleena Swetapadma started her career as assistant professor in School of Computer Engineering, Kalinga Institute of Industrial Technology (KIIT) University, Bhubaneswar, India from 2016. She did her school education (6th to 12th) with scholarship from Govt. of India in JNV,',
      moreInfo: 'https://cse.kiit.ac.in/profiles/aleena-swetapadma/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2018/08/Aleena-Swetapadma.jpg',
    },
    {
      name: 'Alok Kumar Jagadev',
      email: 'alok.jagadevfcs@kiit.ac.in',
      jobTitle: 'Professor',
      description:
        'Dr. Alok Kumar Jagadev is currently working as Professor in the School of Computer Engineering, KIIT Deemed to be University. He has obtained his Master degree from Utkal University in the year 2001 and also obtained Ph.D. degree for',
      moreInfo: 'https://cse.kiit.ac.in/profiles/alok-kumar-jagadev/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Alok-Kumar-Jagadev.jpg',
    },
    {
      name: 'Ambika Prasad Mishra',
      email: 'ambikaprasad.mishrafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Ambika earned his PhD in Computational Neuroscience from Prestigious City University of Hong Kong (QS Rank 48) and did his postdoctoral studies from the department of Public health from the City University of Hongkong. He studied the role different',
      moreInfo: 'https://cse.kiit.ac.in/profiles/ambika-prasad-mishra/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/05/Ambikaprasad-mishra.jpg',
    },
    {
      name: 'Amiya Kumar Dash',
      email: 'amiya.dasfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Amiya Kumar Dash is currently serves as Assistant Professor in School of Computer Engineering.He is currently pursuing his Doctoral course in International Institute of Information Technology, Bhubaneswar . He has completed his Master’s Degree from Department of Computer Science &',
      moreInfo: 'https://cse.kiit.ac.in/profiles/amiya-kumar-dash/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Amiya-Dash.jpg',
    },
    {
      name: 'Amiya Ranjan Panda',
      email: 'amiya.pandafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Amiya Ranjan Panda has seven years of research experience in DRDO and one year of teaching experience.\n                                              He received the B.Tech. degree in information technology from Biju Patnaik University of Technology, Rourkela, India, in 2009, and the M.Tech.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/amiya-ranjan-panda/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Dr.-Amiya-Ranjan-Panda-Amiya-Panda.jpg',
    },
    {
      name: 'Anjan Bandyopadhyay',
      email: 'anjan.bandyopadhyayfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Anjan Bandyopadhyay is an Assistant Professor of Kalinga Institute of Industrial Technology, Bhubaneswar, Odisha , India. He has completed his Ph.D from National Institute of Technology, Durgapur, West Bengal, India in Vishveshwarya Ph.D fellowship under MHRD.\n                                              He has',
      moreInfo: 'https://cse.kiit.ac.in/profiles/anjan-bandyopadhyay/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Anjan-Bandyopadhyay.jpg',
    },
    {
      name: 'Anuja Kumar Acharya',
      email: 'anujafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Anuja Kumar Acharya is an assistant professor at School of Computer Engineering, KIIT Deemed to be university. He received his PhD degree in Computer Science from KIIT Deemed to be University, Bhubaneswar in the year',
      moreInfo: 'https://cse.kiit.ac.in/profiles/anuja-kumar-acharya/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/08/Anuja-Acharya.jpeg',
    },
    {
      name: 'Arup Abhinna Acharya',
      email: 'aacharyafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Arup Abhinna Acharya is an Associate Professor in the School of Computer Engineering, KIIT Deemed to be University, Bhubaneswar,Odisha, India. He received his Ph.D degree from KIIT Deemed to be University Bhubaneswar in the year 2016. He worked on',
      moreInfo: 'https://cse.kiit.ac.in/profiles/arup-abhinna-acharya/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Arup-Acharya.jpg',
    },
    {
      name: 'Arup Sarkar',
      email: 'arup.sarkarfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        '"Arup Sarkar, M.E, PhD(Pursuing), is an Assistant Professor of School of Computer Engineering. Before joining KIIT Deemed to be University,Arup Sarkar worked as an Assistant Professor at DIT University, Dehradun. He also previously served as an Assistant Professor at',
      moreInfo: 'https://cse.kiit.ac.in/profiles/arup-sarkar/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Arup-Sarkar.jpg',
    },
    {
      name: 'Ashish Singh',
      email: 'ashish.singhfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Ashish Singh is working as an Assistant Professor, School of Computer Engineering, Kalinga Institute of Industrial Technology, Deemed to be University, Bhubaneswar, Odisha-751024. He has completed his Ph. D. in Computer Science & Engineering from National Institute of Technology Patna',
      moreInfo: 'https://cse.kiit.ac.in/profiles/ashish-singh/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Ashish-Singh.jpg',
    },
    {
      name: 'Banchhanidhi Dash',
      email: 'banchhanidhi.dashfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Banchhanidhi Dash has completed his Ph.D. in CSE from KIIT, Deemed to be University, Bhubaneswar. He has more than 10 years of teaching and research experience in the field of high performance computer architecture. Currently, he is working',
      moreInfo: 'https://cse.kiit.ac.in/profiles/banchhanidhi-dash/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Banchhanidhi-Dash.jpg',
    },
    {
      name: 'Benazir Neha',
      email: 'benazir.nehafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Ph. D. (IT, VSSUT, Burla, Pursuing), M. Tech. (IT, VSSUT, Burla)\n                                              Specialisation: Cloud Computing, Fog Computing and Osmotic Computing\n                                              Field of Interest: Data Structure, Database Management System, Theory of Computation and Computer Architecture."',
      moreInfo: 'https://cse.kiit.ac.in/profiles/benazir-neha/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/10/benazir1-Benazir-Neha.jpeg',
    },
    {
      name: 'Bhabani Shankar Prasad Mishra',
      email: 'bsmishrafcs@kiit.ac.in',
      jobTitle: 'Professor',
      description:
        'Bhabani Shankar Prasad Mishra was born in Talcher, Odisha, India in 1981. He received the B.Tech. in Computer Science and Engineering from Biju Pattanaik Technical University, Odisha in 2003, M.Tech. degree in Computer Science and Engineering from the KIIT',
      moreInfo:
        'https://cse.kiit.ac.in/profiles/bhabani-shankar-prasad-mishra/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/05/BSP_profile-photo.jpg',
    },
    {
      name: 'Bhaswati Sahoo',
      email: 'bhaswati.sahoofcs@kiit.ac.in',
      jobTitle: 'Assisstant Professor',
      description:
        'Bhaswati Sahoo has five years of experience in Kalinga Institute of Industrial Technology, Deemed to be University, Bhubaneswar. Various subjects like programming in C, Multimedia Applications, Compiler Design, Data Structures and Algorithms, Data Base and Management Systems were taught by',
      moreInfo: 'https://cse.kiit.ac.in/profiles/bhaswati-sahoo/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/IMG-20180420-WA0002-Bhaswati-Sahoo.jpg',
    },
    {
      name: 'Bindu Agarwalla',
      email: 'bindu.agarwalfcs@kiit.ac.in',
      jobTitle: 'Assisstant Professor',
      description:
        'Bindu Agarwalla has 15 years of teaching experience in University like Manipal, KIIT. Accomplished educator with demonstrated ability to teach, motivate, and direct students in the areas of Computer Science while maintaining high interest and achievement. Graduated in Computer Science',
      moreInfo: 'https://cse.kiit.ac.in/profiles/bindu-agarwalla/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Bindu-Agarwal.jpg',
    },
    {
      name: 'Chandra Shekhar',
      email: 'chandra.shekharfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Chandra Shekhar (Ph.D. Pursuing, Indian Institute of Technology, Bhubaneswar) is an active researcher in the areas of the Internet of Things(IoT), Wireless Sensor Networks(WSN), Intelligent Transporation Systems(ITS), and Information security. Some of his research works have been published in ranked',
      moreInfo: 'https://cse.kiit.ac.in/profiles/chandra-shekhar/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/05/chandra-final-chandra-shekhar.jpg',
    },
    {
      name: 'Chittaranjan Pradhan',
      email: 'chittaranjanfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Chittaranjan Pradhan has obtained his Doctorate, Masters and Bachelor degrees in Computer Science & Engineering discipline. Currently, he is working as Associate Professor at School of Computer Engineering, Kalinga Institute of Industrial Technology (KIIT) Deemed to be University, Bhubaneswar,',
      moreInfo: 'https://cse.kiit.ac.in/profiles/chittaranjan-pradhan/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2018/08/Chittaranjan-Pradhan.jpg',
    },
    {
      name: 'Deependra Singh',
      email: 'deependra.singhfcs@kiit.ac.in',
      jobTitle: 'Assistant professor',
      description:
        'I have received my b.tech degree from AITH kanpur and completed my m.tech degree from IIT kharagpur.Currently I have been working as a assistant professor in KIIT bhubaneshwar.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/deependra-singh/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/07/Deependra-Singh.jpg',
    },
    {
      name: 'Dipti Dash',
      email: 'dipti.dashfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Dipti Dash has completed her Ph.D in CSE from KIIT, Deemed to be University, Bhubaneswar in 2019. She has 6 years of teaching experience.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/dipti-dash/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Dipti-Dash-813x1024.jpg',
    },
    {
      name: 'G B Mund',
      email: 'mund@kiit.ac.in',
      jobTitle: 'Professor',
      description:
        'G B Mund earned his Ph. D. degree in Computer Science and Engineering from IIT Kharagpur. He has over 27 years of teaching / research experience. He joined Kalinga Institute of Industrial Technology (KIIT) in the year 1997.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/g-b-mund/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/gbmund-GB-Mund.jpeg',
    },
    {
      name: 'Gananath Bhuyan',
      email: 'gananatha.bhuyanfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        "Gananath Bhuyan has completed degree from Government college of Enginering Kalahandi, Bhawanipatna in the year 2013. He completed master's with Computer Science specialization from NIT Durgapur in the the year 2016. After post graduation he joined an MNC named Factset",
      moreInfo: 'https://cse.kiit.ac.in/profiles/gananath-bhuyan/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Gananatha-Bhuyan.jpg',
    },
    {
      name: 'Himansu Das',
      email: 'himanshufcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Himansu Das is working as an as Associate Professor in the School of Computer Engineering, KIIT University, Bhubaneswar, Odisha, India. He has received his B. Tech and M. Tech degree from Biju Pattnaik University of Technology (BPUT), Odisha, India. He',
      moreInfo: 'https://cse.kiit.ac.in/profiles/himansu-das/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2018/08/Himansu.jpg',
    },
    {
      name: 'Hrudaya Kumar Tripathy',
      email: 'hktripathyfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Hrudaya Kumar Tripathy is an Associate Professor at the School of Computer Engineering. He has completed Ph.D. from Berhampur University, M.Tech(CSE) from IIT, Guwahati, and received Post Doctoral Fellowship from the Ministry of Higher Education Malaysia. Dr. Tripathy, having 20 years of teaching experience with',
      moreInfo: 'https://cse.kiit.ac.in/profiles/hrudaya-kumar-tripathy/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Hrudaya-Kumar-Tripathy.jpg',
    },
    {
      name: 'Jagannath Singh',
      email: 'jagannath.singhfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Jagannath Singh has completed Ph. D. from NIT Rourkela in the year 2016 in Software Engineering. Now, he is working as Assistant Professor in the School of Computer Engineering, KIIT deemed to be University, Bhubaneswar. He has eight',
      moreInfo: 'https://cse.kiit.ac.in/profiles/jagannath-singh/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Jagannath-Singh.jpg',
    },
    {
      name: 'Jasaswi Prasad Mohanty',
      email: 'jasaswi.mohantyfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Jasaswi Prasad Mohanty received his M.Tech. degree in Computer Science from Utkal University, Bhubaneswar, India in 2006. He received his Ph.D degree in Computer Science & Engineering from Indian Institute of Technology Kharagpur, India, in 2020. He has more than',
      moreInfo: 'https://cse.kiit.ac.in/profiles/jasaswi-prasad-mohanty/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Jasaswi-Prasad-Mohanty.jpg',
    },
    {
      name: 'Jay Sarraf',
      email: 'jay.sarraffcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Jay Sarraf currently works as an Assistant Professor at the School of Computer Engineering, KIIT University. With more than 7 years of experience supporting marketing and development to enhance internal processes for small firms, he is a multifaceted, self-starter,',
      moreInfo: 'https://cse.kiit.ac.in/profiles/jay-sarraf/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2018/12/Dr-Jay-Sarraf.jpg',
    },
    {
      name: 'Jayanti Dansana',
      email: 'jayantifcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Jayanti Dansana has 10 years of experience in education,teaching since 2008 .Her research contribution includes in data mining,big data technology.She has published around 15 papers in the above research area.She is currently working as Assistant Professor in KIIT Deemed',
      moreInfo: 'https://cse.kiit.ac.in/profiles/jayanti-dansana/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Jayanti-Dansana.jpg',
    },
    {
      name: 'Joy Dutta',
      email: 'joy.duttafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Joy Dutta is presently working as an Assistant Professor in the School of Computer Engineering, Bhubaneswar, Orissa, India. He holds a BSc degree in Physics (Honours), followed by Post BSc BTech and MTech in Computer Science & Engineering from',
      moreInfo: 'https://cse.kiit.ac.in/profiles/joy-dutta/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/01/Joy-Dutta-Joy-Dutta.jpg',
    },
    {
      name: 'Junali Jasmine Jena',
      email: 'junali.jenafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Junali Jasmine Jena has above 5 years of experience in teaching under-graduate and post-graduate students in the field of Computer Science and Information technology. She has graduated from Parala Maharaja Engg. College, Berhampur, Odisha (govt. funded institution) and did',
      moreInfo: 'https://cse.kiit.ac.in/profiles/junali-jasmine-jena/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/junali.jpg',
    },
    {
      name: 'Jyotiprakash Mishra',
      email: 'jyotiprakash.mishrafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Jyotiprakash graduated from the prestigious BITS - Pilani with a degree in BE (Computer Science) in 2010. After serving as a Senior Member of Technical Staff with Oracle for 4 years, he went on to pursue his MS (Computer Science)',
      moreInfo: 'https://cse.kiit.ac.in/profiles/jyotiprakash-mishra/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2021/01/Jyotiprakash-Mishra.jpg',
    },
    {
      name: 'Krishna Chakravarty',
      email: 'krishna.chakravartyfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'She is an accomplished Information Technology (IT) professional with extensive experience working in India, USA and UK in providing services for Fortune 500 clients as well as having a deep understanding of the needs of IT in the industry. She',
      moreInfo: 'https://cse.kiit.ac.in/profiles/krishna-chakravarty/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Krishna-Chakravarty.jpg',
    },
    {
      name: 'Krutika Verma',
      email: 'krutika.vermafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        "I have completed my master's from the University of Hyderabad. Currently pursuing Ph.D. from IIT Patna. My research interest lie in the field of optimization of deep learning. Recently joined as an Assistant Professor in KIIT.",
      moreInfo: 'https://cse.kiit.ac.in/profiles/krutika-verma/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Krutika-Verma.jpg',
    },
    {
      name: 'Kumar Devadutta',
      email: 'kdevduttafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'He got his Engineering degree( CSE) from Bangalore University , done his masters in CSE from R.E.C.(currently N.I.T.), Rourkela in the year 1997. At the beginning of his career, he spent 4 years in industry and continuing teaching for last',
      moreInfo: 'https://cse.kiit.ac.in/profiles/kumar-devadutta/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2021/07/Kumar-Devdutta.jpg',
    },
    {
      name: 'Kunal Anand',
      email: 'kunal.anandfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        "Mr. Kunal Anand, received his Master's in Information and Communication Technology from IIT Kharagpur, India. At present, Mr. Anand is pursuing Ph.D. from Kalinga Institute of Industrial Technology, Deemed to be University, Bhubaneswar. He has more than 12 yrs. of",
      moreInfo: 'https://cse.kiit.ac.in/profiles/kunal-anand/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Kunal-Anand-Kunal-Anand-1-982x1024.jpg',
    },
    {
      name: 'Lalit Kumar Vashishtha',
      email: 'vashishthafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Lalit holds a Masters degree from the prestigious Indian Institute of Technology - Guwahati. He is also an alumni of Aligarh Muslim University, Aligarh.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/lalit-kumar-vashishtha/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/l-Lalit-Vashishtha.jpg',
    },
    {
      name: 'Leena Das',
      email: 'ldasfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Leena Das has 22 years of experience in teaching. She is working as an assistant professor in KIiT Deemed to be university, Bhubaneswar since 2007. She is a life time member of ISCA. Her areas of interest are Real-time',
      moreInfo: 'https://cse.kiit.ac.in/profiles/leena-das/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Leena-Das-2.jpg',
    },
    {
      name: 'Lipika Mohanty',
      email: 'lipika.mohantyfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Ms. Lipika Mohanty has completed her M. Tech. from NIT Durgapur, B. Tech from Parala Maharaja Engineering College. Her research area includes Image Processing and Machine Learning.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/lipika-mohanty/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Lipika-Mohanty-829x1024.jpg',
    },
    {
      name: 'M Nazma BJ Naskar',
      email: 'nazma.naskarfcs@kiit.ac.in',
      jobTitle: 'Assistent professor',
      description:
        'She start her journey of teaching as lecture in the department of Information technology from july 2009 at\n                                              Seacom Engineering College (under W.B.U.T. –now M.A.K.A.U.T. ) and taught a variety of subjects\n                                              including laboratory class. And on 4th july 2017',
      moreInfo: 'https://cse.kiit.ac.in/profiles/m-nazma-bj-naskar/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/M.NAZMA-B.J-NASKAR.jpg',
    },
    {
      name: 'Madhabananda Das',
      email: 'mndas_prof@kiit.ac.in',
      jobTitle: 'Senior Professor',
      description:
        'Dr. Madhabananda Das is working as a Senior Professor in the School of Computer Engineering at KIIT Deemed to be University, Bhubaneswar, Odisha with 38 years of working experience which includes 23 years of teaching and research experiences and 15',
      moreInfo: 'https://cse.kiit.ac.in/profiles/madhabananda-das/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Madhabananda-Das.jpg',
    },
    {
      name: 'Mainak Bandyopadhyay',
      email: 'mainak.bandyopadhyayfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Mainak Bandyopadhyay has completed B.Tech in CSE from GBTU Lucknow, M.Tech from MNNIT-Allahabad and P.hD from MNNIT-Allahabad. His area of Interest includes Spatial Computing , A.I, M.L and Deep Learning.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/mainak-bandyopadhyay/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Mainak-Bandyopathyay.jpg',
    },
    {
      name: 'Manas Ranjan Biswal',
      email: 'manas.biswalfcs@kiit.ac.in',
      jobTitle: 'Faculty Associate',
      description:
        'Mr. Manas Ranjan Biswal has done Bachelors of Engineering in Chemical discipline from IGIT Sarang, Utkal University, 2000. He has more than 16 years of IT experience in various software industries including CGI,IBM,TCS US in various domain and different positions.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/manas-ranjan-biswal/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Manas-Ranjan-Biswal.jpg',
    },
    {
      name: 'Manas Ranjan Nayak',
      email: 'manas.nayakfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Manas Ranjan Nayak is working as an Assistant Professor in School of Computer Engineering, KIIT Deemed to be University, Bhubaneswar. He has completed his Ph. D. and M.Tech from Jadavpur University, Kolkata. He has more than 3 years of',
      moreInfo: 'https://cse.kiit.ac.in/profiles/manas-ranjan-nayak/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/09/Manas-Ranjan-Nayak-1.jpg',
    },
    {
      name: 'Mandakini Priyadarshani Behera',
      email: 'mandakini.beherafcs@kiit.ac.in',
      jobTitle: 'Faculty Associate',
      description:
        "I have completed my Bachelor's degree and Master's degree in Computer Science and Engineering.Currently Pursuing Ph.D. My research interest lie in the field of Maching Learning. having 3 years of teaching experience as a Lecturer in Computer Science and Engineering",
      moreInfo:
        'https://cse.kiit.ac.in/profiles/mandakini-priyadarshani-behera/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/10/Mandakini.jpg',
    },
    {
      name: 'Manoj Kumar Mishra',
      email: 'manojfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Manoj Kumar Mishra has fourteen years of experience, out of which 1.5 years of industry experience in Mainframe Technologies and the rest in imparting education to undergraduate (B.Tech) and Postgraduate (M.Tech) students. He holds a Ph.D in Computer Science',
      moreInfo: 'https://cse.kiit.ac.in/profiles/manoj-kumar-mishra/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Manoj-Kumar-Mishra-1.jpg',
    },
    {
      name: 'Meghana G Raj',
      email: 'meghana.rajfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Meghana G Raj received her bachelor’s degree from Visveswaraya Technological University, Belagavi, India in 2009, Master’s degree from National Institute of Technology Karnataka, Surathkal, India in 2011 and PhD in the field of Computer Science and Engineering from KiiT',
      moreInfo: 'https://cse.kiit.ac.in/profiles/meghna-g-raj/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/meghna-813x1024.jpeg',
    },
    {
      name: 'Minakhi Rout',
      email: 'minakhi.routfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Minakhi Rout has 12 years of teaching experience in teaching and research across reputed institution of Odisha as well as Hyderabad. she has completed B.tech in CSE from KIIT University in 2005. She did her post graduation and Ph.D. in',
      moreInfo: 'https://cse.kiit.ac.in/profiles/minakhi-rout/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/20180318_114601-Minakshi-rout.jpg',
    },
    {
      name: 'Mohit Ranjan Panda',
      email: 'mohit.pandafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Completed his PhD in 2019 on the area "Mobile robot path planning under cluttered environment". He completed his M Tech in 2009 and B Tech in 2001in the branch of Computer Engineering. He has 17 years of teaching experience to',
      moreInfo: 'https://cse.kiit.ac.in/profiles/mohit-ranjan-panda/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/09/Mohit-Ranjan-Panda.jpg',
    },
    {
      name: 'Mukesh Kumar',
      email: 'mukesh.kumarfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description: 'B.E, M.E, Ph.D (IIT BHU), VARANASI',
      moreInfo: 'https://cse.kiit.ac.in/profiles/mukesh-kumar/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Mukesh-Kumar.jpg',
    },
    {
      name: 'N Biraja Isac',
      email: 'nbiraja.isacfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description: '',
      moreInfo: 'https://cse.kiit.ac.in/profiles/n-biraja-isac/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/biraja-N-Biraja-Isac.jpg',
    },
    {
      name: 'Nachiketa Tarasia',
      email: 'ntarasiafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Nachiketa Tarasia has fifteen years of experience in education, teaching under graduate and post graduate students. Has 8 years of teaching experience in KIIT, Deemed to be University. Nachiketa graduated from ITER, BPUT with degree in Computer Science & Technology.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/nachiketa-tarasia/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Nachiketa-Tarasia-1.jpg',
    },
    {
      name: 'Naliniprava Behera',
      email: 'npbeherafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Naliniprava Behera has 14 years of Teaching Experience in the field of computer science and engineering,she has completed her masters degree(M.Tech) from I.I.T Madras in 2011, and is currently continuing her Ph.D at N.I.T Meghalaya.She has joined KIIT, Deemed to',
      moreInfo: 'https://cse.kiit.ac.in/profiles/naliniprava-behera/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Nalini-Prara-behera.jpg',
    },
    {
      name: 'Namita Panda',
      email: 'npandafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Mrs Namita Panda is an Assistant Professor in the School of Computer Engineering, KIIT Deemed to be University, Bhubaneswar, Odisha, India. Currently, she is pursuing her Ph.D. at KIIT Deemed to be University Bhubaneswar and is going to submit her',
      moreInfo: 'https://cse.kiit.ac.in/profiles/namita-panda/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Namita-Panda.jpg',
    },
    {
      name: 'Nibedan Panda',
      email: 'nibedan.pandafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Aspire to work in a challenging work environment, which can effectively utilize as well as enhance my knowledge and working capacity.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/nibedan-panda/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2022/10/Nibedan-Panda.jpg',
    },
    {
      name: 'Niranjan Ray',
      email: 'niranjan_rayfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Niranjan Kumar Ray received Ph.D degree in Computer Science and Engineering from National Institute of Technology Rourkela India and is currently working as an Associate Professor in School of Computer Engineering at KIIT deemed to be University, Odisha, India. His',
      moreInfo: 'https://cse.kiit.ac.in/profiles/niranjan-kumar-ray/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Niranjan-Ray.jpg',
    },
    {
      name: 'Pinaki Sankar Chatterjee',
      email: 'pinakifcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Pinaki Sankar Chatterjee received his B.Tech degree in Information Technology from B.P.U.T, Orissa, India, his M.Tech degree in Computer Science from IIT Kharagpur, West Bengal, India, and his PhD degree in Computer Science from KIIT Deemed-to-be University Bhubaneswar, India.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/pinaki-sankar-chatterjee/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/pinaki-chatterjee.jpg',
    },
    {
      name: 'Prabhu Prasad Dev',
      email: 'prabhu.devfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Mr. Prabhu Prasad Dev is working as a Assistant Professor in School of Computer Engineering , KIIT, Deemed to be University, Bhubaneswar. He received his M. Tech degree in Computer Science and Engineering from KIIT, Deemed to be University, Bhubaneswar.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/prabhu-prasad-dev/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Prabhu-Prasad-Dev-1.jpg',
    },
    {
      name: 'Prachet Bhuyan',
      email: 'pbhuyanfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr.Prachet Bhuyan received his B.E in Computer Science & Engineering from Utkal University, Odisha. M.Tech with specialization in Computer Science & Engineering from VTU, Belgaum, Karnataka. Ph.D in Computer Science & Engineering from KIIT University, Bhubaneswar. He served in various',
      moreInfo: 'https://cse.kiit.ac.in/profiles/prachet-bhuyan/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Prachet-Bhuyan.jpg',
    },
    {
      name: 'Pradeep Kumar Mallick',
      email: 'pradeep.mallickfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Pradeep Kumar Mallick is currently working as Senior Associate Professor in the School of Computer Engineering , Kalinga Institute of Industrial technology (KIIT) Deemed to be University, Odisha, India .He has also served as Professor and Head Department of',
      moreInfo: 'https://cse.kiit.ac.in/profiles/pradeep-kumar-mallick/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Pradeep-Kumar-Mallick.jpg',
    },
    {
      name: 'Prasant Kumar Pattnaik',
      email: 'patnaikprasantfcs@kiit.ac.in',
      jobTitle: 'Professor',
      description:
        'Dr. Prasant Kumar Pattnaik, Ph.D (Computer Science), Fellow IETE, Senior Member IEEE is a Professor at the School of Computer Engineering, KIIT Deemed University, Bhubaneswar. He has more than a decade of teaching and research experience. Dr. Pattnaik has published',
      moreInfo: 'https://cse.kiit.ac.in/profiles/prasant-kumar-pattnaik/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/20200618_172649-01-816x1024.jpeg',
    },
    {
      name: 'Ramakant Parida',
      email: 'rparidafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Ramakant has 6 years of experience in teaching for B Tech students.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/ramakant-parida/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Ramakanta-Parida.jpg',
    },
    {
      name: 'Ramesh Kumar Thakur',
      email: 'ramesh.thakurfcs@kiit.ac.in',
      jobTitle: 'Asst. Professor',
      description:
        'RAMESH KUMAR THAKUR received the B.Tech. degree in information technology from the University of Kalyani, West Bengal, India, in 2014, and the M.Tech. degree in high performance computing from the NIT Durgapur, West Bengal, in 2016. He has done his',
      moreInfo: 'https://cse.kiit.ac.in/profiles/ramesh-kumar-thakur/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/10/Ramesh.jpg',
    },
    {
      name: 'Rina Kumari',
      email: 'rina.kumarifcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Rina Kumari has started her career in teaching as an Assistant Professor in the School of Computer Engineering, KIIT Deemed to be University, Bhubaneswar, Odisha in September 2022. Before joining KIIT, she completed her Ph.D at the Indian Institute',
      moreInfo: 'https://cse.kiit.ac.in/profiles/rina-kumari/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Rina-Kumari.jpg',
    },
    {
      name: 'Rinku Datta Rakshit',
      email: 'rinku.rakshitfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Rinku Datta Rakshit, presently working as an Associate professor at the School of Computer Engineering, Kalinga Institute of Industrial Technology, deemed to be University, Bhubaneswar, Odisha. She completed her B.Tech (Information Technology) in 2005 from Jalpaiguri Government Engineering College, Jalpaiguri,',
      moreInfo: 'https://cse.kiit.ac.in/profiles/rinku-datta-rakshit/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Rinku-Datta-Rakshit.jpg',
    },
    {
      name: 'Ronali Padhy',
      email: 'ronali.padhyfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        "Ronali Padhy is currently working as Assistant Professor in school of computer engineering, KIIT, Deemed to be University, Bhubaneswar. She has completed her bachelor's degree from Parala maharaja engineering college, Berhampur in the year 2015. Then she joined masters in",
      moreInfo: 'https://cse.kiit.ac.in/profiles/ronali-padhy/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Ronali-Padhy.jpg',
    },
    {
      name: 'Roshni Pradhan',
      email: 'roshni.pradhanfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Roshni Pradhan is working as an Assistant Professor in the School of Computer Engineering, where she has been since August, 2015 . Her research and publications deals with Cloud Computing and Data Mining. Her current research spans both scheduling heuristics',
      moreInfo: 'https://cse.kiit.ac.in/profiles/roshni-pradhan/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2018/08/Roshni-Pradhan.jpg',
    },
    {
      name: 'Samaresh Mishra',
      email: 'smishrafcs@kiit.ac.in',
      jobTitle: 'Dean, Professor',
      description:
        'Software Engineering( Cost Estimation, Back end estimation)',
      moreInfo: 'https://cse.kiit.ac.in/profiles/samaresh-mishra/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2018/08/Samaresh-Mishra-10-2-2021.jpg',
    },
    {
      name: 'Sankalp Nayak',
      email: 'sankalp.nayakfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Mr. Sankalp Nayak has completed his B.Tech. in computer science and engineering from KIIT, Deemed to be University, Bhubaneswar. He has worked as software developer at Lavelle networks. His area of interest is IoT and machine learning.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/sankalp-nayak/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Sankalp-Nayak.jpg',
    },
    {
      name: 'Santos Kumar Baliarsingh',
      email: 'santos.baliarsinghfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Santos Kumar Baliarsingh is working as an Assistant Professor in the School of Computer Engineering, KIIT, Deemed to be University, Bhubaneswar since 2019. Prof. Baliarsingh has completed his Ph.D. in Machine Learning from IIIT Bhubaneswar. He obtained his postgraduate degree',
      moreInfo: 'https://cse.kiit.ac.in/profiles/santos-kumar-baliarsingh/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Santos-Kumar-Baliarsingh.jpg',
    },
    {
      name: 'Santosh Kumar Pani',
      email: 'spanifcs@kiit.ac.in',
      jobTitle: 'Professor',
      description:
        'Santosh Kumar Pani is currently working as Professor in the School of Computer Engineering. He has over two decades of experience in teaching, research and administration in KIIT Deemed to be University. He has taught various core courses in Computer',
      moreInfo: 'https://cse.kiit.ac.in/profiles/santosh-kumar-pani/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Santosh-Pani.jpg',
    },
    {
      name: 'Santosh Kumar Swain',
      email: 'sswainfcs@kiit.ac.in',
      jobTitle: 'Professor',
      description:
        'Santosh Kumar Swain , has completed MCA from Jorhat Engineering College, Dibrugarha University, ASSAM and M. Tech (CS) degree from Utkal University, Bhubaneswar, Odisha, India. He has received his Ph. D. at the School of Computer Engineering at KIIT University,',
      moreInfo: 'https://cse.kiit.ac.in/profiles/santosh-kumar-swain/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/santosh-swain.jpg',
    },
    {
      name: 'Santwana Sagnika',
      email: 'santwana.sagnikafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Santwana Sagnika is an Assistant Professor at School of Computer Engineering, KIIT Deemed to be University. She has completed B. Tech and M. Tech in Computer Science and Engineering from KIIT. She is currently pursuing her Ph.D. in the field',
      moreInfo: 'https://cse.kiit.ac.in/profiles/santwana-sagnika/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Santwana-Sagnika-santwana-sagnika.jpg',
    },
    {
      name: 'Sarita Tripathy',
      email: 'sarita.tripathyfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Sarita Tripathy is currently working as an Assistant Professor in School of Computer Engineering, KIIT Deemed to be University, Odisha. She has completed her B.tech from National Institute of Science and Technology Bhubaneswar,M.Tech from College of Engineering and Technology(Govt.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/sarita-tripathy/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Sarita-Tripathy-1.jpg',
    },
    {
      name: 'Satarupa Mohanty',
      email: 'satarupafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Satarupa Mohanty is currently working as an Associate Professor, in School of Computer Engineering, KIIT University, Bhubaneswar. She received B.Tech, M.Tech, and PhD degrees in Computer Engineering from KIIT University, in 2002, 2006 and 2017 respectively. Her research area',
      moreInfo: 'https://cse.kiit.ac.in/profiles/satarupa-mohanty/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Satarupa-Mohanty-1.jpg',
    },
    {
      name: 'Satyananda Champati Rai',
      email: 'satya.raifcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Satyananda Champati Rai is currently working as an Associate Professor in the School of Computer Engineering, KIIT Deemed to be University, Bhubaneswar. He completed his M. Tech. and Ph.D. degrees from the School of Mathematics, Statistics and Computer Science,',
      moreInfo: 'https://cse.kiit.ac.in/profiles/satyananda-champati-rai/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/08/satyananda.png',
    },
    {
      name: 'Saurabh Bilgaiyan',
      email: 'saurabh.bilgaiyanfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Saurabh Bilgaiyan is currently working as a assistant professor at KIIT (Deemed to be University), Bhubaneswar, India. He has completed Ph.D. in Computer Science & Engineering at KIIT (Deemed to be University), Bhubaneswar, India in 2018. He obtained his',
      moreInfo: 'https://cse.kiit.ac.in/profiles/saurabh-bilgaiyan/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/SAURABH-BILGAIYAN-saurabh-bilgaiyan.jpg',
    },
    {
      name: 'Saurabh Jha',
      email: 'saurabh.jhafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Ph.D. from NIT Jamshedpur with 2 SCI and 2 Scopus publication. Total teaching experience of 7 years.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/saurabh-jha/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Saurabh-Jha.jpg',
    },
    {
      name: 'Shaswati Patra',
      email: 'shaswati.patrafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        "Shaswati Patra has completed her bachelor's degree in Computer Science and Engineering under BPUT, Odisha. She has completed her master's in Software engineering at NIT Durgapur. She was teaching in RIE Bhubaneswar for one year after completion of her master's",
      moreInfo: 'https://cse.kiit.ac.in/profiles/shaswati-patra/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Shaswati-Patra.jpg',
    },
    {
      name: 'Siddharth Swarup Rautaray',
      email: 'siddharthfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Siddharth Swarup Rautaray is presently working as an Associate Professor at the School of Computer Engineering, Kalinga Institute of Industrial Technology, Deemed to be University, Bhubaneswar Odisha, India. He has teaching and research experience of more than 9+ years. He',
      moreInfo: 'https://cse.kiit.ac.in/profiles/siddharth-swarup-rautaray/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/sid-siddharth-routaray.jpg',
    },
    {
      name: 'Sohail Khan',
      email: 'sohail.khanfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'I completed my master\'s from IIT Delhi. My thesis was jobTitle was "Acceleration of ADMM-based algorithms for 3D graphics and animation". In this, we worked on the problem of mesh parameterization. Mesh parameterization is a well-known problem in Computer Graphics',
      moreInfo: 'https://cse.kiit.ac.in/profiles/sohail-khan/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/12/sohail-khan.png',
    },
    {
      name: 'Sourajit Behera',
      email: 'sourajit.beherafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        "Dr. Sourajit Behera is currently working as an Assistant Professor in the School of Computer Engineering, KIIT Deemed to be University. He has obtained his Bachelor's degree in Computer Science and Engineering from VSSUT, Burla, master's degree from Thapar University,",
      moreInfo: 'https://cse.kiit.ac.in/profiles/sourajit-behera/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/05/Sourajit-Behera.jpeg',
    },
    {
      name: 'Sourav Kumar Giri',
      email: 'sourav.girifcs@kiit.ac.in',
      jobTitle: 'Asst. Professor',
      description:
        'Sourav Kumar Giri received the bachelor’s degree(B.Tech) in computer science and engineering from the National Institute of Technology Rourkela, Odisha, India in 2009, the M.Tech degree in information & communication technology from the Indian Institute of Technology Kharagpur, WestBengal in',
      moreInfo: 'https://cse.kiit.ac.in/profiles/sourav-kumar-giri/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/10/Sourav.jpg',
    },
    {
      name: 'Subhadip Pramanik',
      email: 'subhadip.pramanikfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'I am currently working as an assistant professor in the School of Computer Engineering at Kalinga Institute of Industrial Technology (KIIT) , DU, India. I received my B.Sc. in Mathematics and M.Sc. in Applied Mathematics from Vidyasagar University, West Bengal,',
      moreInfo: 'https://cse.kiit.ac.in/profiles/subhadip-pramanik/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/07/subha-Subhadip-Pramanik.jpg',
    },
    {
      name: 'Subhashree Darshana',
      email: 'subhashree.darshanafcs@kiit.ac.in',
      jobTitle: 'Faculty Associate',
      description:
        'Mrs. Subhaashree Darshana has completed her B.Tech in the year 2015 and Masters n Information and Communication Technology from VSSUT, Burla in the year 2017. She has 2 years of teaching experience.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/subhashree-darshana/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/GAT-Subhashree-Darshana.jpg',
    },
    {
      name: 'Subhasis Dash',
      email: 'sdasfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Mr. Subhasis Dash is an Assistant Professor in the School of Computer Engineering, KIIT Deemed to be University, Bhubaneswar, Odisha, India. In the year 2002, he received his B.Tech. (CSE) degree from Utkal University and in 2006 he received his',
      moreInfo: 'https://cse.kiit.ac.in/profiles/subhasis-dash/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Subhashish-Das-1.jpg',
    },
    {
      name: 'Suchismita Das',
      email: 'suchismita.dasfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'She is currently working as Assistant professor at KIIT University. She has completed her M.Tech in computer science from B.I.T Mesra Deemed University. She is having 7 years of experience in teaching and 2 years in research. Currently, she',
      moreInfo: 'https://cse.kiit.ac.in/profiles/suchismita-das/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Suchismita-Das-1.jpg',
    },
    {
      name: 'Sujata Swain',
      email: 'sujata.swainfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Dr. Sujata Swain has 1 year of teaching experience. She holds a Ph.D. (CSE) and M.Tech (CSE) degree from IIT Roorkee. She has taught Programming in C, Computer Organization and Organization and High Performance Computer Architecture. Her research interests are',
      moreInfo: 'https://cse.kiit.ac.in/profiles/sujata-swain/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Sujata-Swain.jpg',
    },
    {
      name: 'Suneeta Mohanty',
      email: 'smohantyfcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. Suneeta Mohanty has 14 years of teaching experience in Computer Science & Engineering. She earned her M.Tech degree in Computer Science & Engineering from College of Engineering & Technology which is a constituent college of BPUT, Odisha.She earned her',
      moreInfo: 'https://cse.kiit.ac.in/profiles/suneeta-mohanty/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/Suneeta-Mohanty.jpg',
    },
    {
      name: 'Suresh Chandra Satapathy',
      email: 'suresh.satapathyfcs@kiit.ac.in',
      jobTitle: 'Professor and Dean-Research',
      description:
        'Dr Suresh Chandra Satapathy is a Ph.D in Computer Science Engineering, currently working as Professor of School of Computer Engg and Dean- Research at KIIT (Deemed to be University), Bhubaneshwar, Odisha, India. He held the position of the National Chairman',
      moreInfo: 'https://cse.kiit.ac.in/profiles/suresh-chandra-satapathy/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Suresh-Chandra-Satapathy.jpg',
    },
    {
      name: 'Sushruta Mishra',
      email: 'sushruta.mishrafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Sushruta Mishra is presently working as Assistant Professor in School of Computer Engineering, KIIT Deemed to be University, Bhubaneswar, Odisha, India. He received his B.Tech in Computer Science & Engineering from ITER, Bhubaneswar, Odisha, India. He received his M.Tech degree',
      moreInfo: 'https://cse.kiit.ac.in/profiles/sushruta-mishra/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2020/06/Sushruta-Mishra.jpg',
    },
    {
      name: 'Susmita Das',
      email: 'susmita.dasfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'I did MS by Research from Indian Institute of Technology Kharagpur. In my masters I have worked in the areas of Natural Language Processing and Knowledge Graphs. Prior to that I did my B-Tech from Haldia Institute of Technology, Haldia,',
      moreInfo: 'https://cse.kiit.ac.in/profiles/susmita-das/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/07/kiit-Susmita-Das.jpg',
    },
    {
      name: 'Swagatika Sahoo',
      email: 'swagatika.sahoofcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Now I am Assistant Professor [I] at KIIT University and pursuing Ph.D. at IIT Patna under the supervision of Dr. Raju Halder. My research focuses on using blockchain technology to build secure and robust applications while leveraging the potential of',
      moreInfo: 'https://cse.kiit.ac.in/profiles/swagatika-sahoo/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Swagatika-Sahoo.jpg',
    },
    {
      name: 'Tanik Saikh',
      email: 'tanik.saikhfcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Tanik Saikh is an Assistant Professor in Kalinga Institute of Industrial Technology (KIIT) university, Bhubaneswar, Odisha, India. Prior to joining KIIT, he was a postdoctoral researcher at L3S Research Center, Leibniz University, Hannover, Germany. He did his Ph.D. in the',
      moreInfo: 'https://cse.kiit.ac.in/profiles/tanik-saikh/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/Tanik-Saikh.jpg',
    },
    {
      name: 'Tanmaya Swain',
      email: 'tanmayafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Tanmaya Swain is having a good teaching and motivational skills. He is having keen interest in programming and research activities. He is also having a good and healthy relationship with the students. Problem solving attitude is quite unique in him.',
      moreInfo: 'https://cse.kiit.ac.in/profiles/tanmaya-swain/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2019/01/tanmay.jpg',
    },
    {
      name: 'Tanmoy Maitra',
      email: 'tanmoy.maitrafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'Presently, Dr. Tanmoy Maitra is an Assistant Professor, School of Computer Engineering, KIIT Deemed to be University, Bhubaneswar-751024, Odisha, India. In 2020, he did his Ph.D. from the Department of Computer Science & Engineering, Jadavpur University, Kolkata-700032, India. He passed',
      moreInfo: 'https://cse.kiit.ac.in/profiles/tanmoy-maitra/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2018/08/Tanmoy-Maitra-FCE.jpg',
    },
    {
      name: 'Vijay Kumar Meena',
      email: 'vijay.meenafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'B.Tech & M.Tech in Computer Science and Engineering, IIT Delhi',
      moreInfo: 'https://cse.kiit.ac.in/profiles/vijay-kumar-meena/',
      profileUrl: 'https://cse.kiit.ac.in/wp-content/uploads/2023/10/Vijay.jpg',
    },
    {
      name: 'Vikas Hassija',
      email: 'vikas.hassijafcs@kiit.ac.in',
      jobTitle: 'Associate Professor',
      description:
        'Dr. vikas Hassija (Postdoc, National University of Singapore) is an active researcher in the areas of healthcare, Blockchain, IoT, and NFTs. He has multiple publications with various renowned researchers around the globe. He has closely worked with Prof. Biplab Sikdar',
      moreInfo: 'https://cse.kiit.ac.in/profiles/vikas-hassija-2/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/04/vikas-hassija-890x1024.jpg',
    },
    {
      name: 'Vishal Meena',
      email: 'vishal.meenafcs@kiit.ac.in',
      jobTitle: 'Assistant Professor',
      description:
        'B.tech and M.tech from IIT Delhi in the feild of Mathematics and Computing',
      moreInfo: 'https://cse.kiit.ac.in/profiles/vishal-meena/',
      profileUrl:
        'https://cse.kiit.ac.in/wp-content/uploads/2023/12/Vishal-Meena.jpg',
    },
  ];

  async addFacultiesDetails() {
    //   this.FinalData.forEach(async (element) => {
    //     await this.prismService.facultiesDetails.

    const user = await this.prismService.facultiesDetails.createMany({
      data: this.FinalData,
    });

    if (user) {
      console.log('User created successfully');
    } else {
      console.log('User not created');
    }
  }

  async getFacultiesDetails() {
    return await this.prismService.facultiesDetails.findMany({});
  }

  async updateEmail(dto:UpdateDataDTO){

    
    
    try {
      const user = await this.prismService.facultiesDetails.findUnique({
        where:{
          id:dto.id
        }
      });

      if(user.email){
        throw new ConflictException("Email already updated!");
      }
      const update = await this.prismService.facultiesDetails.update({
        where:{
          id:dto.id,
      
        },
        data:{
          email:dto.data
        }
      })

      // if()

      console.log(update);

      return user;

   
    } catch (error) {

      console.log(error)
      console.log(error.status,error.statusCode)
      if(error.status == 409){
        throw error;
      }
      throw new InternalServerErrorException(error)
    }
  }


  //update phone
  async updatePhone(dto:UpdateDataDTO){
    try {
      const user = await this.prismService.facultiesDetails.findUnique({
        where:{
          id:dto.id
        }
      });

      if(user.phone){
        throw new ConflictException("Phone already updated!");
      }
      const update = await this.prismService.facultiesDetails.update({
        where:{
          id:dto.id,
          
        },
        data:{
          phone:dto.data
        }
      })

      return update;

   
    } catch (error) {
      console.log("hello")
      console.log(error.status,error.statusCode)
      if(error.status === 409){
        throw error;
      }
      return new InternalServerErrorException(error)
    }
  }

}
