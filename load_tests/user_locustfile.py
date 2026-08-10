"""Locust load test focused only on user/auth-related APIs."""

import random

try:
    from load_tests.config import API_PREFIX, BACKEND_BASE_URL, TEST_USERS
except ModuleNotFoundError:  # pragma: no cover - fallback for local execution
    from config import API_PREFIX, BACKEND_BASE_URL, TEST_USERS

from locust import HttpUser, between, task


class UserModuleUser(HttpUser):
    """Exercises only auth/user endpoints: signup, login, and profile."""

    wait_time = between(1, 3)
    host = BACKEND_BASE_URL
    weight = 1

    def on_start(self) -> None:
        self.client.headers.update({"Content-Type": "application/json"})
        self.user_info = random.choice(TEST_USERS)
        self.token: str | None = None

    def _signup_or_login(self) -> None:
        signup_payload = {
            "full_name": self.user_info["full_name"],
            "email": self.user_info["email"],
            "password": self.user_info["password"],
        }

        with self.client.post(
            f"{API_PREFIX}/auth/signup",
            json=signup_payload,
            catch_response=True,
            name="auth/signup",
        ) as resp:
            if resp.status_code == 201:
                self.token = resp.json().get("access_token")
                resp.success()
                return
            if resp.status_code == 409:
                resp.success()
            else:
                resp.failure(f"Signup failed: {resp.status_code} {resp.text}")

        login_payload = {
            "email": self.user_info["email"],
            "password": self.user_info["password"],
        }
        with self.client.post(
            f"{API_PREFIX}/auth/login",
            json=login_payload,
            catch_response=True,
            name="auth/login",
        ) as resp:
            if resp.status_code == 200:
                self.token = resp.json().get("access_token")
                resp.success()
            else:
                resp.failure(f"Login failed: {resp.status_code} {resp.text}")

    @task(3)
    def signup_and_login(self) -> None:
        self._signup_or_login()

    @task(2)
    def get_profile(self) -> None:
        if not self.token:
            self._signup_or_login()
            return

        with self.client.get(
            f"{API_PREFIX}/auth/me",
            headers={"Authorization": f"Bearer {self.token}"},
            catch_response=True,
            name="auth/me",
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 401:
                resp.failure("Token expired or invalid")
                self.token = None
                self._signup_or_login()
            else:
                resp.failure(f"GET /auth/me failed: {resp.status_code}")
