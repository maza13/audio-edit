# RCA Methodology — 5-Question Chain

Root Cause Analysis using the 5-question chain method. Each question builds
on the previous to trace the failure to its origin.

---

## The 5 Questions

### Question 1: What happened?

**Purpose**: Establish concrete facts about the failure.

**Requirements**:
- Describe in 1-3 sentences
- Focus on observable facts, not interpretation
- Include exact error messages, return values, or symptoms
- State what was being attempted when failure occurred

**Bad example**: "The skill failed because it was broken"

**Good example**: "Search skill returned empty array when searching for
"config*.json" in the project directory, even though the file exists at
src/config/config.json"

---

### Question 2: What was the expected behavior?

**Purpose**: Define the correct path to compare against.

**Requirements**:
- Describe the intended outcome
- Reference documented behavior if available
- Clarify assumptions about what "should happen"

**Bad example**: "It should have worked"

**Good example**: "The glob tool should return all paths matching the pattern,
including files in subdirectories when the recursive flag is set"

---

### Question 3: What caused the failure?

**Purpose**: Find the immediate trigger.

**Requirements**:
- Identify the specific code, config, or assumption that triggered failure
- Trace the chain from user action to error
- Check: was it a missing feature, wrong tool, bad input, or unexpected state?

**Common causes in multi-agent systems**:
- Missing validation on input
- Wrong tool for the data type
- Assumed directory structure that doesn't match reality
- Configuration mismatch between environments
- Race condition in parallel execution

---

### Question 4: Why was the cause not caught earlier?

**Purpose**: Identify the gap in prevention/detection.

**Requirements**:
- Look for: missing test, no validation, no documentation, no safeguards
- Determine if this is a one-off or systemic gap
- Check if similar issues have occurred before

**Good answer**: "There was no validation that glob patterns with wildcards
required recursive search. The skill assumed flat directory structure."

**Even better**: "The skill had no test coverage for nested directory scenarios.
No integration test verified wildcard + recursive behavior."

Before answering this question, check whether memory already contains a similar
incident. Historical recurrence can change the answer from "missing validation"
to "known recurring pattern with insufficient systemic response."

---

### Question 5: How to prevent recurrence?

**Purpose**: Generate actionable, specific changes.

**Requirements**:
- 2-4 concrete actions, not vague recommendations
- Each action should be verifiable
- Prefer: add validation, add test, update documentation, fix code
- If process change needed, specify the new process

**Bad example**: "Be more careful next time"

**Good example**:
1. Add validation: if glob returns empty and pattern has wildcard, retry with recursive flag
2. Add integration test for wildcard + recursive scenario
3. Update search skill documentation to clarify default behavior

---

## Lite Version (3-Question)

For quick analysis when user says "quick" or "lite":

1. What happened? (1 line)
2. How fix it? (1 line)
3. How prevent? (1 line)

The lite version sacrifices depth for speed. Use only when full RCA would be
disproportionate to the incident severity.

---

## Validation Checklist

After completing the 5 questions:

- [ ] Q1 describes observable facts, not interpretation
- [ ] Q2 defines expected behavior clearly
- [ ] Q3 identifies specific cause, not vague category
- [ ] Q4 explains the gap, not just "missed it"
- [ ] Q5 has 2-4 concrete actions, each verifiable
- [ ] No circular reasoning (cause doesn't depend on itself)
- [ ] Type classification matches the evidence
- [ ] Severity is proportional to actual impact
- [ ] Memory scope is correct: project by default, personal/general only if portable
- [ ] Similar past incidents were checked when recurrence was plausible
