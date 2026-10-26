# Health and storage configuration

GET `/health` is public liveness, not a full readiness probe. It returns HTTP 200 with `status:"ok"`, `privateStorage`, and `privateStorageCheck:"configuration-only"`.

`privateStorage` is `supabase-configured` when production storage configuration passes the existing adapter's presence, native HTTPS origin and bucket-name validation. It is `local-simulation` for a configured local object binding, otherwise `unconfigured`. Production never falls back to a local object binding.

The probe performs no database query or provider request and exposes no key, project URL, bucket identifier or owner information. A configured response does not establish valid credentials, bucket privacy, available quota or live byte access. Deployment readiness still requires actual authenticated mail/database/storage checks and final candidate qualification.
