import { Router } from 'express';
import { readDataFile, writeDataFile } from '../utils/fileUtils';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all custom pages for a project
router.get('/:projectId/pages', async (req, res) => {
  try {
    const { projectId } = req.params;
    const data = await readDataFile(`project-${projectId}-data.json`);
    res.json(data.customPages || []);
  } catch (error) {
    console.error('Error loading custom pages:', error);
    res.json([]);
  }
});

// Create new custom page
router.post('/:projectId/pages', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, date } = req.body;
    
    const data = await readDataFile(`project-${projectId}-data.json`);
    const customPages = data.customPages || [];

    // Check if page name already exists
    const existingPage = customPages.find((p: any) => p.name === name);
    if (existingPage) {
      return res.status(400).json({ error: 'Page with this name already exists' });
    }

    const newPage = {
      id: uuidv4(),
      name,
      date,
      testCases: [],
      bugs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    customPages.push(newPage);
    await writeDataFile(`project-${projectId}-data.json`, { ...data, customPages });

    res.status(201).json(newPage);
  } catch (error) {
    console.error('Error creating custom page:', error);
    res.status(500).json({ error: 'Failed to create custom page' });
  }
});

// Update custom page
router.put('/:projectId/pages/:pageId', async (req, res) => {
  try {
    const { projectId, pageId } = req.params;
    const updates = req.body;
    
    const data = await readDataFile(`project-${projectId}-data.json`);
    const customPages = data.customPages || [];
    
    const pageIndex = customPages.findIndex((p: any) => p.id === pageId);
    if (pageIndex === -1) {
      return res.status(404).json({ error: 'Custom page not found' });
    }

    customPages[pageIndex] = {
      ...customPages[pageIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await writeDataFile(`project-${projectId}-data.json`, { ...data, customPages });
    res.json(customPages[pageIndex]);
  } catch (error) {
    console.error('Error updating custom page:', error);
    res.status(500).json({ error: 'Failed to update custom page' });
  }
});

// Delete custom page
router.delete('/:projectId/pages/:pageId', async (req, res) => {
  try {
    const { projectId, pageId } = req.params;
    
    const data = await readDataFile(`project-${projectId}-data.json`);
    const customPages = data.customPages || [];
    
    const pageIndex = customPages.findIndex((p: any) => p.id === pageId);
    if (pageIndex === -1) {
      return res.status(404).json({ error: 'Custom page not found' });
    }

    customPages.splice(pageIndex, 1);
    await writeDataFile(`project-${projectId}-data.json`, { ...data, customPages });
    
    res.json({ message: 'Custom page deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom page:', error);
    res.status(500).json({ error: 'Failed to delete custom page' });
  }
});

// Get specific custom page
router.get('/:projectId/pages/:pageId', async (req, res) => {
  try {
    const { projectId, pageId } = req.params;
    const data = await readDataFile(`project-${projectId}-data.json`);
    const customPages = data.customPages || [];
    
    const page = customPages.find((p: any) => p.id === pageId);
    if (!page) {
      return res.status(404).json({ error: 'Custom page not found' });
    }

    res.json(page);
  } catch (error) {
    console.error('Error loading custom page:', error);
    res.status(500).json({ error: 'Failed to load custom page' });
  }
});

export { router as pageRoutes };