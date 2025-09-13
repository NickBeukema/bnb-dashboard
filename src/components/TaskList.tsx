import { Paper, Typography, Card, CardContent, Chip, Box, Divider } from "@mui/material";
import { useEffect, useState } from "react";
import { Task } from "@/app/api/tasks/route";
import Markdown from "react-markdown";

export default function TaskList() {

    const [tasks, setTasks] = useState<Task[]>([]);

    const fetchTasks = () => {
        fetch('/api/tasks')
            .then(response => response.json())
            .then(data => {
                setTasks(data);
            });
    };

    useEffect(() => {
        fetchTasks();
    }, []);

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

    return (
        <Paper elevation={3} sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {tasks.map((task, index) => (
                    <Card key={task.id} variant="outlined" sx={{ py: 0 }}>
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
                                            sx={{ height: 20, fontSize: '0.7rem' }}
                                        />
                                    )}
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                ))}
            </Box>
        </Paper>
    );
}