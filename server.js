// server.js
import express from "express";
import bodyParser from "body-parser";
import Imap from "imap";
import { simpleParser } from "mailparser";

const app = express();
app.use(bodyParser.json());

app.post("/append-draft", async (req, res) => {
  const { imapUser, imapPassword, imapHost, imapPort, mime, mailbox } = req.body;

  const imap = new Imap({
    user: imapUser,
    password: imapPassword,
    host: imapHost,
    port: imapPort,
    tls: true,
  });

  // Kandidatenlijst: eerst de meegegeven mailbox, daarna veelvoorkomende varianten
  const candidates = [
    mailbox,                 // bv. "Concepten" als jij die meestuurt
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
        // Probeer de volgende variant
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
});

app.listen(3000, () => console.log("IMAP appender running on port 3000"));
