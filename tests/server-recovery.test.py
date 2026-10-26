import sqlite3
import pathlib
import unittest

class Recovery(unittest.TestCase):
 def test_export_restore_quarantines_stale_authority(self):
  db=sqlite3.connect(':memory:')
  for path in sorted(pathlib.Path('migrations').glob('*.sql')):
   db.executescript(path.read_text())
  for who in ['owner','reviewer']:
   db.execute('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,0,0)',(who,who,who+'@example.invalid'))
   db.execute("INSERT INTO member VALUES(?,'active',0)",(who,))
  db.execute("INSERT INTO capability VALUES('owner','admin')")
  db.execute("INSERT INTO capability VALUES('reviewer','publisher')")
  db.execute("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at) VALUES(?,'asset','owner','Synthetic recovery','preset','{}',0)",('a'*64,))
  for state in ['submitted','processing','awaiting_review','approved','published']:
   db.execute('UPDATE asset_version SET state=?',(state,))
  db.execute("INSERT INTO agent_token VALUES('token','owner','Synthetic','hash','[]',9999999999999,NULL)")
  db.execute("INSERT INTO session(id,expiresAt,token,createdAt,updatedAt,userId) VALUES('session',9999999999999,'synthetic',0,0,'owner')")
  db.commit()
  restored=sqlite3.connect(':memory:')
  restored.executescript('\n'.join(db.iterdump()))
  self.assertEqual(restored.execute('SELECT state FROM asset_version').fetchone()[0],'published')
  restored.executescript(pathlib.Path('server/recovery-quarantine.sql').read_text())
  restored.executescript(pathlib.Path('server/recovery-quarantine.sql').read_text())
  self.assertEqual(restored.execute('SELECT state FROM asset_version').fetchone()[0],'withdrawn')
  self.assertEqual(restored.execute('SELECT count(*) FROM session').fetchone()[0],0)
  self.assertEqual(restored.execute('SELECT count(*) FROM agent_token WHERE revoked_at IS NULL').fetchone()[0],0)
  self.assertEqual(restored.execute('SELECT count(*) FROM capability').fetchone()[0],0)
  self.assertEqual(restored.execute("SELECT count(*) FROM member WHERE status='active'").fetchone()[0],0)
  self.assertEqual(restored.execute('SELECT count(*) FROM member_restriction').fetchone()[0],2)
  self.assertEqual(restored.execute('SELECT count(*) FROM asset_version').fetchone()[0],1)

unittest.main()
