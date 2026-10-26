# Provider redirect compatibility

Workers supports `manual` and `follow` request redirects. It rejects `error` before an outbound request. The mail and private object adapters use `manual`; every non-success status, including redirects, fails through the existing provider error path. Provider credentials never follow a redirect.

Login mail preserves its atomic reservation, public429/503 responses and no-retry behavior. Failure diagnostics contain only HTTP status and fixed error codes or safe exception names. They omit provider messages, recipient addresses, login links, headers and credentials.

The workerd regression bundles the production adapters against a synthetic outbound provider. It covers direct success,301/302/303/307/308 from mail, object and bucket endpoints, quota failures, and zero redirected requests.
