import test from 'node:test';
import assert from 'node:assert/strict';
import { detectUrl } from '../functions/_lib/detect';
import {
  detectMediaUrl,
  getDetectedUrlInfo,
  detectLinkedInUrl,
  normalizeLinkedInSlug,
  LINKEDIN_PROFILE_URL_REGEX,
} from '../src/utils/urlDetector';
import { isAllowedMediaHost, isAllowedMediaUrl } from '../functions/_lib/allowlist';
import { parseLinkedInProfileHtml, extractLinkedIn } from '../functions/_lib/linkedin';

test('detectUrl and detectMediaUrl accept linkedin.com/in/{slug} and country subdomains', () => {
  const validCases = [
    { url: 'https://www.linkedin.com/in/satyanadella', expectedSlug: 'satyanadella' },
    { url: 'https://linkedin.com/in/Satya-Nadella_123/', expectedSlug: 'satya-nadella_123' },
    { url: 'https://fr.linkedin.com/in/jean-dupont?trk=public_profile', expectedSlug: 'jean-dupont' },
    { url: 'https://uk.linkedin.com/in/john-doe-99/', expectedSlug: 'john-doe-99' },
  ];

  for (const { url, expectedSlug } of validCases) {
    assert.equal(LINKEDIN_PROFILE_URL_REGEX.test(url), true, `Regex should match ${url}`);
    const backend = detectUrl(url);
    assert.equal(backend.isValid, true, `Backend should accept ${url}`);
    assert.equal(backend.platform, 'linkedin');
    assert.equal(backend.identifier, expectedSlug);

    const direct = detectLinkedInUrl(url);
    assert.equal(direct?.isValid, true, `detectLinkedInUrl should accept ${url}`);
    assert.equal(direct?.identifier, expectedSlug);
    assert.equal(normalizeLinkedInSlug(expectedSlug), expectedSlug);

    const frontend = detectMediaUrl(url);
    assert.equal(frontend.isValid, true, `Frontend should accept ${url}`);
    assert.equal(frontend.platform, 'linkedin');
    assert.equal(frontend.identifier, expectedSlug);

    const info = getDetectedUrlInfo(url);
    assert.equal(info.isValid, true, `getDetectedUrlInfo should accept ${url}`);
    assert.equal(info.platform, 'linkedin');
    assert.equal(info.identifier, expectedSlug);
  }
});

test('detectUrl and detectMediaUrl reject unsupported LinkedIn URLs', () => {
  const invalidUrls = [
    'https://www.linkedin.com/company/microsoft',
    'https://www.linkedin.com/posts/satyanadella_ai-cloud-activity-123456789-abcd',
    'https://www.linkedin.com/feed/update/urn:li:activity:123456789/',
    'https://www.linkedin.com/in/satyanadella/recent-activity/all/',
    'https://www.linkedin.com/jobs/view/123456',
    'https://www.linkedin.com/pulse/some-article',
    'https://www.linkedin.com/',
  ];

  for (const url of invalidUrls) {
    const backend = detectUrl(url);
    assert.equal(backend.isValid, false, `Backend should reject ${url}`);

    const frontend = detectMediaUrl(url);
    assert.equal(frontend.isValid, false, `Frontend should reject ${url}`);
  }
});

test('allowlist accepts media.licdn.com and rejects bare linkedin.com or static.licdn.com', () => {
  assert.equal(isAllowedMediaHost('media.licdn.com'), true);
  assert.equal(isAllowedMediaHost('dms.media.licdn.com'), true);
  assert.equal(
    isAllowedMediaUrl('https://media.licdn.com/dms/image/v2/D5603AQE/profile-displayphoto-shrink_800_800/0/1700000000000?e=1750000000&v=beta&t=abc123XYZ'),
    true
  );

  assert.equal(isAllowedMediaHost('linkedin.com'), false);
  assert.equal(isAllowedMediaHost('www.linkedin.com'), false);
  assert.equal(isAllowedMediaHost('licdn.com'), false);
  assert.equal(isAllowedMediaHost('static.licdn.com'), false);
});

test('parseLinkedInProfileHtml extracts signed og:image as-is and sets title=@slug only', () => {
  const signedUrl = 'https://media.licdn.com/dms/image/v2/D5603AQE/profile-displayphoto-shrink_800_800/0/1700000000000?e=1750000000&amp;v=beta&amp;t=sig_123';
  const expectedUrl = 'https://media.licdn.com/dms/image/v2/D5603AQE/profile-displayphoto-shrink_800_800/0/1700000000000?e=1750000000&v=beta&t=sig_123';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Jane Doe - CEO at Example | LinkedIn</title>
        <meta property="og:title" content="Jane Doe - CEO at Example | LinkedIn" />
        <meta property="og:image" content="${signedUrl}" />
      </head>
      <body>Profile content</body>
    </html>
  `;

  const parsed = parseLinkedInProfileHtml(html, 'jane-doe');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.type, 'image');
  assert.equal(parsed.title, '@jane-doe');
  assert.equal(parsed.author?.full_name, undefined);
  assert.equal(parsed.items?.[0]?.url, expectedUrl);
});

test('parseLinkedInProfileHtml falls back to JSON-LD Person image', () => {
  const signedUrl = 'https://media.licdn.com/dms/image/v2/C4D03AQ/profile-displayphoto-shrink_800_800/0/1650000000000?e=1750000000&v=beta&t=jsonld_sig';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "http://schema.org",
            "@type": "ProfilePage",
            "mainEntity": {
              "@type": "Person",
              "name": "Should Not Be Extracted",
              "jobTitle": "Should Not Be Extracted",
              "image": {
                "@type": "ImageObject",
                "contentUrl": "${signedUrl}"
              }
            }
          }
        </script>
      </head>
      <body>Profile content</body>
    </html>
  `;

  const parsed = parseLinkedInProfileHtml(html, 'john-smith');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.type, 'image');
  assert.equal(parsed.title, '@john-smith');
  assert.equal(parsed.items?.[0]?.url, signedUrl);
});

test('parseLinkedInProfileHtml returns PRIVATE_OR_LOGIN_REQUIRED on ghost/default avatar', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="og:image" content="https://static.licdn.com/aero-v1/sc/h/244xhbkr7g40x6bsu4gi6q4ry" />
      </head>
      <body>Public profile without photo</body>
    </html>
  `;

  const parsed = parseLinkedInProfileHtml(html, 'no-photo-user');
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error?.code, 'PRIVATE_OR_LOGIN_REQUIRED');
});

test('parseLinkedInProfileHtml returns BLOCKED_BY_PLATFORM on authwall HTML', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Sign Up | LinkedIn</title></head>
      <body><a href="/uas/login">Sign in</a> authwall</body>
    </html>
  `;

  const parsed = parseLinkedInProfileHtml(html, 'some-user');
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error?.code, 'BLOCKED_BY_PLATFORM');
});

test('live extractLinkedIn on public profile handles LinkedIn response cleanly', async () => {
  const res = await extractLinkedIn('satyanadella');
  assert.ok(
    res.ok || ['BLOCKED_BY_PLATFORM', 'PRIVATE_OR_LOGIN_REQUIRED', 'NOT_FOUND', 'TIMEOUT'].includes(res.error?.code || ''),
    `Unexpected result: ${JSON.stringify(res)}`
  );
  if (res.ok) {
    assert.equal(res.platform, 'linkedin');
    assert.equal(res.type, 'image');
    assert.equal(res.title, '@satyanadella');
  }
});
