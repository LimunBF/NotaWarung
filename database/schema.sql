-- Nota Warungku Database Schema
-- Supabase PostgreSQL

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: menu_items
CREATE TABLE menu_items (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'makanan' or 'minuman'
  price INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: notas (receipts)
CREATE TABLE notas (
  id BIGSERIAL PRIMARY KEY,
  nota_number VARCHAR(20) UNIQUE NOT NULL, -- e.g., "NOTA-001"
  customer_name VARCHAR(100),
  total_amount INTEGER NOT NULL,
  terbilang TEXT,
  kasir_name VARCHAR(100),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
  pdf_url TEXT,
  public_token UUID UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: nota_items (line items in each nota)
CREATE TABLE nota_items (
  id BIGSERIAL PRIMARY KEY,
  nota_id BIGINT REFERENCES notas(id) ON DELETE CASCADE,
  menu_item_id BIGINT REFERENCES menu_items(id),
  menu_name VARCHAR(100) NOT NULL, -- snapshot name at time of order
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: kasir (cashiers)
CREATE TABLE kasir (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  wa_number VARCHAR(20),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notas_created_at ON notas(created_at DESC);
CREATE INDEX idx_notas_status ON notas(status);
CREATE INDEX idx_nota_items_nota_id ON nota_items(nota_id);

-- Insert default menu items
INSERT INTO menu_items (name, category, price) VALUES
-- Makanan
('Sate Kambing', 'makanan', 45000),
('Sate Buntel', 'makanan', 45000),
('Tongseng Daging', 'makanan', 45000),
('Tongseng Jeroan', 'makanan', 45000),
('Tongseng Kaki', 'makanan', 45000),
('Tongseng Iga', 'makanan', 45000),
('Tongseng Sumsum', 'makanan', 45000),
('Tongseng Kepala/Lidah', 'makanan', 45000),
('Tengkleng', 'makanan', 45000),
('Gule', 'makanan', 35000),
('Nasi Putih', 'makanan', 5000),
('Nasi Gule', 'makanan', 18000),
('Sate Ayam', 'makanan', 23000),
('Tongseng Ayam', 'makanan', 23000),
('Kerupuk', 'makanan', 1000),
-- Minuman
('Es Jeruk', 'minuman', 7000),
('Es Jeruk Tawar', 'minuman', 7000),
('Jeruk Panas', 'minuman', 7000),
('Jeruk Panas Tawar', 'minuman', 7000),
('Es Teh', 'minuman', 5000),
('Teh Panas', 'minuman', 5000),
('Teh Panas Tawar', 'minuman', 5000),
('Es Teh Tawar', 'minuman', 2000),
('Kopi', 'minuman', 5000),
('Air Mineral', 'minuman', 5000),
('Cleo', 'minuman', 2000);

-- Insert default kasir (owner)
INSERT INTO kasir (name, wa_number) VALUES ('Owner', '082234888689');

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notas_updated_at BEFORE UPDATE ON notas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)

-- Enable RLS
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_items ENABLE ROW LEVEL SECURITY;

-- Policy: anon can view nota by public_token
CREATE POLICY "anon can view nota by token" ON notas
 FOR SELECT USING (public_token IS NOT NULL);

CREATE POLICY "anon can view items by token" ON nota_items
 FOR SELECT USING (EXISTS (
 SELECT 1 FROM notas WHERE notas.id = nota_items.nota_id AND notas.public_token IS NOT NULL
 ));

-- Policy: service_role full access
CREATE POLICY "service_role full access" ON notas
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "service_role can do anything" ON nota_items
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Force Row Level Security
ALTER TABLE notas FORCE ROW LEVEL SECURITY;
ALTER TABLE nota_items FORCE ROW LEVEL SECURITY;
