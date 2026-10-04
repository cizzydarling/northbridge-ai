from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

Category = Literal['bug', 'ux', 'ai', 'content', 'feature', 'general']
FeedbackStatus = Literal['new', 'reviewed', 'planned', 'resolved', 'dismissed']
# Static route names only. Unknown/dynamic paths never enter persisted diagnostics.
PAGES = frozenset('/dashboard /profile /household /applications /strategy /chat /forms /career-match /career-match/province /career-match/saved /citizenship /citizenship/quiz /citizenship/progress /language-practice /official-finders /self/application /documents /self/documents /documents/generator /documents/review /pricing /billing /billing/success /upgrade /onboarding /legal/disclosure'.split())


def safe_page(value):
    path = value.split('?', 1)[0].split('#', 1)[0].rstrip('/')
    return path if path in PAGES else '/other'


class FeedbackCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    category: Category
    message: str = Field(min_length=10, max_length=4000)
    rating: int | None = Field(default=None, ge=1, le=5, strict=True)
    allow_follow_up: bool = Field(default=False, strict=True)
    page_path: str = Field(max_length=2048)
    language: Literal['en', 'fr']
    application_version: str | None = Field(default=None, max_length=64, pattern=r'^[A-Za-z0-9][A-Za-z0-9._+-]*$')
    device_context: Literal['mobile', 'tablet', 'desktop'] | None = None
    ai_status: Literal['available', 'unavailable', 'not_requested'] | None = None

    @field_validator('page_path')
    @classmethod
    def normalize_path(cls, value):
        return safe_page(value)


class FeedbackStatusUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: FeedbackStatus
