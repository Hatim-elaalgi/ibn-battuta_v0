import React from 'react';
import { Map } from 'lucide-react';

export default function MapPlaceholder({ className }) {
    return (
        <div className={`bg-gray-200 flex flex-col items-center justify-center text-gray-500 ${className}`}>
            <Map size={48} className="mb-4 opacity-50" />
            <h3 className="text-xl font-semibold">Map View</h3>
            <p className="text-sm">Interactive map coming soon</p>
        </div>
    );
}
