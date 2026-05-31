import { Paper, Typography, Card, CardContent, Chip, Box, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { BLUE, BROWN, GREEN, RED } from "@/app/lib/data";
import { Task } from "@/app/api/calendar/route";

import Markdown from "react-markdown";
import { useMemo, useState } from "react";

export default function TaskList({ tasks }: { tasks: Task[] }) {

    const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [targetId, setTargetId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [dedupeOpen, setDedupeOpen] = useState(false);
    const [isDeduping, setIsDeduping] = useState(false);
    const [dedupeError, setDedupeError] = useState<string | null>(null);

    const formatDate = (dateString: string) => {
        if (!dateString) return 'No due date';
        const date = new Date(dateString);
        // return date.toString();

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC'
        });
    };

    const chipColor = (label: string) => {
        switch (label) {
            case 'Wavesong':
                return BLUE;
            case 'Red':
                return RED;
            case 'Lake Breeze':
                return GREEN;
            case 'Betsie':
            case 'Betsie Airbnb':
            case 'Bestie':
                return BROWN;
        }
    }

    const visibleTasks = useMemo(() => tasks.filter(t => !deletedIds.has(t.id)), [tasks, deletedIds]);

    // Identify duplicate descriptions among visible tasks
    const duplicateDescriptions = useMemo(() => {
        const counts = new Map<string, number>();
        for (const task of visibleTasks) {
            const key = task.description || "";
            if (!key) continue;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return new Set(
            Array.from(counts.entries())
                .filter(([, count]) => count > 1)
                .map(([desc]) => desc)
        );
    }, [visibleTasks]);


    const handleClose = () => {
        if (isDeleting) return;
        setConfirmOpen(false);
        setTargetId(null);
    };

    const handleConfirm = async () => {
        if (!targetId) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/task/${targetId}`, { method: 'DELETE' });
            if (!res.ok) {
                throw new Error('Failed to delete');
            }
            setDeletedIds(prev => new Set(prev).add(targetId));
            setConfirmOpen(false);
            setTargetId(null);
        } catch (e) {
            console.error(e);
        } finally {
            setIsDeleting(false);
        }
    };
    const requestDelete = (id: string) => {
        setTargetId(id);
        setConfirmOpen(true);
    };

    // How many deletions a /api/tasks/dedupe call would make against the *visible*
    // task set right now. The server may delete more (it sees every open task, not
    // just what's rendered) — this is a UI hint, not an exact count.
    const dedupeCount = useMemo(() => {
        const counts = new Map<string, number>();
        for (const t of visibleTasks) {
            if (!t.description?.startsWith("bnb-")) continue;
            counts.set(t.description, (counts.get(t.description) ?? 0) + 1);
        }
        let total = 0;
        for (const n of counts.values()) if (n > 1) total += n - 1;
        return total;
    }, [visibleTasks]);

    const handleDedupe = async () => {
        setIsDeduping(true);
        setDedupeError(null);
        try {
            const res = await fetch("/api/tasks/dedupe", { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.details || data.error || "Failed to dedupe");
            }
            const ids: string[] = data.deletedIds || [];
            setDeletedIds((prev) => {
                const next = new Set(prev);
                for (const id of ids) next.add(id);
                return next;
            });
            setDedupeOpen(false);
        } catch (e) {
            console.error(e);
            setDedupeError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setIsDeduping(false);
        }
    };

    return (
        <Paper elevation={3} sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ m: 0 }}>
                    Tasks
                </Typography>
                <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    disabled={isDeduping || (dedupeCount === 0 && duplicateDescriptions.size === 0)}
                    onClick={() => { setDedupeError(null); setDedupeOpen(true); }}
                    aria-label="dedupe-tasks"
                >
                    {isDeduping ? 'Deduping…' : `Dedupe${dedupeCount ? ` (${dedupeCount})` : ''}`}
                </Button>
            </Box>
            {visibleTasks.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No tasks found
                </Typography>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    {visibleTasks.map((task, index) => (
                        <Card
                            key={task.id}
                            variant="outlined"
                            sx={{
                                py: 0,
                                backgroundColor: duplicateDescriptions.has(task.description) ? 'rgba(244, 67, 54, 0.12)' : undefined,
                            }}
                        >
                            <CardContent sx={{ p: 0.75, '&:last-child': { pb: 0.75 } }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'space-between' }}>
                                    <Markdown>{task.name}</Markdown>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatDate(task.dueDate)}
                                        </Typography>
                                        {task.labels && task.labels.length > 0 && (
                                            <Chip
                                                label={task.labels[0]}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                                sx={{ height: 20, fontSize: '0.7rem', backgroundColor: chipColor(task.labels[0]), color: 'white' }}
                                            />
                                        )}
                                        <Tooltip title="Delete task">
                                            <IconButton size="small" onClick={() => requestDelete(task.id)} aria-label="delete-task">
                                                ✕
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    ))}
                </Box>
            )}

            <Dialog open={confirmOpen} onClose={handleClose}>
                <DialogTitle>Delete task?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">This cannot be undone.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={isDeleting}>Cancel</Button>
                    <Button color="error" onClick={handleConfirm} disabled={isDeleting}>
                        {isDeleting ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={dedupeOpen} onClose={() => { if (!isDeduping) setDedupeOpen(false); }}>
                <DialogTitle>Delete duplicate tasks?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        For each duplicate group of <code>bnb-*</code> tasks, the oldest will be kept and the rest deleted. This cannot be undone.
                    </Typography>
                    {dedupeCount > 0 && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            About {dedupeCount} task{dedupeCount === 1 ? '' : 's'} will be deleted based on what's visible right now (the server may find more).
                        </Typography>
                    )}
                    {dedupeError && (
                        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                            {dedupeError}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDedupeOpen(false)} disabled={isDeduping}>Cancel</Button>
                    <Button color="error" onClick={handleDedupe} disabled={isDeduping}>
                        {isDeduping ? 'Deduping…' : 'Delete duplicates'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}