import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

from app.config import settings


BACKEND_ROOT = Path(__file__).resolve().parents[2]
LOG_DIR = BACKEND_ROOT / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

APP_LOG_FILE = LOG_DIR / "app.log"
ERROR_LOG_FILE = LOG_DIR / "error.log"
LOG_TXT_FILE = LOG_DIR / "log.txt"
ERROR_TXT_FILE = LOG_DIR / "error.txt"

for path in (APP_LOG_FILE, ERROR_LOG_FILE, LOG_TXT_FILE, ERROR_TXT_FILE):
    path.touch(exist_ok=True)


def get_logger(name: str, *, level: Optional[int] = None) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(level or getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
    logger.propagate = False

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    file_handler = RotatingFileHandler(
        APP_LOG_FILE,
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    log_txt_handler = RotatingFileHandler(
        LOG_TXT_FILE,
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    log_txt_handler.setFormatter(formatter)
    logger.addHandler(log_txt_handler)

    error_handler = RotatingFileHandler(
        ERROR_LOG_FILE,
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    error_handler.setFormatter(formatter)
    error_handler.setLevel(logging.ERROR)
    logger.addHandler(error_handler)

    error_txt_handler = RotatingFileHandler(
        ERROR_TXT_FILE,
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    error_txt_handler.setFormatter(formatter)
    error_txt_handler.setLevel(logging.ERROR)
    logger.addHandler(error_txt_handler)

    return logger


app_logger = get_logger("video_lecture_bot")
