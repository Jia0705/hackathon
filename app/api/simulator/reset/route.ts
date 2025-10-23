/**
 * Simulator Reset API
 * POST /api/simulator/reset - Force reset the simulator state
 */

import { NextResponse } from 'next/server';
import { simulator } from '@/lib/simulator';

export async function POST() {
  try {
    simulator.forceReset();
    
    return NextResponse.json({
      ok: true,
      message: 'Simulator forcefully reset',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reset simulator' },
      { status: 500 }
    );
  }
}
