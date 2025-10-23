'use client';

/**
 * Alerts Panel Component
 * Displays live SSE alerts feed
 */

import { useEffect, useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Zap } from 'lucide-react';
import type { Alert } from '@/types';

interface AlertsPanelProps {
  onAlertClick?: (alert: Alert) => void;
}

export function AlertsPanel({ onAlertClick }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  function connectSSE() {
    const url = lastEventIdRef.current
      ? `/api/alerts/stream?lastEventId=${lastEventIdRef.current}`
      : '/api/alerts/stream';

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setIsReconnecting(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          // Initial connection message
          return;
        }

        // Store last event ID for reconnection
        if (event.lastEventId) {
          lastEventIdRef.current = event.lastEventId;
        }

        // Add new alert to the list
        setAlerts((prev) => [data, ...prev].slice(0, 100)); // Keep last 100 alerts
      } catch (error) {
        console.error('Error parsing alert:', error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setIsReconnecting(true);
      eventSource.close();

      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        connectSSE();
      }, 3000);
    };
  }

  function clearAlerts() {
    setAlerts([]);
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  }

  function formatTime(timeStr: string) {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function formatDelta(type: string, deltaValue: number) {
    if (type === 'delay') {
      const minutes = Math.floor(Math.abs(deltaValue) / 60);
      return `+${minutes}m`;
    } else {
      return `+${deltaValue.toFixed(1)} km/h`;
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Live Alerts</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? 'default' : 'destructive'} className="text-xs">
            {isConnected ? 'CONNECTED' : isReconnecting ? 'RECONNECTING' : 'DISCONNECTED'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={clearAlerts}>
            Clear
          </Button>
        </div>
      </div>

      {/* Alerts List */}
      <ScrollArea className="flex-1">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
            <Zap className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">No alerts yet</p>
            <p className="text-xs mt-1">Alerts will appear here as they are detected</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {alerts.map((alert, index) => (
              <div
                key={`${alert.id}-${index}`}
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => onAlertClick?.(alert)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                        {alert.type.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(alert.time)}
                      </span>
                    </div>
                    <div className="text-sm font-medium truncate">
                      {alert.vehicleName || alert.vehicleId}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {alert.aH3?.substring(0, 8)}... → {alert.bH3?.substring(0, 8)}...
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-destructive">
                    {formatDelta(alert.type, alert.deltaValue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
