import sqlite3
import pathlib
import unittest

class ModerationSchema(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  for path in sorted(pathlib.Path('migrations').glob('*.sql')):
   self.db.executescript(path.read_text())
  for who in ['owner','reviewer','publisher']:
   self.db.execute('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,0,0)',(who,who,who+'@example.test'))
   self.db.execute("INSERT INTO member VALUES(?,'active',0)",(who,))
 def test_moderator_role(self):
  self.db.execute("INSERT INTO capability VALUES('reviewer','moderator')")
 def test_mail_daily_and_monthly(self):
  for i in range(90):
   self.db.execute('INSERT INTO mail_reservation VALUES(?,?,?)',(str(i),'2026-10-24','2026-10'))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'mail_budget_exhausted'):
   self.db.execute("INSERT INTO mail_reservation VALUES('over','2026-10-24','2026-10')")
  self.db.execute("INSERT INTO mail_reservation VALUES('next','2026-10-25','2026-10')")
 def test_source_budget_retained(self):
  self.db.execute("INSERT INTO storage_reservation VALUES('first','owner','source',67108864)")
  with self.assertRaisesRegex(sqlite3.IntegrityError,'storage_budget_exhausted'):
   self.db.execute("INSERT INTO storage_reservation VALUES('over','owner','source',1)")
 def test_loss_withdraws_and_restore_is_terminal(self):
  self.db.execute("INSERT INTO capability VALUES('publisher','publisher')")
  self.db.execute("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at,approved_by) VALUES(?,'asset','owner','Asset','preset','{}',0,'publisher')",('a'*64,))
  for state in ['submitted','processing','awaiting_review','approved','published']:
   self.db.execute('UPDATE asset_version SET state=?',(state,))
  self.db.execute("DELETE FROM capability WHERE user_id='publisher'")
  self.assertEqual(self.db.execute('SELECT state FROM asset_version').fetchone()[0],'withdrawn')
  self.db.execute("INSERT INTO capability VALUES('publisher','publisher')")
  self.assertEqual(self.db.execute('SELECT state FROM asset_version').fetchone()[0],'withdrawn')

 def test_monthly_budget(self):
  for i in range(2700):
   self.db.execute('INSERT INTO mail_reservation VALUES(?,?,?)',(str(i),'day-'+str(i//90),'2026-10'))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'mail_budget_exhausted'):
   self.db.execute("INSERT INTO mail_reservation VALUES('over','new-day','2026-10')")
 def publish(self):
  version='b'*64
  self.db.execute("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at) VALUES(?,'asset','owner','Asset','preset','{}',0)",(version,))
  for state in ['submitted','processing','awaiting_review','approved','published']:
   self.db.execute('UPDATE asset_version SET state=?',(state,))
  return version
 def test_reviewer_loss(self):
  version=self.publish()
  self.db.execute("INSERT INTO capability VALUES('reviewer','reviewer:visual')")
  self.db.execute("INSERT INTO review_record VALUES(?,?,'reviewer','visual','{}',0)",('c'*64,version))
  self.db.execute("DELETE FROM capability WHERE user_id='reviewer'")
  self.assertEqual(self.db.execute('SELECT state FROM asset_version').fetchone()[0],'withdrawn')
 def test_processor_loss(self):
  version=self.publish()
  self.db.execute("INSERT INTO processor(id,owner_id,label,profiles,secret_hash,created_at) VALUES('processor','reviewer','Processor','[]','hash',0)")
  self.db.execute("INSERT INTO processing_profile VALUES('profile','package-replay-v1','policy','{}',1)")
  self.db.execute("INSERT INTO processing_job(id,version_id,profile,current_attempt,created_at) VALUES('job',?,'package-replay-v1','attempt',0)",(version,))
  self.db.execute("INSERT INTO processing_attempt(id,job_id,processor_id,claim_key,lease_id,lease_expires_at,profile_id,created_at) VALUES('attempt','job','processor','claim','lease',100,'profile',0)")
  self.db.execute("UPDATE processor SET enabled=0 WHERE id='processor'")
  self.assertEqual(self.db.execute('SELECT state FROM asset_version').fetchone()[0],'withdrawn')
  self.db.execute("UPDATE processor SET enabled=1 WHERE id='processor'")
  self.assertEqual(self.db.execute('SELECT state FROM asset_version').fetchone()[0],'withdrawn')

 def test_pending_submission_and_token_limits(self):
  for i in range(10):
   self.db.execute("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at) VALUES(?,'asset','owner','Asset','preset','{}',0)",(format(i,'064x'),))
   self.db.execute("INSERT INTO agent_token VALUES(?,'owner','Token',?,'[]',?,NULL)",(str(i),str(i),9999999999999))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'submission_budget_exhausted'):
   self.db.execute("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at) VALUES(?,'asset','owner','Asset','preset','{}',0)",('f'*64,))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'token_budget_exhausted'):
   self.db.execute("INSERT INTO agent_token VALUES('over','owner','Token','over','[]',9999999999999,NULL)")
  self.db.execute("UPDATE member SET status='suspended' WHERE user_id='owner'")
  self.assertEqual(self.db.execute('SELECT count(*) FROM agent_token WHERE revoked_at IS NULL').fetchone()[0],0)
 def test_official_seed_admits_prepared_set_only(self):
  self.db.execute('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,0,0)',('seed','seed','seed@example.test'))
  self.db.execute("INSERT INTO member VALUES(?,'active',0)",('seed',))
  self.db.execute('INSERT INTO official_catalog_seed(user_id,created_at) VALUES(?,0)',('seed',))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'official_seed_singleton'):
   self.db.execute('INSERT INTO official_catalog_seed(user_id,created_at) VALUES(?,0)',('owner',))
  for i in range(144):
   self.db.execute("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at) VALUES(?,'asset','seed','Asset','static','{}',0)",(f'seed{i:060x}',))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'submission_budget_exhausted'):
   self.db.execute("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at) VALUES(?,'asset','seed','Asset','static','{}',0)",('e'*64,))
  for n in range(10):
   who=f'crowd{n}'
   self.db.execute('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,0,0)',(who,who,who+'@example.test'))
   self.db.execute("INSERT INTO member VALUES(?,'active',0)",(who,))
   for i in range(10):
    self.db.execute("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at) VALUES(?,'asset',?,'Asset','static','{}',0)",(f'{n:02d}{i:062x}',who))
  self.db.execute('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,0,0)',('extra','extra','extra@example.test'))
  self.db.execute("INSERT INTO member VALUES(?,'active',0)",('extra',))
  with self.assertRaisesRegex(sqlite3.IntegrityError,'submission_budget_exhausted'):
   self.db.execute("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at) VALUES(?,'asset','extra','Asset','static','{}',0)",('d'*64,))
 def test_job_daily_limit(self):
  for i in range(101):
   version=format(i,'064x')
   self.db.execute("INSERT INTO asset_version(id,asset_id,contributor_id,title,kind,subject,created_at) VALUES(?,'asset','owner','Asset','preset','{}',0)",(version,))
   self.db.execute("UPDATE asset_version SET state='withdrawn' WHERE id=?",(version,))
   if i==100:
    with self.assertRaisesRegex(sqlite3.IntegrityError,'job_budget_exhausted'):
     self.db.execute("INSERT INTO processing_job(id,version_id,profile,created_at) VALUES(?,?,'profile',unixepoch()*1000)",(str(i),version))
   else:
    self.db.execute("INSERT INTO processing_job(id,version_id,profile,created_at) VALUES(?,?,'profile',unixepoch()*1000)",(str(i),version))

unittest.main()
