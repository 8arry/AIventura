"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { DirectionsRenderer, GoogleMap, MarkerF, PolylineF, useJsApiLoader } from "@react-google-maps/api";
import { TripPlan } from "@/types";

const centerDefault = { lat: 48.1374, lng: 11.5755 }; // Munich
const COLORS = ["#FF5733", "#33C1FF", "#8DFF33", "#FFC133", "#FF33A8", "#33FFB5"];

type PlaceSearchMapProps = {
  tripPlan: TripPlan | null;
};

type GeocodedPlace = {
  lat: number;
  lng: number;
  name: string;
};

const MOCK_BACKEND_RESPONSE = {
  daily_itinerary: {
    day_1: {
      date: "2025-05-01",
      activities: [
        {
          time: "Morning",
          description: "Start your day at Café Frischhut for coffee and their famous Auszogne pastry.",
          location: "Prälat-Zistl-Straße 8, 80331 München",
        },
        {
          time: "Morning",
          description: "Walk to Man Versus Machine for a second coffee experience.",
          location: "Müllerstraße 23, 80469 München",
        },
        {
          time: "Afternoon",
          description: "Enjoy a stroll through the English Garden, one of the largest urban parks in the world.",
          location: "München, Deutschland",
        },
        {
          time: "Evening",
          description: "Visit Café Tambosi for a traditional coffee house experience.",
          location: "Odeonsplatz 18, 80539 München",
        },
      ],
    },
    day_2: {
      date: "2025-05-02",
      activities: [
        {
          time: "Morning",
          description: "Start with coffee at Sweet Spot Kaffee.",
          location: "Reichenbachstraße 38, 80469 München",
        },
        {
          time: "Morning",
          description: "Head to Nymphenburg Palace Gardens...",
          location: "Schloß Nymphenburg 1, 80638 München",
        },
        {
          time: "Afternoon",
          description: "Walk along the Isar River and enjoy the scenic views.",
          location: "Wittelsbacherstraße 2b, 80469 München",
        },
        {
          time: "Evening",
          description: "Return to Schmalznudel - Café Frischhut.",
          location: "Prälat-Zistl-Straße 8, 80331 München",
        },
      ],
    },
    day_3: {
      date: "2025-05-03",
      activities: [
        {
          time: "Morning",
          description: "Begin your day at Olympiapark...",
          location: "Spiridon-Louis-Ring 21, 80809 München",
        },
        {
          time: "Afternoon",
          description: "Visit Hofgarten for a peaceful stroll.",
          location: "Hofgartenstraße 1, 80538 München",
        },
        {
          time: "Evening",
          description: "Wrap up your trip with a final coffee stop.",
          location: "User's choice",
        },
      ],
    },
  },
};

const convertTripFromBackend = (raw: typeof MOCK_BACKEND_RESPONSE): TripPlan => {
  const days = Object.entries(raw.daily_itinerary).map(([_, value]) => ({
    date: value.date,
    places: value.activities.map((act) => ({
      time: act.time,
      name: act.description,
      transport: "walk",
      lat: 0,
      lng: 0,
    })),
  }));

  return { days };
};

const MOCK_TRIP_PLAN: TripPlan = convertTripFromBackend(MOCK_BACKEND_RESPONSE);

export default function PlaceSearchMap({ tripPlan }: PlaceSearchMapProps) {
  const [locations, setLocations] = useState<{ date: string; places: GeocodedPlace[] }[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);

  // TODO: Remove this mock data and use the actual tripPlan prop
  const activeTripPlan = tripPlan || MOCK_TRIP_PLAN;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
    libraries: ["places"],
  });

  const [directionsList, setDirectionsList] = useState<{
    result: google.maps.DirectionsResult;
    distance: string;
    duration: string;
  }[]>([]);

  // Step 1: Geocode locations
  useEffect(() => {
    // TODO: Remove this mock data and use the actual tripPlan prop
    if (!activeTripPlan || !isLoaded) return;
    // if (!tripPlan || !isLoaded) return;

    const geocoder = new google.maps.Geocoder();

    const fetchGeocodes = async () => {
      const results = await Promise.all(
        // TODO: Use the actual tripPlan prop
        activeTripPlan.days.map(async (day) => {
          // tripPlan.days.map(async (day) => {
          const geocodedPlaces: GeocodedPlace[] = await Promise.all(
            day.places.map(async (p) => {
              if (!p.name?.trim()) {
                console.warn("Skipping empty address");
                return { lat: 0, lng: 0, name: "Unknown Location" };
              }

              try {
                const res = await geocoder.geocode({ address: p.name });
                const location = res.results[0]?.geometry.location;
                if (!location) throw new Error("No location found");

                return {
                  lat: location.lat(),
                  lng: location.lng(),
                  name: p.name,
                };
              } catch (err) {
                console.warn(`Geocoding failed for ${p.name}:`, err);
                return { lat: 0, lng: 0, name: p.name };
              }
            })
          );

          return { date: day.date, places: geocodedPlaces };
        })
      );

      setLocations(results);
    };

    fetchGeocodes();
  }, [activeTripPlan, isLoaded]);

  // Render AdvancedMarkerElement manually after geocoding
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

    locations.forEach((day) => {
      day.places.forEach((p, idx) => {
        if (p.lat === 0 && p.lng === 0) return; // skip invalid coords

        new google.maps.marker.AdvancedMarkerElement({
          map: mapRef.current!,
          position: { lat: p.lat, lng: p.lng },
          title: p.name,
        });
      });
    });
  }, [locations]);

  // Step 2: Fetch directions and summary
  useEffect(() => {
    if (!isLoaded || locations.length === 0) return;
    const service = new google.maps.DirectionsService();

    const fetchDirections = async () => {
      const all: {
        result: google.maps.DirectionsResult;
        distance: string;
        duration: string;
      }[] = [];

      for (const day of locations) {
        for (let i = 0; i < day.places.length - 1; i++) {
          const origin = day.places[i];
          const dest = day.places[i + 1];

          if (!origin || !dest || origin.lat === 0 || dest.lat === 0) continue;

          try {
            const res = await service.route({
              origin,
              destination: dest,
              travelMode: google.maps.TravelMode.WALKING,
            });

            const leg = res.routes[0]?.legs?.[0];
            all.push({
              result: res,
              distance: leg?.distance?.text || "",
              duration: leg?.duration?.text || "",
            });
          } catch (err) {
            console.warn("Failed to get directions:", err);
          }
        }
      }

      setDirectionsList(all);
    };

    fetchDirections();
  }, [locations, isLoaded]);


  const center = useMemo(() => {
    const first = locations[0]?.places[0];
    return first?.lat && first?.lng ? { lat: first.lat, lng: first.lng } : centerDefault;
  }, [locations]);

  if (!isLoaded) return <div className="flex items-center justify-center h-full">Loading map...</div>;

  // 没有行程计划时显示空状态
  if (!tripPlan && !MOCK_TRIP_PLAN.days.length) {
    return (
      <div className="flex items-center justify-center h-full flex-col text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-16 mb-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
        </svg>
        <p>Your trip plan will appear here</p>
        <p className="text-sm mt-2">Enter your travel details to get started</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      <GoogleMap
        zoom={13}
        center={center}
        mapContainerStyle={{ width: "100%", height: "500px" }}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        options={{
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          zoomControl: true,
        }}
      >
        {/* Render markers */}
        {locations.map((day, dIdx) =>
          day.places.map((p, pIdx) =>
            p.lat && p.lng ? (
              <MarkerF
                key={`marker-${dIdx}-${pIdx}`}
                position={{ lat: p.lat, lng: p.lng }}
                label={{
                  text: `${pIdx + 1}`,
                  fontSize: "12px",
                  color: "#000",
                }}
                title={p.name}
              />
            ) : null
          )
        )}

        {/* Render directions and show label */}
        {directionsList.map((dir, idx) => (
          <React.Fragment key={idx}>
            <DirectionsRenderer
              directions={dir.result}
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: COLORS[idx % COLORS.length],
                  strokeOpacity: 0.8,
                  strokeWeight: 4,
                },
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 10 + idx * 24,
                left: 12,
                backgroundColor: "white",
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: "14px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }}
            >
              Segment {idx + 1}: {dir.distance}, ~{dir.duration}
            </div>
          </React.Fragment>
        ))}
      </GoogleMap>
      {directionsList.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-white max-h-32 overflow-y-auto rounded-md shadow-md p-2">
          <h3 className="text-sm font-medium mb-1">Travel Segments:</h3>
          <div className="space-y-1">
            {directionsList.map((dir, idx) => (
              <div 
                key={idx}
                className="flex items-center text-xs p-1"
              >
                <div 
                  className="size-3 rounded-full mr-2" 
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                ></div>
                <span>
                  Segment {idx + 1}: {dir.distance}, ~{dir.duration}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
