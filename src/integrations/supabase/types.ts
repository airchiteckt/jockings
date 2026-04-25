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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      abuse_reports: {
        Row: {
          additional_details: string | null
          call_date: string
          call_time: string | null
          created_at: string
          id: string
          prank_subject: string | null
          reporter_phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          additional_details?: string | null
          call_date: string
          call_time?: string | null
          created_at?: string
          id?: string
          prank_subject?: string | null
          reporter_phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          additional_details?: string | null
          call_date?: string
          call_time?: string | null
          created_at?: string
          id?: string
          prank_subject?: string | null
          reporter_phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      blocked_phone_numbers: {
        Row: {
          blocked_at: string
          created_at: string
          id: string
          phone_number: string
          reason: string | null
        }
        Insert: {
          blocked_at?: string
          created_at?: string
          id?: string
          phone_number: string
          reason?: string | null
        }
        Update: {
          blocked_at?: string
          created_at?: string
          id?: string
          phone_number?: string
          reason?: string | null
        }
        Relationships: []
      }
      call_queue: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          phone_number_id: string | null
          position: number | null
          prank_id: string
          scheduled_for: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          phone_number_id?: string | null
          position?: number | null
          prank_id: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          phone_number_id?: string | null
          position?: number | null
          prank_id?: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_queue_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "twilio_phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_prank_id_fkey"
            columns: ["prank_id"]
            isOneToOne: false
            referencedRelation: "pranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_prank_id_fkey"
            columns: ["prank_id"]
            isOneToOne: false
            referencedRelation: "pranks_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      prank_content_rules: {
        Row: {
          block_message: string
          category: string
          created_at: string
          id: string
          is_active: boolean | null
          keywords: string[]
          updated_at: string
        }
        Insert: {
          block_message: string
          category: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          keywords?: string[]
          updated_at?: string
        }
        Update: {
          block_message?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          keywords?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      prank_disclaimer_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          disclaimer_version: string
          id: string
          ip_hash: string | null
          prank_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          disclaimer_version?: string
          id?: string
          ip_hash?: string | null
          prank_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          disclaimer_version?: string
          id?: string
          ip_hash?: string | null
          prank_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prank_disclaimer_acceptances_prank_id_fkey"
            columns: ["prank_id"]
            isOneToOne: false
            referencedRelation: "pranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prank_disclaimer_acceptances_prank_id_fkey"
            columns: ["prank_id"]
            isOneToOne: false
            referencedRelation: "pranks_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      prank_presets: {
        Row: {
          background_sound_enabled: boolean | null
          background_sound_prompt: string | null
          background_sound_url: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          theme: string
          title: string
          updated_at: string
        }
        Insert: {
          background_sound_enabled?: boolean | null
          background_sound_prompt?: string | null
          background_sound_url?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          theme: string
          title: string
          updated_at?: string
        }
        Update: {
          background_sound_enabled?: boolean | null
          background_sound_prompt?: string | null
          background_sound_url?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          theme?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      pranks: {
        Row: {
          call_status: string
          conversation_history: Json | null
          created_at: string
          creativity_level: number
          elevenlabs_similarity: number | null
          elevenlabs_speed: number | null
          elevenlabs_stability: number | null
          elevenlabs_style: number | null
          elevenlabs_voice_id: string | null
          id: string
          language: string
          max_duration: number
          personality_tone: string
          prank_theme: string
          pregenerated_background_url: string | null
          pregenerated_greeting_url: string | null
          real_detail: string | null
          recording_url: string | null
          reveal_sender_name: string | null
          reveal_sms_scheduled_at: string | null
          reveal_sms_sent: boolean | null
          scheduled_at: string | null
          send_recording: boolean
          send_reveal_sms: boolean | null
          twilio_call_sid: string | null
          updated_at: string
          user_id: string
          victim_first_name: string
          victim_gender: string | null
          victim_last_name: string
          victim_phone: string
          voice_gender: string
          voice_provider: string
        }
        Insert: {
          call_status?: string
          conversation_history?: Json | null
          created_at?: string
          creativity_level?: number
          elevenlabs_similarity?: number | null
          elevenlabs_speed?: number | null
          elevenlabs_stability?: number | null
          elevenlabs_style?: number | null
          elevenlabs_voice_id?: string | null
          id?: string
          language?: string
          max_duration?: number
          personality_tone?: string
          prank_theme: string
          pregenerated_background_url?: string | null
          pregenerated_greeting_url?: string | null
          real_detail?: string | null
          recording_url?: string | null
          reveal_sender_name?: string | null
          reveal_sms_scheduled_at?: string | null
          reveal_sms_sent?: boolean | null
          scheduled_at?: string | null
          send_recording?: boolean
          send_reveal_sms?: boolean | null
          twilio_call_sid?: string | null
          updated_at?: string
          user_id: string
          victim_first_name: string
          victim_gender?: string | null
          victim_last_name: string
          victim_phone: string
          voice_gender: string
          voice_provider?: string
        }
        Update: {
          call_status?: string
          conversation_history?: Json | null
          created_at?: string
          creativity_level?: number
          elevenlabs_similarity?: number | null
          elevenlabs_speed?: number | null
          elevenlabs_stability?: number | null
          elevenlabs_style?: number | null
          elevenlabs_voice_id?: string | null
          id?: string
          language?: string
          max_duration?: number
          personality_tone?: string
          prank_theme?: string
          pregenerated_background_url?: string | null
          pregenerated_greeting_url?: string | null
          real_detail?: string | null
          recording_url?: string | null
          reveal_sender_name?: string | null
          reveal_sms_scheduled_at?: string | null
          reveal_sms_sent?: boolean | null
          scheduled_at?: string | null
          send_recording?: boolean
          send_reveal_sms?: boolean | null
          twilio_call_sid?: string | null
          updated_at?: string
          user_id?: string
          victim_first_name?: string
          victim_gender?: string | null
          victim_last_name?: string
          victim_phone?: string
          voice_gender?: string
          voice_provider?: string
        }
        Relationships: []
      }
      processed_payments: {
        Row: {
          amount_paid: number | null
          created_at: string
          currency: string | null
          id: string
          package_type: string | null
          pranks_added: number
          session_id: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          package_type?: string | null
          pranks_added: number
          session_id: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          package_type?: string | null
          pranks_added?: number
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          available_pranks: number | null
          avatar_url: string | null
          card_verified: boolean | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          phone_number: string | null
          phone_verification_code: string | null
          phone_verification_expires_at: string | null
          phone_verified: boolean | null
          privacy_accepted_at: string | null
          privacy_version: string | null
          stripe_customer_id: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          trial_prank_used: boolean | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          available_pranks?: number | null
          avatar_url?: string | null
          card_verified?: boolean | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone_number?: string | null
          phone_verification_code?: string | null
          phone_verification_expires_at?: string | null
          phone_verified?: boolean | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          stripe_customer_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          trial_prank_used?: boolean | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          available_pranks?: number | null
          avatar_url?: string | null
          card_verified?: boolean | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone_number?: string | null
          phone_verification_code?: string | null
          phone_verification_expires_at?: string | null
          phone_verified?: boolean | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          stripe_customer_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          trial_prank_used?: boolean | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      promo_code_uses: {
        Row: {
          id: string
          promo_code_id: string
          session_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          promo_code_id: string
          session_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          promo_code_id?: string
          session_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_uses_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          discount_percentage: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          discount_percentage: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          discount_percentage?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          ai_response: string | null
          category: string
          contact_email: string | null
          created_at: string
          id: string
          message: string
          page_url: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
          updated_at: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          ai_response?: string | null
          category: string
          contact_email?: string | null
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          ai_response?: string | null
          category?: string
          contact_email?: string | null
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      twilio_phone_numbers: {
        Row: {
          caller_id_anonymous: boolean | null
          country_code: string
          country_name: string
          created_at: string
          current_calls: number | null
          friendly_name: string | null
          id: string
          is_active: boolean | null
          max_concurrent_calls: number | null
          phone_number: string
          updated_at: string
        }
        Insert: {
          caller_id_anonymous?: boolean | null
          country_code: string
          country_name: string
          created_at?: string
          current_calls?: number | null
          friendly_name?: string | null
          id?: string
          is_active?: boolean | null
          max_concurrent_calls?: number | null
          phone_number: string
          updated_at?: string
        }
        Update: {
          caller_id_anonymous?: boolean | null
          country_code?: string
          country_name?: string
          created_at?: string
          current_calls?: number | null
          friendly_name?: string | null
          id?: string
          is_active?: boolean | null
          max_concurrent_calls?: number | null
          phone_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vapi_phone_numbers: {
        Row: {
          created_at: string
          friendly_name: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          phone_number: string | null
          phone_number_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          friendly_name?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          phone_number?: string | null
          phone_number_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          friendly_name?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          phone_number?: string | null
          phone_number_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      vapi_settings_snapshots: {
        Row: {
          app_settings_data: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_auto: boolean
          name: string
          source_snapshot_id: string | null
          voice_settings_data: Json
        }
        Insert: {
          app_settings_data?: Json
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_auto?: boolean
          name: string
          source_snapshot_id?: string | null
          voice_settings_data?: Json
        }
        Update: {
          app_settings_data?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_auto?: boolean
          name?: string
          source_snapshot_id?: string | null
          voice_settings_data?: Json
        }
        Relationships: []
      }
      verified_caller_ids: {
        Row: {
          created_at: string
          current_calls: number | null
          friendly_name: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          max_concurrent_calls: number | null
          phone_number: string
          updated_at: string
          vapi_phone_number_id: string | null
        }
        Insert: {
          created_at?: string
          current_calls?: number | null
          friendly_name?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          max_concurrent_calls?: number | null
          phone_number: string
          updated_at?: string
          vapi_phone_number_id?: string | null
        }
        Update: {
          created_at?: string
          current_calls?: number | null
          friendly_name?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          max_concurrent_calls?: number | null
          phone_number?: string
          updated_at?: string
          vapi_phone_number_id?: string | null
        }
        Relationships: []
      }
      voice_settings: {
        Row: {
          cost_per_1k_chars: number | null
          created_at: string
          description: string | null
          elevenlabs_similarity: number | null
          elevenlabs_speed: number | null
          elevenlabs_stability: number | null
          elevenlabs_style: number | null
          elevenlabs_voice_id: string | null
          gender: string
          id: string
          is_active: boolean | null
          language: string
          latency_ms: number | null
          model_id: string | null
          notes: string | null
          polly_voice_id: string | null
          provider_settings: Json | null
          provider_voice_id: string | null
          rating: number | null
          sample_audio_url: string | null
          supports_italian_native: boolean | null
          supports_streaming: boolean | null
          updated_at: string
          voice_name: string | null
          voice_provider: string
        }
        Insert: {
          cost_per_1k_chars?: number | null
          created_at?: string
          description?: string | null
          elevenlabs_similarity?: number | null
          elevenlabs_speed?: number | null
          elevenlabs_stability?: number | null
          elevenlabs_style?: number | null
          elevenlabs_voice_id?: string | null
          gender: string
          id?: string
          is_active?: boolean | null
          language: string
          latency_ms?: number | null
          model_id?: string | null
          notes?: string | null
          polly_voice_id?: string | null
          provider_settings?: Json | null
          provider_voice_id?: string | null
          rating?: number | null
          sample_audio_url?: string | null
          supports_italian_native?: boolean | null
          supports_streaming?: boolean | null
          updated_at?: string
          voice_name?: string | null
          voice_provider?: string
        }
        Update: {
          cost_per_1k_chars?: number | null
          created_at?: string
          description?: string | null
          elevenlabs_similarity?: number | null
          elevenlabs_speed?: number | null
          elevenlabs_stability?: number | null
          elevenlabs_style?: number | null
          elevenlabs_voice_id?: string | null
          gender?: string
          id?: string
          is_active?: boolean | null
          language?: string
          latency_ms?: number | null
          model_id?: string | null
          notes?: string | null
          polly_voice_id?: string | null
          provider_settings?: Json | null
          provider_voice_id?: string | null
          rating?: number | null
          sample_audio_url?: string | null
          supports_italian_native?: boolean | null
          supports_streaming?: boolean | null
          updated_at?: string
          voice_name?: string | null
          voice_provider?: string
        }
        Relationships: []
      }
      voice_settings_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          new_value: string | null
          old_value: string | null
          setting_key: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          setting_key: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          setting_key?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      pranks_decrypted: {
        Row: {
          call_status: string | null
          conversation_history: Json | null
          created_at: string | null
          creativity_level: number | null
          elevenlabs_similarity: number | null
          elevenlabs_speed: number | null
          elevenlabs_stability: number | null
          elevenlabs_style: number | null
          elevenlabs_voice_id: string | null
          id: string | null
          language: string | null
          max_duration: number | null
          personality_tone: string | null
          prank_theme: string | null
          pregenerated_background_url: string | null
          pregenerated_greeting_url: string | null
          recording_url: string | null
          scheduled_at: string | null
          send_recording: boolean | null
          twilio_call_sid: string | null
          updated_at: string | null
          user_id: string | null
          victim_first_name: string | null
          victim_last_name: string | null
          victim_phone: string | null
          voice_gender: string | null
          voice_provider: string | null
        }
        Insert: {
          call_status?: string | null
          conversation_history?: Json | null
          created_at?: string | null
          creativity_level?: number | null
          elevenlabs_similarity?: number | null
          elevenlabs_speed?: number | null
          elevenlabs_stability?: number | null
          elevenlabs_style?: number | null
          elevenlabs_voice_id?: string | null
          id?: string | null
          language?: string | null
          max_duration?: number | null
          personality_tone?: string | null
          prank_theme?: string | null
          pregenerated_background_url?: string | null
          pregenerated_greeting_url?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          send_recording?: boolean | null
          twilio_call_sid?: string | null
          updated_at?: string | null
          user_id?: string | null
          victim_first_name?: never
          victim_last_name?: never
          victim_phone?: never
          voice_gender?: string | null
          voice_provider?: string | null
        }
        Update: {
          call_status?: string | null
          conversation_history?: Json | null
          created_at?: string | null
          creativity_level?: number | null
          elevenlabs_similarity?: number | null
          elevenlabs_speed?: number | null
          elevenlabs_stability?: number | null
          elevenlabs_style?: number | null
          elevenlabs_voice_id?: string | null
          id?: string | null
          language?: string | null
          max_duration?: number | null
          personality_tone?: string | null
          prank_theme?: string | null
          pregenerated_background_url?: string | null
          pregenerated_greeting_url?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          send_recording?: boolean | null
          twilio_call_sid?: string | null
          updated_at?: string | null
          user_id?: string | null
          victim_first_name?: never
          victim_last_name?: never
          victim_phone?: never
          voice_gender?: string | null
          voice_provider?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      decrypt_victim_data: { Args: { encrypted_text: string }; Returns: string }
      encrypt_victim_data: { Args: { plain_text: string }; Returns: string }
      get_user_pranks_decrypted: {
        Args: never
        Returns: {
          call_status: string
          conversation_history: Json
          created_at: string
          creativity_level: number
          elevenlabs_similarity: number
          elevenlabs_speed: number
          elevenlabs_stability: number
          elevenlabs_style: number
          elevenlabs_voice_id: string
          id: string
          language: string
          max_duration: number
          personality_tone: string
          prank_theme: string
          pregenerated_background_url: string
          pregenerated_greeting_url: string
          recording_url: string
          scheduled_at: string
          send_recording: boolean
          twilio_call_sid: string
          updated_at: string
          user_id: string
          victim_first_name: string
          victim_last_name: string
          victim_phone: string
          voice_gender: string
          voice_provider: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
