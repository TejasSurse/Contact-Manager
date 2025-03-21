require('dotenv').config();

const express = require("express");
const app = express();
const mysql = require("mysql2");
const path = require("path");
const session = require("express-session");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/Views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/public")));

// Set up session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false }
}).promise();

// Routes

app.get("/", (req, res) => {
  res.render("login");
});

app.get("/search", (req, res) => {
  const searchQuery = req.query.query;

  const query = "SELECT name, contact FROM contacts WHERE name LIKE ? OR contact LIKE ?";
  pool.query(query, [`%${searchQuery}%`, `%${searchQuery}%`])
    .then(([results]) => res.json(results))
    .catch(err => {
      console.error("Error during search:", err);
      res.status(500).json({ error: 'Database error while searching contacts.' });
    });
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const query = "SELECT * FROM user WHERE email = ? AND password = ?";
  pool.query(query, [email, password])
    .then(([results]) => {
      if (results.length > 0) {
        req.session.email = email;
        res.redirect("/contacts");
      } else {
        res.status(401).render("err", { err: { status: 401, message: "No user found with the provided email and password." } });
      }
    })
    .catch(err => {
      console.error("Error during login:", err);
      res.status(500).render("err", { err: { status: 500, message: "Database error while logging in." } });
    });
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", (req, res) => {
  const { email, password } = req.body;

  const query = "INSERT INTO user (email, password) VALUES (?, ?)";
  pool.query(query, [email, password])
    .then(() => res.redirect("/"))
    .catch(err => {
      console.error("Error during signup:", err);
      res.status(500).render("err", { err: { status: 500, message: "Database error while signing up." } });
    });
});

app.get("/contacts", (req, res) => {
  if (!req.session.email) {
    return res.redirect("/");
  }

  const query = "SELECT * FROM contacts WHERE email = ?";
  pool.query(query, [req.session.email])
    .then(([results]) => res.render("contacts", { contacts: results }))
    .catch(err => {
      console.error("Error retrieving contacts:", err);
      res.status(500).render("err", { err: { status: 500, message: "Database error while retrieving contacts." } });
    });
});

app.get("/addcontact", (req, res) => {
  if (!req.session.email) {
    return res.redirect("/");
  }
  res.render("addcontact");
});

app.post("/contact", (req, res) => {
  if (!req.session.email) {
      return res.redirect("/");
  }
  
  console.log(req.body);

  const { name, contact } = req.body;

  // Check if contact is null or empty
  if (!name || !contact) {
      return res.status(400).render("err", {
          err: { status: 400, message: "Name and contact are required." }
      });
  }

  const query = "INSERT INTO contacts (name, contact, email) VALUES (?, ?, ?)";
  pool.query(query, [name, contact, req.session.email])
      .then(() => res.redirect("/contacts"))
      .catch(err => {
          console.error("Error adding contact:", err); // Log the error for debugging
          res.status(500).render("err", {
              err: { status: 500, message: "Database error while adding contact." }
          });
      });
});


app.get("/contacts/edit/:phone", (req, res) => {
  const phone = req.params.phone;

  if (!req.session.email) {
    return res.redirect("/");
  }

  const query = "SELECT name, contact FROM contacts WHERE contact = ?";
  pool.query(query, [phone])
    .then(([results]) => {
      if (results.length > 0) {
        res.render("edit", { contact: results[0] });
      } else {
        res.status(404).render("err", { status: 404, message: "Contact not found." });
      }
    })
    .catch(err => {
      console.error("Error fetching contact for editing:", err);
      res.status(500).render("err", { status: 500, message: "An error occurred while fetching contact details." });
    });
});

app.post("/edit", (req, res) => {
  const { name, phone, oldPhone } = req.body;

  const query = "UPDATE contacts SET name = ?, contact = ? WHERE contact = ?";
  pool.query(query, [name, phone, oldPhone])
    .then(() => res.redirect("/contacts"))
    .catch(err => {
      console.error("Error updating contact:", err);
      res.status(500).render("err", { status: 500, message: "An error occurred while updating contact details." });
    });
});

app.get("/contacts/delete/:contact", (req, res) => {
  const contact = req.params.contact;

  if (!req.session.email) {
    return res.redirect("/");
  }

  const query = "DELETE FROM contacts WHERE contact = ?";
  pool.query(query, [contact])
    .then(() => res.redirect("/contacts"))
    .catch(err => {
      console.error("Error deleting contact:", err);
      res.status(500).render("err", { status: 500, message: "An error occurred while deleting the contact." });
    });
});

app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).render("err", { err: { status: 500, message: "Error while logging out." } });
    }
    res.redirect("/");
  });
});

app.listen(8080, () => {
  console.log("Server is running on http://localhost:8080");
});
