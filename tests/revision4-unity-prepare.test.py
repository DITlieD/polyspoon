import copy
import importlib.util
import pathlib
import unittest

path = pathlib.Path(__file__).resolve().parents[1] / "integrations/unity/prepare-kit.py"
spec = importlib.util.spec_from_file_location("prepare_kit", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class AppearanceExpectations(unittest.TestCase):
    def setUp(self):
        self.item = dict(verifyAppearance=True, requireUnlit=True,
            parts=[dict(verifyVertexColors=True, vertexColors=[dict(r=.2,g=.3,b=.4,a=1)])],
            materials=[dict(verifyShader=True, unlit=True)])

    def test_valid_and_negative_contracts(self):
        module.validate_appearance(self.item)
        for group, field, value in [
            ("parts","verifyVertexColors",False),("parts","vertexColors",None),
            ("materials","verifyShader",False),("materials","unlit","true")]:
            bad=copy.deepcopy(self.item);bad[group][0][field]=value
            with self.assertRaises(ValueError): module.validate_appearance(bad)
        for value in [-.01,1.01,float("nan")]:
            bad=copy.deepcopy(self.item);bad["parts"][0]["vertexColors"][0]["r"]=value
            with self.assertRaises(ValueError): module.validate_appearance(bad)
        bad=copy.deepcopy(self.item);bad["requireUnlit"]=False
        with self.assertRaises(ValueError): module.validate_appearance(bad)

if __name__ == "__main__":
    unittest.main()
