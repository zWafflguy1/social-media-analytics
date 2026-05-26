export type DealStatus =
  | 'sourced' | 'scored' | 'qualified' | 'matching'
  | 'funding' | 'diligence' | 'won' | 'lost' | 'dead';

export type MatchStatus =
  | 'queued' | 'approved' | 'rejected' | 'sent' | 'responded' | 'passed';

export type LoanAppStatus =
  | 'drafted' | 'approved' | 'submitted' | 'underwriting'
  | 'offered' | 'accepted' | 'declined' | 'withdrawn';

export type FundingStatus = 'verbal' | 'LOI' | 'term-sheet' | 'committed' | 'funded';

export type AgentName =
  | 'deal-scout' | 'capital-matcher' | 'debt-architect' | 'portfolio-cfo';

export type Deal = {
  id: number;
  source: string;
  source_url: string | null;
  source_ref: string | null;
  title: string;
  description: string | null;
  industry: string | null;
  location: string | null;
  asking_price: number | null;       // cents
  sde: number | null;
  ebitda: number | null;
  revenue: number | null;
  cash_flow: number | null;
  employees: number | null;
  established_year: number | null;
  reason_for_sale: string | null;
  absentee_signal: number;
  posted_at: number | null;
  scraped_at: number;
  raw: string | null;
  score: number | null;
  score_reasoning: string | null;
  status: DealStatus;
  notes: string | null;
};

export type Investor = {
  id: number;
  name: string;
  type: string | null;
  focus_sectors: string | null;
  check_size_min: number | null;
  check_size_max: number | null;
  geography: string | null;
  thesis: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_url: string | null;
  source_url: string | null;
  enrichment: string | null;
  last_contacted_at: number | null;
  created_at: number;
  notes: string | null;
};

export type Lender = {
  id: number;
  name: string;
  type: string;
  products: string | null;
  sba_preferred: number;
  min_loan: number | null;
  max_loan: number | null;
  industries_focus: string | null;
  industries_avoid: string | null;
  geography: string | null;
  typical_rate: string | null;
  contact_url: string | null;
  notes: string | null;
  created_at: number;
};

export type Match = {
  id: number;
  deal_id: number;
  investor_id: number;
  match_score: number;
  match_reasoning: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  status: MatchStatus;
  queued_at: number;
  approved_by: string | null;
  approved_at: number | null;
  sent_at: number | null;
  response_at: number | null;
  response_note: string | null;
};

export type LoanApplication = {
  id: number;
  deal_id: number;
  lender_id: number;
  product: string;
  requested_amount: number | null;
  term_months: number | null;
  fit_score: number | null;
  fit_reasoning: string | null;
  package_md: string | null;
  package_pdf: string | null;
  status: LoanAppStatus;
  created_at: number;
  submitted_at: number | null;
  decision_at: number | null;
  decision_note: string | null;
};

export type RiskAlert = {
  id: number;
  deal_id: number | null;
  severity: 'info' | 'warn' | 'critical';
  category: string;
  message: string;
  created_at: number;
  resolved_at: number | null;
  resolution_note: string | null;
};
