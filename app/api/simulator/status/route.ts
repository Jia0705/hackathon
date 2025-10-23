/**
 * Simulator Status API
 * GET /api/simulator/status - Get current simulator status
 * POST /api/simulator/status - Stop simulator
 */

import { NextRequest, NextResponse } from 'next/server';
import { simulator } from '@/lib/simulator';

export async function GET() {
  const status = simulator.getStatus();
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  if (action === 'stop') {
    simulator.stop();
    return NextResponse.json({ ok: true, message: 'Simulator stopped' });
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
