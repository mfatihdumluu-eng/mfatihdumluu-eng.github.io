CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS branches (id serial PRIMARY KEY, name text NOT NULL UNIQUE, address text);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE, name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('branch','admin','system')),
  branch_id integer REFERENCES branches(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role='branch' AND branch_id IS NOT NULL) OR (role<>'branch' AND branch_id IS NULL))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  kvk text, vat_id text, email text, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS brands (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ean text UNIQUE, name text NOT NULL,
  brand_id uuid REFERENCES brands(id), unit text NOT NULL DEFAULT 'piece',
  package_multiplier numeric(14,4) NOT NULL DEFAULT 1 CHECK(package_multiplier>0)
);
CREATE TABLE IF NOT EXISTS supplier_skus (
  supplier_id uuid NOT NULL REFERENCES suppliers(id), supplier_sku text NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id), PRIMARY KEY(supplier_id,supplier_sku)
);
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  branch_id integer NOT NULL REFERENCES branches(id),
  invoice_number text NOT NULL, invoice_date date NOT NULL,
  document_path text, document_hash text,
  status text NOT NULL DEFAULT 'review' CHECK(status IN ('review','approved','disputed','cancelled')),
  created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id,invoice_number,branch_id)
);
CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id), raw_description text NOT NULL,
  raw_ean text, raw_sku text,
  quantity numeric(14,4) NOT NULL CHECK(quantity>0),
  unit_net numeric(14,4) NOT NULL CHECK(unit_net>=0),
  vat_rate numeric(6,3) NOT NULL DEFAULT 0,
  discount_net numeric(14,4) NOT NULL DEFAULT 0,
  normalized_quantity numeric(14,4),
  normalized_net_price numeric(14,4),
  CHECK(normalized_quantity IS NULL OR normalized_quantity>0)
);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_month ON invoices(supplier_id,invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_branch_date ON invoices(branch_id,invoice_date);
CREATE INDEX IF NOT EXISTS idx_lines_product ON invoice_lines(product_id);
CREATE TABLE IF NOT EXISTS agreed_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id uuid NOT NULL REFERENCES suppliers(id),
  branch_id integer REFERENCES branches(id), product_id uuid NOT NULL REFERENCES products(id),
  net_unit_price numeric(14,4) NOT NULL, minimum_quantity numeric(14,4) NOT NULL DEFAULT 0,
  valid_from date NOT NULL, valid_to date, CHECK(valid_to IS NULL OR valid_to>=valid_from)
);
CREATE TABLE IF NOT EXISTS findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_line_id uuid NOT NULL REFERENCES invoice_lines(id),
  category text NOT NULL, reference_net_price numeric(14,4),
  observed_net_price numeric(14,4), amount numeric(14,4), evidence jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK(status IN('open','verified','dismissed','resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id uuid NOT NULL REFERENCES suppliers(id),
  invoice_id uuid REFERENCES invoices(id), subject text NOT NULL, body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','approved','sent','resolved','cancelled')),
  approved_by uuid REFERENCES users(id), sent_at timestamptz,
  created_by uuid REFERENCES users(id), created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dispute_id uuid REFERENCES disputes(id),
  supplier_id uuid REFERENCES suppliers(id), credit_number text NOT NULL,
  amount numeric(14,2) NOT NULL, received_at date NOT NULL,
  UNIQUE (supplier_id,credit_number)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY, actor_id uuid REFERENCES users(id), action text NOT NULL,
  target_type text NOT NULL, target_id text, details jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
