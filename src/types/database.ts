export type ItemStatus = "lost" | "found" | "claimed" | "returned";
export type ModerationStatus = "active" | "flagged" | "removed";
export type ClaimStatus = "pending" | "approved" | "rejected";
export type HandoverStatus = "active" | "completed" | "cancelled" | "expired";
export type CustodyStatus = "received" | "in_vault" | "released" | "transferred";
export type UserRole = "student" | "admin" | "super_admin";
export type NotificationType =
  | "NEW_CLAIM"
  | "CLAIM_APPROVED"
  | "CLAIM_REJECTED"
  | "HANDOVER_STARTED"
  | "HANDOVER_COMPLETED";

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  item_id: string | null;
  claim_id: string | null;
  handover_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface LostItem {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  campus_location: string;
  image_url: string | null;
  additional_images?: string[] | null;
  image_embedding?: string | number[] | null;
  text_embedding?: string | number[] | null;
  status: ItemStatus;
  item_type?: "lost" | "found";
  moderation_status?: ModerationStatus | null;
  moderated_by?: string | null;
  moderated_at?: string | null;
  moderation_reason?: string | null;
  incident_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  full_name: string;
  email: string;
  admission_number: string;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface ClaimRow {
  id: string;
  lost_item_id: string;
  claimant_item_id?: string | null;
  claimant_id: string;
  message: string;
  proof_image_url: string | null;
  status: ClaimStatus;
  created_at: string;
  updated_at: string;
}

export interface ReporterClaimDetail extends ClaimRow {
  claimant_full_name: string | null;
  claimant_admission_number: string | null;
}

export interface HandoverRow {
  id: string;
  lost_item_id: string;
  claim_id: string;
  reporter_id: string;
  claimant_id: string;
  status: HandoverStatus;
  handover_location: string;
  preferred_time: string | null;
  handover_mode: string;
  otp_hash: string;
  otp_expires_at: string;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HandoverDetail {
  id: string;
  lost_item_id: string;
  claim_id: string;
  reporter_id: string;
  claimant_id: string;
  status: HandoverStatus;
  handover_location: string;
  preferred_time: string | null;
  handover_mode: string;
  otp_expires_at: string;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  admin_full_name?: string | null;
}

export interface ItemCustody {
  id: string;
  lost_item_id: string;
  admin_user_id: string;
  status: CustodyStatus;
  received_at: string;
  released_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface CampusLocationRow {
  id: string;
  name: string;
  building_block: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminDashboardStats {
  total_reports: number;
  lost_count: number;
  found_count: number;
  claimed_count: number;
  returned_count: number;
  pending_claims_count: number;
  active_handovers_count: number;
  flagged_items_count: number;
  custody_items_count: number;
  total_users_count: number;
}

export interface AdminClaimDetail extends ClaimRow {
  item_title?: string;
  claimant_name?: string;
  claimant_admission_number?: string;
  reporter_name?: string;
}

export interface AdminHandoverDetail extends HandoverDetail {
  item_title?: string;
  reporter_name?: string;
  claimant_name?: string;
  claimant_admission_number?: string;
}

export interface AdminUserDetail {
  id: string;
  full_name: string;
  email: string;
  admission_number: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
  reports_count: number;
  claims_count: number;
}

export type Database = {
  public: {
    Tables: {
      lost_items: {
        Row: LostItem;
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          category: string;
          campus_location: string;
          image_url?: string | null;
          additional_images?: string[] | null;
          status: ItemStatus;
          item_type?: "lost" | "found";
          moderation_status?: ModerationStatus | null;
          moderated_by?: string | null;
          moderated_at?: string | null;
          moderation_reason?: string | null;
          incident_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<LostItem>;
        Relationships: [];
      };
      users: {
        Row: UserRow;
        Insert: {
          id: string;
          full_name: string;
          email: string;
          admission_number: string;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<UserRow>;
        Relationships: [];
      };
      claims: {
        Row: ClaimRow;
        Insert: {
          id?: string;
          lost_item_id: string;
          claimant_item_id?: string | null;
          claimant_id: string;
          message: string;
          proof_image_url?: string | null;
          status?: ClaimStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ClaimRow>;
        Relationships: [];
      };
      handovers: {
        Row: HandoverRow;
        Insert: {
          id?: string;
          lost_item_id: string;
          claim_id: string;
          reporter_id: string;
          claimant_id: string;
          status?: HandoverStatus;
          handover_location: string;
          preferred_time?: string | null;
          handover_mode?: string;
          otp_hash?: string;
          otp_expires_at?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<HandoverRow>;
        Relationships: [];
      };
      admin_audit_logs: {
        Row: AdminAuditLog;
        Insert: {
          id?: string;
          admin_id: string;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          reason?: string | null;
          metadata?: Record<string, any> | null;
          created_at?: string;
        };
        Update: Partial<AdminAuditLog>;
        Relationships: [];
      };
      item_custody: {
        Row: ItemCustody;
        Insert: {
          id?: string;
          lost_item_id: string;
          admin_user_id: string;
          status?: CustodyStatus;
          received_at?: string;
          released_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<ItemCustody>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
          item_id?: string | null;
          claim_id?: string | null;
          handover_id?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      campus_locations: {
        Row: CampusLocationRow;
        Insert: {
          id?: string;
          name: string;
          building_block?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<CampusLocationRow>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_hybrid_items: {
        Args: {
          p_item_id: string;
          p_text_weight?: number;
          p_image_weight?: number;
          p_location_weight?: number;
          p_time_weight?: number;
          p_match_threshold?: number;
          p_match_count?: number;
        };
        Returns: {
          id: string;
          title: string;
          description: string | null;
          category: string;
          campus_location: string;
          image_url: string | null;
          item_type: "lost" | "found";
          status: ItemStatus;
          incident_at: string | null;
          text_similarity: number | null;
          image_similarity: number | null;
          location_similarity: number | null;
          time_similarity: number | null;
          match_score: number;
        }[];
      };
      approve_claim: {
        Args: { p_claim_id: string };
        Returns: void;
      };
      reject_claim: {
        Args: { p_claim_id: string };
        Returns: void;
      };
      get_reporter_claims: {
        Args: { p_item_id: string };
        Returns: ReporterClaimDetail[];
      };
      start_handover: {
        Args: {
          p_claim_id: string;
          p_handover_location: string;
          p_preferred_time?: string;
        };
        Returns: string;
      };
      get_claimant_otp: {
        Args: { p_handover_id: string };
        Returns: string;
      };
      verify_handover: {
        Args: { p_handover_id: string; p_otp: string };
        Returns: void;
      };
      cancel_handover: {
        Args: { p_handover_id: string; p_reason?: string };
        Returns: void;
      };
      get_handover_details: {
        Args: { p_item_id: string };
        Returns: HandoverDetail[];
      };
      check_is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      admin_get_dashboard_stats: {
        Args: Record<string, never>;
        Returns: AdminDashboardStats[];
      };
      admin_get_reports: {
        Args: {
          p_status?: string;
          p_category?: string;
          p_location?: string;
          p_search?: string;
          p_moderation?: string;
          p_page?: number;
          p_limit?: number;
        };
        Returns: LostItem[];
      };
      admin_moderate_item: {
        Args: {
          p_item_id: string;
          p_action: string;
          p_reason?: string;
        };
        Returns: void;
      };
      admin_get_claims: {
        Args: { p_status?: string; p_item_id?: string };
        Returns: AdminClaimDetail[];
      };
      admin_resolve_claim: {
        Args: { p_claim_id: string; p_action: string; p_reason?: string };
        Returns: void;
      };
      admin_get_handovers: {
        Args: { p_status?: string };
        Returns: AdminHandoverDetail[];
      };
      admin_get_users: {
        Args: { p_role?: string; p_search?: string };
        Returns: AdminUserDetail[];
      };
      admin_update_user_role: {
        Args: { p_target_user_id: string; p_new_role: string; p_reason?: string };
        Returns: void;
      };
      admin_manage_custody: {
        Args: { p_item_id: string; p_action: string; p_notes?: string };
        Returns: void;
      };
      admin_get_locations: {
        Args: Record<string, never>;
        Returns: CampusLocationRow[];
      };
      admin_create_location: {
        Args: { p_name: string; p_building_block?: string };
        Returns: string;
      };
      admin_update_location: {
        Args: { p_location_id: string; p_name: string; p_building_block?: string };
        Returns: void;
      };
      admin_deactivate_location: {
        Args: { p_location_id: string };
        Returns: void;
      };
      get_active_locations: {
        Args: Record<string, never>;
        Returns: CampusLocationRow[];
      };
      admin_get_audit_logs: {
        Args: { p_limit?: number };
        Returns: AdminAuditLog[];
      };
    };
    Enums: {
      item_status: ItemStatus;
      moderation_status: ModerationStatus;
      claim_status: ClaimStatus;
      handover_status: HandoverStatus;
      custody_status: CustodyStatus;
      user_role: UserRole;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
