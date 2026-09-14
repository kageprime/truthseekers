package config

import (
	"testing"
)

func TestValidateJWTFloor(t *testing.T) {
	t.Setenv("JWT_SECRET", "short")
	t.Setenv("ALLOW_DEV_AUTH", "")
	defer func() {
		if recover() == nil {
			t.Fatal("short JWT_SECRET without dev opt-in must panic")
		}
	}()
	Load().Validate()
}

func TestValidateShortSecretAllowedInDev(t *testing.T) {
	t.Setenv("JWT_SECRET", "short")
	t.Setenv("ALLOW_DEV_AUTH", "1")
	Load().Validate() // must not panic
}

func TestLoadDefaults(t *testing.T) {
	t.Setenv("PORT", "")
	t.Setenv("DATABASE_URL", "")
	if c := Load(); c.Port != "4097" || !c.MockMode {
		t.Fatalf("defaults wrong: %+v", c)
	}
}
