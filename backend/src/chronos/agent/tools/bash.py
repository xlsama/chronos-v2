import asyncio

from langchain_core.tools import tool
from loguru import logger

COMMAND_BLACKLIST = [
    "rm -rf /",
    "mkfs",
    "dd if=",
    "> /dev/sd",
    ":(){ :|:& };:",
]


def _is_safe(command: str) -> bool:
    for blocked in COMMAND_BLACKLIST:
        if blocked in command:
            return False
    return True


@tool
async def bash(command: str) -> str:
    """Execute a shell command on the target host. Returns stdout and stderr."""
    if not _is_safe(command):
        return f"ERROR: Command blocked by safety filter: {command}"

    logger.info(f"Executing bash command: {command}")
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        output = stdout.decode() if stdout else ""
        errors = stderr.decode() if stderr else ""

        result = ""
        if output:
            result += output
        if errors:
            result += f"\nSTDERR:\n{errors}"
        if proc.returncode != 0:
            result += f"\nExit code: {proc.returncode}"

        return result or "(no output)"
    except TimeoutError:
        return "ERROR: Command timed out after 60 seconds"
    except Exception as e:
        return f"ERROR: {e}"
