import os
from pathlib import Path
from typing import Iterator
from openai import OpenAI
from dotenv import load_dotenv
load_dotenv() # To load the environment variables from the .env file

# Load backend/.env
_env = Path(__file__).parent.parent / ".env"
if _env.exists():
    for line in _env.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

API_KEY = os.environ["VLLM_API_KEY"]
BASE_URL = os.environ["VLLM_BASE_URL"]
MODEL = os.environ["VLLM_MODEL"]

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", "You are a helpful assistant, named monday.") # Added this to the env so everything is configured in the one env and no hardcoded variables


def chat(messages: list[dict], model: str = MODEL, max_tokens: int = 1024) -> str:
    all_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages
    response = client.chat.completions.create(
        model=model,
        messages=all_messages,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


def chat_stream(
    messages: list[dict], model: str = MODEL, max_tokens: int = 1024
) -> Iterator[str]:
    all_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages
    stream = client.chat.completions.create(
        model=model,
        messages=all_messages,
        max_tokens=max_tokens,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
