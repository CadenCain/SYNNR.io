// Generated from the SYNNR.io Supabase project (zbtxnvzxnpwdrpaxmliz).
// Regenerate after schema changes:
//   supabase gen types typescript --project-id zbtxnvzxnpwdrpaxmliz > lib/supabase/types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: { id: string; name: string; industry: string | null; created_at: string };
        Insert: { id?: string; name: string; industry?: string | null; created_at?: string };
        Update: { id?: string; name?: string; industry?: string | null; created_at?: string };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; workspace_id: string | null; name: string | null; email: string | null; role: string; created_at: string };
        Insert: { id: string; workspace_id?: string | null; name?: string | null; email?: string | null; role?: string; created_at?: string };
        Update: { id?: string; workspace_id?: string | null; name?: string | null; email?: string | null; role?: string; created_at?: string };
        Relationships: [];
      };
      clients: {
        Row: { id: string; workspace_id: string; name: string; msa_number: string | null; created_at: string };
        Insert: { id?: string; workspace_id: string; name: string; msa_number?: string | null; created_at?: string };
        Update: { id?: string; workspace_id?: string; name?: string; msa_number?: string | null; created_at?: string };
        Relationships: [];
      };
      crews: {
        Row: { id: string; workspace_id: string; name: string; lead: string | null; created_at: string };
        Insert: { id?: string; workspace_id: string; name: string; lead?: string | null; created_at?: string };
        Update: { id?: string; workspace_id?: string; name?: string; lead?: string | null; created_at?: string };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string; workspace_id: string; number: string; title: string;
          client_id: string | null; crew_id: string | null;
          status: Database["public"]["Enums"]["job_status"];
          priority: Database["public"]["Enums"]["priority_level"];
          closed_at: string | null; recoverable_cents: number; created_at: string;
        };
        Insert: {
          id?: string; workspace_id: string; number: string; title: string;
          client_id?: string | null; crew_id?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          priority?: Database["public"]["Enums"]["priority_level"];
          closed_at?: string | null; recoverable_cents?: number; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [];
      };
      findings: {
        Row: {
          id: string; workspace_id: string; job_id: string;
          type: Database["public"]["Enums"]["finding_type"];
          title: string; subtitle: string | null; amount_cents: number;
          state: Database["public"]["Enums"]["finding_state"];
          blocker: string | null; evidence: Json; created_at: string;
        };
        Insert: {
          id?: string; workspace_id: string; job_id: string;
          type: Database["public"]["Enums"]["finding_type"];
          title: string; subtitle?: string | null; amount_cents?: number;
          state?: Database["public"]["Enums"]["finding_state"];
          blocker?: string | null; evidence?: Json; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["findings"]["Insert"]>;
        Relationships: [];
      };
      pricebook_rules: {
        Row: { id: string; workspace_id: string; label: string; billed_cents: number | null; contract_cents: number | null; unit: string | null; note: string | null; created_at: string };
        Insert: { id?: string; workspace_id: string; label: string; billed_cents?: number | null; contract_cents?: number | null; unit?: string | null; note?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["pricebook_rules"]["Insert"]>;
        Relationships: [];
      };
      audit_runs: {
        Row: { id: string; workspace_id: string; label: string; jobs_count: number; recovered_cents: number; status: string; created_at: string };
        Insert: { id?: string; workspace_id: string; label: string; jobs_count?: number; recovered_cents?: number; status?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["audit_runs"]["Insert"]>;
        Relationships: [];
      };
      integrations: {
        Row: { id: string; workspace_id: string; name: string; status: string; created_at: string };
        Insert: { id?: string; workspace_id: string; name: string; status?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["integrations"]["Insert"]>;
        Relationships: [];
      };
      leads: {
        Row: { id: string; email: string; company: string | null; name: string | null; industry: string | null; source: string; created_at: string };
        Insert: { id?: string; email: string; company?: string | null; name?: string | null; industry?: string | null; source?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_workspace_id: { Args: Record<never, never>; Returns: string };
      create_workspace: { Args: { p_name: string; p_industry?: string | null }; Returns: string };
    };
    Enums: {
      finding_state: "open" | "approved" | "recovered" | "dismissed" | "resolved";
      finding_type: "missed" | "rate" | "doc";
      job_status: "open" | "in_review" | "delivered" | "resolved" | "clean";
      priority_level: "low" | "medium" | "high";
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicTables = Database["public"]["Tables"];
export type Row<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type Insert<T extends keyof PublicTables> = PublicTables[T]["Insert"];

export type Workspace = Row<"workspaces">;
export type Job = Row<"jobs">;
export type Finding = Row<"findings">;
export type Client = Row<"clients">;
export type Crew = Row<"crews">;
export type AuditRun = Row<"audit_runs">;
export type Integration = Row<"integrations">;
export type PricebookRule = Row<"pricebook_rules">;
export type Lead = Row<"leads">;
