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
      action_plans: {
        Row: {
          action_text: string
          categoria: string
          created_at: string
          id: string
          pi: number | null
          po: string | null
        }
        Insert: {
          action_text: string
          categoria?: string
          created_at?: string
          id?: string
          pi?: number | null
          po?: string | null
        }
        Update: {
          action_text?: string
          categoria?: string
          created_at?: string
          id?: string
          pi?: number | null
          po?: string | null
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          categoria: string
          chegada_hci: string | null
          cliente: string | null
          codigo: string | null
          codigo_compra: string | null
          created_at: string
          data_compra: string | null
          data_recebimento_compra: string | null
          descricao: string | null
          dias_atraso: number | null
          dias_faltam: number | null
          embarque: string | null
          emissao_pedido_sistema: string | null
          entrega_fornecedor: string | null
          eta: string | null
          etd: string | null
          follow_up: string | null
          fornecedor: string | null
          id: string
          item: string | null
          pi: number | null
          po: string | null
          prazo_cliente: string | null
          prazo_inicial_fornecedor: string | null
          preco_compra: number | null
          preco_venda: number | null
          qty_compra: number | null
          qty_venda: number | null
          status_compra_venda: string | null
          status_fornecedor: string | null
          status_producao: string | null
          venda_em_dias: number | null
        }
        Insert: {
          categoria?: string
          chegada_hci?: string | null
          cliente?: string | null
          codigo?: string | null
          codigo_compra?: string | null
          created_at?: string
          data_compra?: string | null
          data_recebimento_compra?: string | null
          descricao?: string | null
          dias_atraso?: number | null
          dias_faltam?: number | null
          embarque?: string | null
          emissao_pedido_sistema?: string | null
          entrega_fornecedor?: string | null
          eta?: string | null
          etd?: string | null
          follow_up?: string | null
          fornecedor?: string | null
          id?: string
          item?: string | null
          pi?: number | null
          po?: string | null
          prazo_cliente?: string | null
          prazo_inicial_fornecedor?: string | null
          preco_compra?: number | null
          preco_venda?: number | null
          qty_compra?: number | null
          qty_venda?: number | null
          status_compra_venda?: string | null
          status_fornecedor?: string | null
          status_producao?: string | null
          venda_em_dias?: number | null
        }
        Update: {
          categoria?: string
          chegada_hci?: string | null
          cliente?: string | null
          codigo?: string | null
          codigo_compra?: string | null
          created_at?: string
          data_compra?: string | null
          data_recebimento_compra?: string | null
          descricao?: string | null
          dias_atraso?: number | null
          dias_faltam?: number | null
          embarque?: string | null
          emissao_pedido_sistema?: string | null
          entrega_fornecedor?: string | null
          eta?: string | null
          etd?: string | null
          follow_up?: string | null
          fornecedor?: string | null
          id?: string
          item?: string | null
          pi?: number | null
          po?: string | null
          prazo_cliente?: string | null
          prazo_inicial_fornecedor?: string | null
          preco_compra?: number | null
          preco_venda?: number | null
          qty_compra?: number | null
          qty_venda?: number | null
          status_compra_venda?: string | null
          status_fornecedor?: string | null
          status_producao?: string | null
          venda_em_dias?: number | null
        }
        Relationships: []
      }
      po_documents: {
        Row: {
          categoria: string
          created_at: string
          doc_type: string
          file_name: string
          file_url: string
          id: string
          po: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          doc_type: string
          file_name: string
          file_url: string
          id?: string
          po: string
        }
        Update: {
          categoria?: string
          created_at?: string
          doc_type?: string
          file_name?: string
          file_url?: string
          id?: string
          po?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_member: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "member"
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
  public: {
    Enums: {
      app_role: ["admin", "member"],
    },
  },
} as const
