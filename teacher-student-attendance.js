
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";


const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const teacherName = document.getElementById("teacherName");
const classFilter = document.getElementById("classFilter");
const sectionFilter = document.getElementById("sectionFilter");
const attendanceDate = document.getElementById("attendanceDate");
const studentsTableBody = document.getElementById("studentsTableBody");
const statusMessage = document.getElementById("statusMessage");

let currentUser = null;
let currentTeacher = null;
let assignedSections = [];
let studentRecords = [];

// Today's local date
function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

attendanceDate.value = getTodayDate();

// Load teacher and assigned sections
async function initializeAttendance() {
    try {
        statusMessage.textContent = "Loading teacher details...";

        const { data: sessionData, error: sessionError } =
            await db.auth.getSession();

        if (sessionError) throw sessionError;

        currentUser = sessionData.session?.user;

        if (!currentUser) {
            window.location.href = "teacher-login.html";
            return;
        }

        const { data: teacher, error: teacherError } = await db
            .from("teachers")
            .select("id, teacher_name")
            .eq("user_id", currentUser.id)
            .single();

        if (teacherError) throw teacherError;

        currentTeacher = teacher;
        teacherName.textContent = teacher.teacher_name;

        const { data: timetable, error: timetableError } = await db
            .from("timetables")
            .select("section_id")
            .eq("teacher_id", teacher.id);

        if (timetableError) throw timetableError;

        const sectionIds = [
            ...new Set(timetable.map(item => item.section_id))
        ];

        if (sectionIds.length === 0) {
            statusMessage.textContent =
                "No classes assigned to your account yet.";
            return;
        }

        const { data: sections, error: sectionError } = await db
            .from("sections")
            .select("id, class_id, section_name")
            .in("id", sectionIds);

        if (sectionError) throw sectionError;

        const classIds = [
            ...new Set(sections.map(item => item.class_id))
        ];

        const { data: classes, error: classError } = await db
            .from("classes")
            .select("id, class_name")
            .in("id", classIds);

        if (classError) throw classError;

        const classMap = new Map(
            classes.map(item => [
                String(item.id),
                item.class_name
            ])
        );

        assignedSections = sections.map(section => ({
            id: section.id,
            class_id: section.class_id,
            section_name: section.section_name,
            class_name: classMap.get(String(section.class_id)) || "Unknown"
        }));

        const uniqueClasses = [
            ...new Map(
                assignedSections.map(item => [
                    String(item.class_id),
                    item
                ])
            ).values()
        ];

        classFilter.innerHTML = '<option value="">Select Class</option>';

        uniqueClasses.forEach(item => {
            const option = document.createElement("option");
            option.value = item.class_id;
            option.textContent = item.class_name;
            classFilter.appendChild(option);
        });

        statusMessage.textContent = "Select a class and section.";

    } catch (error) {
        console.error(error);
        statusMessage.textContent = error.message;
    }
}

// Update sections when class changes
classFilter.addEventListener("change", () => {
    const selectedClass = classFilter.value;

    sectionFilter.innerHTML =
        '<option value="">Select Section</option>';

    studentsTableBody.innerHTML =
        '<tr><td colspan="3">Select a section and load students.</td></tr>';

    studentRecords = [];

    const filteredSections = assignedSections.filter(
        item => String(item.class_id) === String(selectedClass)
    );

    filteredSections.forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.section_name;
        sectionFilter.appendChild(option);
    });
});

// Load students
document.getElementById("loadStudentsBtn").addEventListener("click", loadStudents);

async function loadStudents() {
    try {
        const sectionId = sectionFilter.value;
        const date = attendanceDate.value;

        if (!sectionId || !date) {
            statusMessage.textContent =
                "Please select class, section and date.";
            return;
        }

        statusMessage.textContent = "Loading students...";

        const { data: enrollments, error: enrollmentError } = await db
            .from("enrollments")
            .select("id, student_id, roll_number")
            .eq("section_id", sectionId);

        if (enrollmentError) throw enrollmentError;

        if (!enrollments || enrollments.length === 0) {
            studentRecords = [];
            studentsTableBody.innerHTML =
                '<tr><td colspan="3">No students enrolled in this section.</td></tr>';

            statusMessage.textContent = "";
            return;
        }

        const studentIds = [
            ...new Set(enrollments.map(item => item.student_id))
        ];

        const { data: students, error: studentError } = await db
            .from("students")
            .select("id, student_name")
            .in("id", studentIds);

        if (studentError) throw studentError;

        const { data: attendance, error: attendanceError } = await db
            .from("attendance")
            .select("enrollment_id, status")
            .in("enrollment_id", enrollments.map(item => item.id))
            .eq("attendance_date", date);

        if (attendanceError) throw attendanceError;

        const studentMap = new Map(
            students.map(item => [
                String(item.id),
                item.student_name
            ])
        );

        const attendanceMap = new Map(
            attendance.map(item => [
                String(item.enrollment_id),
                item.status
            ])
        );

        studentRecords = enrollments.map(item => ({
            enrollment_id: item.id,
            roll_number: item.roll_number,
            student_name:
                studentMap.get(String(item.student_id)) || "Unknown Student",
            status: attendanceMap.get(String(item.id)) || "present"
        }));

        renderStudents();

        statusMessage.textContent =
            `${studentRecords.length} students loaded successfully.`;

    } catch (error) {
        console.error(error);
        statusMessage.textContent = error.message;
    }
}

// Display students
function renderStudents() {
    studentsTableBody.innerHTML = "";

    if (studentRecords.length === 0) {
        studentsTableBody.innerHTML =
            '<tr><td colspan="3">No students found.</td></tr>';
        return;
    }

    studentRecords.forEach((student, index) => {
        const row = document.createElement("tr");

        const rollCell = document.createElement("td");
        rollCell.textContent = student.roll_number;

        const nameCell = document.createElement("td");
        nameCell.textContent = student.student_name;

        const statusCell = document.createElement("td");

        const select = document.createElement("select");
        select.className = "attendance-status";

        const options = [
            { value: "present", label: "Present" },
            { value: "absent", label: "Absent" },
            { value: "late", label: "Late" },
            { value: "leave", label: "Leave" }
        ];

        options.forEach(item => {
            const option = document.createElement("option");
            option.value = item.value;
            option.textContent = item.label;
            select.appendChild(option);
        });

        select.value = student.status;

        select.addEventListener("change", () => {
            studentRecords[index].status = select.value;
        });

        statusCell.appendChild(select);

        row.appendChild(rollCell);
        row.appendChild(nameCell);
        row.appendChild(statusCell);

        studentsTableBody.appendChild(row);
    });
}

// Save attendance
document.getElementById("saveAttendanceBtn").addEventListener("click", saveAttendance);

async function saveAttendance() {
    try {
        if (studentRecords.length === 0) {
            statusMessage.textContent = "Load students first.";
            return;
        }

        const date = attendanceDate.value;

        if (!date) {
            statusMessage.textContent = "Please select attendance date.";
            return;
        }

        statusMessage.textContent = "Saving attendance...";

        const attendanceData = studentRecords.map(student => ({
            enrollment_id: student.enrollment_id,
            attendance_date: date,
            status: student.status,
            marked_by: currentUser.id
        }));

        const { error } = await db
            .from("attendance")
            .upsert(attendanceData, {
                onConflict: "enrollment_id,attendance_date"
            });

        if (error) throw error;

        statusMessage.textContent =
            "Attendance saved successfully!";

    } catch (error) {
        console.error(error);
        statusMessage.textContent = error.message;
    }
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.href = "teacher-login.html";
});

initializeAttendance();
