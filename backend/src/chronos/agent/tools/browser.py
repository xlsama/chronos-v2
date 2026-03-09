from langchain_core.tools import tool
from loguru import logger


@tool
async def browser(url: str) -> str:
    """Fetch the content of a web page. Useful for checking Grafana dashboards, API docs, etc."""
    logger.info(f"Fetching URL: {url}")
    try:
        import httpx

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            response = await client.get(url)
            content = response.text
            if len(content) > 50000:
                content = content[:50000] + "\n... (truncated)"
            return f"Status: {response.status_code}\n\n{content}"
    except Exception as e:
        return f"ERROR: {e}"
