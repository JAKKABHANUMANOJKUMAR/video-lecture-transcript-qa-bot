"""Pre-create the load-test account pool.

Run this BEFORE a login or browse test. Otherwise the first hit from every
virtual user is a signup, and signup is even more expensive than login (one
bcrypt hash plus an INSERT), so the opening seconds of the run are measuring
the wrong thing entirely.

Usage:
    python loadtest/seed_users.py            # create the whole pool
    python loadtest/seed_users.py 50         # just the first 50

Only needs `requests`; no app imports, so any Python with requests works.
"""

from __future__ import annotations

import sys
import time

import requests

from config import API, POOL_SIZE, account


def seed(count: int) -> None:
    created = existing = failed = 0
    started = time.monotonic()

    for n in range(count):
        email, password = account(n)
        try:
            r = requests.post(
                f"{API}/api/auth/signup",
                json={"full_name": f"Load Test {n}", "email": email, "password": password},
                timeout=30,
            )
        except requests.RequestException as exc:
            print(f"  {email}: cannot reach {API} — {exc}")
            failed += 1
            break

        if r.status_code == 201:
            created += 1
        elif r.status_code == 409:
            existing += 1
        else:
            failed += 1
            print(f"  {email}: {r.status_code} {r.text[:120]}")

        done = n + 1
        if done % 25 == 0 or done == count:
            print(f"  {done}/{count} …")

    elapsed = time.monotonic() - started
    print(
        f"\ncreated {created}, already existed {existing}, failed {failed} "
        f"in {elapsed:.1f}s"
    )
    if created:
        # Signup is one bcrypt hash, so this doubles as a cheap measure of how
        # expensive authentication is on this machine.
        print(f"~{elapsed / max(created, 1) * 1000:.0f} ms per signup (bcrypt-bound)")
    print("\nRemove them afterwards with:  python loadtest/cleanup.py")


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else POOL_SIZE
    print(f"Seeding {n} accounts at {API} …")
    seed(n)
