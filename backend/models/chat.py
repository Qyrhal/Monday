from pydantic import BaseModel
from typing import Optional


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str = "monday"
    messages: list[Message]
    stream: bool = False
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1024


class ChatChoice(BaseModel):
    index: int
    message: Message
    finish_reason: str


class ChatUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    model: str
    choices: list[ChatChoice]
    usage: ChatUsage
