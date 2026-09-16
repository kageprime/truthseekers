// Package config loads and validates process configuration once at boot.
//
// ponytail: this stays deliberately small — a struct, a loader, and fail-fast checks
// for the keys that silently break prod when unset (JWT floor, mock-mode
// surprise, dead revalidate). It does NOT rewire every os.Getenv call site;
// those migrate one by one when touched.
package config

import (
	"log"
	"os"
)

const minJWTSecretLen = 32

type Config struct {
	Port             string
	DatabaseURL      string
	MigrationsDir    string
	DataDir          string
	JWTSecret        string
	AllowDevAuth     bool
	RevalidateURL    string
	RevalidateSecret string
	HasLLMKey        bool
	HasSearchKey     bool
	HasPaystackKey   bool
	MockMode         bool
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Load reads the environment. It never panics — call Validate to fail fast.
func Load() Config {
	c := Config{
		Port:             getenv("PORT", "4097"),
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		MigrationsDir:    getenv("MIGRATIONS_DIR", "migrations"),
		DataDir:          os.Getenv("ENCARTA_DATA_DIR"),
		JWTSecret:        os.Getenv("JWT_SECRET"),
		AllowDevAuth:     os.Getenv("ALLOW_DEV_AUTH") == "1",
		RevalidateURL:    os.Getenv("REVALIDATE_URL"),
		RevalidateSecret: os.Getenv("REVALIDATE_SECRET"),
	}
	if c.RevalidateURL == "" {
		c.RevalidateURL = os.Getenv("NEXT_PUBLIC_API_URL")
	}
	c.HasLLMKey = os.Getenv("MODEL_ACCESS_KEY") != "" || os.Getenv("GROQ_API_KEY") != "" || os.Getenv("OPENAI_API_KEY") != ""
	c.HasSearchKey = os.Getenv("TAVILY_API_KEY") != "" || os.Getenv("FIRECRAWL_API_KEY") != ""
	c.HasPaystackKey = os.Getenv("PAYSTACK_SECRET_KEY") != ""
	c.MockMode = c.DatabaseURL == ""
	return c
}

// Validate panics on config that is certainly wrong and warns on config that
// is probably wrong. Call once at boot before listening.
func (c Config) Validate() {
	if c.JWTSecret == "" && !c.AllowDevAuth {
		panic("JWT_SECRET must be set (or ALLOW_DEV_AUTH=1 for local dev)")
	}
	if c.JWTSecret != "" && len(c.JWTSecret) < minJWTSecretLen && !c.AllowDevAuth {
		panic("JWT_SECRET must be at least 32 bytes — short HMAC keys are brute-forceable")
	}
	if c.MockMode {
		log.Printf("CONFIG: DATABASE_URL unset — running in FILE-BACKED MODE (data vanishes on restart)")
	}
	if c.RevalidateSecret == "" || c.RevalidateURL == "" {
		log.Printf("CONFIG: REVALIDATE_URL/REVALIDATE_SECRET incomplete — ISR revalidate disabled, pages go stale up to 60s")
	}
	if !c.HasLLMKey {
		log.Printf("CONFIG: no LLM key (MODEL_ACCESS_KEY/GROQ_API_KEY/OPENAI_API_KEY) — chat and generation will fail")
	}
	if !c.HasSearchKey {
		log.Printf("CONFIG: no search key (TAVILY_API_KEY/FIRECRAWL_API_KEY) — pipeline falls back to LLM-only mode")
	}
	if !c.HasPaystackKey {
		log.Printf("CONFIG: no PAYSTACK_SECRET_KEY — billing webhooks return 503")
	}
}

// Summary logs one boot line so "which env did this dyno get?" is greppable.
func (c Config) Summary() {
	log.Printf("CONFIG: port=%s store=%s llm=%t search=%t paystack=%t revalidate=%t dev_auth=%t",
		c.Port, map[bool]string{true: "file", false: "postgres"}[c.MockMode],
		c.HasLLMKey, c.HasSearchKey, c.HasPaystackKey, c.RevalidateSecret != "" && c.RevalidateURL != "", c.AllowDevAuth)
}
