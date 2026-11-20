
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";


const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const BUCKET = "homework-files";

const teacherName = document.getElementById("teacherName");
const homeworkFilter = document.getElementById("homeworkFilter");
const loadSubmissionsBtn = document.getElementById("loadSubmissionsBtn");
const submissionsTableBody = document.getElementById("submissionsTableBody");
const statusMessage = document.getElementById("statusMessage");
const logoutBtn = document.getElementById("logoutBtn");

let currentTeacher = null;

// ==========================================
// MESSAGE
// ==========================================

function showMessage(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? "red" : "green";
}

// ==========================================
// TABLE CELL
// ==========================================

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "-";
    row.appendChild(cell);
    return cell;
}

// ==========================================
// INITIALIZE PAGE
// ==========================================

async function initializePage() {
    try {
        const { data: sessionData, error: sessionError } =
            await db.auth.getSession();

        if (sessionError) throw sessionError;

        if (!sessionData.session) {
            window.location.href = "teacher-login.html";
            return;
        }

        const user = sessionData.session.user;

        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("full_name, role")
            .eq("id", user.id)
            .single();

        if (profileError) throw profileError;

        if (!profile || profile.role !== "teacher") {
            throw new Error("Teacher account verification failed.");
        }

        const { data: teacher, error: teacherError } = await db
            .from("teachers")
            .select("id, teacher_name")
            .eq("user_id", user.id)
            .single();

        if (teacherError) throw teacherError;

        if (!teacher) {
            throw new Error("Teacher record not found.");
        }

        currentTeacher = teacher;
        teacherName.textContent = teacher.teacher_name;

        await loadHomework();

    } catch (error) {
        console.error(error);
        showMessage(error.message, true);

        submissionsTableBody.innerHTML = `
            <tr>
                <td colspan="6">Unable to load submissions.</td>
            </tr>
        `;
    }
}

// ==========================================
// LOAD TEACHER HOMEWORK
// ==========================================

async function loadHomework() {
    homeworkFilter.innerHTML =
        '<option value="">All Homework</option>';

    const { data, error } = await db
        .from("homework")
        .select("id, title")
        .eq("teacher_id", currentTeacher.id)
        .order("created_at", { ascending: false });

    if (error) {
        showMessage("Homework loading failed: " + error.message, true);
        return;
    }

    (data || []).forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.title;
        homeworkFilter.appendChild(option);
    });

    await loadSubmissions();
}

// ==========================================
// LOAD SUBMISSIONS
// ==========================================

async function loadSubmissions() {
    if (!currentTeacher) return;

    submissionsTableBody.innerHTML = `
        <tr>
            <td colspan="6">Loading submissions...</td>
        </tr>
    `;

    showMessage("Loading submissions...");

    try {
        let query = db
            .from("homework_submissions")
            .select(`
                id,
                homework_id,
                student_id,
                submission_text,
                file_path,
                submitted_at,
                status
            `)
            .order("submitted_at", { ascending: false });

        const selectedHomework = homeworkFilter.value;

        if (selectedHomework) {
            query = query.eq("homework_id", selectedHomework);
        }

        const { data: submissions, error } = await query;

        if (error) throw error;

        if (!submissions || submissions.length === 0) {
            submissionsTableBody.innerHTML = `
                <tr>
                    <td colspan="6">No submissions found.</td>
                </tr>
            `;

            showMessage("No submissions available.");
            return;
        }

        const homeworkIds = [
            ...new Set(submissions.map(s => s.homework_id))
        ];

        const studentIds = [
            ...new Set(submissions.map(s => s.student_id))
        ];

        const { data: homeworkData, error: homeworkError } = await db
            .from("homework")
            .select("id, title")
            .in("id", homeworkIds);

        if (homeworkError) throw homeworkError;

        const { data: students, error: studentError } = await db
            .from("students")
            .select("id, student_name")
            .in("id", studentIds);

        if (studentError) throw studentError;

        const homeworkMap = new Map(
            (homeworkData || []).map(h => [
                String(h.id),
                h.title
            ])
        );

        const studentMap = new Map(
            (students || []).map(s => [
                String(s.id),
                s.student_name
            ])
        );

        submissionsTableBody.innerHTML = "";

        for (const submission of submissions) {
            const row = document.createElement("tr");

            addCell(
                row,
                studentMap.get(String(submission.student_id)) ||
                "Unknown Student"
            );

            addCell(
                row,
                homeworkMap.get(String(submission.homework_id)) ||
                "Unknown Homework"
            );

            addCell(
                row,
                submission.submission_text || "PDF submitted"
            );

            const submittedAt = submission.submitted_at
                ? new Date(submission.submitted_at).toLocaleString()
                : "-";

            addCell(row, submittedAt);

            addCell(row, submission.status || "submitted");

            const actionCell = addCell(row, "");

            if (submission.file_path) {
                const viewButton = document.createElement("button");

                viewButton.type = "button";
                viewButton.textContent = "View PDF";

                viewButton.addEventListener("click", async () => {
                    viewButton.disabled = true;
                    viewButton.textContent = "Opening...";

                    try {
                        const { data, error } = await db.storage
                            .from(BUCKET)
                            .createSignedUrl(submission.file_path, 600);

                        if (error) throw error;

                        window.open(
                            data.signedUrl,
                            "_blank",
                            "noopener,noreferrer"
                        );

                    } catch (error) {
                        console.error("PDF View Error:", error);
                        showMessage(
                            "PDF could not be opened: " + error.message,
                            true
                        );
                    } finally {
                        viewButton.disabled = false;
                        viewButton.textContent = "View PDF";
                    }
                });

                actionCell.appendChild(viewButton);

            } else {
                actionCell.textContent = "No PDF attached";
            }

            submissionsTableBody.appendChild(row);
        }

        showMessage("Submissions loaded successfully!");

    } catch (error) {
        console.error("Submission Loading Error:", error);

        submissionsTableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    Error: ${error.message}
                </td>
            </tr>
        `;

        showMessage(
            "Submissions loading failed: " + error.message,
            true
        );
    }
}

// ==========================================
// FILTER BUTTON
// ==========================================

loadSubmissionsBtn.addEventListener("click", loadSubmissions);

// ==========================================
// LOGOUT
// ==========================================

logoutBtn.addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.href = "teacher-login.html";
});

// ==========================================
// START
// ==========================================

initializePage();
