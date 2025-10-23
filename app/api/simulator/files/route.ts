/**
 * Simulator Files API
 * GET /api/simulator/files - List available CSV files
 */

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const datasetPath = path.join(process.cwd(), 'public', 'dataset');
    const allFiles = await fs.readdir(datasetPath);
    const csvFiles = allFiles
      .filter(f => f.endsWith('.csv'))
      .sort();
    
    return NextResponse.json({ 
      files: csvFiles,
      count: csvFiles.length 
    });
  } catch (error) {
    console.error('Failed to list files:', error);
    return NextResponse.json(
      { error: 'Failed to list CSV files' },
      { status: 500 }
    );
  }
}
