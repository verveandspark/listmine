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
      admin_actions: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_user_id: string
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id: string
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          target_user_email: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_email?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_user_email?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborators: {
        Row: {
          added_at: string | null
          id: string
          list_id: string
          permission: string | null
          user_id: string
        }
        Insert: {
          added_at?: string | null
          id?: string
          list_id: string
          permission?: string | null
          user_id: string
        }
        Update: {
          added_at?: string | null
          id?: string
          list_id?: string
          permission?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborators_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      item_attributes: {
        Row: {
          attribute_name: string
          attribute_value: string
          created_at: string | null
          id: string
          item_id: string
        }
        Insert: {
          attribute_name: string
          attribute_value: string
          created_at?: string | null
          id?: string
          item_id: string
        }
        Update: {
          attribute_name?: string
          attribute_value?: string
          created_at?: string | null
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_attributes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_links: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_links_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          due_date: string | null
          id: string
          is_completed: boolean | null
          links: string[] | null
          list_id: string
          notes: string | null
          position: number | null
          priority: string | null
          quantity: number | null
          text: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          links?: string[] | null
          list_id: string
          notes?: string | null
          position?: number | null
          priority?: string | null
          quantity?: number | null
          text: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          links?: string[] | null
          list_id?: string
          notes?: string | null
          position?: number | null
          priority?: string | null
          quantity?: number | null
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          assigned_to: string | null
          attributes: Json | null
          completed: boolean | null
          created_at: string | null
          due_date: string | null
          id: string
          item_order: number
          links: string[] | null
          list_id: string
          notes: string | null
          priority: string | null
          quantity: number | null
          text: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          attributes?: Json | null
          completed?: boolean | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          item_order?: number
          links?: string[] | null
          list_id: string
          notes?: string | null
          priority?: string | null
          quantity?: number | null
          text: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          attributes?: Json | null
          completed?: boolean | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          item_order?: number
          links?: string[] | null
          list_id?: string
          notes?: string | null
          priority?: string | null
          quantity?: number | null
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_type_tiers: {
        Row: {
          created_at: string | null
          id: number
          list_type: string
          tier: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          list_type: string
          tier: string
        }
        Update: {
          created_at?: string | null
          id?: number
          list_type?: string
          tier?: string
        }
        Relationships: []
      }
      lists: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_archived: boolean | null
          is_pinned: boolean | null
          is_public: boolean | null
          is_shared: boolean | null
          list_type: string
          public_link: string | null
          share_link: string | null
          show_purchaser_info: boolean | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          is_public?: boolean | null
          is_shared?: boolean | null
          list_type: string
          public_link?: string | null
          share_link?: string | null
          show_purchaser_info?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          is_public?: boolean | null
          is_shared?: boolean | null
          list_type?: string
          public_link?: string | null
          share_link?: string | null
          show_purchaser_info?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          list_id: string
          purchase_date: string | null
          purchase_note: string | null
          purchaser_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          list_id: string
          purchase_date?: string | null
          purchase_note?: string | null
          purchaser_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          list_id?: string
          purchase_date?: string | null
          purchase_note?: string | null
          purchaser_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_purchases: {
        Row: {
          created_at: string | null
          gift_giver_email: string | null
          gift_giver_id: string | null
          gift_giver_name: string
          id: string
          list_item_id: string
          notes: string | null
          purchase_status: string
          purchased_at: string | null
          quantity_purchased: number | null
          received_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          gift_giver_email?: string | null
          gift_giver_id?: string | null
          gift_giver_name: string
          id?: string
          list_item_id: string
          notes?: string | null
          purchase_status?: string
          purchased_at?: string | null
          quantity_purchased?: number | null
          received_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          gift_giver_email?: string | null
          gift_giver_id?: string | null
          gift_giver_name?: string
          id?: string
          list_item_id?: string
          notes?: string | null
          purchase_status?: string
          purchased_at?: string | null
          quantity_purchased?: number | null
          received_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registry_purchases_list_item_id_fkey"
            columns: ["list_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_read_only: boolean | null
          list_id: string
          share_token: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_read_only?: boolean | null
          list_id: string
          share_token: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_read_only?: boolean | null
          list_id?: string
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string | null
          id: string
          list_id: string
          tag_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          list_id: string
          tag_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          list_id?: string
          tag_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      template_items: {
        Row: {
          created_at: string | null
          id: string
          position: number | null
          priority: string | null
          quantity: number | null
          template_id: string
          text: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          position?: number | null
          priority?: string | null
          quantity?: number | null
          template_id: string
          text: string
        }
        Update: {
          created_at?: string | null
          id?: string
          position?: number | null
          priority?: string | null
          quantity?: number | null
          template_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_premium: boolean | null
          list_type: string
          title: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_premium?: boolean | null
          list_type: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_premium?: boolean | null
          list_type?: string
          title?: string
        }
        Relationships: []
      }
      tier_change_logs: {
        Row: {
          admin_email: string
          changed_at: string | null
          id: string
          new_tier: string
          old_tier: string
          user_id: string
        }
        Insert: {
          admin_email: string
          changed_at?: string | null
          id?: string
          new_tier: string
          old_tier: string
          user_id: string
        }
        Update: {
          admin_email?: string
          changed_at?: string | null
          id?: string
          new_tier?: string
          old_tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tier_change_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          disabled_at: string | null
          disabled_reason: string | null
          email: string
          id: string
          is_admin: boolean | null
          is_disabled: boolean | null
          name: string | null
          role: string | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          email: string
          id?: string
          is_admin?: boolean | null
          is_disabled?: boolean | null
          name?: string | null
          role?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          email?: string
          id?: string
          is_admin?: boolean | null
          is_disabled?: boolean | null
          name?: string | null
          role?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wishlist_purchases: {
        Row: {
          created_at: string | null
          id: string
          list_item_id: string
          notes: string | null
          purchase_status: string
          purchased_at: string | null
          purchased_by: string | null
          received_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          list_item_id: string
          notes?: string | null
          purchase_status?: string
          purchased_at?: string | null
          purchased_by?: string | null
          received_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          list_item_id?: string
          notes?: string | null
          purchase_status?: string
          purchased_at?: string | null
          purchased_by?: string | null
          received_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_purchases_list_item_id_fkey"
            columns: ["list_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_all_users: {
        Args: never
        Returns: {
          created_at: string | null
          disabled_at: string | null
          disabled_reason: string | null
          email: string
          id: string
          is_admin: boolean | null
          is_disabled: boolean | null
          name: string | null
          role: string | null
          tier: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_resend_welcome_email: {
        Args: { p_user_email: string }
        Returns: Json
      }
      admin_send_password_reset: {
        Args: { p_user_email: string }
        Returns: Json
      }
      clear_user_data: { Args: { target_user_id: string }; Returns: Json }
      delete_user_account: { Args: { target_user_id: string }; Returns: Json }
      disable_user_account: {
        Args: { reason?: string; target_user_id: string }
        Returns: Json
      }
      enable_user_account: { Args: { target_user_id: string }; Returns: Json }
      get_admin_audit_logs: {
        Args: {
          p_action_type?: string
          p_admin_id?: string
          p_limit?: number
          p_offset?: number
          p_target_user_id?: string
        }
        Returns: {
          action_type: string
          admin_email: string
          admin_id: string
          admin_name: string
          created_at: string
          details: Json
          id: string
          target_user_email: string
          target_user_id: string
        }[]
      }
      get_allowed_list_types: { Args: { user_tier: string }; Returns: string[] }
      log_admin_action: {
        Args: {
          p_action_type: string
          p_details?: Json
          p_target_user_email?: string
          p_target_user_id?: string
        }
        Returns: string
      }
      update_user_name: {
        Args: { new_name: string; user_id: string }
        Returns: undefined
      }
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
