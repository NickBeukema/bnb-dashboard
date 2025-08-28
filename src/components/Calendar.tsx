"use client";

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg } from '@fullcalendar/core';
import { useEffect, useState } from 'react';
import { CalendarEvent, CalendarSource } from '@/app/api/calendar/route';
import EventModal from './EventModal';

const Calendar: React.FC = () => {

    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    const [events, setEvents] = useState<CalendarSource[]>([]);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

    const fetchEvents = () => {
        fetch('/api/calendar')
            .then(response => response.json())
            .then(data => {
                setEvents(data.events);
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

    const calendarEvents = events
        .filter(source => !selectedLocation || source.name === selectedLocation)
        .reduce((acc, source) => [...acc, ...source.events], [] as CalendarEvent[]);

    const handleEventClick = (clickInfo: EventClickArg) => {
        // Subtract one day from the end date
        const endDate = new Date(clickInfo.event.endStr);
        endDate.setDate(endDate.getDate() - 1);
        const adjustedEndStr = endDate.toISOString().split('T')[0];

        const eventId = clickInfo.event.id;
        const event = calendarEvents.find(event => event.id === eventId);

        console.log(event);

        if (event) {
            setSelectedEvent(event);
        }
    };

    const handleLocationClick = (location: string) => {
        if (selectedLocation === location) {
            setSelectedLocation(null);
        } else {
            setSelectedLocation(location);
        }
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#f5f5f5', height: 'calc(100% - 40px)' }}>
            <EventModal
                open={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                event={selectedEvent}
            />
            <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                displayEventTime={true}
                weekends={true}
                events={calendarEvents}
                height="99%"
                eventClick={handleEventClick}
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                // This disables the "more" link and shows all events in the day cell
                dayMaxEvents={7}
            />

            {/* Legend */}
            <div style={{
                marginTop: '20px',
                display: 'flex',
                justifyContent: 'center',
                gap: '20px',
                flexWrap: 'wrap'
            }}>
                {events.map((source) => (
                    <div key={source.name}
                        onClick={() => handleLocationClick(source.name)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: (!selectedLocation || selectedLocation === source.name ? 1 : 0.5)
                        }}>
                        <div style={{
                            width: '16px',
                            height: '16px',
                            backgroundColor: source.color,
                            borderRadius: '3px'
                        }} />
                        <span style={{ fontSize: '14px', color: '#333' }}>
                            {source.name}
                        </span>
                    </div>
                ))}
            </div>

            {lastRefresh && (
                <div style={{
                    marginTop: '20px',
                    textAlign: 'center',
                    fontSize: '14px',
                    color: '#666',
                    fontStyle: 'italic'
                }}>
                    Last refreshed: {lastRefresh.toLocaleString()}
                </div>
            )}
        </div>
    );
};

export default Calendar;