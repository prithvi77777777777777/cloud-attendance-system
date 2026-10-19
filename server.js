require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Student, Attendance } = require('./models/models');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Atlas Connected successfully!'))
  .catch(err => console.log('DB Connection Error: ', err));

app.post('/api/students', async (req, res) => {
  try {
    const { name, rollNo, class: studentClass } = req.body;
    const student = new Student({ name, rollNo, class: studentClass });
    await student.save();
    res.status(201).json({ message: 'Student added', student });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const studentId = req.params.id;
    await Student.findByIdAndDelete(studentId);
    await Attendance.deleteMany({ studentId: studentId });
    res.json({ message: 'Student and their records deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const { studentId, date, status } = req.body;
    const attendance = await Attendance.findOneAndUpdate(
      { studentId, date },
      { status },
      { new: true, upsert: true } 
    );
    res.status(201).json({ message: 'Attendance saved', attendance });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/attendance', async (req, res) => {
  try {
    const query = req.query.date ? { date: req.query.date } : {};
    const records = await Attendance.find(query).populate('studentId', 'name rollNo class').sort({ updatedAt: -1 });
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stats', async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const today = new Date().toISOString().split('T')[0];
    const todayPresent = await Attendance.countDocuments({ date: today, status: 'Present' });
    const todayAbsent = await Attendance.countDocuments({ date: today, status: 'Absent' });
    res.json({ totalStudents, todayPresent, todayAbsent });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/defaulter', async (req, res) => {
  try {
    const students = await Student.find();
    const result = [];
    for (let s of students) {
      const totalDays = await Attendance.countDocuments({ studentId: s._id });
      const presentDays = await Attendance.countDocuments({ studentId: s._id, status: 'Present' });
      let percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
      result.push({ name: s.name, rollNo: s.rollNo, class: s.class, totalDays, presentDays, percentage });
    }
    result.sort((a, b) => a.percentage - b.percentage);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export', async (req, res) => {
  try {
    const records = await Attendance.find().populate('studentId', 'name rollNo class').sort({ date: -1 });
    let csv = 'Date,Student Name,Roll Number,Class,Status\n';
    records.forEach(r => {
      const name = r.studentId ? `"${r.studentId.name}"` : 'Unknown';
      const roll = r.studentId ? `"${r.studentId.rollNo}"` : 'N/A';
      const cls = r.studentId ? `"${r.studentId.class}"` : 'N/A';
      csv += `${r.date},${name},${roll},${cls},${r.status}\n`;
    });
    res.header('Content-Type', 'text/csv');
    res.attachment('attendance_report.csv');
    return res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// NEW: Student Login Route (checks if roll number exists)
app.get('/api/student-login/:rollNo', async (req, res) => {
  try {
    const student = await Student.findOne({ rollNo: req.params.rollNo });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const records = await Attendance.find({ studentId: student._id }).sort({ date: -1 });
    const totalDays = records.length;
    const presentDays = records.filter(r => r.status === 'Present').length;
    const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    res.json({ student, records, totalDays, presentDays, percentage });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
