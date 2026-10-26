using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using UnityEditor;

namespace OpenPoly.Workshop.Editor
{
    [InitializeOnLoad]
    public static class WorkshopBridge
    {
        private static readonly CancellationTokenSource Lifetime = new CancellationTokenSource();
        private static readonly HashSet<Process> Processes = new HashSet<Process>();
        private static readonly object ProcessLock = new object();

        static WorkshopBridge()
        {
            AssemblyReloadEvents.beforeAssemblyReload += StopAll;
            EditorApplication.quitting += StopAll;
        }

        public static int ActiveProcesses
        {
            get { lock (ProcessLock) return Processes.Count; }
        }

        public static void StopAll()
        {
            Lifetime.Cancel();
            lock (ProcessLock)
                foreach (var process in Processes)
                {
                    Terminate(process);
                    process.WaitForExit(1000);
                }
        }

        private static void Terminate(Process process)
        {
            try
            {
                if (!process.HasExited) process.Kill();
            }
            catch (InvalidOperationException exception)
            {
                Trace.WriteLine(exception.Message);
            }
        }

        private static string ReadLimited(StreamReader reader, int limit, Process process)
        {
            var result = new StringBuilder();
            var buffer = new char[8192];
            int count;
            while ((count = reader.Read(buffer, 0, buffer.Length)) > 0)
            {
                if (result.Length + count > limit)
                {
                    Terminate(process);
                    throw new InvalidDataException("Bridge output limit exceeded");
                }
                result.Append(buffer, 0, count);
            }
            return result.ToString();
        }

        public static Task<JObject> RequestAsync(string repository, string nodeExecutable, JObject request,
            CancellationToken cancellation, int timeoutMilliseconds = 30000)
        {
            var root = Path.GetFullPath(repository);
            var script = Path.Combine(root, "scripts", "unity-bridge.ts");
            if (!File.Exists(script) || !File.Exists(Path.Combine(root, "node_modules", "tsx", "package.json")))
                throw new FileNotFoundException("Choose a Polyspoon checkout with its installed Node dependencies", script);
            if (timeoutMilliseconds < 1 || timeoutMilliseconds > 60000) throw new ArgumentOutOfRangeException(nameof(timeoutMilliseconds));
            var input = request.ToString(Newtonsoft.Json.Formatting.None);
            if (Encoding.UTF8.GetByteCount(input) > 1024 * 1024) throw new InvalidDataException("Request exceeds 1 MiB");
            var start = new ProcessStartInfo
            {
                FileName = nodeExecutable,
                WorkingDirectory = root,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                Arguments = "--import tsx scripts/unity-bridge.ts"
            };
            return Task.Run(() => RunProcess(start, input, cancellation, timeoutMilliseconds));
        }

        private static JObject RunProcess(ProcessStartInfo start, string input, CancellationToken cancellation, int timeoutMilliseconds)
        {
            using var deadline = new CancellationTokenSource(timeoutMilliseconds);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, deadline.Token, Lifetime.Token);
            linked.Token.ThrowIfCancellationRequested();
            using var process = new Process { StartInfo = start };
            if (!process.Start()) throw new InvalidOperationException("Could not start Node");
            lock (ProcessLock) Processes.Add(process);
            using var registration = linked.Token.Register(() => Terminate(process));
            var output = Task.Run(() => ReadLimited(process.StandardOutput, 24 * 1024 * 1024, process));
            var diagnostic = Task.Run(() => ReadLimited(process.StandardError, 65536, process));
            try
            {
                process.StandardInput.Write(input);
                process.StandardInput.Close();
                if (!process.WaitForExit(timeoutMilliseconds + 1000)) throw new TimeoutException("Bridge process deadline exceeded");
                var text = output.GetAwaiter().GetResult();
                var error = diagnostic.GetAwaiter().GetResult();
                linked.Token.ThrowIfCancellationRequested();
                if (process.ExitCode != 0) throw new InvalidOperationException(string.IsNullOrWhiteSpace(error) ? "Bridge process failed" : error);
                var response = JObject.Parse(text);
                if ((int?)response["protocolVersion"] != 1) throw new InvalidDataException("Unsupported bridge response");
                return response;
            }
            finally
            {
                Terminate(process);
                process.WaitForExit(1000);
                try { Task.WhenAll(output, diagnostic).GetAwaiter().GetResult(); }
                finally { lock (ProcessLock) Processes.Remove(process); }
            }
        }
    }
}
