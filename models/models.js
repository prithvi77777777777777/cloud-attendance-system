const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNo: { type: String, required: true, unique: true },
  class: { type: String, required: true }
});

const AttendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  date: { type: String, required: true },
  status: { type: String, enum: ['Present', 'Absent'], required: true },
  markedBy: { type: String, default: 'Teacher' }
}, { timestamps: true });

// NEW: Ensure a student can only have ONE record per date
AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = {
  Student: mongoose.model('Student', StudentSchema),
  Attendance: mongoose.model('Attendance', AttendanceSchema)
};
