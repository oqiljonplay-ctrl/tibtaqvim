-- Phase 0.1 — log_audit_event REST orqali chaqirilishini bloklash
-- SECURITY DEFINER funksiyasi sifatida saqlanadi (trigger uchun zarur),
-- lekin tashqi (PostgREST) chaqiruv huquqi olib tashlanadi.
-- Trigger'lar funksiyani DB ichidan chaqirgani uchun ular ishlayveradi.

REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM authenticated;

-- postgres rol DB owner sifatida saqlanadi — trigger ishlashi uchun zarur
-- service_role ham saqlanadi — backend ehtiyot uchun (lekin biz hech qachon to'g'ridan-to'g'ri chaqirmaymiz)

COMMENT ON FUNCTION public.log_audit_event() IS
  'Trigger function — DB ichidan chaqiriladi. PostgREST orqali chaqirish bloklangan (Phase 0.1).';
