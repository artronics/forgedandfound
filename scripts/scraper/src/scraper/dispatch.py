"""A small producer/consumer queue that scrapes several sites concurrently.

One producer thread per site fetches that site's product listing and enqueues a
job per product; a pool of worker threads drains the queue. Because jobs from
every site land in one shared queue, workers always have something to dispatch —
they process one site's products while another site's listing is still loading,
and photo downloads across sites overlap. Per-host politeness is handled in
web.fetch, so concurrency here stays well-behaved.
"""

import logging
import queue
import threading
from typing import Callable

from . import web

log = logging.getLogger("scraper.dispatch")

# (site_name, site_config, category, raw_product)
Job = tuple[str, dict, str, dict]
Handler = Callable[[str, dict, str, dict], None]

_STOP = object()  # sentinel telling a worker to exit


def run(sites: dict[str, dict], category: str, limit: int, handler: Handler, workers: int) -> int:
    """Scrape `category` from every site concurrently. Returns the failure count.

    `handler(site_name, site, category, raw)` processes one product; exceptions
    are logged and counted so a single bad product (or site) never aborts the run.
    """
    jobs: queue.Queue = queue.Queue()
    failures = 0
    failures_lock = threading.Lock()

    def produce(site_name: str, site: dict) -> None:
        try:
            for raw in web.collection_products(site, category, limit):
                jobs.put((site_name, site, category, raw))
        except Exception:
            log.exception("Failed to list %s", site_name)

    def work() -> None:
        nonlocal failures
        while True:
            job = jobs.get()
            try:
                if job is _STOP:
                    return
                site_name, site, cat, raw = job
                try:
                    handler(site_name, site, cat, raw)
                except Exception:
                    with failures_lock:
                        failures += 1
                    log.exception("Failed to scrape %s/%s", site_name, raw.get("handle"))
            finally:
                jobs.task_done()

    worker_threads = [threading.Thread(target=work, name=f"worker-{i}") for i in range(workers)]
    for t in worker_threads:
        t.start()

    # Produce listings concurrently so the queue fills as early as possible.
    producers = [threading.Thread(target=produce, args=(n, s), name=f"producer-{n}") for n, s in sites.items()]
    for t in producers:
        t.start()
    for t in producers:
        t.join()  # all jobs now enqueued

    for _ in worker_threads:
        jobs.put(_STOP)
    for t in worker_threads:
        t.join()

    return failures
