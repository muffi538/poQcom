-- Many audited actions (login, logout, sync triggers) have no natural
-- entity_type/entity_id — logActivity() already passes null for these,
-- but the column was NOT NULL, so every such insert was silently failing.
alter table activity_logs alter column entity_type drop not null;
