"use client";

import Calendar from './Calendar';
import { Container, Grid, Paper, Typography } from '@mui/material';
import TaskList from './TaskList';

export default function FullPage() {
    return (
        <Container maxWidth="xl" sx={{ height: '100vh', py: 2 }}>
            <Grid container spacing={4} sx={{ height: '100%' }}>
                {/* Calendar section (top) */}
                <Grid size={12} sx={{ height: '80%' }}>
                    <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
                        <Calendar />
                    </Paper>
                </Grid>

                {/* Task list section (bottom) */}
                <Grid size={12} sx={{ height: '17%' }}>
                    <TaskList />
                </Grid>
            </Grid>
        </Container>
    )
}