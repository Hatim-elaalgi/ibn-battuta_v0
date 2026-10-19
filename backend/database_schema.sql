-- Database Schema for AI Tourist Guide

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
-- Core entity for authentication and personalization
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: places_of_interest (POIs)
-- Generic table for landmarks, museums, parks
CREATE TABLE places_of_interest (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL, -- useful for URLs
    description TEXT,
    category VARCHAR(50), -- e.g., 'Historical', 'Nature', 'Museum'
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    address TEXT,
    opening_hours JSONB, -- Flexible JSON structure for hours
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: restaurants
-- Distinct from POIs due to specific attributes like cuisine, price range
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    cuisine_type VARCHAR(100), -- e.g., 'Moroccan', 'Seafood', 'Cafe'
    price_range VARCHAR(10), -- e.g., '$', '$$', '$$$'
    rating DECIMAL(3,1), -- e.g., 4.5
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    address TEXT,
    phone_number VARCHAR(20),
    website_url TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: events
-- Time-bound occurrences
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    location_name VARCHAR(255),
    place_id UUID REFERENCES places_of_interest(id) ON DELETE SET NULL, -- Optional link to a POI
    image_url TEXT,
    organizer_contact VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_poi_category ON places_of_interest(category);
CREATE INDEX idx_restaurants_cuisine ON restaurants(cuisine_type);
CREATE INDEX idx_events_start_time ON events(start_time);
