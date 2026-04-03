-- Create a table for Handoff Reports
create table public.handoff_reports (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) not null,
  patient_id text not null, -- Store the textual ID for now (e.g. from MOCK_PATIENTS)
  patient_name text,
  shift_summary jsonb, -- Store the structure of the report (Assessment, Situation, etc.)
  status text check (status in ('draft', 'completed')) default 'draft'
);

-- Set up Row Level Security (RLS)
alter table public.handoff_reports enable row level security;

-- Policy: Users can view their own reports
create policy "Users can view their own reports"
  on public.handoff_reports for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own reports
create policy "Users can insert their own reports"
  on public.handoff_reports for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own reports
create policy "Users can update their own reports"
  on public.handoff_reports for update
  using (auth.uid() = user_id);

-- Create a table for Patients
create table public.patients (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  bed text not null,
  name text not null,
  dni text not null,
  hc text not null,
  acuity text not null,
  dob text,
  admit_date text default to_char(now(), 'DD Mon, YYYY'),
  weight numeric default 70,
  allergies text[] default '{}',
  isbar_status int default 1,
  last_validated text default 'Recién admitido',
  nurse text default 'Por asignar',
  nurse_avatar text,
  general_status text,
  status text check (status in ('active', 'discharged', 'deceased', 'transferred')) default 'active',
  outcome text,
  -- Nuevas columnas agregadas para soportar ClinicalHistory.tsx
  illness_duration text,
  symptoms text,
  onset text,
  anamnesis_text text,
  physical_exam jsonb default '{}'::jsonb,
  apache_score numeric,
  sofa_score numeric,
  charlson_score numeric
);



-- Set up RLS for Patients
alter table public.patients enable row level security;

-- Policy: Everyone (authenticated) can view patients (shared list)
create policy "Authenticated users can view patients"
  on public.patients for select
  to authenticated
  using (true);

-- Policy: Everyone (authenticated) can insert patients
create policy "Authenticated users can insert patients"
  on public.patients for insert
  to authenticated
  with check (true);

-- Policy: Everyone (authenticated) can update patients
create policy "Authenticated users can update patients"
  on public.patients for update
  to authenticated
  using (true)
  with check (true);

-- Create a table for Clinical Records (History/Evolution)
create table public.clinical_records (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  patient_id uuid references public.patients(id) not null,
  user_id uuid references auth.users(id) not null,
  note_type text not null, -- 'SOAP', 'Evolution', 'Procedure'
  content jsonb default '{}'::jsonb, -- Structured data: { subjective: '', objective: '', analysis: '', plan: '' }
  vitals jsonb default '{}'::jsonb -- Snapshot: { bp: '120/80', hr: 80, ... }
);

-- Add last_clinical_update to patients for Dashboard sync
alter table public.patients 
add column if not exists last_clinical_update timestamp with time zone;

-- RLS for Clinical Records
alter table public.clinical_records enable row level security;

create policy "Authenticated users can view clinical records"
  on public.clinical_records for select
  to authenticated
  using (true);

create policy "Authenticated users can insert clinical records"
  on public.clinical_records for insert
  to authenticated
  with check (auth.uid() = user_id);


-- Create a table for Interconsultations
create table public.interconsultations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Patient Data
  patient_name text not null,
  age int,
  sex text,
  hc text,
  service_origin text,
  bed_number text,
  
  -- Request Data
  reason text not null check (reason in ('procedimiento', 'evaluacion_pase', 'pcr', 'ustna')),
  procedure_type text, -- 'cvc', 'intubacion' (only if reason = 'procedimiento')
  
  -- CVC Specifics
  cvc_location text,
  cvc_attempts int,
  cvc_operators text,
  
  -- Evaluation & Pass Specifics
  health_problem_1 text,
  health_problem_2 text,
  priority text, -- '1', '2', '3', '4A', '4B'
  
  -- Response Data
  response_date timestamp with time zone,
  responders text, -- Doctors/Residents who responded
  
  status text check (status in ('pending', 'completed', 'admitted')) default 'pending'
);

-- RLS for Interconsultations
alter table public.interconsultations enable row level security;

create policy "Authenticated users can view interconsultations"
  on public.interconsultations for select
  to authenticated
  using (true);

create policy "Authenticated users can insert interconsultations"
  on public.interconsultations for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update interconsultations"
  on public.interconsultations for update
  to authenticated
  using (true);
