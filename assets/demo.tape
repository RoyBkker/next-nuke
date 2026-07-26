# Regenerate the README demo:
#   bash assets/demo-fixture.sh && vhs assets/demo.tape
#
# Run from the repo root, after `pnpm build` — the fixture shims `npx next-nuke`
# to dist/index.js so the recording exercises this working tree.

Output assets/demo.gif

Set Shell bash
Set FontSize 14
# 1360px keeps the .turbo warning on one line instead of splitting it mid-word.
Set Width 1360
Set Height 660
Set Padding 22
Set Margin 16
Set MarginFill "#1e1e2e"
Set BorderRadius 10
Set WindowBar Colorful
Set Theme "Catppuccin Mocha"
Set TypingSpeed 55ms

Hide
Type "export PATH=/private/tmp/demo-bin:$PATH && cd /private/tmp/acme && export PS1='$ ' && clear"
Enter
Sleep 1s
Show

Sleep 800ms
Type "npx next-nuke"
Sleep 400ms
Enter

# Scan + the app checklist (all pre-selected, sized).
Sleep 3s

# Deselect docs to show the picker is real. The list is alphabetical
# (admin, docs, web) and starts on admin, so one Down lands on docs.
Down
Sleep 600ms
Space
Sleep 1500ms
Enter

# Plan block + the .turbo stale-cache warning.
Sleep 4s

# Confirm (defaults to yes).
Enter
Sleep 3500ms
