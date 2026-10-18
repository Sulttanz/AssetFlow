COMMENT ON TABLE public.tickets IS
  'Archived legacy ticket source after migration to incidents and service_requests. Retained for historical reporting and relationships; new writes belong in the dedicated practice tables.';

INSERT INTO public.change_risk_links (change_request_id, risk_id)
SELECT change_id, id
FROM public.risk_register
WHERE change_id IS NOT NULL
ON CONFLICT (change_request_id, risk_id) DO NOTHING;
