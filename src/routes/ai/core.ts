import { Router } from 'express';
import { genAIService } from '../../services/ai/GenAIService';

const router = Router();

// Generate Test Cases
router.post('/generate-tests', async (req, res) => {
    try {
        const userId = (req as any).user?.uid;
        const { requirements } = req.body;
        if (!requirements) {
            return res.status(400).json({ error: 'Requirements text is required' });
        }

        const result = await genAIService.generateTestCases(requirements, userId);
        res.json({ result });
    } catch (error) {
        console.error('Error generating tests:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Summarize Bug
router.post('/summarize-bug', async (req, res) => {
    try {
        const userId = (req as any).user?.uid;
        const { description } = req.body;
        if (!description) {
            return res.status(400).json({ error: 'Bug description is required' });
        }

        const result = await genAIService.summarizeBug(description, userId);
        res.json(result);
    } catch (error) {
        console.error('Error summarizing bug:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Generate Structured Single Test Case
router.post('/generate-test-case', async (req, res) => {
    try {
        const userId = (req as any).user?.uid;
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const result = await genAIService.generateStructuredTestCase(prompt, userId);
        res.json(result);
    } catch (error) {
        console.error('Error generating structured test case:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Helper to determine status code
const getStatusCode = (error: any) => {
    const msg = error.message || '';
    if (msg.includes('401') || msg.includes('Invalid API Key')) return 401;
    if (msg.includes('403')) return 403;
    if (msg.includes('404')) return 404; // Model not found
    return 500;
};

// Generate Bulk Test Cases
router.post('/generate-bulk-test-cases', async (req, res) => {
    try {
        const userId = (req as any).user?.uid;
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const result = await genAIService.generateBulkTestCases(prompt, userId);
        res.json(result);
    } catch (error) {
        console.error('Error generating bulk test cases:', error);
        const status = getStatusCode(error);
        res.status(status).json({ error: (error as Error).message });
    }
});

export { router as aiRouter };
