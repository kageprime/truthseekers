# Article Fidelity & Claim Traceability

Status: proposal — no code changes. Written after the Operation Fishbowl
regeneration, which is used throughout as the reference case.

## What the reader currently meets

The regenerated Fishbowl article is a genuine step forward — real claims,
real sections, a timeline, citations. But read it as a stranger would and
four defects stand out. An "unknown" chip after nearly every paragraph.
Citations that read `doc-945d96ff` instead of naming a source. A timeline
that stutters `1962 – 1962 / 19621962`. And a structure that feels like a
laboratory report about claims rather than an encyclopedia entry about
Operation Fishbowl, restating each point three or four times across
near-identical sections. None of these is a rendering accident. Each is a
handoff in the pipeline where one stage produces something the next stage
cannot consume — and the failure is silent every time.

## The governing principle

Every boundary in the system must be a contract, checked at generation
time, never at read time. The epistemic core already honors this: claims,
evidence, gaps, scrutiny, and confidence all persist correctly and can be
queried. What fails is the representation boundary — the last mile between
what the machine knows and what the reader sees. A reader must never meet
our pipeline's homework. Anything the pipeline cannot stand behind should
be repaired or downgraded before publish, loudly logged, and never rendered
as a placeholder like "unknown."

## Traceable claims, end to end

The central demand is simple to state: every `[claim:id]` anchor in every
article must resolve, and resolving it must open a trail, not a dead end.
Clicking an anchor should reveal the claim's wording, its status, its
confidence vector in readable form, the evidence behind it with real source
titles, the claims it supports or contradicts, the gaps touching it, and —
where refreshes have revised it — its history. The claim graph already
exists as an endpoint; what is missing is the linkage, so that anchor,
detail, and graph are three views of one identity rather than three
separate features that happen to mention claims.

That single identity was broken at two precise points, and the comparison
this document called for confirmed both on the Fishbowl article: of 22
unique anchors, 12 dangled. First, extraction and resolution mint
sequential placeholder IDs that drift between runs, so regenerations fork
duplicate rows instead of accruing history. Second, the writer fabricates
anchor IDs in yet another sequence that exists nowhere — not in the
outputs, not in the database. The repair, now implemented, gives every
claim a stable identity before anything persists: the surviving row's ID
when the wording already exists (so regenerations upsert with version
history), else a deterministic content-addressed ID (so future runs
converge). All outputs and the article text are rewritten through that
alias map, and anchors that still resolve to nothing are stripped at
generation time with a loud log line instead of degrading into "unknown"
on the reader's screen. No renderer change could substitute for this,
because by read time the information about which IDs alias which is
already lost.

With identity unified, the "unknown" state should be made structurally
impossible rather than merely unlikely. Anchors must be validated before
publish: every ID in the text must exist in the index, and any that does
not must fail the fidelity gate below instead of degrading quietly on the
reader's screen.

## Evidence with real names

Internal document keys are leaking into the reader's view because the
writer only ever sees internal keys. Retrieval returns genuine titles and
URLs, and they persist into the sources and evidence tables — but the
generate node receives neither, so its citations can only echo `doc-`
identifiers, and the citation cards faithfully render those echoes. The
robust repair is deterministic and needs no model cooperation: at persist
time, resolve every cited ID against the sources and evidence tables and
store the resulting title and URL with the citation. Separately, the
generate node should be handed a source catalog (ID mapped to title and
URL) so its relevance notes describe real publications. Citation quality
then stops depending on what the model happened to remember and starts
depending on what retrieval actually found.

## Timelines that tell time

The garbled timeline comes from a schema that invites ranges and prose
where the renderer needs a single year. The generator emits "1962 – 1962,"
the normalizer strips everything but digits and hyphens, and the display
ends up showing the wreckage twice. Timeline events should carry one
integer year, with an optional end year for genuine spans, and the gate
should reject anything else — sending it back for repair rather than
rendering the scar tissue. Duplicate entries within an event, like the
doubled anchors visible now, fall under the same rule: the writer states
each dated fact once.

## An article shaped like an article

The present structure — a section per pipeline category, each trailed by
its own uncertainty note, each restating the same claims — mirrors the
machine that made it, not the reader it serves. An encyclopedia entry
should open with a lede that states what happened, develop a narrative
body in which each claim appears once and is anchored at first statement,
and relegate the machinery to a single Evidence and Confidence appendix
holding gaps, dissent, the confidence note, and language notes. Dissent
deserves its existing prominence — the Fishbowl first-test contradiction is
exactly the kind of honest disagreement readers come for — but as argued
prose in one place, not as footnotes scattered under every heading. This is
a prompt-level change with a gate-level backstop: a restatement check that
flags claims asserted verbatim more than once outside deliberate
lede-and-body conventions.

## The fidelity gate

All of the above converges on one enforcement point: no article publishes
until it passes a generation-time check that asserts block count in equals
blocks rendered, every diagram parses, every anchor resolves, every
citation carries a title and URL, and every timeline event carries a sane
year. Failure repairs or downgrades — a bad diagram becomes a code block, a
missing figure becomes nothing with a log line — and anything salvaged is
logged loudly enough that no one discovers it from a reader's screenshot.
This gate would have caught every symptom in the Fishbowl article before
any reader did, which is precisely its job description.

## Reading on the phone, reading offline

The platform's natural shape is a reader's companion, and that means the
phone comes first and offline comes soon after. The honest sequence starts
with weight: the chat route currently ships on the order of two-thirds of
a megabyte of first-load JavaScript, much of it 3D, map, and diagram
machinery a chat reader never touches. No service worker compensates for
that over mobile data, so the heavy renderers leave the initial bundle
first. Then the reading experience itself — the article page is already
close, and the remaining work is touch discipline and legibility rather
than reinvention. Then installability with offline article caching, which
suits encyclopedia content perfectly: cache the reads, stream the chat.
Push notifications and the rest of the app-like wardrobe come last. Easy
to use and access begins with fast and light; the install prompt is the
reward at the end, not the beginning.

## Open questions, stated plainly

Three threads remain genuinely unresolved at the time of writing. The
anchor-to-index mismatch needs the direct ID comparison described above
before the dedup repair is commissioned. The single claim-graph 500 seen
earlier needs a retest now that claims exist. And the provider's generic
400 on chat sends still needs the parameter it objects to, which the new
reject logging will name the next time it fires. None of these blocks the
document's proposals; all three should be closed before or alongside them.
