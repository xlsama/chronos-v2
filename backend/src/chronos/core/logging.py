import sys

from loguru import logger

from chronos.core.config import settings


def setup_logging() -> None:
    logger.remove()
    level = "DEBUG" if settings.DEBUG else "INFO"
    fmt = (
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
    )
    logger.add(sys.stderr, level=level, format=fmt)
