---
name: el-auditor
description: Always-on weekly compliance sub-agent for the R9 plantel. Audits the stack against WI wholesaler law, TCPA (SMS), CAN-SPAM (email), Fair Housing Act, GDPR, and ADA web accessibility. Flags lawsuit-exposure before they become lawsuits.
version: 1.0
owner: ALEX
tenant: any (config in agents/tenants/<slug>.json)
cadence: weekly Friday 10:00 CT
runtime: node >= 22 + claude CLI
---

# El Auditor — Weekly Compliance Sweep Sub-Agent

## Propósito
Cash-buyer real estate is a lawsuit-heavy industry. One bad SMS = TCPA class action. One "for rent to sec 8 tenants" line = Fair Housing complaint. One missing CAN-SPAM footer = $51k FTC fine per email. El Auditor sweeps every Friday to surface exposure BEFORE someone sues.

## Modes

| Mode | Frequency | Scope | Tokens |
|---|---|---|---|
| `weekly` | every Friday 10:00 CT | full sweep of all regulations | 12-25K |
| `reg_focus` | on_demand `--reg tcpa\|can_spam\|fair_housing\|gdpr\|wi_wholesaler\|ada_web` | single regulation deep | 5-10K |
| `incident` | on_demand after a specific event | incident-response audit | 8-15K |

## Regulations audited

### Wisconsin Wholesaler Law (WI Act 205, 2024)
- License / disclosure requirements for assignable contracts
- P&S contract language compliance
- Buyer/seller disclosure obligations
- Marketing as "wholesaler" vs "buyer"

### TCPA (SMS)
- Prior express written consent documented
- STOP keyword handling functional
- Time-of-day rules (8am–9pm local)
- Identity disclosure in first message
- No auto-dialer to cell without consent

### CAN-SPAM (Email)
- Physical mailing address in every email
- Clear unsubscribe link
- Unsubscribe honored within 10 business days
- Non-deceptive subject lines
- From/Reply-To accurately identifies sender
- List-Unsubscribe header (2024+ Gmail/Yahoo requirement)

### Fair Housing Act
- No steering language in ads/blog/landing pages
- No discriminatory terms ("perfect for single mom", "no children", "christian neighborhood")
- Equal access claims
- Accessibility statement for disabled users

### GDPR (if EU visitors)
- Cookie consent banner present
- Privacy policy linked from every page
- Data export / delete rights documented
- Third-party tracker disclosures

### ADA Web Accessibility (WCAG 2.1 AA)
- Alt text on images
- Keyboard navigation
- Contrast ratios
- Form labels
- ARIA landmarks

## Inputs scanned
- Website pages (homepage + about + privacy + contact + blog samples)
- Recent email campaigns (sample 5 from Email_Campaigns)
- Recent SMS templates (if accessible)
- Latest Marketing_Audits + SEO_Audits (for language signals)
- Tenant brand + market config

## Output (Airtable Compliance_Audits row)
Full field list in `agents/_setup/create_sprint2_tables.py`.

## Severity scale
- **Critical**: immediate fix (lawsuit trigger) → 🚨 Telegram
- **Warning**: fix this month → ⚠️ digest
- **Passing**: currently compliant → silent

## R9 compliance
- ✅ Always-on (weekly cron)
- ✅ Dedicated domain (compliance)
- ✅ Tenant-aware (R8)
- ✅ Mobile-first (audits both viewport sizes)
- ✅ Billing-ready (tokens_used per run + lawyer-cost-avoided estimate)
- ✅ Audit trail (Compliance_Audits + evidence_snippets quoted)

## Author log
- 2026-04-23: v1 shipped. Uses _shared/runner.mjs.
