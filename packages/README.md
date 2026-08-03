# packages/

Workspace packages. Each has a single, documented responsibility — see the package
map in [../docs/adr/0001-architecture-and-tooling.md](../docs/adr/0001-architecture-and-tooling.md).

Packages are created **on demand** as the plan reaches them, not all at once. The
first ones to exist will be `shared`, `kickbase-api`, and `mcp-server` (see
[../PLAN.md](../PLAN.md)). This file is a placeholder so the directory is tracked
before any package exists.
