

const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";



const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// Dashboard Elements
const teacherName = document.getElementById("teacherName");
const welcomeName = document.getElementById("welcomeName");
const statusMessage = document.getElementById("statusMessage");

// Menu Elements
const menuToggle = document.getElementById("menuToggle");
const closeMenu = document.getElementById("closeMenu");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

// ==================================
// HAMBURGER MENU FUNCTIONALITY
// ==================================

function openMenu() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("show");
    menuToggle.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");
    menuToggle.setAttribute("aria-expanded", "false");
}

menuToggle.addEventListener("click", openMenu);

closeMenu.addEventListener("click", closeSidebar);

sidebarOverlay.addEventListener("click", closeSidebar);

// Close menu with Escape key
document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
        closeSidebar();
    }
});

// Close menu after selecting an option
sidebar.querySelectorAll("nav a").forEach(link => {
    link.addEventListener("click", closeSidebar);
});

// ==================================
// LOAD TEACHER DASHBOARD
// ==================================

async function loadTeacherDashboard() {
    try {
        statusMessage.textContent = "Loading dashboard...";

        // 1. Check login session
        const { data: sessionData, error: sessionError } =
            await db.auth.getSession();

        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;

        if (!user) {
            window.location.href = "teacher-login.html";
            return;
        }

        // 2. Verify teacher profile
        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", user.id)
            .single();

        if (profileError) throw profileError;

        if (profile.role !== "teacher") {
            throw new Error("Teacher account required.");
        }

        // 3. Load teacher record
        const { data: teacher, error: teacherError } = await db
            .from("teachers")
            .select("id, teacher_name")
            .eq("user_id", user.id)
            .single();

        if (teacherError) throw teacherError;

        const currentTeacherId = teacher.id;

        const name =
            teacher.teacher_name ||
            profile.full_name ||
            "Teacher";

        // 4. Display teacher name
        teacherName.textContent = name;
        welcomeName.textContent = name;

        // 5. Load teacher timetable
        const { data: timetable, error: timetableError } = await db
            .from("timetables")
            .select("id, section_id, subject_id, day_of_week")
            .eq("teacher_id", currentTeacherId);

        if (timetableError) throw timetableError;

        // 6. Find unique sections and subjects
        const sectionIds = [
            ...new Set(timetable.map(item => item.section_id))
        ];

        const subjectIds = [
            ...new Set(timetable.map(item => item.subject_id))
        ];

        // 7. Count unique classes and students
        let classCount = 0;
        let studentCount = 0;

        if (sectionIds.length > 0) {

            const { data: sections, error: sectionError } = await db
                .from("sections")
                .select("id, class_id")
                .in("id", sectionIds);

            if (sectionError) throw sectionError;

            classCount = new Set(
                sections.map(section => section.class_id)
            ).size;

            const { data: enrollments, error: enrollmentError } = await db
                .from("enrollments")
                .select("student_id")
                .in("section_id", sectionIds);

            if (enrollmentError) throw enrollmentError;

            studentCount = new Set(
                enrollments.map(item => item.student_id)
            ).size;
        }

        // 8. Count today's periods
        const days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"
        ];

        const today = days[new Date().getDay()];

        const todayPeriods = timetable.filter(
            item =>
                item.day_of_week?.toLowerCase() === today.toLowerCase()
        ).length;

        // 9. Update dashboard statistics
        document.getElementById("classCount").textContent = classCount;
        document.getElementById("studentCount").textContent = studentCount;
        document.getElementById("subjectCount").textContent = subjectIds.length;
        document.getElementById("periodCount").textContent = todayPeriods;

        statusMessage.textContent = "";

    } catch (error) {
        console.error("Teacher Dashboard Error:", error);
        statusMessage.textContent = "Dashboard Error: " + error.message;
    }
}

// ==================================
// LOGOUT
// ==================================

document.getElementById("logoutBtn").addEventListener("click", async () => {

    const { error } = await db.auth.signOut();

    if (error) {
        statusMessage.textContent = error.message;
        return;
    }

    window.location.href = "teacher-login.html";
});

// ==================================
// START DASHBOARD
// ==================================

loadTeacherDashboard();
