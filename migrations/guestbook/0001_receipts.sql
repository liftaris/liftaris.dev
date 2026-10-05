-- Apply explicitly after EmDash core migrations, before deploying the guestbook.
-- Re-running is safe. No content, comments, or historical gifts are removed.
CREATE TABLE IF NOT EXISTS house_gift_receipts (
  id TEXT PRIMARY KEY, author_id TEXT NOT NULL, fingerprint TEXT NOT NULL
);

-- Couple the comment and idempotency receipt in one atomic SQLite statement.
-- D1 does not support interactive transactions; separate inserts can partially fail.
CREATE TRIGGER IF NOT EXISTS house_guestbook_receipt
BEFORE INSERT ON _emdash_comments
WHEN NEW.collection = 'things' AND NEW.content_id = 'leave-gift'
  AND json_valid(NEW.moderation_metadata)
  AND json_extract(NEW.moderation_metadata, '$.submissionHash') IS NOT NULL
BEGIN
  INSERT INTO house_gift_receipts (id, author_id, fingerprint)
  VALUES (NEW.id, NEW.author_user_id, json_extract(NEW.moderation_metadata, '$.submissionHash'));
END;
