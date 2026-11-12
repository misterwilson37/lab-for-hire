# Putting the Sheet and the game in touch (about 10 minutes, once)

After this, anything you or Hanson change in the Sheet reaches students within about a minute. Nothing to re-upload.
The script **only reads** the Sheet. It never changes it, and the feed it serves contains no student data (there's none in the Sheet).

## 1. Put the script in the Sheet
1. Open the content Sheet. Choose **Extensions → Apps Script**.
2. In the editor, select everything in `Code.gs`, delete it, and paste in **all of `LabForHire.gs`** (from this folder). Click the disk icon to save. You can name the project "Lab for Hire".
3. Optional: **Project Settings** (gear icon) → tick *Show "appsscript.json" manifest file*, open it, and paste in `appsscript.json`. (The deploy dialog below sets the same things, so skip this if it feels fiddly.)

## 2. Turn it on
1. Click **Deploy → New deployment**. Click the gear next to "Select type" and choose **Web app**.
2. **Execute as:** Me. **Who has access:** Anyone. Click **Deploy**.
3. Google asks you to authorize. It will warn the app is "unverified" (it's your own script): **Advanced → Go to Lab for Hire (unsafe) → Allow**.
4. Copy the **Web app URL**. It ends in `/exec`.
5. Test it: paste the URL into a browser tab. You should see text starting `{"schema":"0.5.0"`. (Add `?include=draft` to also see drafts.)

## 3. Tell the game where the Sheet is
Send the URL to whoever is working on the code (or to Claude). They run `python3 build.py --feed-url <your URL>` and push; GitHub Pages picks it up. This happens once.

## 4. Check your content any time
Reload the Sheet. A **Lab for Hire** menu appears:
- **Check my content** tells you what students will see, which jobs are held back and why, and anything worth fixing.
- **Send my edits to students now** skips the one-minute wait.
- **Show the game's feed address** reminds you of the URL.

Open the game with `?preview=1` on the end of its address to see drafts and a plain-English note about where its content came from.

## If something looks wrong
- **The game shows old content.** Open it with `?preview=1`. The banner says whether it used the live Sheet and, if not, why. Common reason: the Sheet's layout is older than the game expects (the check says so).
- **"Sorry, unable to open the file" in the browser test.** "Who has access" isn't set to *Anyone*, or you're signed in to several Google accounts. Try a private window.
- **The district blocks `script.google.com`.** Students keep playing with the content built into the game; they just won't get Sheet edits. Tell Jake so the fallback copy can be refreshed.
- **You changed the script later.** Use **Deploy → Manage deployments → pencil → Version: New version**. The URL stays the same.
