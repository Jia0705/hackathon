'use client';

/**
 * Corridors Table Component
 * Displays sortable/filterable corridor list
 */

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUpDown, Eye } from 'lucide-react';
import type { Corridor } from '@/types';

interface CorridorsTableProps {
  corridors: Corridor[];
  onViewCorridor?: (corridor: Corridor) => void;
  isLoading?: boolean;
}

export function CorridorsTable({ corridors, onViewCorridor, isLoading }: CorridorsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'deviation' | 'median'>('deviation');

  // Filter corridors by search term
  const filteredCorridors = corridors.filter((corridor) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      corridor.aH3.toLowerCase().includes(term) ||
      corridor.bH3.toLowerCase().includes(term) ||
      corridor.corridorId.toLowerCase().includes(term)
    );
  });

  // Sort corridors
  const sortedCorridors = [...filteredCorridors].sort((a, b) => {
    switch (sortBy) {
      case 'count':
        return b.count - a.count;
      case 'median':
        return b.medianSec - a.medianSec;
      case 'deviation':
      default:
        return Math.abs(b.deviationSec) - Math.abs(a.deviationSec);
    }
  });

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  function formatTime(isoString: string | null): string {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getDirectionArrow(direction: number): string {
    // 16-way compass (0 = N, 4 = E, 8 = S, 12 = W)
    const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    return arrows[Math.floor(direction / 2) % 8];
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        <h2 className="text-lg font-semibold">Corridors</h2>
        
        <div className="flex gap-2">
          <Input
            placeholder="Search corridors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deviation">Deviation</SelectItem>
              <SelectItem value="count">Count</SelectItem>
              <SelectItem value="median">Median Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">Loading corridors...</div>
          </div>
        ) : sortedCorridors.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <p className="text-sm text-muted-foreground">No corridors found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchTerm ? 'Try adjusting your search' : 'No data in selected time window'}
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>A→B</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Median Time</TableHead>
                <TableHead className="text-right">P95 Speed</TableHead>
                <TableHead className="text-right">Live Δ</TableHead>
                <TableHead className="text-right">Last Seen</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCorridors.map((corridor) => (
                <TableRow key={corridor.corridorId} className="hover:bg-accent/50">
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <span className="truncate max-w-[80px]" title={corridor.aH3}>
                        {corridor.aH3.substring(0, 8)}
                      </span>
                      <span>{getDirectionArrow(corridor.direction)}</span>
                      <span className="truncate max-w-[80px]" title={corridor.bH3}>
                        {corridor.bH3.substring(0, 8)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{corridor.count}</TableCell>
                  <TableCell className="text-right">
                    {formatDuration(corridor.medianSec)}
                  </TableCell>
                  <TableCell className="text-right">
                    {corridor.p95SpeedKmh.toFixed(1)} km/h
                  </TableCell>
                  <TableCell className="text-right">
                    {corridor.deviationFormatted ? (
                      <span
                        className={
                          corridor.deviationSec > 0
                            ? 'text-destructive font-semibold'
                            : 'text-green-600'
                        }
                      >
                        {corridor.deviationSign}{corridor.deviationFormatted}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatTime(corridor.lastSeen)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewCorridor?.(corridor)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t text-sm text-muted-foreground">
        Showing {sortedCorridors.length} of {corridors.length} corridors
      </div>
    </div>
  );
}
