/**
 * Test Data Flow API
 * POST /api/test/flow - Test the complete data flow with sample data
 */

import { NextResponse } from 'next/server';
import { detectDrops, extractCorridors } from '@/lib/gps-processing';

export async function POST() {
  const results: any = {
    timestamp: new Date().toISOString(),
    steps: [],
  };

  try {
    // Step 1: Create sample GPS data (simulate 3-minute intervals with gaps)
    const sampleData = [];
    const startTime = new Date('2025-08-01T00:00:00Z');
    const baseLat = 5.4343;
    const baseLon = 100.5948;

    // Create 20 points with 180-second gaps (normal sampling)
    for (let i = 0; i < 20; i++) {
      sampleData.push({
        ts: new Date(startTime.getTime() + i * 180000), // 180 seconds = 3 minutes
        lat: baseLat + (i * 0.001),
        lon: baseLon + (i * 0.001),
        speed: 50 + Math.random() * 20,
        accuracy: 10 + Math.random() * 5,
      });
    }

    results.steps.push({
      step: 1,
      description: 'Sample GPS data created',
      count: sampleData.length,
      status: '✅',
    });

    // Step 2: Detect drops
    const tauShort = parseInt(process.env.TAU_SHORT || '60');
    const drops = detectDrops(sampleData, tauShort);

    results.steps.push({
      step: 2,
      description: `Drop detection (TAU_SHORT=${tauShort}s)`,
      input: sampleData.length,
      output: drops.length,
      status: drops.length > 0 ? '✅' : '⚠️',
      sample: drops[0] ? {
        durationSec: drops[0].durationSec,
        reason: drops[0].reason,
      } : null,
    });

    // Step 3: Extract corridors
    const h3Res = parseInt(process.env.H3_RESOLUTION || '7');
    const traversals = extractCorridors(drops, h3Res);

    results.steps.push({
      step: 3,
      description: `Corridor extraction (H3_RESOLUTION=${h3Res})`,
      input: drops.length,
      output: traversals.length,
      status: traversals.length > 0 ? '✅' : '❌',
      sample: traversals[0] ? {
        aH3: traversals[0].corridorKey.aH3.substring(0, 8) + '...',
        bH3: traversals[0].corridorKey.bH3.substring(0, 8) + '...',
        travelSec: traversals[0].travelSec,
      } : null,
    });

    // Step 4: Analysis
    const analysis = {
      dropsPerPoint: (drops.length / sampleData.length * 100).toFixed(1) + '%',
      corridorsPerDrop: drops.length > 0 ? (traversals.length / drops.length * 100).toFixed(1) + '%' : 'N/A',
      averageGap: 180,
      tauShort,
      expectedDrops: Math.max(0, sampleData.length - 1), // Every gap between points
      actualDrops: drops.length,
    };

    results.analysis = analysis;

    // Step 5: Identify issues
    const issues = [];
    const warnings = [];

    if (drops.length === 0) {
      issues.push('❌ No drops detected. TAU_SHORT may be too high for 180s sampling interval.');
      issues.push(`💡 Solution: Set TAU_SHORT=90 or lower (current: ${tauShort})`);
    } else if (drops.length < sampleData.length - 1) {
      warnings.push(`⚠️ Only ${drops.length}/${sampleData.length - 1} gaps detected as drops`);
    }

    if (drops.length > 0 && traversals.length === 0) {
      issues.push('❌ Drops detected but no corridors created.');
      issues.push('💡 Check drop reason classification (micro_drops are skipped)');
    }

    if (issues.length > 0) {
      results.status = '❌ ISSUES FOUND';
      results.issues = issues;
    } else if (warnings.length > 0) {
      results.status = '⚠️ WARNINGS';
      results.warnings = warnings;
    } else {
      results.status = '✅ DATA FLOW WORKING';
    }

    results.recommendation = drops.length === 0
      ? 'Lower TAU_SHORT to match your GPS sampling interval (e.g., TAU_SHORT=90 for 3-minute samples)'
      : traversals.length === 0
        ? 'Check drop classification - all drops may be classified as micro_drops'
        : 'Data flow looks good! Ready for simulation.';

  } catch (error) {
    results.status = '❌ ERROR';
    results.error = (error as Error).message;
    results.stack = (error as Error).stack;
  }

  return NextResponse.json(results, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
