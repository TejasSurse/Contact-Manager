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
  secret: 'your-secret-key', // Secret key for session encryption (change to something secure)
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if you're using https
}));

// Database Connection
const conn = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    ssl: {
      rejectUnauthorized: false
    }
  });

  
  
conn.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  } else {
    console.log("Connected to the database.");
  }
});

// Login Route - Render Login Page
app.get("/", (req, res) => {
  res.render("login");
});



// Search Route - Handle AJAX Search Requests
app.get("/search", (req, res) => {
    const searchQuery = req.query.query;
    
    // Use a parameterized query to prevent SQL injection
    const query = "SELECT name, contact FROM contacts WHERE name LIKE ? OR contact LIKE ?";
    conn.query(query, [`%${searchQuery}%`, `%${searchQuery}%`], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database error while searching contacts.' });
      }
  
      res.json(results); // Send the search results as JSON
    });
  });
  

app.get("/about", (req, res)=>{
    res.render("about");
})

// Login Route - Process Login Data
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  
  const query = "SELECT * FROM user WHERE email = ? AND password = ?";
  conn.query(query, [email, password], (err, results) => {
    if (err) {
      return res.status(500).render("err", { err: { status: 500, message: "Database error while logging in." } });
    }
    
    if (results.length > 0) {
      // Store email in session
      req.session.email = email;
      return res.redirect("/contacts");
    } else {
      return res.status(401).render("err", { err: { status: 401, message: "No user found with the provided email and password." } });
    }
  });
});

// Signup Route - Render Signup Page
app.get("/signup", (req, res) => {
  res.render("signup");
});

// Signup Route - Process Signup Data
app.post("/signup", (req, res) => {
  const { email, password } = req.body;
  
  const query = "INSERT INTO user (email, password) VALUES (?, ?)";
  conn.query(query, [email, password], (err, results) => {
    if (err) {
      return res.status(500).render("err", { err: { status: 500, message: "Database error while signing up." } });
    }
    
    res.redirect("/"); // Redirect to login page on successful signup
  });
});

// Contacts Route - Display Contacts for Logged-In User
app.get("/contacts", (req, res) => {
  // Check if the user is logged in
  if (!req.session.email) {
    return res.redirect("/"); // Redirect to login if not logged in
  }

  const query = "SELECT * FROM contacts WHERE email = ?";
  conn.query(query, [req.session.email], (err, results) => {
    if (err) {
      return res.status(500).render("err", { err: { status: 500, message: "Database error while retrieving contacts." } });
    }
    
    res.render("contacts", { contacts: results });
  });
});

// Add Contact Route - Render Add Contact Page
app.get("/addcontact", (req, res) => {
  if (!req.session.email) {
    return res.redirect("/"); // Redirect to login if not logged in
  }
  
  res.render("addcontact");
});

// Add Contact Route - Process New Contact Data
app.post("/contact", (req, res) => {
  if (!req.session.email) {
    return res.redirect("/"); // Redirect to login if not logged in
  }

  const { name, contact } = req.body;
  
  const query = "INSERT INTO contacts (name, contact, email) VALUES (?, ?, ?)";
  conn.query(query, [name, contact, req.session.email], (err, results) => {
    if (err) {
      return res.status(500).render("err", { err: { status: 500, message: "Database error while adding contact." } });
    }
    
    res.redirect("/contacts"); // Redirect to contacts page after adding a new contact
  });
});

// Edit Contact Route
app.get("/contacts/edit/:phone", (req, res) => { 
    const phone = req.params.phone;
    
    if (!req.session.email) {
      return res.redirect("/"); // Redirect to login if not logged in
    }

    const query = "SELECT name, contact FROM contacts WHERE contact = ?";
    
    conn.query(query, [phone], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).render("err", { 
                status: 500, 
                message: "An error occurred while fetching contact details." 
            });
        }

        if (results.length > 0) {
            const contact = results[0]; // Get the contact details
            res.render("edit", { contact }); // Render the edit page with contact details
        } else {
            res.status(404).render("err", { 
                status: 404, 
                message: "Contact not found." 
            });
        }
    });
});

app.post("/edit", (req, res) => {
    const { name, phone, oldPhone } = req.body; // Assume `oldPhone` is passed in the form to identify the record
    
    const query = "UPDATE contacts SET name = ?, contact = ? WHERE contact = ?";
    
    conn.query(query, [name, phone, oldPhone], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).render("err", { 
                status: 500, 
                message: "An error occurred while updating contact details." 
            });
        }

        res.redirect("/contacts"); // After successful update, redirect to contacts page
    });
});

// Delete Contact Route
app.get("/contacts/delete/:contact", (req, res) => {
    const contact = req.params.contact;
    
    if (!req.session.email) {
      return res.redirect("/"); // Redirect to login if not logged in
    }

    const query = "DELETE FROM contacts WHERE contact = ?";

    conn.query(query, [contact], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).render("err", { 
                status: 500, 
                message: "An error occurred while deleting the contact." 
            });
        }

        res.redirect("/contacts"); // Redirect to contacts page after deletion
    });
});

// Logout Route - Clears the session
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).render("err", { err: { status: 500, message: "Error while logging out." } });
    }
    res.redirect("/"); // Redirect to login page after logout
  });
});

// Start Server
app.listen(8080, () => {
  console.log("Server is running on http://localhost:8080");
});
