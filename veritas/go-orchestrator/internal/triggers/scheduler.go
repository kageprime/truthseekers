package triggers

import (
	"log"
	"time"

	"github.com/kageprime/veritas/go-orchestrator/internal/manifest"
)

// Fn is the action to execute when a trigger fires. The params come from the
// trigger spec and may include a "slug" for article generation.
type Fn func(action string, params map[string]string)

// Scheduler runs cron triggers on a 60-second tick. Stop via the returned
// function.
func StartScheduler(triggers []manifest.TriggerSpec, fn Fn) func() {
	stop := make(chan struct{})
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		// Fire immediately on start for any trigger whose time matches now.
		fireMatching(triggers, fn)
		for {
			select {
			case <-ticker.C:
				fireMatching(triggers, fn)
			case <-stop:
				return
			}
		}
	}()
	return func() { close(stop) }
}

func fireMatching(triggers []manifest.TriggerSpec, fn Fn) {
	now := time.Now()
	for _, t := range triggers {
		if t.Schedule == "" {
			continue
		}
		ok, err := matchCron(t.Schedule, now)
		if err != nil {
			log.Printf("[triggers] bad cron %q: %v", t.Schedule, err)
			continue
		}
		if ok {
			log.Printf("[triggers] firing %s (action=%s)", t.Name, t.Action)
			go fn(t.Action, t.Params)
		}
	}
}
