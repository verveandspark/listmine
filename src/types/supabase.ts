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
      account_team_members: {
        Row: {
          account_id: string
          id: string
          invited_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          account_id: string
          id?: string
          invited_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          account_id?: string
          id?: string
          invited_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_team_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
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
      list_guests: {
        Row: {
          id: string
          invited_at: string | null
          list_id: string
          permission: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_at?: string | null
          list_id: string
          permission?: string
          user_id: string
        }
        Update: {
          id?: string
          invited_at?: string | null
          list_id?: string
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_guests_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_guests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          favorited: boolean | null
          id: string
          is_archived: boolean | null
          is_favorite: boolean | null
          is_pinned: boolean | null
          is_public: boolean | null
          is_shared: boolean | null
          list_type: string
          public_link: string | null
          share_link: string | null
          share_mode: string | null
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
          favorited?: boolean | null
          id?: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          is_pinned?: boolean | null
          is_public?: boolean | null
          is_shared?: boolean | null
          list_type: string
          public_link?: string | null
          share_link?: string | null
          share_mode?: string | null
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
          favorited?: boolean | null
          id?: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          is_pinned?: boolean | null
          is_public?: boolean | null
          is_shared?: boolean | null
          list_type?: string
          public_link?: string | null
          share_link?: string | null
          share_mode?: string | null
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
          avatar_url: string | null
          created_at: string | null
          default_landing_view: string | null
          disabled_at: string | null
          disabled_reason: string | null
          email: string
          id: string
          is_admin: boolean | null
          is_disabled: boolean | null
          last_list_id: string | null
          name: string | null
          role: string | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          default_landing_view?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          email: string
          id?: string
          is_admin?: boolean | null
          is_disabled?: boolean | null
          last_list_id?: string | null
          name?: string | null
          role?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          default_landing_view?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          email?: string
          id?: string
          is_admin?: boolean | null
          is_disabled?: boolean | null
          last_list_id?: string | null
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
          avatar_url: string | null
          created_at: string | null
          default_landing_view: string | null
          disabled_at: string | null
          disabled_reason: string | null
          email: string
          id: string
          is_admin: boolean | null
          is_disabled: boolean | null
          last_list_id: string | null
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
      can_access_list:
        | {
            Args: { list_id_param: string; user_id_param: string }
            Returns: boolean
          }
        | {
            Args: {
              p_check_write?: boolean
              p_list_id: string
              p_user_id?: string
            }
            Returns: boolean
          }
      check_list_limit: { Args: { tier: string }; Returns: number }
      clear_user_data: { Args: { target_user_id: string }; Returns: Json }
      create_list_for_user: {
        Args: {
          p_category: string
          p_list_type?: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      debug_all: {
        Args: never
        Returns: {
          auth_uid: string
          current_user_name: unknown
          jwt_claims: Json
        }[]
      }
      debug_auth_state: {
        Args: never
        Returns: {
          auth_email: string
          auth_role: string
          auth_uid: string
          is_authenticated: boolean
        }[]
      }
      delete_user_account: { Args: { target_user_id: string }; Returns: Json }
      disable_user_account: {
        Args: { reason?: string; target_user_id: string }
        Returns: Json
      }
      enable_user_account: { Args: { target_user_id: string }; Returns: Json }
      ensure_user_exists: { Args: never; Returns: string }
      get_admin_audit_logs: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          action_type: string
          admin_id: string
          created_at: string
          details: Json
          id: string
          target_user_email: string
          target_user_id: string
        }[]
      }
      get_allowed_list_types: { Args: { user_tier: string }; Returns: string[] }
      get_guest_count_for_list: { Args: { p_list_id: string }; Returns: number }
      get_shared_list_by_share_link: {
        Args: { p_share_link: string }
        Returns: {
          category: string
          created_at: string
          id: string
          is_archived: boolean
          is_favorite: boolean
          is_pinned: boolean
          is_shared: boolean
          list_type: string
          share_link: string
          share_mode: string
          show_purchaser_info: boolean
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }[]
      }
      get_shared_list_items: {
        Args: { p_list_id: string }
        Returns: {
          assigned_to: string
          attributes: Json
          completed: boolean
          created_at: string
          due_date: string
          id: string
          item_order: number
          links: string[]
          list_id: string
          notes: string
          priority: string
          quantity: number
          text: string
          updated_at: string
        }[]
      }
      get_shared_list_purchases: {
        Args: { p_list_id: string }
        Returns: {
          created_at: string
          id: string
          item_id: string
          list_id: string
          purchase_date: string
          purchase_note: string
          purchaser_name: string
        }[]
      }
      get_team_member_count_for_account: {
        Args: { p_account_id: string }
        Returns: number
      }
      is_team_member: {
        Args: { account_id_param: string; user_id_param: string }
        Returns: boolean
      }
      log_admin_action: {
        Args: {
          p_action_type: string
          p_details?: Json
          p_target_user_email?: string
          p_target_user_id?: string
        }
        Returns: string
      }
      update_user_avatar: {
        Args: { new_avatar_url: string; user_id: string }
        Returns: undefined
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
