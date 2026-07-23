"""Pick what to scrape, then scrape it concurrently.

One producer thread per site walks that site's collections and *decides*: it
pages the listing, drops anything the quality gate rejects, and enqueues the
keepers up to the site's quota. A pool of workers drains the shared queue and
does the expensive part — downloading photos and writing the records.

Deciding in the producer is what makes the quota work: we stop paging a category
the moment its share is filled, and we never download images for a product we
were going to throw away. Because jobs from every site land in one queue,
workers always have something to do, and per-host politeness in `web.fetch`
keeps that well-behaved.

The quota is per **site**, split evenly across the categories that site has. A
category that can't fill its share does not borrow from the others: coming back
with 7 good rings is the intended outcome, not a reason to pad.
"""

import logging
import math
import queue
import threading
from collections import Counter
from dataclasses import dataclass, field
from typing import Callable, Protocol

from . import web
from .config import Config, Site
from .quality import Verdict

log = logging.getLogger("scraper.dispatch")


class Candidate(Protocol):
    """Whatever `prepare` produced: dispatch only reads the verdict off it and
    hands the rest back to the handler, so nothing is classified twice."""

    handle: str
    verdict: Verdict


# (site, category, candidate)
Job = tuple[Site, str, Candidate]
Prepare = Callable[[Site, str, dict], Candidate]
Handler = Callable[[Site, str, Candidate], None]
Seen = Callable[[str, str], bool]  # (category, handle) -> already on disk?

_STOP = object()  # sentinel telling a worker to exit


@dataclass
class Outcome:
    """What a site yielded, and why."""

    considered: int = 0
    kept: int = 0
    skipped: int = 0  # already on disk from an earlier run
    failed: int = 0
    quota: int = 0
    rejected: Counter = field(default_factory=Counter)
    per_category: Counter = field(default_factory=Counter)


def quota_for(site: Site, config: Config, categories: list[str], override: int | None) -> int:
    """Products to keep per category: the site's budget shared evenly between the
    categories it has. Rounded up, so a limit smaller than the category count
    still takes one of each rather than none."""
    limit = override or site.limit or config.limit
    return max(1, math.ceil(limit / max(1, len(categories))))


def run(sites: dict[str, Site], config: Config, categories: list[str] | None,
        limit: int | None, prepare: Prepare, seen: Seen, handler: Handler,
        workers: int) -> dict[str, Outcome]:
    """Scrape every site concurrently. Returns per-site outcomes."""
    jobs: queue.Queue = queue.Queue()
    outcomes = {name: Outcome() for name in sites}
    lock = threading.Lock()

    def produce(site: Site) -> None:
        outcome = outcomes[site.name]
        cats = config.categories_for(site, categories)
        if not cats:
            log.warning("%s has no collection for the requested categories", site.name)
            return
        quota = quota_for(site, config, cats, limit)
        outcome.quota = quota * len(cats)
        for category in cats:
            taken = 0
            budget = quota * config.oversample
            try:
                for raw in web.collection_products(site, category, budget, config.max_pages):
                    if taken >= quota:
                        break
                    handle = raw.get("handle") or ""
                    if seen(category, handle):
                        with lock:
                            outcome.skipped += 1
                        taken += 1
                        continue
                    with lock:
                        outcome.considered += 1
                    candidate = prepare(site, category, raw)
                    if not candidate.verdict:
                        with lock:
                            outcome.rejected[candidate.verdict.reason] += 1
                        log.debug("  reject %s/%s: %s %s", site.name, handle,
                                  candidate.verdict.reason, candidate.verdict.detail)
                        continue
                    taken += 1
                    with lock:
                        outcome.kept += 1
                        outcome.per_category[category] += 1
                    jobs.put((site, category, candidate))
            except Exception:
                log.exception("Failed to list %s/%s", site.name, category)
            if taken < quota:
                log.info("%s/%s: kept %d of a %d quota (nothing better on offer)",
                         site.name, category, taken, quota)

    def work() -> None:
        while True:
            job = jobs.get()
            try:
                if job is _STOP:
                    return
                site, category, candidate = job
                try:
                    handler(site, category, candidate)
                except Exception:
                    with lock:
                        outcomes[site.name].failed += 1
                        outcomes[site.name].kept -= 1
                    log.exception("Failed to scrape %s/%s", site.name, candidate.handle)
            finally:
                jobs.task_done()

    worker_threads = [threading.Thread(target=work, name=f"worker-{i}") for i in range(workers)]
    for t in worker_threads:
        t.start()

    producers = [threading.Thread(target=produce, args=(s,), name=f"producer-{n}")
                 for n, s in sites.items()]
    for t in producers:
        t.start()
    for t in producers:
        t.join()  # all jobs now enqueued

    for _ in worker_threads:
        jobs.put(_STOP)
    for t in worker_threads:
        t.join()

    return outcomes
