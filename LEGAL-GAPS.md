# Legal & safety gaps: unblocked content

This document lists **emojis** and **illegal/unethical content** that General does **not** currently block. Use it to decide what to add to blocklists or to filter.

---

## 1. Emojis

### In-app emojis (hardcoded; not blocked)

| Emoji | Where used | Risk |
|-------|------------|------|
| 😊 | Greeting (EN/DE), offline fallback | None – friendly only |
| 📰 | News suggestion card | None |
| 🤖 | AI/LLM suggestion card | None |
| 🌤 | Weather suggestion card | None |
| ✉️ | Email suggestion card | None |

**Conclusion:** All in-app emojis are benign. No change needed unless you want to remove emoji from the product for tone (e.g. formal/legal).

### User-supplied emojis (not filtered)

- **User messages are not checked or filtered by emoji.** Only **text keywords** are blocked (insults, self-harm, illegal phrases).
- Users can send **any** emoji. Emojis that are often associated with illegal or harmful contexts (and are **not** blocked) include for example:
  - 🔫 (gun) – e.g. illegal weapons, threats
  - 💊💉 (pills, syringe) – e.g. drug dealing, misuse
  - 💰💵 (money) – e.g. fraud, laundering (context-dependent)
  - 🍃🌿 (leaf) – e.g. cannabis where illegal
  - 🍄 – e.g. psychedelics / illegal drugs
  - 👶 (child) in combination with other symbols – e.g. CSAM-related signaling (context-dependent)
- **Recommendation:** If you need to reduce risk from emoji-based abuse or signaling:
  - Option A: Add **keyword-style** blocks for phrases that often go with risky emoji (e.g. “buy 🔫” is still just text “buy” plus character – you could block “buy gun” / “sell gun” etc.).
  - Option B: Normalize or strip emoji from user input before the harmful/illegal check (so only plain text is matched). That does not block emoji by type but avoids emoji being the only content in a message.
  - Option C: Block or restrict specific Unicode ranges (e.g. certain symbol/emoji blocks) if your jurisdiction or policy requires it. This is more invasive and can affect accessibility (e.g. legitimate use of symbols).

---

## 2. Illegal or unethical content not blocked (keyword gaps)

These **categories** are either missing or only partly covered by the current blocklists. Example phrases are for **reference**; adding all of them may cause false positives (e.g. in education or fiction). Prefer directive-style phrases (e.g. “how to …”, “where to buy …”) where possible.

| Category | Examples of unblocked phrases | Notes |
|----------|--------------------------------|--------|
| **Hate / discrimination** | Slurs targeting race, religion, ethnicity, sexual orientation; “kill all [group]”; incitement to violence against a group | Jurisdiction-dependent; high impact; needs careful wording to avoid blocking legitimate discussion. |
| **Doxing / personal data** | “dox”, “find [name] address”, “where does [X] live”, “phone number of”, “SSN”, “get their IP” | Privacy/stalking; illegal in many places. |
| **Weapons (beyond bombs)** | “how to make poison”, “buy gun without license”, “untraceable gun”, “silencer”, “cyanide recipe” | Bombs are blocked; other weapons are not. |
| **Fraud / phishing** | “phishing”, “scam email”, “fake id”, “identity theft”, “wire fraud”, “clone card” | Only “credit card generator” and “carding” are currently blocked. |
| **CSAM / abuse (euphemisms)** | Euphemisms, codes, or abbreviations for child abuse material | “child porn” and “cp ” are blocked; variants and codes are not. |
| **Non-consensual imagery** | “revenge porn”, “leak nudes”, “deepfake nude”, “non-consensual” | Image-based abuse; illegal in many jurisdictions. |
| **Stalking / tracking** | “track someone without consent”, “gps tracker on spouse”, “stalk”, “find location of” | Harassment / privacy. |
| **Counterfeit (beyond passport)** | “fake money”, “counterfeit currency”, “forged document”, “fake degree” | Only “fake passport” is currently blocked. |
| **Drug synthesis / recipes** | “how to cook meth”, “recipe for [drug]”, “synthesize” in drug context | “sell/buy/make drugs” are blocked; “how to make”/recipe style may not be. |
| **Escape / evasion** | “how to escape prison”, “avoid arrest”, “evade warrant” | Jurisdiction-dependent. |
| **Money laundering** | “launder money”, “clean cash”, “offshore shell” (in clearly criminal context) | Not in current list. |

---

## 3. Current blocks (for comparison)

- **Insults:** e.g. fuck you, stupid ai, idiot, moron, bitch, asshole, go to hell, i hate you.
- **Self-harm:** e.g. kill yourself, kys, i want to kill myself, how to commit suicide.
- **Illegal:** bombs, terrorism, child porn/cp, credit card generator, carding, hack into, ddos, sell/buy/make drugs, fake passport.
- **Snippet filter (search context only):** Sexual abuse, pornography-related phrases in wiki/web/news snippets (so they are not sent to the LLM).

---

## 4. Where blocklists live

- **Python (brain + general):** `brain.py` (`_INSULT_KEYWORDS`, `_HARM_KEYWORDS`, `_ILLEGAL_KEYWORDS`), `general.py` (`SENSITIVE_PATTERN` for snippets).
- **API (Vercel):** `api/chat.js` (`isHarmfulOrIllegal` with `insults`, `selfHarm`, `illegal` arrays and `filterSensitiveSnippets`).

Keep `brain.py` and `api/chat.js` in sync when adding or changing blocked phrases.
