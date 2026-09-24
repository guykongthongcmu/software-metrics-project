function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function normalizeLines(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean).map((line) => String(line));
  }

  return [String(value)];
}

function formatCurrency(amount, currency) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return null;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
}

const BRAND_COLORS = {
  background: '#f5f1eb',
  surface: '#f9f6f1',
  card: '#ffffff',
  border: '#e3d7c8',
  heading: '#5b4f44',
  text: '#6f6357',
  muted: '#8c8074',
  accent: '#a3927f',
  accentDark: '#8b7a68',
  buttonText: '#ffffff',
};

function buildSectionsHtml(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return '';
  }

  return sections
    .map((section) => {
      const lines = normalizeLines(section.lines);
      if (lines.length === 0) {
        return '';
      }

      const titleHtml = section.title
        ? `<h2 style="margin:20px 0 8px;font-size:16px;color:${BRAND_COLORS.heading};">${escapeHtml(section.title)}</h2>`
        : '';
      const listItems = lines
        .map((line) => `<li style="margin:0 0 6px;">${escapeHtml(line)}</li>`)
        .join('');

      return `${titleHtml}<ul style="margin:0 0 16px 18px;padding:0;color:${BRAND_COLORS.text};line-height:1.6;">${listItems}</ul>`;
    })
    .join('');
}

function buildSectionsText(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return [];
  }

  const lines = [];
  sections.forEach((section) => {
    const sectionLines = normalizeLines(section.lines);
    if (sectionLines.length === 0) {
      return;
    }

    if (section.title) {
      lines.push(section.title);
    }

    sectionLines.forEach((line) => {
      lines.push(`- ${line}`);
    });
    lines.push('');
  });

  return lines;
}

function buildEmailTemplate({
  brandName = 'Core&Co',
  logoSrc,
  previewText,
  title,
  greeting,
  introLines,
  sections,
  cta,
  outroLines,
  supportEmail,
  footerNote,
}) {
  const safeBrandName = escapeHtml(brandName);
  const safeTitle = escapeHtml(title || 'Notification');
  const safeGreeting = greeting
    ? `<p style="margin:0 0 12px;color:${BRAND_COLORS.heading};">${escapeHtml(greeting)}</p>`
    : '';
  const introHtml = normalizeLines(introLines)
    .map((line) => `<p style="margin:0 0 12px;color:${BRAND_COLORS.text};line-height:1.6;">${escapeHtml(line)}</p>`)
    .join('');
  const sectionsHtml = buildSectionsHtml(sections);
  const outroHtml = normalizeLines(outroLines)
    .map((line) => `<p style="margin:0 0 10px;color:${BRAND_COLORS.text};line-height:1.6;">${escapeHtml(line)}</p>`)
    .join('');
  const logoHtml = logoSrc
    ? `<img src="${escapeAttribute(logoSrc)}" alt="${safeBrandName}" width="132" style="display:block;margin:0 auto 22px;border:0;outline:none;text-decoration:none;" />`
    : '';
  const ctaHtml = cta?.label && cta?.url
    ? `<p style="margin:20px 0 24px;">
        <a href="${escapeAttribute(cta.url)}" style="display:inline-block;background:${BRAND_COLORS.accent};color:${BRAND_COLORS.buttonText};text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;border:1px solid ${BRAND_COLORS.accentDark};">
          ${escapeHtml(cta.label)}
        </a>
      </p>`
    : '';
  const supportLine = supportEmail
    ? `<p style="margin:0;color:${BRAND_COLORS.muted};">Need help? Contact ${escapeHtml(supportEmail)}.</p>`
    : '';
  const safeFooterNote = footerNote
    ? `<p style="margin:0 0 6px;color:${BRAND_COLORS.muted};">${escapeHtml(footerNote)}</p>`
    : '';
  const preheader = previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(previewText)}</div>`
    : '';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND_COLORS.background};font-family:'Helvetica Neue',Arial,sans-serif;color:${BRAND_COLORS.text};">
    ${preheader}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:${BRAND_COLORS.card};border-radius:16px;overflow:hidden;border:1px solid ${BRAND_COLORS.border};">
            <tr>
              <td style="height:8px;background:${BRAND_COLORS.accent};font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:34px 32px 24px;">
                ${logoHtml}
                <h1 style="margin:0 0 16px;color:${BRAND_COLORS.heading};font-size:28px;line-height:1.2;">${safeTitle}</h1>
                ${safeGreeting}
                ${introHtml}
                ${sectionsHtml}
                ${ctaHtml}
                ${outroHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 28px;border-top:1px solid ${BRAND_COLORS.border};background:${BRAND_COLORS.surface};">
                ${safeFooterNote}
                ${supportLine}
                <p style="margin:6px 0 0;color:${BRAND_COLORS.muted};">&copy; ${new Date().getFullYear()} ${safeBrandName}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines = [
    title || 'Notification',
    '',
    ...normalizeLines(greeting),
    ...normalizeLines(introLines),
    '',
    ...buildSectionsText(sections),
    cta?.label && cta?.url ? `${cta.label}: ${cta.url}` : '',
    '',
    ...normalizeLines(outroLines),
    '',
    footerNote || '',
    supportEmail ? `Need help? Contact ${supportEmail}.` : '',
    `${brandName} - ${new Date().getFullYear()}`,
  ].filter(Boolean);

  return {
    html,
    text: textLines.join('\n'),
  };
}

function buildVerificationEmailTemplate({
  brandName,
  logoSrc,
  verificationUrl,
  firstName,
  expiresInMinutes = 5,
  supportEmail,
}) {
  const minuteLabel = expiresInMinutes === 1 ? 'minute' : 'minutes';

  return buildEmailTemplate({
    brandName,
    logoSrc,
    previewText: 'Verify your email address to activate your account.',
    title: 'Verify your email',
    greeting: firstName ? `Hi ${firstName},` : 'Hi there,',
    introLines: [
      'Thanks for signing up with us.',
      `Please verify your email within ${expiresInMinutes} ${minuteLabel}.`,
    ],
    cta: {
      label: 'Verify Email',
      url: verificationUrl,
    },
    outroLines: [
      'If you did not create this account, you can safely ignore this message.',
    ],
    supportEmail,
    footerNote: 'This is an automated email. Please do not reply directly.',
  });
}

function buildReceiptEmailTemplate({
  brandName,
  logoSrc,
  firstName,
  orderNumber,
  orderDate,
  items = [],
  subtotal,
  shippingFee,
  tax,
  total,
  currency = 'USD',
  receiptUrl,
  supportEmail,
}) {
  const itemLines = items.length > 0
    ? items.map((item) => {
      const quantity = Number(item.quantity) || 1;
      const lineTotalValue = typeof item.lineTotal === 'number'
        ? item.lineTotal
        : Number(item.unitPrice || 0) * quantity;
      const lineTotal = formatCurrency(lineTotalValue, currency) || `${lineTotalValue}`;

      return `${item.name} x${quantity} - ${lineTotal}`;
    })
    : ['Your order item list will appear here.'];

  const totals = [
    formatCurrency(subtotal, currency) ? `Subtotal: ${formatCurrency(subtotal, currency)}` : null,
    formatCurrency(shippingFee, currency) ? `Shipping: ${formatCurrency(shippingFee, currency)}` : null,
    formatCurrency(tax, currency) ? `Tax: ${formatCurrency(tax, currency)}` : null,
    formatCurrency(total, currency) ? `Total: ${formatCurrency(total, currency)}` : null,
  ].filter(Boolean);

  return buildEmailTemplate({
    brandName,
    logoSrc,
    previewText: `Receipt for order ${orderNumber || ''}`.trim(),
    title: 'Your order receipt',
    greeting: firstName ? `Hi ${firstName},` : 'Hi there,',
    introLines: ['Thank you for your purchase. Your receipt is ready.'],
    sections: [
      {
        title: 'Order information',
        lines: [
          orderNumber ? `Order number: ${orderNumber}` : null,
          orderDate ? `Order date: ${orderDate}` : null,
        ].filter(Boolean),
      },
      {
        title: 'Items',
        lines: itemLines,
      },
      {
        title: 'Totals',
        lines: totals,
      },
    ],
    cta: receiptUrl
      ? {
        label: 'View Receipt',
        url: receiptUrl,
      }
      : null,
    outroLines: ['Keep this email for your records.'],
    supportEmail,
    footerNote: 'This is an automated email. Please do not reply directly.',
  });
}

function buildOrderUpdateEmailTemplate({
  brandName,
  logoSrc,
  firstName,
  orderNumber,
  orderStatus,
  trackingNumber,
  estimatedDeliveryDate,
  detailsUrl,
  supportEmail,
}) {
  return buildEmailTemplate({
    brandName,
    logoSrc,
    previewText: `Order ${orderNumber || ''} status updated to ${orderStatus || 'updated'}`.trim(),
    title: 'Order status update',
    greeting: firstName ? `Hi ${firstName},` : 'Hi there,',
    introLines: ['Your order status has been updated.'],
    sections: [
      {
        title: 'Order details',
        lines: [
          orderNumber ? `Order number: ${orderNumber}` : null,
          orderStatus ? `Current status: ${orderStatus}` : null,
          trackingNumber ? `Tracking number: ${trackingNumber}` : null,
          estimatedDeliveryDate ? `Estimated delivery: ${estimatedDeliveryDate}` : null,
        ].filter(Boolean),
      },
    ],
    cta: detailsUrl
      ? {
        label: 'View Order',
        url: detailsUrl,
      }
      : null,
    outroLines: ['We will notify you again if there is another update.'],
    supportEmail,
    footerNote: 'This is an automated email. Please do not reply directly.',
  });
}

function buildVerificationResultPageTemplate({
  brandName = 'Core&Co',
  logoSrc = '',
  title = 'Email verified',
  subtitle = 'Thank you for verifying your email.',
  messageLines,
  cta,
}) {
  const safeBrandName = escapeHtml(brandName);
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);
  const detailsHtml = normalizeLines(messageLines)
    .map((line) => `<p style="margin:0 0 10px;color:${BRAND_COLORS.text};line-height:1.65;">${escapeHtml(line)}</p>`)
    .join('');
  const logoHtml = logoSrc
    ? `<img src="${escapeAttribute(logoSrc)}" alt="${safeBrandName}" width="132" style="display:block;margin:0 auto 22px;border:0;outline:none;text-decoration:none;" />`
    : '';
  const ctaHtml = cta?.label && cta?.url
    ? `<a href="${escapeAttribute(cta.url)}" style="display:inline-block;margin-top:14px;background:${BRAND_COLORS.accent};color:${BRAND_COLORS.buttonText};text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;border:1px solid ${BRAND_COLORS.accentDark};">${escapeHtml(cta.label)}</a>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle} | ${safeBrandName}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND_COLORS.background};font-family:'Helvetica Neue',Arial,sans-serif;color:${BRAND_COLORS.text};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:${BRAND_COLORS.card};border-radius:16px;overflow:hidden;border:1px solid ${BRAND_COLORS.border};">
            <tr>
              <td style="height:8px;background:${BRAND_COLORS.accent};font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:36px 32px 28px;text-align:center;">
                ${logoHtml}
                <h1 style="margin:0 0 10px;color:${BRAND_COLORS.heading};font-size:30px;line-height:1.2;">${safeTitle}</h1>
                <p style="margin:0 0 20px;color:${BRAND_COLORS.text};font-size:17px;line-height:1.5;">${safeSubtitle}</p>
                <div style="max-width:500px;margin:0 auto;text-align:center;">
                  ${detailsHtml}
                </div>
                ${ctaHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 24px;border-top:1px solid ${BRAND_COLORS.border};background:${BRAND_COLORS.surface};text-align:center;">
                <p style="margin:0;color:${BRAND_COLORS.muted};">&copy; ${new Date().getFullYear()} ${safeBrandName}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildForgotPasswordEmailTemplate ({
  brandName = 'Core&Co',
  logoSrc = '',
  resetUrl,
  firstName,
  expiresInMinutes = 5,
  supportEmail,
}) {
  const minuteLabel = expiresInMinutes === 1 ? 'minute' : 'minutes';

  return buildEmailTemplate({
    brandName,
    logoSrc,
    previewText: 'Use this link to reset your account password.',
    title: 'Reset your password',
    greeting: firstName ? `Hi ${firstName},` : 'Hi there,',
    introLines: [
      'We received a request to reset your password.',
      `Use the link below within ${expiresInMinutes} ${minuteLabel}.`,
    ],
    cta: {
      label: 'Reset Password',
      url: resetUrl,
    },
    outroLines: [
      'If you did not request a password reset, you can safely ignore this message.',
    ],
    supportEmail,
    footerNote: 'This is an automated email. Please do not reply directly.',
  });
}

function buildCampaignBlastEmailTemplate({
  brandName = 'Core&Co',
  logoSrc = '',
  firstName,
  campaignName,
  campaignTypeLabel,
  offerLabel,
  startDate,
  endDate,
  shopUrl,
  supportEmail,
}) {
  const offerLines = [
    campaignName ? `Campaign: ${campaignName}` : null,
    campaignTypeLabel ? `Type: ${campaignTypeLabel}` : null,
    offerLabel ? `Offer: ${offerLabel}` : null,
    startDate && endDate ? `Valid: ${startDate} to ${endDate}` : null,
  ].filter(Boolean);

  return buildEmailTemplate({
    brandName,
    logoSrc,
    previewText: campaignName
      ? `${campaignName} is now live.`
      : 'A new Core&Co campaign is now live.',
    title: campaignName || 'A new campaign is live',
    greeting: firstName ? `Hi ${firstName},` : 'Hi there,',
    introLines: [
      'We just launched a new promotion at Core&Co.',
      offerLabel
        ? `Shop now to enjoy ${offerLabel.toLowerCase()}.`
        : 'Take a look at the latest featured offer in store.',
    ],
    sections: [
      {
        title: 'Offer details',
        lines: offerLines,
      },
    ],
    cta: shopUrl
      ? {
          label: 'Shop Now',
          url: shopUrl,
        }
      : null,
    outroLines: [
      'Offer availability may vary by product and stock level.',
    ],
    supportEmail,
    footerNote: 'This is a promotional email from Core&Co.',
  });
}

module.exports = {
  buildEmailTemplate,
  buildVerificationEmailTemplate,
  buildReceiptEmailTemplate,
  buildOrderUpdateEmailTemplate,
  buildForgotPasswordEmailTemplate,
  buildCampaignBlastEmailTemplate,
  buildVerificationResultPageTemplate,
};
