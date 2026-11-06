CREATE TABLE IF NOT EXISTS assignment_groups (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS assignment_groups_name_ci_uq
  ON assignment_groups (lower(btrim(name)));
CREATE INDEX IF NOT EXISTS assignment_groups_active_name_idx
  ON assignment_groups (active, name);

CREATE TABLE IF NOT EXISTS assignment_group_members (
  id serial PRIMARY KEY,
  group_id integer NOT NULL REFERENCES assignment_groups(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS assignment_group_members_group_user_uq
  ON assignment_group_members (group_id, user_id);
CREATE INDEX IF NOT EXISTS assignment_group_members_user_idx
  ON assignment_group_members (user_id, group_id);
