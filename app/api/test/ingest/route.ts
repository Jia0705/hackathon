/**
 * Test Ingest API
 * POST /api/test/ingest - Test ingesting a single GPS point
 */

import { NextResponse } from 'next/server';

export async function POST() {
  const testPoint = {
    vehicleId: 'TEST_VEHICLE',
    ts: new Date().toISOString(),
    lat: 5.4343,
    lon: 100.5948,
    speed: 50,
    accuracy: 10,
    heading: 90,
  };

  try {
    console.log('[TEST INGEST] Sending test point:', testPoint);
    
    const response = await fetch('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPoint),
    });

    const responseText = await response.text();
    console.log('[TEST INGEST] Response status:', response.status);
    console.log('[TEST INGEST] Response body:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return NextResponse.json({
      status: response.ok ? '✅ SUCCESS' : '❌ FAILED',
      httpStatus: response.status,
      testPoint,
      response: responseData,
    });
  } catch (error) {
    console.error('[TEST INGEST] Error:', error);
    return NextResponse.json({
      status: '❌ ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
