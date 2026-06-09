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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      internal_assessments: {
        Row: {
          created_at: string
          due_date: string
          ia_type: string
          id: string
          notes: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date: string
          ia_type: string
          id?: string
          notes?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string
          ia_type?: string
          id?: string
          notes?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          curriculum: string | null
          email: string | null
          full_name: string | null
          grade: number | null
          id: string
          onboarding_completed: boolean
          sleep_goal_time: string | null
          theme_mode: string
          updated_at: string
          wake_time: string | null
        }
        Insert: {
          created_at?: string
          curriculum?: string | null
          email?: string | null
          full_name?: string | null
          grade?: number | null
          id: string
          onboarding_completed?: boolean
          sleep_goal_time?: string | null
          theme_mode?: string
          updated_at?: string
          wake_time?: string | null
        }
        Update: {
          created_at?: string
          curriculum?: string | null
          email?: string | null
          full_name?: string | null
          grade?: number | null
          id?: string
          onboarding_completed?: boolean
          sleep_goal_time?: string | null
          theme_mode?: string
          updated_at?: string
          wake_time?: string | null
        }
        Relationships: []
      }
      schedules: {
        Row: {
          blocks: Json
          created_at: string
          id: string
          is_active: boolean
          preferences: Json
          schedule_date: string
          tasks: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          preferences?: Json
          schedule_date?: string
          tasks?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          preferences?: Json
          schedule_date?: string
          tasks?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sleep_sessions: {
        Row: {
          created_at: string
          end_time: string | null
          felt_enough: boolean | null
          id: string
          mood_score: number | null
          narrative: string | null
          quality_score: number | null
          start_time: string
          status: string
          target_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          felt_enough?: boolean | null
          id?: string
          mood_score?: number | null
          narrative?: string | null
          quality_score?: number | null
          start_time?: string
          status?: string
          target_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          felt_enough?: boolean | null
          id?: string
          mood_score?: number | null
          narrative?: string | null
          quality_score?: number | null
          start_time?: string
          status?: string
          target_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          plan: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          plan?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          plan?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      summative_exams: {
        Row: {
          created_at: string
          exam_board: string
          exam_date: string
          id: string
          paper_type: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_board: string
          exam_date: string
          id?: string
          paper_type: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_board?: string
          exam_date?: string
          id?: string
          paper_type?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
