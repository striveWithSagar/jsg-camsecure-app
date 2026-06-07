"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Briefcase, Inbox, Users, HardHat } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, REQUEST_STATUS_LABELS } from "@/lib/constants";
import type { GlobalSearchResults } from "@/lib/data/global-search";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

const TECH_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  on_job: "On Job",
  on_the_way: "En Route",
  needs_parts: "Needs Parts",
  off_duty: "Off Duty",
};

type SearchState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "done"; results: GlobalSearchResults };

type FlatItem = {
  key: string;
  href: string;
  icon: typeof Briefcase;
  label: string;
  secondary: string;
  badge?: string;
};

function buildFlatItems(results: GlobalSearchResults | null): { groups: { title: string; items: FlatItem[] }[]; flat: FlatItem[] } {
  if (!results) return { groups: [], flat: [] };

  const groups = [
    {
      title: "Jobs",
      items: results.jobs.map((j) => ({
        key: `job-${j.id}`,
        href: `/jobs/${j.id}`,
        icon: Briefcase,
        label: j.label,
        secondary: j.secondary,
        badge: STATUS_LABELS[j.status as keyof typeof STATUS_LABELS] ?? j.status,
      })),
    },
    {
      title: "Service Requests",
      items: results.requests.map((r) => ({
        key: `request-${r.id}`,
        href: `/requests/${r.id}`,
        icon: Inbox,
        label: r.label,
        secondary: r.secondary,
        badge: REQUEST_STATUS_LABELS[r.status as keyof typeof REQUEST_STATUS_LABELS] ?? r.status,
      })),
    },
    {
      title: "Clients",
      items: results.clients.map((c) => ({
        key: `client-${c.id}`,
        href: `/clients/${c.id}`,
        icon: Users,
        label: c.label,
        secondary: c.secondary,
      })),
    },
    {
      title: "Technicians",
      items: results.technicians.map((t) => ({
        key: `technician-${t.id}`,
        href: `/technicians/${t.id}`,
        icon: HardHat,
        label: t.label,
        secondary: t.secondary,
        badge: TECH_STATUS_LABELS[t.status] ?? t.status,
      })),
    },
  ].filter((g) => g.items.length > 0);

  return { groups, flat: groups.flatMap((g) => g.items) };
}

export function GlobalSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>({ phase: "idle" });
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = query.trim();
  const queryTooShort = trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH;

  // ── Debounced fetch — every setState happens inside the timer/fetch
  // callbacks (subscribing to an external system), never synchronously in
  // the effect body, per react-hooks/set-state-in-effect. ──
  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearchState({ phase: "loading" });
      fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error("Search failed");
          return res.json() as Promise<GlobalSearchResults>;
        })
        .then((data) => {
          setSearchState({ phase: "done", results: data });
          setActiveIndex(-1);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") {
            setSearchState({ phase: "error", message: "Something went wrong. Try again." });
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  // ── Click outside closes the panel ──
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const results = searchState.phase === "done" ? searchState.results : null;
  const loading = searchState.phase === "loading";
  const error = searchState.phase === "error" ? searchState.message : null;
  const { groups, flat } = buildFlatItems(results);

  function navigateTo(item: FlatItem) {
    setIsOpen(false);
    setQuery("");
    setSearchState({ phase: "idle" });
    router.push(item.href);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setIsOpen(false);
      (e.target as HTMLInputElement).blur();
      return;
    }
    if (!isOpen || flat.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = activeIndex >= 0 ? flat[activeIndex] : flat[0];
      if (item) navigateTo(item);
    }
  }

  const showPanel = isOpen && trimmed.length > 0;

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md hidden sm:block">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search jobs, requests, clients, technicians…"
        className="pl-9 h-8 text-sm bg-muted/40 border-border/60 focus-visible:ring-primary/40"
        role="combobox"
        aria-expanded={showPanel}
        aria-autocomplete="list"
        aria-controls="global-search-results"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
      )}

      {showPanel && (
        <div
          id="global-search-results"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-[28rem] overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
        >
          {queryTooShort ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Start typing to search</p>
          ) : error ? (
            <p className="px-4 py-6 text-sm text-c-emergency text-center">{error}</p>
          ) : loading && !results ? (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          ) : flat.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No matching records found</p>
          ) : (
            <div className="py-1.5">
              {groups.map((group) => (
                <div key={group.title} className="mb-1 last:mb-0">
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </p>
                  {group.items.map((item) => {
                    const index = flat.indexOf(item);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => navigateTo(item)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                          index === activeIndex ? "bg-muted/60" : "hover:bg-muted/40"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-foreground truncate">{item.label}</span>
                          {item.secondary && (
                            <span className="block text-xs text-muted-foreground truncate">{item.secondary}</span>
                          )}
                        </span>
                        {item.badge && (
                          <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground bg-muted/40">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
