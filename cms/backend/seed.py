"""
Seed script – creates admin user, default categories, tags, and sample posts.
Run: python seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
import app.models  # noqa – register all models

from app.models.user import User
from app.models.post import Post, PostStatus
from app.models.category import Category
from app.models.tag import Tag
from app.models.settings import SiteSetting
from app.core.security import hash_password
from app.config import settings
from datetime import datetime, timezone

Base.metadata.create_all(bind=engine)
db = SessionLocal()


def seed():
    # ── Admin user ────────────────────────────────────────────────────────────
    if not db.query(User).filter(User.email == settings.ADMIN_EMAIL).first():
        admin = User(
            email=settings.ADMIN_EMAIL,
            username=settings.ADMIN_USERNAME,
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            full_name=settings.ADMIN_FULL_NAME,
            bio="QA Engineer & Blog Author",
            is_active=True,
            is_superuser=True,
        )
        db.add(admin)
        db.flush()
        print(f"✅  Admin created: {settings.ADMIN_EMAIL} / {settings.ADMIN_PASSWORD}")
    else:
        admin = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        print(f"ℹ️   Admin already exists: {settings.ADMIN_EMAIL}")

    # ── Categories ────────────────────────────────────────────────────────────
    categories_data = [
        {"name": "QA Automation", "slug": "qa-automation", "color": "#6366f1", "icon": "Bot"},
        {"name": "Manual Testing", "slug": "manual-testing", "color": "#8b5cf6", "icon": "ClipboardCheck"},
        {"name": "API Testing", "slug": "api-testing", "color": "#06b6d4", "icon": "Globe"},
        {"name": "CI/CD & DevOps", "slug": "ci-cd-devops", "color": "#10b981", "icon": "GitBranch"},
        {"name": "Framework Setup", "slug": "framework-setup", "color": "#f59e0b", "icon": "Settings"},
        {"name": "Code Tutorials", "slug": "code-tutorials", "color": "#ef4444", "icon": "Code"},
        {"name": "Documentation", "slug": "documentation", "color": "#64748b", "icon": "FileText"},
        {"name": "Performance Testing", "slug": "performance-testing", "color": "#ec4899", "icon": "Zap"},
    ]
    cats = {}
    for c in categories_data:
        existing = db.query(Category).filter(Category.slug == c["slug"]).first()
        if not existing:
            cat = Category(**c)
            db.add(cat)
            db.flush()
            cats[c["slug"]] = cat
        else:
            cats[c["slug"]] = existing
    print(f"✅  {len(categories_data)} categories seeded")

    # ── Tags ──────────────────────────────────────────────────────────────────
    tags_data = [
        {"name": "Selenium", "slug": "selenium", "color": "#6366f1"},
        {"name": "Playwright", "slug": "playwright", "color": "#06b6d4"},
        {"name": "Cypress", "slug": "cypress", "color": "#10b981"},
        {"name": "Pytest", "slug": "pytest", "color": "#f59e0b"},
        {"name": "Python", "slug": "python", "color": "#3b82f6"},
        {"name": "TypeScript", "slug": "typescript", "color": "#06b6d4"},
        {"name": "REST API", "slug": "rest-api", "color": "#8b5cf6"},
        {"name": "Postman", "slug": "postman", "color": "#ef4444"},
        {"name": "GitHub Actions", "slug": "github-actions", "color": "#64748b"},
        {"name": "Docker", "slug": "docker", "color": "#0ea5e9"},
        {"name": "Jenkins", "slug": "jenkins", "color": "#d97706"},
        {"name": "Allure", "slug": "allure", "color": "#ec4899"},
        {"name": "Beginner", "slug": "beginner", "color": "#10b981"},
        {"name": "Advanced", "slug": "advanced", "color": "#ef4444"},
    ]
    tag_objs = {}
    for t in tags_data:
        existing = db.query(Tag).filter(Tag.slug == t["slug"]).first()
        if not existing:
            tag = Tag(**t)
            db.add(tag)
            db.flush()
            tag_objs[t["slug"]] = tag
        else:
            tag_objs[t["slug"]] = existing
    print(f"✅  {len(tags_data)} tags seeded")

    # ── Default settings ──────────────────────────────────────────────────────
    default_settings = [
        {"key": "site_name", "value": "QA Portfolio Blog", "category": "general", "label": "Site Name"},
        {"key": "site_description", "value": "Insights on QA Automation, Testing, and DevOps", "category": "general", "label": "Site Description"},
        {"key": "site_url", "value": "https://yourdomain.com", "category": "general", "label": "Site URL"},
        {"key": "author_name", "value": "Dipak Bist", "category": "general", "label": "Author Name"},
        {"key": "twitter_handle", "value": "@dipakbist08", "category": "social", "label": "Twitter"},
        {"key": "github_url", "value": "https://github.com/DipakBist08", "category": "social", "label": "GitHub"},
        {"key": "linkedin_url", "value": "https://linkedin.com/in/dipakbist08", "category": "social", "label": "LinkedIn"},
        {"key": "posts_per_page", "value": "10", "category": "blog", "label": "Posts Per Page"},
        {"key": "allow_comments", "value": "false", "category": "blog", "label": "Allow Comments"},
    ]
    for s in default_settings:
        if not db.query(SiteSetting).filter(SiteSetting.key == s["key"]).first():
            db.add(SiteSetting(**s))
    print(f"✅  {len(default_settings)} settings seeded")

    # ── Sample posts ──────────────────────────────────────────────────────────
    if db.query(Post).count() == 0:
        sample_content = """<h2>Introduction</h2>
<p>Welcome to this comprehensive guide on setting up a <strong>Playwright test automation framework</strong> from scratch using TypeScript.</p>
<h2>Prerequisites</h2>
<ul>
  <li>Node.js 18+</li>
  <li>npm or yarn</li>
  <li>Basic TypeScript knowledge</li>
</ul>
<h2>Installation</h2>
<pre><code class="language-bash">npm init playwright@latest
npx playwright install</code></pre>
<h2>Project Structure</h2>
<pre><code class="language-text">playwright-framework/
├── tests/
│   ├── e2e/
│   └── api/
├── fixtures/
├── pages/          # Page Object Model
├── utils/
└── playwright.config.ts</code></pre>
<h2>Writing Your First Test</h2>
<pre><code class="language-typescript">import { test, expect } from '@playwright/test';

test('homepage has correct title', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example Domain/);
});
</code></pre>
<blockquote><p>💡 Use Page Object Model to keep your tests clean and maintainable.</p></blockquote>
<h2>Running Tests</h2>
<pre><code class="language-bash">npx playwright test
npx playwright test --ui   # Visual mode
npx playwright show-report # View HTML report</code></pre>"""

        post1 = Post(
            title="Getting Started with Playwright: A Complete Guide",
            slug="getting-started-playwright-complete-guide",
            content=sample_content,
            content_text="Getting started with playwright automation testing framework typescript",
            excerpt="A step-by-step guide to setting up Playwright test automation framework with TypeScript, Page Object Model, and best practices.",
            status=PostStatus.PUBLISHED,
            is_featured=True,
            reading_time=8,
            seo_title="Playwright Testing Framework Setup Guide | QA Portfolio",
            seo_description="Complete guide to setting up Playwright automation framework with TypeScript. Includes POM, fixtures, and CI/CD integration.",
            seo_keywords="playwright, typescript, automation testing, e2e testing, QA",
            author_id=admin.id,
            category_id=cats["qa-automation"].id,
            published_at=datetime.now(timezone.utc),
        )
        post1.tags = [tag_objs["playwright"], tag_objs["typescript"], tag_objs["beginner"]]
        db.add(post1)

        post2 = Post(
            title="REST API Testing with Pytest and Requests Library",
            slug="rest-api-testing-pytest-requests",
            content="<h2>Overview</h2><p>This guide covers how to write robust <strong>API tests</strong> using Python's <code>requests</code> library with <code>pytest</code>.</p><pre><code class=\"language-python\">import pytest\nimport requests\n\nBASE_URL = 'https://api.example.com'\n\ndef test_get_users():\n    response = requests.get(f'{BASE_URL}/users')\n    assert response.status_code == 200\n    assert isinstance(response.json(), list)\n</code></pre>",
            content_text="REST API testing pytest requests python automation",
            excerpt="Learn how to write comprehensive REST API tests using Python pytest and requests library with assertions, fixtures, and reporting.",
            status=PostStatus.PUBLISHED,
            is_featured=False,
            reading_time=6,
            seo_title="REST API Testing with Pytest | QA Portfolio",
            seo_description="Complete guide to REST API testing with Python pytest and requests library.",
            seo_keywords="api testing, pytest, python, rest api, automation",
            author_id=admin.id,
            category_id=cats["api-testing"].id,
            published_at=datetime.now(timezone.utc),
        )
        post2.tags = [tag_objs["pytest"], tag_objs["python"], tag_objs["rest-api"]]
        db.add(post2)

        post3 = Post(
            title="Setting Up GitHub Actions for Selenium Tests",
            slug="github-actions-selenium-ci-cd",
            content="<h2>CI/CD for Test Automation</h2><p>Automate your <strong>Selenium tests</strong> on every pull request using GitHub Actions.</p>",
            content_text="GitHub Actions Selenium CI CD automation pipeline",
            excerpt="Learn how to configure GitHub Actions workflows to run your Selenium automation suite on every commit and pull request.",
            status=PostStatus.DRAFT,
            reading_time=5,
            seo_title="GitHub Actions for Selenium Tests | CI/CD Pipeline",
            seo_description="Setup GitHub Actions CI/CD pipeline for running Selenium automation tests automatically.",
            seo_keywords="github actions, selenium, ci/cd, automation",
            author_id=admin.id,
            category_id=cats["ci-cd-devops"].id,
        )
        post3.tags = [tag_objs["selenium"], tag_objs["github-actions"]]
        db.add(post3)
        print("✅  3 sample posts seeded")

    db.commit()
    print("\n🎉  Seed complete! You can now start the server with:")
    print("    uvicorn app.main:app --reload")


if __name__ == "__main__":
    try:
        seed()
    finally:
        db.close()
