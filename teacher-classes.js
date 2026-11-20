
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const teacherName = document.getElementById("teacherName");
const statusMessage = document.getElementById("statusMessage");
const tableBody = document.getElementById("classesTableBody");

async function loadMyClasses() {
    try {
        statusMessage.textContent = "Loading classes...";

        // Check login
        const { data: sessionData, error: sessionError } =
            await db.auth.getSession();

        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;

        if (!user) {
            throw new Error("Please login first.");
        }

        // Get teacher record
        const { data: teacher, error: teacherError } = await db
            .from("teachers")
            .select("id, teacher_name")
            .eq("user_id", user.id)
            .single();

        if (teacherError) throw teacherError;

        teacherName.textContent = teacher.teacher_name;

        // Get assigned timetable
        const { data: timetable, error: timetableError } = await db
            .from("timetables")
            .select("section_id, subject_id")
            .eq("teacher_id", teacher.id);

        if (timetableError) throw timetableError;

        if (!timetable || timetable.length === 0) {
            tableBody.innerHTML =
                `<tr><td colspan="4">No classes assigned yet.</td></tr>`;

            updateStats(0, 0, 0);
            statusMessage.textContent = "";
            return;
        }

        const sectionIds = [...new Set(
            timetable.map(item => item.section_id)
        )];

        const subjectIds = [...new Set(
            timetable.map(item => item.subject_id)
        )];

        // Get sections
        const { data: sections, error: sectionError } = await db
            .from("sections")
            .select("id, class_id, section_name")
            .in("id", sectionIds);

        if (sectionError) throw sectionError;

        const classIds = [...new Set(
            sections.map(item => item.class_id)
        )];

        // Get classes
        const { data: classes, error: classError } = await db
            .from("classes")
            .select("id, class_name")
            .in("id", classIds);

        if (classError) throw classError;

        // Get subjects
        const { data: subjects, error: subjectError } = await db
            .from("subjects")
            .select("id, subject_name")
            .in("id", subjectIds);

        if (subjectError) throw subjectError;

        // Get enrolled students
        const { data: enrollments, error: enrollmentError } = await db
            .from("enrollments")
            .select("id, student_id, section_id")
            .in("section_id", sectionIds);

        if (enrollmentError) throw enrollmentError;

        // Create lookup maps
        const classMap = new Map(
            classes.map(item => [String(item.id), item.class_name])
        );

        const sectionMap = new Map(
            sections.map(item => [String(item.id), item])
        );

        const subjectMap = new Map(
            subjects.map(item => [String(item.id), item.subject_name])
        );

        // Count students per section
        const studentCounts = {};

        sectionIds.forEach(id => {
            studentCounts[id] = new Set();
        });

        enrollments.forEach(item => {
            studentCounts[item.section_id]?.add(item.student_id);
        });

        // Unique class and student counts
        const totalStudents = new Set(
            enrollments.map(item => item.student_id)
        ).size;

        const totalClasses = classIds.length;
        const totalSubjects = subjectIds.length;

        updateStats(totalClasses, totalStudents, totalSubjects);

        // Prepare table rows
        const uniqueRows = new Map();

        timetable.forEach(item => {
            const section = sectionMap.get(String(item.section_id));

            if (!section) return;

            const key = `${item.section_id}-${item.subject_id}`;

            uniqueRows.set(key, {
                className: classMap.get(String(section.class_id)) || "Unknown",
                sectionName: section.section_name || "N/A",
                subjectName: subjectMap.get(String(item.subject_id)) || "Unknown",
                students: studentCounts[item.section_id]?.size || 0
            });
        });

        tableBody.innerHTML = "";

        uniqueRows.forEach(item => {
            const row = document.createElement("tr");

            [
                item.className,
                item.sectionName,
                item.subjectName,
                item.students
            ].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        });

        statusMessage.textContent = "";

    } catch (error) {
        console.error("My Classes Error:", error);
        statusMessage.textContent = error.message;

        tableBody.innerHTML =
            `<tr><td colspan="4">Unable to load classes.</td></tr>`;
    }
}

function updateStats(classes, students, subjects) {
    document.getElementById("classCount").textContent = classes;
    document.getElementById("studentCount").textContent = students;
    document.getElementById("subjectCount").textContent = subjects;
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
    const { error } = await db.auth.signOut();

    if (error) {
        statusMessage.textContent = error.message;
        return;
    }

    window.location.href = "teacher-login.html";
});

loadMyClasses();
