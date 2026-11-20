

const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const teacherForm = document.getElementById("teacherForm");
const teacherTableBody = document.getElementById("teacherTableBody");
const formMessage = document.getElementById("formMessage");
const saveTeacherBtn = document.getElementById("saveTeacherBtn");

const teacherPhotoInput = document.getElementById("teacherPhoto");
const teacherPhotoPreview = document.getElementById("teacherPhotoPreview");
const teacherPhotoPreviewContainer = document.getElementById("teacherPhotoPreviewContainer");

let uploadedTeacherPhotoPath = null;

// ADMIN LOGIN CHECK
async function checkAdmin() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
        window.location.href = "index.html";
        return false;
    }

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", data.session.user.id)
            .single();

    if (profileError || !profile || profile.role !== "admin") {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
        return false;
    }

    return true;
}

// SAFE HTML ESCAPING
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// PHOTO PREVIEW
teacherPhotoInput.addEventListener("change", function () {
    const file = this.files[0];

    if (!file) {
        teacherPhotoPreviewContainer.style.display = "none";
        teacherPhotoPreview.src = "";
        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        alert("Only JPG, PNG and WEBP photos are allowed.");
        this.value = "";
        teacherPhotoPreviewContainer.style.display = "none";
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        alert("Photo size must be less than 2 MB.");
        this.value = "";
        teacherPhotoPreviewContainer.style.display = "none";
        return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
        teacherPhotoPreview.src = event.target.result;
        teacherPhotoPreviewContainer.style.display = "block";
    };

    reader.readAsDataURL(file);
});

// UPLOAD TEACHER PHOTO
async function uploadTeacherPhoto(file, employeeId) {
    const extension = file.name.split(".").pop().toLowerCase();

    const filePath =
        `teachers/${employeeId}/${crypto.randomUUID()}.${extension}`;

    const { data, error } = await supabaseClient.storage
        .from("profile-photos")
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (error) throw error;

    return data.path;
}

// GET PRIVATE PHOTO URL
async function getTeacherPhotoURL(photoPath) {
    if (!photoPath) return null;

    const { data, error } = await supabaseClient.storage
        .from("profile-photos")
        .createSignedUrl(photoPath, 3600);

    if (error) {
        console.error("Teacher photo URL error:", error);
        return null;
    }

    return data?.signedUrl || null;
}

// LOAD TEACHERS
async function loadTeachers() {
    teacherTableBody.innerHTML =
        `<tr><td colspan="10">Loading teachers...</td></tr>`;

    const { data: teachers, error } = await supabaseClient
        .from("teachers")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.error("Teacher loading error:", error);
        teacherTableBody.innerHTML =
            `<tr><td colspan="10">Unable to load teachers: ${escapeHTML(error.message)}</td></tr>`;
        return;
    }

    if (!teachers || teachers.length === 0) {
        teacherTableBody.innerHTML =
            `<tr><td colspan="10">No teachers found.</td></tr>`;
        return;
    }

    teacherTableBody.innerHTML = "";

    for (const teacher of teachers) {
        const row = document.createElement("tr");

        // PHOTO CELL
        const photoCell = document.createElement("td");

        if (teacher.photo_url) {
            const photoURL = await getTeacherPhotoURL(teacher.photo_url);

            if (photoURL) {
                const img = document.createElement("img");

                img.src = photoURL;
                img.alt = "Teacher Photo";
                img.className = "teacher-record-photo";

                photoCell.appendChild(img);
            } else {
                photoCell.innerHTML =
                    `<span class="teacher-no-photo">Unavailable</span>`;
            }
        } else {
            photoCell.innerHTML =
                `<span class="teacher-no-photo">No Photo</span>`;
        }

        row.appendChild(photoCell);

        const values = [
            teacher.id,
            teacher.teacher_name,
            teacher.employee_id,
            teacher.subject,
            teacher.qualification || "-",
            teacher.phone || "-",
            teacher.email || "-",
            teacher.joining_date || "-"
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        // ACTION BUTTONS
        const actionCell = document.createElement("td");

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.onclick = () => editTeacher(teacher);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = () => deleteTeacher(teacher.id);

        actionCell.append(editBtn, deleteBtn);
        row.appendChild(actionCell);

        teacherTableBody.appendChild(row);
    }
}

// CREDENTIALS POPUP
function showCredentialsPopup(teacher, data) {
    const oldPopup = document.getElementById("teacherCredentialsPopup");

    if (oldPopup) oldPopup.remove();

    const credentialsText =
        "AIMS SCHOOL ERP - TEACHER LOGIN\n\n" +
        "Teacher Name: " + teacher.teacher_name + "\n" +
        "Employee ID: " + teacher.employee_id + "\n" +
        "Subject: " + teacher.subject + "\n" +
        "Qualification: " + (teacher.qualification || "Not provided") + "\n" +
        "Email: " + data.email + "\n" +
        "Temporary Password: " + data.temporary_password + "\n\n" +
        "Please change your password after your first login.";

    const overlay = document.createElement("div");
    overlay.id = "teacherCredentialsPopup";

    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        padding: 15px;
    `;

    const popup = document.createElement("div");

    popup.style.cssText = `
        background: white;
        width: 100%;
        max-width: 430px;
        padding: 25px;
        border-radius: 12px;
        box-shadow: 0 10px 35px rgba(0,0,0,0.25);
        font-family: Arial, sans-serif;
        max-height: 90vh;
        overflow-y: auto;
    `;

    const heading = document.createElement("h2");
    heading.textContent = "Teacher Account Created!";
    heading.style.color = "#15803d";

    const message = document.createElement("p");
    message.textContent =
        "Save these login details securely. The temporary password will not be shown again.";

    const details = document.createElement("pre");
    details.textContent = credentialsText;

    details.style.cssText = `
        background: #f1f5f9;
        padding: 15px;
        border-radius: 8px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-size: 13px;
        line-height: 1.6;
    `;

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy Credentials";

    copyBtn.style.cssText = `
        background: #2563eb;
        color: white;
        border: none;
        padding: 11px 15px;
        border-radius: 6px;
        cursor: pointer;
        margin: 5px;
    `;

    copyBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(credentialsText);
            copyBtn.textContent = "Copied!";
        } catch (error) {
            const textArea = document.createElement("textarea");
            textArea.value = credentialsText;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.select();

            try {
                const copied = document.execCommand("copy");
                copyBtn.textContent = copied ? "Copied!" : "Copy failed";
            } catch (_) {
                copyBtn.textContent = "Copy failed";
            }

            textArea.remove();
        }
    };

    const shareBtn = document.createElement("button");
    shareBtn.textContent = "Share on WhatsApp";

    shareBtn.style.cssText = `
        background: #16a34a;
        color: white;
        border: none;
        padding: 11px 15px;
        border-radius: 6px;
        cursor: pointer;
        margin: 5px;
    `;

    shareBtn.onclick = () => {
        const whatsappURL =
            "https://wa.me/?text=" + encodeURIComponent(credentialsText);

        window.open(whatsappURL, "_blank", "noopener,noreferrer");
    };

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";

    closeBtn.style.cssText = `
        background: #64748b;
        color: white;
        border: none;
        padding: 11px 20px;
        border-radius: 6px;
        cursor: pointer;
        margin: 5px;
    `;

    closeBtn.onclick = () => overlay.remove();

    popup.append(
        heading,
        message,
        details,
        copyBtn,
        shareBtn,
        closeBtn
    );

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

// ADD TEACHER + PHOTO UPLOAD + AUTH ACCOUNT
teacherForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const teacherName =
        document.getElementById("teacherName").value.trim();

    const employeeId =
        document.getElementById("employeeId").value.trim();

    const subject =
        document.getElementById("subject").value.trim();

    const qualification =
        document.getElementById("qualification").value.trim() || null;

    const phone =
        document.getElementById("phone").value.trim() || null;

    const email =
        document.getElementById("email").value.trim().toLowerCase();

    const joiningDate =
        document.getElementById("joiningDate").value || null;

    const photoFile = teacherPhotoInput.files[0];

    if (!teacherName || !employeeId || !subject || !email) {
        formMessage.textContent =
            "Please enter name, employee ID, subject and email.";

        formMessage.style.color = "red";
        return;
    }

    if (!photoFile) {
        formMessage.textContent = "Please select a teacher photo.";
        formMessage.style.color = "red";
        return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(photoFile.type)) {
        formMessage.textContent = "Only JPG, PNG and WEBP photos are allowed.";
        formMessage.style.color = "red";
        return;
    }

    if (photoFile.size > 2 * 1024 * 1024) {
        formMessage.textContent = "Photo size must be less than 2 MB.";
        formMessage.style.color = "red";
        return;
    }

    saveTeacherBtn.disabled = true;
    saveTeacherBtn.textContent = "Uploading Photo...";
    formMessage.textContent = "";

    let photoPath = null;
    let teacherAccountCreated = false;

    try {
        // STEP 1: UPLOAD PHOTO
        photoPath = await uploadTeacherPhoto(photoFile, employeeId);

        uploadedTeacherPhotoPath = photoPath;

        // STEP 2: CREATE TEACHER ACCOUNT
        saveTeacherBtn.textContent = "Creating Teacher Account...";

        const { data, error } =
            await supabaseClient.functions.invoke("create-teacher", {
                body: {
                    teacher_name: teacherName,
                    employee_id: employeeId,
                    subject: subject,
                    qualification: qualification,
                    phone: phone,
                    email: email,
                    joining_date: joiningDate
                }
            });

        if (error) {
            let message = error.message;

            try {
                if (error.context) {
                    const responseBody = await error.context.json();
                    message = responseBody.error || message;
                }
            } catch (_) {}

            throw new Error(message);
        }

        console.log("Create Teacher Response:", data);

        if (!data || !data.success) {
            throw new Error(
                data?.error || "Teacher account creation failed."
            );
        }

        teacherAccountCreated = true;

        // STEP 3: SAVE PHOTO PATH IN DATABASE
        saveTeacherBtn.textContent = "Saving Teacher Photo...";

        const { data: updatedTeacher, error: photoUpdateError } =
            await supabaseClient
                .from("teachers")
                .update({
                    photo_url: photoPath
                })
                .eq("employee_id", employeeId)
                .select("id")
                .single();

        if (photoUpdateError) {
            throw new Error(
                "Teacher account was created, but photo linking failed: " +
                photoUpdateError.message
            );
        }

        if (!updatedTeacher) {
            throw new Error("Teacher created, but photo could not be linked.");
        }

        const createdTeacher = {
            teacher_name: teacherName,
            employee_id: employeeId,
            subject: subject,
            qualification: qualification
        };

        formMessage.textContent =
            "Teacher account and photo saved successfully!";

        formMessage.style.color = "green";

        showCredentialsPopup(createdTeacher, data);

        teacherForm.reset();

        teacherPhotoPreview.src = "";
        teacherPhotoPreviewContainer.style.display = "none";

        uploadedTeacherPhotoPath = null;

        await loadTeachers();

    } catch (error) {
        console.error("Teacher creation error:", error);

        // Remove uploaded photo only if teacher account was not created.
        if (photoPath && !teacherAccountCreated) {
            const { error: removeError } = await supabaseClient.storage
                .from("profile-photos")
                .remove([photoPath]);

            if (removeError) {
                console.error("Photo cleanup error:", removeError);
            }
        }

        formMessage.textContent = "Error: " + error.message;
        formMessage.style.color = "red";

    } finally {
        saveTeacherBtn.disabled = false;
        saveTeacherBtn.textContent = "Save Teacher";
    }
});

// EDIT TEACHER
async function editTeacher(teacher) {
    const newName = prompt(
        "Teacher Name:",
        teacher.teacher_name
    );

    if (newName === null || !newName.trim()) return;

    const newSubject = prompt(
        "Subject:",
        teacher.subject
    );

    if (newSubject === null || !newSubject.trim()) return;

    const newQualification = prompt(
        "Qualification:",
        teacher.qualification || ""
    );

    if (newQualification === null) return;

    const { error } = await supabaseClient
        .from("teachers")
        .update({
            teacher_name: newName.trim(),
            subject: newSubject.trim(),
            qualification: newQualification.trim() || null
        })
        .eq("id", teacher.id);

    if (error) {
        alert("Update failed: " + error.message);
        return;
    }

    alert("Teacher updated successfully!");

    await loadTeachers();
}

// DELETE TEACHER RECORD
async function deleteTeacher(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this teacher record?"
    );

    if (!confirmed) return;

    const { error } = await supabaseClient
        .from("teachers")
        .delete()
        .eq("id", id);

    if (error) {
        alert("Delete failed: " + error.message);
        return;
    }

    alert(
        "Teacher record deleted. The Auth login account has not been deleted."
    );

    await loadTeachers();
}

// START PAGE
async function startPage() {
    const isAdmin = await checkAdmin();

    if (!isAdmin) return;

    await loadTeachers();
}

startPage();
