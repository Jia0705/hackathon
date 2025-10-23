/**
 * Alerts Stream API (SSE)
 * GET /api/alerts/stream - Server-Sent Events stream for real-time alerts
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Simple in-memory event emitter for alerts
class AlertEmitter {
  private listeners: Set<(alert: any) => void> = new Set();
  
  subscribe(callback: (alert: any) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  emit(alert: any) {
    this.listeners.forEach(listener => listener(alert));
  }
}

export const alertEmitter = new AlertEmitter();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lastEventId = searchParams.get('lastEventId');
  
  // Set up SSE headers
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
      );
      
      // If lastEventId is provided, send missed alerts
      if (lastEventId) {
        const missedAlerts = await prisma.alert.findMany({
          where: {
            createdAt: {
              gt: new Date(lastEventId),
            },
            resolvedAt: null,
          },
          include: {
            corridor: true,
            trip: true,
            vehicle: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });
        
        for (const alert of missedAlerts) {
          const message = formatAlertMessage(alert);
          controller.enqueue(
            encoder.encode(`id: ${alert.createdAt.toISOString()}\ndata: ${JSON.stringify(message)}\n\n`)
          );
        }
      }
      
      // Subscribe to new alerts
      const unsubscribe = alertEmitter.subscribe((alert) => {
        try {
          const message = formatAlertMessage(alert);
          controller.enqueue(
            encoder.encode(`id: ${alert.createdAt}\ndata: ${JSON.stringify(message)}\n\n`)
          );
        } catch (error) {
          console.error('Error sending alert:', error);
        }
      });
      
      // Send periodic keepalive (every 30 seconds)
      const keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch (error) {
          clearInterval(keepaliveInterval);
        }
      }, 30000);
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(keepaliveInterval);
        controller.close();
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function formatAlertMessage(alert: any) {
  return {
    id: alert.id,
    type: alert.type,
    time: alert.createdAt,
    corridorId: alert.corridorId,
    aH3: alert.corridor?.aH3,
    bH3: alert.corridor?.bH3,
    tripId: alert.tripId,
    vehicleId: alert.vehicleId,
    vehicleName: alert.vehicle?.name,
    severity: alert.severity,
    deltaValue: alert.deltaValue,
    details: alert.details ? JSON.parse(alert.details) : null,
  };
}
