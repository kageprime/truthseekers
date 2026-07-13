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
];

function makeBlocks(articleSlug: string): Block[] {
  return [
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
