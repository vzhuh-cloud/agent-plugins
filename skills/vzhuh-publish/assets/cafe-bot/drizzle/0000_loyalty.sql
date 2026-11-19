CREATE TABLE ledger (event_id TEXT PRIMARY KEY, receipt TEXT NOT NULL UNIQUE, customer TEXT NOT NULL, delta INTEGER NOT NULL CHECK(delta IN (1,-5)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE bot_events (id TEXT PRIMARY KEY, reply TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE INDEX ledger_customer ON ledger(customer);
