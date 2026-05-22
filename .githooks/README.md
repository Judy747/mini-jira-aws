# Git hooks for this repo

Custom hooks shared by the team. They live in the repo (not `.git/hooks/`) so
everyone gets the same behavior.

## What's here

- `prepare-commit-msg` — strips the `Co-authored-by: Cursor <cursoragent@cursor.com>`
  trailer that Cursor IDE auto-injects when the agent makes a commit. Without this
  hook, "Cursor" shows up as a contributor on GitHub.

## One-time setup (each teammate runs once)

After cloning (or now, if you already cloned):

```bash
git config core.hooksPath .githooks
```

That tells your local git to look in `.githooks/` instead of `.git/hooks/`.

### Windows note

The hook is a POSIX shell script. Git for Windows ships with `sh`/`awk`/`grep`,
so it just works. No `chmod` needed on Windows — git handles execute bits for
checked-in hooks.

### macOS / Linux note

You may need to mark it executable once:

```bash
chmod +x .githooks/prepare-commit-msg
```

## Verifying

After setup, make any commit. Then check:

```bash
git log -1 --format=%B
```

You should NOT see a line saying `Co-authored-by: Cursor <cursoragent@cursor.com>`.
