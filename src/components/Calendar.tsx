"use client";

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg } from '@fullcalendar/core';
import { useEffect, useState } from 'react';
import { CalendarEvent, CalendarSource } from '@/app/api/calendar/route';

const Calendar: React.FC = () => {
    const handleEventClick = (clickInfo: EventClickArg) => {
        console.log(clickInfo);
        alert(`Event: ${clickInfo.event.title}\nStarts on: ${clickInfo.event.startStr}\nEnds on: ${clickInfo.event.endStr}`);
    };

    const [events, setEvents] = useState<CalendarSource[]>([]);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

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
        .reduce((acc, source) => [...acc, ...source.events], [] as CalendarEvent[]);

    return (
        <div style={{ padding: '20px', backgroundColor: '#f5f5f5' }}>
            <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                displayEventTime={true}
                weekends={true}
                events={calendarEvents}
                eventClick={handleEventClick}
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                // This disables the "more" link and shows all events in the day cell
                dayMaxEvents={true}
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
                    <div key={source.name} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
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