-- Monday Weekly Logistics Confirmation: one record per project per week.
CREATE TABLE weekly_logistics_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by_label text NOT NULL
);

CREATE UNIQUE INDEX idx_weekly_logistics_reviews_project_week
  ON weekly_logistics_reviews (project_id, week_start_date);

COMMENT ON TABLE weekly_logistics_reviews IS 'Monday weekly logistics check; one per project per week.';
