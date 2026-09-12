# Magazine Article Layout — Design Plan

Status: plan — the foundations described here already exist as an
unpushed build (two-column flow, floated figures, drag reorder, size
steps); this document ratifies the direction and charts what comes next.

## What the reference really teaches

The cited library is a text *measurement* engine, not a rendering one. Its
core insight is variable-width line routing: lay out a paragraph one row
at a time, narrowing each line that passes beside an obstacle. That idea
is exactly right for us, but we will not take the dependency, and the
reason is architectural rather than frugal. Pretext pays off when you
render text yourself — to canvas, SVG, or WebGL — where the browser cannot
lay anything out for you. Our article renders to the DOM, where text must
stay selectable, searchable, readable by screen readers, and cheap to
reflow. The browser already owns a superb variable-width line router; it
is called a float with a shape. Adopting a canvas measurement library for
DOM text would buy us nothing, cost us accessibility, and add a second
layout engine to disagree with the first. So the plan steals the insight
and leaves the dependency: obstacles declared in markup, text routed by
the browser, every reorder and resize re-breaking natively and for free.

## The page we are building

A newspaper spread, not a document. Prose runs in two columns on wide
screens, divided by a hairline rule, collapsing to one column and then to
stacked figures as the viewport narrows. Figures do not sit beside the
text in a sidebar ghetto; they intrude into it. Photographs and diagrams
ride inside the column with the paragraph giving way along their edges.
Pull quotes cut across at a slant. Wide matter — maps, timelines, tables
— breaks across both columns like a center spread. Major headings span
the spread and never strand beside a float. The first paragraph opens
with a drop cap, because some signals are worth keeping.

## What counts as an object

Anything with a silhouette. Photographs and generated images carry real
contours, so where the file is same-origin we let the text hug the alpha
channel itself, with a rounded-rectangle fallback wherever cross-origin
rules forbid reading pixels — the fallback must always be present, never
an afterthought. Diagrams, galleries, and video are rectangular and make
no apology for it. Pull quotes are ellipses. Timelines and maps are
spreads. Tables are spreads. Nothing decorative ever becomes an object; if
it carries no information, it carries no exclusion zone.

## How objects move

Dragging an object reorders it in the reading flow, and the columns
re-break around its new neighbors instantly — that is the whole trick,
and it needs no layout code because the browser does it. Zooming is
stepped rather than continuous: three honest sizes, small enough to tuck
inside a column, medium enough to dominate one, large enough to break the
spread. Sides alternate by default so the spread breathes left-right-left
down the page. Three deliberate refusals sit behind this simplicity.
Free-position dragging, where an object hovers at arbitrary coordinates,
would demand the custom layout engine we just declined to build; order
plus size plus side expresses every composition a reader needs. Pinch zoom
fights the scroll gesture on the very devices we are prioritizing, so zoom
stays on the button. And layouts do not persist per user yet — that is a
backend feature wearing a frontend costume, and it waits its turn.

## The contract underneath

Three guarantees hold regardless of what renders. Without shapes, without
script, without drag, the article reads perfectly as a linear document —
exclusions are enhancement, never load-bearing. Every exclusion has a
generous margin, because text kissing an outline is a bug, not a look.
Motion is limited to opacity and transform, drag handles are grip-only so
scrolling never misfires, touch targets meet the forty-four-pixel rule,
and every drag operation has a keyboard equivalent, since a pointer-only
reorder would lock out readers the encyclopedia exists to include.
Reduced-motion preferences are honored throughout.

## Reading order of work

Foundations first, and they are already built: the two-column flow, the
figure partition, the drag reorder with live drop anchors, the size
steps, the responsive collapse. Next comes silhouette truth — alpha
contours where allowed, slant polygons for quotes, spread rules for wide
matter. Then reading polish: the measure, the staggered entries, the
print stylesheet an encyclopedia quietly deserves. Motion and touch
discipline follow, and persisted layouts wait for the backend to be ready
to mean it.

## Open questions, honestly held

Whether free-position dragging will ever justify its engine remains
unsettled; the recommendation stands at no until a composition proves
otherwise. Pinch zoom stays deferred for the gesture conflict stated
above. And figure-to-claim binding — figures that know which claim they
illustrate and highlight together — is the most exciting thread here and
deliberately not in this plan; it belongs to the traceability work, and
it should arrive after anchors resolve rather than before.

## Plate design language (canonical reference)

Every future design change to the article page is checked against this
section first. The reference is a natural-history specimen plate: paper
sheet, ink rules, Didone display, typewriter labels, taxonomy grid.

The non-negotiable elements: a folio eyebrow row in letterspaced
typewriter caps (section, volume, folio); a black-weight Didone headline
in full uppercase with tight leading; an italic serif deck; a thick-over-
thin double rule at full measure; annotation lists with dot markers,
small-caps labels, and italic notes, where hovering a note highlights its
region and vice versa; a taxonomy grid with solid ink label cells,
bordered rows, and expandable tips; a dark band reserved for etymology-
style asides. Paper grain over flat fills; hairline rules, never card
backgrounds — depth comes from rules, offset shadows on overlays only,
and typography, not containers. Status is always dot plus label, never
color alone. Motion is limited to opacity and transform with an expo-out
curve; hover states never shift layout.

Deliberately not adopted: annotation callouts pinned to figure regions
and the magnifier inset both require figure-region data the pipeline does
not emit — fabricating their labels would be fiction, so they wait on a
pipeline change. The range map is covered by figures floating in the flow.
Dark mode translates the plate by variable (ink becomes paper and vice
versa) rather than by separate rules; any plate style written with raw
hex instead of tokens is a bug.
