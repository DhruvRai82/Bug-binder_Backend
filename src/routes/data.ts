import { Router } from 'express';
import { readDataFile, writeDataFile } from '../utils/fileUtils';

const router = Router();

// Get daily data for a project
router.get('/:projectId/daily-data', async (req, res) => {
  try {
    const { projectId } = req.params;
    const data = await readDataFile(`project-${projectId}-data.json`);
    res.json(data.dailyData || []);
  } catch (error) {
    console.error('Error loading daily data:', error);
    res.json([]);
  }
});

// Create new daily data entry
router.post('/:projectId/daily-data', async (req, res) => {
  try {
    const { projectId } = req.params;
    const newDayData = req.body;
    
    const data = await readDataFile(`project-${projectId}-data.json`);
    const dailyData = data.dailyData || [];

    // Check if data for this date already exists
    const existingIndex = dailyData.findIndex((d: any) => d.date === newDayData.date);
    if (existingIndex !== -1) {
      return res.status(400).json({ error: 'Data for this date already exists' });
    }

    dailyData.push(newDayData);
    await writeDataFile(`project-${projectId}-data.json`, { ...data, dailyData });

    res.status(201).json(newDayData);
  } catch (error) {
    console.error('Error creating daily data:', error);
    res.status(500).json({ error: 'Failed to create daily data' });
  }
});

// Update daily data entry
router.put('/:projectId/daily-data/:date', async (req, res) => {
  try {
    const { projectId, date } = req.params;
    const updates = req.body;
    
    const data = await readDataFile(`project-${projectId}-data.json`);
    const dailyData = data.dailyData || [];
    
    const dayIndex = dailyData.findIndex((d: any) => d.date === date);
    if (dayIndex === -1) {
      // Create new entry if it doesn't exist
      const newDayData = { date, testCases: [], bugs: [], ...updates };
      dailyData.push(newDayData);
      await writeDataFile(`project-${projectId}-data.json`, { ...data, dailyData });
      return res.status(201).json(newDayData);
    }

    // Update existing entry
    dailyData[dayIndex] = {
      ...dailyData[dayIndex],
      ...updates
    };

    await writeDataFile(`project-${projectId}-data.json`, { ...data, dailyData });
    res.json(dailyData[dayIndex]);
  } catch (error) {
    console.error('Error updating daily data:', error);
    res.status(500).json({ error: 'Failed to update daily data' });
  }
});

// Get specific day data
router.get('/:projectId/daily-data/:date', async (req, res) => {
  try {
    const { projectId, date } = req.params;
    const data = await readDataFile(`project-${projectId}-data.json`);
    const dailyData = data.dailyData || [];
    
    const dayData = dailyData.find((d: any) => d.date === date);
    if (!dayData) {
      return res.status(404).json({ error: 'Data for this date not found' });
    }

    res.json(dayData);
  } catch (error) {
    console.error('Error loading day data:', error);
    res.status(500).json({ error: 'Failed to load day data' });
  }
});

export { router as dataRoutes };