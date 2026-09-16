package agent

import (
	"testing"
)

func TestScoreImage(t *testing.T) {
	candReal := ImageCandidate{
		Title:        "Apollo 11 Saturn V Launch",
		ImageURL:     "https://upload.wikimedia.org/wikipedia/commons/1/16/Apollo_11_Launch.jpg",
		Source:       "Wikimedia Commons",
		SourceDomain: "commons.wikimedia.org",
		Width:        1024,
		Height:       768,
		IsAI:         false,
	}

	score := ScoreImage(candReal, "Apollo 11 Launch")
	if score.AuthScore != 100.0 {
		t.Errorf("expected AuthScore 100, got %f", score.AuthScore)
	}
	if score.TotalScore < 60.0 {
		t.Errorf("expected high TotalScore >= 60, got %f", score.TotalScore)
	}

	candAI := ImageCandidate{
		Title:        "AI Generation of Apollo 11",
		ImageURL:     "http://localhost:4097/images/chat-123.png",
		Source:       "AI Visual Reconstruction",
		SourceDomain: "local",
		IsAI:         true,
	}

	scoreAI := ScoreImage(candAI, "Apollo 11 Launch")
	if scoreAI.AuthScore != 0.0 {
		t.Errorf("expected AuthScore 0 for AI image, got %f", scoreAI.AuthScore)
	}
}
