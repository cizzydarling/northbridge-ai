import html
import os
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Optional


DEFAULT_BILLING_EMAIL = "billing@northbridgeia.com"


@dataclass
class EmailSendResult:
    sent: bool
    status: str
    error: Optional[str] = None


def email_configured() -> bool:
    return bool(os.getenv("SMTP_HOST"))


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _format_sender() -> str:
    email = (os.getenv("BILLING_EMAIL_FROM") or DEFAULT_BILLING_EMAIL).strip()
    name = (os.getenv("BILLING_EMAIL_FROM_NAME") or "NorthbridgeAI Billing").strip()
    return f"{name} <{email}>" if name else email


def send_email(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
    reply_to: str | None = None,
) -> EmailSendResult:
    if not email_configured():
        return EmailSendResult(
            sent=False,
            status="not_configured",
            error="SMTP_HOST is not configured.",
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

    subject = "NorthbridgeAI payment confirmed"
    text_body = f"""Hi {safe_name},

Your NorthbridgeAI payment has been confirmed.

Plan: {plan_name}
Amount: {amount}
Billing email: {billing_email}
{receipt_line}

You can continue using your NorthbridgeAI workspace right away.

If you have billing questions, reply to this email or contact {DEFAULT_BILLING_EMAIL}.

NorthbridgeAI Billing
"""

    receipt_html = (
        f'<p><a href="{html.escape(receipt_url)}">View your receipt</a></p>'
        if receipt_url
        else "<p>Your receipt is available in your billing portal.</p>"
    )

    html_body = f"""
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
      <p>Hi {html.escape(safe_name)},</p>
      <p>Your <strong>NorthbridgeAI</strong> payment has been confirmed.</p>
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
      <p>You can continue using your NorthbridgeAI workspace right away.</p>
      <p style="color:#6b7280;font-size:13px">
        If you have billing questions, reply to this email or contact {DEFAULT_BILLING_EMAIL}.
      </p>
      <p>NorthbridgeAI Billing</p>
    </div>
    """

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

    subject = "NorthbridgeAI subscription cancellation confirmed"
    text_body = f"""Hi {safe_name},

Your NorthbridgeAI subscription cancellation has been confirmed.

Plan: {plan_name}
Billing email: {billing_email}
{access_line}

No further renewal payment will be taken for this subscription.

If this was a mistake or you have billing questions, reply to this email or contact {DEFAULT_BILLING_EMAIL}.

NorthbridgeAI Billing
"""

    html_body = f"""
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
      <p>Hi {html.escape(safe_name)},</p>
      <p>Your <strong>NorthbridgeAI</strong> subscription cancellation has been confirmed.</p>
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
        If this was a mistake or you have billing questions, reply to this email or contact {DEFAULT_BILLING_EMAIL}.
      </p>
      <p>NorthbridgeAI Billing</p>
    </div>
    """

    return subject, text_body, html_body
