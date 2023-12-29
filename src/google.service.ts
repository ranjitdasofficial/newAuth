import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { google } from 'googleapis';
import * as path from 'path';
import * as xlsx from 'xlsx';

const cred = 'kiit_crediential.json';
const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), cred), 'utf-8'));

@Injectable()
export class SpreadsheetService {
  async convertFileToGoogleSheet(filePath: string, sheetTitle: string): Promise<string> {
    const auth = await this.authorize(credentials);
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = '1SCr2lisHpAmi0NJQ_l_evZd5CoLhOiNP8TXxRlczKnc';

    // Read the content of the XLSX file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    // Get cell formatting information from the XLSX file
    const cellFormatting = this.getCellFormatting(workbook.Sheets[sheetName]);

    // Apply cell formatting to the Google Sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
            {
                updateCells: {
                    fields: 'userEnteredFormat.backgroundColor',
                    range: {
                        sheetId: 0, // Assuming the sheet index is 0
                        startRowIndex: 0,
                        startColumnIndex: 0,
                        endRowIndex: cellFormatting.length,
                        endColumnIndex: (cellFormatting[0]?.values ? cellFormatting[0].values.length : 0) || 1,
                    },
                    rows: cellFormatting,
                },
            },
        ],
      },
    });

    // Write the content to the newly created Google Sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1', // Update with your actual sheet name and range
      valueInputOption: 'RAW',
      requestBody: {
        values: sheetData.map(row => Object.values(row)),
      },
    });

    // Construct and return the URL
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    return spreadsheetUrl;
  }
  private getCellFormatting(sheet: xlsx.WorkSheet): any[] {
    const cellFormatting: any[] = [];
  
    for (const cellAddress in sheet) {
      if (sheet.hasOwnProperty(cellAddress) && cellAddress.startsWith('!')) {
        const cell = sheet[cellAddress];
        const rowIndex = +cellAddress.substring(cellAddress.indexOf('R') + 1, cellAddress.indexOf('C'));
        const columnIndex = +cellAddress.substring(cellAddress.indexOf('C') + 1);
  
        if (!cellFormatting[rowIndex]) {
          cellFormatting[rowIndex] = { values: [] };
        }
  
        const backgroundColor = cell.s && cell.s.bgColor
          ? { red: cell.s.bgColor.rgb[0], green: cell.s.bgColor.rgb[1], blue: cell.s.bgColor.rgb[2] }
          : null;
  
        // Ensure the array has enough length to accommodate the current column index
        if (columnIndex > cellFormatting[rowIndex].values.length) {
          cellFormatting[rowIndex].values.length = columnIndex;
        }
  
        cellFormatting[rowIndex].values[columnIndex - 1] = backgroundColor;
      }
    }
  
    return cellFormatting;
  }
  
  
  
  async readDataFromGoogleSheet(spreadsheetId: string, range: string): Promise<any[][]> {
    const auth = await this.authorize(credentials);
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return response.data.values;
  }

  private async authorize(credentials: any): Promise<any> {
    const { client_email, private_key } = credentials;

    const auth = new google.auth.JWT({
      email: client_email,
      key: private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return auth;
  }
}
