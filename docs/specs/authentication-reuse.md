# Authentication factory reuse

Authentication keeps one library instance per D1 binding while its environment, origin, secret and provider configuration match. A configuration change replaces that binding's entry. The instance closes over an immutable configuration snapshot. Failed initialization removes only its own entry.

Requests, sessions, principals and capabilities are not cached. Library cookie caching remains disabled, and principal lookups still request fresh sessions and current database authority. Concurrent sessions keep separate request state.

Tests cover reuse, every configuration-field change, distinct binding identities, mutable caller environments, failed initialization, interleaved sessions, capability removal, verification loss, restriction, session revocation and trusted-IP throttling.

This reduces repeated setup. It does not establish the Free request CPU limit for first or later requests. Live CPU qualification remains separate.
