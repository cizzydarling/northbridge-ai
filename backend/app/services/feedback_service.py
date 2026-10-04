import os
import re
from app.core.access_control import has_individual_pro, has_premium_access
from app.models.beta_feedback_model import BetaFeedback


def create_feedback(db, user, payload):
    if payload.category != 'ai' or payload.page_path != '/chat':
        payload.ai_status = None
    version = os.getenv('APP_VERSION') or os.getenv('RENDER_GIT_COMMIT', '')
    version = version if re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._+-]{0,63}', version) else None
    row = BetaFeedback(**payload.model_dump(), user_id=user.id, user_role=user.role,
                       user_plan='premium' if has_premium_access(user) else 'pro' if has_individual_pro(user) else 'free',
                       backend_version=version)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {'success': True, 'feedback_id': row.id}
