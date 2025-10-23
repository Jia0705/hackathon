/**
 * Simulator Start API
 * POST /api/simulator/start - Start CSV replay simulation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { simulator } from '@/lib/simulator';
import fs from 'fs/promises';
import path from 'path';

const START_SCHEMA = z.object({
  files: z.array(z.string()).optional(),
  speed: z.number().min(1).max(100).default(1),
  tripGapMinutes: z.number().min(1).max(120).default(20),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = START_SCHEMA.parse(body);
    
    // If no files specified, use all CSV files in dataset
    let files = config.files;
    if (!files || files.length === 0) {
      const datasetPath = path.join(process.cwd(), 'public', 'dataset');
      const allFiles = await fs.readdir(datasetPath);
      files = allFiles.filter(f => f.endsWith('.csv'));
    }
    
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No CSV files found in dataset' },
        { status: 400 }
      );
    }
    
    await simulator.start({
      files,
      speed: config.speed,
      tripGapMinutes: config.tripGapMinutes,
    });
    
    return NextResponse.json({
      ok: true,
      message: 'Simulator started',
      filesCount: files.length,
    });
  } catch (error) {
    console.error('Simulator start error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to start simulator' },
      { status: 500 }
    );
  }
}
