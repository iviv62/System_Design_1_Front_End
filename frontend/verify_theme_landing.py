import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})

        await page.goto("http://localhost:5173/")
        await page.wait_for_timeout(2000)

        # Take light theme screenshot
        await page.evaluate("document.body.setAttribute('data-theme', 'light')")
        await page.wait_for_timeout(1000)
        await page.screenshot(path="/home/jules/verification/screenshots/landing_light.png")

        # Take dark theme screenshot
        await page.evaluate("document.body.setAttribute('data-theme', 'dark')")
        await page.wait_for_timeout(1000)
        await page.screenshot(path="/home/jules/verification/screenshots/landing_dark.png")

        await browser.close()
        print("Screenshots captured successfully.")

if __name__ == "__main__":
    asyncio.run(main())
