# Test Automation Studio

## Setup Instructions

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Configure Gemini AI API Key

Create a `.env` file in the `backend` directory:

```bash
PORT=5000
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

To get a Gemini API key:
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy and paste it into your `.env` file

### 3. Start the Backend

```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### 4. Start the Frontend

In a new terminal:

```bash
cd ..
npm run dev
```

## Features

### AI-Powered Test Generation
- Describe what you want to test in plain English
- Gemini AI generates a complete test script in JSON format
- Supports multiple test actions: navigate, type, click, waitFor, assert, screenshot

### Test Execution
- Run tests with a single click
- View real-time console output
- Track pass/fail status for each test

### AI Failure Analysis
- When a test fails, use AI to analyze the logs
- Get actionable insights on what went wrong
- Receive suggestions for fixes

### Script Management
- Create, edit, and delete test scripts
- All scripts are scoped to the current project
- JSON-based format for easy editing and version control

## Test Script Format

```json
{
  "baseUrl": "https://example.com",
  "steps": [
    {
      "action": "navigate",
      "url": "/login",
      "description": "Navigate to login page"
    },
    {
      "action": "type",
      "selector": "#username",
      "value": "user@example.com",
      "description": "Enter username"
    },
    {
      "action": "click",
      "selector": "#login-button",
      "description": "Click login button"
    },
    {
      "action": "waitFor",
      "selector": ".dashboard",
      "description": "Wait for dashboard"
    },
    {
      "action": "assert",
      "selector": ".welcome-message",
      "expected": "Welcome",
      "description": "Verify welcome message"
    }
  ]
}
```

## Available Actions

- **navigate**: Go to a URL
- **type**: Enter text in a field
- **click**: Click an element
- **waitFor**: Wait for an element to appear
- **assert**: Verify text or element presence
- **screenshot**: Capture a screenshot

## API Endpoints

All endpoints are project-scoped:

### Scripts CRUD
- `GET /api/projects/:projectId/scripts` - Get all scripts
- `POST /api/projects/:projectId/scripts` - Create new script
- `GET /api/projects/:projectId/scripts/:scriptId` - Get specific script
- `PUT /api/projects/:projectId/scripts/:scriptId` - Update script
- `DELETE /api/projects/:projectId/scripts/:scriptId` - Delete script

### Automation Features
- `POST /api/projects/:projectId/scripts/:scriptId/run` - Execute test script
- `POST /api/projects/:projectId/scripts/generate` - Generate script with AI
- `POST /api/projects/:projectId/scripts/analyze-failure` - Analyze failure with AI

## Notes

- Test execution is currently simulated. For production use, integrate with Selenium WebDriver
- All data is stored in project-specific JSON files
- Scripts are automatically scoped to the selected project
- The module is completely independent and doesn't affect core functionality

## Future Enhancements

- Real Selenium WebDriver integration
- Browser selection (Chrome, Firefox, Edge)
- Headless mode option
- Screenshot capture on failure
- Video recording of test runs
- Parallel test execution
- Integration with CI/CD pipelines
