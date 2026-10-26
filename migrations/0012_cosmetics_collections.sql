ALTER TABLE creator_profile ADD COLUMN accent TEXT NOT NULL DEFAULT 'default' CHECK(length(accent) BETWEEN 1 AND 24);
ALTER TABLE creator_profile ADD COLUMN flair TEXT NOT NULL DEFAULT 'none' CHECK(length(flair) BETWEEN 1 AND 24);
CREATE TABLE collection(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE CHECK(length(slug) BETWEEN 3 AND 40 AND slug NOT GLOB '*[^a-z0-9-]*'),title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 80),description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=500),created_by TEXT NOT NULL REFERENCES member(user_id),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE collection_item(collection_id TEXT NOT NULL REFERENCES collection(id),asset_id TEXT NOT NULL,position INTEGER NOT NULL,added_by TEXT NOT NULL REFERENCES member(user_id),added_at INTEGER NOT NULL,PRIMARY KEY(collection_id,asset_id));
CREATE INDEX collection_item_order ON collection_item(collection_id,position);
