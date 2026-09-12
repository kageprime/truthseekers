import type {
  ArticleSummary, Article, Section, TimelineEvent, Citation, CrossReference,
  MapEntry, MapMarker, ConversationSummary, ConversationDetail,
  QuotaInfo, JobInfo, Block,
} from "@encarta/core";

export const MOCK_QUOTA: QuotaInfo = {
  allowed: true, used: 3, limit: 100, remaining: 97, tier: "pro",
};

export const MOCK_ARTICLE_SUMMARIES: ArticleSummary[] = [
  { slug: "fall-of-constantinople", title: "The Fall of Constantinople", abstract: "The capital of the Eastern Roman Empire fell on 29 May 1453 after a fifty-three-day siege by the Ottoman army under Sultan Mehmed II.", metadata: { status: "published", version: 3, updated: "2026-06-15T10:30:00Z" }, categories: ["history", "military", "byzantine-empire"], thumbnail: "" },
  { slug: "quantum-entanglement", title: "Quantum Entanglement", abstract: "A quantum phenomenon where two or more particles become correlated such that the quantum state of each particle cannot be described independently.", metadata: { status: "published", version: 5, updated: "2026-06-10T14:00:00Z" }, categories: ["physics", "quantum-mechanics", "science"] },
  { slug: "great-barrier-reef", title: "Great Barrier Reef", abstract: "The world's largest coral reef system, stretching over 2,300 kilometres along the northeast coast of Australia.", metadata: { status: "published", version: 2, updated: "2026-05-28T09:15:00Z" }, categories: ["geography", "marine-biology", "australia"] },
  { slug: "origins-of-jazz", title: "The Origins of Jazz", abstract: "A music genre born in New Orleans in the late 19th and early 20th centuries, blending African and European musical traditions.", metadata: { status: "published", version: 4, updated: "2026-06-01T11:00:00Z" }, categories: ["music", "culture", "history"] },
  { slug: "maya-civilization", title: "Maya Civilization", abstract: "A Mesoamerican civilization known for its hieroglyphic script, advanced mathematics, and monumental architecture.", metadata: { status: "draft", version: 1, updated: "2026-06-20T16:45:00Z" }, categories: ["history", "archaeology", "mesoamerica"] },
  { slug: "deep-sea-hydrothermal-vents", title: "Deep-Sea Hydrothermal Vents", abstract: "Fissures on the seafloor that emit geothermally heated water, supporting unique ecosystems independent of sunlight.", metadata: { status: "published", version: 2, updated: "2026-04-12T08:30:00Z" }, categories: ["geology", "marine-biology", "science"] },
  { slug: "the-printing-press", title: "The Printing Press", abstract: "Johannes Gutenberg's invention of movable-type printing in the 15th century revolutionised the spread of knowledge across Europe.", metadata: { status: "published", version: 6, updated: "2026-03-22T13:20:00Z" }, categories: ["history", "technology", "inventions"] },
  { slug: "anatomy-of-the-brain", title: "Anatomy of the Human Brain", abstract: "The human brain is the central organ of the nervous system, comprising the cerebrum, cerebellum, and brainstem.", metadata: { status: "published", version: 3, updated: "2026-05-05T10:00:00Z" }, categories: ["biology", "neuroscience", "medicine"] },
  { slug: "the-printing-press", title: "The Printing Press", abstract: "Movable-type printing remade memory itself: within fifty years of Gutenberg's Mainz experiments, Europe held more books than a millennium of scribes had copied.", metadata: { status: "published", version: 1, updated: "2026-09-12T08:00:00Z" }, categories: ["history", "technology", "design-showcase"] },
];

function makeBlocks(articleSlug: string): Block[] {  return [
    { id: `${articleSlug}-h1`, type: "heading", data: { level: 1, text: "Introduction" } as any },
    { id: `${articleSlug}-intro`, type: "text", data: { content: "This article examines the historical significance, causes, and lasting impact of the event. Drawing on primary sources and recent scholarship, it presents a comprehensive overview suitable for both general readers and specialists." } as any },
    { id: `${articleSlug}-h2`, type: "heading", data: { level: 2, text: "Historical Background" } as any },
    { id: `${articleSlug}-bg`, type: "text", data: { content: "The roots of this subject extend deep into the preceding centuries. Economic shifts, cultural exchange, and political realignments created the conditions for transformation. Scholars have debated the relative importance of these factors, but the consensus points to a confluence of causes rather than a single trigger." } as any },
    { id: `${articleSlug}-h3`, type: "heading", data: { level: 2, text: "Key Developments" } as any },
    { id: `${articleSlug}-dev`, type: "text", data: { content: "Several critical developments marked the trajectory of this subject. First, technological innovation reshaped the material conditions of daily life. Second, institutional changes reoriented social relationships. Third, intellectual movements challenged prevailing orthodoxies and opened new avenues of inquiry." } as any },
    { id: `${articleSlug}-pull`, type: "pullquote", data: { content: "The past is not dead; it is not even past. We separate ourselves from it at our peril." } as any },
    { id: `${articleSlug}-h4`, type: "heading", data: { level: 2, text: "Legacy and Interpretation" } as any },
    { id: `${articleSlug}-legacy`, type: "text", data: { content: "The legacy of this subject continues to evolve as new evidence emerges and interpretive frameworks shift. Modern scholarship has moved beyond earlier nationalist or teleological narratives toward more nuanced accounts that foreground complexity, contingency, and the experiences of ordinary people." } as any },
    { id: `${articleSlug}-cit`, type: "citation", data: { url: "https://example.com/source-1", title: "Primary Source Analysis, Journal of Historical Studies", relevance: "high" } as any },
  ];
}

// Design showcase — one of every renderable block, in magazine-flow order,
// with honest copy (no lorem). View at /article/the-printing-press in mock
// mode. Mermaid, years, and markers are all valid by construction.
function makeShowcaseBlocks(): Block[] {
  return [
    { id: "sh-lede", type: "text", data: { content: "Around 1440, a goldsmith in Mainz combined the punch, the matrix, the mould, and the press into a single system. Within fifty years, more books had been printed than scribes had copied in the previous thousand. [claim:demo-press-1]" } as any },
    { id: "sh-press-img", type: "image", data: { src: "https://picsum.photos/seed/press/1200/800", caption: "A reconstruction of a wooden common press, the machine at the center of it all." } as any },
    { id: "sh-h1", type: "heading", data: { level: 2, text: "Origins in Mainz" } as any },
    { id: "sh-origins", type: "text", data: { content: "Johannes Gutenberg was trained as a metalworker, and every part of his invention reads like a goldsmith's answer to the scribe's bottleneck. Letter punches were cut in steel, struck into copper matrices, and cast in their hundreds from a hand mould — identical, interchangeable, inexhaustible." } as any },
    { id: "sh-quote", type: "pullquote", data: { text: "What gunpowder did for war, the printing press has done for the mind.", attribution: "Wendell Phillips" } as any },
    { id: "sh-spread", type: "text", data: { content: "The idea traveled faster than any army. By 1470 presses ran in Venice, Paris, and Seville; by 1500 some twenty million volumes had been printed across Europe, an output the scriptoria could never have approached." } as any },
    { id: "sh-diagram", type: "diagram", data: { code: "flowchart TD\n    A[Punchcutting] --> B[Matrix fitting]\n    B --> C[Typecasting]\n    C --> D[Composition]\n    D --> E[Impression]\n    E --> F[Binding]", caption: "From punch to bound book in six stages." } as any },
    { id: "sh-h2", type: "heading", data: { level: 2, text: "An Unfolding Century" } as any },
    {
      id: "sh-timeline", type: "timeline", data: {
        events: [
          { year: 1440, event: "Experiments in Mainz", description: "Gutenberg begins work on movable type." },
          { year: 1455, event: "Gutenberg Bible", description: "Some 180 copies printed, the West's first major book." },
          { year: 1462, event: "Sack of Mainz", description: "Scattered printers carry the craft across Europe." },
          { year: 1500, event: "Twenty million volumes", description: "European presses pass a threshold no scriptorium could match." },
        ],
      } as any,
    },
    { id: "sh-cities", type: "text", data: { content: "Mainz taught, Venice scaled, Paris refined. Each city bent the press to its own market — liturgy, law, humanist classics, news-sheets — and each left its imprint on the letterforms we still read." } as any },
    {
      id: "sh-map", type: "map_2d", data: {
        markers: [
          { lat: 50.0, lng: 8.27, title: "Mainz", type: "site" },
          { lat: 45.44, lng: 12.33, title: "Venice", type: "site" },
          { lat: 48.85, lng: 2.35, title: "Paris", type: "site" },
        ],
        centerLat: 48.5, centerLng: 10, zoom: 4,
      } as any,
    },
    { id: "sh-output", type: "text", data: { content: "The numbers tell the story more bluntly than any narrative. Output doubled and doubled again while prices fell far enough for students, clergy, and merchants to own books for the first time." } as any },
    {
      id: "sh-table", type: "table", data: {
        caption: "Estimated European book output by decade",
        headers: ["Decade", "Titles", "Copies"],
        rows: [["1450s", "300", "500,000"], ["1470s", "3,000", "4,000,000"], ["1490s", "10,000", "20,000,000"]],
        source: "Illustrative estimates",
      } as any,
    },
    { id: "sh-h3", type: "heading", data: { level: 2, text: "How It Worked" } as any },
    { id: "sh-steps", type: "list", data: { style: "ordered", items: ["Cut the punch in hardened steel.", "Strike the matrix in copper.", "Cast sorts by the hundred in the hand mould.", "Compose the forme and lock it up.", "Pull the impression, hang the sheets."] } as any },
    {
      id: "sh-gallery", type: "gallery", data: {
        caption: "The crafts behind the machine",
        images: [
          { src: "https://picsum.photos/seed/type/800/600" },
          { src: "https://picsum.photos/seed/paper/800/600" },
          { src: "https://picsum.photos/seed/binding/800/600" },
        ],
      } as any,
    },
    { id: "sh-scene", type: "text", data: { content: "Walk the reconstructed workshop and the logic becomes physical: type cases within arm's reach, the press at the center, drying racks overhead. Every step minimized handling, because handling was cost." } as any },
    {
      id: "sh-map3d", type: "map_3d", data: {
        id: "mainz-workshop", title: "Mainz workshop", centerLat: 50.0, centerLng: 8.27, zoom: 14,
        terrain: { type: "flat" },
        buildings: [{ id: "b1", lat: 50.0, lng: 8.27, width: 12, depth: 10, height: 8, color: "#a67c2f", label: "Workshop", type: "house" }],
        annotations: [{ lat: 50.001, lng: 8.271, label: "Press room", description: "Two presses, one drying loft." }],
      } as any,
    },
    { id: "sh-film", type: "video", data: { src: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", caption: "Sample footage standing in for press-room film." } as any },
    {
      id: "sh-colophon", type: "section", data: {
        title: "Colophon",
        blocks: [
          { id: "sh-col-t", type: "text", data: { content: "This showcase exercises every block the pipeline can emit, so the design can be judged against the richest real output." } },
          { id: "sh-col-l", type: "list", data: { items: ["Prose, quotes, and lists", "Figures, maps, and diagrams", "Evidence and cross-references"] } },
        ],
      } as any,
    },
    { id: "sh-cit1", type: "citation", data: { url: "https://www.gutenberg.org", title: "Project Gutenberg — early printing history", relevance: "Primary texts and background" } as any },
    { id: "sh-cit2", type: "citation", data: { url: "https://en.wikipedia.org/wiki/Printing_press", title: "Printing press — overview and references", relevance: "General reference" } as any },
    { id: "sh-x1", type: "crossref", data: { slug: "fall-of-constantinople", title: "The Fall of Constantinople", relationship: "same century" } as any },
    { id: "sh-x2", type: "crossref", data: { slug: "origins-of-jazz", title: "The Origins of Jazz", relationship: "craft traditions" } as any },
    { id: "sh-div", type: "divider", data: {} as any },
    { id: "sh-tool", type: "tool_call", data: { name: "verify_citation", result: "supported (0.91) — Gutenberg Bible, 1455" } as any },
  ];
}

export const MOCK_ARTICLES: Record<string, Article> = {
  "fall-of-constantinople": {
    slug: "fall-of-constantinople",
    title: "The Fall of Constantinople",
    abstract: "The capital of the Eastern Roman Empire fell on 29 May 1453 after a fifty-three-day siege by the Ottoman army under Sultan Mehmed II. The event marked the end of the Byzantine Empire and a pivotal shift in Eurasian power.",
    metadata: { version: 3, created: "2026-01-10T08:00:00Z", updated: "2026-06-15T10:30:00Z", status: "published", generatedBy: "veritas" },
    categories: ["history", "military", "byzantine-empire"],
    sections: [
      { id: "s1", title: "Introduction", content: "Constantinople, the capital of the Byzantine Empire, had long been a coveted prize. By the mid-15th century, the empire had been reduced to little more than the city itself, surrounded by Ottoman territory.", media: [] },
      { id: "s2", title: "The Siege Begins", content: "Mehmed II assembled a force of approximately 80,000 men against a defending force of 7,000. The Ottoman fleet blockaded the Bosporus while massive bombardments targeted the Theodosian Walls.", media: [] },
      { id: "s3", title: "The Final Assault", content: "In the early hours of 29 May 1453, the Ottomans launched their final assault. After a breach was opened, the defenders were overwhelmed. Constantine XI, the last Byzantine emperor, died in battle.", media: [] },
    ],
    timeline: [
      { id: "t1", year: 1451, event: "Mehmed II ascends the Ottoman throne", description: "At 19, Mehmed begins planning the conquest of Constantinople." },
      { id: "t2", year: 1452, event: "Rumelihisarı fortress built", description: "The fortress on the European shore of the Bosporus controls the strait." },
      { id: "t3", year: 1453, event: "Siege of Constantinople", description: "Fifty-three day siege ends with the city's capture." },
    ],
    crossrefs: [
      { id: "byzantine-empire", title: "Byzantine Empire", relationship: "parent" },
      { id: "mehmed-ii", title: "Mehmed II", relationship: "related" },
    ],
    citations: [
      { url: "https://www.example.com/source1", title: "The Fall of Constantinople: A Historical Reassessment", accessed: "2026-06-01" },
    ],
    blocks: makeBlocks("fall-of-constantinople"),
  },
  "quantum-entanglement": {
    slug: "quantum-entanglement",
    title: "Quantum Entanglement",
    abstract: "A quantum phenomenon where two or more particles become correlated such that the quantum state of each particle cannot be described independently.",
    metadata: { version: 5, created: "2025-11-20T09:00:00Z", updated: "2026-06-10T14:00:00Z", status: "published", generatedBy: "veritas" },
    categories: ["physics", "quantum-mechanics", "science"],
    sections: [
      { id: "s1", title: "Introduction", content: "Quantum entanglement is a physical phenomenon that occurs when a group of particles are generated, interact, or share spatial proximity in a way such that the quantum state of each particle cannot be described independently.", media: [] },
      { id: "s2", title: "History", content: "The phenomenon was first discussed by Einstein, Podolsky, and Rosen in 1935, who argued that it implied quantum mechanics was incomplete. John Bell later formulated a theorem that could test the predictions of quantum mechanics against local hidden variable theories.", media: [] },
    ],
    timeline: [],
    crossrefs: [{ id: "quantum-computing", title: "Quantum Computing", relationship: "related" }],
    citations: [{ url: "https://www.example.com/source2", title: "Bell's Theorem and Quantum Entanglement", accessed: "2026-06-01" }],
    blocks: makeBlocks("quantum-entanglement"),
  },
  "great-barrier-reef": {
    slug: "great-barrier-reef",
    title: "Great Barrier Reef",
    abstract: "The world's largest coral reef system, stretching over 2,300 kilometres along the northeast coast of Australia.",
    metadata: { version: 2, created: "2026-03-15T07:30:00Z", updated: "2026-05-28T09:15:00Z", status: "published", generatedBy: "veritas" },
    categories: ["geography", "marine-biology", "australia"],
    sections: [
      { id: "s1", title: "Introduction", content: "The Great Barrier Reef is the world's largest coral reef system, composed of over 2,900 individual reef systems and 900 islands stretching for over 2,300 kilometres.", media: [] },
      { id: "s2", title: "Biodiversity", content: "The reef is home to a stunning array of biodiversity, including 1,500 species of fish, 400 types of coral, and 4,000 species of mollusk.", media: [] },
    ],
    timeline: [],
    crossrefs: [{ id: "coral-bleaching", title: "Coral Bleaching", relationship: "related" }],
    citations: [{ url: "https://www.example.com/source3", title: "Great Barrier Reef Marine Park Authority", accessed: "2026-05-28" }],
    blocks: makeBlocks("great-barrier-reef"),
  },
  "origins-of-jazz": {
    slug: "origins-of-jazz",
    title: "The Origins of Jazz",
    abstract: "A music genre born in New Orleans in the late 19th and early 20th centuries, blending African and European musical traditions.",
    metadata: { version: 4, created: "2025-09-01T12:00:00Z", updated: "2026-06-01T11:00:00Z", status: "published", generatedBy: "veritas" },
    categories: ["music", "culture", "history"],
    sections: [
      { id: "s1", title: "Introduction", content: "Jazz emerged in the multicultural port city of New Orleans, where African rhythms, European harmonies, and American instrumentation converged into a new musical language.", media: [] },
    ],
    timeline: [],
    crossrefs: [{ id: "louis-armstrong", title: "Louis Armstrong", relationship: "related" }],
    citations: [{ url: "https://www.example.com/source4", title: "The Birth of Jazz", accessed: "2026-06-01" }],
    blocks: makeBlocks("origins-of-jazz"),
  },
  "the-printing-press": {
    slug: "the-printing-press",
    title: "The Printing Press",
    abstract: "Movable-type printing remade memory itself: within fifty years of Gutenberg's Mainz experiments, Europe held more books than a millennium of scribes had copied.",
    metadata: { version: 1, created: "2026-09-12T08:00:00Z", updated: "2026-09-12T08:00:00Z", status: "published", generatedBy: "showcase" },
    categories: ["history", "technology", "design-showcase"],
    sections: [
      { id: "s1", title: "Origins in Mainz", content: "Johannes Gutenberg combined punch, matrix, mould, and press into a single system around 1440.", media: [] },
      { id: "s2", title: "An Unfolding Century", content: "By 1500 some twenty million volumes had been printed across Europe.", media: [] },
      { id: "s3", title: "How It Worked", content: "Punchcutting, matrix fitting, typecasting, composition, impression, binding.", media: [] },
    ],
    timeline: [
      { id: "t1", year: 1440, event: "Experiments in Mainz", description: "Gutenberg begins work on movable type." },
      { id: "t2", year: 1455, event: "Gutenberg Bible", description: "Some 180 copies printed, the West's first major book." },
      { id: "t3", year: 1500, event: "Twenty million volumes", description: "European presses pass a threshold no scriptorium could match." },
    ],
    crossrefs: [
      { id: "fall-of-constantinople", title: "The Fall of Constantinople", relationship: "same century" },
      { id: "origins-of-jazz", title: "The Origins of Jazz", relationship: "craft traditions" },
    ],
    citations: [
      { url: "https://www.gutenberg.org", title: "Project Gutenberg — early printing history", accessed: "2026-09-12" },
      { url: "https://en.wikipedia.org/wiki/Printing_press", title: "Printing press — overview and references", accessed: "2026-09-12" },
    ],
    blocks: makeShowcaseBlocks(),
  },
};

export const MOCK_MAPS: MapEntry[] = [
  { slug: "roman-empire-117", title: "Roman Empire at its Greatest Extent", subtitle: "Under Emperor Trajan, AD 117", description: "The Roman Empire reached its maximum territorial extent under Emperor Trajan, spanning from Britannia to Mesopotamia.", content: "## Roman Empire AD 117\n\nAt its height, the Roman Empire controlled approximately 5 million square kilometres of territory.", image: "", region: "Europe", era: "ancient", type: "static", createdAt: "2026-01-15T10:00:00Z", updatedAt: "2026-01-15T10:00:00Z" },
  { slug: "voyages-of-zheng-he", title: "Voyages of Zheng He", subtitle: "1405–1433", description: "The seven maritime expeditions led by Admiral Zheng He across the Indian Ocean.", content: "## Zheng He's Voyages\n\nBetween 1405 and 1433, the Ming dynasty sponsored seven major naval expeditions.", image: "", region: "Asia", era: "medieval", type: "static", createdAt: "2026-02-10T14:00:00Z", updatedAt: "2026-02-10T14:00:00Z" },
  { slug: "silent-film-era", title: "Silent Film Era — Global Distribution", subtitle: "1895–1927", description: "The spread of cinema as a global medium before the advent of synchronized sound.", content: "## Silent Film Era\n\nThe silent film era transformed entertainment worldwide.", image: "", region: "Global", era: "modern", type: "static", createdAt: "2026-03-05T09:00:00Z", updatedAt: "2026-03-05T09:00:00Z" },
  {
    slug: "berlin-wall", title: "Berlin Wall 1961–1989", subtitle: "A divided city", description: "The Berlin Wall divided East and West Berlin from 1961 to 1989, both physically and ideologically.", content: "## The Berlin Wall\n\nBuilt overnight on 13 August 1961, the Berlin Wall became the most visible symbol of the Cold War.", image: "", region: "Europe", era: "modern", type: "interactive", centerLat: 52.52, centerLng: 13.405, zoom: 12,
    markers: [
      { lat: 52.516, lng: 13.378, title: "Brandenburg Gate", type: "site" },
      { lat: 52.535, lng: 13.390, title: "Bernauer Strasse Memorial", type: "museum" },
      { lat: 52.508, lng: 13.441, title: "Checkpoint Charlie", type: "site" },
    ],
    createdAt: "2026-04-20T11:00:00Z", updatedAt: "2026-04-20T11:00:00Z",
  },
];

export const MOCK_CONVERSATIONS: ConversationSummary[] = [
  { id: "conv-1", title: "Quantum computing explained", createdAt: "2026-06-20T10:00:00Z", updatedAt: "2026-06-20T10:05:00Z", messageCount: 4 },
  { id: "conv-2", title: "History of the Byzantine Empire", createdAt: "2026-06-19T14:00:00Z", updatedAt: "2026-06-19T14:15:00Z", messageCount: 8 },
  { id: "conv-3", title: "Marine biology research", createdAt: "2026-06-18T09:30:00Z", updatedAt: "2026-06-18T09:45:00Z", messageCount: 3 },
];

export const MOCK_CONVERSATION_DETAILS: Record<string, ConversationDetail> = {
  "conv-1": {
    id: "conv-1", title: "Quantum computing explained", createdAt: "2026-06-20T10:00:00Z", updatedAt: "2026-06-20T10:05:00Z", messageCount: 4,
    messages: [
      { id: "m1", conversationId: "conv-1", role: "user", content: "Explain quantum computing in simple terms.", createdAt: "2026-06-20T10:00:00Z" },
      { id: "m2", conversationId: "conv-1", role: "assistant", content: "Quantum computing uses qubits that can be in superposition — both 0 and 1 simultaneously — unlike classical bits. This allows quantum computers to solve certain problems exponentially faster than classical computers. Think of it as being able to explore all possible paths at once, rather than one at a time.", createdAt: "2026-06-20T10:00:30Z" },
      { id: "m3", conversationId: "conv-1", role: "user", content: "What are the practical applications today?", createdAt: "2026-06-20T10:02:00Z" },
      { id: "m4", conversationId: "conv-1", role: "assistant", content: "Current applications include cryptography (Shor's algorithm for factoring), drug discovery (simulating molecular interactions), and optimization problems in logistics. However, practical large-scale quantum computers are still being developed.", createdAt: "2026-06-20T10:05:00Z" },
    ],
  },
  "conv-2": {
    id: "conv-2", title: "History of the Byzantine Empire", createdAt: "2026-06-19T14:00:00Z", updatedAt: "2026-06-19T14:15:00Z", messageCount: 8,
    messages: [
      { id: "m5", conversationId: "conv-2", role: "user", content: "When did the Byzantine Empire begin?", createdAt: "2026-06-19T14:00:00Z" },
      { id: "m6", conversationId: "conv-2", role: "assistant", content: "The Byzantine Empire traditionally begins in AD 330 when Constantine the Great established Constantinople as the new capital of the Roman Empire. It continued the Roman legal and administrative traditions while evolving a distinct Greek Orthodox identity.", createdAt: "2026-06-19T14:01:00Z" },
    ],
  },
};

export const MOCK_QUEUE_JOBS: JobInfo[] = [
  { slug: "coral-bleaching", title: "Coral Bleaching", status: "queued", phase: "queued", createdAt: "2026-06-22T08:00:00Z" },
  { slug: "louis-armstrong", title: "Louis Armstrong", status: "done", phase: "done", createdAt: "2026-06-21T16:00:00Z" },
];

export const MOCK_SETTINGS: Record<string, string> = {
  featured_articles: JSON.stringify(["fall-of-constantinople", "quantum-entanglement", "great-barrier-reef"]),
};

export const MOCK_USER = {
  id: "user-mock-1",
  email: "researcher@example.com",
  name: "Dr. Alex Researcher",
  avatar: "",
  subscriptionTier: "pro",
  onboarded: true,
};

export const MOCK_MODELS = [
  { name: "gemma-4-31b-it", provider: "do", displayName: "Gemma 4 31B", reasoning: true, toolCall: true, attachment: true, contextLimit: 128000, outputLimit: 16384, inputCostPerM: 0.5, outputCostPerM: 0.75 },
  { name: "deepseek-4-flash", provider: "do", displayName: "DeepSeek 4 Flash", reasoning: false, toolCall: true, attachment: false, contextLimit: 128000, outputLimit: 16384, inputCostPerM: 0.15, outputCostPerM: 0.3 },
  { name: "llama-4-scout-17b-16e-instruct", provider: "groq", displayName: "Llama 4 Scout", reasoning: false, toolCall: true, attachment: false, contextLimit: 65536, outputLimit: 8192, inputCostPerM: 0, outputCostPerM: 0 },
];

export const MOCK_CONNECTORS = [
  { slug: "web_search", name: "Web Search", provider: "http", actions: [{ name: "search", risk: "read" }] },
  { slug: "webfetch", name: "Web Fetch", provider: "http", actions: [{ name: "fetch", risk: "read" }] },
  { slug: "generate_image", name: "Image Generation", provider: "http", actions: [{ name: "generate", risk: "write" }] },
];

export const MOCK_USAGE = {
  userId: "anonymous",
  totals: { totalTokens: 0, totalCost: 0, callCount: 0 },
  recent: [],
};
