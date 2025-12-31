import fs from 'fs/promises';
import path from 'path';

// Resolve data directory from multiple possible locations
let DATA_DIR: string | null = null;

const resolveDataDir = async (): Promise<string> => {
  if (DATA_DIR) return DATA_DIR;

  // Try multiple candidate paths in priority order
  const candidates = [
    path.join(process.cwd(), 'backend', 'data'),  // <project root>/backend/data
    path.join(process.cwd(), 'data'),              // <backend cwd>/data
    path.join(__dirname, '..', '..', 'data'),      // dist layout: dist/utils -> ../../data
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      DATA_DIR = candidate;
      console.log(`[FileUtils] Using data directory: ${DATA_DIR}`);
      return DATA_DIR;
    } catch {
      // Directory doesn't exist, try next candidate
    }
  }

  // If none exist, default to backend/data and create it
  DATA_DIR = path.join(process.cwd(), 'backend', 'data');
  console.log(`[FileUtils] Creating data directory: ${DATA_DIR}`);
  await fs.mkdir(DATA_DIR, { recursive: true });
  return DATA_DIR;
};

// Ensure data directory exists
export const ensureDataDir = async () => {
  await resolveDataDir();
};

// Get current data directory (for debugging)
export const getDataDir = async (): Promise<string> => {
  return await resolveDataDir();
};

// Read data file
export const readDataFile = async (filename: string) => {
  const dataDir = await resolveDataDir();
  const filePath = path.join(dataDir, filename);
  
  console.log(`[FileUtils] Reading file: ${filePath}`);
  
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`[FileUtils] File not found or error reading: ${filePath}`);
    // Return empty object if file doesn't exist
    return {};
  }
};

// Write data file
export const writeDataFile = async (filename: string, data: any) => {
  const dataDir = await resolveDataDir();
  const filePath = path.join(dataDir, filename);
  
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
};