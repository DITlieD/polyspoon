using System;
using System.Threading.Tasks;
using UnityEditor;

namespace OpenPoly.Workshop.Editor
{
    public static class WorkshopEditorCompletion
    {
        public static Task<TResult> OnUpdate<T, TResult>(Task<T> pending, Func<T, TResult> apply, Action finished)
        {
            var completion = new TaskCompletionSource<TResult>();
            void Poll()
            {
                if (!pending.IsCompleted) return;
                EditorApplication.update -= Poll;
                try { completion.SetResult(apply(pending.GetAwaiter().GetResult())); }
                catch (Exception exception) { completion.SetException(exception); }
                finally { finished(); }
            }
            EditorApplication.update += Poll;
            return completion.Task;
        }

        public static void Observe(Task pending, Action<Exception> failed)
        {
            void Poll()
            {
                if (!pending.IsCompleted) return;
                EditorApplication.update -= Poll;
                try { pending.GetAwaiter().GetResult(); }
                catch (Exception exception) { failed(exception); }
            }
            EditorApplication.update += Poll;
        }
    }
}
