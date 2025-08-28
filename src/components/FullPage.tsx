"use client";

import Calendar from './Calendar';
import { Container, Grid, Paper, Typography } from '@mui/material';

export default function FullPage() {
    return (
        <Container maxWidth="xl" sx={{ height: '100vh', py: 2 }}>
            <Grid container spacing={4} sx={{ height: '100%' }}>
                {/* Calendar section (3/4 of the screen) */}
                <Grid size={{ xs: 12, md: 9 }} sx={{ height: '100%' }}>
                    <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
                        <Calendar />
                    </Paper>
                </Grid>

                {/* Task list section (1/4 of the screen) */}
                <Grid size={{ xs: 12, md: 3 }} sx={{ height: '100%' }}>
                    <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>
                            Task List
                        </Typography>
                        {/* Your task list component or content will go here */}
                        <Typography variant="body2" color="text.secondary">
                            Add your tasks and activities here.
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    )
}