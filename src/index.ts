import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { recorderService } from './services/execution/RecorderService';
import { schedulerService } from './services/execution/SchedulerService';

// Import Routes (checking named vs default exports)
// Import Routes (checking named vs default exports)
import { scriptRoutes } from './routes/persistence/scripts';
import { recorderRoutes } from './routes/execution/recorder';
import { projectRoutes } from './routes/persistence/projects';
import { visualTestRouter } from './routes/analysis/visual-tests';
import testDataRoutes from './routes/persistence/test-data';
import { schedulerRouter } from './routes/execution/scheduler';

import { userRoutes } from './routes/persistence/user';
import { gitRoutes } from './routes/integration/git';
import { apiLabRouter } from './routes/integration/api-lab';
import { runnerRoutes } from './routes/execution/runner';
import { settingsRoutes } from './routes/persistence/settings';
import { aiRouter } from './routes/ai/core';
import { authRouter } from './routes/integration/auth';
import { fileSystemRoutes } from './routes/persistence/filesystem';
import aiAnalyticsRoutes from './routes/ai/analytics';
import { suitesRouter } from './routes/persistence/suites';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 8081;

// Middleware
app.use(cors());
app.use(express.json());

// Request Logging Middleware
app.use((req, res, next) => {
    // console.log(`[API Request] ${req.method} ${req.url}`); // Removed duplicate
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        let statusColor = '';
        if (res.statusCode >= 500) statusColor = '❌';
        else if (res.statusCode >= 400) statusColor = '⚠️';
        else statusColor = '✅';

        console.log(`[HTTP] ${statusColor} ${req.method} ${req.url} -> ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Auth Middleware (Applied to API routes)
import { authMiddleware } from './middleware/auth';

// Public Routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter); // Moved UP: Public Auth Routes

// Protected Routes
app.use('/api', authMiddleware); // Protect all remaining /api routes

// Routes Mapping
app.use('/api/tests', scriptRoutes); // Mapped to scripts
app.use('/api/projects', projectRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/runner', runnerRoutes);
app.use('/api/visual', visualTestRouter); // Kept original visualTestRouter
// app.use('/api/auth', authRouter); // Moved down -> up
app.use('/api/user', userRoutes); // Added from the instruction's code edit
app.use('/api/fs', fileSystemRoutes); // Added from the instruction's code edit
app.use('/api/ai-analytics', aiAnalyticsRoutes); // Registered ai-analytics routes

// Original routes that were not explicitly in the provided edit block but should remain
app.use('/api/recorder', recorderRoutes);
// Reports are handled within recorderRoutes or projectRoutes for now
// app.use('/api/reports', reportRoutes);
app.use('/api/test-data', testDataRoutes);
app.use('/api/schedules', schedulerRouter);

// app.use('/api/user', userRoutes); // Removed Duplicate
app.use('/api/git', gitRoutes);
app.use('/api/lab', apiLabRouter);
app.use('/api/suites', suitesRouter);
app.use('/api/settings', settingsRoutes);


// Initialize Scheduler
recorderService.setSocket(io); // Initialize Recorder Socket
schedulerService.init().catch(err => console.error("Scheduler Init Failed:", err));

// Initialize Recorder Socket
recorderService.setSocket(io);

httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`✅ Test Management Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
