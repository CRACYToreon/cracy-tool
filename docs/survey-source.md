# Survey source: CRA questionnaire (original build)

## Mapping provenance

Clause-level links from CRA Annex I rows to NIST SP 800-63B, ISO/IEC 15408 (Common Criteria), ETSI EN 303 645, IEC 62443-4-2, and ISO/IEC 27002 are stored in `data/mapping/layer2-requirements.json` and related files. They are **project-authored cross-mappings** for workshops and gap discussion. They are **not** official ENISA crosswalk tables, EU legal interpretation, or publications from NIST, ISO, or ETSI that endorse this matrix.

---

## Related Essential Requirements

- **Part I (b)** — secure by default configuration; possibility to reset to original state
- **Part I (d)** — protection from unauthorised access; control mechanisms; report on possible unauthorised access
- **Part I (e)** — confidentiality of data (encryption at rest/transit, technical means)
- **Part I (f)** — integrity of data, commands, programs, configuration; report on corruptions
- **Part I (l)** — security-related information; recording and monitoring; opt-out for user

---

## Question development

### Q1 — INTERFACES (routing for this tool only)

**For this IAM-focused questionnaire, does the product expose interaction surfaces where users, administrators, other devices, or remote services can obtain access, configuration, or control in a way that involves identity or access?** The question routes this questionnaire only; it does **not** substitute legal CRA “product with digital elements” qualification.

- → **No:** End of this questionnaire path; no mapped CRA–framework report. Not the same as concluding the product is outside the CRA—document classification separately.
- → **Yes:** Continue to Q2.

---

### Q2 — AUTHENTICATION COVERAGE

**Does the PDE implement authentication on ALL interaction surfaces answered “Yes” in Q1?**  
For each surface: is there a mechanism that verifies the identity of the entity (user, device, service) before granting access? Include both human-facing and machine-to-machine interfaces.

- → **All interfaces have authentication:** Continue to Q4.
- → **Some interfaces have authentication, some do not:** GAP — Document which interfaces lack authentication. Potential violation of Annex I, 2(d) and 2(j). Continue to Q3 for the unprotected interfaces AND Q4 for the protected ones.
- → **No authentication at all:** Continue to Q3 (Architecture C assessment).

---

### Q3 — ARCHITECTURE C ASSESSMENT

The PDE has no (or inadequate) authentication. Assess the current state:

#### Q3a — DEFAULT/HARDCODED CREDENTIALS

**Does the PDE ship with hardcoded or shared default credentials?**

- → **Yes:**  
  ⛔ NON-COMPLIANCE  
  Violates: 2(b) secure defaults, 2(d) access control, 2(e) credential confidentiality, 2(i) impact on other devices (if credentials shared across).  
  **Required action:** Implement unique per-device credentials (factory-provisioned or forced first-use setup).

#### Q3b — RISK JUSTIFICATION

**Is the absence of authentication documented with a risk justification?**

- → **Yes — justification exists:**  
  ℹ JUSTIFIED ABSENCE — VERIFY  
  Review the justification. Justification is typically only defensible if the PDE has no network connectivity AND processes no data affecting security/safety/privacy. **Architecture C** (no or minimal in-product IAM): maintain Art. 13(4) documentation and residual risk review.

- → **No — justification missing:**  
  The manufacturer must either: (a) implement authentication, or (b) produce a defensible Art. 13(4) justification. In practice, (a) is almost always required for any connected PDE. **Architecture C** until remediated or justified.

---

### Q4 — IAM ARCHITECTURE

**Where does authentication and access control happen?**  
Consider the full authentication flow: where credentials are verified, where access decisions are made, and where they are enforced.

- → **Entirely on-device (local credentials, local decision, local enforcement):** Architecture A. Continue to Q6.
- → **Entirely via remote/cloud service:** Architecture B — Continue to Q5, then Q6.
- → **Both local AND remote (hybrid):** Architecture A+B — Continue to Q5 for the remote component, then Q6.
- → **Delegated to customer's existing infrastructure (LDAP, Active Directory, RADIUS, SAML/OIDC federation to customer IdP):** Architecture D. Continue to Q6.

*Note on Architecture D:* Distinct from Architecture B. In B the manufacturer operates the remote IAM service. In D the PDE integrates into the customer's IAM — manufacturer provides integration but does not operate the IAM service. CRA scope: Architecture D's customer-side IAM is not the manufacturer's "remote data processing solution."

---

### Q5 — REMOTE IAM CRA SCOPE

**Was the remote IAM service designed by or on behalf of the PDE manufacturer?**  
CRA Article 3(2) defines "remote data processing solution" as software designed by or on behalf of the manufacturer, without which the PDE cannot perform one of its functions.

- → **Yes — manufacturer's own cloud backend or commissioned development:**  
  Architecture B — FULL CRA SCOPE. The remote IAM service is within CRA scope. All Annex I requirements apply.

- → **No — third-party service (Auth0, AWS Cognito, Azure AD B2C, Firebase Auth, etc.):**  
  Architecture B — THIRD-PARTY. Third-party IAM is outside CRA remote data processing scope. Due diligence under Art. 13(5) applies. PDE must still meet all essential requirements.

- → **Partially — manufacturer's orchestration/customisation layer on top of third-party IdP:**  
  Architecture B — HYBRID SCOPE. Manufacturer's layer: full CRA scope. Underlying third-party IdP: due diligence only.

---

### Q6 — RISK CALIBRATION

**What does the IAM function protect?** (select all that apply)  
Determines "appropriate" level of access control per Annex I, 2(d). Highest applicable category sets the risk level.

- □ Configuration and management only (device settings, firmware update, diagnostic access)
- □ User data access (personal data, usage data, stored content)
- □ Physical safety functions (door locks, medical devices, industrial actuators, vehicle controls)
- □ Access to other connected systems (gateway/hub, network infrastructure, industrial control systems)

| Highest applicable category       | Risk level  |
|----------------------------------|-------------|
| Configuration/management only     | STANDARD    |
| User data access                  | ELEVATED    |
| Physical safety OR connected systems | HIGH     |

---

### Q7 — CREDENTIAL ARCHITECTURE

**How are initial credentials established?**

- → **Unique per-device (factory-provisioned or mandatory first-use setup):** COMPLIANT with 2(b)
- → **Shared default, change enforced (device refuses to operate until credentials are changed):** ACCEPTABLE — verify enforcement is robust (cannot be bypassed)
- → **Shared default, change optional:** NON-COMPLIANT with 2(b) — many users will never change defaults
- → **No credentials (open access):** NON-COMPLIANT with 2(b) and 2(d)

---

### Q8 — OPERATIONAL OPTIONS

Feature and pattern detection — each "Yes" triggers additional specific controls. Independent of architecture (Q4/Q5).

| #    | Question | If Yes | If No |
|-----|----------|--------|--------|
| Q8a | Does the PDE support multiple user roles or privilege levels? (e.g., admin vs user, operator vs engineer, read-only vs read-write) | + RBAC controls. Least privilege by default 2(d). Role separation. Document roles in user instructions Annex II, 8(a). | Verify: minimum separation between administrative and normal operation. |
| Q8b | Does the PDE store credentials locally? (passwords, tokens, certificates, keys — on the device itself) | + Encryption at rest. State-of-the-art credential storage 2(e). Passwords: Argon2id/bcrypt/scrypt. Keys/tokens: encrypted or hardware-backed. | Determine where credentials ARE stored. If cloud-only: Architecture B controls cover cloud side. If Architecture D: document that PDE does not store credentials. |
| Q8c | Can the PDE operate its essential functions if the remote IAM is unavailable? (Only for Architecture B / A+B) | + Offline/fallback controls. Define fallback authentication 2(h). Bounded validity for cached credentials. Document fallback behaviour. | AVAILABILITY RISK. Cloud outage = total loss of PDE functionality. Mitigation plan required. |
| Q8d | Does the PDE log authentication and access events? (successful/failed logins, access decisions, credential/config changes) | + Audit controls. Verify completeness per 2(l): auth attempts, access decisions, credential changes, config changes. User opt-out. Tamper protection on logs. | GAP. Violates 2(d) and 2(l). Must implement before Dec 2027. |
| Q8e | Can the IAM component be updated independently of the full firmware/software? | GOOD. Supports rapid security patching. Aligns with Part II(2) separation of security and feature updates. | RISK. Auth vulnerability requires full firmware update. Document update path in vulnerability handling plan. |

---

## Architectures (from CRACY D2.3 + extensions)

- **Standalone = Architecture A** — Authentication and authorization entirely within the product; core access control operates independently.
- **Remote = Architecture B** — Cloud-based authentication/authorization; distinction by who develops/controls the cloud software:
  - **B-FULL** — Manufacturer-developed cloud access service (full CRA scope).
  - **B-3P** — Third-party developed cloud access service (due diligence; PDE must still meet essential requirements).
  - **B-HYBRID** — Manufacturer's layer on top of third-party IdP (full scope for own layer, 3P for IdP).
- **No/inadequate IAM = Architecture C** — Not in scope, or protection by another component, or lack requiring remediation.
- **Customer infrastructure integration = Architecture D** — Manufacturer provides integration point; does not operate IAM. Distinct from B; different liability and controls (Annex II, 8(f) integration guidance).
