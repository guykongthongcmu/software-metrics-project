from datetime import date
from html import escape

COLORS = {
    'background': '#f5f1eb',
    'surface': '#f9f6f1',
    'card': '#ffffff',
    'border': '#e3d7c8',
    'heading': '#5b4f44',
    'text': '#6f6357',
    'muted': '#8c8074',
    'accent': '#a3927f',
    'accent_dark': '#8b7a68',
}

AUTOMATED_NOTE = 'This is an automated email. Please do not reply directly.'


def greeting_for(first_name):
    return f'Hi {first_name},' if first_name else 'Hi there,'


def minutes_label(minutes):
    return f'{minutes} minute' if minutes == 1 else f'{minutes} minutes'


def render_email(brand_name, title, greeting, intro_lines, cta=None, sections=None,
                 outro_lines=None, logo_src='', preview_text='', support_email='',
                 footer_note=''):
    """Build the branded (html, text) pair. cta is a (label, url) tuple."""
    sections = [s for s in (sections or []) if s['lines']]
    outro_lines = outro_lines or []
    year = date.today().year
    c = COLORS

    logo = ''
    if logo_src:
        logo = (f'<img src="{escape(logo_src)}" alt="{escape(brand_name)}" width="132" '
                'style="display:block;margin:0 auto 22px;border:0;" />')
    preheader = ''
    if preview_text:
        preheader = ('<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'
                     f'{escape(preview_text)}</div>')

    paragraphs = ''.join(
        f'<p style="margin:0 0 12px;color:{c["text"]};line-height:1.6;">{escape(line)}</p>'
        for line in intro_lines
    )
    sections_html = ''
    for section in sections:
        items = ''.join(f'<li style="margin:0 0 6px;">{escape(line)}</li>' for line in section['lines'])
        sections_html += (
            f'<h2 style="margin:20px 0 8px;font-size:16px;color:{c["heading"]};">{escape(section["title"])}</h2>'
            f'<ul style="margin:0 0 16px 18px;padding:0;color:{c["text"]};line-height:1.6;">{items}</ul>'
        )
    cta_html = ''
    if cta:
        label, url = cta
        cta_html = (
            '<p style="margin:20px 0 24px;">'
            f'<a href="{escape(url)}" style="display:inline-block;background:{c["accent"]};color:#ffffff;'
            'text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;'
            f'border:1px solid {c["accent_dark"]};">{escape(label)}</a></p>'
        )
    outro = ''.join(
        f'<p style="margin:0 0 10px;color:{c["text"]};line-height:1.6;">{escape(line)}</p>'
        for line in outro_lines
    )
    footer = ''
    if footer_note:
        footer += f'<p style="margin:0 0 6px;color:{c["muted"]};">{escape(footer_note)}</p>'
    if support_email:
        footer += f'<p style="margin:0;color:{c["muted"]};">Need help? Contact {escape(support_email)}.</p>'

    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{escape(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:{c["background"]};font-family:'Helvetica Neue',Arial,sans-serif;color:{c["text"]};">
    {preheader}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:{c["card"]};border-radius:16px;overflow:hidden;border:1px solid {c["border"]};">
            <tr><td style="height:8px;background:{c["accent"]};font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:34px 32px 24px;">
                {logo}
                <h1 style="margin:0 0 16px;color:{c["heading"]};font-size:28px;line-height:1.2;">{escape(title)}</h1>
                <p style="margin:0 0 12px;color:{c["heading"]};">{escape(greeting)}</p>
                {paragraphs}
                {sections_html}
                {cta_html}
                {outro}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 28px;border-top:1px solid {c["border"]};background:{c["surface"]};">
                {footer}
                <p style="margin:6px 0 0;color:{c["muted"]};">&copy; {year} {escape(brand_name)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    lines = [title, '', greeting, *intro_lines, '']
    for section in sections:
        lines.append(section['title'])
        lines.extend(f'- {line}' for line in section['lines'])
        lines.append('')
    if cta:
        lines.extend([f'{cta[0]}: {cta[1]}', ''])
    lines.extend(outro_lines)
    lines.append('')
    if footer_note:
        lines.append(footer_note)
    if support_email:
        lines.append(f'Need help? Contact {support_email}.')
    lines.append(f'{brand_name} - {year}')
    return html, '\n'.join(lines) + '\n'


def verification_email(verification_url, first_name=None, expires_in_minutes=5, **brand):
    return render_email(
        title='Verify your email',
        greeting=greeting_for(first_name),
        intro_lines=[
            'Thanks for signing up with us.',
            f'Please verify your email within {minutes_label(expires_in_minutes)}.',
        ],
        cta=('Verify Email', verification_url),
        outro_lines=['If you did not create this account, you can safely ignore this message.'],
        preview_text='Verify your email address to activate your account.',
        footer_note=AUTOMATED_NOTE,
        **brand,
    )


def password_reset_email(reset_url, first_name=None, expires_in_minutes=5, **brand):
    return render_email(
        title='Reset your password',
        greeting=greeting_for(first_name),
        intro_lines=[
            'We received a request to reset your password.',
            f'Use the link below within {minutes_label(expires_in_minutes)}.',
        ],
        cta=('Reset Password', reset_url),
        outro_lines=['If you did not request a password reset, you can safely ignore this message.'],
        preview_text='Use this link to reset your account password.',
        footer_note=AUTOMATED_NOTE,
        **brand,
    )


def campaign_email(shop_url, first_name=None, campaign_name=None, campaign_type_label=None,
                   offer_label=None, start_date=None, end_date=None, **brand):
    details = [
        f'Campaign: {campaign_name}' if campaign_name else None,
        f'Type: {campaign_type_label}' if campaign_type_label else None,
        f'Offer: {offer_label}' if offer_label else None,
        f'Valid: {start_date} to {end_date}' if start_date and end_date else None,
    ]
    brand_name = brand['brand_name']
    return render_email(
        title=campaign_name or 'A new campaign is live',
        greeting=greeting_for(first_name),
        intro_lines=[
            f'We just launched a new promotion at {brand_name}.',
            f'Shop now to enjoy {offer_label.lower()}.' if offer_label
            else 'Take a look at the latest featured offer in store.',
        ],
        sections=[{'title': 'Offer details', 'lines': [d for d in details if d]}],
        cta=('Shop Now', shop_url),
        outro_lines=['Offer availability may vary by product and stock level.'],
        preview_text=f'{campaign_name} is now live.' if campaign_name else f'A new {brand_name} campaign is now live.',
        footer_note=f'This is a promotional email from {brand_name}.',
        **brand,
    )
