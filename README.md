# Test Management Platform - Backend

A Node.js Express backend for the Test Management Platform with JSON file storage and Excel export functionality.

## Features

- Project management (CRUD operations)
- Daily test case and bug tracking
- Excel export for test cases and bugs
- RESTful API with TypeScript
- File-based data storage (JSON)

## Setup Instructions

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Development mode**:
   ```bash
   npm run dev
   ```

3. **Production build**:
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### Projects
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project by ID
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Daily Data
- `GET /api/projects/:projectId/daily-data` - Get all daily data for project
- `POST /api/projects/:projectId/daily-data` - Create new daily data entry
- `PUT /api/projects/:projectId/daily-data/:date` - Update daily data for specific date
- `GET /api/projects/:projectId/daily-data/:date` - Get daily data for specific date

### Export
- `GET /api/projects/:projectId/export/testcases/:date` - Export test cases to Excel
- `GET /api/projects/:projectId/export/bugs/:date` - Export bugs to Excel

### Health Check
- `GET /health` - Health check endpoint

## Data Storage

Data is stored in JSON files in the `data/` directory:
- `projects.json` - Project information
- `project-{projectId}-data.json` - Daily data for each project

## Environment Variables

- `PORT` - Server port (default: 5000)

## Running the Full Stack

1. Start the backend: `cd backend && npm run dev`
2. Start the frontend: `cd .. && npm run dev`
3. Access the application at `http://localhost:5173`