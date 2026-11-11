-- Migration: 20261110000001_core_extensions_and_enums.sql
-- Description: Enables core extensions and creates all 14 domain enums

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2. User authorization tier
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Account-level access standing (stored on profiles)
DO $$ BEGIN
    CREATE TYPE account_verification_status AS ENUM ('unverified', 'pending', 'verified', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Individual document review state (stored on student_verifications)
DO $$ BEGIN
    CREATE TYPE verification_submission_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. University enrollment proof document categories
DO $$ BEGIN
    CREATE TYPE document_type AS ENUM (
        'student_id_card',
        'enrollment_certificate',
        'tuition_receipt',
        'campus_portal_screenshot'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 6. Vehicle classifications for RENT
DO $$ BEGIN
    CREATE TYPE vehicle_type AS ENUM ('bicycle', 'e_scooter', 'car', 'motorcycle');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 7. Vehicle listing availability status
DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('available', 'paused', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 8. Rental booking lifecycle state
DO $$ BEGIN
    CREATE TYPE rental_request_status AS ENUM (
        'pending',
        'accepted',
        'rejected',
        'active',
        'completed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 9. Carpool ride lifecycle state
DO $$ BEGIN
    CREATE TYPE ride_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 10. Passenger ride seat request state
DO $$ BEGIN
    CREATE TYPE ride_request_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 11. Item volume classification for CARRY
DO $$ BEGIN
    CREATE TYPE package_size AS ENUM ('envelope', 'small_box', 'backpack', 'medium_box');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 12. Package delivery request state
DO $$ BEGIN
    CREATE TYPE carry_request_status AS ENUM (
        'open',
        'accepted',
        'in_transit',
        'delivered',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 13. Carrier route proposal state
DO $$ BEGIN
    CREATE TYPE carry_offer_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 14. Service category classification for peer reviews
DO $$ BEGIN
    CREATE TYPE exchange_service AS ENUM ('rent', 'ride', 'carry');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 15. In-app notification classifications
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'rental_request_received',
        'rental_request_accepted',
        'rental_request_rejected',
        'rental_active',
        'rental_completed',
        'ride_request_received',
        'ride_request_accepted',
        'ride_request_rejected',
        'ride_cancelled',
        'carry_offer_received',
        'carry_offer_accepted',
        'carry_in_transit',
        'carry_delivered',
        'verification_submitted',
        'verification_approved',
        'verification_rejected',
        'review_received',
        'system_announcement'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
