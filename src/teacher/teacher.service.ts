import {
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
}
