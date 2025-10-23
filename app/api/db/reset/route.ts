/**
 * Database Reset API
 * POST /api/db/reset - Clear all data from the database
 * WARNING: This deletes all data!
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    console.log('[DB RESET] Starting database cleanup...');
    
    // Delete in correct order due to foreign key constraints
    await prisma.alert.deleteMany({});
    console.log('[DB RESET] ✅ Deleted alerts');
    
    await prisma.corridorStats.deleteMany({});
    console.log('[DB RESET] ✅ Deleted corridor stats');
    
    await prisma.traversal.deleteMany({});
    console.log('[DB RESET] ✅ Deleted traversals');
    
    await prisma.corridor.deleteMany({});
    console.log('[DB RESET] ✅ Deleted corridors');
    
    await prisma.drop.deleteMany({});
    console.log('[DB RESET] ✅ Deleted drops');
    
    await prisma.gPSPoint.deleteMany({});
    console.log('[DB RESET] ✅ Deleted GPS points');
    
    await prisma.trip.deleteMany({});
    console.log('[DB RESET] ✅ Deleted trips');
    
    await prisma.vehicle.deleteMany({});
    console.log('[DB RESET] ✅ Deleted vehicles');
    
    console.log('[DB RESET] 🎉 Database reset complete!');
    
    return NextResponse.json({
      ok: true,
      message: 'Database reset successfully',
    });
  } catch (error) {
    console.error('[DB RESET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reset database' },
      { status: 500 }
    );
  }
}
