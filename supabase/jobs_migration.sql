-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists jobs (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Listing fields
  title            text not null,
  dept             text not null,
  location         text not null default 'Remote',
  type             text not null default 'Full-time',
  is_active        boolean not null default true,

  -- Detail page fields
  summary          text,
  responsibilities text[],   -- array of strings
  requirements     text[],   -- array of strings
  nice_to_have     text[]    -- array of strings
);

-- Keep updated_at current automatically
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_updated_at
  before update on jobs
  for each row execute function set_updated_at();

-- Indexes
create index if not exists jobs_dept_idx      on jobs (dept);
create index if not exists jobs_is_active_idx on jobs (is_active);

-- Seed with the existing hardcoded jobs so nothing breaks on day one
insert into jobs (title, dept, location, type, summary, responsibilities, requirements, nice_to_have) values
(
  'Senior Backend Engineer', 'Engineering', 'Remote', 'Full-time',
  'We''re looking for a Senior Backend Engineer to own the core infrastructure that millions of users depend on.',
  array[
    'Design and build high-throughput APIs and microservices',
    'Own reliability and performance of core backend systems',
    'Define architecture standards and review team PRs',
    'Collaborate with product to scope technical feasibility',
    'Mentor junior engineers and grow the team''s craft'
  ],
  array[
    '5+ years of backend engineering experience',
    'Deep expertise in one of: Go, Rust, Node.js, or Python',
    'Experience designing distributed systems at scale',
    'Strong understanding of SQL and NoSQL databases',
    'Track record of shipping reliable production systems'
  ],
  array['Experience with Kubernetes and cloud infrastructure','Open source contributions','Startup experience']
),
(
  'Staff Frontend Engineer', 'Engineering', 'Remote', 'Full-time',
  'We''re hiring a Staff Frontend Engineer to lead our client-side architecture and raise the bar on UI quality.',
  array[
    'Own the frontend architecture and component library',
    'Drive performance, accessibility, and quality standards',
    'Partner with design to build pixel-perfect experiences',
    'Review PRs and mentor frontend engineers'
  ],
  array[
    '6+ years of frontend engineering experience',
    'Deep expertise in React and modern JS/TS',
    'Strong eye for UI quality and performance',
    'Experience with design systems'
  ],
  array['Experience with SSR frameworks (Next.js)','Open source contributions']
),
(
  'Machine Learning Engineer', 'Engineering', 'Remote', 'Full-time',
  'Join our ML team to build and ship models that directly impact the product.',
  array[
    'Design and train production ML models',
    'Build data pipelines and evaluation frameworks',
    'Collaborate with product on ML-driven features',
    'Monitor and improve model performance over time'
  ],
  array[
    '3+ years of ML engineering experience',
    'Proficiency in Python and ML frameworks (PyTorch, TensorFlow)',
    'Experience taking models from research to production',
    'Strong understanding of statistics and ML fundamentals'
  ],
  array['Experience with LLMs and prompt engineering','MLOps experience']
),
(
  'DevOps / Platform Engineer', 'Engineering', 'Remote', 'Full-time',
  'We need a Platform Engineer to build and maintain the infrastructure that keeps everything running.',
  array[
    'Manage cloud infrastructure (AWS/GCP) with IaC',
    'Build and maintain CI/CD pipelines',
    'Drive reliability, observability, and incident response',
    'Help engineers ship faster and safer'
  ],
  array[
    '4+ years of DevOps or platform engineering experience',
    'Strong Kubernetes and Docker experience',
    'Infrastructure-as-code with Terraform or Pulumi',
    'Experience with observability tooling (Datadog, Grafana)'
  ],
  array['Security and compliance experience','FinOps / cloud cost optimization']
),
(
  'Product Manager, Core Platform', 'Product', 'Remote', 'Full-time',
  'Own the roadmap for our core platform — the foundation everything else is built on.',
  array[
    'Define and drive the platform product strategy',
    'Work closely with engineering to prioritize technical investments',
    'Align stakeholders across teams on platform direction',
    'Measure success through clear metrics and outcomes'
  ],
  array[
    '4+ years of product management experience',
    'Experience with platform or developer-facing products',
    'Strong analytical and communication skills',
    'Ability to translate technical complexity into clear plans'
  ],
  array['Engineering background','Experience at a developer tools company']
),
(
  'Product Manager, Growth', 'Product', 'Remote', 'Full-time',
  'Drive user acquisition, activation, and retention through data-informed product decisions.',
  array[
    'Own the growth product roadmap',
    'Run A/B experiments and interpret results',
    'Work with marketing and data teams on funnel optimization',
    'Identify and remove friction from the user journey'
  ],
  array[
    '3+ years of growth PM experience',
    'Strong data fluency — comfortable in SQL and analytics tools',
    'Experience running structured experiments',
    'User empathy and strong product instincts'
  ],
  array['Experience at a B2C SaaS company','Familiarity with growth loops']
),
(
  'Senior Product Designer', 'Design', 'Remote', 'Full-time',
  'Shape the look, feel, and experience of a product used by people who care about quality.',
  array[
    'Own end-to-end design for key product areas',
    'Conduct user research and turn insights into designs',
    'Collaborate with engineering to ship with high fidelity',
    'Contribute to and evolve the design system'
  ],
  array[
    '5+ years of product design experience',
    'Strong Figma skills and interaction design chops',
    'Portfolio showing complex, polished product work',
    'Ability to design at both a systems and detail level'
  ],
  array['Motion design experience','Experience at a B2B SaaS company']
),
(
  'Design Systems Engineer', 'Design', 'Remote', 'Full-time',
  'Build the component library and design system that every product team relies on.',
  array[
    'Build and maintain a React component library',
    'Partner with designers to translate tokens into code',
    'Write documentation and usage guidelines',
    'Ensure accessibility across all components'
  ],
  array[
    '4+ years of frontend engineering experience',
    'Strong React and CSS expertise',
    'Experience building or contributing to design systems',
    'Passion for accessibility and visual detail'
  ],
  array['Storybook and design token experience','Open source contributions']
),
(
  'Head of Content Marketing', 'Marketing', 'Remote', 'Full-time',
  'Lead our content strategy to drive awareness, trust, and organic growth.',
  array[
    'Own the content roadmap across blog, docs, and social',
    'Hire and manage a small team of writers',
    'Collaborate with product and sales on content that converts',
    'Build SEO-driven content programs'
  ],
  array[
    '6+ years of content marketing experience',
    'Proven track record of growing organic traffic',
    'Strong writing and editing skills',
    'Experience managing a content team'
  ],
  array['B2B SaaS experience','Developer audience experience']
),
(
  'Performance Marketing Manager', 'Marketing', 'Remote', 'Full-time',
  'Own paid acquisition across channels and drive efficient growth.',
  array[
    'Manage and optimize paid campaigns (Google, LinkedIn, Meta)',
    'Own CAC and ROAS targets',
    'Run experiments to improve ad creative and landing pages',
    'Build attribution models and reporting'
  ],
  array[
    '4+ years of performance marketing experience',
    'Hands-on experience managing paid budgets at scale',
    'Strong analytical skills and data fluency',
    'Experience with attribution and conversion tracking'
  ],
  array['B2B SaaS experience','Experience with product-led growth']
),
(
  'Customer Success Manager', 'Operations', 'Remote', 'Full-time',
  'Be the face of the company for our most important customers.',
  array[
    'Own onboarding and ongoing success for a portfolio of accounts',
    'Identify expansion opportunities and risks',
    'Work with product to surface customer feedback',
    'Build playbooks and processes that scale'
  ],
  array[
    '3+ years of customer success experience',
    'Experience with B2B SaaS products',
    'Strong communication and relationship-building skills',
    'Data-driven approach to measuring customer health'
  ],
  array['Technical background or experience with technical customers','Experience with Salesforce or HubSpot']
),
(
  'Finance & Accounting Lead', 'Operations', 'Remote', 'Full-time',
  'Build the financial foundation that supports our growth and keeps us compliant.',
  array[
    'Own FP&A, reporting, and financial operations',
    'Manage bookkeeping, payroll, and vendor payments',
    'Support fundraising with models and due diligence',
    'Build scalable financial processes'
  ],
  array[
    '5+ years of finance or accounting experience',
    'Strong Excel/Sheets and financial modeling skills',
    'Experience at a startup or high-growth company',
    'CPA or equivalent preferred'
  ],
  array['Experience with international payroll','Familiarity with SaaS metrics (ARR, churn, LTV)']
);
