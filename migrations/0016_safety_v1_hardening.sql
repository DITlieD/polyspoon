-- review-v2 phase 3: a processor never scans its own owner's upload, normalized.glb artifacts, and the appeal path.
CREATE TRIGGER safety_attempt_not_own_upload BEFORE INSERT ON safety_attempt WHEN EXISTS(SELECT 1 FROM processor p JOIN uploads u ON u.id=NEW.upload_id WHERE p.id=NEW.processor_id AND p.owner_id=u.owner_id) BEGIN SELECT RAISE(ABORT,'processor_owns_upload'); END;
CREATE TABLE safety_normalized(attempt_id TEXT PRIMARY KEY REFERENCES safety_attempt(id),object_key TEXT NOT NULL UNIQUE,sha256 TEXT NOT NULL CHECK(length(sha256)=64),bytes INTEGER NOT NULL CHECK(bytes>0 AND bytes<=52428800),created_at INTEGER NOT NULL);
CREATE TRIGGER safety_normalized_immutable BEFORE UPDATE ON safety_normalized BEGIN SELECT RAISE(ABORT,'safety_normalized_immutable'); END;
CREATE TRIGGER safety_normalized_no_delete BEFORE DELETE ON safety_normalized BEGIN SELECT RAISE(ABORT,'safety_normalized_immutable'); END;
-- One appeal per auto-rejected upload, written by its owner. Deciding it is a moderator action recorded in
-- queue_event_log as an override (appeal_accepted / appeal_declined); accepting only reopens the version to
-- awaiting_review (the 0015 trigger checks the moderator), it never approves.
CREATE TABLE upload_appeal(upload_id TEXT PRIMARY KEY REFERENCES uploads(id),version_id TEXT NOT NULL REFERENCES asset_version(id),owner_id TEXT NOT NULL REFERENCES member(user_id),message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 500),status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','accepted','declined')),decided_by TEXT REFERENCES member(user_id),decided_at INTEGER,created_at INTEGER NOT NULL,CHECK((status='open')=(decided_by IS NULL)));
CREATE INDEX upload_appeal_open ON upload_appeal(status,created_at);
CREATE TRIGGER upload_appeal_needs_auto_rejection BEFORE INSERT ON upload_appeal WHEN NOT EXISTS(SELECT 1 FROM uploads u JOIN version_auto_rejection a ON a.version_id=u.version_id WHERE u.id=NEW.upload_id AND u.version_id=NEW.version_id AND u.owner_id=NEW.owner_id AND u.status='rejected_auto') BEGIN SELECT RAISE(ABORT,'appeal_requires_auto_rejection'); END;
CREATE TRIGGER upload_appeal_identity BEFORE UPDATE OF upload_id,version_id,owner_id,message,created_at ON upload_appeal BEGIN SELECT RAISE(ABORT,'upload_appeal_immutable'); END;
CREATE TRIGGER upload_appeal_decided_once BEFORE UPDATE OF status ON upload_appeal WHEN OLD.status!='open' OR NEW.decided_by=OLD.owner_id OR NOT EXISTS(SELECT 1 FROM capability c WHERE c.user_id=NEW.decided_by AND c.name IN ('moderator','admin')) BEGIN SELECT RAISE(ABORT,'appeal_requires_moderator'); END;
CREATE TRIGGER upload_appeal_no_delete BEFORE DELETE ON upload_appeal BEGIN SELECT RAISE(ABORT,'upload_appeal_immutable'); END;
