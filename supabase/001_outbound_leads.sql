-- ============================================================
-- NexusGate Outbound Lead Pipeline — Supabase Schema
-- ============================================================
-- Run this migration in your Supabase SQL Editor to add the
-- tables needed by the outbound lead generation pipeline.
-- ============================================================

-- All scraped and qualified leads
create table if not exists outbound_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  business_name text,
  owner_name text,
  email text not null unique,
  phone text,
  website text,
  business_type text,
  city text,
  google_rating numeric,
  review_count integer,
  source text,
  score integer,
  reasoning text,
  pain_point text,
  personalization_hook text,
  email_sent boolean default false,
  email_sent_at timestamptz,
  email_opened boolean default false,
  audit_completed boolean default false,
  call_booked boolean default false,
  converted boolean default false
);

-- Leads that didn't make the score cutoff
create table if not exists disqualified_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text,
  business_name text,
  business_type text,
  score integer,
  reasoning text
);

-- Enable RLS on both tables
alter table outbound_leads enable row level security;
alter table disqualified_leads enable row level security;

-- Allow service role full access (n8n uses service role key)
create policy "Service role full access to outbound_leads"
  on outbound_leads
  for all
  using (true)
  with check (true);

create policy "Service role full access to disqualified_leads"
  on disqualified_leads
  for all
  using (true)
  with check (true);

-- Allow anon inserts (for API routes)
create policy "Anon can insert into outbound_leads"
  on outbound_leads
  for insert
  with check (true);

create policy "Anon can insert into disqualified_leads"
  on disqualified_leads
  for insert
  with check (true);

-- Indexes for common queries
create index if not exists idx_outbound_leads_email on outbound_leads(email);
create index if not exists idx_outbound_leads_score on outbound_leads(score);
create index if not exists idx_outbound_leads_email_sent on outbound_leads(email_sent);
create index if not exists idx_outbound_leads_business_type on outbound_leads(business_type);
create index if not exists idx_outbound_leads_city on outbound_leads(city);
create index if not exists idx_outbound_leads_created_at on outbound_leads(created_at desc);

create index if not exists idx_disqualified_leads_email on disqualified_leads(email);
create index if not exists idx_disqualified_leads_score on disqualified_leads(score);
