-- Phase 0.2 — Funksiyalarga search_path qo'shish (injection himoyasi)
-- Har bir funksiya DEFINITION'i o'zgarmaydi, faqat SET search_path qo'shiladi.
-- public    — audit_logs, bot_states, tib_id_seq jadval/sequence'lari uchun
-- pg_catalog — NOW(), nextval(), gen_random_uuid(), LPAD() system funksiyalari uchun

-- 1. next_tib_id (SQL function)
CREATE OR REPLACE FUNCTION public.next_tib_id()
RETURNS text
LANGUAGE sql
SET search_path = public, pg_catalog
AS $function$
  SELECT 'tib' || LPAD(nextval('tib_id_seq')::TEXT, 6, '0');
$function$;

-- 2. generate_tib_id (plpgsql)
CREATE OR REPLACE FUNCTION public.generate_tib_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE
  next_num BIGINT;
BEGIN
  next_num := nextval('tib_id_seq');
  -- 6 xonali zero-padded format. 999999'dan oshsa, avtomatik 7 xonali bo'ladi
  RETURN 'tib' || LPAD(next_num::TEXT, 6, '0');
END;
$function$;

-- 3. assign_tib_id_on_insert (trigger)
CREATE OR REPLACE FUNCTION public.assign_tib_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
BEGIN
  IF NEW."tibId" IS NULL THEN
    NEW."tibId" := generate_tib_id();
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. cleanup_expired_bot_states
CREATE OR REPLACE FUNCTION public.cleanup_expired_bot_states()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM bot_states WHERE "expiresAt" < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

-- 5. update_bot_states_updated_at (trigger)
CREATE OR REPLACE FUNCTION public.update_bot_states_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
BEGIN
  NEW."updatedAt" := NOW();
  -- Har yangilanishda TTL ni 30 daqiqaga uzaytirish
  NEW."expiresAt" := NOW() + INTERVAL '30 minutes';
  RETURN NEW;
END;
$function$;

-- 6. log_audit_event (SECURITY DEFINER trigger — Phase 0.1 dan REVOKE allaqachon qo'shilgan)
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_actor_id TEXT;
  v_clinic_id TEXT;
  v_payload JSONB;
BEGIN
  -- Actor ID ni session settings'dan ol (backend SET LOCAL bilan o'rnatadi)
  BEGIN
    v_actor_id := current_setting('app.actor_id', true);
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  IF v_actor_id IS NULL OR v_actor_id = '' THEN
    v_actor_id := 'system';
  END IF;

  -- Clinic ID ni rowdan olish (agar jadval clinicId ga ega bo'lsa)
  IF TG_OP = 'DELETE' THEN
    BEGIN
      v_clinic_id := OLD."clinicId";
    EXCEPTION WHEN OTHERS THEN
      v_clinic_id := NULL;
    END;
    v_payload := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    BEGIN
      v_clinic_id := NEW."clinicId";
    EXCEPTION WHEN OTHERS THEN
      v_clinic_id := NULL;
    END;
    v_payload := jsonb_build_object('new', to_jsonb(NEW));
  ELSE -- UPDATE
    BEGIN
      v_clinic_id := NEW."clinicId";
    EXCEPTION WHEN OTHERS THEN
      v_clinic_id := NULL;
    END;
    v_payload := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  END IF;

  INSERT INTO public.audit_logs (id, "actorId", "clinicId", action, payload, "createdAt")
  VALUES (
    gen_random_uuid()::text,
    v_actor_id,
    v_clinic_id,
    TG_OP || ':' || TG_TABLE_NAME,
    v_payload,
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;
