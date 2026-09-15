package storage

import (
	"testing"
)

// ponytail: the billing ledger must behave the same in file mode — the old
// mock (Create→nil, Mark→true, Get→ErrNoRows) double-fulfilled and the quota
// stub never counted.
func TestMockBillingLedger(t *testing.T) {
	d := &DB{mockMode: true, mockPayments: map[string]*PaystackPayment{}, mockUsage: map[string]int{}, mockWebhooks: map[string]bool{}}

	if err := d.CreatePayment(PaystackPayment{Reference: "ref-1", UserID: "u1", Tier: "pro"}); err != nil {
		t.Fatalf("create: %v", err)
	}
	p, err := d.GetPaymentByReference("ref-1")
	if err != nil || p.UserID != "u1" {
		t.Fatalf("get: %v %+v", err, p)
	}
	first, err := d.MarkPaymentPaid("ref-1")
	if err != nil || !first {
		t.Fatalf("first mark: %v %t", err, first)
	}
	again, err := d.MarkPaymentPaid("ref-1")
	if err != nil || again {
		t.Fatalf("double mark must be no-op: %v %t", err, again)
	}

	for i := 0; i < 2; i++ {
		ok, _, err := d.CheckAndIncrementDailyUsage("u1", 2)
		if err != nil || !ok {
			t.Fatalf("use %d: %v %t", i, err, ok)
		}
	}
	if ok, _, _ := d.CheckAndIncrementDailyUsage("u1", 2); ok {
		t.Fatal("third use over limit 2 allowed")
	}
	if got := d.DailyUsageUsed("u1"); got != 2 {
		t.Fatalf("used=%d, want 2", got)
	}

	fresh, _ := d.RecordWebhookEvent("charge.success:1")
	if !fresh {
		t.Fatal("first event not fresh")
	}
	if fresh, _ := d.RecordWebhookEvent("charge.success:1"); fresh {
		t.Fatal("replay not detected")
	}
	d.DeleteWebhookEvent("charge.success:1")
	if fresh, _ := d.RecordWebhookEvent("charge.success:1"); !fresh {
		t.Fatal("released key not fresh again")
	}
}
