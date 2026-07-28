"""
Reset a CMS admin password directly against the database.

Needed because there is no self-service recovery in this CMS: /api/v1/auth has
login, refresh, logout, MFA and change-password, but change-password requires an
active session — and seed.py deliberately skips a user that already exists, so
re-seeding will not overwrite a forgotten password.

The new password is read from a hidden prompt (or the ADMIN_NEW_PASSWORD env var
for non-interactive use) so it never lands in shell history or in this file.

Which database it touches is decided entirely by DATABASE_URL:

  local SQLite (cms/backend/cms.db)
      cd cms/backend && .venv/bin/python reset_admin_password.py

  production — preferably from the host's own shell so the URL is never pasted
      python reset_admin_password.py --email you@example.com

  list the accounts instead of changing anything
      python reset_admin_password.py --list

Add --clear-mfa if an authenticator app is also lost, otherwise login will still
stop at the MFA step after the password is accepted.
"""
import argparse
import getpass
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import settings                      # noqa: E402
from app.database import SessionLocal                # noqa: E402
import app.models                                    # noqa: E402,F401  (register models)
from app.models.user import User, RefreshToken       # noqa: E402
from app.core.security import hash_password          # noqa: E402

MIN_LENGTH = 10


def describe_db() -> str:
    """DATABASE_URL with any password component masked."""
    url = settings.DATABASE_URL
    if "@" in url and "://" in url:
        scheme, rest = url.split("://", 1)
        creds, host = rest.split("@", 1)
        user = creds.split(":", 1)[0]
        return f"{scheme}://{user}:***@{host}"
    return url


def main() -> int:
    ap = argparse.ArgumentParser(description="Reset a CMS admin password.")
    ap.add_argument("--email", default=None,
                    help=f"account to reset (default: ADMIN_EMAIL, currently {settings.ADMIN_EMAIL})")
    ap.add_argument("--list", action="store_true", help="list accounts and exit, changing nothing")
    ap.add_argument("--clear-mfa", action="store_true",
                    help="also disable MFA, for when the authenticator app is lost too")
    ap.add_argument("--keep-sessions", action="store_true",
                    help="do not revoke existing refresh tokens (not recommended)")
    args = ap.parse_args()

    print(f"database: {describe_db()}\n")
    db = SessionLocal()
    try:
        if args.list:
            users = db.query(User).order_by(User.id).all()
            if not users:
                print("No users exist. Run `python seed.py` to create the first admin.")
                return 0
            print(f"{'id':>3}  {'email':38} {'username':16} super  active  mfa")
            for u in users:
                print(f"{u.id:>3}  {u.email:38} {(u.username or ''):16} "
                      f"{str(bool(u.is_superuser)):5}  {str(bool(u.is_active)):6}  "
                      f"{'on' if u.mfa_enabled else 'off'}")
            return 0

        email = args.email or settings.ADMIN_EMAIL
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"No account with email {email!r} in this database.")
            print("Run with --list to see which accounts exist.")
            return 1

        print(f"account : {user.email}  (id={user.id}, superuser={bool(user.is_superuser)}, "
              f"mfa={'on' if user.mfa_enabled else 'off'})")

        new = os.environ.get("ADMIN_NEW_PASSWORD")
        if new:
            print("password: taken from ADMIN_NEW_PASSWORD")
        else:
            new = getpass.getpass("new password (not echoed): ")
            if new != getpass.getpass("confirm: "):
                print("\nPasswords did not match. Nothing changed.")
                return 1

        if len(new) < MIN_LENGTH:
            print(f"\nToo short — use at least {MIN_LENGTH} characters. Nothing changed.")
            return 1

        user.hashed_password = hash_password(new)
        user.is_active = True          # a disabled account cannot log in even with the right password

        if args.clear_mfa and user.mfa_enabled:
            user.mfa_enabled = False
            user.mfa_secret = None
            print("mfa     : disabled")
        elif user.mfa_enabled:
            print("mfa     : still enabled — you will be asked for your authenticator code. "
                  "Re-run with --clear-mfa if you no longer have it.")

        revoked = 0
        if not args.keep_sessions:
            # Anyone holding an old refresh token could otherwise keep a session
            # alive after the reset.
            revoked = (db.query(RefreshToken)
                       .filter(RefreshToken.user_id == user.id, RefreshToken.is_revoked == False)  # noqa: E712
                       .update({RefreshToken.is_revoked: True}, synchronize_session=False))

        db.commit()
        print(f"\nPassword updated. {revoked} existing session(s) revoked.")
        print("Sign in at https://cms.dipakbist.com.np/login")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
