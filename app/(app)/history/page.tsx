'use client';

import { useState } from 'react';
import { History as HistoryIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/lib/useAppStore';

export default function HistoryPage() {
  const results = useAppStore((state) => state.results);
  const deleteResult = useAppStore((state) => state.deleteResult);
  
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    deleteResult(id);
    setDeleteId(null);
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <HistoryIcon className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">History</h1>
            <p className="text-xs text-muted-foreground">Saved analysis results</p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {results.length} result{results.length !== 1 ? 's' : ''} saved
        </div>
      </div>

      {/* Results Table */}
      {results.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <HistoryIcon className="size-12 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-muted-foreground">No saved results yet</p>
            <p className="text-xs text-muted-foreground/75">
              Results from your analysis will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-card/50 rounded-lg border border-border/50 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="text-right w-[80px]">Particles</TableHead>
                  <TableHead className="text-right w-[80px]">d50 (mm)</TableHead>
                  <TableHead className="text-right w-[80px]">d80 (mm)</TableHead>
                  <TableHead className="text-right w-[80px]">Mean (mm)</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="text-sm">
                      {result.timestamp instanceof Date
                        ? result.timestamp.toLocaleString()
                        : new Date(result.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {result.particles.length}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {result.metrics.d50.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {result.metrics.d80.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {result.metrics.mean.toFixed(3)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(result.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Result</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this result? This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
