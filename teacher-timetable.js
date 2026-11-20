
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const teacherName = document.getElementById("teacherName");
const timetableBody = document.getElementById("timetableBody");
const statusMessage = document.getElementById("statusMessage");
const dayFilter = document.getElementById("dayFilter");

let allTimetable = [];

async function loadTimetable() {
    try {
        statusMessage.textContent = "Loading timetable...";

        const { data: sessionData, error: sessionError } =
            await db.auth.getSession();

        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;

        if (!user) {
            throw new Error("Please login first.");
        }

        // Get teacher details
        const { data: teacher, error: teacherError } = await db
            .from("teachers")
            .select("id, teacher_name")
            .eq("user_id", user.id)
            .single();

        if (teacherError) throw teacherError;

        teacherName.textContent = teacher.teacher_name;

        // Get teacher timetable
        const { data: timetable, error: timetableError } = await db
            .from("timetables")
            .select("id, section_id, subject_id, day_of_week, period_number, start_time, end_time")
            .eq("teacher_id", teacher.id);

        if (timetableError) throw timetableError;

        if (!timetable || timetable.length === 0) {
            timetableBody.innerHTML =
                `<tr><td colspan="6">No timetable assigned yet.</td></tr>`;

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

        const classMap = new Map(
            classes.map(item => [
                String(item.id), item.class_name
            ])
        );

        const sectionMap = new Map(
            sections.map(item => [
                String(item.id), item.section_name
            ])
        );

        const subjectMap = new Map(
            subjects.map(item => [
                String(item.id), item.subject_name
            ])
        );

        allTimetable = timetable.map(item => ({
            day: item.day_of_week,
            period: item.period_number,
            start: item.start_time,
            end: item.end_time,
            className: classMap.get(
                String(sections.find(s => s.id === item.section_id)?.class_id)
            ) || "Unknown",
            sectionName: sectionMap.get(
                String(item.section_id)
            ) || "N/A",
            subjectName: subjectMap.get(
                String(item.subject_id)
            ) || "Unknown"
        }));

        allTimetable.sort((a, b) => {
            const days = [
                "Monday", "Tuesday", "Wednesday",
                "Thursday", "Friday", "Saturday"
            ];

            return days.indexOf(a.day) - days.indexOf(b.day) ||
                a.period - b.period;
        });

        displayTimetable(allTimetable);
        statusMessage.textContent = "";

    } catch (error) {
        console.error("Timetable Error:", error);
        statusMessage.textContent = error.message;

        timetableBody.innerHTML =
            `<tr><td colspan="6">Unable to load timetable.</td></tr>`;
    }
}

function displayTimetable(records) {
    timetableBody.innerHTML = "";

    if (records.length === 0) {
        timetableBody.innerHTML =
            `<tr><td colspan="6">No timetable found for this day.</td></tr>`;
        return;
    }

    records.forEach(item => {
        const row = document.createElement("tr");

        const values = [
            item.day,
            item.period,
            `${item.start} - ${item.end}`,
            item.className,
            item.sectionName,
            item.subjectName
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        timetableBody.appendChild(row);
    });
}

// Day filter
dayFilter.addEventListener("change", () => {
    const selectedDay = dayFilter.value;

    if (selectedDay === "All") {
        displayTimetable(allTimetable);
    } else {
        displayTimetable(
            allTimetable.filter(item => item.day === selectedDay)
        );
    }
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
    const { error } = await db.auth.signOut();

    if (error) {
        statusMessage.textContent = error.message;
        return;
    }

    window.location.href = "teacher-login.html";
});

loadTimetable();
