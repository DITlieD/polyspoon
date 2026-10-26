import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';

test('portable Unity runner requires explicit editor and preserves method and log boundaries',async()=>{
 const root=await mkdtemp(join(tmpdir(),'polyspoon-unity-runner-')),settings=join(root,'integrations/unity/ImportFixture/ProjectSettings');await mkdir(settings,{recursive:true});await writeFile(join(settings,'ProjectVersion.txt'),'m_EditorVersion: 6000.5.5f1\n');const script=resolve('integrations/unity/run-editor.sh'),env={...process.env,POLYSPOON_ROOT:root,UNITY_EDITOR:'/bin/echo'};
 const invoke=(args:string[],environment=env)=>spawnSync('bash',[script,...args],{env:environment,encoding:'utf8'});const passed=invoke(['LanternFixture.FixtureRun.Run','fixture.log']);assert.equal(passed.status,0,passed.stderr);assert.ok(passed.stdout.includes('-projectPath '+join(root,'integrations/unity/ImportFixture')));assert.ok(passed.stdout.includes('-executeMethod LanternFixture.FixtureRun.Run'));assert.ok(passed.stdout.includes('-logFile '+join(root,'evidence/unity/fixture.log')));assert.equal(invoke(['Unknown.Method','other.log']).status,2);assert.equal(invoke(['LanternFixture.FixtureRun.Run','../escape.log']).status,2);assert.equal(invoke(['LanternFixture.FixtureRun.Run','other.log'],{...env,UNITY_EDITOR:''}).status,2);
 await writeFile(join(root,'evidence/unity','fixture.log'),'preserve');assert.equal(invoke(['LanternFixture.FixtureRun.Run','fixture.log']).status,2);assert.equal(await readFile(join(root,'evidence/unity','fixture.log'),'utf8'),'preserve');
});

test('Unity fixture identity distinguishes repository root from the actual Unity project',async()=>{
 const repository=resolve('/tmp/portable-fixture-root'),data=join(repository,'integrations/unity/ImportFixture/Assets'),derivedRepository=resolve(data,'../../../..'),fixture=join(derivedRepository,'integrations/unity/ImportFixture');assert.equal(derivedRepository,repository);assert.equal(dirname(data),fixture);assert.notEqual(dirname(data),repository);
 const source=await readFile('integrations/unity/ImportFixture/Assets/Editor/FixtureRun.cs','utf8');assert.match(source,/FixtureProjectRoot\s*=\s*Path\.GetFullPath\(Path\.Combine\(RepositoryRoot,\s*"integrations\/unity\/ImportFixture"\)\)/);assert.match(source,/Require\(report\.project == FixtureProjectRoot,/);assert.doesNotMatch(source,/Require\(report\.project == RepositoryRoot,/);
});
