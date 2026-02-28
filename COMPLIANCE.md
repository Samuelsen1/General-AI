# EU and German legal compliance – General

This document summarises how **General** aligns with the **EU AI Act** and **German** data protection and platform rules. It is for transparency and internal documentation, not legal advice.

---

## 1. EU AI Act

### Risk classification

General is a **limited-risk** AI system under the EU AI Act: it is an AI system intended to interact directly with natural persons (a chatbot). It is not high-risk and does not perform social scoring or other prohibited practices.

### Article 50 – Transparency (limited-risk)

- **Obligation:** Users must be informed that they are interacting with an AI system, in a clear and distinguishable manner, at the latest at the time of first interaction.
- **Implementation:**
  - **UI:** A permanent disclosure line is shown near the chat input: *"You are chatting with an AI. Answers can be wrong or outdated. Not legal, medical, or financial advice."* (EN) / *"Sie chatten mit einer KI. …"* (DE). This satisfies “at the time of first interaction” and remains visible.
  - **Model behaviour:** The system prompt instructs the model to identify as an AI (General) and, when asked, to state that it is an AI and can make mistakes.
- **Accessibility:** The disclosure is text-based and in the same view as the main interaction; it can be read by screen readers (role="status").

### Prohibited practices (Art. 5)

General does not deploy:

- Subliminal or manipulative techniques beyond the user’s consciousness.
- Exploitation of vulnerabilities (e.g. age, disability) to distort behaviour.
- Social scoring.
- Real-time remote biometric identification in publicly accessible spaces (no such functionality).

### Fundamental rights

Content moderation (blocklists for illegal and harmful user input, snippet filtering for sensitive search results) is in place to reduce risks to fundamental rights. See `LEGAL-GAPS.md` and the blocklists in `brain.py` and `api/chat.js`.

---

## 2. German law

### GDPR / BDSG (data protection)

- **Privacy policy (Datenschutzerklärung):** Available at **privacy.html** (EN/DE). It states:
  - Controller: Samuel Afriyie Opoku, Lübeck, with contact email.
  - Data processed: messages, chat history (including localStorage), attachments, technical/log data.
  - Legal basis: Art. 6(1)(b) (contract) and Art. 6(1)(f) (legitimate interests) where applicable.
  - Retention: no retention of chat content on our systems; localStorage is user-controlled; provider logs as per provider policy.
  - Rights: access, rectification, erasure, restriction, portability, object, withdraw consent, complain to a supervisory authority (e.g. Landesdatenschutzbehörde).
- **Data minimization:** Only data necessary for providing the chat and operating the service is processed; no use of user content for model training.

### NetzDG (Network Enforcement Act)

- Where the service qualifies as a “social platform” under NetzDG, obligations (e.g. complaint mechanisms, transparency reports) may apply. We provide a **report mechanism** (e.g. “Report content” link to contact email) so that users can report illegal content. Complaints are handled in line with our procedures and legal obligations. Terms of use (**terms.html**) state acceptable use and reference reporting.

### Other

- No specific German “KI-Gesetz” beyond the EU AI Act implementation is assumed here; the EU AI Act will be applied in Germany via the standard EU regulation mechanism.

---

## 3. Where it is implemented in the project

| Requirement | Where |
|-------------|--------|
| AI disclosure (Art. 50) | `index.html`: `.ai-disclosure` + translations `aiDisclosure` (EN/DE); system prompts in `llm.py` and `api/chat.js` (identify as AI). |
| Privacy policy | `privacy.html` (EN/DE). |
| Terms & AI use / acceptable use | `terms.html` (EN/DE). |
| Report content | `index.html`: footer link (e.g. mailto) + `terms.html` reporting section. |
| Content moderation | `brain.py`, `api/chat.js` (harmful/illegal blocklists); `general.py`, `api/chat.js` (sensitive snippet filter). |
| Documentation | This file (`COMPLIANCE.md`), `LEGAL-GAPS.md`. |

---

## 4. Maintenance

- Keep privacy and terms pages updated if processing or legal basis changes.
- Review blocklists and snippet filters when new risks or regulations appear.
- When the EU AI Act becomes fully applicable (including relevant deadlines, e.g. 2026), recheck Art. 50 and any further guidance on limited-risk systems and adjust UI or wording if needed.

**Creator not exempt:** The same transparency, content moderation, privacy, and acceptable-use rules apply to everyone, including the creator (Samuel Afriyie Opoku). There is no bypass of safety or compliance for the creator.

**Last updated:** February 2025.
