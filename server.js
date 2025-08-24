// server.js (simpel en robuust)
import express from "express";
import bodyParser from "body-parser";
import Imap from "imap";

const app = express();
app.use(bodyParser.json());

// Healthcheck (Render kan hiermee zien dat je service draait)
app.get("/", (_req, res) => res.send("IMAP Appender OK"));

app.post("/append-draft", async (req, res) => {
  const { imapUser, imapPassword, imapHost, imapPort, mime, mailbox } = req.body;
  if (!imapUser || !imapPassword || !imapHost || !imapPort || !mime) {
    return res.status(400).send({ error: "Missing required fields" });
  }

  const imap = new Imap({
    user: imapUser,
    password: imapPassword,
    host: imapHost,
    port: Number(imapPort),
    tls: true,
  });

  // Kandidaten: meegegeven mailbox + veelvoorkomende varianten
  const candidates = [
    mailbox,                 // bijv. "Concepten" als je die meestuurt
    "INBOX/Concepten",
    "INBOX.Concepten",
    "Concepten",
    "INBOX/Drafts",
    "INBOX.Drafts",
    "Drafts",
  ].filter(Boolean);

  function tryAppend(idx) {
    if (idx >= candidates.length) {
      return res.status(500).send({ error: "No suitable mailbox found" });
    }
    const box = candidates[idx];

    imap.append(mime, { mailbox: box, flags: ["\\Draft"] }, (err) => {
      if (err) {
        // probeer volgende kandidaat
        return tryAppend(idx + 1);
      }
      res.send({ success: true, mailboxUsed: box });
      imap.end();
    });
  }

  imap.once("ready", () => {
    tryAppend(0);
  });

  imap.once("error", (err) => {
    res.status(500).send({ error: err.message });
  });

  imap.connect();
});

// BELANGRIJK: Render verwacht dat je luistert op process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("IMAP appender running on port " + PORT));
