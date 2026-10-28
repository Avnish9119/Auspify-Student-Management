
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Test backend
app.get("/api/test", (req, res) => {
    res.json({ message: "Correct backend is running" });
});

// Serve login page
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

        return res.json({
            success: true,
            message: "Login successful",
            user: results[0]
        });
    });
});

// Get active students
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

        return res.json(results);
    });
});

// Add a student
app.post("/api/students", (req, res) => {
    const { name, roll_no, email, phone, branch, semester } = req.body;

    if (
        typeof name !== "string" ||
        !name.trim() ||
        roll_no === undefined ||
        roll_no === null ||
        !String(roll_no).trim()
    ) {
        return res.status(400).json({
            error: "Name and roll number are required"
        });
    }

    const sql = `
        INSERT INTO students
            (name, roll_no, email, phone, branch, semester)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
        name.trim(),
        String(roll_no).trim(),
        email || null,
        phone || null,
        branch || null,
        semester === "" || semester === undefined || semester === null
            ? null
            : semester
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            // This prints the real database error in Render logs.
            console.error("ADD STUDENT DATABASE ERROR:", err);

            if (err.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    error: "This roll number already exists"
                });
            }

            // Return a useful error message for debugging.
            return res.status(500).json({
                error:
                    err.sqlMessage ||
                    err.message ||
                    "Database error while adding student"
            });
        }

        return res.status(201).json({
            message: "Student added successfully",
            id: result.insertId
        });
    });
});

// Edit an active student
app.put("/api/students/:id", (req, res) => {
    const { id } = req.params;
    const { name, roll_no, email, phone, branch, semester } = req.body;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({
            error: "Invalid student ID"
        });
    }

    if (
        typeof name !== "string" ||
        !name.trim() ||
        roll_no === undefined ||
        roll_no === null ||
        !String(roll_no).trim()
    ) {
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

    const values = [
        name.trim(),
        String(roll_no).trim(),
        email || null,
        phone || null,
        branch || null,
        semester === "" || semester === undefined || semester === null
            ? null
            : semester,
        id
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("UPDATE STUDENT DATABASE ERROR:", err);

            if (err.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    error: "This roll number already exists"
                });
            }

            return res.status(500).json({
                error:
                    err.sqlMessage ||
                    err.message ||
                    "Database error while updating student"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Active student not found"
            });
        }

        return res.json({
            message: "Student updated successfully"
        });
    });
});

// Move student to Recycle Bin
app.delete("/api/students/:id", (req, res) => {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({
            error: "Invalid student ID"
        });
    }

    const sql = `
        UPDATE students
        SET is_deleted = 1
        WHERE id = ? AND is_deleted = 0
    `;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("DELETE STUDENT DATABASE ERROR:", err);

            return res.status(500).json({
                error: "Database error while deleting student"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Active student not found"
            });
        }

        return res.json({
            message: "Student moved to Recycle Bin successfully"
        });
    });
});

// Get students in Recycle Bin
app.get("/api/students/recycle-bin", (req, res) => {
    const sql = `
        SELECT * FROM students
        WHERE is_deleted = 1
        ORDER BY id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("RECYCLE BIN DATABASE ERROR:", err);

            return res.status(500).json({
                error: "Could not load Recycle Bin"
            });
        }

        return res.json(results);
    });
});

// Restore student from Recycle Bin
app.put("/api/students/:id/restore", (req, res) => {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({
            error: "Invalid student ID"
        });
    }

    const sql = `
        UPDATE students
        SET is_deleted = 0
        WHERE id = ? AND is_deleted = 1
    `;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("RESTORE STUDENT DATABASE ERROR:", err);

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

        return res.json({
            message: "Student restored successfully"
        });
    });
});

// Permanently delete student from Recycle Bin
app.delete("/api/students/:id/permanent", (req, res) => {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({
            error: "Invalid student ID"
        });
    }

    const sql = `
        DELETE FROM students
        WHERE id = ? AND is_deleted = 1
    `;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("PERMANENT DELETE DATABASE ERROR:", err);

            return res.status(500).json({
                error: "Database error while permanently deleting student"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Deleted student not found"
            });
        }

        return res.json({
            message: "Student permanently deleted"
        });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
