/**
 * useGeoNavigation
 *
 * Watches the device GPS and fires `nearbyStop` whenever the user enters
 * within `thresholdMeters` of any unvisited stop in the `stops` list.
 * Stops that are not in the list are NEVER triggered — enforcing the
 * "only narrate places on our road" rule.
 *
 * @param {object[]} stops           Ordered route waypoints: {id, name, lat, lon, ...}
 * @param {number}   thresholdMeters Radius that triggers narration (default 150 m)
 * @param {boolean}  enabled         Set true to start GPS watching
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6_371_000, r = Math.PI / 180;
    const dLat = (lat2 - lat1) * r;
    const dLon = (lon2 - lon1) * r;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function useGeoNavigation({
    stops = [],
    thresholdMeters = 150,
    enabled = false,
}) {
    const [userPos,    setUserPos]    = useState(null);    // [lat, lon]
    const [nearbyStop, setNearbyStop] = useState(null);    // triggered stop object
    const [geoState,   setGeoState]   = useState('idle');  // idle|requesting|active|denied|unavailable
    const [visitedIds, setVisitedIds] = useState(new Set());

    // Use refs so the GPS callback always sees current values without restarting the watch
    const visitedRef   = useRef(new Set());
    const watchIdRef   = useRef(null);
    const stopsRef     = useRef(stops);
    const thresholdRef = useRef(thresholdMeters);

    useEffect(() => { stopsRef.current    = stops;          }, [stops]);
    useEffect(() => { thresholdRef.current = thresholdMeters; }, [thresholdMeters]);

    const markVisited = useCallback((id) => {
        visitedRef.current.add(id);
        setVisitedIds(new Set(visitedRef.current));
    }, []);

    /** Call this when a new route is loaded to reset progress. */
    const clearVisited = useCallback(() => {
        visitedRef.current.clear();
        setVisitedIds(new Set());
        setNearbyStop(null);
    }, []);

    useEffect(() => {
        if (!enabled) {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            setGeoState('idle');
            return;
        }

        if (!navigator.geolocation) {
            setGeoState('unavailable');
            return;
        }

        setGeoState('requesting');

        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude: lat, longitude: lon } = pos.coords;
                setUserPos([lat, lon]);
                setGeoState('active');

                // Walk the route stops in order; trigger the first unvisited one we're near.
                // Stops absent from this list are never triggered.
                for (const stop of stopsRef.current) {
                    const id = stop.id ?? stop.name;
                    if (visitedRef.current.has(id)) continue;
                    const dist = haversineMeters(lat, lon, stop.lat, stop.lon);
                    if (dist <= thresholdRef.current) {
                        markVisited(id);
                        setNearbyStop({ ...stop, _ts: Date.now() });
                        break;  // one at a time
                    }
                }
            },
            (err) => {
                setGeoState(err.code === 1 ? 'denied' : 'unavailable');
            },
            { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
        );

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, [enabled, markVisited]);

    return { userPos, nearbyStop, visitedIds, geoState, clearVisited };
}
