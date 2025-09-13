"use client";

import Calendar from './Calendar';
import { Container, Grid, Paper, Typography } from '@mui/material';
import TaskList from './TaskList';
import { useEffect, useState } from 'react';
import { CalendarSource, Task } from '@/app/api/calendar/route';

export default function FullPage() {

    const [events, setEvents] = useState<CalendarSource[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const fetchEvents = () => {
        fetch('/api/calendar')
            .then(response => response.json())
            .then(data => {
                setEvents(data.events);
                setTasks(data.tasks);
                setLastRefresh(new Date());
            })
            .catch(error => console.error('Error fetching events:', error));
    };

    useEffect(() => {
        // Fetch events immediately when component mounts
        fetchEvents();

        // Set up interval to refresh every hour (3600000 milliseconds)
        const interval = setInterval(fetchEvents, 3600000);

        // Clean up interval when component unmounts
        return () => clearInterval(interval);
    }, []);

    return (
        <Container maxWidth="xl" sx={{ height: '100vh', py: 2 }}>
            <Grid container spacing={4} sx={{ height: '100%' }}>
                {/* Calendar section (top) */}
                <Grid size={12} sx={{ height: '80%' }}>
                    <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
                        <Calendar events={events} lastRefresh={lastRefresh} />
                    </Paper>
                </Grid>

                {/* Task list section (bottom) */}
                <Grid size={12} sx={{ height: '17%' }}>
                    <TaskList tasks={tasks} />
                </Grid>
            </Grid>
        </Container>
    )
}