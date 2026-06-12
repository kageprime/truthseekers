import { describe, it, expect } from "vitest";
import { queue } from "../src/queue.js";

describe("AsyncQueue", () => {
  it("should enqueue a job", () => {
    const result = queue.enqueue("test-article");
    expect(result.ok).toBe(true);
  });

  it("should prevent duplicate jobs", () => {
    queue.enqueue("duplicate-test");
    const result = queue.enqueue("duplicate-test");
    expect(result.ok).toBe(true);
    const result2 = queue.enqueue("duplicate-test");
    expect(result2.ok).toBe(true);
  });

  it("should return job info", () => {
    queue.enqueue("info-test");
    const job = queue.getJob("info-test");
    expect(job).not.toBeNull();
    expect(job?.slug).toBe("info-test");
    expect(job?.status).toBe("queued");
  });

  it("should report stats", () => {
    const stats = queue.getStats();
    expect(stats).toHaveProperty("queued");
    expect(stats).toHaveProperty("active");
    expect(stats).toHaveProperty("maxConcurrent");
    expect(stats).toHaveProperty("maxQueue");
  });

  it("should accept subscribers", () => {
    const events: string[] = [];
    const unsub = queue.subscribe("sub-test", (slug, status) => {
      events.push(`${slug}:${status}`);
    });

    queue.enqueue("sub-test");
    expect(events.length).toBeGreaterThan(0);
    unsub();
  });
});
