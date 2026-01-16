-- PostgreSQL MCP Server Database Initialization
-- This script sets up the database for the MCP server

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_buffercache;

-- Create a monitoring user (optional, for enhanced monitoring)
-- GRANT pg_monitor TO postgres;

-- Set up basic tables for testing (optional)
-- Uncomment the following lines if you want sample data

/*
-- Sample marketing portal tables
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    campaign_id INTEGER REFERENCES campaigns(id),
    status VARCHAR(50) DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO campaigns (name, description, status) VALUES
    ('Summer Sale 2024', 'Summer promotion campaign', 'active'),
    ('Newsletter Signup', 'Monthly newsletter campaign', 'active'),
    ('Product Launch', 'New product announcement', 'draft')
ON CONFLICT DO NOTHING;

INSERT INTO leads (email, first_name, last_name, campaign_id, status) VALUES
    ('john.doe@example.com', 'John', 'Doe', 1, 'qualified'),
    ('jane.smith@example.com', 'Jane', 'Smith', 2, 'new'),
    ('bob.wilson@example.com', 'Bob', 'Wilson', 1, 'contacted')
ON CONFLICT DO NOTHING;
*/

-- Create indexes for better performance
-- CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
-- CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);
-- CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
-- CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Set up monitoring views (optional)
CREATE OR REPLACE VIEW database_stats AS
SELECT
    schemaname,
    tablename,
    n_tup_ins AS inserts,
    n_tup_upd AS updates,
    n_tup_del AS deletes,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows
FROM pg_stat_user_tables
ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC;

-- Grant permissions for the application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO marketingportal_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO marketingportal_user;

-- Log initialization completion
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL MCP Server database initialized successfully';
END $$;
