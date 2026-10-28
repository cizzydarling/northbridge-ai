from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class ShortlistCreate(BaseModel):
 model_config=ConfigDict(extra='forbid')
 kind: Literal['dli','test_centre']
 resource_id: str = Field(pattern=r'^[a-f0-9]{32}$')
 provider: Literal['celpip','ielts','pte','tef','tcf'] | None = None
