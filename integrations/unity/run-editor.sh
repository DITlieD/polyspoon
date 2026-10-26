#!/usr/bin/env bash
set -euo pipefail
root="${POLYSPOON_ROOT:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)}"
root="$(cd -- "$root" && pwd)"
fixture="$root/integrations/unity/ImportFixture"
method="${1:-}"
log="${2:-}"
mode="${3:-}"
[[ $# -ge 2 && $# -le 3 && -n "${UNITY_EDITOR:-}" && -x "$UNITY_EDITOR" && -f "$fixture/ProjectSettings/ProjectVersion.txt" ]] || exit 2
evidence=unity
case "$mode" in
  '') ;;
  kit) evidence=unity-kit ;;
  polish) evidence=polish/unity ;;
  revision2) evidence=revision2/unity ;;
  revision3) evidence=revision3/unity ;;
  revision4) evidence=revision4/unity ;;
  revision5) evidence=revision5/unity ;;
  *) exit 2 ;;
esac
case "$mode:$method" in
  :LanternFixture.FixtureBootstrap.Install|:LanternFixture.FixtureRun.Run|kit:LanternFixture.FixtureRun.RunKit|polish:LanternFixture.FixtureRun.RunPolish|revision2:LanternFixture.FixtureRun.RunRevision2|revision2:LanternFixture.FixtureRun.RunRevision2CaptureReview|revision3:LanternFixture.FixtureRun.RunRevision3|revision4:LanternFixture.FixtureRun.RunRevision4|revision5:LanternFixture.FixtureRun.RunRevision5) ;;
  *) exit 2 ;;
esac
if [[ "$mode" == revision2 && "$method" == LanternFixture.FixtureRun.RunRevision2CaptureReview ]]; then
  evidence=revision2/unity/capture-review
fi
[[ "$log" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*\.log$ && ${#log} -le 128 ]] || exit 2
log_path="$root/evidence/$evidence/$log"
[[ ! -e "$log_path" && ! -L "$log_path" ]] || exit 2
mkdir -p "$root/evidence/$evidence"
export POLYSPOON_ROOT="$root"
exec "$UNITY_EDITOR" -batchmode -force-glcore -projectPath "$fixture" -executeMethod "$method" -logFile "$log_path"
