
const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
const path = require("path");

app.use(express.static(path.join(__dirname, "../frontend")));

// Test backend
app.get("/api/test", (req, res) => {
    res.json({ message: "Correct backend is running" });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

// Login API
app.post("/api/login", (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({
            success: false,
            message: "Username, password and role are required"
        });
    }

    const sql = `
        SELECT id, username, role
        FROM users
        WHERE username = ? AND password = ? AND role = ?
    `;

    db.query(sql, [username, password, role], (err, results) => {
        if (err) {
            console.error("LOGIN DATABASE ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Database error"
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid username, password or role"
            });
        }

        res.json({
            success: true,
            message: "Login successful",
            user: results[0]
        });
    });
});

// Get active students only
app.get("/api/students", (req, res) => {
    const sql = `
        SELECT * FROM students
        WHERE is_deleted = 0
        ORDER BY id DESC
    `;

    db.query(sql, (err, results) => {
    if (err) {
        console.error("FETCH STUDENTS DATABASE ERROR:", err);

        return res.status(500).json({
            error: "Database error while fetching students"
        });
    }

    res.json(results);
});
});

// Add a student
app.post("/api/students", (req, res) => {
    const { name, roll_no, email, phone, branch, semester } = req.body;

    if (!name || !name.trim() || !roll_no || !String(roll_no).trim()) {
        return res.status(400).json({
            error: "Name and roll number are required"
        });
    }

    const sql = `
        INSERT INTO students
        (name, roll_no, email, phone, branch, semester)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            name.trim(),
            String(roll_no).trim(),
            email || null,
            phone || null,
            branch || null,
            semester || null
        ],
        (err, result) => {
            if (err) {
                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        error: "This roll number already exists"
                    });
                }

                return res.status(500).json({
                    error: "Database error while adding student"
                });
            }

            res.status(201).json({
                message: "Student added successfully",
                id: result.insertId
            });
        }
    );
});

// Edit an active student
app.put("/api/students/:id", (req, res) => {
    const { id } = req.params;
    const { name, roll_no, email, phone, branch, semester } = req.body;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: "Invalid student ID" });
    }

    if (!name || !name.trim() || !roll_no || !String(roll_no).trim()) {
        return res.status(400).json({
            error: "Name and roll number are required"
        });
    }

    const sql = `
        UPDATE students
        SET name = ?, roll_no = ?, email = ?, phone = ?,
            branch = ?, semester = ?
        WHERE id = ? AND is_deleted = 0
    `;

    db.query(
        sql,
        [
            name.trim(),
            String(roll_no).trim(),
            email || null,
            phone || null,
            branch || null,
            semester || null,
            id
        ],
        (err, result) => {
            if (err) {
                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        error: "This roll number already exists"
                    });
                }

                return res.status(500).json({
                    error: "Database error while updating student"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    error: "Active student not found"
                });
            }

            res.json({ message: "Student updated successfully" });
        }
    );
});

// Move student to Recycle Bin
app.delete("/api/students/:id", (req, res) => {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: "Invalid student ID" });
    }

    db.query(
        "UPDATE students SET is_deleted = 1 WHERE id = ? AND is_deleted = 0",
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    error: "Database error while deleting student"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    error: "Active student not found"
                });
            }

            res.json({
                message: "Student moved to Recycle Bin successfully"
            });
        }
    );
});

// Get students in Recycle Bin
app.get("/api/students/recycle-bin", (req, res) => {
    console.log("RECYCLE BIN ROUTE REGISTERED");
    db.query(
        "SELECT * FROM students WHERE is_deleted = 1 ORDER BY id DESC",
        (err, results) => {
            if (err) {
                return res.status(500).json({
                    error: "Could not load Recycle Bin"
                });
            }

            res.json(results);
        }
    );
});

// Restore student from Recycle Bin
app.put("/api/students/:id/restore", (req, res) => {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: "Invalid student ID" });
    }

    db.query(
        "UPDATE students SET is_deleted = 0 WHERE id = ? AND is_deleted = 1",
        [id],
        (err, result) => {
            if (err) {
                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        error: "Cannot restore: this roll number is already in use"
                    });
                }

                return res.status(500).json({
                    error: "Database error while restoring student"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    error: "Deleted student not found"
                });
            }

            res.json({ message: "Student restored successfully" });
        }
    );
});

// Permanently delete student from Recycle Bin
app.delete("/api/students/:id/permanent", (req, res) => {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: "Invalid student ID" });
    }

    db.query(
        "DELETE FROM students WHERE id = ? AND is_deleted = 1",
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    error: "Database error while permanently deleting student"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    error: "Deleted student not found"
                });
            }

            res.json({
                message: "Student permanently deleted"
            });
        }
    );
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
