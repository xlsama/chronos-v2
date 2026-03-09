from pathlib import Path

from langchain_core.tools import tool
from loguru import logger


@tool
async def read_file(file_path: str) -> str:
    """Read the contents of a file."""
    logger.info(f"Reading file: {file_path}")
    try:
        content = Path(file_path).read_text(encoding="utf-8")
        if len(content) > 50000:
            return content[:50000] + "\n... (truncated)"
        return content
    except Exception as e:
        return f"ERROR: {e}"


@tool
async def write_file(file_path: str, content: str) -> str:
    """Write content to a file. Creates parent directories if needed."""
    logger.info(f"Writing file: {file_path}")
    try:
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return f"Successfully wrote {len(content)} bytes to {file_path}"
    except Exception as e:
        return f"ERROR: {e}"
