// server.js — IMAP draft appender + mailbox-lister (Render-ready)
import express from "express";
import bodyParser from "body-parser";
import Imap from "imap";

const app = express();
app.use(bodyParser.json());

// Healthcheck (handig om te zien dat de service draait)
app.get("/", (_req, res) => res.send("IMAP Appender OK"));

/**
 * POST /append-draft
 * Body JSON:
 * {
 *   imapUser: "user@example.com",
 *   imapPassword: "secret",
 *   imapHost: "imap.hostnet.nl",
 *   imapPort: 993,
 *   mime: "<volledige MIME string>",
 *   mailbox: "Concepten"   // optioneel; service probeert meerdere varianten
 * }
 */
app.post("/append-draft", async (req, res) => {
  const { imapUser, imapPassword, imapHost, imapPort, mime, mailbox } = req.body;

  if (!imapUser || !imapPassword || !imapHost || !imapPort || !mime) {
    return res
      .status(400)
      .send({ error: "Missing required fields: imapUser, imapPassword, imapHost, imapPort, mime" });
  }

  const imap = new Imap({
    user: imapUser,
    password: imapPassword,
    host: imapHost,
    port: Number(imapPort),
    tls: true,
  });

  // Probeer meerdere veelvoorkomende map-namen; eerst wat de client meestuurt
  const candidates = [
    mailbox,                 // bv. "Concepten" als je die meestuurt
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
        // Probeer de volgende kandidaat
        return tryAppend(idx + 1);
      }
      // Gelukt
      res.send({ success: true, mailboxUsed: box });
      imap.end();
    });
  }

  imap.once("ready", () => {
    tryAppend(0);
  });

  imap.once("error", (err) => {
    // Verbinding/ authenticatie fout
    try {
      res.status(500).send({ error: err.message });
    } catch (_) {}
  });

  imap.connect();
});

/**
 * GET /boxes
 * Query params:
 *   ?imapUser=...&imapPassword=...&imapHost=imap.hostnet.nl&imapPort=993
 * Response: { boxes: ["INBOX", "INBOX.Concepten", "Drafts", ...] }
 */
app.get("/boxes", async (req, res) => {
  const { imapUser, imapPassword, imapHost, imapPort } = req.query;
  if (!imapUser || !imapPassword || !imapHost || !imapPort) {
    return res
      .status(400)
      .send({ error: "Missing required query params: imapUser, imapPassword, imapHost, imapPort" });
  }

  const imap = new Imap({
    user: imapUser,
    password: imapPassword,
    host: imapHost,
    port: Number(imapPort),
    tls: true,
  });

  function flatten(tree, prefix = "", out = []) {
    Object.entries(tree || {}).forEach(([name, meta]) => {
      const delimiter = meta.delimiter || "/";
      const full = prefix ? `${prefix}${delimiter}${name}` : name;
      out.push(full);
      if (meta.children) flatten(meta.children, full, out);
    });
    return out;
  }

  imap.once("ready", () => {
    imap.getBoxes((err, boxes) => {
      if (err) {
        res.status(500).send({ error: err.message });
        return imap.end();
      }
      const list = flatten(boxes);
      res.send({ boxes: list });
      imap.end();
    });
  });

  imap.once("error", (err) => {
    try {
      res.status(500).send({ error: err.message });
    } catch (_) {}
  });

  imap.connect();
});

// Render verwacht dat je luistert op process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("IMAP appender running on port " + PORT));
