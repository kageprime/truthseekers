package api

import (
	"log"
	"sync"
)

// Generation queue — a small in-process worker pool that bounds concurrent
// article generation. Replaces the unbounded `go s.processArticleStub(...)`
// goroutine-per-request pattern.
//
// Design:
//   - A buffered job channel (depth 128) feeds `maxWorkers` worker goroutines.
//   - An `active` set dedupes: Submit() no-ops if a slug is already queued or
//     running, so refreshing a page twice won't spawn two pipelines for the
//     same slug.
//   - On startup, Restore() reads "queued"/"writing" jobs from the DB and
//     re-enqueues them, so an in-flight generation interrupted by a restart
//     resumes instead of being stranded.
//
// Redis fan-out (multi-instance coordination) is deferred — this pool is
// per-process, which is sufficient for the single-instance deployment today.

const maxWorkers = 3

type genJob struct {
	slug    string
	persona string
}

// GenerationQueue bounds concurrent article generation.
type GenerationQueue struct {
	jobs   chan genJob
	active map[string]bool // slug → in-flight
	mu     sync.Mutex
	server *Server
	wg     sync.WaitGroup
}

// NewGenerationQueue starts the worker pool. Call Restore() after construction
// to resume stranded jobs.
func NewGenerationQueue(server *Server) *GenerationQueue {
	q := &GenerationQueue{
		jobs:   make(chan genJob, 128),
		active: make(map[string]bool),
		server: server,
	}
	for i := 0; i < maxWorkers; i++ {
		q.wg.Add(1)
		go q.worker(i)
	}
	log.Printf("📈 [queue] generation worker pool started (%d workers)", maxWorkers)
	return q
}

func (q *GenerationQueue) worker(id int) {
	defer q.wg.Done()
	for job := range q.jobs {
		q.server.processArticle(job.slug, job.persona)
		q.release(job.slug)
	}
}

// Submit enqueues a generation job unless one is already running/queued for
// the slug. Returns true if newly enqueued.
func (q *GenerationQueue) Submit(slug, persona string) bool {
	q.mu.Lock()
	if q.active[slug] {
		q.mu.Unlock()
		return false
	}
	q.active[slug] = true
	q.mu.Unlock()

	_ = q.server.db.SaveJob(slug, "queued", "research", map[string]interface{}{"title": slug, "persona": persona})

	select {
	case q.jobs <- genJob{slug: slug, persona: persona}:
		return true
	default:
		// Buffer full — reject so the caller surfaces a clear failure rather
		// than blocking the request goroutine.
		q.release(slug)
		_ = q.server.db.SaveJob(slug, "error", "error", map[string]interface{}{
			"title": slug, "error": "generation queue is full",
		})
		log.Printf("⚠️ [queue] rejected slug=%s — queue full", slug)
		return false
	}
}

// release marks a slug as no longer in-flight.
func (q *GenerationQueue) release(slug string) {
	q.mu.Lock()
	delete(q.active, slug)
	q.mu.Unlock()
}

// Restore re-enqueues jobs that were "queued" or "writing" when the server
// stopped — they never produced a finished article. Called once on boot.
func (q *GenerationQueue) Restore() {
	restored := 0
	for _, status := range []string{"queued", "writing"} {
		jobs, err := q.server.db.ListJobsByStatus(status)
		if err != nil {
			log.Printf("⚠️ [queue] restore: list %q jobs failed: %v", status, err)
			continue
		}
		for _, j := range jobs {
			persona := "veritas"
			if j.Meta != nil {
				if m, ok := j.Meta.(map[string]interface{}); ok {
					if p, ok := m["persona"].(string); ok && p != "" {
						persona = p
					}
				}
			}
			// Mark back to "queued" so a crash during this restore loop won't
			// strand a "writing" job forever.
			_ = q.server.db.SaveJob(j.Slug, "queued", "research", map[string]interface{}{
				"title": j.Title, "persona": persona,
			})
			if q.Submit(j.Slug, persona) {
				restored++
			}
		}
	}
	if restored > 0 {
		log.Printf("📈 [queue] restored %d in-flight job(s) from DB", restored)
	}
}

// Stats returns current queue depth and active-job count for observability.
func (q *GenerationQueue) Stats() (active int, queued int) {
	q.mu.Lock()
	active = len(q.active)
	q.mu.Unlock()
	queued = len(q.jobs)
	return
}

// Stop drains workers on shutdown.
func (q *GenerationQueue) Stop() {
	close(q.jobs)
	q.wg.Wait()
}
