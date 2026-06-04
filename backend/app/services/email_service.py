import html
import json
import os
import smtplib
import ssl
from dataclasses import dataclass
from email.utils import make_msgid
from email.message import EmailMessage
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_BILLING_EMAIL = "billing@northbridgeia.com"
BRAND_NAME = "NorthBridgeAI"
BRAND_COLOR = "#172033"
BRAND_ACCENT_COLOR = "#FBBF24"


@dataclass
class EmailSendResult:
    sent: bool
    status: str
    error: Optional[str] = None


def email_configured() -> bool:
    return bool(os.getenv("RESEND_API_KEY") or os.getenv("SMTP_HOST"))


def get_email_settings_summary() -> dict:
    return {
        "configured": email_configured(),
        "provider": "resend" if os.getenv("RESEND_API_KEY") else "smtp",
        "resend_configured": bool(os.getenv("RESEND_API_KEY")),
        "smtp_host_configured": bool(os.getenv("SMTP_HOST")),
        "smtp_port": os.getenv("SMTP_PORT", "587"),
        "smtp_username_configured": bool(os.getenv("SMTP_USERNAME")),
        "smtp_use_tls": _env_bool("SMTP_USE_TLS", True),
        "smtp_use_ssl": _env_bool("SMTP_USE_SSL", False),
        "from": _format_sender(),
        "reply_to": os.getenv("BILLING_EMAIL_REPLY_TO") or DEFAULT_BILLING_EMAIL,
        "frontend_url": _frontend_url(),
    }


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _format_sender() -> str:
    email = (os.getenv("BILLING_EMAIL_FROM") or DEFAULT_BILLING_EMAIL).strip()
    name = (os.getenv("BILLING_EMAIL_FROM_NAME") or f"{BRAND_NAME} Billing").strip()
    return f"{name} <{email}>" if name else email


def _sender_email() -> str:
    return (os.getenv("BILLING_EMAIL_FROM") or DEFAULT_BILLING_EMAIL).strip()


def _sender_domain() -> str:
    email = _sender_email()
    return email.split("@", 1)[1] if "@" in email else "northbridgeia.com"


def _message_headers() -> dict:
    return {
        "Message-ID": make_msgid(domain=_sender_domain()),
        "X-Entity-Ref-ID": f"{BRAND_NAME.lower()}-transactional",
    }


def _frontend_url() -> str:
    return (os.getenv("FRONTEND_URL") or "https://www.northbridgeia.com").rstrip("/")


def _brand_logo_url() -> str | None:
    configured = (os.getenv("BRAND_LOGO_URL") or "").strip()
    if configured:
        return configured
    return f"{_frontend_url()}/northbridgeai-logo.svg"


def _brand_icon_html() -> str:
    logo_url = _brand_logo_url()
    if logo_url:
        return (
            f'<img src="{html.escape(logo_url)}" alt="{BRAND_NAME}" '
            'width="184" style="display:block;height:auto;max-width:184px" />'
        )
    return (
        f'<div style="display:inline-flex;align-items:center;gap:10px">'
        f'<span style="display:inline-flex;width:38px;height:38px;border-radius:10px;'
        f'align-items:center;justify-content:center;background:{BRAND_COLOR};'
        f'color:{BRAND_ACCENT_COLOR};font-weight:800">NB</span>'
        f'<span style="font-size:18px;font-weight:800;color:{BRAND_COLOR}">{BRAND_NAME}</span>'
        "</div>"
    )


def _branded_html(title: str, body_html: str, cta_label: str | None = None, cta_url: str | None = None) -> str:
    cta_html = ""
    if cta_label and cta_url:
        cta_html = f"""
        <p style="margin:28px 0">
          <a href="{html.escape(cta_url)}"
             style="display:inline-block;border-radius:8px;background:{BRAND_COLOR};color:#ffffff;
                    padding:12px 18px;text-decoration:none;font-weight:700">
            {html.escape(cta_label)}
          </a>
        </p>
        """

    return f"""
    <div style="margin:0;padding:0;background:#f8fafc">
      <div style="max-width:640px;margin:0 auto;padding:28px 18px">
        <div style="margin-bottom:20px">{_brand_icon_html()}</div>
        <div style="border:1px solid #e5e7eb;background:#ffffff;border-radius:12px;padding:28px;
                    font-family:Arial,sans-serif;color:#111827;line-height:1.6">
          <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:{BRAND_COLOR}">
            {html.escape(title)}
          </h1>
          {body_html}
          {cta_html}
          <p style="margin-top:28px;color:#6b7280;font-size:13px">
            {BRAND_NAME}<br />
            Canadian immigration planning, strategy, and document readiness.
          </p>
        </div>
      </div>
    </div>
    """


def _support_line(kind: str = "billing") -> str:
    if kind == "billing":
        return f"If you have billing questions, reply to this email or contact {DEFAULT_BILLING_EMAIL}."
    return f"If you need help, reply to this email or contact {DEFAULT_BILLING_EMAIL}."


def send_email(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
    reply_to: str | None = None,
) -> EmailSendResult:
    if os.getenv("RESEND_API_KEY"):
        return _send_email_with_resend(
            to_email=to_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            reply_to=reply_to,
        )

    if not email_configured():
        return EmailSendResult(
            sent=False,
            status="not_configured",
            error="RESEND_API_KEY or SMTP_HOST is not configured.",
        )

    smtp_host = os.getenv("SMTP_HOST", "").strip()
    try:
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError:
        return EmailSendResult(
            sent=False,
            status="failed",
            error="SMTP_PORT must be a number.",
        )
    smtp_username = os.getenv("SMTP_USERNAME", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_use_tls = _env_bool("SMTP_USE_TLS", True)
    smtp_use_ssl = _env_bool("SMTP_USE_SSL", False)

    message = EmailMessage()
    message["From"] = _format_sender()
    message["To"] = to_email
    message["Subject"] = subject
    message["Reply-To"] = reply_to or os.getenv("BILLING_EMAIL_REPLY_TO") or DEFAULT_BILLING_EMAIL
    for key, value in _message_headers().items():
        message[key] = value
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        if smtp_use_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=20) as server:
                if smtp_username:
                    server.login(smtp_username, smtp_password)
                server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                if smtp_use_tls:
                    server.starttls(context=ssl.create_default_context())
                if smtp_username:
                    server.login(smtp_username, smtp_password)
                server.send_message(message)
    except Exception as exc:
        return EmailSendResult(sent=False, status="failed", error=str(exc))

    return EmailSendResult(sent=True, status="sent")


def _send_email_with_resend(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
    reply_to: str | None = None,
) -> EmailSendResult:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key:
        return EmailSendResult(
            sent=False,
            status="not_configured",
            error="RESEND_API_KEY is not configured.",
        )

    payload = {
        "from": _format_sender(),
        "to": [to_email],
        "subject": subject,
        "html": html_body,
        "text": text_body,
        "reply_to": reply_to or os.getenv("BILLING_EMAIL_REPLY_TO") or _sender_email(),
        "headers": _message_headers(),
    }

    request = Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "northbridgeai/1.0",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=20) as response:
            if 200 <= response.status < 300:
                return EmailSendResult(sent=True, status="sent")
            return EmailSendResult(
                sent=False,
                status="failed",
                error=f"Resend returned HTTP {response.status}.",
            )
    except HTTPError as exc:
        try:
            body = exc.read().decode("utf-8")
        except Exception:
            body = str(exc)
        return EmailSendResult(
            sent=False,
            status="failed",
            error=f"Resend HTTP {exc.code}: {body}",
        )
    except URLError as exc:
        return EmailSendResult(sent=False, status="failed", error=str(exc.reason))
    except Exception as exc:
        return EmailSendResult(sent=False, status="failed", error=str(exc))


def build_payment_confirmation_email(
    *,
    customer_name: str | None,
    plan_name: str,
    amount: str,
    billing_email: str,
    receipt_url: str | None = None,
) -> tuple[str, str, str]:
    safe_name = (customer_name or "there").strip()
    receipt_line = f"Receipt: {receipt_url}" if receipt_url else "Receipt: available in your billing portal."

    subject = f"{BRAND_NAME} plan activated"
    text_body = f"""Hi {safe_name},

Your {BRAND_NAME} payment has been confirmed and your plan is active.

Plan: {plan_name}
Amount: {amount}
Billing email: {billing_email}
{receipt_line}

You can continue using your {BRAND_NAME} workspace right away.

{_support_line("billing")}

{BRAND_NAME} Billing
"""

    receipt_html = (
        f'<p><a href="{html.escape(receipt_url)}">View your receipt</a></p>'
        if receipt_url
        else "<p>Your receipt is available in your billing portal.</p>"
    )

    html_body = _branded_html(
        "Plan activated",
        f"""
      <p>Hi {html.escape(safe_name)},</p>
      <p>Your <strong>{BRAND_NAME}</strong> payment has been confirmed and your plan is active.</p>
      <table style="border-collapse:collapse;margin:20px 0">
        <tr>
          <td style="padding:6px 18px 6px 0;color:#6b7280">Plan</td>
          <td style="padding:6px 0;font-weight:600">{html.escape(plan_name)}</td>
        </tr>
        <tr>
          <td style="padding:6px 18px 6px 0;color:#6b7280">Amount</td>
          <td style="padding:6px 0;font-weight:600">{html.escape(amount)}</td>
        </tr>
        <tr>
          <td style="padding:6px 18px 6px 0;color:#6b7280">Billing email</td>
          <td style="padding:6px 0;font-weight:600">{html.escape(billing_email)}</td>
        </tr>
      </table>
      {receipt_html}
      <p>You can continue using your {BRAND_NAME} workspace right away.</p>
      <p style="color:#6b7280;font-size:13px">
        {_support_line("billing")}
      </p>
        """,
        cta_label="Open workspace",
        cta_url=f"{_frontend_url()}/dashboard",
    )

    return subject, text_body, html_body


def build_subscription_cancellation_email(
    *,
    customer_name: str | None,
    plan_name: str,
    billing_email: str,
    access_until: str | None = None,
) -> tuple[str, str, str]:
    safe_name = (customer_name or "there").strip()
    access_line = (
        f"You will keep access until {access_until}."
        if access_until
        else "You will keep access until the end of your current billing period."
    )

    subject = f"{BRAND_NAME} subscription cancellation confirmed"
    text_body = f"""Hi {safe_name},

Your {BRAND_NAME} subscription cancellation has been confirmed.

Plan: {plan_name}
Billing email: {billing_email}
{access_line}

No further renewal payment will be taken for this subscription.

{_support_line("billing")}

{BRAND_NAME} Billing
"""

    html_body = _branded_html(
        "Cancellation confirmed",
        f"""
      <p>Hi {html.escape(safe_name)},</p>
      <p>Your <strong>{BRAND_NAME}</strong> subscription cancellation has been confirmed.</p>
      <table style="border-collapse:collapse;margin:20px 0">
        <tr>
          <td style="padding:6px 18px 6px 0;color:#6b7280">Plan</td>
          <td style="padding:6px 0;font-weight:600">{html.escape(plan_name)}</td>
        </tr>
        <tr>
          <td style="padding:6px 18px 6px 0;color:#6b7280">Billing email</td>
          <td style="padding:6px 0;font-weight:600">{html.escape(billing_email)}</td>
        </tr>
      </table>
      <p>{html.escape(access_line)}</p>
      <p>No further renewal payment will be taken for this subscription.</p>
      <p style="color:#6b7280;font-size:13px">
        {_support_line("billing")}
      </p>
        """,
        cta_label="Manage billing",
        cta_url=f"{_frontend_url()}/pricing",
    )

    return subject, text_body, html_body


def build_billing_issue_email(
    *,
    customer_name: str | None,
    plan_name: str,
    billing_email: str,
    hosted_invoice_url: str | None = None,
) -> tuple[str, str, str]:
    safe_name = (customer_name or "there").strip()
    action_line = (
        f"Update payment: {hosted_invoice_url}"
        if hosted_invoice_url
        else "Please update your payment method from your billing page."
    )
    subject = f"{BRAND_NAME} billing issue"
    text_body = f"""Hi {safe_name},

We could not process the latest payment for your {BRAND_NAME} subscription.

Plan: {plan_name}
Billing email: {billing_email}
{action_line}

Your workspace may become limited if the issue is not resolved.

{_support_line("billing")}

{BRAND_NAME} Billing
"""
    html_body = _branded_html(
        "Billing issue",
        f"""
      <p>Hi {html.escape(safe_name)},</p>
      <p>We could not process the latest payment for your <strong>{BRAND_NAME}</strong> subscription.</p>
      <table style="border-collapse:collapse;margin:20px 0">
        <tr>
          <td style="padding:6px 18px 6px 0;color:#6b7280">Plan</td>
          <td style="padding:6px 0;font-weight:600">{html.escape(plan_name)}</td>
        </tr>
        <tr>
          <td style="padding:6px 18px 6px 0;color:#6b7280">Billing email</td>
          <td style="padding:6px 0;font-weight:600">{html.escape(billing_email)}</td>
        </tr>
      </table>
      <p>Your workspace may become limited if the issue is not resolved.</p>
      <p style="color:#6b7280;font-size:13px">{_support_line("billing")}</p>
        """,
        cta_label="Update payment",
        cta_url=hosted_invoice_url or f"{_frontend_url()}/pricing",
    )
    return subject, text_body, html_body


def build_onboarding_email(*, customer_name: str | None = None) -> tuple[str, str, str]:
    safe_name = (customer_name or "there").strip()
    subject = f"Welcome to {BRAND_NAME}"
    text_body = f"""Hi {safe_name},

Welcome to {BRAND_NAME}. Your workspace is ready.

Start by completing your profile, then review your strategy, documents, forms, and next steps.

{_support_line("support")}

{BRAND_NAME}
"""
    html_body = _branded_html(
        f"Welcome to {BRAND_NAME}",
        f"""
      <p>Hi {html.escape(safe_name)},</p>
      <p>Your workspace is ready.</p>
      <p>Start by completing your profile, then review your strategy, documents, forms, and next steps.</p>
        """,
        cta_label="Start onboarding",
        cta_url=f"{_frontend_url()}/onboarding",
    )
    return subject, text_body, html_body


def build_email_confirmation_email(*, confirmation_url: str) -> tuple[str, str, str]:
    subject = f"Confirm your {BRAND_NAME} email"
    text_body = f"""Confirm your email to finish setting up your {BRAND_NAME} account.

Confirmation link: {confirmation_url}

If you did not create this account, you can ignore this email.

{BRAND_NAME}
"""
    html_body = _branded_html(
        "Confirm your email",
        f"""
      <p>Confirm your email to finish setting up your <strong>{BRAND_NAME}</strong> account.</p>
      <p style="color:#6b7280;font-size:13px">If you did not create this account, you can ignore this email.</p>
        """,
        cta_label="Confirm email",
        cta_url=confirmation_url,
    )
    return subject, text_body, html_body


def build_password_reset_email(*, reset_url: str) -> tuple[str, str, str]:
    subject = f"Reset your {BRAND_NAME} password"
    text_body = f"""Use this link to reset your {BRAND_NAME} password:

{reset_url}

This link expires soon. If you did not request it, you can ignore this email.

{BRAND_NAME}
"""
    html_body = _branded_html(
        "Reset your password",
        """
      <p>Use this link to reset your password.</p>
      <p style="color:#6b7280;font-size:13px">This link expires soon. If you did not request it, you can ignore this email.</p>
        """,
        cta_label="Reset password",
        cta_url=reset_url,
    )
    return subject, text_body, html_body
