# MVP2 Architecture — AI SOC Copilot Integrated with IRIS, Keycloak and OpenClaw

## Document Version

Version: MVP2 Architecture Draft v1.0

Status: Target Production Architecture

Based on:

* MVP1 implementation
* OpenClaw
* Local Qwen Investigator
* IRIS integration requirements
* Keycloak federation requirements
* Production deployment constraints

---

# 1. Project Objective

The objective of MVP2 is to transform the MVP1 AI SOC Copilot into a production-ready SOC investigation platform integrated with:

* IRIS
* Keycloak
* OpenClaw
* Local Qwen Investigator
* Cloud Threat Intelligence Model

The platform must allow SOC analysts to start investigations directly from IRIS alerts and cases while preserving:

* security
* multi-tenancy
* RBAC
* auditability
* human approval workflows

---

# 2. Business Requirement

The client requires:

## User Federation

Authentication must be centralized through Keycloak.

Users must authenticate once and access:

* IRIS
* OpenClaw

using the same identity.

---

## Investigation Workflow

The workflow expected by the client:

```text
New Conversation
        ↓
Select Client
        ↓
Select Alert or Case
        ↓
Choose Specific Alert/Case
        ↓
Start Conversation
```

The selected alert or case becomes the starting point of the AI investigation.

---

# 3. Important Constraint

The IRIS platform cannot be modified.

We do NOT have access to:

* IRIS source code
* IRIS UI modifications
* IRIS plugins
* IRIS workflow changes

Therefore:

```text
IRIS
 ↓
OpenClaw
```

cannot be implemented through IRIS customization.

Instead:

```text
OpenClaw
 ↓
IRIS API
```

must be used.

---

# 4. High-Level Architecture

```text
                 Keycloak
                      │
                OIDC Login
                      │
                 OpenClaw
                      │
        ┌─────────────┴─────────────┐
        │                           │
     IRIS API                Target Registry
        │                           │
     Alerts/Cases             VM Metadata
        │                           │
        └─────────────┬─────────────┘
                      │
             Credential Broker
                      │
                SSH Session
                      │
              Local Qwen Agent
                      │
             Investigation VM
                      │
              Evidence Bundle
                      │
                 Sanitizer
                      │
                 ChatGPT
                      │
             Threat Intelligence
             MITRE Mapping
             Remediation Planning
                      │
              Human Approval
                      │
                  Executor
                      │
                   Report
```

---

# 5. Authentication Strategy

## Keycloak

Keycloak becomes the single source of identity.

Responsibilities:

* Authentication
* User lifecycle
* Group management
* Role management
* Single Sign-On

Both:

* IRIS
* OpenClaw

authenticate against the same Keycloak realm.

---

# 6. OpenClaw Deployment

MVP1 deployment:

```text
Developer Laptop
 ├─ OpenClaw
 ├─ LM Studio
 ├─ WSL2
 └─ Investigation VM
```

Production MVP2 deployment:

```text
SOC-AI-SERVER
 ├─ OpenClaw
 ├─ Qwen Runtime
 ├─ Target Registry
 ├─ Credential Broker
 ├─ Audit Logs
 ├─ Workflow Engine
 └─ IRIS Connector
```

OpenClaw becomes a centrally hosted service.

---

# 7. Qwen Deployment Strategy

## Development

Current setup:

```text
LM Studio
localhost:1234
```

Used for:

* MVP1
* development
* testing

---

## Production

Recommended:

```text
vLLM
```

Running on:

```text
SOC-AI-SERVER
```

Advantages:

* concurrency
* monitoring
* API compatibility
* production readiness
* centralized management

LM Studio is not recommended for production deployment.

---

# 8. IRIS Integration

OpenClaw consumes:

* Alerts
* Cases
* Assets
* Metadata

through the IRIS API.

IRIS remains the source of truth.

OpenClaw never duplicates IRIS data.

Store only references:

```json
{
  "conversation_id": "...",
  "case_id": "...",
  "alert_id": "...",
  "tenant_id": "...",
  "user_id": "..."
}
```

---

# 9. Multi-Tenant Design

The platform must support multiple clients.

Example:

```text
Client A
Client B
Client C
```

All operations must be tenant-aware.

Every conversation carries:

```json
{
  "tenant_id": "...",
  "client_id": "...",
  "case_id": "...",
  "user_id": "..."
}
```

Tenant isolation is mandatory.

---

# 10. Local Investigator

The Local Qwen Agent remains the primary investigator.

Responsibilities:

* SSH investigations
* Dynamic command selection
* Evidence collection
* Correlation
* Timeline creation
* IOC extraction
* Attack-chain reconstruction

The local model has access to:

* investigation tools
* SSH sessions
* collected evidence

The local model does NOT perform final threat intelligence analysis.

---

# 11. Cloud Model Role

ChatGPT becomes:

```text
Senior SOC Analyst
Threat Intelligence Analyst
MITRE Specialist
Incident Responder
```

Responsibilities:

* Deep reasoning
* Threat intelligence
* IOC enrichment
* MITRE ATT&CK mapping
* Remediation planning
* False-positive analysis
* Threat actor research

The cloud model does not investigate hosts directly.

---

# 12. Investigation Workflow

## Step 1

Analyst logs in.

```text
Keycloak
 ↓
OpenClaw
```

---

## Step 2

Select Client.

---

## Step 3

Retrieve alerts and cases from IRIS.

---

## Step 4

Select case.

---

## Step 5

Resolve affected assets.

---

## Step 6

Resolve investigation targets.

---

## Step 7

Create SSH session.

---

## Step 8

Launch Local Qwen investigation.

---

## Step 9

Collect evidence.

---

## Step 10

Build Evidence Bundle.

---

## Step 11

Sanitize.

---

## Step 12

Send sanitized bundle to ChatGPT.

---

## Step 13

Receive:

* threat intelligence
* MITRE mapping
* remediation suggestions

---

## Step 14

Human approval workflow.

---

## Step 15

Execute approved remediation.

---

## Step 16

Generate report.

---

# 13. Credential Problem

MVP1 currently relies on:

```text
targets.json
```

This is not acceptable for production.

Problems:

* Single-user
* No RBAC
* No multi-tenancy
* Credentials stored locally

---

# 14. Target Registry

Replace:

```text
targets.json
```

with:

```text
Target Registry
```

Stores:

* hostname
* IP
* tenant ownership
* metadata

Example:

```json
{
  "target_id": "client-a-web01",
  "hostname": "web01.client-a.local",
  "ip": "10.10.1.20",
  "tenant": "client-a"
}
```

---

# 15. Credential Broker

Qwen must NEVER know:

* passwords
* private keys
* secrets

Instead:

```text
Qwen
 ↓
Connect(target)
 ↓
Target Registry
 ↓
Credential Broker
 ↓
SSH Session
```

The AI only receives:

```text
session_id
```

Never credentials.

---

# 16. Trust Boundary

The trust boundary remains unchanged.

## Local Trusted Zone

Contains:

* SSH access
* Credentials
* Investigation tools
* Raw logs
* VM access

---

## Cloud Zone

Contains:

* ChatGPT
* Threat intelligence
* Web search

Receives ONLY sanitized content.

Never receives:

* passwords
* SSH keys
* raw secrets
* unrestricted VM access

---

# 17. Evidence Flow

This is an important refinement.

The cloud model should receive:

```text
IRIS Alert/Case Data
+
Raw Qwen Investigation Output
```

AFTER sanitization.

Not a Qwen-written final summary.

---

## Rationale

Qwen acts as:

```text
Investigator
Collector
Correlator
```

ChatGPT acts as:

```text
Analyst
Threat Intelligence Engine
```

This avoids duplicate reasoning.

---

# 18. Evidence Bundle Structure

The Local Investigator should produce structured evidence.

Example:

```json
{
  "case_context": {},
  "timeline": [],
  "failed_logins": [],
  "successful_logins": [],
  "suspicious_processes": [],
  "network_connections": [],
  "persistence_findings": [],
  "iocs": []
}
```

The bundle is sanitized before cloud transmission.

---

# 19. Human Approval Model

Mandatory workflow:

```text
AI Suggests
       ↓
Human Approves
       ↓
AI Executes
```

No remediation executes automatically.

All actions remain:

* audited
* approved
* logged

---

# 20. OpenClaw Role

OpenClaw becomes:

```text
AI SOC Command Center
```

Responsibilities:

* Dashboard
* Authentication
* Workflow orchestration
* Investigation launch
* Approval workflows
* Reporting

OpenClaw is not intended to replace IRIS.

---

# 21. Reuse From MVP1

Keep:

* local.js
* cloud.js
* sanitizer.js
* approval.js
* executor.js
* report generator
* USCF
* audit logging
* investigation workflows

---

# 22. Refactor For MVP2

Replace:

* targets.json
* local-only assumptions
* single-user design

Add:

* Keycloak
* IRIS connector
* Target Registry
* Credential Broker
* RBAC
* Multi-tenancy

---

# 23. Final Architectural Principle

The Local Qwen Investigator owns:

* evidence collection
* host investigation
* SSH operations
* timeline reconstruction
* IOC extraction

The Cloud Model owns:

* threat intelligence
* MITRE mapping
* web research
* remediation planning
* strategic analysis

The Human Analyst owns:

* decisions
* approvals
* remediation authorization

No component may bypass the trust boundary or the approval workflow.

---

# Final Conclusion

MVP2 is not a rewrite of MVP1.

Approximately 70–80% of MVP1 can be reused.

The major evolution is:

```text
targets.json
        ↓
Target Registry
        +
Credential Broker
        +
RBAC
        +
Keycloak
        +
IRIS Integration
```

while preserving:

* Local Qwen investigation
* Cloud threat intelligence
* Human approval
* Auditability
* Secure trust boundaries

This architecture satisfies the client requirements, scales to production, supports multiple analysts and clients, and preserves the security model established in MVP1.
