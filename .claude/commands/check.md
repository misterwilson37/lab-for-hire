---
description: Run every check and explain any failure in plain words
---
Run `bash dev/check.sh`. If everything passes, say so in one line.

If something fails: show the first failure, explain the likely cause in plain words, and propose the smallest fix. Do not edit a test to make it pass unless the test itself is wrong, and then explain why and ask first. Remember generated files (index.html, apps-script/LabForHire.gs, src/content.json, src/art.json) are never hand-edited: fix the source in src/ and run `python3 build.py`.
