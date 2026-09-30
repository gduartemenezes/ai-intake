# Intake — product requirements (v0)

**Status:** draft · **Owner:** Gustavo Duarte Menezes · **Last updated:** 2026-09-29

## Problem

Small operations teams receive invoices and receipts as unstructured attachments — photos taken
on a phone, scanned PDFs, forwarded email attachments. Someone opens each file, reads it, and
retypes supplier name, document number, date, and total into a spreadsheet or an ERP.

This is slow and, worse, silently wrong. A transposed digit in a total is indistinguishable from
a correct one once it lands in the sheet. Nobody knows which entries were rushed, and there is no
record of what the original document actually said.

The hard part is not reading a clean invoice — OCR and an LLM handle that. The hard part is
knowing **when the system got it wrong**, making that case cheap to catch and fix, and **avoiding expensive generative LLM calls on unreadable or invalid documents** by using fast, typed System 1 models (Jev).

## User

An operations analyst at a company processing roughly 50–500 documents a month: too many to
enjoy, too few to justify buying an enterprise AP platform. They care about finishing the queue
and about not being blamed for a wrong number.

## End-to-end flow

1. **Ingest** — a document arrives through an HTTP endpoint (a channel adapter; the first
   implementation is a simulator that posts files, so the pipeline is not blocked on any
   messaging provider). The raw payload is stored before anything is interpreted.
2. **Store** — the file goes to object storage; a `Document` row records checksum, MIME type,
   size, and source.
3. **Extract text** — OCR produces raw text, kept verbatim alongside the file.
4. **Fast Triage (Jev — System 1)** — Jev runs non-autoregressive, fast typed judgments over the text:
   - **Type Classification (`Choice`):** Validates document category (`Invoice`, `Receipt`, `Unsupported`). Early-exits invalid types with reason `unsupported_type`.
   - **Legibility Score (`Score`/`Noul`):** Assesses OCR text quality. Early-routes unreadable documents to review with reason `ocr_unreadable`, bypassing LLM field extraction.
5. **Extract fields (Generative LLM — System 2)** — an LLM returns a structured candidate: supplier, document number, issue
   date, currency, total, line-item count. Every field carries candidate values.
6. **Validate & Calibrate** — deterministic rules run over the candidate (date parseable & not future, total matches sum of line items, currency known, shape valid). Rules are the authority; the model only proposes. Jev calibrates confidence probability.
7. **Route** — a case either passes automatically or enters the review queue, with a stated
   reason (`unsupported_type`, `ocr_unreadable`, `low_confidence`, `rule_failed`).
8. **Review** — a human sees the document next to the extracted fields, corrects what is wrong,
   and confirms. Corrections are recorded as a diff against the model output.
9. **Audit** — every transition is appended to an immutable event log: who or what caused it,
   when, and with what payload.

## Non-goals (v0)

- **Multi-tenancy.** Single workspace.
- **RAG, embeddings, vector search.** Nothing here is retrieval.
- **Agents or multi-step tool-calling.** The flow is a linear pipeline with a state machine;
  orchestration frameworks are not justified until it stops being linear.
- **Jev for generative text generation.** Jev handles fast typed triage (`Choice`, `Score`, `Noul`); generative field extraction remains with LLMs.
- **Real WhatsApp/Email connectivity.** The channel is an interface with a simulator behind it.
- **Model comparison and prompt A/B testing.** One model, one prompt version, versioned.
- **Analytics dashboards.** Operational counters only, no BI.
- **Approval workflows, payments, ERP write-back.** Extraction and review end the flow.

## Success metrics

| Metric | Definition | v0 target |
|---|---|---|
| **Straight-through rate** | Cases auto-approved without human edit, over total cases | ≥ 60% on the eval set |
| **Silent error rate** | Auto-approved cases where a field was actually wrong, measured against a hand-labelled set of 50 documents | ≤ 2% |
| **p95 time to decision** | Ingest to terminal state (auto-approved or queued for review) | ≤ 60s |
| **Triage short-circuit rate** | Unreadable/invalid documents rejected by Jev before LLM field extraction | 100% of bad inputs |

Straight-through rate alone is a trap: a system that approves everything scores 100%. The pair
that matters is straight-through rate **held up against** silent error rate — automation is only
worth having if the things it waves through are actually right.

## Out of scope for this document

Data model, state transitions, and infrastructure decisions live in `docs/architecture/`.
