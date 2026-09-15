"use client";

type ArticleBusEvent = 
  | { type: "CLAIM_CLICKED"; payload: { claimId: string; text?: string } }
  | { type: "SECTION_ENTERED"; payload: { sectionId: string; title: string } };

class ArticleBus extends EventTarget {
  emit(event: ArticleBusEvent) {
    this.dispatchEvent(new CustomEvent("article_event", { detail: event }));
  }

  subscribe(callback: (event: ArticleBusEvent) => void) {
    const handler = (e: Event) => {
      const customEv = e as CustomEvent<ArticleBusEvent>;
      if (customEv.detail) {
        callback(customEv.detail);
      }
    };
    this.addEventListener("article_event", handler);
    return () => {
      this.removeEventListener("article_event", handler);
    };
  }
}

export const articleBus = new ArticleBus();
