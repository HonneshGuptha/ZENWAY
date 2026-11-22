export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      campus_localities: {
        Row: {
          created_at: string
          id: string
          name: string
          normalized_name: string
          status: "pending" | "approved" | "rejected"
          suggestion_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          normalized_name: string
          status?: "pending" | "approved" | "rejected"
          suggestion_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          normalized_name?: string
          status?: "pending" | "approved" | "rejected"
          suggestion_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_access_config: {
        Row: {
          access_key_hash: string
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_key_hash: string
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_key_hash?: string
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_access_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_sessions: {
        Row: {
          admin_id: string
          created_at: string
          expires_at: string
          id: string
          session_token: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          expires_at?: string
          id?: string
          session_token: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          ip_address: string | null
          target_entity: string
          target_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          target_entity: string
          target_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          target_entity?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      carry_offers: {
        Row: {
          carrier_id: string
          created_at: string
          id: string
          message: string | null
          proposed_delivery_time: string | null
          request_id: string
          status: Database["public"]["Enums"]["carry_offer_status"]
          updated_at: string
        }
        Insert: {
          carrier_id: string
          created_at?: string
          id?: string
          message?: string | null
          proposed_delivery_time?: string | null
          request_id: string
          status?: Database["public"]["Enums"]["carry_offer_status"]
          updated_at?: string
        }
        Update: {
          carrier_id?: string
          created_at?: string
          id?: string
          message?: string | null
          proposed_delivery_time?: string | null
          request_id?: string
          status?: Database["public"]["Enums"]["carry_offer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carry_offers_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carry_offers_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carry_offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "carry_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      carry_requests: {
        Row: {
          accepted_offer_id: string | null
          assigned_carrier_id: string | null
          cancellation_reason: string | null
          carrier_confirmed_at: string | null
          created_at: string
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_location: string
          delivery_photo_path: string | null
          id: string
          item_description: string
          item_size: Database["public"]["Enums"]["package_size"]
          item_title: string
          needed_by: string
          payment_arrangement: string | null
          payment_status: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_location: string
          pickup_photo_path: string | null
          requester_confirmed_at: string | null
          requester_id: string
          reward_amount: number
          special_instructions: string | null
          status: Database["public"]["Enums"]["carry_request_status"]
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          accepted_offer_id?: string | null
          assigned_carrier_id?: string | null
          cancellation_reason?: string | null
          carrier_confirmed_at?: string | null
          created_at?: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_location: string
          delivery_photo_path?: string | null
          id?: string
          item_description: string
          item_size?: Database["public"]["Enums"]["package_size"]
          item_title: string
          needed_by: string
          payment_arrangement?: string | null
          payment_status?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location: string
          pickup_photo_path?: string | null
          requester_confirmed_at?: string | null
          requester_id: string
          reward_amount?: number
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["carry_request_status"]
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          accepted_offer_id?: string | null
          assigned_carrier_id?: string | null
          cancellation_reason?: string | null
          carrier_confirmed_at?: string | null
          created_at?: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_location?: string
          delivery_photo_path?: string | null
          id?: string
          item_description?: string
          item_size?: Database["public"]["Enums"]["package_size"]
          item_title?: string
          needed_by?: string
          payment_arrangement?: string | null
          payment_status?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location?: string
          pickup_photo_path?: string | null
          requester_confirmed_at?: string | null
          requester_id?: string
          reward_amount?: number
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["carry_request_status"]
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "carry_requests_assigned_carrier_id_fkey"
            columns: ["assigned_carrier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carry_requests_assigned_carrier_id_fkey"
            columns: ["assigned_carrier_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carry_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carry_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_carry_accepted_offer"
            columns: ["accepted_offer_id"]
            isOneToOne: false
            referencedRelation: "carry_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          dispute_details: string
          dispute_reason: string
          id: string
          reporter_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          respondent_id: string
          status: string
          transaction_id: string
          transaction_type: string
        }
        Insert: {
          created_at?: string
          dispute_details: string
          dispute_reason: string
          id?: string
          reporter_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          respondent_id: string
          status?: string
          transaction_id: string
          transaction_type: string
        }
        Update: {
          created_at?: string
          dispute_details?: string
          dispute_reason?: string
          id?: string
          reporter_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          respondent_id?: string
          status?: string
          transaction_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_respondent_id_fkey"
            columns: ["respondent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_respondent_id_fkey"
            columns: ["respondent_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: string
          is_read: boolean
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string
          id: string
          phone_number: string | null
          registration_rejection_reason: string | null
          registration_reviewed_at: string | null
          registration_reviewed_by: string | null
          registration_status: Database["public"]["Enums"]["registration_approval_status"]
          role: Database["public"]["Enums"]["user_role"]
          university_name: string | null
          updated_at: string
          upi_id: string | null
          verification_status: Database["public"]["Enums"]["account_verification_status"]
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name: string
          id: string
          phone_number?: string | null
          registration_rejection_reason?: string | null
          registration_reviewed_at?: string | null
          registration_reviewed_by?: string | null
          registration_status?: Database["public"]["Enums"]["registration_approval_status"]
          role?: Database["public"]["Enums"]["user_role"]
          university_name?: string | null
          updated_at?: string
          upi_id?: string | null
          verification_status?: Database["public"]["Enums"]["account_verification_status"]
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone_number?: string | null
          registration_rejection_reason?: string | null
          registration_reviewed_at?: string | null
          registration_reviewed_by?: string | null
          registration_status?: Database["public"]["Enums"]["registration_approval_status"]
          role?: Database["public"]["Enums"]["user_role"]
          university_name?: string | null
          updated_at?: string
          upi_id?: string | null
          verification_status?: Database["public"]["Enums"]["account_verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_registration_reviewed_by_fkey"
            columns: ["registration_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_registration_reviewed_by_fkey"
            columns: ["registration_reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_requests: {
        Row: {
          cancellation_reason: string | null
          created_at: string
          deposit_amount: number
          end_time: string
          id: string
          owner_confirmed_at: string | null
          owner_id: string
          owner_notes: string | null
          payment_arrangement: string | null
          payment_status: string | null
          renter_confirmed_at: string | null
          renter_id: string
          renter_notes: string | null
          start_time: string
          status: Database["public"]["Enums"]["rental_request_status"]
          total_price: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          created_at?: string
          deposit_amount?: number
          end_time: string
          id?: string
          owner_confirmed_at?: string | null
          owner_id: string
          owner_notes?: string | null
          payment_arrangement?: string | null
          payment_status?: string | null
          renter_confirmed_at?: string | null
          renter_id: string
          renter_notes?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["rental_request_status"]
          total_price: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          cancellation_reason?: string | null
          created_at?: string
          deposit_amount?: number
          end_time?: string
          id?: string
          owner_confirmed_at?: string | null
          owner_id?: string
          owner_notes?: string | null
          payment_arrangement?: string | null
          payment_status?: string | null
          renter_confirmed_at?: string | null
          renter_id?: string
          renter_notes?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["rental_request_status"]
          total_price?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_requests_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_requests_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_requests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          carry_request_id: string | null
          comment: string | null
          created_at: string
          exchange_type: Database["public"]["Enums"]["exchange_service"]
          id: string
          rating: number
          rental_request_id: string | null
          reviewee_id: string
          reviewer_id: string
          ride_request_id: string | null
        }
        Insert: {
          carry_request_id?: string | null
          comment?: string | null
          created_at?: string
          exchange_type: Database["public"]["Enums"]["exchange_service"]
          id?: string
          rating: number
          rental_request_id?: string | null
          reviewee_id: string
          reviewer_id: string
          ride_request_id?: string | null
        }
        Update: {
          carry_request_id?: string | null
          comment?: string | null
          created_at?: string
          exchange_type?: Database["public"]["Enums"]["exchange_service"]
          id?: string
          rating?: number
          rental_request_id?: string | null
          reviewee_id?: string
          reviewer_id?: string
          ride_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_carry_request_id_fkey"
            columns: ["carry_request_id"]
            isOneToOne: false
            referencedRelation: "carry_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_rental_request_id_fkey"
            columns: ["rental_request_id"]
            isOneToOne: false
            referencedRelation: "rental_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          cancellation_reason: string | null
          created_at: string
          driver_confirmed_at: string | null
          id: string
          passenger_confirmed_at: string | null
          passenger_id: string
          payment_arrangement: string | null
          payment_status: string | null
          pickup_note: string | null
          ride_id: string
          seats_requested: number
          status: Database["public"]["Enums"]["ride_request_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          created_at?: string
          driver_confirmed_at?: string | null
          id?: string
          passenger_confirmed_at?: string | null
          passenger_id: string
          payment_arrangement?: string | null
          payment_status?: string | null
          pickup_note?: string | null
          ride_id: string
          seats_requested?: number
          status?: Database["public"]["Enums"]["ride_request_status"]
          total_price?: number
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          created_at?: string
          driver_confirmed_at?: string | null
          id?: string
          passenger_confirmed_at?: string | null
          passenger_id?: string
          payment_arrangement?: string | null
          payment_status?: string | null
          pickup_note?: string | null
          ride_id?: string
          seats_requested?: number
          status?: Database["public"]["Enums"]["ride_request_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          available_seats: number
          created_at: string
          departure_time: string
          destination_lat: number | null
          destination_lng: number | null
          destination_name: string
          driver_id: string
          id: string
          notes: string | null
          origin_lat: number | null
          origin_lng: number | null
          origin_name: string
          price_per_seat: number
          status: Database["public"]["Enums"]["ride_status"]
          total_seats: number
          updated_at: string
        }
        Insert: {
          available_seats: number
          created_at?: string
          departure_time: string
          destination_lat?: number | null
          destination_lng?: number | null
          destination_name: string
          driver_id: string
          id?: string
          notes?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          origin_name: string
          price_per_seat?: number
          status?: Database["public"]["Enums"]["ride_status"]
          total_seats: number
          updated_at?: string
        }
        Update: {
          available_seats?: number
          created_at?: string
          departure_time?: string
          destination_lat?: number | null
          destination_lng?: number | null
          destination_name?: string
          driver_id?: string
          id?: string
          notes?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          origin_name?: string
          price_per_seat?: number
          status?: Database["public"]["Enums"]["ride_status"]
          total_seats?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_verifications: {
        Row: {
          created_at: string
          document_type: Database["public"]["Enums"]["document_type"]
          id: string
          id_document_path: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_submission_status"]
          student_id_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          id_document_path: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_submission_status"]
          student_id_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          id_document_path?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_submission_status"]
          student_id_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_images: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_path: string
          is_primary: boolean
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_path: string
          is_primary?: boolean
          vehicle_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_path?: string
          is_primary?: boolean
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_images_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand_model: string | null
          created_at: string
          daily_rate: number | null
          deposit_amount: number
          description: string
          hourly_rate: number | null
          id: string
          latitude: number | null
          longitude: number | null
          owner_id: string
          pickup_location: string
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at: string
        }
        Insert: {
          brand_model?: string | null
          created_at?: string
          daily_rate?: number | null
          deposit_amount?: number
          description: string
          hourly_rate?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          owner_id: string
          pickup_location: string
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
        }
        Update: {
          brand_model?: string | null
          created_at?: string
          daily_rate?: number | null
          deposit_amount?: number
          description?: string
          hourly_rate?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          owner_id?: string
          pickup_location?: string
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          phone_number: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          university_name: string | null
          upi_id: string | null
          verification_status:
            | Database["public"]["Enums"]["account_verification_status"]
            | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          phone_number?: never
          role?: Database["public"]["Enums"]["user_role"] | null
          university_name?: string | null
          upi_id?: never
          verification_status?:
            | Database["public"]["Enums"]["account_verification_status"]
            | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          phone_number?: never
          role?: Database["public"]["Enums"]["user_role"] | null
          university_name?: string | null
          upi_id?: never
          verification_status?:
            | Database["public"]["Enums"]["account_verification_status"]
            | null
        }
        Relationships: []
      }
    }
    Functions: {
      suggest_campus_locality: {
        Args: {
          p_name: string
        }
        Returns: Json
      }
      accept_carry_offer: { Args: { p_offer_id: string }; Returns: undefined }
      accept_rental_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      accept_ride_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      admin_moderate_listing: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_reason?: string
        }
        Returns: boolean
      }
      admin_resolve_dispute: {
        Args: { p_dispute_id: string; p_notes: string; p_resolution: string }
        Returns: boolean
      }
      approve_registration: { Args: { p_user_id: string }; Returns: boolean }
      cancel_transaction_with_reason: {
        Args: { p_reason: string; p_request_id: string; p_service: string }
        Returns: boolean
      }
      confirm_mutual_completion: {
        Args: { p_request_id: string; p_service: string }
        Returns: Json
      }
      create_audit_log: {
        Args: {
          p_action: string
          p_actor_id: string
          p_details?: Json
          p_ip_address?: string
          p_target_entity: string
          p_target_id: string
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_admin_disputes: {
        Args: never
        Returns: {
          created_at: string
          dispute_details: string
          dispute_reason: string
          id: string
          reporter_email: string
          reporter_id: string
          reporter_name: string
          resolution_notes: string
          resolved_at: string
          respondent_email: string
          respondent_id: string
          respondent_name: string
          status: string
          transaction_id: string
          transaction_type: string
        }[]
      }
      get_admin_registrations: {
        Args: { p_status?: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone_number: string
          registration_rejection_reason: string
          registration_reviewed_at: string
          registration_reviewed_by: string
          registration_status: Database["public"]["Enums"]["registration_approval_status"]
          role: Database["public"]["Enums"]["user_role"]
          university_name: string
          verification_status: Database["public"]["Enums"]["account_verification_status"]
        }[]
      }
      get_admin_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          registration_status: Database["public"]["Enums"]["registration_approval_status"]
          role: Database["public"]["Enums"]["user_role"]
          university_name: string
          verification_status: Database["public"]["Enums"]["account_verification_status"]
        }[]
      }
      get_admin_verifications: {
        Args: { p_status?: string }
        Returns: {
          created_at: string
          document_type: Database["public"]["Enums"]["document_type"]
          email: string
          full_name: string
          id: string
          id_document_path: string
          rejection_reason: string
          reviewed_at: string
          reviewed_by: string
          status: Database["public"]["Enums"]["verification_submission_status"]
          student_id_number: string
          university_name: string
          user_id: string
        }[]
      }
      get_platform_statistics: { Args: never; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_verified_student: { Args: never; Returns: boolean }
      promote_student_to_admin: {
        Args: { p_user_email: string }
        Returns: boolean
      }
      provision_initial_admin: {
        Args: { p_admin_key?: string; p_user_email: string }
        Returns: string | boolean
      }
      reject_registration: {
        Args: { p_rejection_reason: string; p_user_id: string }
        Returns: boolean
      }
      review_student_verification: {
        Args: {
          p_decision: string
          p_reason?: string
          p_verification_id: string
        }
        Returns: boolean
      }
      submit_transaction_dispute: {
        Args: {
          p_dispute_details: string
          p_dispute_reason: string
          p_respondent_id: string
          p_transaction_id: string
          p_transaction_type: string
        }
        Returns: string
      }
      toggle_user_suspension: {
        Args: { p_reason?: string; p_suspend: boolean; p_user_id: string }
        Returns: boolean
      }
      admin_sign_out: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      check_admin_session: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      create_rental_booking: {
        Args: {
          p_vehicle_id: string
          p_start_time: string
          p_end_time: string
          p_renter_notes?: string
        }
        Returns: string
      }
      create_ride_booking: {
        Args: {
          p_ride_id: string
          p_seats_requested: number
          p_pickup_note?: string
        }
        Returns: string
      }
      has_active_admin_session: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      provision_admin_access_key: {
        Args: { p_new_key: string }
        Returns: string
      }
      update_admin_access_key: {
        Args: { p_new_key: string; p_old_key: string }
        Returns: boolean
      }
      verify_admin_access_key: { Args: { p_key: string }; Returns: boolean }
    }
    Enums: {
      account_verification_status:
        | "unverified"
        | "pending"
        | "verified"
        | "suspended"
      carry_offer_status: "pending" | "accepted" | "rejected" | "cancelled"
      carry_request_status:
        | "open"
        | "accepted"
        | "in_transit"
        | "delivered"
        | "cancelled"
      document_type:
        | "student_id_card"
        | "enrollment_certificate"
        | "tuition_receipt"
        | "campus_portal_screenshot"
      exchange_service: "rent" | "ride" | "carry"
      listing_status: "available" | "paused" | "archived"
      notification_type:
        | "rental_request_received"
        | "rental_request_accepted"
        | "rental_request_rejected"
        | "rental_active"
        | "rental_completed"
        | "ride_request_received"
        | "ride_request_accepted"
        | "ride_request_rejected"
        | "ride_cancelled"
        | "carry_offer_received"
        | "carry_offer_accepted"
        | "carry_in_transit"
        | "carry_delivered"
        | "verification_submitted"
        | "verification_approved"
        | "verification_rejected"
        | "review_received"
        | "system_announcement"
      package_size: "envelope" | "small_box" | "backpack" | "medium_box"
      registration_approval_status: "pending" | "approved" | "rejected"
      rental_request_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "active"
        | "completed"
        | "cancelled"
      ride_request_status: "pending" | "accepted" | "rejected" | "cancelled"
      ride_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      user_role: "student" | "admin"
      vehicle_type: "bicycle" | "e_scooter" | "car" | "motorcycle"
      verification_submission_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_verification_status: [
        "unverified",
        "pending",
        "verified",
        "suspended",
      ],
      carry_offer_status: ["pending", "accepted", "rejected", "cancelled"],
      carry_request_status: [
        "open",
        "accepted",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      document_type: [
        "student_id_card",
        "enrollment_certificate",
        "tuition_receipt",
        "campus_portal_screenshot",
      ],
      exchange_service: ["rent", "ride", "carry"],
      listing_status: ["available", "paused", "archived"],
      notification_type: [
        "rental_request_received",
        "rental_request_accepted",
        "rental_request_rejected",
        "rental_active",
        "rental_completed",
        "ride_request_received",
        "ride_request_accepted",
        "ride_request_rejected",
        "ride_cancelled",
        "carry_offer_received",
        "carry_offer_accepted",
        "carry_in_transit",
        "carry_delivered",
        "verification_submitted",
        "verification_approved",
        "verification_rejected",
        "review_received",
        "system_announcement",
      ],
      package_size: ["envelope", "small_box", "backpack", "medium_box"],
      registration_approval_status: ["pending", "approved", "rejected"],
      rental_request_status: [
        "pending",
        "accepted",
        "rejected",
        "active",
        "completed",
        "cancelled",
      ],
      ride_request_status: ["pending", "accepted", "rejected", "cancelled"],
      ride_status: ["scheduled", "in_progress", "completed", "cancelled"],
      user_role: ["student", "admin"],
      vehicle_type: ["bicycle", "e_scooter", "car", "motorcycle"],
      verification_submission_status: ["pending", "approved", "rejected"],
    },
  },
} as const
