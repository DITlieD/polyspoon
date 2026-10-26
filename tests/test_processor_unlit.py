import argparse
import binascii
import json
import os
from pathlib import Path
import struct
import sys
import zlib
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from processor.policy import canonical
from processor.sandbox import run

def repack(document,binary):
 text=json.dumps(document,separators=(',',':')).encode();text+=b' '*((-len(text))%4)
 return struct.pack('<III',0x46546c67,2,20+len(text)+len(binary))+struct.pack('<II',len(text),0x4e4f534a)+text+binary

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--runtime',required=True);parser.add_argument('--input',required=True);parser.add_argument('--out',required=True);args=parser.parse_args()
 if not os.environ.get('HOSTQ_JOB_ID'):raise SystemExit('hostq_admission_required')
 runtime=Path(args.runtime).resolve();source=Path(args.input).resolve();output=Path(args.out).resolve();output.mkdir(parents=True,exist_ok=False)
 metadata=json.loads((source/'metadata.json').read_text());name=metadata['cases'][0]['file'];original=(source/'a'/name).read_bytes();length=struct.unpack_from('<I',original,12)[0];document=json.loads(original[20:20+length]);binary=original[20+length:];records={}
 fixtures=['valid-styled','opaque-extras','unknown-extension','misplaced-unlit','nonempty-unlit','undeclared-unlit','unused-unlit','duplicate-declaration','external-buffer','external-image']
 for kind in fixtures:
  doc=json.loads(json.dumps(document))
  if kind=='opaque-extras':doc['extras']={'extensions':{'VENDOR_metadata':{'uri':'https://example.invalid/metadata-only'}}}
  elif kind=='unknown-extension':doc['extensionsUsed'].append('KHR_materials_clearcoat');doc['materials'][0]['extensions']['KHR_materials_clearcoat']={}
  elif kind=='misplaced-unlit':doc['nodes'][0]['extensions']={'KHR_materials_unlit':{}}
  elif kind=='nonempty-unlit':doc['materials'][0]['extensions']['KHR_materials_unlit']={'unexpected':True}
  elif kind=='undeclared-unlit':doc.pop('extensionsUsed')
  elif kind=='unused-unlit':
   for material in doc['materials']:material.pop('extensions',None)
  elif kind=='duplicate-declaration':doc['extensionsUsed'].append('KHR_materials_unlit')
  elif kind=='external-buffer':doc['buffers'][0]['uri']='https://example.invalid/never-fetch.bin'
  elif kind=='external-image':doc['images']=[{'uri':'https://example.invalid/never-fetch.png'}]
  folder=output/kind;folder.mkdir();(folder/'metadata.json').write_bytes(canonical(metadata));value=repack(doc,binary)
  for copy in ['a','b']:(folder/copy/Path(name).parent).mkdir(parents=True);(folder/copy/name).write_bytes(value)
  entry=run(runtime,folder,'validate');records[kind]={key:item.decode(errors='replace') if isinstance(item,bytes) else item for key,item in entry.items()};(output/'results.json').write_bytes(canonical(records));assert entry['terminated'] and not entry['remainingTasks'],kind
  if kind in ['valid-styled','opaque-extras']:assert entry['exitCode']==0,(kind,records[kind]['stderr'])
  else:
   expected='glb_external_resource' if kind.startswith('external-') else 'glb_unsupported_extension';assert entry['exitCode']!=0 and json.loads(entry['stdout'])['failureCode']==expected,(kind,records[kind])
 def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',binascii.crc32(kind+data)&0xffffffff)
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',4096,4096,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(bytes((4096*4+1)*4096)))+chunk(b'IEND',b'')
 doc=json.loads(json.dumps(document));offset=struct.unpack_from('<I',binary,0)[0];body=binary[8:]+png;body+=b'\x00'*((-len(body))%4)
 doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(png)});doc['buffers'][0]['byteLength']=len(body);doc['images']=[{'mimeType':'image/png','bufferView':len(doc['bufferViews'])-1}]
 folder=output/'oversized-image';folder.mkdir();(folder/'metadata.json').write_bytes(canonical(metadata));value=repack(doc,struct.pack('<II',len(body),0x004e4942)+body)
 for copy in ['a','b']:(folder/copy/Path(name).parent).mkdir(parents=True);(folder/copy/name).write_bytes(value)
 entry=run(runtime,folder,'validate');records['oversized-image']={key:item.decode(errors='replace') if isinstance(item,bytes) else item for key,item in entry.items()};(output/'results.json').write_bytes(canonical(records));assert entry['exitCode']!=0 and entry['terminated'] and not entry['remainingTasks'] and b'image_dimensions' in entry['stderr']
 print(json.dumps({'fixtures':len(records),'positive':2,'rejected':len(records)-2,'allTerminated':True}))

if __name__=='__main__':main()
