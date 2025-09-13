import { Paper, Typography, Card, CardContent, Chip, Box } from "@mui/material";
import { BLUE, BROWN, GREEN, RED } from "@/app/lib/data";
import { Task } from "@/app/api/calendar/route";

import Markdown from "react-markdown";

export default function TaskList({ tasks }: { tasks: Task[] }) {

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
            case 'Bestie':
                return BROWN;
        }
    }

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
                                            sx={{ height: 20, fontSize: '0.7rem', backgroundColor: chipColor(task.labels[0]), color: 'white' }}
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