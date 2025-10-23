/**
 * Test script to verify data ingestion
 * Run with: npx tsx scripts/test-ingestion.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking database contents...\n');

  // Check trips
  const tripCount = await prisma.trip.count();
  console.log(`✅ Trips: ${tripCount}`);

  // Check GPS points
  const gpsCount = await prisma.gPSPoint.count();
  console.log(`✅ GPS Points: ${gpsCount}`);

  // Check drops
  const dropCount = await prisma.drop.count();
  const dropsByReason = await prisma.drop.groupBy({
    by: ['reason'],
    _count: true,
  });
  console.log(`✅ Drops: ${dropCount}`);
  dropsByReason.forEach((d: any) => {
    console.log(`   - ${d.reason}: ${d._count}`);
  });

  // Check corridors
  const corridorCount = await prisma.corridor.count();
  console.log(`✅ Corridors: ${corridorCount}`);

  // Check traversals
  const traversalCount = await prisma.traversal.count();
  console.log(`✅ Traversals: ${traversalCount}`);

  // Check corridor stats
  const statsCount = await prisma.corridorStats.count();
  console.log(`✅ Corridor Stats (baselines): ${statsCount}`);

  // Sample corridor data
  if (corridorCount > 0) {
    console.log('\n📊 Sample Corridor Data:');
    const sampleCorridor = await prisma.corridor.findFirst({
      include: {
        stats: true,
        traversals: {
          take: 1,
          orderBy: { startTs: 'desc' },
        },
        _count: {
          select: { traversals: true },
        },
      },
    });

    if (sampleCorridor) {
      console.log(`   Corridor: ${sampleCorridor.aH3} -> ${sampleCorridor.bH3} (dir: ${sampleCorridor.direction})`);
      console.log(`   Traversals: ${sampleCorridor._count.traversals}`);
      const globalStats = sampleCorridor.stats.find((s: any) => s.bucketHour === -1);
      if (globalStats) {
        console.log(`   Median travel time: ${globalStats.medianTravelSec}s`);
        console.log(`   P95 speed: ${globalStats.p95SpeedKmh} km/h`);
      }
    }
  }

  console.log('\n✨ Database check complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
