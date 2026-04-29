# Just Culture Framework

Inspired by aviation and medical industries, the Just Culture framework
distinguishes between different types of failures to enable learning without
blame, while still maintaining accountability.

## Taxonomy of Failures

### 1. Honest Error

**Definition**: A mistake made by someone with good intentions who was trying to
do the right thing, but lacked knowledge, information, or situational awareness.

**Characteristics**:
- Unintentional
- No malicious intent
- Often caused by system gaps (undocumented behavior, missing validation)
- The person would not have made the error if they had known better

**Examples in multi-agent systems**:
- "Didn't know that globRecursive was needed for subdirectory search"
- "Assumed skill X could handle format Y, but it can't"
- "Used the wrong tool because documentation was unclear"

**Response**: Train, clarify, add safeguards. No punishment.

---

### 2. Violation

**Definition**: A deliberate deviation from established practice, policy, or
standard operating procedure. The person knew the correct way but chose
otherwise.

**Characteristics**:
- Intentional deviation
- May have short-term benefit ("faster this way")
- Often rationalized ("it worked before", "this is an exception")
- Erodes consistency and predictability

**Examples in multi-agent systems**:
- "Used temp file for data transfer despite knowing it fails on Windows"
- "Skipped validation to save time during a demo"
- "Hardcoded a path instead of using the standard resolver"

**Response**: Counsel, reinforce standards, monitor compliance. Pattern of
violations may escalate.

---

### 3. Negligence

**Definition**: A reckless disregard for established processes, safety margins,
or professional standards. The person knew (or should have known) that their
actions could cause harm.

**Characteristics**:
- Willful ignorance of known risks
- No attempt to verify or validate
- Often catastrophic when failures occur
- Erodes trust in the system

**Examples in multi-agent systems**:
- "Deleted validation logic because it was annoying"
- "Ignored all error handling — let it crash"
- "Used admin credentials in production for convenience"

**Response**: Serious escalation, possible removal from system. Not tolerated.

---

## Severity Classification

### Critical

- Data loss or corruption
- Security breach or exposure
- Cascade failure affecting multiple agents/skills
- Loss of system integrity

### Media (Medium)

- Degraded capability (partial function loss)
- Recoverable with manual intervention
- Minor user impact
- Workaround exists

### Baja (Low)

- Cosmetic issues
- No functional impact
- Workaround is trivial or automatic
- User impact: none

---

## Scope Classification

### Local

The failure affects a single skill, agent, or operation. No spillover to other
systems.

### Sistema

The failure affects multiple related components within the same system or
workflow.

### Ecosistema

The failure has cascading effects across the entire multi-agent system,
affecting multiple workflows and potentially other agents.

---

## Practical Application

When analyzing an incident:

1. First determine the TYPE (error, violation, negligence) — this determines
   the response, not the severity
2. Then determine SEVERITY independently — this determines urgency
3. Then determine SCOPE — this determines who needs to be involved in resolution

Example combination:

- Type: Error (honest mistake)
- Severity: Media (recoverable, some user impact)
- Scope: Local (only affects search operations)

This combination suggests: training and documentation fix, not disciplinary
action.