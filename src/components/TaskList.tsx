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

    return (
        <Paper elevation={3} sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                Tasks
            </Typography>
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
        </Paper>
    );
}