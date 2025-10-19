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
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/calendar');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.details || 'Failed to fetch calendar data');
            }

            setEvents(data.events || []);
            setTasks(data.tasks || []);
            setLastRefresh(new Date());
        } catch (error) {
            console.error('Error fetching events:', error);
            setError(error instanceof Error ? error.message : 'An unknown error occurred');
            // Set empty arrays on error to prevent UI issues
            setEvents([]);
            setTasks([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fetch events immediately when component mounts
        fetchEvents();

        // Set up interval to refresh every hour (3600000 milliseconds)
        const interval = setInterval(fetchEvents, 3600000);

        // Clean up interval when component unmounts
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <Container maxWidth="xl" sx={{ height: '100vh', py: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="h6">Loading calendar data...</Typography>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="xl" sx={{ height: '100vh', py: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="error" gutterBottom>
                        Error Loading Calendar
                    </Typography>
                    <Typography variant="body1" color="text.secondary" gutterBottom>
                        {error}
                    </Typography>
                    <button
                        onClick={fetchEvents}
                        style={{
                            marginTop: '16px',
                            padding: '8px 16px',
                            backgroundColor: '#1976d2',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Retry
                    </button>
                </Paper>
            </Container>
        );
    }

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