/**
 * Force Stop Simulator API
 * POST /api/simulator/force-stop - Emergency stop and reset
 */

import { NextResponse } from 'next/server';
import { simulator } from '@/lib/simulator';

export async function POST() {
  try {
    console.log('[FORCE-STOP] Forcing simulator to stop...');
    
    simulator.forceReset();
    
    console.log('[FORCE-STOP] ✅ Simulator force stopped and reset');
    
    return NextResponse.json({
      ok: true,
      message: 'Simulator force stopped and reset',
    });
  } catch (error) {
    console.error('[FORCE-STOP] Error:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to force stop',
    }, { status: 500 });
  }
}
