-- Migration: Add pre-registration automation
-- Path: supabase/migrations/20260326105500_add_pre_registration_automation.sql

-- 1. Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage settings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_settings' AND policyname = 'Admins can manage system_settings'
    ) THEN
        CREATE POLICY "Admins can manage system_settings"
        ON public.system_settings
        FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_id = auth.uid()
                AND role = 'admin'
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_settings' AND policyname = 'Everyone can read system_settings'
    ) THEN
        CREATE POLICY "Everyone can read system_settings"
        ON public.system_settings
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;

-- Initial setting
INSERT INTO public.system_settings (key, value)
VALUES ('pre_registration_mode', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Add columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pre_registered BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pre_registered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pre_registered_trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pre_registered_trial_used BOOLEAN DEFAULT FALSE;

-- 3. Update handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    user_initials, 
    pre_registered, 
    pre_registered_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), 2)),
    COALESCE((NEW.raw_user_meta_data ->> 'pre_registered')::boolean, false),
    CASE WHEN (NEW.raw_user_meta_data ->> 'pre_registered')::boolean = true THEN NOW() ELSE NULL END
  );
  
  -- Assign default student role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;

-- 4. Create trigger for automated trial grant on login
CREATE OR REPLACE FUNCTION public.handle_pre_registration_trial()
RETURNS TRIGGER AS $$
DECLARE
    is_pre_reg_mode BOOLEAN;
BEGIN
    -- Only act if last_login_at has changed (meaning a new login session)
    IF NEW.last_login_at IS DISTINCT FROM OLD.last_login_at AND NEW.last_login_at IS NOT NULL THEN
        
        -- Check if pre-registration mode is still ON
        SELECT (value->>'enabled')::boolean INTO is_pre_reg_mode 
        FROM public.system_settings 
        WHERE key = 'pre_registration_mode';

        -- If launch has happened (pre_reg_mode = false) and user is pre-registered and hasn't used trial
        IF (is_pre_reg_mode IS FALSE OR is_pre_reg_mode IS NULL) 
           AND NEW.pre_registered = TRUE 
           AND NEW.pre_registered_trial_used = FALSE THEN
            
            -- Grant 7 days of premium
            INSERT INTO public.subscriptions (user_id, tier, status, trial_ends_at)
            VALUES (NEW.user_id, 'tier2', 'active', NOW() + INTERVAL '7 days')
            ON CONFLICT (user_id) DO UPDATE
            SET tier = 'tier2', 
                status = 'active', 
                trial_ends_at = NOW() + INTERVAL '7 days'
            WHERE subscriptions.tier = 'free';

            -- Mark as used
            NEW.pre_registered_trial_used := TRUE;
            NEW.pre_registered_trial_started_at := NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to profiles
DROP TRIGGER IF EXISTS on_profile_login_trial ON public.profiles;
CREATE TRIGGER on_profile_login_trial
    BEFORE UPDATE OF last_login_at ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_pre_registration_trial();
