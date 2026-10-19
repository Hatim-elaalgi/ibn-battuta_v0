import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell        from './components/layout/AppShell';
import FrontDoor       from './pages/FrontDoor';
import Walk            from './pages/Walk';
import Itineraries     from './pages/Itineraries';
import FieldGuide      from './pages/FieldGuide';
import Live            from './pages/Live';
import About           from './pages/About';
import Create          from './pages/Create';
import ItineraryEditor from './pages/ItineraryEditor';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<AppShell />}>
                    <Route path="/"                      element={<FrontDoor />} />
                    <Route path="/create"                element={<Create />} />
                    <Route path="/itinerary/:token"      element={<ItineraryEditor />} />
                    <Route path="/shared/:token"         element={<ItineraryEditor />} />
                    <Route path="/walk"                  element={<Walk />} />
                    <Route path="/itineraries"           element={<Itineraries />} />
                    <Route path="/field-guide"           element={<FieldGuide />} />
                    <Route path="/live"                  element={<Live />} />
                    <Route path="/about"                 element={<About />} />
                    <Route path="*"                      element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
