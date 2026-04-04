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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Relationships: []
      }
      analysis_history: {
        Row: {
          asset: string
          created_at: string
          data_source: string | null
          entry_price: number | null
          executive_summary: string | null
          final_confidence_pct: number | null
          full_result: Json | null
          id: string
          risk_reward_ratio: string | null
          signal: string
          signal_strength_pct: number | null
          stop_loss: number | null
          take_profit_1: number | null
          take_profit_2: number | null
          take_profit_3: number | null
          timeframe: string
          trend: string | null
          user_id: string
        }
        Insert: {
          asset: string
          created_at?: string
          data_source?: string | null
          entry_price?: number | null
          executive_summary?: string | null
          final_confidence_pct?: number | null
          full_result?: Json | null
          id?: string
          risk_reward_ratio?: string | null
          signal: string
          signal_strength_pct?: number | null
          stop_loss?: number | null
          take_profit_1?: number | null
          take_profit_2?: number | null
          take_profit_3?: number | null
          timeframe: string
          trend?: string | null
          user_id: string
        }
        Update: {
          asset?: string
          created_at?: string
          data_source?: string | null
          entry_price?: number | null
          executive_summary?: string | null
          final_confidence_pct?: number | null
          full_result?: Json | null
          id?: string
          risk_reward_ratio?: string | null
          signal?: string
          signal_strength_pct?: number | null
          stop_loss?: number | null
          take_profit_1?: number | null
          take_profit_2?: number | null
          take_profit_3?: number | null
          timeframe?: string
          trend?: string | null
          user_id?: string
        }
        Relationships: []
      }
      auto_analysis_configs: {
        Row: {
          admin_id: string
          analysis_period_minutes: number
          asset: string
          created_at: string
          id: string
          is_active: boolean
          last_run_at: string | null
          leverage: number
          timeframe: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          analysis_period_minutes?: number
          asset: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          leverage?: number
          timeframe: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          analysis_period_minutes?: number
          asset?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          leverage?: number
          timeframe?: string
          updated_at?: string
        }
        Relationships: []
      }
      auto_analysis_history: {
        Row: {
          asset: string
          close_reason: string | null
          closed_at: string | null
          config_id: string
          created_at: string
          current_price: number | null
          current_price_time: string | null
          deleted_at: string | null
          distance_sl_pct: number | null
          distance_tp1_pct: number | null
          distance_tp2_pct: number | null
          distance_tp3_pct: number | null
          entry_price: number | null
          executive_summary: string | null
          final_confidence_pct: number | null
          final_result_candle: Json | null
          full_result: Json | null
          id: string
          last_verified_at: string | null
          loss_hit_time: string | null
          risk_reward_ratio: string | null
          signal: string | null
          signal_strength_pct: number | null
          status: string
          stop_loss: number | null
          take_profit_1: number | null
          take_profit_2: number | null
          take_profit_3: number | null
          timeframe: string
          tp1_hit_time: string | null
          tp2_hit_time: string | null
          tp3_hit_time: string | null
          trend: string | null
          virtual_pnl_pct: number | null
        }
        Insert: {
          asset: string
          close_reason?: string | null
          closed_at?: string | null
          config_id: string
          created_at?: string
          current_price?: number | null
          current_price_time?: string | null
          deleted_at?: string | null
          distance_sl_pct?: number | null
          distance_tp1_pct?: number | null
          distance_tp2_pct?: number | null
          distance_tp3_pct?: number | null
          entry_price?: number | null
          executive_summary?: string | null
          final_confidence_pct?: number | null
          final_result_candle?: Json | null
          full_result?: Json | null
          id?: string
          last_verified_at?: string | null
          loss_hit_time?: string | null
          risk_reward_ratio?: string | null
          signal?: string | null
          signal_strength_pct?: number | null
          status?: string
          stop_loss?: number | null
          take_profit_1?: number | null
          take_profit_2?: number | null
          take_profit_3?: number | null
          timeframe: string
          tp1_hit_time?: string | null
          tp2_hit_time?: string | null
          tp3_hit_time?: string | null
          trend?: string | null
          virtual_pnl_pct?: number | null
        }
        Update: {
          asset?: string
          close_reason?: string | null
          closed_at?: string | null
          config_id?: string
          created_at?: string
          current_price?: number | null
          current_price_time?: string | null
          deleted_at?: string | null
          distance_sl_pct?: number | null
          distance_tp1_pct?: number | null
          distance_tp2_pct?: number | null
          distance_tp3_pct?: number | null
          entry_price?: number | null
          executive_summary?: string | null
          final_confidence_pct?: number | null
          final_result_candle?: Json | null
          full_result?: Json | null
          id?: string
          last_verified_at?: string | null
          loss_hit_time?: string | null
          risk_reward_ratio?: string | null
          signal?: string | null
          signal_strength_pct?: number | null
          status?: string
          stop_loss?: number | null
          take_profit_1?: number | null
          take_profit_2?: number | null
          take_profit_3?: number | null
          timeframe?: string
          tp1_hit_time?: string | null
          tp2_hit_time?: string | null
          tp3_hit_time?: string | null
          trend?: string | null
          virtual_pnl_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_analysis_history_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "auto_analysis_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_management_configs: {
        Row: {
          admin_id: string
          analysis_period_minutes: number
          asset: string
          created_at: string
          id: string
          is_active: boolean
          last_run_at: string | null
          leverage: number
          timeframe: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          analysis_period_minutes?: number
          asset: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          leverage?: number
          timeframe: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          analysis_period_minutes?: number
          asset?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          leverage?: number
          timeframe?: string
          updated_at?: string
        }
        Relationships: []
      }
      auto_management_history: {
        Row: {
          asset: string
          close_reason: string | null
          closed_at: string | null
          config_id: string
          created_at: string
          current_price: number | null
          current_price_time: string | null
          current_stop_loss: number | null
          deleted_at: string | null
          distance_sl_pct: number | null
          distance_tp1_pct: number | null
          distance_tp2_pct: number | null
          distance_tp3_pct: number | null
          entry_price: number | null
          executive_summary: string | null
          final_confidence_pct: number | null
          final_result_candle: Json | null
          full_result: Json | null
          id: string
          last_verified_at: string | null
          loss_hit_time: string | null
          peak_pnl_pct: number | null
          risk_reward_ratio: string | null
          signal: string | null
          signal_status: string | null
          signal_strength_pct: number | null
          status: string
          stop_loss: number | null
          take_profit_1: number | null
          take_profit_2: number | null
          take_profit_3: number | null
          timeframe: string
          tp1_hit_at: string | null
          tp1_hit_time: string | null
          tp2_hit_at: string | null
          tp2_hit_time: string | null
          tp3_hit_time: string | null
          trend: string | null
          virtual_pnl_pct: number | null
        }
        Insert: {
          asset: string
          close_reason?: string | null
          closed_at?: string | null
          config_id: string
          created_at?: string
          current_price?: number | null
          current_price_time?: string | null
          current_stop_loss?: number | null
          deleted_at?: string | null
          distance_sl_pct?: number | null
          distance_tp1_pct?: number | null
          distance_tp2_pct?: number | null
          distance_tp3_pct?: number | null
          entry_price?: number | null
          executive_summary?: string | null
          final_confidence_pct?: number | null
          final_result_candle?: Json | null
          full_result?: Json | null
          id?: string
          last_verified_at?: string | null
          loss_hit_time?: string | null
          peak_pnl_pct?: number | null
          risk_reward_ratio?: string | null
          signal?: string | null
          signal_status?: string | null
          signal_strength_pct?: number | null
          status?: string
          stop_loss?: number | null
          take_profit_1?: number | null
          take_profit_2?: number | null
          take_profit_3?: number | null
          timeframe: string
          tp1_hit_at?: string | null
          tp1_hit_time?: string | null
          tp2_hit_at?: string | null
          tp2_hit_time?: string | null
          tp3_hit_time?: string | null
          trend?: string | null
          virtual_pnl_pct?: number | null
        }
        Update: {
          asset?: string
          close_reason?: string | null
          closed_at?: string | null
          config_id?: string
          created_at?: string
          current_price?: number | null
          current_price_time?: string | null
          current_stop_loss?: number | null
          deleted_at?: string | null
          distance_sl_pct?: number | null
          distance_tp1_pct?: number | null
          distance_tp2_pct?: number | null
          distance_tp3_pct?: number | null
          entry_price?: number | null
          executive_summary?: string | null
          final_confidence_pct?: number | null
          final_result_candle?: Json | null
          full_result?: Json | null
          id?: string
          last_verified_at?: string | null
          loss_hit_time?: string | null
          peak_pnl_pct?: number | null
          risk_reward_ratio?: string | null
          signal?: string | null
          signal_status?: string | null
          signal_strength_pct?: number | null
          status?: string
          stop_loss?: number | null
          take_profit_1?: number | null
          take_profit_2?: number | null
          take_profit_3?: number | null
          timeframe?: string
          tp1_hit_at?: string | null
          tp1_hit_time?: string | null
          tp2_hit_at?: string | null
          tp2_hit_time?: string | null
          tp3_hit_time?: string | null
          trend?: string | null
          virtual_pnl_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_management_history_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "auto_management_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_settings: {
        Row: {
          created_at: string
          deactivation_reason: string | null
          id: string
          is_active: boolean
          max_leverage: number
          max_loss: number
          profit_goal: number
          risk_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deactivation_reason?: string | null
          id?: string
          is_active?: boolean
          max_leverage?: number
          max_loss?: number
          profit_goal?: number
          risk_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deactivation_reason?: string | null
          id?: string
          is_active?: boolean
          max_leverage?: number
          max_loss?: number
          profit_goal?: number
          risk_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_credentials: {
        Row: {
          api_key: string
          api_secret: string
          broker: string
          created_at: string
          id: string
          is_connected: boolean
          is_testnet: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          api_secret: string
          broker?: string
          created_at?: string
          id?: string
          is_connected?: boolean
          is_testnet?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          api_secret?: string
          broker?: string
          created_at?: string
          id?: string
          is_connected?: boolean
          is_testnet?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          best_signal: Json | null
          breakdown_by_asset: Json | null
          breakdown_by_timeframe: Json | null
          created_at: string
          id: string
          report_date: string
          total_losses: number | null
          total_neutral: number | null
          total_signals: number | null
          total_wins: number | null
          win_rate: number | null
          worst_signal: Json | null
        }
        Insert: {
          best_signal?: Json | null
          breakdown_by_asset?: Json | null
          breakdown_by_timeframe?: Json | null
          created_at?: string
          id?: string
          report_date: string
          total_losses?: number | null
          total_neutral?: number | null
          total_signals?: number | null
          total_wins?: number | null
          win_rate?: number | null
          worst_signal?: Json | null
        }
        Update: {
          best_signal?: Json | null
          breakdown_by_asset?: Json | null
          breakdown_by_timeframe?: Json | null
          created_at?: string
          id?: string
          report_date?: string
          total_losses?: number | null
          total_neutral?: number | null
          total_signals?: number | null
          total_wins?: number | null
          win_rate?: number | null
          worst_signal?: Json | null
        }
        Relationships: []
      }
      indicator_performance: {
        Row: {
          actual_result: string | null
          analysis_id: string
          asset: string
          created_at: string
          direction_suggested: string
          id: string
          indicator_name: string
          timeframe: string
          was_correct: boolean | null
          weight_used: number
        }
        Insert: {
          actual_result?: string | null
          analysis_id: string
          asset: string
          created_at?: string
          direction_suggested: string
          id?: string
          indicator_name: string
          timeframe: string
          was_correct?: boolean | null
          weight_used?: number
        }
        Update: {
          actual_result?: string | null
          analysis_id?: string
          asset?: string
          created_at?: string
          direction_suggested?: string
          id?: string
          indicator_name?: string
          timeframe?: string
          was_correct?: boolean | null
          weight_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "indicator_performance_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "auto_analysis_history"
            referencedColumns: ["id"]
          },
        ]
      }
      management_indicator_performance: {
        Row: {
          actual_result: string | null
          analysis_id: string
          asset: string
          created_at: string
          direction_suggested: string
          id: string
          indicator_name: string
          timeframe: string
          was_correct: boolean | null
          weight_used: number
        }
        Insert: {
          actual_result?: string | null
          analysis_id: string
          asset: string
          created_at?: string
          direction_suggested: string
          id?: string
          indicator_name: string
          timeframe: string
          was_correct?: boolean | null
          weight_used?: number
        }
        Update: {
          actual_result?: string | null
          analysis_id?: string
          asset?: string
          created_at?: string
          direction_suggested?: string
          id?: string
          indicator_name?: string
          timeframe?: string
          was_correct?: boolean | null
          weight_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "management_indicator_performance_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "auto_management_history"
            referencedColumns: ["id"]
          },
        ]
      }
      management_refinement_log: {
        Row: {
          adjustments_json: Json | null
          analysis_count: number | null
          asset: string
          backtest_details: Json | null
          backtest_signal_changes: number | null
          created_at: string
          effective_threshold: number | null
          id: string
          indicators_adjusted: number | null
          loss_avoidance_rate: number | null
          missed_opportunity_rate: number | null
          overall_wr_after: number | null
          overall_wr_before: number | null
          projected_wr_new_weights: number | null
          timeframe: string
        }
        Insert: {
          adjustments_json?: Json | null
          analysis_count?: number | null
          asset: string
          backtest_details?: Json | null
          backtest_signal_changes?: number | null
          created_at?: string
          effective_threshold?: number | null
          id?: string
          indicators_adjusted?: number | null
          loss_avoidance_rate?: number | null
          missed_opportunity_rate?: number | null
          overall_wr_after?: number | null
          overall_wr_before?: number | null
          projected_wr_new_weights?: number | null
          timeframe: string
        }
        Update: {
          adjustments_json?: Json | null
          analysis_count?: number | null
          asset?: string
          backtest_details?: Json | null
          backtest_signal_changes?: number | null
          created_at?: string
          effective_threshold?: number | null
          id?: string
          indicators_adjusted?: number | null
          loss_avoidance_rate?: number | null
          missed_opportunity_rate?: number | null
          overall_wr_after?: number | null
          overall_wr_before?: number | null
          projected_wr_new_weights?: number | null
          timeframe?: string
        }
        Relationships: []
      }
      management_refinement_weights: {
        Row: {
          asset: string
          calibrated_weight: number
          created_at: string
          id: string
          indicator_name: string
          last_calibrated_at: string
          original_weight: number
          sample_count: number | null
          timeframe: string
          trend: string | null
          win_rate: number | null
        }
        Insert: {
          asset: string
          calibrated_weight?: number
          created_at?: string
          id?: string
          indicator_name: string
          last_calibrated_at?: string
          original_weight?: number
          sample_count?: number | null
          timeframe: string
          trend?: string | null
          win_rate?: number | null
        }
        Update: {
          asset?: string
          calibrated_weight?: number
          created_at?: string
          id?: string
          indicator_name?: string
          last_calibrated_at?: string
          original_weight?: number
          sample_count?: number | null
          timeframe?: string
          trend?: string | null
          win_rate?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      refinement_log: {
        Row: {
          adjustments_json: Json | null
          analysis_count: number | null
          asset: string
          backtest_details: Json | null
          backtest_signal_changes: number | null
          created_at: string
          effective_threshold: number | null
          id: string
          indicators_adjusted: number | null
          loss_avoidance_rate: number | null
          missed_opportunity_rate: number | null
          overall_wr_after: number | null
          overall_wr_before: number | null
          projected_wr_new_weights: number | null
          timeframe: string
        }
        Insert: {
          adjustments_json?: Json | null
          analysis_count?: number | null
          asset: string
          backtest_details?: Json | null
          backtest_signal_changes?: number | null
          created_at?: string
          effective_threshold?: number | null
          id?: string
          indicators_adjusted?: number | null
          loss_avoidance_rate?: number | null
          missed_opportunity_rate?: number | null
          overall_wr_after?: number | null
          overall_wr_before?: number | null
          projected_wr_new_weights?: number | null
          timeframe: string
        }
        Update: {
          adjustments_json?: Json | null
          analysis_count?: number | null
          asset?: string
          backtest_details?: Json | null
          backtest_signal_changes?: number | null
          created_at?: string
          effective_threshold?: number | null
          id?: string
          indicators_adjusted?: number | null
          loss_avoidance_rate?: number | null
          missed_opportunity_rate?: number | null
          overall_wr_after?: number | null
          overall_wr_before?: number | null
          projected_wr_new_weights?: number | null
          timeframe?: string
        }
        Relationships: []
      }
      refinement_weights: {
        Row: {
          asset: string
          calibrated_weight: number
          created_at: string
          id: string
          indicator_name: string
          last_calibrated_at: string
          original_weight: number
          sample_count: number | null
          timeframe: string
          trend: string | null
          win_rate: number | null
        }
        Insert: {
          asset: string
          calibrated_weight?: number
          created_at?: string
          id?: string
          indicator_name: string
          last_calibrated_at?: string
          original_weight?: number
          sample_count?: number | null
          timeframe: string
          trend?: string | null
          win_rate?: number | null
        }
        Update: {
          asset?: string
          calibrated_weight?: number
          created_at?: string
          id?: string
          indicator_name?: string
          last_calibrated_at?: string
          original_weight?: number
          sample_count?: number | null
          timeframe?: string
          trend?: string | null
          win_rate?: number | null
        }
        Relationships: []
      }
      trade_positions: {
        Row: {
          accumulated_fees: number
          analysis_id: string | null
          close_reason: string | null
          closed_at: string | null
          created_at: string
          current_avg_price: number
          dca_count: number
          dca_history: Json | null
          entry_order_id: string | null
          entry_price: number
          id: string
          leverage: number
          original_size: number
          partial_size: number
          realized_pnl: number | null
          risk_pct: number
          side: string
          sl_filled_at: string | null
          sl_order_id: string | null
          stop_loss_current: number
          stop_loss_original: number
          symbol: string
          take_profit_1: number
          take_profit_2: number | null
          take_profit_3: number | null
          total_position_size: number
          tp_type: string
          tp1_filled_at: string | null
          tp1_order_id: string | null
          tp2_filled_at: string | null
          tp2_order_id: string | null
          tp3_filled_at: string | null
          tp3_order_id: string | null
          trade_state: string
          true_breakeven_price: number
          unrealized_pnl: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accumulated_fees?: number
          analysis_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          current_avg_price: number
          dca_count?: number
          dca_history?: Json | null
          entry_order_id?: string | null
          entry_price: number
          id?: string
          leverage?: number
          original_size: number
          partial_size: number
          realized_pnl?: number | null
          risk_pct?: number
          side: string
          sl_filled_at?: string | null
          sl_order_id?: string | null
          stop_loss_current: number
          stop_loss_original: number
          symbol: string
          take_profit_1: number
          take_profit_2?: number | null
          take_profit_3?: number | null
          total_position_size: number
          tp_type?: string
          tp1_filled_at?: string | null
          tp1_order_id?: string | null
          tp2_filled_at?: string | null
          tp2_order_id?: string | null
          tp3_filled_at?: string | null
          tp3_order_id?: string | null
          trade_state?: string
          true_breakeven_price: number
          unrealized_pnl?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accumulated_fees?: number
          analysis_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          current_avg_price?: number
          dca_count?: number
          dca_history?: Json | null
          entry_order_id?: string | null
          entry_price?: number
          id?: string
          leverage?: number
          original_size?: number
          partial_size?: number
          realized_pnl?: number | null
          risk_pct?: number
          side?: string
          sl_filled_at?: string | null
          sl_order_id?: string | null
          stop_loss_current?: number
          stop_loss_original?: number
          symbol?: string
          take_profit_1?: number
          take_profit_2?: number | null
          take_profit_3?: number | null
          total_position_size?: number
          tp_type?: string
          tp1_filled_at?: string | null
          tp1_order_id?: string | null
          tp2_filled_at?: string | null
          tp2_order_id?: string | null
          tp3_filled_at?: string | null
          tp3_order_id?: string | null
          trade_state?: string
          true_breakeven_price?: number
          unrealized_pnl?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_positions_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis_history"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
