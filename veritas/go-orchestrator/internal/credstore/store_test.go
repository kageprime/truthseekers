package credstore

import (
	"testing"
)

func TestGetSet(t *testing.T) {
	s := New(nil)
	if v := s.Get("nonexistent"); v != "" {
		t.Fatalf("expected empty, got %q", v)
	}
	s.Set("groq", "gsk-abc")
	if v := s.Get("groq"); v != "gsk-abc" {
		t.Fatalf("expected gsk-abc, got %q", v)
	}
}

func TestSetHotSwap(t *testing.T) {
	s := New(nil)
	s.Set("do", "key1")
	s.Set("do", "key2")
	if v := s.Get("do"); v != "key2" {
		t.Fatalf("expected key2 after swap, got %q", v)
	}
}

func TestAll(t *testing.T) {
	t.Setenv("MODEL_ACCESS_KEY", "do-key-123")
	t.Setenv("GROQ_API_KEY", "gsk-abc")
	s := New(map[string]string{"MODEL_ACCESS_KEY": "do", "GROQ_API_KEY": "groq"})
	all := s.All()
	if all["do"] != "do-key-123" || all["groq"] != "gsk-abc" {
		t.Fatalf("expected both keys, got %v", all)
	}
}

func TestConcurrentSafety(t *testing.T) {
	s := New(nil)
	done := make(chan bool)
	go func() {
		for i := 0; i < 100; i++ {
			s.Set("x", "v")
		}
		done <- true
	}()
	go func() {
		for i := 0; i < 100; i++ {
			_ = s.Get("x")
		}
		done <- true
	}()
	<-done
	<-done
}
