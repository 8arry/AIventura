export type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

export type LatLng = {
    lat: number;
    lng: number;
};

export type TripPlace = {
    time: string;       // e.g., "09:00"
    name: string;
    transport: string;  // e.g., "walk" / "transit" / "drive"
    lat: number;
    lng: number;
};

export type TripDay = {
    date: string;       // e.g., "2025-05-02"
    places: TripPlace[]; // The list of places to visit
};

export type TripPlan = {
    days: TripDay[];
};

export interface Session {
    id: string;
    title: string;
    lastUpdated: Date;
  }
