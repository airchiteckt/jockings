-- Indici su pranks
CREATE INDEX IF NOT EXISTS idx_pranks_call_status_scheduled_at 
  ON public.pranks (call_status, scheduled_at) 
  WHERE call_status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_pranks_reveal_sms 
  ON public.pranks (reveal_sms_scheduled_at) 
  WHERE send_reveal_sms = true AND reveal_sms_sent = false;

CREATE INDEX IF NOT EXISTS idx_pranks_user_created 
  ON public.pranks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pranks_twilio_call_sid 
  ON public.pranks (twilio_call_sid) 
  WHERE twilio_call_sid IS NOT NULL;

-- Indici su call_queue
CREATE INDEX IF NOT EXISTS idx_call_queue_prank_id 
  ON public.call_queue (prank_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_queue_status 
  ON public.call_queue (status) 
  WHERE status IN ('queued', 'in_progress');

-- Indici su processed_payments
CREATE INDEX IF NOT EXISTS idx_processed_payments_session 
  ON public.processed_payments (session_id);

CREATE INDEX IF NOT EXISTS idx_processed_payments_user 
  ON public.processed_payments (user_id, created_at DESC);

-- Indici su prank_disclaimer_acceptances
CREATE INDEX IF NOT EXISTS idx_disclaimer_prank 
  ON public.prank_disclaimer_acceptances (prank_id);

CREATE INDEX IF NOT EXISTS idx_disclaimer_user 
  ON public.prank_disclaimer_acceptances (user_id);

-- Aggiorna statistiche del query planner
ANALYZE public.pranks;
ANALYZE public.call_queue;
ANALYZE public.processed_payments;
ANALYZE public.prank_disclaimer_acceptances;