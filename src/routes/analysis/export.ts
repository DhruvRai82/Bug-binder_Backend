import express from 'express';
import * as ExcelJS from 'exceljs';
import { readDataFile } from '../../utils/fileUtils';

const router = express.Router();

// Export test cases to Excel
router.get('/:projectId/export/testcases/:date', async (req, res) => {
  try {
    const { projectId, date } = req.params;
    const filename = `project-${projectId}-data.json`;
    const projectData = await readDataFile(filename);

    const dayData = projectData.dailyData?.find((d: any) => d.date === date);
    if (!dayData || !dayData.testCases) {
      return res.status(404).json({ error: 'No test cases found for this date' });
    }

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Test Cases');

    // Add headers
    const headers = [
      'Module', 'Test Case ID', 'Test Scenario', 'Test Case Description',
      'Pre-conditions', 'Test Steps', 'Test Data', 'Expected Result',
      'Actual Result', 'Status', 'Comments'
    ];

    worksheet.addRow(headers);

    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows
    dayData.testCases.forEach((testCase: any) => {
      worksheet.addRow([
        testCase.module || '',
        testCase.testCaseId || '',
        testCase.testScenario || '',
        testCase.testCaseDescription || '',
        testCase.preConditions || '',
        testCase.testSteps || '',
        testCase.testData || '',
        testCase.expectedResult || '',
        testCase.actualResult || '',
        testCase.status || '',
        testCase.comments || ''
      ]);
    });

    // Auto-size columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell && column.eachCell((cell: any) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="testcases-${date}.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exporting test cases:', error);
    res.status(500).json({ error: 'Failed to export test cases' });
  }
});

// Export bugs to Excel
router.get('/:projectId/export/bugs/:date', async (req, res) => {
  try {
    const { projectId, date } = req.params;
    const filename = `project-${projectId}-data.json`;
    const projectData = await readDataFile(filename);

    const dayData = projectData.dailyData?.find((d: any) => d.date === date);
    if (!dayData || !dayData.bugs) {
      return res.status(404).json({ error: 'No bugs found for this date' });
    }

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bugs');

    // Add headers
    const headers = [
      'Bug ID', 'Title', 'Description', 'Module', 'Severity', 'Priority',
      'Status', 'Steps to Reproduce', 'Expected Behavior', 'Actual Behavior',
      'Reporter', 'Assignee', 'Environment', 'Attachments'
    ];

    worksheet.addRow(headers);

    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows
    dayData.bugs.forEach((bug: any) => {
      worksheet.addRow([
        bug.bugId || '',
        bug.title || '',
        bug.description || '',
        bug.module || '',
        bug.severity || '',
        bug.priority || '',
        bug.status || '',
        bug.stepsToReproduce || '',
        bug.expectedBehavior || '',
        bug.actualBehavior || '',
        bug.reporter || '',
        bug.assignee || '',
        bug.environment || '',
        bug.attachments || ''
      ]);
    });

    // Auto-size columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell && column.eachCell((cell: any) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bugs-${date}.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exporting bugs:', error);
    res.status(500).json({ error: 'Failed to export bugs' });
  }
});

export { router as exportRoutes };