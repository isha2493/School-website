(() => {
    "use strict";
    window.__schoolApp = "v3";

    // If anything in this script breaks, show the reason on the page
    // (a red box at the bottom) instead of failing silently.
    let shownFatal = false;
    function showFatal(message) {
        if (shownFatal || !document.body) return;
        shownFatal = true;
        const box = document.createElement("div");
        box.className = "alert";
        box.setAttribute("role", "alert");
        box.style.cssText = "position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:99;max-width:640px;margin:0 auto";
        box.textContent = "Script error: " + message + "  (please send me this message)";
        document.body.appendChild(box);
    }
    window.addEventListener("error", (e) => showFatal(e.message));
    window.addEventListener("unhandledrejection", (e) => showFatal((e.reason && e.reason.message) || String(e.reason)));

    /* ------------------------------------------------------------------
       API addresses (all of these already exist in your Django project)
    ------------------------------------------------------------------ */
    const API = {
        login: "/api/auth/login/",
        register: "/api/auth/teacher/register/",
        studentRegister: "/api/auth/students/register/",
        parentRegister: "/api/auth/parents/register/",
        studentCsv: "/api/students/registerstud",
        students: "/api/students/",
        teachers: "/api/teachers/",
        parents: "/api/parents/",
        classes: "/api/class/",
        join: "/api/class/join/",
        attendance: "/api/class/attendance/",
        assignments: "/api/assignments/assignments/",
        grades: "/api/assignments/grades/",
        submits: "/api/assignments/submits/",
        notices: "/api/notices/",
        profile: "/api/auth/profile/",
        profileUpdate: "/api/auth/profile/update/",
        quizzes: "/api/quiz/quiz/",
        quizQuestions: "/api/quiz/question/",
        quizOptions: "/api/quiz/option/",
        quizGrades: "/api/quiz/grades/",
        quizSubmits: "/api/quiz/submits/",
    };
    const classStudents = (id) => `/api/class/${id}/students/`;
    const classStudent = (id, sid) => `/api/class/${id}/students/${sid}/`;
    const questionsOf = (quizId) => `${API.quizQuestions}?quiz_id=${quizId}`;
    const optionsOf = (questionId) => `${API.quizOptions}?question_id=${questionId}`;
    const submitsOf = (quizId) => `${API.quizSubmits}?quiz_id=${quizId}`;

    const ROLE_LABEL = { student: "Student", teacher: "Teacher", parent: "Parent" };

    const PAGE = document.body.dataset.page;
    const HOME = {
        student: "/student-dashboard/",
        teacher: "/teacher-dashboard/",
        parent: "/parent-dashboard/",
    };

    /* ------------------------------------------------------------------
       Small helpers
    ------------------------------------------------------------------ */
    const $ = (selector, root = document) => root.querySelector(selector);

    // Builds an element: h("div", {class: "x", onclick: fn}, "text", child)
    function h(tag, props = {}, ...kids) {
        const el = document.createElement(tag);
        for (const [key, value] of Object.entries(props || {})) {
            if (value == null || value === false) continue;
            if (key === "class") el.className = value;
            else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
            else if (key in el && key !== "list") el[key] = value;
            else el.setAttribute(key, value);
        }
        kids.flat(Infinity).forEach((kid) => {
            if (kid == null || kid === false) return;
            el.append(kid.nodeType ? kid : document.createTextNode(kid));
        });
        return el;
    }

    const arr = (result) => (result && result.ok && Array.isArray(result.data) ? result.data : []);

    function today() {
        const d = new Date();
        return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }

    function fmtDate(value) {
        const d = new Date(`${value}T00:00:00`);
        return isNaN(d) ? value : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }

    function fmtDateTime(value) {
        const d = new Date(value);
        return isNaN(d) ? value : d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    }

    // "Right now" in the format a date-and-time box wants
    function nowLocal() {
        const d = new Date();
        return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    function toast(message, kind = "") {
        const box = h("div", { class: `toast ${kind}`, role: kind === "bad" ? "alert" : "status" }, message);
        $("#toasts").append(box);
        setTimeout(() => box.remove(), 4200);
    }

    /* ------------------------------------------------------------------
       Session (token is kept in sessionStorage, like your original code)
    ------------------------------------------------------------------ */
    const session = {
        get token() { return sessionStorage.getItem("schoolToken"); },
        get role() { return sessionStorage.getItem("schoolRole"); },
        // The login token carries the person's id inside it.
        get personId() {
            try {
                const part = this.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
                return JSON.parse(atob(part)).person_id;
            } catch (e) {
                return null;
            }
        },
        save(token, role) {
            sessionStorage.setItem("schoolToken", token);
            sessionStorage.setItem("schoolRole", role);
        },
        clear() {
            sessionStorage.removeItem("schoolToken");
            sessionStorage.removeItem("schoolRole");
        },
    };

    function logout() {
        session.clear();
        location.href = "/login/";
    }

    /* ------------------------------------------------------------------
       Talking to the server
       auth:false  -> do not send the token (needed for the students,
                      teachers and parents lists, which use a different
                      default login check in settings.py)
    ------------------------------------------------------------------ */
    function errorText(status, data) {
        if (!data) return status >= 500 ? "The server hit a problem. Please try again." : `Request failed (${status}).`;
        if (typeof data === "string") return data;
        if (data.error) return data.error;
        if (data.detail) return data.detail;
        return Object.entries(data)
            .map(([field, msg]) => `${field.replace(/_/g, " ")}: ${[].concat(msg).join(" ")}`)
            .join("  ");
    }

    async function api(url, { method = "GET", body, form, auth = true } = {}) {
        const headers = {};
        if (body !== undefined) headers["Content-Type"] = "application/json";
        if (auth && session.token) headers.Authorization = `Bearer ${session.token}`;

        let res;
        try {
            res = await fetch(url, {
                method,
                headers,
                // "form" is a FormData (used for photo uploads); the browser
                // sets its own Content-Type for it, so we must not.
                body: form !== undefined ? form : body !== undefined ? JSON.stringify(body) : undefined,
            });
        } catch (e) {
            return { ok: false, status: 0, data: null, error: "Can't reach the server. Check that it is running." };
        }

        let data = null;
        try { data = await res.json(); } catch (e) { /* not JSON */ }

        const detail = data && (data.detail || data.error || "");
        const tokenProblem = res.status === 401 || (res.status === 403 && /token|person not found/i.test(detail));
        if (auth && tokenProblem && PAGE !== "login") {
            session.clear();
            location.href = "/login/?expired=1";
        }

        return { ok: res.ok, status: res.status, data, error: res.ok ? null : errorText(res.status, data) };
    }

    /* ------------------------------------------------------------------
       Shared UI pieces
    ------------------------------------------------------------------ */
    const pageHead = (title, sub, ...actions) =>
        h("header", { class: "page-head" },
            h("div", {}, h("h1", {}, title), sub ? h("p", { class: "sub" }, sub) : null),
            actions.length ? h("div", {}, actions) : null);

    const empty = (title, text, ...actions) =>
        h("div", { class: "empty" }, h("h3", {}, title), text ? h("p", {}, text) : null, ...actions);

    const errorBox = (message) => h("div", { class: "alert", role: "alert" }, message);

    const nameMap = (list) => new Map(list.map((x) => [x.id, x.name]));

    function dialog(title, ...content) {
        const body = h("div", { class: "dlg-body" }, content);
        const dlg = h("dialog", { class: "dlg", "aria-label": title },
            h("div", { class: "dlg-head" },
                h("h2", {}, title),
                h("button", { class: "icon-btn", type: "button", "aria-label": "Close", onclick: () => dlg.close() }, "×")),
            body);
        dlg.addEventListener("close", () => dlg.remove());
        dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
        document.body.append(dlg);
        dlg.showModal();
        return { dlg, body };
    }

    // Runs an async action while the button is disabled
    async function busy(button, action) {
        button.disabled = true;
        try { return await action(); } finally { button.disabled = false; }
    }

    /* ------------------------------------------------------------------
       Pictures on assignments and homework
    ------------------------------------------------------------------ */
    const MAX_PICTURE = 5 * 1024 * 1024;

    // Gives back a problem message, or null when the file is fine (or none was chosen)
    function pictureProblem(file) {
        if (!file) return null;
        if (!file.type.startsWith("image/")) return "Please choose an image file.";
        if (file.size > MAX_PICTURE) return "That picture is over 5 MB. Choose a smaller one.";
        return null;
    }

    // A "choose picture" box with a small preview. Read the choice with .file
    function pictureField(label) {
        const input = h("input", { type: "file", accept: "image/*" });
        const preview = h("div", {});
        input.addEventListener("change", () => {
            const f = input.files[0];
            if (!f) return preview.replaceChildren();
            preview.replaceChildren(h("img", {
                class: "thumb", src: URL.createObjectURL(f), alt: "Preview of the chosen picture",
                style: "max-width:100%;max-height:160px;object-fit:contain",
            }));
        });
        return {
            input,
            node: h("label", { class: "field" }, label, input, preview),
            get file() { return input.files[0] || null; },
        };
    }

    // Sends plain JSON when there is no picture, or a form (so the file can travel) when there is
    function sendWithPicture(url, fields, pictureKey, file) {
        if (!file) return api(url, { method: "POST", body: fields });
        const fd = new FormData();
        Object.entries(fields).forEach(([key, value]) => fd.append(key, value));
        fd.append(pictureKey, file);
        return api(url, { method: "POST", form: fd });
    }

    // A small picture. Click it to see it full size
    function thumb(url, title) {
        return h("img", {
            class: "thumb clickable", src: url, alt: title, title: "Click to enlarge",
            width: 96, height: 96, style: "width:96px;height:96px;object-fit:cover",
            onclick: () => dialog(title, h("img", {
                src: url, alt: title,
                style: "display:block;max-width:100%;max-height:70vh;margin:0 auto;object-fit:contain",
            })),
        });
    }

    function classCard(c, teachers, ...actions) {
        return h("article", { class: "card" },
            h("h3", {}, c.name),
            h("p", { class: "muted" }, `Taught by ${teachers.get(c.teacher) || "a teacher"}`),
            h("div", { class: "chips" },
                c.grade_level ? h("span", { class: "chip" }, `Grade ${c.grade_level}`) : null,
                h("span", { class: "chip" }, `${c.students.length} ${c.students.length === 1 ? "student" : "students"}`)),
            h("div", { class: "actions" }, actions));
    }

    /* ------------------------------------------------------------------
       Quiz helpers (used by students and teachers)
    ------------------------------------------------------------------ */
    const isClosed = (quiz) => new Date(quiz.due_date) < new Date();
    const marksText = (n) => `${n} ${n === 1 ? "mark" : "marks"}`;

    // Adds up one student's marks for the questions of one quiz
    function quizScore(questions, grades) {
        const given = new Map(grades.map((g) => [g.question, g.grade]));
        const marked = questions.filter((q) => given.has(q.id));
        return {
            given,
            total: questions.reduce((sum, q) => sum + q.marks, 0),
            got: marked.reduce((sum, q) => sum + given.get(q.id), 0),
            marked: marked.length,
            all: questions.length > 0 && marked.length === questions.length,
        };
    }

    /* ------------------------------------------------------------------
       Profile picture + profile page (same for every role)
    ------------------------------------------------------------------ */
    // Shows the photo if there is one, otherwise a circle with initials
    function avatar(profile, name, size = "") {
        const url = profile && profile.profile_picture;
        // width/height are set here too, so the picture stays small even if the stylesheet is old or cached
        const px = size === "lg" ? 120 : 44;
        if (url) return h("img", { class: `avatar ${size}`, src: url, width: px, height: px, alt: `${name}'s photo` });
        const initials = (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
        return h("div", { class: `avatar ${size}`, "aria-hidden": "true" }, initials);
    }

    function profileView(role) {
        return {
            label: "My profile",
            async render(box, ctx) {
                box.append(pageHead("My profile", "Your details and your photo."));

                const me = ctx.me;
                const facts = [["Email", (ctx.profile && ctx.profile.email) || me.email]];

                if (role === "student") {
                    facts.push(["Class", me.student_class], ["Roll number", me.roll_no]);
                }
                if (role === "parent") {
                    let childText = "Not linked yet";
                    if (me.child) {
                        const s = await api(API.students, { auth: false });
                        const kid = arr(s).find((x) => x.id === me.child);
                        if (kid) childText = `${kid.name} (class ${kid.student_class}, roll ${kid.roll_no})`;
                    }
                    facts.push(["Your child", childText]);
                }

                // ----- top card: banner, big photo, name, role -----
                const picture = h("div", { class: "pic-slot" }, avatar(ctx.profile, me.name, "lg"));
                box.append(h("section", { class: "profile-hero" },
                    h("div", { class: "hero-band" }),
                    h("div", { class: "hero-body" },
                        picture,
                        h("div", { class: "hero-text" },
                            h("h2", {}, me.name),
                            h("div", {}, h("span", { class: "chip" }, ROLE_LABEL[role]))))));

                // ----- details as small tiles -----
                box.append(h("dl", { class: "facts" }, facts.map(([label, value]) =>
                    h("div", { class: "fact" },
                        h("dt", {}, label),
                        h("dd", {}, value == null || value === "" ? "-" : String(value))))));

                // ----- change photo -----
                const file = h("input", { type: "file", accept: "image/*", class: "sr-only" });
                const fileName = h("span", { class: "file-name" }, "No file chosen");
                const save = h("button", { class: "btn", type: "submit", disabled: true }, "Save photo");

                file.addEventListener("change", () => {
                    const f = file.files[0];
                    save.disabled = !f;
                    fileName.textContent = f ? f.name : "No file chosen";
                    if (!f) return;
                    // show a preview before saving
                    picture.replaceChildren(h("img", { class: "avatar lg", src: URL.createObjectURL(f), width: 120, height: 120, alt: "Preview of your new photo" }));
                });

                box.append(h("form", {
                    class: "panel upload",
                    onsubmit: (e) => {
                        e.preventDefault();
                        const f = file.files[0];
                        if (!f) return toast("Choose a picture first.", "bad");
                        if (!f.type.startsWith("image/")) return toast("Please choose an image file.", "bad");
                        if (f.size > 5 * 1024 * 1024) return toast("That picture is over 5 MB. Choose a smaller one.", "bad");

                        busy(save, async () => {
                            const fd = new FormData();
                            fd.append("profile_picture", f);
                            const r = await api(API.profileUpdate, { method: "PATCH", form: fd });
                            if (!r.ok) return toast(r.error, "bad");
                            ctx.profile = Object.assign({}, ctx.profile, { profile_picture: r.data.profile_picture });
                            ctx.paintWho();      // update the picture in the sidebar
                            toast("Photo updated");
                            ctx.refresh();
                        });
                    },
                },
                    h("div", {},
                        h("h2", {}, ctx.profile && ctx.profile.profile_picture ? "Change your photo" : "Add a photo"),
                        h("p", { class: "muted" }, "JPG or PNG, up to 5 MB. A square picture looks best.")),
                    h("div", { class: "upload-actions" },
                        h("label", { class: "file-pick" }, file, h("span", { class: "btn ghost" }, "Choose picture")),
                        fileName,
                        save)));
            },
        };
    }

    /* ------------------------------------------------------------------
       Notices (everyone can read, teachers can post)
    ------------------------------------------------------------------ */
    function noticesView(canPost) {
        return {
            label: "Notices",
            async render(box, ctx) {
                box.append(pageHead("Notices", "Announcements from your school."));

                if (canPost) {
                    const title = h("input", { type: "text", required: true, maxLength: 200 });
                    const message = h("textarea", { required: true });
                    const send = h("button", { class: "btn", type: "submit" }, "Publish notice");
                    box.append(h("form", {
                        class: "panel stack",
                        onsubmit: (e) => {
                            e.preventDefault();
                            busy(send, async () => {
                                const r = await api(API.notices, { method: "POST", body: { title: title.value.trim(), message: message.value.trim() } });
                                if (!r.ok) return toast(r.error, "bad");
                                toast("Notice published");
                                ctx.refresh();
                            });
                        },
                    },
                        h("h2", {}, "Post a notice"),
                        h("label", { class: "field" }, "Title", title),
                        h("label", { class: "field" }, "Message", message),
                        h("div", {}, send)));
                }

                const r = await api(API.notices);
                if (!r.ok) return box.append(errorBox(r.error));
                if (!r.data.length) return box.append(empty("No notices yet", "New announcements will appear here."));
                box.append(h("div", { class: "grid", style: "grid-template-columns:1fr" }, r.data.map((n) =>
                    h("article", { class: "card notice" },
                        h("h3", {}, n.title),
                        h("small", {}, new Date(n.created_at).toLocaleString()),
                        h("p", {}, n.message)))));
            },
        };
    }

    /* ------------------------------------------------------------------
       STUDENT views
    ------------------------------------------------------------------ */
    const studentViews = {
        available: {
            label: "Available classes",
            async render(box, ctx) {
                const [cls, tch] = await Promise.all([api(API.classes), api(API.teachers, { auth: false })]);
                box.append(pageHead("Available classes", "Classes for your grade that you haven't joined yet."));
                if (!cls.ok) return box.append(errorBox(cls.error));

                const names = nameMap(arr(tch));
                const open = cls.data.filter((c) => !c.students.includes(ctx.me.id));
                if (!open.length) return box.append(empty("No classes to join right now", "When a teacher adds a new class, it will show up here."));

                box.append(h("div", { class: "grid" }, open.map((c) => {
                    const btn = h("button", { class: "btn", type: "button" }, "Join class");
                    btn.addEventListener("click", () => busy(btn, async () => {
                        const r = await api(API.join, { method: "POST", body: { class_id: c.id } });
                        if (!r.ok) return toast(r.error, "bad");
                        toast(`You joined ${c.name}`);
                        ctx.refresh();
                    }));
                    return classCard(c, names, btn);
                })));
            },
        },

        joined: {
            label: "My classes",
            async render(box, ctx) {
                const [cls, tch] = await Promise.all([api(API.classes), api(API.teachers, { auth: false })]);
                box.append(pageHead("My classes", "The classes you've joined."));
                if (!cls.ok) return box.append(errorBox(cls.error));

                const names = nameMap(arr(tch));
                const mine = cls.data.filter((c) => c.students.includes(ctx.me.id));
                if (!mine.length) {
                    return box.append(empty("You haven't joined any classes yet", "Browse the available classes and join one.",
                        h("a", { class: "btn", href: "#available" }, "See available classes")));
                }
                box.append(h("div", { class: "grid" }, mine.map((c) => classCard(c, names))));
            },
        },

        assignments: {
            label: "Assignments",
            async render(box, ctx) {
                const [a, g, subs] = await Promise.all([api(API.assignments), api(API.grades), api(API.submits)]);
                box.append(pageHead("Assignments", "Homework for the classes you've joined."));
                if (!a.ok) return box.append(errorBox(a.error));
                if (!a.data.length) return box.append(empty("No assignments available", "New homework will show up here."));

                const scores = new Map(arr(g).filter((x) => x.student === ctx.me.id).map((x) => [x.assignment, x.grade]));
                const submitted = new Set(arr(subs).map((x) => x.assignment));
                const sorted = [...a.data].sort((x, y) => x.due_date.localeCompare(y.due_date));

                box.append(h("div", { class: "list" }, sorted.map((as) => {
                    const graded = scores.has(as.id);
                    const info = h("div", { class: "side-info" });
                    const late = as.due_date < today();

                    if (graded) {
                        info.append(h("span", { class: "stamp", title: "Your grade" }, scores.get(as.id)));
                    } else if (submitted.has(as.id)) {
                        info.append(h("span", { class: "chip ok" }, "Submitted"));
                    } else {
                        info.append(h("button", {
                            class: "btn sm", type: "button",
                            onclick: () => openSubmit(as, ctx),
                        }, "Submit homework"));
                    }

                    return h("div", { class: "item" },
                        h("div", {},
                            h("h3", {}, as.title),
                            h("p", {}, as.description),
                            as.assignment_picture ? thumb(as.assignment_picture, `${as.title}: picture`) : null,
                            h("div", { class: "chips" },
                                as.class_name ? h("span", { class: "chip" }, as.class_name) : null,
                                h("span", { class: `chip ${late && !graded ? "late" : ""}` }, `Due ${fmtDate(as.due_date)}`))),
                        info);
                })));
            },
        },

        quizzes: {
            label: "Quizzes",
            async render(box, ctx) {
                box.append(pageHead("Quizzes", "Quizzes for the classes you've joined."));
                const [qz, g] = await Promise.all([api(API.quizzes), api(API.quizGrades)]);
                if (!qz.ok) return box.append(errorBox(qz.error));
                if (!qz.data.length) {
                    return box.append(empty("No quizzes available", "When a teacher sets a quiz for your class, it will show up here."));
                }

                const grades = arr(g);
                // Load the questions of every quiz so each one can show its score
                const sets = await Promise.all(qz.data.map((x) => api(questionsOf(x.id))));
                const sorted = qz.data
                    .map((quiz, i) => ({ quiz, questions: arr(sets[i]) }))
                    .sort((a, b) => new Date(a.quiz.due_date) - new Date(b.quiz.due_date));

                box.append(h("div", { class: "list" }, sorted.map(({ quiz, questions }) => {
                    const closed = isClosed(quiz);
                    const score = quizScore(questions, grades);
                    const info = h("div", { class: "side-info" });

                    if (score.marked) {
                        info.append(h("span", { class: "chip ok", title: "Your score" },
                            score.all ? `Score ${score.got} / ${score.total}` : `Score so far ${score.got} / ${score.total}`));
                    }
                    info.append(h("button", {
                        class: `btn sm ${closed ? "ghost" : ""}`, type: "button",
                        onclick: () => openQuiz(quiz, ctx),
                    }, closed ? "View quiz" : "Take quiz"));

                    return h("div", { class: "item" },
                        h("div", {},
                            h("h3", {}, quiz.title),
                            quiz.description ? h("p", {}, quiz.description) : null,
                            h("div", { class: "chips" },
                                quiz.class_name ? h("span", { class: "chip" }, quiz.class_name) : null,
                                h("span", { class: "chip" }, `${questions.length} ${questions.length === 1 ? "question" : "questions"}`),
                                h("span", { class: `chip ${closed ? "late" : ""}` }, `${closed ? "Closed" : "Due"} ${fmtDateTime(quiz.due_date)}`))),
                        info);
                })));
            },
        },

        notices: noticesView(false),
        profile: profileView("student"),        notices: noticesView(false),
        profile: profileView("student"),
    };

    function openSubmit(assignment, ctx) {
        const text = h("textarea", { required: true, placeholder: "Write your answer here" });
        const picture = pictureField("Add a picture of your work (optional)");
        const send = h("button", { class: "btn", type: "submit" }, "Submit homework");
        const { dlg } = dialog(`Submit: ${assignment.title}`,
            h("form", {
                class: "stack",
                onsubmit: (e) => {
                    e.preventDefault();
                    const problem = pictureProblem(picture.file);
                    if (problem) return toast(problem, "bad");
                    busy(send, async () => {
                        const r = await sendWithPicture(
                            API.submits,
                            { assignment: assignment.id, homework: text.value.trim() },
                            "homework_picture",
                            picture.file);
                        if (!r.ok) return toast(r.error, "bad");
                        toast("Homework submitted");
                        dlg.close();
                        ctx.refresh();
                    });
                },
            },
                h("p", { class: "muted" }, assignment.description),
                assignment.assignment_picture ? thumb(assignment.assignment_picture, `${assignment.title}: picture`) : null,
                h("label", { class: "field" }, "Your homework", text),
                picture.node,
                h("div", {}, send)));
    }

    // The window where a student answers a quiz
    function openQuiz(quiz, ctx) {
        const body = h("div", {}, "Loading…");
        const { dlg } = dialog(quiz.title, body);
        const closed = isClosed(quiz);

        (async () => {
            const [qs, gr, sb] = await Promise.all([api(questionsOf(quiz.id)), api(API.quizGrades), api(submitsOf(quiz.id))]);
            if (!qs.ok) return body.replaceChildren(errorBox(qs.error));
            if (!qs.data.length) {
                return body.replaceChildren(empty("No questions yet", "Your teacher hasn't added questions to this quiz."));
            }

            const optionSets = await Promise.all(qs.data.map((q) => api(optionsOf(q.id))));
            const failed = optionSets.find((r) => !r.ok);
            if (failed) return body.replaceChildren(errorBox(failed.error));

            const given = quizScore(qs.data, arr(gr)).given;
            // What this student already answered (so the choices are ticked again)
            const before = new Map(arr(sb).map((x) => [x.question, x.selected_options]));
            const names = qs.data.map((q) => `quiz-${quiz.id}-question-${q.id}`);

            const blocks = qs.data.map((q, i) => {
                const marked = given.has(q.id);
                const answered = before.has(q.id);
                return h("div", { class: "q-block", role: "group", "aria-label": `Question ${i + 1}` },
                    h("div", { class: "q-head" },
                        h("h3", {}, `${i + 1}. ${q.question_text}`),
                        h("span", { class: marked ? "chip ok" : "chip" },
                            marked ? `${given.get(q.id)} / ${q.marks}` : marksText(q.marks))),
                    q.question_picture ? thumb(q.question_picture, `Question ${i + 1}: picture`) : null,
                    h("div", { class: "opts" }, optionSets[i].data.map((o) =>
                        h("label", { class: "opt" },
                            h("input", { type: "checkbox", name: names[i], value: o.id, disabled: closed || answered, checked: answered && before.get(q.id).includes(o.id) }),
                            h("span", {}, o.option_text)))));
            });

            const send = h("button", { class: "btn", type: "submit" }, "Submit answers");
            const form = h("form", {
                class: "stack",
                onsubmit: (e) => {
                    e.preventDefault();
                    // Only the questions that were not answered before
                    const chosen = qs.data.map((q, i) => {
                        if (before.has(q.id)) return null;
                        const picked = [...form.querySelectorAll(`input[name="${names[i]}"]:checked`)];
                        return picked.length ? { question: q.id, selected_options: picked.map((p) => Number(p.value)) } : null;
                    }).filter(Boolean);

                    if (!chosen.length) return toast("Pick at least one answer first.", "bad");
                    const left = qs.data.length - before.size;
                    if (chosen.length < left &&
                        !confirm(`You answered ${chosen.length} of ${left} open questions. The others can't be answered later. Submit anyway?`)) return;

                    busy(send, async () => {
                        // One at a time, so we stop at the first problem (for example a closed quiz)
                        let got = 0;
                        let outOf = 0;
                        for (const answer of chosen) {
                            const r = await api(API.quizSubmits, { method: "POST", body: answer });
                            if (!r.ok) return toast(r.error, "bad");
                            got += r.data.marks_obtained;
                            outOf += r.data.total_marks;
                        }
                        toast(`${chosen.length} ${chosen.length === 1 ? "answer" : "answers"} checked: you got ${got} / ${outOf}`);
                        dlg.close();
                        ctx.refresh();
                    });
                },
            },
                closed
                    ? h("div", { class: "alert", role: "status" }, "This quiz has closed, so answers can no longer be sent.")
                    : h("p", { class: "muted" },
                        `Due ${fmtDateTime(quiz.due_date)}. Some questions have more than one correct answer, so tick every answer you think is right. You only get the marks if you tick exactly the correct ones. Answers are checked automatically and cannot be changed after you submit.`,
                        before.size ? ` You have already answered ${before.size} of ${qs.data.length}.` : ""),
                blocks,
                closed || before.size === qs.data.length ? null : h("div", {}, send));

            body.replaceChildren(form);
        })();
    }

    /* ------------------------------------------------------------------
       PARENT views
    ------------------------------------------------------------------ */
    const parentViews = {
        grades: {
            label: "Grades",
            async render(box, ctx) {
                box.append(pageHead("Grades", "Your child's graded assignments."));
                if (!ctx.me.child) {
                    return box.append(empty("No child is linked to this account", "Ask the school office to link your child's student record."));
                }

                const [s, g, a] = await Promise.all([api(API.students, { auth: false }), api(API.grades), api(API.assignments)]);
                if (!g.ok) return box.append(errorBox(g.error));

                const kid = arr(s).find((x) => x.id === ctx.me.child);
                if (kid) {
                    box.append(h("div", { class: "profile" },
                        h("div", {}, h("small", {}, "Child"), h("strong", {}, kid.name)),
                        h("div", {}, h("small", {}, "Grade"), h("strong", {}, kid.student_class)),
                        h("div", {}, h("small", {}, "Roll number"), h("strong", {}, kid.roll_no))));
                }

                const titles = new Map(arr(a).map((x) => [x.id, x]));
                const rows = g.data.filter((x) => x.student === ctx.me.child);
                if (!rows.length) return box.append(empty("No graded assignments.", "Grades will appear here once a teacher marks the work."));

                box.append(h("div", { class: "list" }, rows.map((row) => {
                    const as = titles.get(row.assignment);
                    return h("div", { class: "item" },
                        h("div", {},
                            h("h3", {}, as ? as.title : `Assignment ${row.assignment}`),
                            as ? h("p", {}, `Due ${fmtDate(as.due_date)}`) : null),
                        h("div", { class: "side-info" }, h("span", { class: "stamp", title: "Grade" }, row.grade)));
                })));
            },
        },
        notices: noticesView(false),
        profile: profileView("parent"),
    };

    /* ------------------------------------------------------------------
       TEACHER views
    ------------------------------------------------------------------ */
    function openRoster(c, ctx) {
        const body = h("div", {}, "Loading…");
        const date = h("input", { type: "date", value: today(), "aria-label": "Attendance date" });
        dialog(`${c.name}: students`, body);

        async function mark(student, present, buttons) {
            const label = present ? "present" : "absent";
            buttons.forEach((b) => (b.disabled = true));
            // "student" and "class_obj" are included because the attendance
            // serializer requires them in the request body.
            const r = await api(API.attendance, {
                method: "POST",
                body: {
                    class_id: c.id, student_id: student.id,
                    class_obj: c.id, student: student.id,
                    date: date.value, present,
                },
            });
            buttons.forEach((b) => (b.disabled = false));
            if (r.ok) toast(`${student.name} marked ${label} for ${fmtDate(date.value)}`);
            else toast(r.error, "bad");
        }

        async function load() {
            const r = await api(classStudents(c.id));
            if (!r.ok) return body.replaceChildren(errorBox(r.error));
            if (!r.data.length) {
                return body.replaceChildren(empty("No students yet", "Students appear here after they join this class."));
            }

            const rows = r.data.map((s) => {
                const present = h("button", { class: "btn sm ghost", type: "button" }, "Present");
                const absent = h("button", { class: "btn sm ghost", type: "button" }, "Absent");
                const remove = h("button", { class: "btn sm danger", type: "button" }, "Remove");
                present.addEventListener("click", () => mark(s, true, [present, absent]));
                absent.addEventListener("click", () => mark(s, false, [present, absent]));
                remove.addEventListener("click", () => busy(remove, async () => {
                    if (!confirm(`Remove ${s.name} from ${c.name}?`)) return;
                    const d = await api(classStudent(c.id, s.id), { method: "DELETE" });
                    if (!d.ok) return toast(d.error, "bad");
                    toast(`${s.name} removed`);
                    load();
                    ctx.refresh();
                }));
                return h("tr", {},
                    h("td", {}, s.name),
                    h("td", {}, s.roll_no),
                    h("td", {}, h("div", { class: "row-actions" }, present, absent, remove)));
            });

            body.replaceChildren(
                h("label", { class: "field inline" }, "Attendance date", date),
                h("table", { class: "tbl" },
                    h("thead", {}, h("tr", {}, h("th", {}, "Name"), h("th", {}, "Roll"), h("th", {}, ""))),
                    h("tbody", {}, rows)));
        }
        load();
    }

    // Upload many students at once from a CSV file
    function csvPanel() {
        const file = h("input", { type: "file", accept: ".csv,text/csv" });
        const send = h("button", { class: "btn", type: "submit" }, "Upload CSV");
        const result = h("div", { class: "stack" });

        function downloadSample() {
            const text = "username,email,password,role,roll_no,student_class\n" +
                "Asha Rai,asha@example.com,Temp1234,student,14,8\n";
            const link = h("a", {
                href: URL.createObjectURL(new Blob([text], { type: "text/csv" })),
                download: "students_sample.csv",
            });
            document.body.append(link);
            link.click();
            link.remove();
        }

        return h("form", {
            class: "panel stack",
            onsubmit: (e) => {
                e.preventDefault();
                const f = file.files[0];
                if (!f) return toast("Choose a CSV file first.", "bad");
                if (!/\.csv$/i.test(f.name)) return toast("Please choose a .csv file.", "bad");

                busy(send, async () => {
                    const fd = new FormData();
                    fd.append("file", f);
                    const r = await api(API.studentCsv, { method: "POST", form: fd });
                    if (!r.ok) return toast(r.error, "bad");

                    const count = r.data.registered || 0;
                    const errors = r.data.errors || [];
                    result.replaceChildren(
                        h("div", { class: count ? "alert ok" : "alert", role: "status" },
                            `${count} ${count === 1 ? "student" : "students"} registered.`),
                        errors.length
                            ? h("div", { class: "alert", role: "alert" },
                                h("strong", {}, `${errors.length} ${errors.length === 1 ? "row was" : "rows were"} skipped:`),
                                h("ul", {}, errors.map((msg) => h("li", {}, msg))))
                            : null);
                    toast(count ? "CSV processed" : "No students were registered", count ? "" : "bad");
                    file.value = "";
                });
            },
        },
            h("h2", {}, "Register many students (CSV)"),
            h("p", { class: "muted" }, "Upload one file to create several student accounts. Every student gets the role Student automatically."),
            h("p", { class: "hint" }, "Columns needed, in any order: username, email, password, role, roll_no, student_class. The role column must say student, and roll_no and student_class must be numbers."),
            h("label", { class: "field" }, "CSV file", file),
            h("div", { class: "row-actions", style: "display:flex;gap:.6rem;flex-wrap:wrap" },
                send,
                h("button", { class: "btn ghost", type: "button", onclick: downloadSample }, "Download sample CSV")),
            result);
    }

    // Shows one quiz's questions and lets the teacher add more
    function openQuestions(quiz, ctx) {
        const body = h("div", { class: "stack" }, "Loading…");
        dialog(`${quiz.title}: questions`, body);

        function addForm() {
            const text = h("textarea", { required: true, placeholder: "Type the question" });
            const marks = h("input", { type: "number", required: true, min: "1", step: "1", value: "1" });
            const picture = pictureField("Picture (optional)");
            const rows = [];
            const optionBox = h("div", { class: "stack" });
            const submit = h("button", { class: "btn", type: "submit" }, "Add question");

            function addRow() {
                const n = rows.length + 1;
                const tick = h("input", { type: "checkbox", "aria-label": `Option ${n} is a correct answer` });
                const input = h("input", { type: "text", maxLength: 200, placeholder: `Option ${n}`, "aria-label": `Option ${n} text` });
                rows.push({ tick, input });
                optionBox.append(h("div", { class: "option-row" }, tick, input));
            }
            for (let i = 0; i < 4; i++) addRow();

            const more = h("button", {
                class: "btn sm ghost", type: "button",
                onclick: () => { addRow(); if (rows.length >= 6) more.hidden = true; },
            }, "Add another option");

            return h("form", {
                class: "panel stack",
                style: "margin:0",
                onsubmit: (e) => {
                    e.preventDefault();
                    const problem = pictureProblem(picture.file);
                    if (problem) return toast(problem, "bad");

                    const filled = rows.filter((r) => r.input.value.trim());
                    if (filled.length < 2) return toast("Give at least two options.", "bad");
                    if (!filled.some((r) => r.tick.checked)) {
                        return toast("Tick at least one correct answer (and type its text).", "bad");
                    }

                    busy(submit, async () => {
                        const q = await sendWithPicture(
                            API.quizQuestions,
                            { quiz: quiz.id, question_text: text.value.trim(), marks: Number(marks.value) },
                            "question_picture",
                            picture.file);
                        if (!q.ok) return toast(q.error, "bad");

                        for (const row of filled) {
                            const o = await api(API.quizOptions, {
                                method: "POST",
                                body: { question: q.data.id, option_text: row.input.value.trim(), is_correct: row.tick.checked },
                            });
                            if (!o.ok) {
                                toast(`The question was saved, but an option failed: ${o.error}`, "bad");
                                return load();
                            }
                        }
                        toast("Question added");
                        load();
                    });
                },
            },
                h("h2", {}, "Add a question"),
                h("label", { class: "field" }, "Question", text),
                h("label", { class: "field", style: "max-width:200px" }, "Marks", marks),
                picture.node,
                h("div", { class: "stack" },
                    h("strong", {}, "Answer options"),
                    h("p", { class: "hint" }, "Type the choices and tick every correct one (you can tick more than one). Students will not see which are ticked. Their answers are checked automatically, and they get the marks only if they tick exactly the correct options."),
                    optionBox,
                    h("div", {}, more)),
                h("div", {}, submit));
        }

        async function load() {
            const qs = await api(questionsOf(quiz.id));
            if (!qs.ok) return body.replaceChildren(errorBox(qs.error));
            const optionSets = await Promise.all(qs.data.map((q) => api(optionsOf(q.id))));

            const existing = qs.data.length
                ? qs.data.map((q, i) => h("article", { class: "q-block" },
                    h("div", { class: "q-head" },
                        h("h3", {}, `${i + 1}. ${q.question_text}`),
                        h("span", { class: "chip" }, marksText(q.marks))),
                    q.question_picture ? thumb(q.question_picture, `Question ${i + 1}: picture`) : null,
                    h("ul", { class: "opt-list" }, arr(optionSets[i]).map((o) =>
                        h("li", { class: o.is_correct ? "right" : "" },
                            o.is_correct ? "✓ " : "",
                            o.option_text,
                            o.is_correct ? h("span", { class: "sr-only" }, " (correct answer)") : null)))))
                : [empty("No questions yet", "Add the first question below.")];

            body.replaceChildren(...existing, addForm());
        }
        load();
    }

    // Shows the teacher what each student answered and the marks they got (checked automatically)
    function openQuizResults(quiz, ctx) {
        const body = h("div", {}, "Loading…");
        dialog(`${quiz.title}: results`, body);

        function render(questions, students, grades, info) {
            const rows = students.map((s) => {
                const score = quizScore(questions, grades.filter((x) => x.student === s.id));
                const lines = questions.map((q, i) => {
                    const pickIds = info.picks.get(`${s.id}:${q.id}`);

                    // Every option the student ticked, green if it is correct and red if not
                    const answer = pickIds
                        ? pickIds.map((id) => {
                            const o = info.options.get(id);
                            return h("div", { class: `ans ${o.correct ? "right" : "wrong"}` }, `${o.correct ? "✓" : "✗"} ${o.text}`);
                        })
                        : h("span", { class: "ans none" }, "No answer sent");

                    return h("div", { class: "mark-q" },
                        h("div", { class: "mark-row" },
                            h("span", {}, `Question ${i + 1}`),
                            h("strong", {}, `${score.given.has(q.id) ? score.given.get(q.id) : 0} / ${q.marks}`)),
                        h("div", { class: "ans-line" }, answer));
                });

                return h("tr", {},
                    h("td", {}, s.name),
                    h("td", {}, s.roll_no),
                    h("td", {}, score.marked
                        ? h("span", { class: "chip ok" }, `${score.got} / ${score.total}`)
                        : h("span", { class: "chip" }, "No answers")),
                    h("td", {},
                        h("details", {},
                            h("summary", {}, "See answers"),
                            h("div", { class: "mark-grid" }, lines))));
            });

            body.replaceChildren(
                h("p", { class: "hint" }, "Marks are given automatically when a student submits. A question gets full marks only if the student ticked exactly the correct options."),
                h("table", { class: "tbl" },
                    h("thead", {}, h("tr", {}, h("th", {}, "Name"), h("th", {}, "Roll"), h("th", {}, "Total"), h("th", {}, "Answers"))),
                    h("tbody", {}, rows)));
        }

        (async () => {
            const [qs, gr, st, sb] = await Promise.all([
                api(questionsOf(quiz.id)), api(API.quizGrades), api(classStudents(quiz.class_obj)), api(submitsOf(quiz.id))]);
            if (!qs.ok) return body.replaceChildren(errorBox(qs.error));
            if (!st.ok) return body.replaceChildren(errorBox(st.error));
            if (!qs.data.length) return body.replaceChildren(empty("No questions yet", "Add questions to this quiz to see results."));
            if (!st.data.length) return body.replaceChildren(empty("No students in this class", "Students appear here after they join."));

            // The teacher's option list includes which options are correct
            const optionSets = await Promise.all(qs.data.map((q) => api(optionsOf(q.id))));
            const options = new Map();
            optionSets.forEach((r) => arr(r).forEach((o) => options.set(o.id, { text: o.option_text, correct: o.is_correct })));
            const picks = new Map(arr(sb).map((x) => [`${x.student}:${x.question}`, x.selected_options]));

            render(qs.data, st.data, arr(gr), { options, picks });
        })();
    }

    const teacherViews = {
        studentRegister: {
            label: "Register student",
            async render(box, ctx) {
                box.append(pageHead(
                    "Register a student",
                    "Create a student login account. The role is assigned automatically, and the student can log in with this email and password."
                ));

                const username = h("input", {
                    type: "text", required: true, maxLength: 100,
                    autocomplete: "name", placeholder: "Student full name"
                });
                const email = h("input", {
                    type: "email", required: true, autocomplete: "email",
                    placeholder: "student@example.com"
                });
                const password = h("input", {
                    type: "password", required: true, autocomplete: "new-password",
                    placeholder: "Temporary password"
                });
                const roll = h("input", {
                    type: "number", required: true, min: "1", step: "1",
                    placeholder: "e.g. 14"
                });
                const grade = h("input", {
                    type: "number", required: true, min: "1", step: "1",
                    placeholder: "e.g. 8"
                });
                const picture = pictureField("Profile picture (optional)");
                const submit = h("button", { class: "btn", type: "submit" }, "Register student");

                const form = h("form", {
                    class: "panel stack",
                    onsubmit: (e) => {
                        e.preventDefault();
                        const problem = pictureProblem(picture.file);
                        if (problem) return toast(problem, "bad");

                        busy(submit, async () => {
                            const r = await sendWithPicture(
                                API.studentRegister,
                                {
                                    username: username.value.trim(),
                                    email: email.value.trim(),
                                    password: password.value,
                                    roll_no: roll.value.trim(),
                                    student_class: Number(grade.value),
                                },
                                "profile_picture",
                                picture.file
                            );

                            if (!r.ok) return toast(r.error, "bad");
                            toast("Student registered successfully. They can now log in.");
                            form.reset();
                            picture.input.dispatchEvent(new Event("change"));
                        });
                    },
                },
                    h("h2", {}, "Student details"),
                    h("div", { class: "two" },
                        h("label", { class: "field" }, "Full name", username),
                        h("label", { class: "field" }, "Email", email)),
                    h("div", { class: "two" },
                        h("label", { class: "field" }, "Temporary password", password),
                        h("label", { class: "field" }, "Roll number", roll)),
                    h("label", { class: "field", style: "max-width:260px" }, "Grade", grade),
                    picture.node,
                    h("p", { class: "hint" }, "The backend sets the role to Student. You do not need to select a role here."),
                    h("div", {}, submit)
                );

                box.append(form);
                box.append(csvPanel());
            },
        },

        parentRegister: {
            label: "Register parent",
            async render(box, ctx) {
                box.append(pageHead(
                    "Register a parent",
                    "Create a parent login account and link it to their child. The role is assigned automatically, and the parent can log in with this email and password."
                ));

                const students = arr(await api(API.students, { auth: false }));

                const username = h("input", {
                    type: "text", required: true, maxLength: 100,
                    autocomplete: "name", placeholder: "Parent full name"
                });
                const email = h("input", {
                    type: "email", required: true, autocomplete: "email",
                    placeholder: "parent@example.com"
                });
                const password = h("input", {
                    type: "password", required: true, autocomplete: "new-password",
                    placeholder: "Temporary password"
                });
                const child = h("select", {},
                    h("option", { value: "" }, students.length ? "Choose the child" : "No students registered yet"),
                    students.map((st) => h("option", { value: st.id }, `${st.name} (grade ${st.student_class}, roll ${st.roll_no})`)));
                const picture = pictureField("Profile picture (optional)");
                const submit = h("button", { class: "btn", type: "submit" }, "Register parent");

                const form = h("form", {
                    class: "panel stack",
                    onsubmit: (e) => {
                        e.preventDefault();
                        const problem = pictureProblem(picture.file);
                        if (problem) return toast(problem, "bad");

                        busy(submit, async () => {
                            const fields = {
                                username: username.value.trim(),
                                email: email.value.trim(),
                                password: password.value,
                            };
                            if (child.value) fields.child = Number(child.value);

                            const r = await sendWithPicture(API.parentRegister, fields, "profile_picture", picture.file);
                            if (!r.ok) return toast(r.error, "bad");
                            toast("Parent registered successfully. They can now log in.");
                            form.reset();
                            picture.input.dispatchEvent(new Event("change"));
                        });
                    },
                },
                    h("h2", {}, "Parent details"),
                    h("div", { class: "two" },
                        h("label", { class: "field" }, "Full name", username),
                        h("label", { class: "field" }, "Email", email)),
                    h("div", { class: "two" },
                        h("label", { class: "field" }, "Temporary password", password),
                        h("label", { class: "field" }, "Their child", child)),
                    picture.node,
                    h("p", { class: "hint" }, "The backend sets the role to Parent. You do not need to select a role here."),
                    h("div", {}, submit)
                );

                box.append(form);
            },
        },

        classes: {
            label: "My classes",
            async render(box, ctx) {
                const c = await api(API.classes);
                box.append(pageHead("My classes", "Create a class for a grade and manage who is in it. Only students of that grade can join."));

                const name = h("input", { type: "text", required: true, maxLength: 100, placeholder: "e.g. Science" });
                const level = h("input", { type: "number", required: true, min: "1", placeholder: "e.g. 8" });
                const add = h("button", { class: "btn", type: "submit" }, "Add class");
                box.append(h("form", {
                    class: "panel inline-form",
                    onsubmit: (e) => {
                        e.preventDefault();
                        busy(add, async () => {
                            const r = await api(API.classes, { method: "POST", body: { name: name.value.trim(), grade_level: Number(level.value) } });
                            if (!r.ok) return toast(r.error, "bad");
                            toast("Class added");
                            ctx.refresh();
                        });
                    },
                }, h("label", { class: "field" }, "New class name", name),
                    h("label", { class: "field", style: "flex:0 1 140px" }, "Grade", level),
                    add));

                if (!c.ok) return box.append(errorBox(c.error));
                const mine = c.data.filter((x) => x.teacher === ctx.me.id);
                if (!mine.length) return box.append(empty("You haven't created any classes yet", "Add your first class above."));

                box.append(h("div", { class: "grid" }, mine.map((cl) =>
                    classCard(cl, new Map([[ctx.me.id, "you"]]),
                        h("button", { class: "btn sm", type: "button", onclick: () => openRoster(cl, ctx) }, "Students and attendance")))));
            },
        },

        assignments: {
            label: "Assignments",
            async render(box, ctx) {
                box.append(pageHead("Assignments", "Homework you've set. Each assignment belongs to one class."));

                // The server only sends back this teacher's own classes and assignments
                const [c, a] = await Promise.all([api(API.classes), api(API.assignments)]);
                if (!c.ok) return box.append(errorBox(c.error));
                if (!c.data.length) {
                    return box.append(empty("Create a class first", "Every assignment belongs to a class, so add a class before setting homework.",
                        h("a", { class: "btn", href: "#classes" }, "Create class")));
                }

                const title = h("input", { type: "text", required: true, maxLength: 200 });
                const description = h("textarea", { required: true });
                const due = h("input", { type: "date", required: true, min: today() });
                const pickClass = h("select", { required: true }, c.data.map((x) =>
                    h("option", { value: x.id }, `${x.name} (${x.grade_level ? `grade ${x.grade_level}` : "any grade"})`)));
                const create = h("button", { class: "btn", type: "submit" }, "Create assignment");
                const picture = pictureField("Picture (optional)");

                box.append(h("form", {
                    class: "panel stack",
                    onsubmit: (e) => {
                        e.preventDefault();
                        const problem = pictureProblem(picture.file);
                        if (problem) return toast(problem, "bad");
                        busy(create, async () => {
                            const r = await sendWithPicture(
                                API.assignments,
                                {
                                    title: title.value.trim(),
                                    description: description.value.trim(),
                                    due_date: due.value,
                                    class_obj: Number(pickClass.value),
                                },
                                "assignment_picture",
                                picture.file);
                            if (!r.ok) return toast(r.error, "bad");
                            toast("Assignment created");
                            ctx.refresh();
                        });
                    },
                },
                    h("h2", {}, "New assignment"),
                    h("div", { class: "two" },
                        h("label", { class: "field" }, "Title", title),
                        h("label", { class: "field" }, "Class", pickClass)),
                    h("label", { class: "field", style: "max-width:260px" }, "Due date", due),
                    h("label", { class: "field" }, "Instructions", description),
                    picture.node,
                    h("div", {}, create)));

                if (!a.ok) return box.append(errorBox(a.error));
                if (!a.data.length) return box.append(empty("No assignments yet", "Create the first one above."));

                const sorted = [...a.data].sort((x, y) => y.due_date.localeCompare(x.due_date));
                box.append(h("div", { class: "list" }, sorted.map((as) =>
                    h("div", { class: "item" },
                        h("div", {},
                            h("h3", {}, as.title),
                            h("p", {}, as.description),
                            as.assignment_picture ? thumb(as.assignment_picture, `${as.title}: picture`) : null),
                        h("div", { class: "side-info" },
                            as.class_name
                                ? h("span", { class: "chip" }, `${as.class_name}${as.grade_level ? `, grade ${as.grade_level}` : ""}`)
                                : h("span", { class: "chip late" }, "No class"),
                            h("span", { class: "chip" }, `Due ${fmtDate(as.due_date)}`))))));
            },
        },

        grade: {
            label: "Grade work",
            async render(box, ctx) {
                box.append(pageHead("Grade work", "Pick one of your assignments to see the students in its class."));
                const [a, g, s] = await Promise.all([api(API.assignments), api(API.grades), api(API.submits)]);
                if (!a.ok) return box.append(errorBox(a.error));

                // Only assignments that belong to a class can be graded
                const usable = a.data.filter((x) => x.class_obj);
                if (!usable.length) {
                    return box.append(empty("No assignments to grade", "Create an assignment for one of your classes first.",
                        h("a", { class: "btn", href: "#assignments" }, "Create assignment")));
                }

                const grades = arr(g);
                const works = arr(s);
                const pickA = h("select", {}, usable.map((x) => h("option", { value: x.id }, `${x.title} (${x.class_name})`)));
                const out = h("div", {});

                async function load() {
                    const assignment = usable.find((x) => x.id === Number(pickA.value));
                    out.replaceChildren(h("p", { class: "muted" }, "Loading students…"));
                    const r = await api(classStudents(assignment.class_obj));
                    if (!r.ok) return out.replaceChildren(errorBox(r.error));
                    if (!r.data.length) return out.replaceChildren(empty("No students in this class", "Students appear here after they join."));

                    const rows = r.data.map((st) => {
                        const work = works.find((x) => x.assignment === assignment.id && x.student === st.id);
                        const done = grades.find((x) => x.assignment === assignment.id && x.student === st.id);

                        const homework = work
                            ? h("details", {},
                                h("summary", {}, "Read homework"),
                                h("p", { class: "homework" }, work.homework),
                                work.homework_picture ? thumb(work.homework_picture, `${st.name}: homework picture`) : null)
                            : h("span", { class: "chip" }, "Not submitted");

                        let last;
                        if (done) {
                            last = h("td", {}, h("span", { class: "stamp", title: "Saved grade" }, done.grade));
                        } else {
                            const score = h("input", { type: "number", min: "0", step: "1", "aria-label": `Score for ${st.name}`, placeholder: "Score" });
                            const save = h("button", { class: "btn sm", type: "button" }, "Save grade");
                            save.addEventListener("click", () => busy(save, async () => {
                                if (score.value === "") return toast("Enter a score first.", "bad");
                                const res = await api(API.grades, {
                                    method: "POST",
                                    body: { assignment: assignment.id, student: st.id, grade: Number(score.value) },
                                });
                                if (!res.ok) return toast(res.error, "bad");
                                grades.push(res.data);
                                toast(`Graded ${st.name}`);
                                load();
                            }));
                            last = h("td", {}, h("div", { class: "row-actions", style: "justify-content:flex-start" }, score, save));
                        }
                        return h("tr", {}, h("td", {}, st.name), h("td", {}, st.roll_no), h("td", {}, homework), last);
                    });

                    out.replaceChildren(h("table", { class: "tbl" },
                        h("thead", {}, h("tr", {}, h("th", {}, "Name"), h("th", {}, "Roll"), h("th", {}, "Homework"), h("th", {}, "Grade"))),
                        h("tbody", {}, rows)));
                }

                pickA.addEventListener("change", load);
                box.append(h("div", { class: "panel" },
                    h("label", { class: "field" }, "Assignment", pickA),
                    out));
                load();
            },
        },

        quizzes: {
            label: "Quizzes",
            async render(box, ctx) {
                box.append(pageHead("Quizzes", "Multiple-choice quizzes for your classes. Each quiz belongs to one class."));

                const [c, q] = await Promise.all([api(API.classes), api(API.quizzes)]);
                if (!c.ok) return box.append(errorBox(c.error));
                const mine = c.data.filter((x) => x.teacher === ctx.me.id);
                if (!mine.length) {
                    return box.append(empty("Create a class first", "Every quiz belongs to a class, so add a class before setting a quiz.",
                        h("a", { class: "btn", href: "#classes" }, "Create class")));
                }

                const title = h("input", { type: "text", required: true, maxLength: 200 });
                const description = h("textarea", { placeholder: "Optional instructions for students" });
                const due = h("input", { type: "datetime-local", required: true, min: nowLocal() });
                const pickClass = h("select", { required: true }, mine.map((x) =>
                    h("option", { value: x.id }, `${x.name} (${x.grade_level ? `grade ${x.grade_level}` : "any grade"})`)));
                const create = h("button", { class: "btn", type: "submit" }, "Create quiz");

                box.append(h("form", {
                    class: "panel stack",
                    onsubmit: (e) => {
                        e.preventDefault();
                        busy(create, async () => {
                            const r = await api(API.quizzes, {
                                method: "POST",
                                body: {
                                    title: title.value.trim(),
                                    description: description.value.trim(),
                                    due_date: new Date(due.value).toISOString(),
                                    class_obj: Number(pickClass.value),
                                },
                            });
                            if (!r.ok) return toast(r.error, "bad");
                            toast("Quiz created. Use \"Questions\" to add its questions.");
                            ctx.refresh();
                        });
                    },
                },
                    h("h2", {}, "New quiz"),
                    h("div", { class: "two" },
                        h("label", { class: "field" }, "Title", title),
                        h("label", { class: "field" }, "Class", pickClass)),
                    h("label", { class: "field", style: "max-width:260px" }, "Closes on", due),
                    h("label", { class: "field" }, "Instructions", description),
                    h("div", {}, create)));

                if (!q.ok) return box.append(errorBox(q.error));
                if (!q.data.length) return box.append(empty("No quizzes yet", "Create the first one above."));

                const sorted = [...q.data].sort((x, y) => new Date(y.due_date) - new Date(x.due_date));
                box.append(h("div", { class: "list" }, sorted.map((quiz) =>
                    h("div", { class: "item" },
                        h("div", {},
                            h("h3", {}, quiz.title),
                            quiz.description ? h("p", {}, quiz.description) : null,
                            h("div", { class: "chips" },
                                quiz.class_name ? h("span", { class: "chip" }, `${quiz.class_name}${quiz.grade_level ? `, grade ${quiz.grade_level}` : ""}`) : null,
                                h("span", { class: `chip ${isClosed(quiz) ? "late" : ""}` }, `${isClosed(quiz) ? "Closed" : "Closes"} ${fmtDateTime(quiz.due_date)}`))),
                        h("div", { class: "side-info" },
                            h("button", { class: "btn sm ghost", type: "button", onclick: () => openQuestions(quiz, ctx) }, "Questions"),
                            h("button", { class: "btn sm", type: "button", onclick: () => openQuizResults(quiz, ctx) }, "Results"))))));
            },
        },

        notices: noticesView(true),
        profile: profileView("teacher"),        notices: noticesView(true),
        profile: profileView("teacher"),
    };

    /* ------------------------------------------------------------------
       Dashboard shell (sidebar + main area)
    ------------------------------------------------------------------ */
    const VIEWS = { student: studentViews, parent: parentViews, teacher: teacherViews };

    function mountShell(role, views, ctx) {
        const app = $("#app");
        const keys = Object.keys(views);
        const nav = h("nav", { class: "nav", "aria-label": "Sections" },
            keys.map((k) => h("a", { href: `#${k}`, "data-view": k }, views[k].label)));
        const main = h("main", { class: "main", id: "main" });

        // Picture + name at the bottom of the sidebar (click it to open your profile)
        const whoTop = h("a", { class: "who-top", href: "#profile", title: "Open my profile" });
        ctx.paintWho = () => whoTop.replaceChildren(
            avatar(ctx.profile, ctx.me.name),
            h("div", { class: "who-text" }, h("strong", {}, ctx.me.name), h("span", {}, ROLE_LABEL[role])));
        ctx.paintWho();

        app.append(
            h("aside", { class: "side" },
                h("a", { class: "brand", href: HOME[role] }, "Isha's ", h("b", {}, "Academy")),
                nav,
                h("div", { class: "who" },
                    whoTop,
                    h("button", { class: "btn sm", type: "button", onclick: logout }, "Log out"))),
            main);

        let routeId = 0;
        async function route() {
            const wanted = location.hash.slice(1);
            const key = keys.includes(wanted) ? wanted : keys[0];
            const mine = ++routeId;

            nav.querySelectorAll("a").forEach((a) => {
                const on = a.dataset.view === key;
                a.classList.toggle("on", on);
                if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
            });

            const box = h("div", {});
            await views[key].render(box, ctx);
            if (mine === routeId) main.replaceChildren(box);
        }

        ctx.refresh = route;
        window.addEventListener("hashchange", route);
        route();
    }

    async function bootDashboard(role) {
        if (!session.token || !session.role) return location.replace("/login/");
        if (session.role !== role) return location.replace(HOME[session.role] || "/login/");

        const listUrl = { student: API.students, teacher: API.teachers, parent: API.parents }[role];
        const [r, pr] = await Promise.all([api(listUrl, { auth: false }), api(API.profile)]);
        const me = arr(r).find((x) => x.person === session.personId);
        const profile = pr.ok ? pr.data : null;   // has the photo; if it fails we just show initials

        if (!me) {
            return $("#app").append(h("main", { class: "main" },
                empty("We couldn't find your profile", r.ok ? "Log out and log back in, or ask the school office for help." : r.error,
                    h("button", { class: "btn", type: "button", onclick: logout }, "Log out"))));
        }
        mountShell(role, VIEWS[role], { me, profile });
    }

    /* ------------------------------------------------------------------
       Login page
    ------------------------------------------------------------------ */
    function bootLogin() {
        const form = $("#login-form");
        const error = $("#login-error");
        const banner = $("#login-banner");
        const params = new URLSearchParams(location.search);

        if (params.get("registered")) {
            banner.className = "alert ok";
            banner.textContent = "Account created. Log in to continue.";
            banner.hidden = false;
        } else if (params.get("expired")) {
            banner.className = "alert";
            banner.textContent = "Your session ended. Please log in again.";
            banner.hidden = false;
        }

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            error.hidden = true;
            if (!form.reportValidity()) return;

            const button = $("#login-btn");
            const r = await busy(button, () => api(API.login, {
                method: "POST", auth: false,
                body: { email: $("#email").value.trim(), password: $("#password").value },
            }));

            if (!r.ok) {
                error.textContent = r.error;
                error.hidden = false;
                return;
            }
            if (!r.data.token || !HOME[r.data.role]) {
                error.textContent = "Login worked, but the server didn't send a valid token and role.";
                error.hidden = false;
                return;
            }
            session.save(r.data.token, r.data.role);
            location.href = HOME[r.data.role];
        });
    }

    /* ------------------------------------------------------------------
       Register page
    ------------------------------------------------------------------ */
    function bootRegister() {
        // Only teachers sign up here. Teachers register students and parents
        // from inside their own dashboard.
        const form = $("#register-form");
        const error = $("#register-error");

        // If an older register.html is still in place, hide its Student/Parent
        // parts so their empty required boxes cannot block the sign-up.
        form.querySelectorAll("fieldset[data-role]").forEach((fs) => { fs.hidden = true; fs.disabled = true; });
        const oldChoice = form.querySelector(".seg");
        if (oldChoice) oldChoice.hidden = true;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            error.hidden = true;
            if (!form.reportValidity()) return;

            const body = {
                username: $("#username").value.trim(),
                email: $("#email").value.trim(),
                password: $("#password").value,
                role: "teacher",
            };

            // If a photo was chosen we must send a form instead of plain JSON
            const photo = $("#photo").files[0];
            let request;
            if (photo) {
                const fd = new FormData();
                Object.entries(body).forEach(([key, value]) => fd.append(key, value));
                fd.append("profile_picture", photo);
                request = () => api(API.register, { method: "POST", form: fd, auth: false });
            } else {
                request = () => api(API.register, { method: "POST", body, auth: false });
            }

            const r = await busy($("#register-btn"), request);
            if (!r.ok) {
                error.textContent = r.error;
                error.hidden = false;
                return;
            }
            $("#register-wrap").hidden = true;
            $("#register-done").hidden = false;
        });
    }

    /* ------------------------------------------------------------------
       Start
    ------------------------------------------------------------------ */
    if (PAGE === "login") bootLogin();
    else if (PAGE === "register") bootRegister();
    else if (PAGE === "notices") {
        // The notices live inside each dashboard now
        location.replace(session.role && HOME[session.role] ? `${HOME[session.role]}#notices` : "/login/");
    } else if (HOME[PAGE]) bootDashboard(PAGE);
})();