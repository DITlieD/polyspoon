CREATE TABLE app_asset (release_hash TEXT NOT NULL CHECK(length(release_hash)=64), path TEXT NOT NULL, sha256 TEXT NOT NULL CHECK(length(sha256)=64), bytes INTEGER NOT NULL CHECK(bytes>=0 AND bytes<=2097152), media_type TEXT NOT NULL, PRIMARY KEY(release_hash,path));
CREATE TRIGGER immutable_app_asset_update BEFORE UPDATE ON app_asset BEGIN SELECT RAISE(ABORT,'immutable_app_asset'); END;
CREATE TRIGGER immutable_app_asset_delete BEFORE DELETE ON app_asset BEGIN SELECT RAISE(ABORT,'immutable_app_asset'); END;
