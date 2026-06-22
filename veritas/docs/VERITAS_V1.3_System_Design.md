# VERITAS — AI Truth Encyclopedia System
## System Design Document — Version 1.3
### Production-Grade Knowledge Construction Engine

**Status:** Active  
**Classification:** Internal Engineering Spec  
**Governance:** VERITAS Epistemic Commitment Statement V1.0  
**Last Review:** Incorporates architectural review (DAG + Claim Graph) + epistemic layer defense + signal-detection engineering constraints

---

## 1. System Identity & Commitments

### 1.1 What VERITAS Is
VERITAS is a knowledge construction engine designed to produce structured, evidence-grounded encyclopedia articles. It is an active system that seeks out the best available evidence, surfaces what has been institutionally buried, and exposes the linguistic and structural mechanisms by which information is distorted.

### 1.2 What VERITAS Is Not
* A chatbot
* A summarizer
* A Wikipedia scraper
* A neutral disagreement tracker
* A passive evidence-structure debugger

### 1.3 Core Epistemic Commitment
Organized suppression of information by powerful institutions is a documented historical and contemporary reality. A knowledge system that does not model the absence of evidence as a meaningful signal will silently reproduce the gaps created by that suppression. VERITAS refuses to be that system.

### 1.4 Governing Constraints
1. All epistemic layers are signal detection systems, not truth adjudication systems. They surface anomalies, highlight structural properties of evidence, expose language transformations, and enforce weighting rules. They do not infer intent without external metadata.
2. The system labels cause of absence only when external metadata directly supports the label. Otherwise, the gap is flagged and cause marked unknown.
3. The system exposes framing; it does not enforce replacements.
4. Elevated scrutiny is triggered by structural risk factors, not by pre-assigned truth values.
5. All claims are probabilistic. The system surfaces its reasoning and invites correction.

---

## 2. Architecture Overview

```
User Query
    │
    ▼
Go API Gateway (SSE + Auth + Rate Limiting)
    │
    ▼
Go Workflow Orchestrator (DAG Engine)
    │
    ▼
Task Queue (Redis Streams)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│             Python Execution Layer                  │
│             (Stateless Task Workers)                │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Retrieve │  │  Claim   │  │ Evidence │           │
│  │   Node   │→ │ Extract  │→ │   Map    │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│                                        │            │
│                    ┌───────────────────┘            │
│                    ▼                                │
│  ┌──────────────────────────────────────┐           │
│  │         Critique Node                │           │
│  │  (Structured Multi-Factor Eval)      │           │
│  └──────────────────────────────────────┘           │
│                    │                                │
│        ┌───────────┼───────────┐                    │
│        ▼           ▼           ▼                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Missing  │ │ Precision│ │Collective│           │
│  │ Evidence │ │ Language │ │Accusation│           │
│  │ Detector │ │  Mapper  │ │ Scrutiny │           │
│  └──────────┘ └──────────┘ └──────────┘           │
│                    │                                │
│                    ▼                                │
│  ┌──────────────────────────────────────┐           │
│  │         Resolver Node                │           │
│  └──────────────────────────────────────┘           │
│                    │                                │
│                    ▼                                │
│  ┌──────────────────────────────────────┐           │
│  │       Article Generator Node         │           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
    │
    ▼
Go Assembly + Verification Layer
    │
    ├── PostgreSQL (Articles + Claims + Sources)
    ├── Vector DB (Embeddings / Semantic Retrieval)
    └── Graph DB (Neo4j — Claim Graph, Phase 4)
    │
    ▼
Frontend (Web Encyclopedia UI + Claim Graph Explorer)
```

### 2.1 Key Architectural Principles
* **DAG-based orchestration:** Tasks are nodes in a directed acyclic graph, not personality-agents in a linear chain.
* **Stateless Python workers:** Each node is a deterministic input/output contract. LLM used only as a transformation engine.
* **Claims are first-class objects:** The article is a generated view over an atomic claim graph.
* **Multi-dimensional scoring:** Confidence is a vector, not a scalar.
* **Epistemic layers are signal detectors:** They report anomalies and risk factors; they do not adjudicate truth.

---

## 3. Core Data Model — The Claim Graph

### 3.1 Atomic Claim (Central Unit of Truth)
```json
{
    "claim_id": "uuid",
    "text": "Lee Harvey Oswald did not fire the fatal shot that killed John F. Kennedy.",
    "type": "factual | interpretive | predictive",
    "status": "supported | disputed | weak | unknown",
    "confidence_vector": {
        "evidence_strength": 0.94,
        "corroboration_index": 0.89,
        "source_diversity": 0.76,
        "recency": 0.55,
        "contradiction_level": 0.12,
        "bias_risk": 0.20
    },
    "derived_confidence": 0.87,
    "supporting_evidence": ["evidence_id_1", "evidence_id_2"],
    "contradicting_evidence": ["evidence_id_3"],
    "sources": ["source_id_1", "source_id_2"],
    "created_at": "timestamp",
    "updated_at": "timestamp"
}
```

### 3.2 Evidence Node
```json
{
    "evidence_id": "uuid",
    "type": "primary_document | eyewitness | expert_analysis | leaked | patent | dataset | anonymous",
    "url": "string or null",
    "chain_of_custody": "verified | partial | unverified",
    "acquisition_method": "public | foia | leak | classified_release | unknown",
    "accessibility": "public | restricted | classified | destroyed",
    "claims_supported": ["claim_id_1"],
    "claims_contradicted": ["claim_id_2"],
    "source": "source_id"
}
```

### 3.3 Source Node
```json
{
    "source_id": "uuid",
    "name": "string",
    "type": "institutional | individual | anonymous | leaked_material",
    "credibility_vector": {
        "method_quality": 0.74,
        "primary_source_weight": 0.91,
        "bias_risk": 0.40,
        "recency": 0.66,
        "corroboration_history": 0.82
    },
    "notes": "string"
}
```

### 3.4 Article Node
```json
{
    "article_id": "uuid",
    "title": "string",
    "summary": "string",
    "content": "markdown_string",
    "claims": ["claim_id_1", "claim_id_2", "claim_id_3"],
    "confidence_vector": {
        "aggregated_evidence_strength": 0.81,
        "aggregated_corroboration": 0.84,
        "source_diversity": 0.69,
        "contradiction_level": 0.23,
        "suppression_gaps_detected": 0.15,
        "inversions_detected": 0.05
    },
    "derived_confidence": 0.82,
    "version": 3,
    "created_at": "timestamp",
    "updated_at": "timestamp"
}
```

### 3.5 Graph Edges
```
Claim ──supports── Claim
Claim ──contradicts── Claim
Claim ──refines── Claim
Claim ──derives_from── Evidence
Evidence ──sourced_from── Source
Article ──contains── Claim
Article ──cites── Source
```

---

## 4. Go Orchestration Layer — DAG Engine

### 4.1 Design Philosophy
Go is responsible for execution, not intelligence. It manages concurrency, job state, retries, and streaming — not reasoning.

### 4.2 DAG Node Definition
```go
type Node struct {
    ID        string
    Type      string   // retrieve | extract_claims | map_evidence | critique |
                       // detect_missing | map_language | scrutinize_accusation |
                       // resolve | generate_article | store
    DependsOn []string
    Execute   func(ctx context.Context, input map[string]interface{}) (output interface{}, err error)
    Retry     RetryPolicy
    Timeout   time.Duration
}

type RetryPolicy struct {
    MaxAttempts int
    BackoffBase time.Duration
    BackoffMax  time.Duration
}
```

---

## 5. Python Execution Layer — Task Nodes

### 5.1 Design Philosophy
Python handles reasoning, synthesis, and LLM interactions. Each node is a stateless function with a deterministic input/output contract. No node carries conversational state or "personality." LLM calls are wrapped inside transformation functions with structured prompt templates.

### 5.2 Base System Prompt
```python
VERITAS_SYSTEM_PROMPT = """You are VERITAS, an evidence-grounded knowledge construction engine.
Your function is to execute a specific epistemic task: extraction, mapping,
evaluation, or generation. You do not chat. You do not summarize casually.
You produce structured output grounded in provided sources.

CORE RULES:
1. Every claim must trace to a specific source.
2. Distinguish between: primary documents, eyewitness accounts, expert
   analysis, leaked materials, patents, datasets, and anonymous claims.
3. When evidence is thin, mark the claim as "weak" or "speculative."
4. Do not infer intent. Do not assign moral labels.
5. Expose gaps in the evidentiary record. Do not fill them with assumption."""
```
