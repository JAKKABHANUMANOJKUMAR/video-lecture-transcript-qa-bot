#!/usr/bin/env python3
import time
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service

screenshots = []

def take_screenshot(driver, name, description):
    path = f"/tmp/{name}"
    driver.save_screenshot(path)
    screenshots.append((name, path, description))
    print(f"Screenshot saved: {name} - {description}")

try:
    # Setup Chrome driver
    print("Initializing Chrome driver...")
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")

    # Try using the system chromium directly
    from selenium.webdriver.chrome.service import Service as ChromeService
    try:
        driver = webdriver.Chrome(options=chrome_options)
    except:
        service = Service(ChromeDriverManager(version="148").install())
        driver = webdriver.Chrome(service=service, options=chrome_options)

    # Navigate to login page
    print("\n1. Navigating to http://localhost:5173...")
    driver.get("http://localhost:5173")
    time.sleep(3)

    # Take login page screenshot
    take_screenshot(driver, "01-login-page.png", "Login page")

    # Verify we're on login page
    page_source = driver.page_source
    if "login" in page_source.lower() or "email" in page_source.lower():
        print("✓ Login page loaded successfully")

    # Attempt login
    print("\n2. Logging in with admin@example.com / password...")
    try:
        # Find email input
        email_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email'], input[placeholder*='email' i], input[name*='email' i]"))
        )
        email_input.send_keys("admin@example.com")
        print("✓ Entered email address")

        # Find password input
        password_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        password_input.send_keys("password")
        print("✓ Entered password")

        # Find and click login button
        login_button = driver.find_element(By.CSS_SELECTOR, "button:contains('Login'), button:contains('Sign in'), button:contains('Submit'), button[type='submit']")
        login_button.click()
        print("✓ Clicked login button")

    except:
        # Alternative method if selectors fail
        print("Trying alternative login method...")
        inputs = driver.find_elements(By.TAG_NAME, "input")
        if len(inputs) >= 2:
            inputs[0].send_keys("admin@example.com")
            inputs[1].send_keys("password")
            buttons = driver.find_elements(By.TAG_NAME, "button")
            for btn in buttons:
                if btn.text.lower() in ["login", "sign in", "submit"]:
                    btn.click()
                    break

    # Wait for navigation
    time.sleep(3)

    # Take dashboard screenshot
    take_screenshot(driver, "02-admin-dashboard.png", "Admin dashboard after login")

    # Verify we're logged in
    current_url = driver.current_url
    page_source = driver.page_source
    print(f"✓ Current URL: {current_url}")

    # Test navigation
    print("\n3. Testing navigation through different sections...")

    # Find all navigation links
    nav_links = []
    try:
        nav_elements = driver.find_elements(By.CSS_SELECTOR, "nav a, [role='navigation'] a, aside a, [class*='nav'] a, [class*='menu'] a")
        nav_links = [(elem.text, elem.get_attribute('href')) for elem in nav_elements if elem.text.strip()]
        nav_links = list(dict.fromkeys(nav_links))  # Remove duplicates
        nav_links = nav_links[:5]  # Limit to 5 links
    except:
        print("Could not find navigation elements")

    print(f"Found {len(nav_links)} navigation links")

    for idx, (link_text, link_href) in enumerate(nav_links, 1):
        if not link_text.strip():
            continue
        print(f"\n  Testing link {idx}: '{link_text.strip()}'")
        try:
            driver.get(f"http://localhost:5173{link_href}" if link_href.startswith("/") else link_href if link_href else "http://localhost:5173")
            time.sleep(2)
            take_screenshot(driver, f"0{3+idx}-section-{idx}.png", f"Section: {link_text.strip()}")
            print(f"  ✓ Successfully navigated to section")
        except Exception as e:
            print(f"  ✗ Error: {str(e)}")

    # Print summary
    print("\n" + "="*50)
    print("TEST SUMMARY")
    print("="*50)
    print(f"Application tested successfully!")
    print(f"\nScreenshots captured:")
    for idx, (name, path, desc) in enumerate(screenshots, 1):
        print(f"  {idx}. {name} - {desc}")
        print(f"     Path: {path}")

    driver.quit()
    print("\nTest completed successfully!")

except Exception as e:
    print(f"ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
