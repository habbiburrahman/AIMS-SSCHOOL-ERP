
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";


const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const teacherName = document.getElementById("teacherName");
const classFilter = document.getElementById("classFilter");
const sectionFilter = document.getElementById("sectionFilter");
const subjectFilter = document.getElementById("subjectFilter");
const homeworkForm = document.getElementById("homeworkForm");
const homeworkTableBody = document.getElementById("homeworkTableBody");
const statusMessage = document.getElementById("statusMessage");
const homeworkPdf = document.getElementById("homeworkPdf");
const pdfFileName = document.getElementById("pdfFileName");

const BUCKET_NAME = "homework-files";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

let currentUser = null;
let currentTeacher = null;
let assignedSections = [];
let timetableRecords = [];
let classesMap = new Map();
let subjectsMap = new Map();

function showMessage(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? "red" : "green";
}

function validatePdf(file) {
    if (!file) return;

    if (
        file.type !== "application/pdf" ||
        !file.name.toLowerCase().endsWith(".pdf")
    ) {
        throw new Error("Please select a valid PDF file.");
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error("PDF size must not exceed 5 MB.");
    }
}

homeworkPdf.addEventListener("change", () => {
    const file = homeworkPdf.files[0];

    try {
        validatePdf(file);
        pdfFileName.textContent = file
            ? "Selected PDF: " + file.name
            : "";
        pdfFileName.style.color = "green";
    } catch (error) {
        homeworkPdf.value = "";
        pdfFileName.textContent = error.message;
        pdfFileName.style.color = "red";
    }
});

async function initializeHomework() {
    try {
        showMessage("Loading teacher details...");

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

        if (!teacher || !teacher.id) {
            throw new Error("Teacher record or Teacher ID not found.");
        }

        currentTeacher = teacher;
        teacherName.textContent = teacher.teacher_name;

        console.log("Logged-in Teacher:", currentTeacher);

        const { data: timetable, error: timetableError } = await db
            .from("timetables")
            .select("section_id, subject_id")
            .eq("teacher_id", teacher.id);

        if (timetableError) throw timetableError;

        timetableRecords = timetable || [];

        const sectionIds = [
            ...new Set(timetableRecords.map(item => item.section_id))
        ];

        const subjectIds = [
            ...new Set(timetableRecords.map(item => item.subject_id))
        ];

        if (sectionIds.length === 0) {
            showMessage("No assigned classes found.");
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

        const { data: subjects, error: subjectError } = await db
            .from("subjects")
            .select("id, subject_name")
            .in("id", subjectIds);

        if (subjectError) throw subjectError;

        classesMap = new Map(
            classes.map(item => [
                String(item.id),
                item.class_name
            ])
        );

        subjectsMap = new Map(
            subjects.map(item => [
                String(item.id),
                item.subject_name
            ])
        );

        assignedSections = sections || [];

        const uniqueClasses = [
            ...new Map(
                assignedSections.map(item => [
                    String(item.class_id),
                    item
                ])
            ).values()
        ];

        classFilter.innerHTML =
            '<option value="">Select Class</option>';

        uniqueClasses.forEach(item => {
            const option = document.createElement("option");
            option.value = item.class_id;
            option.textContent =
                classesMap.get(String(item.class_id)) || "Unknown";

            classFilter.appendChild(option);
        });

        showMessage("");
        await loadMyHomework();

    } catch (error) {
        console.error("Initialization Error:", error);
        showMessage(error.message, true);
    }
}

// Class selection
classFilter.addEventListener("change", () => {
    sectionFilter.innerHTML =
        '<option value="">Select Section</option>';

    subjectFilter.innerHTML =
        '<option value="">Select Subject</option>';

    const selectedClass = classFilter.value;

    assignedSections
        .filter(item => String(item.class_id) === selectedClass)
        .forEach(item => {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.section_name;
            sectionFilter.appendChild(option);
        });
});

// Section selection
sectionFilter.addEventListener("change", () => {
    subjectFilter.innerHTML =
        '<option value="">Select Subject</option>';

    const selectedSection = sectionFilter.value;

    const subjectIds = [
        ...new Set(
            timetableRecords
                .filter(item =>
                    String(item.section_id) === selectedSection
                )
                .map(item => item.subject_id)
        )
    ];

    subjectIds.forEach(id => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent =
            subjectsMap.get(String(id)) || "Unknown Subject";

        subjectFilter.appendChild(option);
    });
});

// Upload teacher PDF
async function uploadTeacherPdf(file) {
    if (!file) return null;

    validatePdf(file);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    const filePath =
        `teacher/${currentUser.id}/${crypto.randomUUID()}-${safeName}`;

    const { data, error } = await db.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
            contentType: "application/pdf",
            upsert: false
        });

    if (error) throw error;

    return data.path;
}

// Create homework
homeworkForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    let uploadedFilePath = null;

    try {
        if (!currentTeacher || !currentTeacher.id) {
            throw new Error("Teacher ID not available. Please login again.");
        }

        const classId = classFilter.value;
        const sectionId = sectionFilter.value;
        const subjectId = subjectFilter.value;

        const title =
            document.getElementById("homeworkTitle").value.trim();

        const description =
            document.getElementById("homeworkDescription").value.trim();

        const dueDate =
            document.getElementById("dueDate").value;

        const file = homeworkPdf.files[0];

        if (!classId || !sectionId || !subjectId || !title || !dueDate) {
            throw new Error("Please fill all required fields.");
        }

        if (file) validatePdf(file);

        const assignedSection = assignedSections.find(
            item => String(item.id) === sectionId
        );

        const validSubject = timetableRecords.some(
            item =>
                String(item.section_id) === sectionId &&
                String(item.subject_id) === subjectId
        );

        if (!assignedSection || !validSubject) {
            throw new Error(
                "Selected class, section or subject is not assigned to you."
            );
        }

        showMessage(
            file ? "Uploading PDF..." : "Creating homework..."
        );

        if (file) {
            uploadedFilePath = await uploadTeacherPdf(file);
        }

        const homeworkData = {
            teacher_id: currentTeacher.id,
            class_id: Number(classId),
            section_id: Number(sectionId),
            subject_id: Number(subjectId),
            title: title,
            description: description,
            due_date: dueDate,
            assigned_date: getTodayDate(),
            file_path: uploadedFilePath
        };

        console.log("Homework Data Before Save:", homeworkData);

        const { data: savedHomework, error } = await db
            .from("homework")
            .insert([homeworkData])
            .select("id, title, teacher_id, file_path")
            .single();

        if (error) throw error;

        console.log("Saved Homework:", savedHomework);

        if (!savedHomework || !savedHomework.teacher_id) {
            throw new Error(
                "Homework saved, but Teacher ID was not returned."
            );
        }

        homeworkForm.reset();
        pdfFileName.textContent = "";

        sectionFilter.innerHTML =
            '<option value="">Select Section</option>';

        subjectFilter.innerHTML =
            '<option value="">Select Subject</option>';

        showMessage(
            file
                ? "Homework and PDF uploaded successfully!"
                : "Homework created successfully!"
        );

        await loadMyHomework();

    } catch (error) {
        console.error("Homework Creation Error:", error);

        showMessage(error.message, true);
    }
});

// Today's date
function getTodayDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Create private signed PDF link
async function createPdfLink(filePath) {
    if (!filePath) return null;

    const { data, error } = await db.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, 300);

    if (error) {
        console.error("PDF Link Error:", error);
        return null;
    }

    return data.signedUrl;
}

// Load teacher's homework
async function loadMyHomework() {
    try {
        if (!currentTeacher) return;

        const { data: homework, error } = await db
            .from("homework")
            .select("*")
            .eq("teacher_id", currentTeacher.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        homeworkTableBody.innerHTML = "";

        if (!homework || homework.length === 0) {
            homeworkTableBody.innerHTML =
                '<tr><td colspan="5">No homework created yet.</td></tr>';
            return;
        }

        const sectionIds = [
            ...new Set(homework.map(item => item.section_id))
        ];

        const { data: sections, error: sectionError } = await db
            .from("sections")
            .select("id, section_name")
            .in("id", sectionIds);

        if (sectionError) throw sectionError;

        const sectionMap = new Map(
            sections.map(item => [
                String(item.id),
                item.section_name
            ])
        );

        for (const item of homework) {
            const row = document.createElement("tr");

            const values = [
                item.title,
                classesMap.get(String(item.class_id)) || "Unknown",
                sectionMap.get(String(item.section_id)) || "Unknown",
                item.due_date || "Not specified"
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            const pdfCell = document.createElement("td");

            if (item.file_path) {
                const signedUrl = await createPdfLink(item.file_path);

                if (signedUrl) {
                    const link = document.createElement("a");
                    link.href = signedUrl;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.textContent = "View PDF";
                    pdfCell.appendChild(link);
                } else {
                    pdfCell.textContent = "PDF unavailable";
                }
            } else {
                pdfCell.textContent = "No PDF";
            }

            row.appendChild(pdfCell);
            homeworkTableBody.appendChild(row);
        }

    } catch (error) {
        console.error("Homework Loading Error:", error);
        showMessage(error.message, true);
    }
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.href = "teacher-login.html";
});

initializeHomework();
