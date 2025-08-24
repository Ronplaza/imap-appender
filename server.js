// server.js
import express from "express";
import bodyParser from "body-parser";
import Imap from "imap";
import { simpleParser } from "mailparser";

const app = express();
app.use(bodyParser.json());

app.post("/append-draft", async (req, res) => {
  const { imapUser, imapPassword, imapHost, imapPort, mime } = req.body;

  const imap = new Imap({
    user: imapUser,
    password: imapPassword,
    host: imapHost,
    port: imapPort,
    tls: true,
  });

  imap.once("ready", () => {
    imap.append(mime, { mailbox: "Drafts", flags: ["\\Draft"] }, (err) => {
      if (err) {
        res.status(500).send({ error: err.message });
      } else {
        res.send({ success: true });
      }
      imap.end();
    });
  });

  imap.once("error", (err) => {
    res.status(500).send({ error: err.message });
  });

  imap.connect();
});

app.listen(3000, () => console.log("IMAP appender running on port 3000"));
