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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string
          created_at: string | null
          description: string
          icon_name: string | null
          id: string
          is_premium: boolean | null
          name: string
          points: number | null
          requirement_type: string
          requirement_value: number
          unlock_animation_type: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          icon_name?: string | null
          id?: string
          is_premium?: boolean | null
          name: string
          points?: number | null
          requirement_type: string
          requirement_value: number
          unlock_animation_type?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          icon_name?: string | null
          id?: string
          is_premium?: boolean | null
          name?: string
          points?: number | null
          requirement_type?: string
          requirement_value?: number
          unlock_animation_type?: string | null
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      ai_context_references: {
        Row: {
          conversation_id: string
          created_at: string
          excerpt: string | null
          id: string
          message_id: string
          reference_id: string | null
          reference_type: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          excerpt?: string | null
          id?: string
          message_id: string
          reference_id?: string | null
          reference_type: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          message_id?: string
          reference_id?: string | null
          reference_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_context_references_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          created_at: string
          date: string
          id: string
          message_count: number
          token_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          message_count?: number
          token_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          message_count?: number
          token_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_context_sessions: {
        Row: {
          active_document_id: string | null
          active_flashcard_id: string | null
          active_lesson_id: string | null
          active_quiz_id: string | null
          context_data: Json | null
          conversation_id: string
          id: string
          started_at: string
          subject_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_document_id?: string | null
          active_flashcard_id?: string | null
          active_lesson_id?: string | null
          active_quiz_id?: string | null
          context_data?: Json | null
          conversation_id: string
          id?: string
          started_at?: string
          subject_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_document_id?: string | null
          active_flashcard_id?: string | null
          active_lesson_id?: string | null
          active_quiz_id?: string | null
          context_data?: Json | null
          conversation_id?: string
          id?: string
          started_at?: string
          subject_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_context_sessions_active_document_id_fkey"
            columns: ["active_document_id"]
            isOneToOne: false
            referencedRelation: "study_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_context_sessions_active_flashcard_id_fkey"
            columns: ["active_flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_context_sessions_active_quiz_id_fkey"
            columns: ["active_quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_context_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_context_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          ai_model: string | null
          created_at: string | null
          id: string
          knowledge_context: Json | null
          subject_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          created_at?: string | null
          id?: string
          knowledge_context?: Json | null
          subject_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_model?: string | null
          created_at?: string | null
          id?: string
          knowledge_context?: Json | null
          subject_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          encrypted_content: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          encrypted_content?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          encrypted_content?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      code_redemptions: {
        Row: {
          code: string
          code_id: string
          created_at: string
          discount_type: string | null
          discount_value: number | null
          id: string
          redemption_type: string
          status: string
          trial_ends_at: string | null
          trial_starts_at: string | null
          trial_tier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          code_id: string
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          redemption_type?: string
          status?: string
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          trial_tier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          code_id?: string
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          redemption_type?: string
          status?: string
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          trial_tier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "coupon_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string
        }
        Relationships: []
      }
      coupon_codes: {
        Row: {
          applicable_tiers: string[] | null
          code: string
          created_at: string
          created_by: string | null
          current_uses: number
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          trial_days: number | null
          trial_tier: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_tiers?: string[] | null
          code: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          trial_days?: number | null
          trial_tier?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_tiers?: string[] | null
          code?: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          trial_days?: number | null
          trial_tier?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      document_usage: {
        Row: {
          created_at: string
          document_count: number
          id: string
          total_pages_processed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_count?: number
          id?: string
          total_pages_processed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_count?: number
          id?: string
          total_pages_processed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          accurate: string | null
          created_at: string | null
          created_by: string | null
          curriculum: Database["public"]["Enums"]["curriculum_type"] | null
          description: string | null
          file_url: string | null
          grade: number | null
          id: string
          is_memo: boolean | null
          is_past_paper: boolean | null
          is_published: boolean | null
          language: string | null
          memo_for_document_id: string | null
          month: string | null
          paper_number: number | null
          subject_id: string | null
          title: string
          updated_at: string | null
          year: number | null
        }
        Insert: {
          accurate?: string | null
          created_at?: string | null
          created_by?: string | null
          curriculum?: Database["public"]["Enums"]["curriculum_type"] | null
          description?: string | null
          file_url?: string | null
          grade?: number | null
          id?: string
          is_memo?: boolean | null
          is_past_paper?: boolean | null
          is_published?: boolean | null
          language?: string | null
          memo_for_document_id?: string | null
          month?: string | null
          paper_number?: number | null
          subject_id?: string | null
          title: string
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          accurate?: string | null
          created_at?: string | null
          created_by?: string | null
          curriculum?: Database["public"]["Enums"]["curriculum_type"] | null
          description?: string | null
          file_url?: string | null
          grade?: number | null
          id?: string
          is_memo?: boolean | null
          is_past_paper?: boolean | null
          is_published?: boolean | null
          language?: string | null
          memo_for_document_id?: string | null
          month?: string | null
          paper_number?: number | null
          subject_id?: string | null
          title?: string
          updated_at?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_memo_for_document_id_fkey"
            columns: ["memo_for_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_ai_explanations: {
        Row: {
          created_at: string
          explanation_style: string
          explanation_text: string
          flashcard_id: string
          id: string
          rating: number | null
          updated_at: string
          usage_count: number | null
          user_feedback: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          explanation_style?: string
          explanation_text: string
          flashcard_id: string
          id?: string
          rating?: number | null
          updated_at?: string
          usage_count?: number | null
          user_feedback?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          explanation_style?: string
          explanation_text?: string
          flashcard_id?: string
          id?: string
          rating?: number | null
          updated_at?: string
          usage_count?: number | null
          user_feedback?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_ai_explanations_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_decks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_ai_generated: boolean
          mastered_cards: number
          nbt_lesson_id: string | null
          source_knowledge_id: string | null
          subject_id: string | null
          term: number | null
          title: string
          total_cards: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_ai_generated?: boolean
          mastered_cards?: number
          nbt_lesson_id?: string | null
          source_knowledge_id?: string | null
          subject_id?: string | null
          term?: number | null
          title: string
          total_cards?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_ai_generated?: boolean
          mastered_cards?: number
          nbt_lesson_id?: string | null
          source_knowledge_id?: string | null
          subject_id?: string | null
          term?: number | null
          title?: string
          total_cards?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_decks_nbt_lesson_id_fkey"
            columns: ["nbt_lesson_id"]
            isOneToOne: false
            referencedRelation: "nbt_generated_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_decks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_mastery_history: {
        Row: {
          action: string
          created_at: string
          deck_id: string
          flashcard_id: string
          id: string
          new_state: boolean
          previous_state: boolean | null
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          deck_id: string
          flashcard_id: string
          id?: string
          new_state: boolean
          previous_state?: boolean | null
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          deck_id?: string
          flashcard_id?: string
          id?: string
          new_state?: boolean
          previous_state?: boolean | null
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_mastery_history_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_mastery_history_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          created_at: string | null
          deck_id: string | null
          ease_factor: number | null
          front: string
          id: string
          interval_days: number | null
          is_mastered: boolean | null
          last_reviewed_at: string | null
          next_review_at: string | null
          review_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string | null
          deck_id?: string | null
          ease_factor?: number | null
          front: string
          id?: string
          interval_days?: number | null
          is_mastered?: boolean | null
          last_reviewed_at?: string | null
          next_review_at?: string | null
          review_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string | null
          deck_id?: string | null
          ease_factor?: number | null
          front?: string
          id?: string
          interval_days?: number | null
          is_mastered?: boolean | null
          last_reviewed_at?: string | null
          next_review_at?: string | null
          review_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_lessons: {
        Row: {
          chunk_number: number
          content: string
          created_at: string | null
          document_id: string
          error: string | null
          id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chunk_number: number
          content: string
          created_at?: string | null
          document_id: string
          error?: string | null
          id?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chunk_number?: number
          content?: string
          created_at?: string | null
          document_id?: string
          error?: string | null
          id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_lessons_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "study_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_practice_history: {
        Row: {
          completed_at: string | null
          correct_answers: number
          created_at: string | null
          difficulty: string
          graph_type: string
          id: string
          questions_data: Json | null
          score_percentage: number
          time_taken_seconds: number | null
          total_questions: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          correct_answers?: number
          created_at?: string | null
          difficulty?: string
          graph_type: string
          id?: string
          questions_data?: Json | null
          score_percentage?: number
          time_taken_seconds?: number | null
          total_questions?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          correct_answers?: number
          created_at?: string | null
          difficulty?: string
          graph_type?: string
          id?: string
          questions_data?: Json | null
          score_percentage?: number
          time_taken_seconds?: number | null
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          content: string
          content_type: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          source_file_url: string | null
          subject_id: string | null
          tags: string[] | null
          term: number | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          content_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          source_file_url?: string | null
          subject_id?: string | null
          tags?: string[] | null
          term?: number | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          content_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          source_file_url?: string | null
          subject_id?: string | null
          tags?: string[] | null
          term?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_comments: {
        Row: {
          content: string
          created_at: string
          encrypted_content: string | null
          highlighted_text: string | null
          id: string
          lesson_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          encrypted_content?: string | null
          highlighted_text?: string | null
          id?: string
          lesson_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          encrypted_content?: string | null
          highlighted_text?: string | null
          id?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lesson_completions: {
        Row: {
          completed_at: string | null
          completed_sections: number | null
          created_at: string | null
          id: string
          is_completed: boolean | null
          lesson_id: string
          started_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_sections?: number | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          lesson_id: string
          started_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_sections?: number | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          lesson_id?: string
          started_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      nbt_data_attempts: {
        Row: {
          completed_at: string | null
          created_at: string | null
          data_question_id: string
          id: string
          is_correct: boolean | null
          started_at: string | null
          time_taken_seconds: number | null
          user_answer: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          data_question_id: string
          id?: string
          is_correct?: boolean | null
          started_at?: string | null
          time_taken_seconds?: number | null
          user_answer?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          data_question_id?: string
          id?: string
          is_correct?: boolean | null
          started_at?: string | null
          time_taken_seconds?: number | null
          user_answer?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nbt_data_attempts_data_question_id_fkey"
            columns: ["data_question_id"]
            isOneToOne: false
            referencedRelation: "nbt_data_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      nbt_data_interpretation: {
        Row: {
          collection_id: string | null
          created_at: string | null
          data_image_type: string | null
          data_image_url: string
          description: string | null
          difficulty: string
          id: string
          is_official: boolean | null
          is_published: boolean | null
          order_index: number | null
          question_count: number | null
          section: string
          tags: string[] | null
          title: string
          topic: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          collection_id?: string | null
          created_at?: string | null
          data_image_type?: string | null
          data_image_url: string
          description?: string | null
          difficulty: string
          id?: string
          is_official?: boolean | null
          is_published?: boolean | null
          order_index?: number | null
          question_count?: number | null
          section: string
          tags?: string[] | null
          title: string
          topic?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          collection_id?: string | null
          created_at?: string | null
          data_image_type?: string | null
          data_image_url?: string
          description?: string | null
          difficulty?: string
          id?: string
          is_official?: boolean | null
          is_published?: boolean | null
          order_index?: number | null
          question_count?: number | null
          section?: string
          tags?: string[] | null
          title?: string
          topic?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nbt_data_interpretation_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "nbt_question_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      nbt_data_questions: {
        Row: {
          correct_answer: string
          correct_answer_index: number | null
          created_at: string | null
          data_interpretation_id: string
          explanation: string | null
          id: string
          options: Json | null
          order_index: number | null
          points: number | null
          question_text: string
          question_type: string
          user_id: string | null
        }
        Insert: {
          correct_answer: string
          correct_answer_index?: number | null
          created_at?: string | null
          data_interpretation_id: string
          explanation?: string | null
          id?: string
          options?: Json | null
          order_index?: number | null
          points?: number | null
          question_text: string
          question_type: string
          user_id?: string | null
        }
        Update: {
          correct_answer?: string
          correct_answer_index?: number | null
          created_at?: string | null
          data_interpretation_id?: string
          explanation?: string | null
          id?: string
          options?: Json | null
          order_index?: number | null
          points?: number | null
          question_text?: string
          question_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nbt_data_questions_data_interpretation_id_fkey"
            columns: ["data_interpretation_id"]
            isOneToOne: false
            referencedRelation: "nbt_data_interpretation"
            referencedColumns: ["id"]
          },
        ]
      }
      nbt_generated_lessons: {
        Row: {
          content: string
          created_at: string | null
          id: string
          section: string
          source_document_id: string | null
          source_material_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          section: string
          source_document_id?: string | null
          source_material_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          section?: string
          source_document_id?: string | null
          source_material_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nbt_generated_lessons_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "nbt_user_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nbt_generated_lessons_source_material_id_fkey"
            columns: ["source_material_id"]
            isOneToOne: false
            referencedRelation: "nbt_study_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      nbt_practice_attempts: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          is_correct: boolean | null
          question_id: string
          section: string
          started_at: string | null
          time_taken_seconds: number | null
          user_answer: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          question_id: string
          section: string
          started_at?: string | null
          time_taken_seconds?: number | null
          user_answer?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string
          section?: string
          started_at?: string | null
          time_taken_seconds?: number | null
          user_answer?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nbt_practice_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "nbt_practice_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      nbt_practice_questions: {
        Row: {
          collection_id: string | null
          correct_answer: string
          correct_answer_index: number | null
          created_at: string | null
          difficulty: string
          explanation: string | null
          hint: string | null
          id: string
          is_official: boolean | null
          is_published: boolean | null
          options: Json | null
          order_index: number | null
          points: number | null
          question_image_url: string | null
          question_text: string
          question_type: string
          section: string
          tags: string[] | null
          title: string
          topic: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          collection_id?: string | null
          correct_answer: string
          correct_answer_index?: number | null
          created_at?: string | null
          difficulty: string
          explanation?: string | null
          hint?: string | null
          id?: string
          is_official?: boolean | null
          is_published?: boolean | null
          options?: Json | null
          order_index?: number | null
          points?: number | null
          question_image_url?: string | null
          question_text: string
          question_type: string
          section: string
          tags?: string[] | null
          title: string
          topic?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          collection_id?: string | null
          correct_answer?: string
          correct_answer_index?: number | null
          created_at?: string | null
          difficulty?: string
          explanation?: string | null
          hint?: string | null
          id?: string
          is_official?: boolean | null
          is_published?: boolean | null
          options?: Json | null
          order_index?: number | null
          points?: number | null
          question_image_url?: string | null
          question_text?: string
          question_type?: string
          section?: string
          tags?: string[] | null
          title?: string
          topic?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nbt_practice_questions_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "nbt_question_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      nbt_practice_tests: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_official: boolean | null
          is_published: boolean | null
          passing_score: number | null
          section: string | null
          time_limit_minutes: number | null
          title: string
          total_questions: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_official?: boolean | null
          is_published?: boolean | null
          passing_score?: number | null
          section?: string | null
          time_limit_minutes?: number | null
          title: string
          total_questions?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_official?: boolean | null
          is_published?: boolean | null
          passing_score?: number | null
          section?: string | null
          time_limit_minutes?: number | null
          title?: string
          total_questions?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      nbt_question_collections: {
        Row: {
          created_at: string | null
          description: string | null
          difficulty: string | null
          id: string
          is_official: boolean | null
          is_published: boolean | null
          nbt_lesson_id: string | null
          order_index: number | null
          question_count: number | null
          section: string
          tags: string[] | null
          title: string
          topic: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          is_official?: boolean | null
          is_published?: boolean | null
          nbt_lesson_id?: string | null
          order_index?: number | null
          question_count?: number | null
          section: string
          tags?: string[] | null
          title: string
          topic: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          is_official?: boolean | null
          is_published?: boolean | null
          nbt_lesson_id?: string | null
          order_index?: number | null
          question_count?: number | null
          section?: string
          tags?: string[] | null
          title?: string
          topic?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nbt_question_collections_nbt_lesson_id_fkey"
            columns: ["nbt_lesson_id"]
            isOneToOne: false
            referencedRelation: "nbt_generated_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      nbt_study_materials: {
        Row: {
          content: string | null
          content_url: string | null
          created_at: string | null
          description: string | null
          file_size: number | null
          file_type: string | null
          id: string
          is_official: boolean | null
          is_published: boolean | null
          material_type: string
          order_index: number | null
          section: string
          source_document_id: string | null
          tags: string[] | null
          title: string
          topic: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          content_url?: string | null
          created_at?: string | null
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_official?: boolean | null
          is_published?: boolean | null
          material_type: string
          order_index?: number | null
          section: string
          source_document_id?: string | null
          tags?: string[] | null
          title: string
          topic: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          content_url?: string | null
          created_at?: string | null
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_official?: boolean | null
          is_published?: boolean | null
          material_type?: string
          order_index?: number | null
          section?: string
          source_document_id?: string | null
          tags?: string[] | null
          title?: string
          topic?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nbt_study_materials_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "nbt_user_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      nbt_test_attempts: {
        Row: {
          answered_questions: number | null
          answers: Json | null
          completed_at: string | null
          correct_answers: number | null
          created_at: string | null
          id: string
          max_score: number | null
          percentage: number | null
          section: string | null
          started_at: string | null
          status: string | null
          test_id: string
          time_taken_seconds: number | null
          total_score: number | null
          user_id: string
        }
        Insert: {
          answered_questions?: number | null
          answers?: Json | null
          completed_at?: string | null
          correct_answers?: number | null
          created_at?: string | null
          id?: string
          max_score?: number | null
          percentage?: number | null
          section?: string | null
          started_at?: string | null
          status?: string | null
          test_id: string
          time_taken_seconds?: number | null
          total_score?: number | null
          user_id: string
        }
        Update: {
          answered_questions?: number | null
          answers?: Json | null
          completed_at?: string | null
          correct_answers?: number | null
          created_at?: string | null
          id?: string
          max_score?: number | null
          percentage?: number | null
          section?: string | null
          started_at?: string | null
          status?: string | null
          test_id?: string
          time_taken_seconds?: number | null
          total_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nbt_test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "nbt_practice_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      nbt_test_questions: {
        Row: {
          created_at: string | null
          id: string
          order_index: number | null
          question_id: string
          test_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_index?: number | null
          question_id: string
          test_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          order_index?: number | null
          question_id?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nbt_test_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "nbt_practice_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nbt_test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "nbt_practice_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      nbt_user_documents: {
        Row: {
          content: string | null
          created_at: string | null
          extraction_status: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          metadata: Json | null
          processed_content: string | null
          section: string
          source_file_url: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          extraction_status?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          processed_content?: string | null
          section: string
          source_file_url?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          extraction_status?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          processed_content?: string | null
          section?: string
          source_file_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      nbt_user_progress: {
        Row: {
          aql_attempts: number | null
          aql_average_score: number | null
          aql_correct: number | null
          best_test_score: number | null
          created_at: string | null
          id: string
          last_attempted_at: string | null
          mat_attempts: number | null
          mat_average_score: number | null
          mat_correct: number | null
          ql_attempts: number | null
          ql_average_score: number | null
          ql_correct: number | null
          total_test_attempts: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aql_attempts?: number | null
          aql_average_score?: number | null
          aql_correct?: number | null
          best_test_score?: number | null
          created_at?: string | null
          id?: string
          last_attempted_at?: string | null
          mat_attempts?: number | null
          mat_average_score?: number | null
          mat_correct?: number | null
          ql_attempts?: number | null
          ql_average_score?: number | null
          ql_correct?: number | null
          total_test_attempts?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aql_attempts?: number | null
          aql_average_score?: number | null
          aql_correct?: number | null
          best_test_score?: number | null
          created_at?: string | null
          id?: string
          last_attempted_at?: string | null
          mat_attempts?: number | null
          mat_average_score?: number | null
          mat_correct?: number | null
          ql_attempts?: number | null
          ql_average_score?: number | null
          ql_correct?: number | null
          total_test_attempts?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      past_paper_attempts: {
        Row: {
          completed_at: string | null
          created_at: string | null
          document_id: string
          id: string
          max_score: number | null
          notes: string | null
          score: number | null
          time_taken_minutes: number | null
          user_entered_score: boolean | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          document_id: string
          id?: string
          max_score?: number | null
          notes?: string | null
          score?: number | null
          time_taken_minutes?: number | null
          user_entered_score?: boolean | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          document_id?: string
          id?: string
          max_score?: number | null
          notes?: string | null
          score?: number | null
          time_taken_minutes?: number | null
          user_entered_score?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "past_paper_attempts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      past_paper_questions: {
        Row: {
          context: string | null
          created_at: string | null
          document_id: string
          id: string
          marks: number | null
          metadata: Json | null
          question_number: string
          question_text: string
          section: string | null
          topic: string | null
          updated_at: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          document_id: string
          id?: string
          marks?: number | null
          metadata?: Json | null
          question_number: string
          question_text: string
          section?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string | null
          document_id?: string
          id?: string
          marks?: number | null
          metadata?: Json | null
          question_number?: string
          question_text?: string
          section?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "past_paper_questions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          metadata: Json | null
          payment_method: string | null
          payment_type: string
          status: string | null
          subscription_plan: string | null
          transaction_reference: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          payment_type: string
          status?: string | null
          subscription_plan?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          payment_type?: string
          status?: string | null
          subscription_plan?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      paystack_transactions: {
        Row: {
          amount: number
          channel: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          paid_at: string | null
          paystack_event: string | null
          reference: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          channel?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          paystack_event?: string | null
          reference: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          channel?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          paystack_event?: string | null
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_annotations: {
        Row: {
          annotation_type: string
          color: string | null
          content: string | null
          created_at: string | null
          document_id: string | null
          file_url: string | null
          id: string
          page_number: number
          position: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          annotation_type: string
          color?: string | null
          content?: string | null
          created_at?: string | null
          document_id?: string | null
          file_url?: string | null
          id?: string
          page_number: number
          position: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          annotation_type?: string
          color?: string | null
          content?: string | null
          created_at?: string | null
          document_id?: string | null
          file_url?: string | null
          id?: string
          page_number?: number
          position?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_annotations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_processing_jobs: {
        Row: {
          completed_at: string | null
          course_name: string | null
          created_at: string | null
          curriculum_type: string | null
          detected_section: string | null
          error_message: string | null
          file_name: string
          file_url: string
          grade_level: string | null
          id: string
          learning_objectives: string[] | null
          status: string
          topics: string[] | null
          total_lessons: number | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          course_name?: string | null
          created_at?: string | null
          curriculum_type?: string | null
          detected_section?: string | null
          error_message?: string | null
          file_name: string
          file_url: string
          grade_level?: string | null
          id?: string
          learning_objectives?: string[] | null
          status?: string
          topics?: string[] | null
          total_lessons?: number | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          course_name?: string | null
          created_at?: string | null
          curriculum_type?: string | null
          detected_section?: string | null
          error_message?: string | null
          file_name?: string
          file_url?: string
          grade_level?: string | null
          id?: string
          learning_objectives?: string[] | null
          status?: string
          topics?: string[] | null
          total_lessons?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      pre_generated_lessons: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          curriculum: Database["public"]["Enums"]["curriculum_type"][]
          description: string | null
          grade: number | null
          id: string
          order_index: number | null
          status: string
          subject_ids: string[]
          title: string
          topic: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          curriculum?: Database["public"]["Enums"]["curriculum_type"][]
          description?: string | null
          grade?: number | null
          id?: string
          order_index?: number | null
          status?: string
          subject_ids?: string[]
          title: string
          topic?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          curriculum?: Database["public"]["Enums"]["curriculum_type"][]
          description?: string | null
          grade?: number | null
          id?: string
          order_index?: number | null
          status?: string
          subject_ids?: string[]
          title?: string
          topic?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          curriculum: Database["public"]["Enums"]["curriculum_type"] | null
          exam_board: string | null
          full_name: string | null
          grade: number | null
          id: string
          is_active: boolean | null
          is_suspended: boolean | null
          language: string | null
          last_login_at: string | null
          login_count: number | null
          payment_method: string | null
          phone: string | null
          preferred_theme: string | null
          renewal_date: string | null
          school: string | null
          subjects: string[] | null
          subscription_plan: string | null
          suspended_at: string | null
          suspended_reason: string | null
          total_study_minutes: number | null
          updated_at: string | null
          user_id: string
          user_initials: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          curriculum?: Database["public"]["Enums"]["curriculum_type"] | null
          exam_board?: string | null
          full_name?: string | null
          grade?: number | null
          id?: string
          is_active?: boolean | null
          is_suspended?: boolean | null
          language?: string | null
          last_login_at?: string | null
          login_count?: number | null
          payment_method?: string | null
          phone?: string | null
          preferred_theme?: string | null
          renewal_date?: string | null
          school?: string | null
          subjects?: string[] | null
          subscription_plan?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          total_study_minutes?: number | null
          updated_at?: string | null
          user_id: string
          user_initials?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          curriculum?: Database["public"]["Enums"]["curriculum_type"] | null
          exam_board?: string | null
          full_name?: string | null
          grade?: number | null
          id?: string
          is_active?: boolean | null
          is_suspended?: boolean | null
          language?: string | null
          last_login_at?: string | null
          login_count?: number | null
          payment_method?: string | null
          phone?: string | null
          preferred_theme?: string | null
          renewal_date?: string | null
          school?: string | null
          subjects?: string[] | null
          subscription_plan?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          total_study_minutes?: number | null
          updated_at?: string | null
          user_id?: string
          user_initials?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json | null
          completed_at: string | null
          id: string
          knowledge_id: string | null
          max_score: number | null
          percentage: number | null
          quiz_id: string | null
          score: number | null
          started_at: string | null
          time_taken_seconds: number | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          id?: string
          knowledge_id?: string | null
          max_score?: number | null
          percentage?: number | null
          quiz_id?: string | null
          score?: number | null
          started_at?: string | null
          time_taken_seconds?: number | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          id?: string
          knowledge_id?: string | null
          max_score?: number | null
          percentage?: number | null
          quiz_id?: string | null
          score?: number | null
          started_at?: string | null
          time_taken_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_performance_analytics: {
        Row: {
          activity_type: string | null
          completed_at: string
          created_at: string
          difficulty_level: string | null
          id: string
          knowledge_id: string | null
          max_score: number | null
          percentage: number | null
          questions_correct: number | null
          quiz_attempt_id: string | null
          quiz_id: string | null
          score: number | null
          subject_id: string | null
          time_taken_seconds: number | null
          total_questions: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type?: string | null
          completed_at?: string
          created_at?: string
          difficulty_level?: string | null
          id?: string
          knowledge_id?: string | null
          max_score?: number | null
          percentage?: number | null
          questions_correct?: number | null
          quiz_attempt_id?: string | null
          quiz_id?: string | null
          score?: number | null
          subject_id?: string | null
          time_taken_seconds?: number | null
          total_questions?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string | null
          completed_at?: string
          created_at?: string
          difficulty_level?: string | null
          id?: string
          knowledge_id?: string | null
          max_score?: number | null
          percentage?: number | null
          questions_correct?: number | null
          quiz_attempt_id?: string | null
          quiz_id?: string | null
          score?: number | null
          subject_id?: string | null
          time_taken_seconds?: number | null
          total_questions?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_performance_analytics_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_performance_analytics_quiz_attempt_id_fkey"
            columns: ["quiz_attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_performance_analytics_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_performance_analytics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_performance_summary: {
        Row: {
          average_score: number | null
          created_at: string
          highest_score: number | null
          id: string
          last_quiz_date: string | null
          lowest_score: number | null
          total_quizzes_taken: number | null
          total_time_spent_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          average_score?: number | null
          created_at?: string
          highest_score?: number | null
          id?: string
          last_quiz_date?: string | null
          lowest_score?: number | null
          total_quizzes_taken?: number | null
          total_time_spent_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          average_score?: number | null
          created_at?: string
          highest_score?: number | null
          id?: string
          last_quiz_date?: string | null
          lowest_score?: number | null
          total_quizzes_taken?: number | null
          total_time_spent_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          correct_answer: string
          created_at: string | null
          explanation: string | null
          id: string
          options: Json | null
          order_index: number | null
          points: number
          question: string
          question_type: string
          quiz_id: string
        }
        Insert: {
          correct_answer: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          options?: Json | null
          order_index?: number | null
          points?: number
          question: string
          question_type?: string
          quiz_id: string
        }
        Update: {
          correct_answer?: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          options?: Json | null
          order_index?: number | null
          points?: number
          question?: string
          question_type?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_ai_generated: boolean
          source_knowledge_id: string | null
          subject_id: string | null
          term: number | null
          time_limit_minutes: number | null
          title: string
          total_questions: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_ai_generated?: boolean
          source_knowledge_id?: string | null
          subject_id?: string | null
          term?: number | null
          time_limit_minutes?: number | null
          title: string
          total_questions?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_ai_generated?: boolean
          source_knowledge_id?: string | null
          subject_id?: string | null
          term?: number | null
          time_limit_minutes?: number | null
          title?: string
          total_questions?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          is_completed: boolean | null
          priority: string | null
          reminder_type: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          is_completed?: boolean | null
          priority?: string | null
          reminder_type: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          is_completed?: boolean | null
          priority?: string | null
          reminder_type?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          affiliate_link: string | null
          availability_limit: number | null
          claimed_count: number
          created_at: string
          description: string | null
          discount_code: string | null
          discount_percentage: number | null
          id: string
          is_active: boolean
          name: string
          required_points: number
          reward_type: Database["public"]["Enums"]["reward_type"]
          tier_requirement: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          affiliate_link?: string | null
          availability_limit?: number | null
          claimed_count?: number
          created_at?: string
          description?: string | null
          discount_code?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean
          name: string
          required_points?: number
          reward_type: Database["public"]["Enums"]["reward_type"]
          tier_requirement?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          affiliate_link?: string | null
          availability_limit?: number | null
          claimed_count?: number
          created_at?: string
          description?: string | null
          discount_code?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean
          name?: string
          required_points?: number
          reward_type?: Database["public"]["Enums"]["reward_type"]
          tier_requirement?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      study_analytics: {
        Row: {
          average_score: number | null
          content_type: string | null
          created_at: string | null
          date: string
          flashcard_count: number | null
          id: string
          pages_completed: number | null
          sessions_count: number | null
          subject_id: string | null
          tests_attempted: number | null
          total_study_minutes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          average_score?: number | null
          content_type?: string | null
          created_at?: string | null
          date: string
          flashcard_count?: number | null
          id?: string
          pages_completed?: number | null
          sessions_count?: number | null
          subject_id?: string | null
          tests_attempted?: number | null
          total_study_minutes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          average_score?: number | null
          content_type?: string | null
          created_at?: string | null
          date?: string
          flashcard_count?: number | null
          id?: string
          pages_completed?: number | null
          sessions_count?: number | null
          subject_id?: string | null
          tests_attempted?: number | null
          total_study_minutes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_analytics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_annotations: {
        Row: {
          annotation_type: string
          color: string | null
          content: string | null
          created_at: string | null
          id: string
          page_number: number | null
          position: Json
          study_document_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          annotation_type: string
          color?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          page_number?: number | null
          position: Json
          study_document_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          annotation_type?: string
          color?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          page_number?: number | null
          position?: Json
          study_document_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_annotations_study_document_id_fkey"
            columns: ["study_document_id"]
            isOneToOne: false
            referencedRelation: "study_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      study_documents: {
        Row: {
          created_at: string | null
          extracted_sections: Json | null
          extracted_text: string | null
          extraction_status: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          key_concepts: string[] | null
          knowledge_id: string
          num_pages: number | null
          processed_content: string | null
          processing_error: string | null
          subject_id: string | null
          summary: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          extracted_sections?: Json | null
          extracted_text?: string | null
          extraction_status?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          key_concepts?: string[] | null
          knowledge_id: string
          num_pages?: number | null
          processed_content?: string | null
          processing_error?: string | null
          subject_id?: string | null
          summary?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          extracted_sections?: Json | null
          extracted_text?: string | null
          extraction_status?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          key_concepts?: string[] | null
          knowledge_id?: string
          num_pages?: number | null
          processed_content?: string | null
          processing_error?: string | null
          subject_id?: string | null
          summary?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_documents_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_documents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_exams: {
        Row: {
          best_score: number | null
          created_at: string | null
          document_id: string | null
          estimated_minutes: number
          id: string
          questions: Json
          subject_id: string | null
          title: string
          total_points: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          best_score?: number | null
          created_at?: string | null
          document_id?: string | null
          estimated_minutes?: number
          id?: string
          questions?: Json
          subject_id?: string | null
          title: string
          total_points?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          best_score?: number | null
          created_at?: string | null
          document_id?: string | null
          estimated_minutes?: number
          id?: string
          questions?: Json
          subject_id?: string | null
          title?: string
          total_points?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_exams_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "study_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_exams_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_material_subjects: {
        Row: {
          created_at: string
          id: string
          study_document_id: string
          subject_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          study_document_id: string
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          study_document_id?: string
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_material_subjects_study_document_id_fkey"
            columns: ["study_document_id"]
            isOneToOne: false
            referencedRelation: "study_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_material_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          break_time_minutes: number | null
          created_at: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          notes: string | null
          started_at: string | null
          status: string | null
          subject_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          break_time_minutes?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string | null
          status?: string | null
          subject_id?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          break_time_minutes?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string | null
          status?: string | null
          subject_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_time_analytics: {
        Row: {
          created_at: string
          id: string
          session_count: number | null
          study_date: string
          subject_id: string | null
          total_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_count?: number | null
          study_date: string
          subject_id?: string | null
          total_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_count?: number | null
          study_date?: string
          subject_id?: string | null
          total_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_time_analytics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_time_sessions: {
        Row: {
          completed_at: string | null
          content_id: string | null
          content_type: string | null
          created_at: string
          id: string
          paused_at: string | null
          started_at: string
          status: string
          subject_id: string | null
          total_duration_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          paused_at?: string | null
          started_at?: string
          status?: string
          subject_id?: string | null
          total_duration_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          paused_at?: string | null
          started_at?: string
          status?: string
          subject_id?: string | null
          total_duration_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_time_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_time_trends: {
        Row: {
          average_daily_minutes: number | null
          created_at: string
          id: string
          period: string
          period_end_date: string
          period_start_date: string
          subject_id: string | null
          total_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          average_daily_minutes?: number | null
          created_at?: string
          id?: string
          period: string
          period_end_date: string
          period_start_date: string
          subject_id?: string | null
          total_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          average_daily_minutes?: number | null
          created_at?: string
          id?: string
          period?: string
          period_end_date?: string
          period_start_date?: string
          subject_id?: string | null
          total_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_time_trends_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_analytics_summary: {
        Row: {
          average_exam_score: number | null
          average_quiz_score: number | null
          created_at: string
          id: string
          last_studied_at: string | null
          progress_percentage: number | null
          subject_id: string
          total_exams_taken: number | null
          total_flashcards_created: number | null
          total_flashcards_mastered: number | null
          total_lessons_completed: number | null
          total_quizzes_taken: number | null
          total_study_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          average_exam_score?: number | null
          average_quiz_score?: number | null
          created_at?: string
          id?: string
          last_studied_at?: string | null
          progress_percentage?: number | null
          subject_id: string
          total_exams_taken?: number | null
          total_flashcards_created?: number | null
          total_flashcards_mastered?: number | null
          total_lessons_completed?: number | null
          total_quizzes_taken?: number | null
          total_study_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          average_exam_score?: number | null
          average_quiz_score?: number | null
          created_at?: string
          id?: string
          last_studied_at?: string | null
          progress_percentage?: number | null
          subject_id?: string
          total_exams_taken?: number | null
          total_flashcards_created?: number | null
          total_flashcards_mastered?: number | null
          total_lessons_completed?: number | null
          total_quizzes_taken?: number | null
          total_study_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_analytics_summary_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          color: string | null
          created_at: string | null
          curriculum: Database["public"]["Enums"]["curriculum_type"]
          grade: number | null
          icon_name: string | null
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          color?: string | null
          created_at?: string | null
          curriculum: Database["public"]["Enums"]["curriculum_type"]
          grade?: number | null
          icon_name?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          color?: string | null
          created_at?: string | null
          curriculum?: Database["public"]["Enums"]["curriculum_type"]
          grade?: number | null
          icon_name?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          paystack_authorization_code: string | null
          paystack_customer_code: string | null
          paystack_email_token: string | null
          paystack_plan_code: string | null
          paystack_subscription_code: string | null
          status: string
          tier: Database["public"]["Enums"]["subscription_tier"]
          trial_code_id: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          paystack_authorization_code?: string | null
          paystack_customer_code?: string | null
          paystack_email_token?: string | null
          paystack_plan_code?: string | null
          paystack_subscription_code?: string | null
          status?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_code_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          paystack_authorization_code?: string | null
          paystack_customer_code?: string | null
          paystack_email_token?: string | null
          paystack_plan_code?: string | null
          paystack_subscription_code?: string | null
          status?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_code_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_trial_code_id_fkey"
            columns: ["trial_code_id"]
            isOneToOne: false
            referencedRelation: "coupon_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string | null
          id: string
          message: string
          response: string | null
          status: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          response?: string | null
          status?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          response?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_announcements: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          message: string
          priority: string | null
          target_curricula: string[] | null
          target_grades: number[] | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          priority?: string | null
          target_curricula?: string[] | null
          target_grades?: number[] | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          priority?: string | null
          target_curricula?: string[] | null
          target_grades?: number[] | null
          title?: string
        }
        Relationships: []
      }
      upcoming_events: {
        Row: {
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          event_type: string
          id: string
          is_online: boolean | null
          location: string | null
          scheduled_date: string
          status: string | null
          subject_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          event_type: string
          id?: string
          is_online?: boolean | null
          location?: string | null
          scheduled_date: string
          status?: string | null
          subject_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          event_type?: string
          id?: string
          is_online?: boolean | null
          location?: string | null
          scheduled_date?: string
          status?: string | null
          subject_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upcoming_events_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lesson_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          lesson_id: string
          position: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          lesson_id: string
          position?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          lesson_id?: string
          position?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lesson_comments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "pre_generated_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lesson_highlights: {
        Row: {
          color: string | null
          created_at: string | null
          end_offset: number
          highlighted_text: string
          id: string
          lesson_id: string
          start_offset: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          end_offset: number
          highlighted_text: string
          id?: string
          lesson_id: string
          start_offset: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          end_offset?: number
          highlighted_text?: string
          id?: string
          lesson_id?: string
          start_offset?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lesson_highlights_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "pre_generated_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lesson_notes: {
        Row: {
          content: string
          created_at: string | null
          highlight_id: string | null
          id: string
          lesson_id: string
          section_reference: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          highlight_id?: string | null
          id?: string
          lesson_id: string
          section_reference?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          highlight_id?: string | null
          id?: string
          lesson_id?: string
          section_reference?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lesson_notes_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "user_lesson_highlights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "pre_generated_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_points: {
        Row: {
          created_at: string | null
          current_streak: number | null
          id: string
          last_activity_date: string | null
          level: number | null
          longest_streak: number | null
          total_points: number | null
          updated_at: string | null
          user_id: string
          xp_to_next_level: number | null
        }
        Insert: {
          created_at?: string | null
          current_streak?: number | null
          id?: string
          last_activity_date?: string | null
          level?: number | null
          longest_streak?: number | null
          total_points?: number | null
          updated_at?: string | null
          user_id: string
          xp_to_next_level?: number | null
        }
        Update: {
          created_at?: string | null
          current_streak?: number | null
          id?: string
          last_activity_date?: string | null
          level?: number | null
          longest_streak?: number | null
          total_points?: number | null
          updated_at?: string | null
          user_id?: string
          xp_to_next_level?: number | null
        }
        Relationships: []
      }
      user_rewards: {
        Row: {
          claimed_at: string | null
          created_at: string
          id: string
          redemption_code: string | null
          reward_id: string
          status: Database["public"]["Enums"]["user_reward_status"]
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          redemption_code?: string | null
          reward_id: string
          status?: Database["public"]["Enums"]["user_reward_status"]
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          redemption_code?: string | null
          reward_id?: string
          status?: Database["public"]["Enums"]["user_reward_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subjects: {
        Row: {
          created_at: string | null
          id: string
          subject_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      whiteboards: {
        Row: {
          canvas_data: Json | null
          created_at: string | null
          id: string
          is_shared: boolean | null
          subject_id: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          canvas_data?: Json | null
          created_at?: string | null
          id?: string
          is_shared?: boolean | null
          subject_id?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          canvas_data?: Json | null
          created_at?: string | null
          id?: string
          is_shared?: boolean | null
          subject_id?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whiteboards_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      chat_history: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string | null
          id: string | null
          role: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_upload_document: { Args: { p_user_id: string }; Returns: boolean }
      can_upload_file: {
        Args: { p_file_size: number; p_user_id: string }
        Returns: boolean
      }
      can_use_ai: { Args: { p_user_id: string }; Returns: boolean }
      clear_user_storage: { Args: { p_user_id: string }; Returns: undefined }
      estimate_message_size: { Args: { p_content: string }; Returns: number }
      get_remaining_ai_tokens: { Args: { p_user_id: string }; Returns: number }
      get_storage_percentage: { Args: { p_user_id: string }; Returns: number }
      get_user_tier: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ai_token_usage: {
        Args: { p_tokens: number; p_user_id: string }
        Returns: number
      }
      increment_ai_usage: { Args: { p_user_id: string }; Returns: number }
      update_storage_on_chat_message: {
        Args: { p_message_content: string; p_user_id: string }
        Returns: undefined
      }
      update_storage_on_document_delete: {
        Args: { p_file_size: number; p_user_id: string }
        Returns: undefined
      }
      update_storage_on_document_upload: {
        Args: { p_file_size: number; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "student"
      curriculum_type: "CAPS" | "IEB" | "Cambridge"
      reward_type: "discount" | "affiliate_link" | "custom_benefit"
      subscription_tier: "free" | "tier1" | "tier2"
      user_reward_status: "available" | "claimed" | "redeemed"
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
      app_role: ["admin", "moderator", "student"],
      curriculum_type: ["CAPS", "IEB", "Cambridge"],
      reward_type: ["discount", "affiliate_link", "custom_benefit"],
      subscription_tier: ["free", "tier1", "tier2"],
      user_reward_status: ["available", "claimed", "redeemed"],
    },
  },
} as const
