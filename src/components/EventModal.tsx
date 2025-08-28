import { CalendarEvent } from '@/app/api/calendar/route';
import { Modal, Box, Typography, Stack, Button } from '@mui/material';

interface Props {
    open: boolean;
    onClose: () => void;
    event: CalendarEvent | null;
}

const formatDate = (dateString: string, daysToSubtract: number = 0) => {
    try {
        const date = new Date(dateString);
        date.setDate(date.getDate() - daysToSubtract);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            // hour: '2-digit',
            // minute: '2-digit',
        });
    } catch (error) {
        console.error("Error formatting date:", error);
        return dateString; // Return original string if formatting fails
    }
}

const style = {
    position: 'absolute' as 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: { xs: '90%', sm: 400 }, // Responsive width
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
    borderRadius: 2, // Rounded corners
    color: 'black',
};

export default function EventModal({ open, onClose, event }: Props) {
    if (!event) return null;

    return (
        <Modal
            open={open}
            onClose={onClose}
            aria-labelledby="event-modal-title"
            aria-describedby="event-modal-description"
        >
            <Box sx={style}>
                <Typography id="event-modal-title" variant="h5" component="h2" gutterBottom>
                    {event.title}
                </Typography>
                <Stack spacing={1}>
                    <Typography variant="body1">
                        <strong>Start Date:</strong> {formatDate(event.start)}
                    </Typography>
                    <Typography variant="body1">
                        <strong>End Date:</strong> {formatDate(event.end, 1)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        <strong>Source:</strong> {event.location}
                    </Typography>
                </Stack>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button onClick={onClose} variant="contained" color="primary">
                        Close
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}