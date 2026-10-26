import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from processor.policy import safe_path, policy, canonical, digest
from processor.runtime import verify
import json
import tempfile

class ProcessorPolicyTests(unittest.TestCase):
 def test_paths_reject_escape_and_accept_case_artifact(self):
  self.assertEqual(safe_path('cases/000.glb'),'cases/000.glb')
  for value in ['../escape','/home/user','a/../b','a\\b','a//b','a\x00b']:
   with self.assertRaises(ValueError):safe_path(value)
 def test_policy_has_finite_resource_and_capture_limits(self):
  value=policy()
  self.assertEqual(value['network'],'none')
  self.assertLessEqual(value['memoryBytes'],2*1024**3)
  self.assertLessEqual(value['wallSeconds'],120)
  self.assertLessEqual(value['artifactBytes'],2*1024**2)
  self.assertEqual(value['swapBytes'],0)

 def test_runtime_rejects_unlisted_payload_files(self):
  root=Path(__file__).resolve().parents[1]/'processor/.local';root.mkdir(exist_ok=True)
  with tempfile.TemporaryDirectory(dir=root) as directory:
   folder=Path(directory);(folder/'rootfs').mkdir();(folder/'rootfs/unlisted').write_text('unexpected')
   manifest={'files':{}};manifest['capsuleSha256']=digest(canonical(manifest));(folder/'runtime.json').write_text(json.dumps(manifest))
   with self.assertRaises(ValueError):verify(folder)

if __name__=='__main__':unittest.main()
