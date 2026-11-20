
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const examSelect = document.getElementById("examSelect");
const subjectSelect = document.getElementById("subjectSelect");
const loadStudentsBtn = document.getElementById("loadStudentsBtn");
const resultsTableBody = document.getElementById("resultsTableBody");
const message = document.getElementById("message");

let currentTeacher = null;
let assignedTimetables = [];
let assignedSections = [];
let examinations = [];
let currentStudents = [];
let currentTotalMarks = 100;

function showMessage(text, color = "#2563eb") {
    message.textContent = text;
    message.style.color = color;
}

async function initializeResults() {
    try {
        showMessage("Checking teacher login...");

        const { data: sessionData, error: sessionError } =
            await db.auth.getSession();

        if (sessionError) throw sessionError;

        const currentUser = sessionData.session?.user;

        if (!currentUser) {
            window.location.href = "teacher-login.html";
            return;
        }

        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .single();

        if (profileError) throw profileError;

        if (profile.role !== "teacher") {
            showMessage("Teacher account required.", "red");
            return;
        }

        const { data: teacher, error: teacherError } = await db
            .from("teachers")
            .select("id, teacher_name")
            .eq("user_id", currentUser.id)
            .single();

        if (teacherError) throw teacherError;

        currentTeacher = teacher;

        const { data: timetable, error: timetableError } = await db
            .from("timetables")
            .select("section_id, subject_id")
            .eq("teacher_id", currentTeacher.id);

        if (timetableError) throw timetableError;

        assignedTimetables = timetable || [];

        if (assignedTimetables.length === 0) {
            showMessage("No assigned classes or subjects found.", "red");
            return;
        }

        const sectionIds = [
            ...new Set(assignedTimetables.map(item => item.section_id))
        ];

        const { data: sections, error: sectionsError } = await db
            .from("sections")
            .select("id, class_id")
            .in("id", sectionIds);

        if (sectionsError) throw sectionsError;

        assignedSections = sections || [];

        const { data: exams, error: examsError } = await db
            .from("examinations")
            .select("id, exam_name, class_id, total_marks")
            .order("id", { ascending: false });

        if (examsError) throw examsError;

        examinations = exams || [];

        examSelect.innerHTML = '<option value="">Select Examination</option>';

        examinations.forEach(exam => {
            const option = document.createElement("option");
            option.value = exam.id;
            option.textContent = exam.exam_name;
            examSelect.appendChild(option);
        });

        examSelect.addEventListener("change", loadAssignedSubjects);

        loadStudentsBtn.addEventListener("click", loadStudents);

        document.getElementById("teacherName").textContent =
            currentTeacher.teacher_name;

        showMessage("Teacher Results module loaded successfully.", "green");

    } catch (error) {
        console.error(error);
        showMessage("Error: " + error.message, "red");
    }
}

async function loadAssignedSubjects() {
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    resultsTableBody.innerHTML = "";

    const selectedExam = examinations.find(
        exam => String(exam.id) === examSelect.value
    );

    if (!selectedExam) return;

    const classSectionIds = assignedSections
        .filter(section => Number(section.class_id) === Number(selectedExam.class_id))
        .map(section => section.id);

    const subjectIds = [
        ...new Set(
            assignedTimetables
                .filter(item => classSectionIds.includes(item.section_id))
                .map(item => item.subject_id)
        )
    ];

    if (subjectIds.length === 0) {
        showMessage("No assigned subject for this examination class.", "red");
        return;
    }

    const { data: subjects, error } = await db
        .from("subjects")
        .select("id, subject_name")
        .in("id", subjectIds);

    if (error) {
        showMessage("Subject loading error: " + error.message, "red");
        return;
    }

    subjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = subject.id;
        option.textContent = subject.subject_name;
        subjectSelect.appendChild(option);
    });

    showMessage("Select a subject and click Load Students.");
}

async function loadStudents() {
    try {
        resultsTableBody.innerHTML = "";

        const examinationId = examSelect.value;
        const subjectId = subjectSelect.value;

        if (!examinationId || !subjectId) {
            showMessage("Please select examination and subject.", "red");
            return;
        }

        const selectedExam = examinations.find(
            exam => String(exam.id) === examinationId
        );

        currentTotalMarks = Number(selectedExam.total_marks);

        if (!Number.isFinite(currentTotalMarks) || currentTotalMarks <= 0) {
            showMessage("Invalid examination total marks.", "red");
            return;
        }

        const classSectionIds = assignedSections
            .filter(section => Number(section.class_id) === Number(selectedExam.class_id))
            .filter(section =>
                assignedTimetables.some(
                    item =>
                        item.section_id === section.id &&
                        String(item.subject_id) === subjectId
                )
            )
            .map(section => section.id);

        if (classSectionIds.length === 0) {
            showMessage("No assigned section found.", "red");
            return;
        }

        showMessage("Loading students...");

        const { data: enrollments, error: enrollmentError } = await db
            .from("enrollments")
            .select("student_id, section_id")
            .in("section_id", classSectionIds);

        if (enrollmentError) throw enrollmentError;

        const studentIds = [
            ...new Set((enrollments || []).map(item => item.student_id))
        ];

        if (studentIds.length === 0) {
            showMessage("No students found in assigned sections.", "red");
            return;
        }

        const { data: students, error: studentsError } = await db
            .from("students")
            .select("id, student_name, admission_number")
            .in("id", studentIds)
            .order("student_name");

        if (studentsError) throw studentsError;

        const { data: existingMarks, error: marksError } = await db
            .from("marks")
            .select("id, student_id, marks_obtained, remarks")
            .eq("examination_id", examinationId)
            .eq("subject_id", subjectId)
            .in("student_id", studentIds);

        if (marksError) throw marksError;

        currentStudents = students || [];

        if (currentStudents.length === 0) {
            showMessage("No student records found.", "red");
            return;
        }

        currentStudents.forEach(student => {
            const existing = existingMarks.find(
                mark => mark.student_id === student.id
            );

            const tr = document.createElement("tr");

            const nameCell = document.createElement("td");
            nameCell.textContent = student.student_name;

            const marksCell = document.createElement("td");
            const marksInput = document.createElement("input");
            marksInput.type = "number";
            marksInput.min = "0";
            marksInput.max = String(currentTotalMarks);
            marksInput.step = "0.01";
            marksInput.placeholder = "Enter marks";
            marksInput.value = existing?.marks_obtained ?? "";
            marksCell.appendChild(marksInput);

            const remarksCell = document.createElement("td");
            const remarksInput = document.createElement("input");
            remarksInput.type = "text";
            remarksInput.placeholder = "Remarks";
            remarksInput.value = existing?.remarks || "";
            remarksCell.appendChild(remarksInput);

            const actionCell = document.createElement("td");
            const saveButton = document.createElement("button");
            saveButton.type = "button";
            saveButton.textContent = "Save";
            actionCell.appendChild(saveButton);

            saveButton.addEventListener("click", async () => {
                await saveStudentMarks(
                    student.id,
                    existing?.id,
                    marksInput.value,
                    remarksInput.value,
                    saveButton
                );
            });

            tr.append(nameCell, marksCell, remarksCell, actionCell);
            resultsTableBody.appendChild(tr);
        });

        showMessage(
            `${currentStudents.length} students loaded. Maximum marks: ${currentTotalMarks}`,
            "green"
        );

    } catch (error) {
        console.error(error);
        showMessage("Error: " + error.message, "red");
    }
}

async function saveStudentMarks(
    studentId,
    existingMarkId,
    marksValue,
    remarksValue,
    button
) {
    try {
        if (marksValue.trim() === "") {
            showMessage("Please enter marks.", "red");
            return;
        }

        const marksObtained = Number(marksValue);

        if (
            !Number.isFinite(marksObtained) ||
            marksObtained < 0 ||
            marksObtained > currentTotalMarks
        ) {
            showMessage(
                `Marks must be between 0 and ${currentTotalMarks}.`,
                "red"
            );
            return;
        }

        button.disabled = true;
        button.textContent = "Saving...";

        const markData = {
            examination_id: Number(examSelect.value),
            student_id: studentId,
            subject_id: Number(subjectSelect.value),
            marks_obtained: marksObtained,
            remarks: remarksValue.trim() || null
        };

        let result;

        if (existingMarkId) {
            result = await db
                .from("marks")
                .update(markData)
                .eq("id", existingMarkId);
        } else {
            result = await db
                .from("marks")
                .insert([markData]);
        }

        if (result.error) throw result.error;

        button.textContent = "Saved";
        showMessage("Student marks saved successfully!", "green");

        // Reload to show the saved record as existing.
        await loadStudents();

    } catch (error) {
        console.error(error);
        button.disabled = false;
        button.textContent = "Save";
        showMessage("Save failed: " + error.message, "red");
    }
}

initializeResults();
