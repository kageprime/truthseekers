"""Structural and quality stress test for all 9 DAG nodes."""
import sys, os, json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from nodes.retrieve import retrieve_node
from nodes.extract_claims import extract_claims_node
from nodes.map_evidence import map_evidence_node as map_evidence_node_fn
from nodes.critique import critique_node as critique_node_fn
from nodes.detect_missing import detect_missing_evidence_node
from nodes.map_language import map_language_node as map_language_node_fn
from nodes.scrutinize import scrutinize_accusation_node as scrutinize_node_fn
from nodes.resolve import resolver_node as resolver_node_fn
from nodes.generate_article import generate_article_node as generate_article_node_fn

TOPICS = [
    "Philadelphia Experiment",
    "Free Energy Suppression",
    "Chemtrails",
    "Tunguska Event",
]

MIN_CONFIRMED_DOCS = 1
MIN_CLAIMS = 1

def check(ok, label, detail=""):
    s = "PASS" if ok else "FAIL"
    print(f"  [{s}] {label}" + (f" — {detail}" if detail else ""))
    return ok

def test_retrieve(topic):
    out = retrieve_node(topic)
    docs = out.get("documents", {})
    counts = out.get("metadata", {}).get("category_counts", {})
    ok = (
        isinstance(docs.get("confirmed"), list)
        and len(docs["confirmed"]) >= MIN_CONFIRMED_DOCS
        and sum(counts.values()) > 0
    )
    check(ok, "retrieve", f"{sum(counts.values())} docs, {len(docs['confirmed'])} confirmed")
    return out if ok else None

def test_extract_claims(retrieve_out):
    inp = {"retrieve": retrieve_out}
    out = extract_claims_node(inp)
    claims = out.get("claims", [])
    ok = isinstance(claims, list) and len(claims) >= MIN_CLAIMS
    check(ok, "extract_claims", f"{len(claims)} claims")
    return out if ok else None

def test_map_evidence(retrieve_out, extract_out):
    out = map_evidence_node_fn(extract_out, retrieve_out)
    mapped = out.get("claim_evidence_map", [])
    ok = isinstance(mapped, list) and len(mapped) > 0
    check(ok, "map_evidence", f"{len(mapped)} claims mapped")
    return out if ok else None

def test_critique(evidence_out):
    out = critique_node_fn(evidence_out)
    ev = out.get("evaluation", {})
    ok = ev.get("factual_consistency", {}).get("score", -1) >= 0
    check(ok, "critique", f"scores present: {list(ev.keys())}")
    return out if ok else None

def test_detect_missing(evidence_out):
    out = detect_missing_evidence_node(evidence_out)
    gaps = out.get("gaps", [])
    ok = isinstance(gaps, list)
    check(ok, "detect_missing", f"{len(gaps)} gaps")
    return out if ok else None

def test_map_language(extract_out):
    # map_language expects full DAG input with extract_claims key
    inp = {"extract_claims": extract_out}
    out = map_language_node_fn(inp)
    flags = out.get("language_flags", [])
    ok = isinstance(flags, list)
    check(ok, "map_language", f"{len(flags)} flags")
    return out if ok else None

def test_scrutinize(evidence_out):
    out = scrutinize_node_fn(evidence_out)
    risks = out.get("risk_assessments", [])
    ok = isinstance(risks, list)
    check(ok, "scrutinize", f"{len(risks)} assessments")
    return out if ok else None

def test_resolve(critique_out, missing_out, lang_out, scrutiny_out):
    out = resolver_node_fn(critique_out, missing_out, lang_out, scrutiny_out)
    resolved = out.get("resolved_claims", [])
    ok = isinstance(resolved, list) and len(resolved) > 0
    detail = f"{len(resolved)} claims resolved" if ok else "empty"
    check(ok, "resolve", detail)
    return out if ok else None

def test_generate_article(resolve_out):
    out = generate_article_node_fn(resolve_out)
    article = out.get("article", {})
    title = article.get("title", "")
    has_sections = bool(article.get("sections"))
    is_generic = any(g in title for g in ["Insufficient", "unavailable", "Generation", "No"])
    ok = bool(title) and has_sections and not is_generic
    detail = f"'{title[:60]}', {len(article.get('sections',[]))} sections"
    check(ok, "generate_article", detail)
    return out if ok else None

def run_topic(topic, i, n):
    print(f"\n[{i}/{n}] {topic}")
    r = test_retrieve(topic)
    if not r: return print("  → SKIP (retrieve failed)")
    e = test_extract_claims(r)
    if not e: return print("  → SKIP (extract_claims failed)")
    m = test_map_evidence(r, e)
    if not m: return print("  → SKIP (map_evidence failed)")
    c = test_critique(m)
    d = test_detect_missing(m)
    l = test_map_language(e)
    s = test_scrutinize(m)
    if not c or not d or not l or not s:
        return print("  → SKIP (upstream node failed)")
    rs = test_resolve(c, d, l, s)
    if rs:
        test_generate_article(rs)

results = []
for i, topic in enumerate(TOPICS, 1):
    try:
        run_topic(topic, i, len(TOPICS))
        results.append((topic, "OK"))
    except Exception as ex:
        results.append((topic, str(ex)))
        print(f"  [FAIL] {ex}")

print("\n" + "=" * 60)
print("SUMMARY")
for topic, status in results:
    print(f"  {topic}: {status}")
print("=" * 60)
