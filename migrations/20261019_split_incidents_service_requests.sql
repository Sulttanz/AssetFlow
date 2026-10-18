CREATE TABLE IF NOT EXISTS public.incidents (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  urgency text NOT NULL DEFAULT 'medium',
  impact text NOT NULL DEFAULT 'medium',
  priority text NOT NULL DEFAULT 'P3',
  status text NOT NULL DEFAULT 'New',
  category text,
  assigned_to_id varchar REFERENCES public.users(id) ON DELETE SET NULL,
  requester_id varchar REFERENCES public.users(id) ON DELETE SET NULL,
  asset_id varchar REFERENCES public.assets(id) ON DELETE SET NULL,
  change_request_id varchar REFERENCES public.changes(id) ON DELETE SET NULL,
  response_due_at timestamp,
  resolve_due_at timestamp,
  first_responded_at timestamp,
  resolved_at timestamp,
  resolution_code text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  catalog_item_id varchar REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  requester_id varchar NOT NULL REFERENCES public.users(id),
  fulfillment_status text NOT NULL DEFAULT 'Submitted',
  approval_status text NOT NULL DEFAULT 'pending',
  cost real NOT NULL DEFAULT 0,
  fulfilled_asset_id varchar REFERENCES public.assets(id) ON DELETE SET NULL,
  target_fulfillment_date date,
  fulfillment_due_at timestamp,
  category text,
  assigned_to_id varchar REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incidents_status_priority_idx ON public.incidents(status, priority);
CREATE INDEX IF NOT EXISTS incidents_assigned_to_idx ON public.incidents(assigned_to_id);
CREATE INDEX IF NOT EXISTS service_requests_status_idx ON public.service_requests(fulfillment_status);
CREATE INDEX IF NOT EXISTS service_requests_requester_idx ON public.service_requests(requester_id);

ALTER TABLE public.ticket_comments
  ADD COLUMN IF NOT EXISTS incident_id varchar REFERENCES public.incidents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS service_request_id varchar REFERENCES public.service_requests(id) ON DELETE CASCADE;
ALTER TABLE public.ticket_attachments
  ADD COLUMN IF NOT EXISTS incident_id varchar REFERENCES public.incidents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS service_request_id varchar REFERENCES public.service_requests(id) ON DELETE CASCADE;
ALTER TABLE public.problem_incidents
  ADD COLUMN IF NOT EXISTS incident_id varchar REFERENCES public.incidents(id) ON DELETE CASCADE;

INSERT INTO public.incidents (
  id, incident_number, title, description, urgency, impact, priority, status,
  category, assigned_to_id, requester_id, asset_id, response_due_at, resolve_due_at,
  first_responded_at, resolved_at, resolution_code, created_at, updated_at
)
SELECT
  t.id, t.ticket_number, t.title, t.description,
  COALESCE(t.urgency, 'medium'), COALESCE(t.impact, 'medium'),
  CASE lower(t.priority)
    WHEN 'critical' THEN 'P1'
    WHEN 'high' THEN 'P2'
    WHEN 'medium' THEN 'P3'
    ELSE 'P4'
  END,
  CASE lower(t.status)
    WHEN 'in_progress' THEN 'In Progress'
    WHEN 'resolved' THEN 'Resolved'
    WHEN 'closed' THEN 'Closed'
    ELSE 'New'
  END,
  t.category, t.assigned_to_id, t.requester_id, t.asset_id,
  t.sla_response_due_at, t.sla_resolution_due_at, t.first_responded_at,
  t.resolved_at, t.resolution_code, t.created_at, t.updated_at
FROM public.tickets t
WHERE lower(t.type) = 'incident'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_requests (
  id, request_number, title, description, catalog_item_id, requester_id,
  fulfillment_status, approval_status, cost, fulfilled_asset_id,
  target_fulfillment_date, category, assigned_to_id, created_at, updated_at
)
SELECT
  t.id, t.ticket_number, t.title, t.description, t.catalog_item_id, t.requester_id,
  CASE lower(t.status)
    WHEN 'in_progress' THEN 'Fulfilling'
    WHEN 'resolved' THEN 'Completed'
    WHEN 'closed' THEN 'Completed'
    ELSE 'Submitted'
  END,
  CASE lower(t.status)
    WHEN 'open' THEN 'pending'
    ELSE 'approved'
  END,
  0, t.asset_id, t.due_date, t.category, t.assigned_to_id, t.created_at, t.updated_at
FROM public.tickets t
WHERE lower(t.type) IN ('request', 'service_request')
ON CONFLICT (id) DO NOTHING;

UPDATE public.ticket_comments c
SET incident_id = t.id
FROM public.tickets t
WHERE c.ticket_id = t.id AND lower(t.type) = 'incident' AND c.incident_id IS NULL;
UPDATE public.ticket_comments c
SET service_request_id = t.id
FROM public.tickets t
WHERE c.ticket_id = t.id AND lower(t.type) IN ('request', 'service_request') AND c.service_request_id IS NULL;

UPDATE public.ticket_attachments a
SET incident_id = t.id
FROM public.tickets t
WHERE a.ticket_id = t.id AND lower(t.type) = 'incident' AND a.incident_id IS NULL;
UPDATE public.ticket_attachments a
SET service_request_id = t.id
FROM public.tickets t
WHERE a.ticket_id = t.id AND lower(t.type) IN ('request', 'service_request') AND a.service_request_id IS NULL;

UPDATE public.problem_incidents pi
SET incident_id = t.id
FROM public.tickets t
WHERE pi.ticket_id = t.id AND lower(t.type) = 'incident' AND pi.incident_id IS NULL;
