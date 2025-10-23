/**
 * System Diagnostic API
 * GET /api/diagnostic - Check entire system health
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  const diagnostic: any = {
    timestamp: new Date().toISOString(),
    checks: {},
    errors: [],
    warnings: [],
  };

  try {
    // 1. Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      diagnostic.checks.database = '✅ Connected';
    } catch (error) {
      diagnostic.checks.database = '❌ Failed';
      diagnostic.errors.push('Database connection failed: ' + (error as Error).message);
    }

    // 2. Check dataset files
    try {
      const datasetPath = path.join(process.cwd(), 'public', 'dataset');
      const files = await fs.readdir(datasetPath);
      const csvFiles = files.filter(f => f.endsWith('.csv'));
      diagnostic.checks.datasetFiles = `✅ ${csvFiles.length} CSV files found`;
      
      if (csvFiles.length === 0) {
        diagnostic.errors.push('No CSV files found in /public/dataset');
      }
    } catch (error) {
      diagnostic.checks.datasetFiles = '❌ Failed';
      diagnostic.errors.push('Dataset directory error: ' + (error as Error).message);
    }

    // 3. Check database contents
    const [
      vehicleCount,
      tripCount,
      gpsCount,
      dropCount,
      corridorCount,
      traversalCount,
      statsCount,
    ] = await Promise.all([
      prisma.vehicle.count(),
      prisma.trip.count(),
      prisma.gPSPoint.count(),
      prisma.drop.count(),
      prisma.corridor.count(),
      prisma.traversal.count(),
      prisma.corridorStats.count(),
    ]);

    diagnostic.checks.databaseData = {
      vehicles: vehicleCount,
      trips: tripCount,
      gpsPoints: gpsCount,
      drops: dropCount,
      corridors: corridorCount,
      traversals: traversalCount,
      stats: statsCount,
    };

    // 4. Check if data looks correct
    if (gpsCount > 0 && dropCount === 0) {
      diagnostic.warnings.push('GPS points exist but no drops detected. Check drop detection logic.');
    }

    if (dropCount > 0 && corridorCount === 0) {
      diagnostic.warnings.push('Drops exist but no corridors created. Check corridor extraction.');
    }

    if (dropCount > 0 && traversalCount === 0) {
      diagnostic.warnings.push('Drops exist but no traversals. Check corridor extraction.');
    }

    if (corridorCount > 0 && statsCount === 0) {
      diagnostic.warnings.push('Corridors exist but no baselines computed.');
    }

    // 5. Sample data check
    if (corridorCount > 0) {
      const sampleCorridor = await prisma.corridor.findFirst({
        include: {
          stats: { where: { bucketHour: -1 } },
          _count: { select: { traversals: true } },
        },
      });

      if (sampleCorridor) {
        diagnostic.checks.sampleCorridor = {
          id: sampleCorridor.id.substring(0, 8) + '...',
          aH3: sampleCorridor.aH3.substring(0, 8) + '...',
          bH3: sampleCorridor.bH3.substring(0, 8) + '...',
          traversals: sampleCorridor._count.traversals,
          hasBaseline: sampleCorridor.stats.length > 0,
        };

        if (sampleCorridor._count.traversals === 0) {
          diagnostic.warnings.push('Sample corridor has 0 traversals. Data linkage issue.');
        }
      }
    }

    // 6. Check environment variables
    diagnostic.checks.environment = {
      TAU_SHORT: process.env.TAU_SHORT || '60 (default)',
      H3_RESOLUTION: process.env.H3_RESOLUTION || '7 (default)',
      DELAY_THRESHOLD_MINUTES: process.env.DELAY_THRESHOLD_MINUTES || '15 (default)',
    };

    // 7. Overall status
    if (diagnostic.errors.length > 0) {
      diagnostic.status = '❌ ERRORS FOUND';
    } else if (diagnostic.warnings.length > 0) {
      diagnostic.status = '⚠️ WARNINGS';
    } else {
      diagnostic.status = '✅ ALL CHECKS PASSED';
    }

  } catch (error) {
    diagnostic.status = '❌ DIAGNOSTIC FAILED';
    diagnostic.errors.push('Diagnostic error: ' + (error as Error).message);
  }

  return NextResponse.json(diagnostic, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
