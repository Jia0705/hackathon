/**
 * Simulator Stop API
 * POST /api/simulator/stop - Stop the running simulation
 */

import { NextResponse } from 'next/server';
import { simulator } from '@/lib/simulator';

export async function POST() {
  try {
    simulator.stop();
    
    return NextResponse.json({
      ok: true,
      message: 'Simulator stopped',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop simulator' },
      { status: 500 }
    );
  }
}
