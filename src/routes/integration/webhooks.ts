import { Router } from 'express';
// import { supabase } from '../../lib/supabase';
import { recorderService } from '../../services/execution/RecorderService';
import { localProjectService } from '../../services/persistence/LocalProjectService';

const router = Router();

// POST /api/webhooks/run
router.post('/run', async (req, res) => {
    try {
        const { scriptId } = req.body;
        const apiSecret = req.headers['x-api-secret'] as string;

        // Note: Express headers are lowercase.
        const secretHeader = req.headers['x-api-secret'] || req.headers['X-API-SECRET'];

        if (!scriptId || !secretHeader) {
            return res.status(400).json({ error: 'Missing scriptId or x-api-secret header' });
        }

        // 1. Find the script and get its project_id
        const found = await localProjectService.findScriptById(scriptId);

        if (!found) {
            return res.status(404).json({ error: 'Script not found' });
        }

        const { script, project } = found;

        // 2. Validate the Secret against the Project
        // Access dynamically because typescript definition at backend might lag
        const projectSecret = (project as any).webhookSecret || (project as any).webhook_secret;

        if (!projectSecret || projectSecret !== secretHeader) {
            return res.status(401).json({ error: 'Invalid x-api-secret' });
        }

        console.log(`[Webhook] Triggering script "${script.name}" via Webhook...`);

        // 3. Run the script using the Refactored RecorderService
        // We do NOT pass a userId because this is a machine account.
        const result = await recorderService.playScript(scriptId);

        if (result.status === 'pass') {
            return res.status(200).json(result);
        } else {
            return res.status(500).json(result);
        }

    } catch (error: any) {
        console.error('[Webhook] Error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

export default router;
