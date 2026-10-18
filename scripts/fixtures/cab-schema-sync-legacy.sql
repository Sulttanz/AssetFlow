-- Base public-schema objects expected by the later legacy-data migrations.
CREATE TABLE public.users (id varchar PRIMARY KEY);
CREATE TABLE public.changes (id varchar PRIMARY KEY);
CREATE TABLE public.assets (id varchar PRIMARY KEY);
CREATE TABLE public.catalog_items (id varchar PRIMARY KEY);

CREATE TABLE public.tickets (
  id varchar PRIMARY KEY,
  ticket_number text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  type text NOT NULL,
  urgency text,
  impact text,
  priority text,
  status text,
  category text,
  assigned_to_id varchar,
  requester_id varchar,
  asset_id varchar,
  sla_response_due_at timestamp,
  sla_resolution_due_at timestamp,
  first_responded_at timestamp,
  resolved_at timestamp,
  resolution_code text,
  created_at timestamp,
  updated_at timestamp,
  catalog_item_id varchar,
  due_date date
);
CREATE TABLE public.ticket_comments (ticket_id varchar NOT NULL);
CREATE TABLE public.ticket_attachments (ticket_id varchar NOT NULL);
CREATE TABLE public.problem_incidents (ticket_id varchar NOT NULL);

CREATE TABLE public.risk_register (
  id varchar PRIMARY KEY,
  change_id varchar,
  impact integer,
  likelihood integer,
  risk_score integer NOT NULL DEFAULT 0
);
CREATE TABLE public.change_risk_links (
  change_request_id varchar NOT NULL,
  risk_id varchar NOT NULL,
  UNIQUE (change_request_id, risk_id)
);

INSERT INTO public.users (id) VALUES ('legacy-requester');
INSERT INTO public.changes (id) VALUES ('legacy-change');
INSERT INTO public.assets (id) VALUES ('legacy-asset');
INSERT INTO public.catalog_items (id) VALUES ('legacy-catalog-item');
INSERT INTO public.tickets (
  id, ticket_number, title, description, type, urgency, impact, priority, status,
  requester_id, asset_id, catalog_item_id, created_at, updated_at
) VALUES
  ('legacy-incident', 'INC-100', 'Legacy incident', 'Incident fixture', 'incident',
   'high', 'high', 'high', 'open', NULL, 'legacy-asset', NULL, now(), now()),
  ('legacy-service-request', 'REQ-100', 'Legacy request', 'Request fixture',
   'service_request', NULL, NULL, 'low', 'open', 'legacy-requester', NULL,
   'legacy-catalog-item', now(), now());
INSERT INTO public.ticket_comments (ticket_id) VALUES
  ('legacy-incident'),
  ('legacy-service-request');
INSERT INTO public.ticket_attachments (ticket_id) VALUES
  ('legacy-incident'),
  ('legacy-service-request');
INSERT INTO public.problem_incidents (ticket_id) VALUES ('legacy-incident');
INSERT INTO public.risk_register (id, change_id, impact, likelihood)
VALUES ('legacy-risk', 'legacy-change', 2, 3);
