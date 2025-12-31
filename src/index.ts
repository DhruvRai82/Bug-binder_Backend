import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { recorderService } from './services/RecorderService';
import { schedulerService } from './services/SchedulerService';

// Import Routes (checking named vs default exports)
import { scriptRoutes } from './routes/scripts'; // Was testRoutes, now scriptRoutes
import { recorderRoutes } from './routes/recorder';
import { projectRoutes } from './routes/projects';
import { visualTestRouter } from './routes/visual-tests';
import testDataRoutes from './routes/test-data'; // Default export
import schedulesRoutes from './routes/schedules'; // Default export

import { userRoutes } from './routes/user';
import { gitRoutes } from './routes/git';
import { apiLabRouter } from './routes/api-lab';
import { runnerRoutes } from './routes/runner';
import { settingsRoutes } from './routes/settings';
import { aiRouter } from './routes/ai';
import { authRouter } from './routes/auth';
import { fileSystemRoutes } from './routes/filesystem';
import aiAnalyticsRoutes from './routes/ai-analytics';

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
    console.log(`[API Request] ${req.method} ${req.url}`);
    if (Object.keys(req.body).length > 0) {
        // console.log('[API Body]', JSON.stringify(req.body, null, 2)); // Verbose
    }
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[API Response] ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
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
app.use('/api/schedules', schedulesRoutes);

// app.use('/api/user', userRoutes); // Removed Duplicate
app.use('/api/git', gitRoutes);
app.use('/api/lab', apiLabRouter);
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
