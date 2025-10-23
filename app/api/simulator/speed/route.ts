/**
 * Simulator Speed Control API
 * POST /api/simulator/speed - Change simulator speed while running
 */

import { NextRequest, NextResponse } from 'next/server';
import { simulator } from '@/lib/simulator';
import { z } from 'zod';

const SPEED_SCHEMA = z.object({
  speed: z.number().min(1).max(1000),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { speed } = SPEED_SCHEMA.parse(body);
    
    simulator.setSpeed(speed);
    
    return NextResponse.json({ 
      success: true,
      speed,
      message: `Speed changed to ${speed}×`
    });
  } catch (error) {
    console.error('Speed change error:', error);
    return NextResponse.json(
      { error: 'Failed to change speed' },
      { status: 500 }
    );
  }
}
